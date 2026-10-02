import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { DataSource, In } from 'typeorm';
import { SPREAD_CREATED_EVENT, SPREAD_CREATED_QUEUE, type EventEnvelope } from '@cosmic-arcana/sdk';
import type { AppConfig, OutboxConfig } from '../config/configuration';
import { runWithCorrelationId } from '../common/correlation/correlation.storage';
import { elapsedMs } from '../common/logging/elapsed-ms';
import { OutboxEntity } from './outbox.entity';

/** Completed jobs stay long enough for BullMQ's jobId check to absorb a relay re-publish. */
const COMPLETED_JOB_RETENTION_S = 24 * 60 * 60;

/**
 * Polling relay: pending outbox rows -> BullMQ -> marked published. Delivery is at-least-once;
 * a crash between publish and commit re-publishes, and consumers dedupe through their inbox.
 *
 * Polling is the simple first step. The planned swap is CDC (Debezium reading the WAL), which
 * removes the polling load and the publish/commit gap without changing producers or consumers.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly settings: OutboxConfig;
  private readonly producer: string;
  private readonly queues: ReadonlyMap<string, Queue>;
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<unknown> | null = null;
  private stopped = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectQueue(SPREAD_CREATED_QUEUE) spreadCreatedQueue: Queue,
    config: ConfigService,
  ) {
    this.settings = config.getOrThrow<OutboxConfig>('outbox');
    this.producer = config.getOrThrow<AppConfig['serviceName']>('serviceName');
    this.queues = new Map([[SPREAD_CREATED_EVENT, spreadCreatedQueue]]);
  }

  onApplicationBootstrap(): void {
    if (this.settings.relayEnabled) {
      this.scheduleNextTick();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    await this.inFlight;
  }

  /**
   * Publishes one batch and returns how many rows were marked published. Row locks with
   * SKIP LOCKED let several relay instances run without publishing the same row concurrently.
   */
  relayPending(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .getRepository(OutboxEntity)
        .createQueryBuilder('outbox')
        .where('outbox.status = :status', { status: 'pending' })
        .orderBy('outbox.createdAt', 'ASC')
        .limit(this.settings.batchSize)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      const published: string[] = [];
      for (const [eventType, group] of groupByEventType(rows)) {
        const queue = this.queues.get(eventType);
        if (!queue) {
          this.logger.error('outbox event type has no queue', { eventType });
          continue;
        }
        // Stop at the first failed batch: the broker is most likely down, and stopping keeps order.
        if (!(await this.publishBatch(queue, group))) {
          break;
        }
        published.push(...group.map((row) => row.id));
      }

      if (published.length > 0) {
        await manager.update(
          OutboxEntity,
          { id: In(published) },
          { status: 'published', publishedAt: new Date() },
        );
      }
      return published.length;
    });
  }

  private scheduleNextTick(delayMs = this.settings.pollIntervalMs): void {
    if (this.stopped) {
      return;
    }
    this.timer = setTimeout(() => {
      this.inFlight = this.relayPending()
        // A full batch means a backlog is likely, so the next tick starts at once. A short batch,
        // including one cut short by a publish failure, waits the poll interval as before.
        .then((published) => published === this.settings.batchSize)
        .catch((error: Error) => {
          this.logger.warn('outbox relay tick failed', {
            errorName: error.name,
            errorMessage: error.message,
          });
          return false;
        })
        .then((backlogged) => {
          this.inFlight = null;
          this.scheduleNextTick(backlogged ? 0 : this.settings.pollIntervalMs);
        });
    }, delayMs);
  }

  /**
   * One round trip to the broker for the whole group. A refused batch publishes nothing, so the
   * rows stay pending and go out together on the next tick; a crash between publish and commit
   * re-publishes, which the job id absorbs.
   */
  private async publishBatch(queue: Queue, rows: OutboxEntity[]): Promise<boolean> {
    const startedAt = process.hrtime.bigint();
    const jobs = rows.map((row) => {
      const envelope: EventEnvelope<object> = {
        meta: { correlationId: row.correlationId, producer: this.producer },
        data: row.payload,
      };
      return {
        name: row.eventType,
        data: envelope,
        opts: {
          jobId: row.id,
          attempts: this.settings.deliveryAttempts,
          backoff: { type: 'exponential', delay: this.settings.deliveryBackoffMs },
          removeOnComplete: { age: COMPLETED_JOB_RETENTION_S },
          removeOnFail: false,
        },
      };
    });

    try {
      await queue.addBulk(jobs);
    } catch (error) {
      const { name, message } = error as Error;
      this.logger.warn('outbound publish failed', {
        messagePattern: rows[0].eventType,
        batchSize: rows.length,
        durationMs: elapsedMs(startedAt),
        outcome: 'error',
        errorName: name,
        errorMessage: message,
      });
      return false;
    }

    // One line per event, each under its own correlation id, so a request can still be followed.
    const durationMs = elapsedMs(startedAt);
    for (const row of rows) {
      runWithCorrelationId(row.correlationId, () =>
        this.logger.log('outbound publish completed', {
          messagePattern: row.eventType,
          eventId: row.id,
          batchSize: rows.length,
          durationMs,
          outcome: 'success',
        }),
      );
    }
    return true;
  }
}

/** Rows arrive oldest first; grouping by event type keeps that order inside each group. */
const groupByEventType = (rows: OutboxEntity[]): Map<string, OutboxEntity[]> => {
  const groups = new Map<string, OutboxEntity[]>();
  for (const row of rows) {
    const group = groups.get(row.eventType);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.eventType, [row]);
    }
  }
  return groups;
};

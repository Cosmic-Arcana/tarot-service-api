import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { registry } from './containers';

/** Runs once for the whole e2e suite; workers inherit the env vars set here. */
export default async function globalSetup(): Promise<void> {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:18-alpine').start(),
    new RedisContainer('redis:8-alpine').start(),
  ]);

  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.DATABASE_RUN_MIGRATIONS = 'true';
  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = String(redis.getPort());
  // The relay is driven explicitly in tests instead of on a timer.
  process.env.OUTBOX_RELAY_ENABLED = 'false';

  registry.__COSMIC_ARCANA_CONTAINERS__ = [postgres, redis];
}

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import type { LogLevel } from '@nestjs/common';
import { inspect } from 'node:util';
import { getCorrelationId } from '../correlation/correlation.storage';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

const REDACTED_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'password',
  'secret',
  'token',
  'question',
]);

export const redact = (fields: Record<string, unknown>): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    output[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[redacted]' : value;
  }
  return output;
};

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLogger implements LoggerService {
  private readonly threshold: number;

  constructor(
    private readonly service: string,
    level: LogLevel = 'log',
  ) {
    this.threshold = LEVEL_PRIORITY[level];
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.write('log', message, rest);
  }

  warn(message: unknown, ...rest: unknown[]): void {
    this.write('warn', message, rest);
  }

  debug(message: unknown, ...rest: unknown[]): void {
    this.write('debug', message, rest);
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    this.write('verbose', message, rest);
  }

  fatal(message: unknown, ...rest: unknown[]): void {
    this.write('fatal', message, rest);
  }

  error(message: unknown, ...rest: unknown[]): void {
    this.write('error', message, rest);
  }

  private write(level: LogLevel, message: unknown, rest: unknown[]): void {
    if (LEVEL_PRIORITY[level] > this.threshold) {
      return;
    }

    const { context, stack, fields } = this.parseRest(rest);

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      correlationId: getCorrelationId(),
      context: context ?? null,
      message: typeof message === 'string' ? message : inspect(message, { depth: 3 }),
      ...redact(fields),
    };

    if (stack && (level === 'error' || level === 'fatal')) {
      entry.stack = stack;
    }

    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }

  /**
   * Nest passes trailing arguments positionally and untyped: a bare string is the context,
   * an error-level string that looks multi-line is a stack, and objects are extra fields.
   */
  private parseRest(rest: unknown[]): {
    context?: string;
    stack?: string;
    fields: Record<string, unknown>;
  } {
    let context: string | undefined;
    let stack: string | undefined;
    const fields: Record<string, unknown> = {};

    for (const item of rest) {
      if (typeof item === 'string') {
        if (item.includes('\n') && !stack) {
          stack = item;
        } else {
          context = item;
        }
        continue;
      }
      if (item instanceof Error) {
        fields.errorName = item.name;
        fields.errorMessage = item.message;
        stack ??= item.stack;
        continue;
      }
      if (typeof item === 'object' && item !== null) {
        Object.assign(fields, item);
      }
    }

    return { context, stack, fields };
  }
}

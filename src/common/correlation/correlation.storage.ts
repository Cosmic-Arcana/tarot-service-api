import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationStore {
  correlationId: string;
}

/**
 * Module-level singleton rather than a DI provider: the structured logger is built in
 * main.ts before the DI container exists, and it still has to resolve the correlation id.
 */
export const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

export const getCorrelationId = (): string | null =>
  correlationStorage.getStore()?.correlationId ?? null;

export const runWithCorrelationId = <T>(correlationId: string, callback: () => T): T =>
  correlationStorage.run({ correlationId }, callback);

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_REPLAYED_HEADER = 'idempotency-replayed';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export const isValidIdempotencyKey = (value: unknown): value is string =>
  typeof value === 'string' && IDEMPOTENCY_KEY_PATTERN.test(value);

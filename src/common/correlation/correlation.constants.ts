export const CORRELATION_ID_HEADER = 'x-correlation-id';

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export const isValidCorrelationId = (value: unknown): value is string =>
  typeof value === 'string' && CORRELATION_ID_PATTERN.test(value);

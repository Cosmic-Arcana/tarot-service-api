/**
 * A replayed key must carry the original request. Returning the stored spread for a different
 * user or question would hand one user's reading to another.
 */
export class IdempotencyKeyConflictError extends Error {
  override readonly name = 'IdempotencyKeyConflictError';

  constructor() {
    super('idempotency key was already used for a different request');
  }
}

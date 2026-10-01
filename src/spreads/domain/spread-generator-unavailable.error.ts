export type GeneratorFailure = 'unreachable' | 'timeout' | 'refused';

/**
 * The generator could not produce a spread. Nothing about the cause is in the message on purpose:
 * it reaches the caller, and the underlying error names hosts and ports. The cause is logged where
 * the call was made.
 */
export class SpreadGeneratorUnavailableError extends Error {
  override readonly name = 'SpreadGeneratorUnavailableError';

  constructor(readonly reason: GeneratorFailure) {
    super('spread generator unavailable');
  }
}

import { describe, expect, it, vi } from 'vitest';
import { formatGrpcMutationErrorMessage, runGrpcMutationWithError } from './grpcMutationErrors';

describe('grpcMutationErrors', () => {
  it('formats known Error values using the original message', () => {
    expect(formatGrpcMutationErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('formats unknown values using the fallback message', () => {
    expect(formatGrpcMutationErrorMessage('oops', 'fallback')).toBe('fallback');
  });

  it('clears and preserves no error when mutation succeeds', async () => {
    const setLastMutationError = vi.fn();

    const result = await runGrpcMutationWithError({
      operation: async () => 42,
      setLastMutationError,
      fallbackMessage: 'fallback',
    });

    expect(result).toBe(42);
    expect(setLastMutationError).toHaveBeenCalledTimes(1);
    expect(setLastMutationError).toHaveBeenCalledWith(undefined);
  });

  it('stores formatted error and rethrows when mutation fails', async () => {
    const setLastMutationError = vi.fn();

    await expect(runGrpcMutationWithError({
      operation: async () => {
        throw 'unexpected';
      },
      setLastMutationError,
      fallbackMessage: 'fallback',
    })).rejects.toBe('unexpected');

    expect(setLastMutationError).toHaveBeenNthCalledWith(1, undefined);
    expect(setLastMutationError).toHaveBeenNthCalledWith(2, 'fallback');
  });
});

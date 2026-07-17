/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  ReflectionFetchError,
  formatReflectionFailureMessage,
} from './reflectionDiagnostics.js';

describe('reflectionDiagnostics coverage gaps', () => {
  it('formats single-version reflection failure', () => {
    expect(formatReflectionFailureMessage({
      fallbackAttempted: false,
      v1Error: 'reflection disabled',
    })).toBe('reflection disabled');
  });

  it('formats fallback reflection failure with both versions', () => {
    expect(formatReflectionFailureMessage({
      fallbackAttempted: true,
      v1Error: 'v1 down',
      v1alphaError: 'v1alpha down',
    })).toBe('Server reflection failed (v1: v1 down; v1alpha: v1alpha down)');
  });

  it('uses unknown error placeholders when version errors are missing', () => {
    expect(formatReflectionFailureMessage({ fallbackAttempted: true })).toBe(
      'Server reflection failed (v1: unknown error; v1alpha: unknown error)',
    );
  });

  it('falls back to generic message when single-version error text is missing', () => {
    expect(formatReflectionFailureMessage({ fallbackAttempted: false })).toBe('Server reflection failed');
  });

  it('stores diagnostics on ReflectionFetchError', () => {
    const diagnostics = { fallbackAttempted: false, v1Error: 'nope' };
    const error = new ReflectionFetchError('failed', diagnostics);
    expect(error.name).toBe('ReflectionFetchError');
    expect(error.diagnostics).toEqual(diagnostics);
    expect(error.message).toBe('failed');
  });
});

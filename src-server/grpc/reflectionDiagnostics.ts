/**
 * Phase 3D — structured reflection failure diagnostics.
 */

export interface ReflectionFailureDiagnostics {
  v1Error?: string;
  v1alphaError?: string;
  fallbackAttempted: boolean;
  reflectionVersion?: 'v1' | 'v1alpha';
}

export class ReflectionFetchError extends Error {
  readonly diagnostics: ReflectionFailureDiagnostics;

  constructor(message: string, diagnostics: ReflectionFailureDiagnostics) {
    super(message);
    this.name = 'ReflectionFetchError';
    this.diagnostics = diagnostics;
  }
}

export function formatReflectionFailureMessage(diagnostics: ReflectionFailureDiagnostics): string {
  if (!diagnostics.fallbackAttempted) {
    return diagnostics.v1Error ?? 'Server reflection failed';
  }
  const v1 = diagnostics.v1Error ?? 'unknown error';
  const v1alpha = diagnostics.v1alphaError ?? 'unknown error';
  return `Server reflection failed (v1: ${v1}; v1alpha: ${v1alpha})`;
}

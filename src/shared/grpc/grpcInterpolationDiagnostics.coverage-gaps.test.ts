/**
 * Coverage gaps — grpcInterpolationDiagnostics.ts (Phase 9E).
 */
import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import {
  buildSafeGrpcInterpolationDiagnosticPayload,
  formatGrpcInterpolationCycleMessage,
  formatGrpcInterpolationCyclePath,
  isGrpcSecretInterpolationEnvKey,
  sanitizeGrpcInterpolationDiagnosticMessage,
} from './grpcInterpolationDiagnostics';

describe('grpcInterpolationDiagnostics coverage gaps', () => {
  it('isGrpcSecretInterpolationEnvKey rejects blank keys and matches credential patterns', () => {
    expect(isGrpcSecretInterpolationEnvKey('')).toBe(false);
    expect(isGrpcSecretInterpolationEnvKey('   ')).toBe(false);
    expect(isGrpcSecretInterpolationEnvKey('clientCredential')).toBe(true);
    expect(isGrpcSecretInterpolationEnvKey('dbPasswd')).toBe(true);
  });

  it('formatGrpcInterpolationCyclePath collapses single-token paths', () => {
    expect(formatGrpcInterpolationCyclePath(['onlyToken'])).toBe('onlyToken');
    expect(formatGrpcInterpolationCyclePath([])).toBe('');
  });

  it('formatGrpcInterpolationCycleMessage uses generic text when path is empty', () => {
    expect(formatGrpcInterpolationCycleMessage([]))
      .toBe('Circular variable reference detected in environment variables');
  });

  it('sanitizeGrpcInterpolationDiagnosticMessage returns early without env or message', () => {
    expect(sanitizeGrpcInterpolationDiagnosticMessage('keep me')).toBe('keep me');
    expect(sanitizeGrpcInterpolationDiagnosticMessage('', { env: { a: 'b' } })).toBe('');
    expect(sanitizeGrpcInterpolationDiagnosticMessage('msg', { env: undefined })).toBe('msg');
  });

  it('buildSafeGrpcInterpolationDiagnosticPayload derives cyclePath from CYCLE issue message', () => {
    const payload = buildSafeGrpcInterpolationDiagnosticPayload({
      field: 'interpolationEnv',
      code: GRPC_INTERPOLATION_ERROR_CODES.CYCLE,
      message: 'Circular variable reference: alpha → beta → alpha',
    });
    expect(payload.tokenPath).toEqual(['alpha', 'beta', 'alpha']);
  });

  it('buildSafeGrpcInterpolationDiagnosticPayload omits tokenPath for non-cycle issues', () => {
    const payload = buildSafeGrpcInterpolationDiagnosticPayload({
      field: 'grpcHost',
      code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
      message: 'Missing grpcHost',
    });
    expect(payload.tokenPath).toBeUndefined();
  });
});

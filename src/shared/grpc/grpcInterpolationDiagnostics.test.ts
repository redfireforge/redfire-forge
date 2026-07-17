import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  buildGrpcInterpolationCycleIssue,
  buildSafeGrpcInterpolationDiagnosticPayload,
  formatGrpcInterpolationCycleMessage,
  isGrpcSecretInterpolationEnvKey,
  sanitizeGrpcInterpolationDiagnosticMessage,
} from './grpcInterpolationDiagnostics';

describe('grpcInterpolationDiagnostics (Phase 9E)', () => {
  it('classifies secret-backed env keys', () => {
    expect(isGrpcSecretInterpolationEnvKey('bearerToken')).toBe(true);
    expect(isGrpcSecretInterpolationEnvKey('api-key')).toBe(true);
    expect(isGrpcSecretInterpolationEnvKey('grpcHost')).toBe(false);
  });

  it('formats cycle messages with token names only', () => {
    expect(formatGrpcInterpolationCycleMessage(['a', 'b', 'a']))
      .toBe('Circular variable reference: a → b → a');
  });

  it('buildGrpcInterpolationCycleIssue uses CYCLE error code', () => {
    const issue = buildGrpcInterpolationCycleIssue(['secretA', 'secretB', 'secretA']);
    expect(issue.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.CYCLE);
    expect(issue.message).not.toMatch(/shh|password123/);
  });

  it('redacts secret env values from diagnostic messages', () => {
    const env = {
      bearerToken: 'super-secret-token-value',
      grpcHost: 'localhost:50051',
    };
    const message = 'Unresolved token bearerToken value super-secret-token-value; grpcHost is localhost:50051';
    const sanitized = sanitizeGrpcInterpolationDiagnosticMessage(message, { env });
    expect(sanitized).toContain(GRPC_REDACTED_PLACEHOLDER);
    expect(sanitized).not.toContain('super-secret-token-value');
    expect(sanitized).toContain('localhost:50051');
  });

  it('does not corrupt token names when secret env value is a substring', () => {
    const env = { bearerToken: 'host' };
    const message = 'Circular variable reference: grpcHost → apiHost → grpcHost';
    const sanitized = sanitizeGrpcInterpolationDiagnosticMessage(message, { env });
    expect(sanitized).toBe(message);
  });

  it('redacts all env values when redactAllEnvValues is set', () => {
    const env = { grpcHost: 'localhost:50051' };
    const message = 'Failed resolving localhost:50051';
    const sanitized = sanitizeGrpcInterpolationDiagnosticMessage(message, {
      env,
      redactAllEnvValues: true,
    });
    expect(sanitized).toBe(`Failed resolving ${GRPC_REDACTED_PLACEHOLDER}`);
  });

  it('buildSafeGrpcInterpolationDiagnosticPayload includes tokenPath for cycles', () => {
    const issue = buildGrpcInterpolationCycleIssue(['a', 'b', 'a']);
    const payload = buildSafeGrpcInterpolationDiagnosticPayload(issue, {
      cyclePath: ['a', 'b', 'a'],
      env: { a: 'x', b: 'y' },
    });
    expect(payload.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.CYCLE);
    expect(payload.tokenPath).toEqual(['a', 'b', 'a']);
    expect(payload.message).not.toContain('x');
    expect(payload.message).not.toContain('y');
  });
});

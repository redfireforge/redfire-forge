/**
 * @vitest-environment node
 * Phase 4F — transport error envelope tests.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import { createGrpcTransportErrorEnvelope } from './grpcTransportEnvelope.js';

describe('grpcTransportEnvelope (Phase 4F)', () => {
  it('returns sanitized envelope with tlsFailure details', () => {
    const envelope = createGrpcTransportErrorEnvelope(
      'call',
      new Error('self signed certificate'),
      { requestId: 'req-1', durationMs: 12 },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(envelope.error.message).not.toContain('-----BEGIN');
    expect((envelope.error.details as { tlsFailure?: string })?.tlsFailure).toBe('unknown_ca');
  });

  it('maps grpc PERMISSION_DENIED to auth_denied details', () => {
    const envelope = createGrpcTransportErrorEnvelope(
      'call',
      new Error('7 PERMISSION_DENIED: Access denied'),
      { requestId: 'req-2' },
      { grpcStatus: 7, grpcDetails: 'Access denied' },
    );
    expect(envelope.error.details).toEqual(
      expect.objectContaining({ authFailure: 'auth_denied', grpcStatus: 7 }),
    );
  });
});

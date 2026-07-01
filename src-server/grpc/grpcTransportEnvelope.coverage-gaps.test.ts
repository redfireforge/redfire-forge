/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import {
  createGrpcTransportErrorEnvelope,
  createGrpcTransportRouteError,
} from './grpcTransportEnvelope.js';

describe('grpcTransportEnvelope coverage gaps', () => {
  it('createGrpcTransportRouteError delegates to createGrpcTransportErrorEnvelope', () => {
    const envelope = createGrpcTransportRouteError<{ ok: boolean }>(
      'call',
      new Error('connection reset'),
      { requestId: 'req-route' },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.op).toBe('call');
    expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
  });

  it('includes grpcMetadata trailers when hints provide metadata', () => {
    const envelope = createGrpcTransportErrorEnvelope(
      'call',
      new Error('7 PERMISSION_DENIED'),
      { requestId: 'req-trailers' },
      {
        grpcStatus: 7,
        grpcDetails: 'denied',
        grpcMetadata: { 'x-request-id': 'abc' },
      },
    );
    expect(envelope.error.details).toEqual(
      expect.objectContaining({
        authFailure: 'auth_denied',
        trailers: { 'x-request-id': 'abc' },
      }),
    );
  });
});

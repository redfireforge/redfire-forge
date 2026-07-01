/**
 * Phase 4F — transport failure classifier tests.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import {
  classifyGrpcTransportFailure,
  formatGrpcTransportFailureMessage,
  formatGrpcTransportStatusMessage,
} from './grpcTransportErrors';

describe('grpcTransportErrors (Phase 4F)', () => {
  it('classifies unknown CA TLS failures', () => {
    const result = classifyGrpcTransportFailure(
      new Error('self signed certificate in certificate chain'),
    );
    expect(result.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(result.details.tlsFailure).toBe('unknown_ca');
    expect(result.message).toMatch(/not trusted/i);
  });

  it('classifies hostname mismatch', () => {
    const result = classifyGrpcTransportFailure(
      new Error('Hostname/IP does not match certificate\'s altnames'),
    );
    expect(result.details.tlsFailure).toBe('hostname_mismatch');
  });

  it('classifies expired certificates', () => {
    const result = classifyGrpcTransportFailure(
      new Error('certificate has expired'),
    );
    expect(result.details.tlsFailure).toBe('expired_cert');
  });

  it('classifies connect ETIMEDOUT as unreachable without tlsFailure', () => {
    const result = classifyGrpcTransportFailure(new Error('connect ETIMEDOUT'));
    expect(result.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(result.retryable).toBe(true);
    expect(result.details.tlsFailure).toBeUndefined();
  });

  it('classifies TLS handshake timeout category when message matches', () => {
    const result = classifyGrpcTransportFailure(new Error('handshake timeout'));
    expect(result.details.tlsFailure).toBe('handshake_timeout');
    expect(result.retryable).toBe(true);
  });

  it('does not classify gRPC DEADLINE_EXCEEDED as TLS handshake timeout', () => {
    const result = classifyGrpcTransportFailure(new Error('4 DEADLINE_EXCEEDED'), {
      grpcStatus: 4,
      grpcDetails: 'Deadline Exceeded',
    });
    expect(result.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
    expect(result.details.tlsFailure).toBeUndefined();
    expect(result.details.grpcStatus).toBe(4);
    expect(result.message).toMatch(/Deadline Exceeded/i);
  });

  it('classifies TLS ETIMEDOUT during handshake', () => {
    const result = classifyGrpcTransportFailure(
      new Error('connect ETIMEDOUT during TLS handshake'),
    );
    expect(result.details.tlsFailure).toBe('handshake_timeout');
  });

  it('classifies invalid PEM material', () => {
    const result = classifyGrpcTransportFailure(new Error('error:0909006C:PEM routines'));
    expect(result.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    expect(result.details.tlsFailure).toBe('invalid_pem');
  });

  it('classifies gRPC UNAUTHENTICATED as auth_denied', () => {
    const result = classifyGrpcTransportFailure(new Error('RPC failed'), {
      grpcStatus: 16,
      grpcDetails: 'Invalid credentials',
    });
    expect(result.details.authFailure).toBe('auth_denied');
    expect(result.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
    expect(formatGrpcTransportFailureMessage({ authFailure: 'auth_denied' }))
      .toMatch(/rejected the call credentials/i);
  });

  it('classifies OpenSSL certificate verify failed as unknown_ca not handshake_timeout', () => {
    const result = classifyGrpcTransportFailure(
      new Error('SSL handshake failed: certificate verify failed'),
    );
    expect(result.details.tlsFailure).toBe('unknown_ca');
    expect(result.details.tlsFailure).not.toBe('handshake_timeout');
  });

  it('classifies OpenSSL error codes with certificate verify failed as unknown_ca', () => {
    const result = classifyGrpcTransportFailure(
      new Error('454086EC:error:1416F086:SSL routines:tls_process_server_certificate:certificate verify failed'),
    );
    expect(result.details.tlsFailure).toBe('unknown_ca');
    expect(result.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
  });

  it('classifies invalid_client_cert TLS failures', () => {
    const result = classifyGrpcTransportFailure(new Error('tlsv1 alert bad certificate'));
    expect(result.details.tlsFailure).toBe('invalid_client_cert');
    expect(result.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
  });

  it('formatGrpcTransportStatusMessage maps PERMISSION_DENIED to auth message', () => {
    const message = formatGrpcTransportStatusMessage(7, 'Access denied');
    expect(message).toMatch(/rejected the call credentials/i);
  });

  it('classifies gRPC UNAVAILABLE connect failures as unreachable when status is set', () => {
    const result = classifyGrpcTransportFailure(
      new Error('14 UNAVAILABLE: failed to connect to all addresses'),
      { grpcStatus: 14, grpcDetails: 'failed to connect to all addresses' },
    );
    expect(result.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(result.category).toBe('unreachable');
    expect(result.retryable).toBe(true);
    expect(result.details.tlsFailure).toBeUndefined();
  });

  it('classifies gRPC UNAVAILABLE as call_failed when status is set', () => {
    const result = classifyGrpcTransportFailure(new Error('14 UNAVAILABLE'), {
      grpcStatus: 14,
      grpcDetails: 'Service temporarily unavailable',
    });
    expect(result.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
    expect(result.category).toBe('call_failed');
    expect(result.details.grpcStatus).toBe(14);
    expect(result.details.tlsFailure).toBeUndefined();
    expect(result.message).toMatch(/Service temporarily unavailable/i);
  });

  it('classifies PERMISSION_DENIED as auth_denied', () => {
    const result = classifyGrpcTransportFailure(new Error('RPC failed'), { grpcStatus: 7 });
    expect(result.details.authFailure).toBe('auth_denied');
  });
});

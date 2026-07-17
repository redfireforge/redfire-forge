import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import {
  classifyGrpcTransportFailure,
  formatGrpcTransportFailureMessage,
  formatGrpcTransportStatusMessage,
} from './grpcTransportErrors';

describe('grpcTransportErrors coverage gaps', () => {
  it('formatGrpcTransportFailureMessage covers TLS defaults and fallbacks', () => {
    expect(formatGrpcTransportFailureMessage({ tlsFailure: 'unknown_ca' }))
      .toMatch(/not trusted/i);
    expect(formatGrpcTransportFailureMessage({ fallback: '  custom failure  ' }))
      .toBe('custom failure');
    expect(formatGrpcTransportFailureMessage({})).toBe('Transport connection failed.');
  });

  it('formatGrpcTransportStatusMessage returns status message for OK', () => {
    expect(formatGrpcTransportStatusMessage(0, 'OK')).toBe('OK');
  });

  it('classifies descriptor decode failures and generic call failures', () => {
    const decode = classifyGrpcTransportFailure(new Error('Type com.example.Foo not found'));
    expect(decode.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    expect(decode.category).toBe('validation');

    const generic = classifyGrpcTransportFailure('plain string failure');
    expect(generic.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
    expect(generic.message).toBe('plain string failure');
  });

  it('combinedMessage appends grpcDetails when not already present', () => {
    const result = classifyGrpcTransportFailure(new Error('connect failed'), {
      grpcStatus: 14,
      grpcDetails: 'failed to connect to all addresses',
    });
    expect(result.message).toMatch(/failed to connect to all addresses/);
  });

  it('extracts grpcStatus from error object when options omit it', () => {
    const result = classifyGrpcTransportFailure({ message: 'RPC failed', grpcStatus: 7 });
    expect(result.details.authFailure).toBe('auth_denied');
  });
});

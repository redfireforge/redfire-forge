/**
 * Coverage gaps — requestValidation.ts (Phase 1A / 11A).
 */
import { describe, expect, it } from 'vitest';
import {
  createGrpcValidationErrorEnvelope,
  firstGrpcValidationErrorCode,
  validateGrpcDescribeRequest,
  validateGrpcExportProtosetRequest,
  validateGrpcReflectRequest,
  validateGrpcTabExecuteSnapshot,
  validatePhase1UnaryCallRequest,
} from './requestValidation';
import {
  FIXTURE_DESCRIBE_REQUEST,
  FIXTURE_REFLECT_REQUEST,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import { GRPC_ERROR_CODES } from './contracts';

describe('requestValidation coverage gaps', () => {
  it('requires target.address on execute requests', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: { address: '   ', tlsMode: 'disabled' },
    });
    expect(issues).toEqual([
      expect.objectContaining({
        field: 'target.address',
        code: GRPC_ERROR_CODES.INVALID_TARGET,
        message: 'target.address is required',
      }),
    ]);
  });

  it('validates tls config issues on execute requests', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: {
        address: 'localhost:50051',
        tlsMode: 'tls',
        tlsConfig: { serverCaPem: 'not-a-pem' },
      },
    });
    expect(issues.some((issue) => issue.field.startsWith('target.tlsConfig'))).toBe(true);
  });

  it('validates tab execute snapshot identity fields', () => {
    const issues = validateGrpcTabExecuteSnapshot({
      tabId: '',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      capturedAt: '',
      callType: 'unary',
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: FIXTURE_UNARY_CALL_REQUEST.body,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      metadata: FIXTURE_UNARY_CALL_REQUEST.metadata,
      timeoutMs: FIXTURE_UNARY_CALL_REQUEST.timeoutMs,
    });
    expect(issues.map((issue) => issue.field).sort()).toEqual(['capturedAt', 'tabId']);
  });

  it('returns early for reflect requests missing target.address', () => {
    const issues = validateGrpcReflectRequest({
      target: { address: '', tlsMode: 'disabled' },
    });
    expect(issues).toEqual([
      expect.objectContaining({
        field: 'target.address',
        code: GRPC_ERROR_CODES.INVALID_TARGET,
        message: 'target.address is required',
      }),
    ]);
    expect(issues.some((issue) => issue.field === 'target.tlsMode')).toBe(false);
  });

  it('accepts valid reflect fixture', () => {
    expect(validateGrpcReflectRequest(FIXTURE_REFLECT_REQUEST)).toEqual([]);
  });

  it('rejects unsupported describe sources before field validation', () => {
    const issues = validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'unknown' as 'proto_files',
    });
    expect(issues).toEqual([
      expect.objectContaining({
        field: 'source',
        message: expect.stringContaining('unsupported describe source'),
      }),
    ]);
    expect(issues.some((issue) => issue.field === 'protoFiles')).toBe(false);
  });

  it('requires bsrModule when describe source is bsr', () => {
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'bsr',
    })).toEqual([
      expect.objectContaining({
        field: 'bsrModule',
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      }),
    ]);
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'bsr',
      bsrModule: 'buf.build/acme/echo',
    })).toEqual([]);
  });

  it('validates proto_files entries from describe requests', () => {
    expect(validateGrpcDescribeRequest(FIXTURE_DESCRIBE_REQUEST)).toEqual([]);
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'proto_files',
      protoFiles: [{ path: 'echo.proto', content: '' }],
    })).toEqual([
      expect.objectContaining({ field: 'protoFiles[0]' }),
    ]);
  });

  it('requires descriptorKey for protoset export requests', () => {
    expect(validateGrpcExportProtosetRequest({ descriptorKey: '' })).toEqual([
      expect.objectContaining({
        field: 'descriptorKey',
        code: GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY,
      }),
    ]);
  });

  it('createGrpcValidationErrorEnvelope returns null when there are no issues', () => {
    expect(createGrpcValidationErrorEnvelope('call', [])).toBeNull();
    expect(firstGrpcValidationErrorCode([])).toBeUndefined();
  });

  it('createGrpcValidationErrorEnvelope maps the first issue into an error envelope', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: '',
    });
    const envelope = createGrpcValidationErrorEnvelope('call', issues, { requestId: 'req-gap' });
    expect(envelope?.ok).toBe(false);
    if (envelope && !envelope.ok) {
      expect(envelope.error.details).toEqual(expect.objectContaining({ field: 'requestId' }));
      expect(envelope.meta.requestId).toBe('req-gap');
    }
  });
});

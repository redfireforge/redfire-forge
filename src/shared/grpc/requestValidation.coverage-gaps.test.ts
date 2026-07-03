/**
 * Coverage gaps — requestValidation.ts (Phase 1A / 11A).
 */
import { describe, expect, it } from 'vitest';
import {
  createGrpcValidationErrorEnvelope,
  firstGrpcValidationErrorCode,
  grpcValidationIssueToHttpStatus,
  validateGrpcDescribeRequest,
  validateGrpcDescriptorLookupRequest,
  validateGrpcExportProtosetRequest,
  validateGrpcReflectRequest,
  validateGrpcStatusAddress,
  validateGrpcStatusRequest,
  validateGrpcStreamSendRequest,
  validateGrpcStreamStartRequest,
  validateGrpcStreamTabId,
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

  it('accepts protoRoots for proto_files describe requests', () => {
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'proto_files',
      protoRoots: [
        {
          id: 'root-shared',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
        },
      ],
    })).toEqual([]);
  });

  it('validates protoRoots structure when source is proto_files', () => {
    const issues = validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'proto_files',
      protoRoots: [
        {
          id: ' ',
          mountPath: ' ',
          files: [{ path: 'bad.proto', content: '' }],
        },
      ],
    });
    expect(issues.map((issue) => issue.field)).toEqual(expect.arrayContaining([
      'protoRoots[0].id',
      'protoRoots[0].mountPath',
      'protoRoots[0].files[0]',
    ]));
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

  it('validateGrpcStreamStartRequest and stream send/tab helpers report field issues', () => {
    expect(validateGrpcStreamStartRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      callType: 'server_streaming',
      requestId: '',
    }).some((issue) => issue.field === 'requestId')).toBe(true);

    expect(validateGrpcStreamSendRequest(null).length).toBeGreaterThan(0);

    expect(validateGrpcStreamTabId('   ').length).toBeGreaterThan(0);
    expect(grpcValidationIssueToHttpStatus(GRPC_ERROR_CODES.INVALID_DESCRIPTOR)).toBe(400);
    expect(grpcValidationIssueToHttpStatus(GRPC_ERROR_CODES.UNREACHABLE)).toBe(503);
  });

  it('validateGrpcStatusAddress returns early for blank address', () => {
    const issues = validateGrpcStatusAddress('   ');
    expect(issues[0]?.field).toBe('address');
  });

  it('validateGrpcDescriptorLookupRequest requires descriptorKey', () => {
    expect(validateGrpcDescriptorLookupRequest({ descriptorKey: '   ' }).length).toBeGreaterThan(0);
  });

  it('grpcValidationIssueToHttpStatus maps cancelled and internal codes', () => {
    expect(grpcValidationIssueToHttpStatus(GRPC_ERROR_CODES.CANCELLED)).toBe(409);
    expect(grpcValidationIssueToHttpStatus('UNKNOWN_CODE')).toBe(500);
  });

  it('validatePhase1UnaryCallRequest rejects non-unary call types', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      callType: 'server_streaming',
    });
    expect(issues.some((issue) => issue.field === 'callType')).toBe(true);
  });

  it('validateGrpcStreamStartRequest rejects unary call type', () => {
    const issues = validateGrpcStreamStartRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      callType: 'unary',
    });
    expect(issues.some((issue) => issue.field === 'callType')).toBe(true);
  });

  it('validateGrpcTabExecuteSnapshot accepts a valid snapshot', () => {
    expect(validateGrpcTabExecuteSnapshot({
      tabId: 'tab-1',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: FIXTURE_UNARY_CALL_REQUEST.body,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      metadata: FIXTURE_UNARY_CALL_REQUEST.metadata,
      timeoutMs: FIXTURE_UNARY_CALL_REQUEST.timeoutMs,
    })).toEqual([]);
  });

  it('rejects invalid tlsMode and non-object body on execute requests', () => {
    const tlsIssues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: { address: 'localhost:50051', tlsMode: 'invalid' as 'disabled' },
    });
    expect(tlsIssues.some((issue) => issue.field === 'target.tlsMode')).toBe(true);

    const bodyIssues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      body: [] as unknown as Record<string, unknown>,
    });
    expect(bodyIssues.some((issue) => issue.field === 'body')).toBe(true);
  });

  it('validates malformed target.address on execute requests', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: { address: 'not-a-valid-host!!!', tlsMode: 'disabled' },
    });
    expect(issues.some((issue) => issue.field === 'target.address')).toBe(true);
  });

  it('validateGrpcReflectRequest validates tls config and invalid address format', () => {
    const tlsIssues = validateGrpcReflectRequest({
      target: {
        address: 'localhost:50051',
        tlsMode: 'tls',
        tlsConfig: { serverCaPem: 'not-a-pem' },
      },
    });
    expect(tlsIssues.some((issue) => issue.field.startsWith('target.tlsConfig'))).toBe(true);

    const badAddress = validateGrpcReflectRequest({
      target: { address: '!!!', tlsMode: 'disabled' },
    });
    expect(badAddress.some((issue) => issue.field === 'target.address')).toBe(true);
  });

  it('validateGrpcDescribeRequest requires protoset and url_proto fields', () => {
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'protoset',
    })).toEqual([
      expect.objectContaining({ field: 'protosetBase64' }),
    ]);
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'url_proto',
    })).toEqual([
      expect.objectContaining({ field: 'url' }),
    ]);
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'protoset',
      protosetBase64: 'abc',
    })).toEqual([]);
  });

  it('validateGrpcStatusRequest and validateGrpcStatusAddress cover timeout and tlsMode', () => {
    expect(validateGrpcStatusRequest({
      address: 'localhost:50051',
      timeoutMs: -1,
      tlsMode: 'bogus' as 'disabled',
    }).map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['timeoutMs', 'tlsMode']),
    );

    const invalidAddress = validateGrpcStatusAddress('not-valid!!!');
    expect(invalidAddress[0]?.field).toBe('address');
  });
});

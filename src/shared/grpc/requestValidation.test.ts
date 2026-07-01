import { describe, expect, it } from 'vitest';
import {
  createGrpcValidationErrorEnvelope,
  grpcValidationIssueToHttpStatus,
  validateGrpcDescribeRequest,
  validateGrpcReflectRequest,
  validateGrpcStatusAddress,
  validateGrpcStatusRequest,
  validateGrpcStreamStartRequest,
  validateGrpcStreamSendRequest,
  validateGrpcStreamTabId,
  validatePhase1UnaryCallRequest,
} from './requestValidation';
import {
  FIXTURE_BIDI_STREAM_START_REQUEST,
  FIXTURE_CLIENT_STREAM_START_REQUEST,
  FIXTURE_DESCRIBE_PROTOSET_REQUEST,
  FIXTURE_DESCRIBE_REQUEST,
  FIXTURE_REFLECT_REQUEST,
  FIXTURE_SERVER_STREAM_START_REQUEST,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import { GRPC_ERROR_CODES } from './contracts';

describe('requestValidation (Phase 1A)', () => {
  it('accepts a valid unary call request fixture', () => {
    expect(validatePhase1UnaryCallRequest(FIXTURE_UNARY_CALL_REQUEST)).toEqual([]);
  });

  it('rejects invalid metadata on unary call request', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      metadata: { 'payload-bin': '!!!' },
    });
    expect(issues).toEqual([
      expect.objectContaining({
        field: 'metadata',
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
      }),
    ]);
  });

  it('rejects streaming call types in Phase 1', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      callType: 'server_streaming',
    });
    expect(issues.some((issue) => issue.field === 'callType')).toBe(true);
  });

  it('accepts valid stream start request fixture (Phase 2A)', () => {
    expect(validateGrpcStreamStartRequest(FIXTURE_SERVER_STREAM_START_REQUEST)).toEqual([]);
    expect(validateGrpcStreamStartRequest(FIXTURE_CLIENT_STREAM_START_REQUEST)).toEqual([]);
    expect(validateGrpcStreamStartRequest(FIXTURE_BIDI_STREAM_START_REQUEST)).toEqual([]);
  });

  it('rejects unary callType on stream start validation', () => {
    const issues = validateGrpcStreamStartRequest({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      callType: 'unary',
    } as unknown as typeof FIXTURE_SERVER_STREAM_START_REQUEST);
    expect(issues.some((issue) => issue.field === 'callType')).toBe(true);
  });

  it('requires descriptorKey, service, and method', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      descriptorKey: '',
      service: '',
      method: '',
    });
    expect(issues.map((issue) => issue.field).sort()).toEqual([
      'descriptorKey',
      'method',
      'service',
    ]);
    expect(issues.find((issue) => issue.field === 'descriptorKey')?.code).toBe(
      GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY,
    );
  });

  it('rejects unresolved env tokens in call target address', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: { address: '{{grpcHost}}', tlsMode: 'disabled' },
    });
    expect(issues).toEqual([
      expect.objectContaining({
        field: 'target.address',
        code: GRPC_ERROR_CODES.INVALID_TARGET,
      }),
    ]);
  });

  it('returns canonical invalid-target message for malformed addresses', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: { address: 'bad', tlsMode: 'disabled' },
    });
    expect(issues).toEqual([
      expect.objectContaining({
        field: 'target.address',
        code: GRPC_ERROR_CODES.INVALID_TARGET,
        message: expect.stringContaining('Target must be host:port or in-process:<name>'),
      }),
    ]);
  });

  it('validates reflect requests', () => {
    expect(validateGrpcReflectRequest(FIXTURE_REFLECT_REQUEST)).toEqual([]);
    expect(validateGrpcReflectRequest({
      target: { address: '{{grpcHost}}', tlsMode: 'disabled' },
    })).toEqual([
      expect.objectContaining({ field: 'target.address', code: GRPC_ERROR_CODES.INVALID_TARGET }),
    ]);

    expect(validateGrpcReflectRequest({
      target: { address: 'localhost:50051', tlsMode: 'bogus' as 'disabled' },
    })).toEqual([
      expect.objectContaining({ field: 'target.tlsMode', code: GRPC_ERROR_CODES.INVALID_REQUEST }),
    ]);
  });

  it('validates describe requests for proto_files and protoset sources', () => {
    expect(validateGrpcDescribeRequest(FIXTURE_DESCRIBE_REQUEST)).toEqual([]);
    expect(validateGrpcDescribeRequest(FIXTURE_DESCRIBE_PROTOSET_REQUEST)).toEqual([]);
    expect(validateGrpcDescribeRequest({ requestId: 'x', source: 'proto_files' })).toEqual([
      expect.objectContaining({ field: 'protoFiles', code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR }),
    ]);
    expect(validateGrpcDescribeRequest({ requestId: 'x', source: 'protoset' })).toEqual([
      expect.objectContaining({
        field: 'protosetBase64',
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      }),
    ]);
  });

  it('requires bsrModule and url fields for bsr and url_proto describe sources', () => {
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
      source: 'url_proto',
    })).toEqual([
      expect.objectContaining({
        field: 'url',
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      }),
    ]);
  });

  it('accepts bsr and url_proto describe requests with required fields', () => {
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'bsr',
      bsrModule: 'buf.build/acme/echo',
    })).toEqual([]);
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'url_proto',
      url: 'https://example.com/echo.proto',
    })).toEqual([]);
  });

  it('validates status address query param', () => {
    expect(validateGrpcStatusAddress('localhost:50051')).toEqual([]);
    expect(validateGrpcStatusAddress('in-process:spring-grpc')).toEqual([]);
    expect(validateGrpcStatusAddress('')).toEqual([
      expect.objectContaining({ field: 'address', code: GRPC_ERROR_CODES.INVALID_TARGET }),
    ]);
    expect(validateGrpcStatusAddress('{{grpcHost}}')).toEqual([
      expect.objectContaining({ field: 'address', code: GRPC_ERROR_CODES.INVALID_TARGET }),
    ]);
  });

  it('validates status request timeout and tlsMode', () => {
    expect(validateGrpcStatusRequest({
      address: 'localhost:50051',
      tlsMode: 'disabled',
      timeoutMs: 5000,
    })).toEqual([]);

    expect(validateGrpcStatusRequest({
      address: 'localhost:50051',
      tlsMode: 'bogus' as 'disabled',
      timeoutMs: -1,
    }).map((issue) => issue.field).sort()).toEqual(['timeoutMs', 'tlsMode']);
  });

  it('rejects invalid describe source and tlsMode on call target', () => {
    expect(validateGrpcDescribeRequest({
      requestId: 'x',
      source: 'bsr' as 'proto_files',
    })).toEqual([
      expect.objectContaining({ field: 'bsrModule', code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR }),
    ]);

    expect(validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: { address: 'localhost:50051', tlsMode: 'bogus' as 'disabled' },
    })).toEqual([
      expect.objectContaining({ field: 'target.tlsMode', code: GRPC_ERROR_CODES.INVALID_REQUEST }),
    ]);
  });

  it('rejects invalid call body and proto file entries', () => {
    expect(
      validatePhase1UnaryCallRequest({
        ...FIXTURE_UNARY_CALL_REQUEST,
        body: null as unknown as Record<string, unknown>,
      }).some((issue) => issue.field === 'body'),
    ).toBe(true);

    expect(
      validateGrpcDescribeRequest({
        requestId: 'x',
        source: 'proto_files',
        protoFiles: [{ path: '', content: '' }],
      }),
    ).toEqual([
      expect.objectContaining({ field: 'protoFiles[0]', code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR }),
    ]);
  });

  it('builds validation error envelopes for Phase 1B routes', () => {
    const issues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: '',
    });
    const envelope = createGrpcValidationErrorEnvelope('call', issues, { requestId: 'req-1' });

    expect(envelope?.ok).toBe(false);
    if (envelope && !envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      expect(envelope.meta.requestId).toBe('req-1');
      expect(grpcValidationIssueToHttpStatus(envelope.error.code)).toBe(400);
    }
  });

  it('requires tabId for stream routes', () => {
    expect(validateGrpcStreamTabId(undefined)).toEqual([
      expect.objectContaining({ field: 'tabId' }),
    ]);
    expect(validateGrpcStreamTabId('tab-1')).toEqual([]);
  });

  it('requires object body for stream send', () => {
    expect(validateGrpcStreamSendRequest({ message: 'hi' })).toEqual([]);
    expect(validateGrpcStreamSendRequest([])).toEqual([
      expect.objectContaining({ field: 'body' }),
    ]);
  });

  it('validates tls config and auth contracts on execute requests (Phase 4A)', () => {
    const validCert = `-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----`;
    const validKey = `-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----`;

    expect(validatePhase1UnaryCallRequest({
      callType: 'unary',
      requestId: 'req-1',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      target: {
        address: 'localhost:50051',
        tlsMode: 'mtls',
        tlsConfig: { serverCaPem: validCert },
      },
    }).map((issue) => issue.field)).toEqual([
      'target.tlsConfig.clientCertPem',
      'target.tlsConfig.clientKeyPem',
    ]);

    expect(validatePhase1UnaryCallRequest({
      callType: 'unary',
      requestId: 'req-2',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      auth: { type: 'bearer' },
    })).toEqual([
      expect.objectContaining({ field: 'auth.bearerToken' }),
    ]);

    expect(validatePhase1UnaryCallRequest({
      callType: 'unary',
      requestId: 'req-3',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      target: {
        address: 'localhost:50051',
        tlsMode: 'tls',
        tlsConfig: { serverCaPem: validCert, clientCertPem: validCert, clientKeyPem: validKey },
      },
      auth: { type: 'basic', basicUsername: 'alice', basicPassword: 'secret' },
    })).toEqual([]);

    expect(validatePhase1UnaryCallRequest({
      callType: 'unary',
      requestId: 'req-oauth',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    })).toEqual([]);

    expect(validatePhase1UnaryCallRequest({
      callType: 'unary',
      requestId: 'req-disabled-ca',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      target: {
        address: 'localhost:50051',
        tlsMode: 'disabled',
        tlsConfig: { serverCaPem: validCert },
      },
    }).map((issue) => issue.field)).toEqual(['target.tlsConfig']);
  });
});

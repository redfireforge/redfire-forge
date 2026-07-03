/**
 * Phase 1A — representative contract fixtures for tests and documentation parity.
 */
import {
  createGrpcErrorEnvelope,
  createGrpcSuccessEnvelope,
  GRPC_ERROR_CODES,
  type GrpcCallRequest,
  type GrpcCallResult,
  type GrpcDescribeRequest,
  type GrpcDescriptor,
  type GrpcReflectRequest,
  type GrpcStatusResult,
  type GrpcStreamEvent,
  type GrpcStreamStartRequest,
} from './contracts';
import {
  createGrpcValidationErrorEnvelope,
  validateGrpcStreamStartRequest,
  validatePhase1UnaryCallRequest,
} from './requestValidation';

export const FIXTURE_TARGET = {
  address: 'localhost:50051',
  tlsMode: 'disabled' as const,
};

export const FIXTURE_ECHO_PROTO = `syntax = "proto3";

package echo;

message EchoRequest {
  string message = 1;
}

message EchoResponse {
  string message = 1;
}

message StreamRequest {
  string message = 1;
  int32 repeat_count = 2;
  int32 interval_ms = 3;
}

service EchoService {
  rpc Echo(EchoRequest) returns (EchoResponse);
  rpc ServerStream(StreamRequest) returns (stream EchoResponse);
  rpc ClientStream(stream EchoRequest) returns (EchoResponse);
  rpc BidiStream(stream EchoRequest) returns (stream EchoResponse);
}
`;

const ECHO_REQUEST_SCHEMA = {
  typeName: 'echo.EchoRequest',
  fields: [{ name: 'message', number: 1, type: 'string' as const, label: 'optional' as const }],
};

const ECHO_RESPONSE_SCHEMA = {
  typeName: 'echo.EchoResponse',
  fields: [{ name: 'message', number: 1, type: 'string' as const, label: 'optional' as const }],
};

const STREAM_REQUEST_SCHEMA = {
  typeName: 'echo.StreamRequest',
  fields: [
    { name: 'message', number: 1, type: 'string' as const, label: 'optional' as const },
    { name: 'repeat_count', number: 2, type: 'int32' as const, label: 'optional' as const },
    { name: 'interval_ms', number: 3, type: 'int32' as const, label: 'optional' as const },
  ],
};

const FIXTURE_ECHO_METHODS = [
  {
    name: 'BidiStream',
    callType: 'bidi_streaming' as const,
    requestTypeName: 'echo.EchoRequest',
    responseTypeName: 'echo.EchoResponse',
    requestSchema: ECHO_REQUEST_SCHEMA,
    responseSchema: ECHO_RESPONSE_SCHEMA,
  },
  {
    name: 'ClientStream',
    callType: 'client_streaming' as const,
    requestTypeName: 'echo.EchoRequest',
    responseTypeName: 'echo.EchoResponse',
    requestSchema: ECHO_REQUEST_SCHEMA,
    responseSchema: ECHO_RESPONSE_SCHEMA,
  },
  {
    name: 'Echo',
    callType: 'unary' as const,
    requestTypeName: 'echo.EchoRequest',
    responseTypeName: 'echo.EchoResponse',
    requestSchema: ECHO_REQUEST_SCHEMA,
    responseSchema: ECHO_RESPONSE_SCHEMA,
  },
  {
    name: 'ServerStream',
    callType: 'server_streaming' as const,
    requestTypeName: 'echo.StreamRequest',
    responseTypeName: 'echo.EchoResponse',
    requestSchema: STREAM_REQUEST_SCHEMA,
    responseSchema: ECHO_RESPONSE_SCHEMA,
  },
];

/** Content hash from `computeDescriptorContentHash` over fixture services (keep in sync). */
export const FIXTURE_DESCRIPTOR_CONTENT_SHA = 'a2ae667362c63e35';
/** Full SHA-256 hex of echo protoset bytes — use for native Tauri descriptor payload tests. */
export const FIXTURE_TAURI_PROTOSET_CONTENT_SHA256 =
  'ad9f5cd347baa8428b69b0313edd2da0384d2eb571aa7b29fc3e48a90d168bae';
export const FIXTURE_DESCRIPTOR_KEY = `reflection:localhost:50051:${FIXTURE_DESCRIPTOR_CONTENT_SHA}`;

export const FIXTURE_DESCRIPTOR_SOURCE_FINGERPRINT = {
  source: 'reflection' as const,
  sourceRef: 'localhost:50051',
  contentSha256: FIXTURE_DESCRIPTOR_CONTENT_SHA,
  reflectionVersion: 'v1' as const,
  resolvedAt: '2026-06-29T00:00:00.000Z',
};

export const FIXTURE_DESCRIPTOR: GrpcDescriptor = {
  source: 'reflection',
  key: FIXTURE_DESCRIPTOR_KEY,
  sourceRef: 'localhost:50051',
  contentSha256: FIXTURE_DESCRIPTOR_CONTENT_SHA,
  reflectionVersion: 'v1',
  sourceFingerprint: FIXTURE_DESCRIPTOR_SOURCE_FINGERPRINT,
  services: [
    {
      fullName: 'echo.EchoService',
      methods: FIXTURE_ECHO_METHODS,
    },
  ],
};

export const FIXTURE_MULTI_SERVICE_DESCRIPTOR_CONTENT_SHA = 'c046909ca2ff5f56';
export const FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY = `reflection:localhost:50051:${FIXTURE_MULTI_SERVICE_DESCRIPTOR_CONTENT_SHA}`;

export const FIXTURE_MULTI_SERVICE_DESCRIPTOR: GrpcDescriptor = {
  source: 'reflection',
  key: FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
  sourceRef: 'localhost:50051',
  contentSha256: FIXTURE_MULTI_SERVICE_DESCRIPTOR_CONTENT_SHA,
  reflectionVersion: 'v1',
  sourceFingerprint: {
    source: 'reflection',
    sourceRef: 'localhost:50051',
    contentSha256: FIXTURE_MULTI_SERVICE_DESCRIPTOR_CONTENT_SHA,
    reflectionVersion: 'v1',
    resolvedAt: '2026-06-29T00:00:00.000Z',
  },
  services: [
    FIXTURE_DESCRIPTOR.services[0]!,
    {
      fullName: 'health.v1.Health',
      methods: [
        {
          name: 'Check',
          callType: 'unary',
          requestTypeName: 'health.v1.HealthCheckRequest',
          responseTypeName: 'health.v1.HealthCheckResponse',
          requestSchema: {
            typeName: 'health.v1.HealthCheckRequest',
            fields: [{ name: 'service', number: 1, type: 'string', label: 'optional' }],
          },
          responseSchema: {
            typeName: 'health.v1.HealthCheckResponse',
            fields: [{ name: 'status', number: 1, type: 'enum', label: 'optional', enumValues: [{ name: 'UNKNOWN', number: 0 }, { name: 'SERVING', number: 1 }] }],
          },
        },
        {
          name: 'Watch',
          callType: 'server_streaming',
          requestTypeName: 'health.v1.HealthCheckRequest',
          responseTypeName: 'health.v1.HealthCheckResponse',
          requestSchema: {
            typeName: 'health.v1.HealthCheckRequest',
            fields: [{ name: 'service', number: 1, type: 'string', label: 'optional' }],
          },
          responseSchema: {
            typeName: 'health.v1.HealthCheckResponse',
            fields: [{ name: 'status', number: 1, type: 'enum', label: 'optional', enumValues: [{ name: 'UNKNOWN', number: 0 }, { name: 'SERVING', number: 1 }] }],
          },
        },
      ],
    },
  ],
};

export const FIXTURE_UNARY_CALL_REQUEST: GrpcCallRequest = {
  callType: 'unary',
  requestId: 'req-unary-happy-001',
  target: FIXTURE_TARGET,
  service: 'echo.EchoService',
  method: 'Echo',
  body: { message: 'hello grpc' },
  metadata: { 'x-request-id': 'demo-1' },
  timeoutMs: 30_000,
  descriptorKey: FIXTURE_DESCRIPTOR_KEY,
};

export const FIXTURE_SERVER_STREAM_START_REQUEST: GrpcStreamStartRequest = {
  callType: 'server_streaming',
  requestId: 'req-stream-ss-001',
  target: FIXTURE_TARGET,
  service: 'echo.EchoService',
  method: 'ServerStream',
  body: { message: 'ping', repeat_count: 3, interval_ms: 0 },
  timeoutMs: 30_000,
  descriptorKey: FIXTURE_DESCRIPTOR_KEY,
};

export const FIXTURE_CLIENT_STREAM_START_REQUEST: GrpcStreamStartRequest = {
  callType: 'client_streaming',
  requestId: 'req-stream-cs-001',
  target: FIXTURE_TARGET,
  service: 'echo.EchoService',
  method: 'ClientStream',
  body: { message: '' },
  timeoutMs: 30_000,
  descriptorKey: FIXTURE_DESCRIPTOR_KEY,
};

export const FIXTURE_BIDI_STREAM_START_REQUEST: GrpcStreamStartRequest = {
  callType: 'bidi_streaming',
  requestId: 'req-stream-bd-001',
  target: FIXTURE_TARGET,
  service: 'echo.EchoService',
  method: 'BidiStream',
  body: { message: '' },
  timeoutMs: 30_000,
  descriptorKey: FIXTURE_DESCRIPTOR_KEY,
};

export const FIXTURE_STREAM_START_RESPONSE = {
  streamId: 'stream-ss-001',
  requestId: 'req-stream-ss-001',
  tabId: 'tab-1',
};

export const FIXTURE_STREAM_MESSAGE_EVENT: GrpcStreamEvent = {
  type: 'grpc-message',
  streamId: FIXTURE_STREAM_START_RESPONSE.streamId,
  requestId: FIXTURE_STREAM_START_RESPONSE.requestId,
  tabId: FIXTURE_STREAM_START_RESPONSE.tabId,
  sequence: 1,
  timestamp: '2026-06-29T00:00:00.000Z',
  direction: 'inbound',
  data: { message: 'ping [1/3]' },
};

export const FIXTURE_STREAM_END_EVENT: GrpcStreamEvent = {
  type: 'grpc-end',
  streamId: FIXTURE_STREAM_START_RESPONSE.streamId,
  requestId: FIXTURE_STREAM_START_RESPONSE.requestId,
  tabId: FIXTURE_STREAM_START_RESPONSE.tabId,
  sequence: 4,
  timestamp: '2026-06-29T00:00:01.000Z',
  status: 0,
  statusMessage: 'OK',
  headers: { 'content-type': 'application/grpc' },
  trailers: { 'grpc-status': '0' },
  /** Client-streaming terminal aggregate (Phase 2 plan: body on grpc-end). */
  data: { message: 'one,two,three' },
};

export const FIXTURE_UNARY_CALL_RESULT: GrpcCallResult = {
  callType: 'unary',
  status: 0,
  statusMessage: 'OK',
  headers: { 'content-type': 'application/grpc' },
  trailers: { 'grpc-status': '0' },
  body: { message: 'hello grpc' },
  durationMs: 87,
  timingBreakdown: {
    dnsLookupMs: 2,
    tcpConnectTlsMs: 11,
    http2HandshakeMs: 6,
    protoSerializationMs: 1,
    serverProcessingMs: 61,
    responseDeserializationMs: 1,
  },
};

export const FIXTURE_REFLECT_REQUEST: GrpcReflectRequest = {
  requestId: 'req-reflect-001',
  target: FIXTURE_TARGET,
  timeoutMs: 5_000,
};

export const FIXTURE_DESCRIBE_REQUEST: GrpcDescribeRequest = {
  requestId: 'req-describe-001',
  source: 'proto_files',
  protoRoots: [
    {
      id: 'root-default',
      mountPath: 'root',
      files: [
        {
          path: 'echo.proto',
          content: FIXTURE_ECHO_PROTO,
        },
      ],
    },
  ],
};

export const FIXTURE_STATUS_REACHABLE: GrpcStatusResult = {
  reachable: true,
  address: FIXTURE_TARGET.address,
  tlsMode: 'disabled',
  latencyMs: 4,
  reflectionSupported: true,
};

export const FIXTURE_STATUS_UNREACHABLE: GrpcStatusResult = {
  reachable: false,
  address: '127.0.0.1:59999',
  tlsMode: 'disabled',
  errorMessage: 'connect ECONNREFUSED',
};

export const FIXTURE_STREAM_START_SUCCESS_ENVELOPE = createGrpcSuccessEnvelope(
  'stream_start',
  FIXTURE_STREAM_START_RESPONSE,
  { requestId: FIXTURE_SERVER_STREAM_START_REQUEST.requestId },
);

export const FIXTURE_STREAM_VALIDATION_ERROR_ENVELOPE = createGrpcValidationErrorEnvelope(
  'stream_start',
  validateGrpcStreamStartRequest({
    ...FIXTURE_SERVER_STREAM_START_REQUEST,
    callType: 'unary' as unknown as GrpcStreamStartRequest['callType'],
  }),
)!;

export const FIXTURE_HAPPY_CALL_ENVELOPE = createGrpcSuccessEnvelope(
  'call',
  FIXTURE_UNARY_CALL_RESULT,
  { requestId: FIXTURE_UNARY_CALL_REQUEST.requestId, durationMs: 12 },
);

/** Derived from live validation so fixture messages stay aligned with route handlers. */
export const FIXTURE_VALIDATION_ERROR_ENVELOPE = createGrpcValidationErrorEnvelope(
  'call',
  validatePhase1UnaryCallRequest({
    ...FIXTURE_UNARY_CALL_REQUEST,
    target: { address: 'bad', tlsMode: 'disabled' },
  }),
)!;

export const FIXTURE_UNREACHABLE_ERROR_ENVELOPE = createGrpcErrorEnvelope('reflect', {
  code: GRPC_ERROR_CODES.UNREACHABLE,
  message: 'Could not reach localhost:59999',
  retryable: true,
});

export const FIXTURE_REFLECTION_FAILED_ENVELOPE = createGrpcErrorEnvelope('reflect', {
  code: GRPC_ERROR_CODES.REFLECTION_FAILED,
  message: 'Server reflection is not enabled on this target',
});

export const FIXTURE_CANCELLED_ENVELOPE = createGrpcErrorEnvelope('call', {
  code: GRPC_ERROR_CODES.CANCELLED,
  message: 'Unary call was cancelled by the client',
});

export const FIXTURE_DESCRIBE_FAILED_ENVELOPE = createGrpcErrorEnvelope('describe', {
  code: GRPC_ERROR_CODES.DESCRIBE_FAILED,
  message: 'Failed to parse proto_files source',
});

export const FIXTURE_CALL_FAILED_ENVELOPE = createGrpcErrorEnvelope('call', {
  code: GRPC_ERROR_CODES.CALL_FAILED,
  message: 'RPC failed with status NOT_FOUND',
});

export const FIXTURE_REQUEST_NOT_FOUND_ENVELOPE = createGrpcErrorEnvelope('cancel', {
  code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
  message: 'No in-flight call registered for requestId',
});

export const FIXTURE_CANCEL_SUCCESS_ENVELOPE = createGrpcSuccessEnvelope(
  'cancel',
  { requestId: 'req-unary-happy-001', cancelled: true },
  { requestId: 'req-unary-happy-001' },
);

export const FIXTURE_REFLECT_SUCCESS_ENVELOPE = createGrpcSuccessEnvelope(
  'reflect',
  FIXTURE_DESCRIPTOR,
  { requestId: 'req-reflect-001', durationMs: 8 },
);

export const FIXTURE_DESCRIBE_SUCCESS_ENVELOPE = createGrpcSuccessEnvelope(
  'describe',
  FIXTURE_DESCRIPTOR,
  { requestId: 'req-describe-001', durationMs: 6 },
);

export const FIXTURE_STATUS_SUCCESS_ENVELOPE = createGrpcSuccessEnvelope(
  'status',
  FIXTURE_STATUS_REACHABLE,
  { durationMs: 4 },
);

export const FIXTURE_STATUS_UNREACHABLE_ENVELOPE = createGrpcSuccessEnvelope(
  'status',
  FIXTURE_STATUS_UNREACHABLE,
  { durationMs: 3 },
);

export const FIXTURE_DESCRIBE_PROTOSET_REQUEST: GrpcDescribeRequest = {
  requestId: 'req-describe-protoset-001',
  source: 'protoset',
  protosetBase64: 'ChIKB2VjaG8ucHJvbxAB',
};

/** Phase 7G — echo protoset for native codec/integration tests (matches Rust `test_echo_protoset.rs`). */
export const FIXTURE_ECHO_DESCRIPTOR_PAYLOAD = {
  descriptorKey: 'test:echo',
  protosetBase64: 'CsYDCgplY2hvLnByb3RvEgRlY2hvIh4KC0VjaG9SZXF1ZXN0Eg8KB21lc3NhZ2UYASABKAkiHwoMRWNob1Jlc3BvbnNlEg8KB21lc3NhZ2UYASABKAkiZAoNU3RyZWFtUmVxdWVzdBIPCgdtZXNzYWdlGAEgASgJEiEKDHJlcGVhdF9jb3VudBgCIAEoBVILcmVwZWF0Q291bnQSHwoLaW50ZXJ2YWxfbXMYAyABKAVSCmludGVydmFsTXMy6QEKC0VjaG9TZXJ2aWNlEi0KBEVjaG8SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2USOQoMU2VydmVyU3RyZWFtEhMuZWNoby5TdHJlYW1SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UwARI3CgxDbGllbnRTdHJlYW0SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UoARI3CgpCaWRpU3RyZWFtEhEuZWNoby5FY2hvUmVxdWVzdBoSLmVjaG8uRWNob1Jlc3BvbnNlKAEwAUIXWhVncnBjLXRlc3Qtc2VydmVyL2VjaG9iBnByb3RvMw==',
  contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
} as const;

/** Phase 7G — minimal protoset for nested/repeated/oneof codec acceptance (matches Rust fixture). */
export const FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD = {
  descriptorKey: 'test:codec-acceptance',
  protosetBase64: 'CpQDCgtjb2RlYy5wcm90bxIFY29kZWMiKwoJVGltZXN0YW1wEg8KB3NlY29uZHMYASABKAMSDQoFbmFub3MYAiABKAUiKgoKTmVzdGVkSXRlbRINCgVsYWJlbBgBIAEoCRINCgVjb3VudBgCIAEoBSKfAQoOQ29tcGxleFJlcXVlc3QSDAoEbmFtZRgBIAEoCRIMCgR0YWdzGAIgAygJEhoKBm5lc3RlZBgDIAEoCzIKTmVzdGVkSXRlbRIOCgR0ZXh0GAQgASgJSAASEAoGbnVtYmVyGAUgASgFSAASKAoKY3JlYXRlZF9hdBgGIAEoCzIJVGltZXN0YW1wUgljcmVhdGVkQXRCCQoHcGF5bG9hZCIvCg9Db21wbGV4UmVzcG9uc2USHAoEZWNobxgBIAEoCzIOQ29tcGxleFJlcXVlc3QySgoMQ29kZWNTZXJ2aWNlEjoKCVJvdW5kVHJpcBIVLmNvZGVjLkNvbXBsZXhSZXF1ZXN0GhYuY29kZWMuQ29tcGxleFJlc3BvbnNlYgZwcm90bzM=',
  contentSha256: '348cbe699419127297d2d9a5cd3392dd159f31c104f18c6103c4e35537a5f8fc',
} as const;

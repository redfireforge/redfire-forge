/**
 * grpcTauriContracts.test.ts — Phase 7A
 *
 * Verifies schema version constants, error code values, required fields
 * on all contract types, and the event channel helper.
 *
 * These are structural type-level tests: they ensure the frozen contract
 * values are correct and that TypeScript accepts the expected shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  GRPC_TAURI_SCHEMA_VERSION,
  GRPC_TAURI_ERROR_CODES,
  GRPC_TAURI_EVENT_REORDER_BUFFER,
  GRPC_TAURI_EVENT_CHANNEL_PREFIX,
  grpcTauriEventChannel,
  validateGrpcTauriSchemaVersion,
  type GrpcTauriDescriptorPayload,
  type GrpcTauriTarget,
  type GrpcTauriAuthConfig,
  type GrpcTauriUnaryRequest,
  type GrpcTauriCallCancelRequest,
  type GrpcTauriStreamStartRequest,
  type GrpcTauriStreamSendRequest,
  type GrpcTauriStreamEndRequest,
  type GrpcTauriStreamCancelRequest,
  type GrpcTauriTabCleanupRequest,
  type GrpcTauriEnvelopeMeta,
  type GrpcTauriErrorBody,
  type GrpcTauriSuccessEnvelope,
  type GrpcTauriErrorEnvelope,
  type GrpcTauriUnaryResult,
  type GrpcTauriStreamStartResult,
  type GrpcTauriEvent,
  type GrpcTauriCancelResult,
  type GrpcTauriStreamControlResult,
  type GrpcTauriTabCleanupResult,
} from './grpcTauriContracts';

// ─── Schema version ───────────────────────────────────────────────────────────

describe('GRPC_TAURI_SCHEMA_VERSION', () => {
  it('is numeric literal 1', () => {
    expect(GRPC_TAURI_SCHEMA_VERSION).toBe(1);
    expect(typeof GRPC_TAURI_SCHEMA_VERSION).toBe('number');
  });

  it('validateGrpcTauriSchemaVersion accepts only the frozen version', () => {
    expect(validateGrpcTauriSchemaVersion(1)).toBe(true);
    expect(validateGrpcTauriSchemaVersion(0)).toBe(false);
    expect(validateGrpcTauriSchemaVersion(2)).toBe(false);
  });
});

// ─── Error codes ──────────────────────────────────────────────────────────────

describe('GRPC_TAURI_ERROR_CODES', () => {
  it('SCHEMA_MISMATCH matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.SCHEMA_MISMATCH).toBe('GRPC_TAURI_SCHEMA_MISMATCH');
  });

  it('DESCRIPTOR_INTEGRITY matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.DESCRIPTOR_INTEGRITY).toBe('GRPC_TAURI_DESCRIPTOR_INTEGRITY');
  });

  it('CHANNEL_BUILD matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.CHANNEL_BUILD).toBe('GRPC_TAURI_CHANNEL_BUILD');
  });

  it('CALL_FAILED matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.CALL_FAILED).toBe('GRPC_TAURI_CALL_FAILED');
  });

  it('CANCELLED matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.CANCELLED).toBe('GRPC_TAURI_CANCELLED');
  });

  it('REQUEST_NOT_FOUND matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.REQUEST_NOT_FOUND).toBe('GRPC_TAURI_REQUEST_NOT_FOUND');
  });

  it('INVALID_REQUEST matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.INVALID_REQUEST).toBe('GRPC_TAURI_INVALID_REQUEST');
  });

  it('STREAM_NOT_FOUND matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.STREAM_NOT_FOUND).toBe('GRPC_TAURI_STREAM_NOT_FOUND');
  });

  it('STREAM_OWNERSHIP matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.STREAM_OWNERSHIP).toBe('GRPC_TAURI_STREAM_OWNERSHIP');
  });

  it('TAB_CLEANUP matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.TAB_CLEANUP).toBe('GRPC_TAURI_TAB_CLEANUP');
  });

  it('INTERNAL matches expected string', () => {
    expect(GRPC_TAURI_ERROR_CODES.INTERNAL).toBe('GRPC_TAURI_INTERNAL');
  });

  it('all values start with GRPC_TAURI_ prefix', () => {
    for (const value of Object.values(GRPC_TAURI_ERROR_CODES)) {
      expect(value).toMatch(/^GRPC_TAURI_/);
    }
  });

  it('defines exactly eleven structured error codes', () => {
    expect(Object.keys(GRPC_TAURI_ERROR_CODES)).toHaveLength(11);
  });
});

// ─── Event channel ────────────────────────────────────────────────────────────

describe('grpcTauriEventChannel', () => {
  it('returns grpc-event-{tabId}', () => {
    expect(grpcTauriEventChannel('tab-001')).toBe('grpc-event-tab-001');
  });

  it('uses the exported prefix constant', () => {
    const tabId = 'tab-abc';
    expect(grpcTauriEventChannel(tabId)).toBe(`${GRPC_TAURI_EVENT_CHANNEL_PREFIX}${tabId}`);
  });

  it('handles uuid-style tab ids', () => {
    const tabId = '550e8400-e29b-41d4-a716-446655440000';
    const channel = grpcTauriEventChannel(tabId);
    expect(channel).toBe(`grpc-event-${tabId}`);
    expect(channel.startsWith('grpc-event-')).toBe(true);
  });
});

describe('GRPC_TAURI_EVENT_REORDER_BUFFER', () => {
  it('is 16', () => {
    expect(GRPC_TAURI_EVENT_REORDER_BUFFER).toBe(16);
    expect(typeof GRPC_TAURI_EVENT_REORDER_BUFFER).toBe('number');
  });
});

// ─── Type structural guards ───────────────────────────────────────────────────
// TypeScript type checks: if these compile, the required fields exist on the types.

describe('GrpcTauriDescriptorPayload required fields', () => {
  it('accepts a valid descriptor payload', () => {
    const payload: GrpcTauriDescriptorPayload = {
      descriptorKey: 'greeter-v1',
      protosetBase64: 'AAECBA==',
      contentSha256: 'abc123def456',
    };
    expect(payload.descriptorKey).toBe('greeter-v1');
    expect(payload.contentSha256).toBe('abc123def456');
    expect(payload.protosetBase64).toBe('AAECBA==');
  });
});

describe('GrpcTauriTarget required fields', () => {
  it('accepts a minimal target with disabled TLS', () => {
    const target: GrpcTauriTarget = {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    };
    expect(target.address).toBe('localhost:50051');
    expect(target.tlsMode).toBe('disabled');
    expect(target.tlsConfig).toBeUndefined();
  });

  it('accepts all TLS modes', () => {
    const modes: GrpcTauriTarget['tlsMode'][] = ['disabled', 'tls', 'mtls'];
    for (const tlsMode of modes) {
      const target: GrpcTauriTarget = { address: 'svc:443', tlsMode };
      expect(target.tlsMode).toBe(tlsMode);
    }
  });
});

describe('GrpcTauriAuthConfig required fields', () => {
  it('accepts none auth', () => {
    const auth: GrpcTauriAuthConfig = { type: 'none' };
    expect(auth.type).toBe('none');
  });

  it('accepts bearer auth', () => {
    const auth: GrpcTauriAuthConfig = { type: 'bearer', bearerToken: 'tok' };
    expect(auth.bearerToken).toBe('tok');
  });

  it('accepts basic auth', () => {
    const auth: GrpcTauriAuthConfig = {
      type: 'basic',
      basicUsername: 'user',
      basicPassword: 'pass',
    };
    expect(auth.basicUsername).toBe('user');
    expect(auth.basicPassword).toBe('pass');
  });

  it('accepts api_key auth', () => {
    const auth: GrpcTauriAuthConfig = {
      type: 'api_key',
      apiKeyName: 'X-Api-Key',
      apiKeyValue: 'secret',
    };
    expect(auth.type).toBe('api_key');
    expect(auth.apiKeyName).toBe('X-Api-Key');
    expect(auth.apiKeyValue).toBe('secret');
  });

  it('accepts oauth2 auth', () => {
    const auth: GrpcTauriAuthConfig = {
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'my-client',
        clientSecret: 'my-secret',
      },
    };
    expect(auth.type).toBe('oauth2');
    expect(auth.oauth2?.tokenUrl).toBe('https://auth.example.com/token');
  });

  it('accepts all auth type variants', () => {
    const types: GrpcTauriAuthConfig['type'][] = [
      'none',
      'bearer',
      'basic',
      'api_key',
      'oauth2',
    ];
    for (const type of types) {
      const auth: GrpcTauriAuthConfig = { type };
      expect(auth.type).toBe(type);
    }
  });
});

describe('GrpcTauriUnaryRequest required fields', () => {
  it('accepts a minimal valid unary request', () => {
    const req: GrpcTauriUnaryRequest = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      requestId: 'req-001',
      tabId: 'tab-001',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'helloworld.Greeter',
      method: 'SayHello',
      body: { name: 'World' },
      descriptor: {
        descriptorKey: 'greeter-v1',
        protosetBase64: 'AAECBA==',
        contentSha256: 'abc123',
      },
    };
    expect(req.schemaVersion).toBe(1);
    expect(req.requestId).toBe('req-001');
    expect(req.descriptor.contentSha256).toBe('abc123');
  });
});

describe('GrpcTauriCallCancelRequest required fields', () => {
  it('has schemaVersion, requestId, tabId', () => {
    const req: GrpcTauriCallCancelRequest = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      requestId: 'req-002',
      tabId: 'tab-001',
    };
    expect(req.schemaVersion).toBe(1);
    expect(req.requestId).toBe('req-002');
  });
});

describe('GrpcTauriStreamStartRequest required fields', () => {
  it('has callType for all streaming variants', () => {
    const callTypes: GrpcTauriStreamStartRequest['callType'][] = [
      'server_streaming',
      'client_streaming',
      'bidi_streaming',
    ];
    for (const callType of callTypes) {
      const req: GrpcTauriStreamStartRequest = {
        schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
        requestId: 'req-003',
        tabId: 'tab-002',
        callType,
        target: { address: 'svc:443', tlsMode: 'tls' },
        service: 'svc.Streaming',
        method: 'Stream',
        body: {},
        descriptor: {
          descriptorKey: 'svc-v1',
          protosetBase64: 'AAECBA==',
          contentSha256: 'abc123',
        },
      };
      expect(req.callType).toBe(callType);
    }
  });
});

describe('GrpcTauriStreamSendRequest required fields', () => {
  it('has schemaVersion, streamId, tabId, body', () => {
    const req: GrpcTauriStreamSendRequest = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 'stream-abc',
      tabId: 'tab-002',
      body: { message: 'hello' },
    };
    expect(req.streamId).toBe('stream-abc');
  });
});

describe('GrpcTauriStreamEndRequest required fields', () => {
  it('has schemaVersion, streamId, tabId', () => {
    const req: GrpcTauriStreamEndRequest = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 'stream-abc',
      tabId: 'tab-002',
    };
    expect(req.streamId).toBe('stream-abc');
  });
});

describe('GrpcTauriStreamCancelRequest required fields', () => {
  it('has schemaVersion, streamId, tabId', () => {
    const req: GrpcTauriStreamCancelRequest = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 'stream-xyz',
      tabId: 'tab-003',
    };
    expect(req.streamId).toBe('stream-xyz');
  });
});

describe('GrpcTauriTabCleanupRequest required fields', () => {
  it('has schemaVersion and tabId', () => {
    const req: GrpcTauriTabCleanupRequest = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      tabId: 'tab-closing',
    };
    expect(req.tabId).toBe('tab-closing');
  });
});

describe('GrpcTauriEnvelopeMeta required fields', () => {
  it('has timestamp and schemaVersion', () => {
    const meta: GrpcTauriEnvelopeMeta = {
      timestamp: '2026-07-01T00:00:00.000Z',
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    };
    expect(meta.schemaVersion).toBe(1);
  });
});

describe('GrpcTauriErrorBody required fields', () => {
  it('has code and message', () => {
    const err: GrpcTauriErrorBody = {
      code: GRPC_TAURI_ERROR_CODES.SCHEMA_MISMATCH,
      message: 'Version mismatch',
    };
    expect(err.code).toBe('GRPC_TAURI_SCHEMA_MISMATCH');
  });
});

describe('GrpcTauriSuccessEnvelope type guard', () => {
  it('ok is true', () => {
    const envelope: GrpcTauriSuccessEnvelope<{ value: number }> = {
      ok: true,
      op: 'grpc_unary',
      data: { value: 42 },
      meta: { timestamp: '2026-07-01T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.data.value).toBe(42);
  });
});

describe('GrpcTauriErrorEnvelope type guard', () => {
  it('ok is false', () => {
    const envelope: GrpcTauriErrorEnvelope = {
      ok: false,
      op: 'grpc_unary',
      error: { code: GRPC_TAURI_ERROR_CODES.INTERNAL, message: 'unexpected' },
      meta: { timestamp: '2026-07-01T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    };
    expect(envelope.ok).toBe(false);
  });
});

describe('GrpcTauriUnaryResult required fields', () => {
  it('has callType unary + transportUsed tauri + requestId', () => {
    const result: GrpcTauriUnaryResult = {
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 42,
      transportUsed: 'tauri',
      requestId: 'req-001',
    };
    expect(result.callType).toBe('unary');
    expect(result.transportUsed).toBe('tauri');
  });
});

describe('GrpcTauriStreamStartResult required fields', () => {
  it('has streamId, requestId, tabId, transportUsed', () => {
    const result: GrpcTauriStreamStartResult = {
      streamId: 'stream-001',
      requestId: 'req-003',
      tabId: 'tab-002',
      transportUsed: 'tauri',
    };
    expect(result.streamId).toBe('stream-001');
    expect(result.transportUsed).toBe('tauri');
  });
});

describe('GrpcTauriEvent required fields', () => {
  it('has schemaVersion, type, streamId, requestId, tabId, sequence, timestamp', () => {
    const event: GrpcTauriEvent = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      type: 'grpc-message',
      streamId: 'stream-001',
      requestId: 'req-003',
      tabId: 'tab-002',
      sequence: 1,
      timestamp: '2026-07-01T00:00:00.000Z',
    };
    expect(event.schemaVersion).toBe(1);
    expect(event.sequence).toBe(1);
  });

  it('accepts all event type variants', () => {
    const types: GrpcTauriEvent['type'][] = [
      'grpc-message',
      'grpc-end',
      'grpc-error',
      'grpc-heartbeat',
    ];
    for (const type of types) {
      const event: GrpcTauriEvent = {
        schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
        type,
        streamId: 'stream-001',
        requestId: 'req-003',
        tabId: 'tab-002',
        sequence: 1,
        timestamp: '2026-07-01T00:00:00.000Z',
      };
      expect(event.type).toBe(type);
    }
  });

  it('sequence is numeric', () => {
    const event: GrpcTauriEvent = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      type: 'grpc-heartbeat',
      streamId: 'stream-001',
      requestId: 'req-003',
      tabId: 'tab-002',
      sequence: 42,
      timestamp: '2026-07-01T00:00:00.000Z',
    };
    expect(typeof event.sequence).toBe('number');
    expect(event.sequence).toBe(42);
  });

  it('accepts grpc-end event with grpcStatus fields', () => {
    const event: GrpcTauriEvent = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      type: 'grpc-end',
      streamId: 'stream-001',
      requestId: 'req-003',
      tabId: 'tab-002',
      sequence: 4,
      timestamp: '2026-07-01T00:00:01.000Z',
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: { 'x-trace': 'abc' },
      transportUsed: 'tauri',
    };
    expect(event.type).toBe('grpc-end');
    expect(event.grpcStatus).toBe(0);
    expect(event.grpcStatusMessage).toBe('OK');
  });

  it('accepts grpc-error event with errorDetail', () => {
    const event: GrpcTauriEvent = {
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      type: 'grpc-error',
      streamId: 'stream-001',
      requestId: 'req-003',
      tabId: 'tab-002',
      sequence: 5,
      timestamp: '2026-07-01T00:00:02.000Z',
      grpcStatus: 13,
      grpcStatusMessage: 'INTERNAL',
      errorDetail: 'tonic transport failure',
      transportUsed: 'tauri',
    };
    expect(event.type).toBe('grpc-error');
    expect(event.errorDetail).toBe('tonic transport failure');
  });
});

describe('GrpcTauriCancelResult required fields', () => {
  it('has requestId and cancelled', () => {
    const result: GrpcTauriCancelResult = {
      requestId: 'req-001',
      cancelled: true,
    };
    expect(result.cancelled).toBe(true);
  });
});

describe('GrpcTauriStreamControlResult required fields', () => {
  it('has streamId, tabId, op, acknowledged', () => {
    const result: GrpcTauriStreamControlResult = {
      streamId: 'stream-001',
      tabId: 'tab-002',
      op: 'cancel',
      acknowledged: true,
    };
    expect(result.op).toBe('cancel');
  });

  it('accepts both op values', () => {
    const ops: GrpcTauriStreamControlResult['op'][] = ['end', 'cancel'];
    for (const op of ops) {
      const result: GrpcTauriStreamControlResult = {
        streamId: 's',
        tabId: 't',
        op,
        acknowledged: true,
      };
      expect(result.op).toBe(op);
    }
  });
});

describe('GrpcTauriTabCleanupResult required fields', () => {
  it('has tabId, cancelledStreams, releasedChannels', () => {
    const result: GrpcTauriTabCleanupResult = {
      tabId: 'tab-closing',
      cancelledStreams: 3,
      releasedChannels: 1,
    };
    expect(result.cancelledStreams).toBe(3);
    expect(result.releasedChannels).toBe(1);
  });
});

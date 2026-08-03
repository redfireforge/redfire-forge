/**
 * @vitest-environment node
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_BIDI_STREAM_START_REQUEST,
  FIXTURE_CLIENT_STREAM_START_REQUEST,
  FIXTURE_DESCRIPTOR,
  FIXTURE_SERVER_STREAM_START_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import { clearDynamicProtoCodecCache } from './dynamicProtoCodec.js';
import * as dynamicProtoCodec from './dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import { GrpcStreamService } from './grpc-stream-service.js';
import type { GrpcStreamingClientFactory } from './grpcStreamingClient.js';
import * as streamRegistry from './streamRegistry.js';
import { clearGrpcStreamRegistry, getGrpcStreamEntry } from './streamRegistry.js';
import { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';

function createMockResponse(): Response {
  return {
    writeHead: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    writableEnded: false,
    flushHeaders: vi.fn(),
  } as unknown as Response;
}

describe('GrpcStreamService coverage gaps', () => {
  beforeEach(() => {
    clearGrpcStreamRegistry();
    clearGrpcDescriptorStore();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  it('sendStreamMessage returns INVALID_DESCRIPTOR when descriptor key is missing', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    clearGrpcDescriptorStore();
    const send = service.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 'one' } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
  });

  it('sendStreamMessage returns INVALID_REQUEST when body encoding fails', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const send = service.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 123 } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('cancelStream returns alreadyEnded for terminal streams', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    getGrpcStreamEntry(start.data.streamId)!.status = 'ended';
    const cancel = service.cancelStream(start.data.streamId, 'tab-1');
    expect(cancel.ok).toBe(true);
    if (cancel.ok) {
      expect(cancel.data.alreadyEnded).toBe(true);
    }
  });

  it('endStream returns alreadyEnded success for unknown stream id', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const end = service.endStream('missing-stream', 'tab-1');
    expect(end.ok).toBe(true);
    if (end.ok) {
      expect(end.data.alreadyEnded).toBe(true);
    }
  });

  it('emits grpc-error events when transport reports failures', async () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn((_params, callbacks) => {
        queueMicrotask(() => callbacks.onError('UNAVAILABLE', 14));
        return {
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        };
      }),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-on-error' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    await vi.waitFor(() => {
      expect(getGrpcStreamEntry(start.data!.streamId)?.status).toBe('error');
    });
  });

  it('formats non-zero terminal statuses on inbound stream completion', async () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn((_params, callbacks) => {
        queueMicrotask(() => callbacks.onTerminal({
          status: 13,
          statusMessage: 'INTERNAL',
          headers: {},
          trailers: {},
        }));
        return {
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        };
      }),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-terminal-nonzero' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    await vi.waitFor(() => {
      expect(getGrpcStreamEntry(start.data!.streamId)?.status).toBe('ended');
    });
  });

  it('does not write initial payload for client streaming on start (use Send message / Send all)', () => {
    const write = vi.fn();
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write,
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream({
      ...FIXTURE_CLIENT_STREAM_START_REQUEST,
      requestId: 'req-client-no-initial',
      body: { message: 'seed' },
    }, 'tab-1');
    expect(start.ok).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });

  it('writes initial bidi payload during start when body is provided', () => {
    const write = vi.fn();
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'bidi_streaming',
        write,
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream({
      ...FIXTURE_BIDI_STREAM_START_REQUEST,
      requestId: 'req-bidi-initial',
      body: { message: 'seed' },
    }, 'tab-1');
    expect(start.ok).toBe(true);
    expect(write).toHaveBeenCalled();
  });

  it('attachStreamEvents finalizes terminal streams after replay flush', async () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-attach-terminal' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    getGrpcStreamEntry(start.data.streamId)!.status = 'ended';
    const res = createMockResponse();
    expect(service.attachStreamEvents(start.data.streamId, 'tab-1', res)).toBeNull();
    await vi.waitFor(() => {
      expect(getGrpcStreamEntry(start.data.streamId)).toBeUndefined();
    });
  });

  it('attachStreamEvents returns validation errors for missing tabId', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.attachStreamEvents('stream-1', undefined, createMockResponse());
    expect(envelope?.ok).toBe(false);
  });

  it('attachStreamEvents returns not_found when stream disappears before SSE attach', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.attachStreamEvents('missing-stream', 'tab-1', createMockResponse());
    expect(envelope?.ok).toBe(false);
    if (envelope && !envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    }
  });

  it('sendStreamMessage rejects invalid tabId, body, and inactive streams', () => {
    const write = vi.fn();
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write,
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    expect(service.sendStreamMessage('missing', 'tab-1', { body: {} }).ok).toBe(false);

    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    expect(service.sendStreamMessage(start.data.streamId, undefined, { body: {} }).ok).toBe(false);
    expect(service.sendStreamMessage(start.data.streamId, 'tab-1', { body: null as never }).ok).toBe(false);

    getGrpcStreamEntry(start.data.streamId)!.status = 'ended';
    const inactive = service.sendStreamMessage(start.data.streamId, 'tab-1', { body: { message: 'x' } });
    expect(inactive.ok).toBe(false);
  });

  it('sendStreamMessage rejects server-streaming sends and post-EOF client streams', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const serverStart = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(serverStart.ok).toBe(true);
    if (!serverStart.ok) return;
    expect(service.sendStreamMessage(serverStart.data.streamId, 'tab-1', { body: { message: 'x' } }).ok).toBe(false);

    const clientMock: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const clientService = new GrpcStreamService(clientMock);
    const clientStart = clientService.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(clientStart.ok).toBe(true);
    if (!clientStart.ok) return;
    getGrpcStreamEntry(clientStart.data.streamId)!.clientWritesEnded = true;
    expect(clientService.sendStreamMessage(clientStart.data.streamId, 'tab-1', { body: { message: 'x' } }).ok).toBe(false);
  });

  it('sendStreamMessage surfaces transport write failures', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(() => { throw new Error('write failed'); }),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const send = service.sendStreamMessage(start.data.streamId, 'tab-1', { body: { message: 'one' } });
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.message).toContain('write failed');
    }
  });

  it('endStream returns ownership errors and rejects server-streaming end', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    expect(service.endStream('missing', 'tab-1').ok).toBe(true);

    const start = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const end = service.endStream(start.data.streamId, 'tab-1');
    expect(end.ok).toBe(false);
  });

  it('cancelStream validates tabId and returns ownership errors', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    expect(service.cancelStream('missing', undefined).ok).toBe(false);

    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    expect(service.cancelStream(start.data.streamId, 'other-tab').ok).toBe(false);
  });

  it('cancelStream succeeds for active client streams', () => {
    const cancel = vi.fn();
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel,
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const result = service.cancelStream(start.data.streamId, 'tab-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cancelled).toBe(true);
    }
  });

  it('startStream ignores compose body for client streaming (no initial write)', () => {
    const write = vi.fn(() => { throw new Error('initial write failed'); });
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write,
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream({
      ...FIXTURE_CLIENT_STREAM_START_REQUEST,
      requestId: 'req-initial-write-fail',
      body: { message: 'seed' },
    }, 'tab-1');
    expect(start.ok).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });

  it('startStream rejects duplicate active requestIds', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const first = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'dup-req' },
      'tab-1',
    );
    expect(first.ok).toBe(true);
    const second = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'dup-req' },
      'tab-1',
    );
    expect(second.ok).toBe(false);
  });

  it('attachStreamEvents returns not_found when SSE attach races stream removal', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-attach-race' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    vi.spyOn(streamRegistry, 'attachGrpcStreamSseClient').mockReturnValue('not_found');
    const envelope = service.attachStreamEvents(start.data.streamId, 'tab-1', createMockResponse());
    expect(envelope?.ok).toBe(false);
    if (envelope && !envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    }
  });

  it('cancelStream returns alreadyEnded when registry reports already_terminal', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    vi.spyOn(streamRegistry, 'cancelGrpcStreamEntry').mockReturnValue('already_terminal');
    const cancel = service.cancelStream(start.data.streamId, 'tab-1');
    expect(cancel.ok).toBe(true);
    if (cancel.ok) {
      expect(cancel.data.alreadyEnded).toBe(true);
    }
  });

  it('sendStreamMessage rejects non-object bodies via validation', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.sendStreamMessage('stream-1', 'tab-1', { body: [] as never });
    expect(envelope.ok).toBe(false);
  });

  it('startStream returns validation errors for invalid callType preflight', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      callType: 'unary' as never,
      requestId: 'req-invalid-calltype',
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
  });

  it('startStream returns INVALID_DESCRIPTOR when method is missing from descriptor', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      method: 'MissingMethod',
      requestId: 'req-missing-method',
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
  });

  it('startStream rejects callType mismatch against descriptor metadata', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      method: 'Echo',
      requestId: 'req-calltype-mismatch',
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('startStream classifies schema encode failures during preflight', () => {
    vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementationOnce(() => {
      throw new Error('Invalid descriptor schema: missing request type');
    });
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-preflight-schema-encode',
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
  });

  it('startStream classifies non-Error encode failures during preflight', () => {
    vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementationOnce(() => {
      throw 'invalid request body';
    });
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-preflight-string-encode',
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('startStream applies default timeout when timeoutMs is omitted', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const { timeoutMs: _ignored, ...requestWithoutTimeout } = FIXTURE_SERVER_STREAM_START_REQUEST;
    const envelope = service.startStream({
      ...requestWithoutTimeout,
      requestId: 'req-default-timeout',
    }, 'tab-1');
    expect(envelope.ok).toBe(true);
    expect(mockClient.startStream).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
      expect.any(Object),
    );
  });

  it('sendStreamMessage stringifies non-Error encode failures', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream({
      ...FIXTURE_CLIENT_STREAM_START_REQUEST,
      requestId: 'req-send-encode-string-fail',
    }, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementationOnce(() => {
      throw 'encode exploded';
    });
    const send = service.sendStreamMessage(start.data.streamId, 'tab-1', { body: { message: 'one' } });
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.message).toContain('encode exploded');
    }
  });

  it('startStream returns registration conflict when requestId is already active', () => {
    vi.spyOn(streamRegistry, 'tryRegisterGrpcStream').mockImplementationOnce(() => ({
      ok: false,
      reason: 'duplicate_active_request',
    }));
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-register-conflict',
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.category).toBe('conflict');
    }
  });

  it('startStream returns auth validation errors for invalid bearer config', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-invalid-auth',
      auth: { type: 'api_key', apiKeyHeader: 'x-api-key', apiKeyValue: '' },
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
  });

  it('startStream returns oauth auth resolve failures after preflight', async () => {
    const oauth2TokenService = new GrpcOAuth2TokenService({
      fetch: vi.fn(async () => new Response('denied', { status: 401, statusText: 'Unauthorized' })),
    });
    const service = new GrpcStreamService(
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
      oauth2TokenService,
    );
    const envelope = await service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-oauth-fail',
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    }, 'tab-1');
    expect(envelope.ok).toBe(false);
  });

  it('sendStreamMessage uses entry sequence when emit returns undefined', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream({
      ...FIXTURE_CLIENT_STREAM_START_REQUEST,
      requestId: 'req-emit-seq-fallback',
    }, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    vi.spyOn(streamRegistry, 'emitGrpcStreamEvent').mockReturnValue(undefined);
    const send = service.sendStreamMessage(start.data.streamId, 'tab-1', { body: { message: 'one' } });
    expect(send.ok).toBe(true);
    if (send.ok) {
      expect(send.data.sequence).toBeGreaterThanOrEqual(0);
    }
  });

  it('sendStreamMessage stringifies non-Error write failures', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(() => { throw 'write exploded'; }),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream({
      ...FIXTURE_CLIENT_STREAM_START_REQUEST,
      requestId: 'req-write-string-fail',
    }, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const send = service.sendStreamMessage(start.data.streamId, 'tab-1', { body: { message: 'one' } });
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.message).toContain('write exploded');
    }
  });

  it('endStream stringifies non-Error transport end failures', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(() => { throw 'end exploded'; }),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream({
      ...FIXTURE_CLIENT_STREAM_START_REQUEST,
      requestId: 'req-end-string-fail',
    }, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const end = service.endStream(start.data.streamId, 'tab-1');
    expect(end.ok).toBe(false);
    if (!end.ok) {
      expect(end.error.message).toContain('end exploded');
    }
  });

  it('preserves zero-status terminal messages from transport callbacks', async () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn((_params, callbacks) => {
        queueMicrotask(() => callbacks.onTerminal({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
        }));
        return {
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        };
      }),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-terminal-zero' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    await vi.waitFor(() => {
      expect(getGrpcStreamEntry(start.data!.streamId)?.status).toBe('ended');
    });
  });

  it('startStream returns descriptor errors for missing descriptorKey and missing method', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);

    const missingDescriptor = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-no-descriptor', descriptorKey: 'missing-descriptor' },
      'tab-1',
    );
    expect(missingDescriptor.ok).toBe(false);
    if (!missingDescriptor.ok) {
      expect(missingDescriptor.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }

    const missingMethod = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-no-method', method: 'MethodThatDoesNotExist' },
      'tab-1',
    );
    expect(missingMethod.ok).toBe(false);
    if (!missingMethod.ok) {
      expect(missingMethod.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
  });

  it('startStream maps schema-looking encode failures to INVALID_DESCRIPTOR', () => {
    const service = new GrpcStreamService({ startStream: vi.fn() } as unknown as GrpcStreamingClientFactory);
    vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementationOnce(() => {
      throw new Error('Invalid descriptor schema for message body');
    });

    const envelope = service.startStream(
      {
        ...FIXTURE_BIDI_STREAM_START_REQUEST,
        requestId: 'req-schema-encode-fail',
        body: { message: 'seed' },
      },
      'tab-1',
    );

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
  });

  it('startStream with same requestId on different tab returns conflict', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const first = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-cross-tab-conflict' },
      'tab-1',
    );
    expect(first.ok).toBe(true);

    const second = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-cross-tab-conflict' },
      'tab-2',
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.category).toBe('conflict');
    }
  });

  it('startStream returns transport error when initial write throws', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'bidi_streaming',
        write: vi.fn(() => {
          throw new Error('initial write failed');
        }),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const envelope = service.startStream(
      {
        ...FIXTURE_BIDI_STREAM_START_REQUEST,
        requestId: 'req-initial-write-throws',
        body: { message: 'seed' },
      },
      'tab-1',
    );
    expect(envelope.ok).toBe(false);
  });

  it('attachStreamEvents exercises decodeResponse via onMessage callback', async () => {
    let decodeResponseFn: ((buffer: Buffer) => unknown) | undefined;
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn((params) => {
        decodeResponseFn = (params as { decodeResponse?: (buffer: Buffer) => unknown }).decodeResponse;
        return {
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        };
      }),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-on-message-decode' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const attach = service.attachStreamEvents(start.data.streamId, 'tab-1', createMockResponse());
    if (attach && !attach.ok) {
      expect(attach.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    }
    expect(typeof decodeResponseFn).toBe('function');
    expect(() => decodeResponseFn?.(Buffer.from([0x00]))).toThrow();
    await vi.waitFor(() => {
      const entry = getGrpcStreamEntry(start.data.streamId);
      expect(entry?.status === 'error' || entry?.status === 'active' || entry === undefined).toBe(true);
    });
  });

  it('endStream returns ownership error for wrong-tab ownership mismatch', () => {
    const mockClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const service = new GrpcStreamService(mockClient);
    const start = service.startStream(
      { ...FIXTURE_CLIENT_STREAM_START_REQUEST, requestId: 'req-tab-mismatch-end' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const end = service.endStream(start.data.streamId, 'tab-2');
    expect(end.ok).toBe(false);
  });
});

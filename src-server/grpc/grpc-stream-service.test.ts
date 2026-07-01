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
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import { GrpcStreamService } from './grpc-stream-service.js';
import { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';
import type { GrpcActiveStreamHandle, GrpcStreamingClientFactory } from './grpcStreamingClient.js';
import * as streamRegistry from './streamRegistry.js';
import {
  clearGrpcStreamRegistry,
  emitGrpcStreamEvent,
  findActiveGrpcStreamsByTabId,
  getGrpcStreamEntry,
  markGrpcStreamTerminal,
} from './streamRegistry.js';

function createMockStreamingClient(
  handlers?: {
    onInbound?: () => void;
    onTerminal?: () => void;
  },
): GrpcStreamingClientFactory {
  let handle: GrpcActiveStreamHandle | undefined;
  return {
    startStream: vi.fn((_params, callbacks) => {
      handle = {
        callType: _params.callType,
        write: vi.fn(),
        endWrites: vi.fn(() => {
          callbacks.onTerminal({
            status: 0,
            statusMessage: 'OK',
            headers: {},
            trailers: {},
            body: { message: 'aggregated' },
          });
        }),
        cancel: vi.fn(() => {
          callbacks.onError('Cancelled', 1);
        }),
      };
      queueMicrotask(() => {
        if (handlers?.onInbound) {
          handlers.onInbound();
          return;
        }
        if (_params.callType === 'server_streaming') {
          callbacks.onInboundMessage({ message: 'chunk-1' }, {});
          callbacks.onInboundMessage({ message: 'chunk-2' }, {});
          callbacks.onTerminal({
            status: 0,
            statusMessage: 'OK',
            headers: {},
            trailers: {},
          });
        }
      });
      return handle;
    }),
  };
}

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

describe('GrpcStreamService', () => {
  let service: GrpcStreamService;
  let mockClient: GrpcStreamingClientFactory;

  beforeEach(() => {
    clearGrpcStreamRegistry();
    clearGrpcDescriptorStore();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    mockClient = createMockStreamingClient();
    service = new GrpcStreamService(mockClient);
    vi.restoreAllMocks();
  });

  it('starts server streaming and returns streamId', async () => {
    const envelope = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.tabId).toBe('tab-1');
      expect(envelope.data.requestId).toBe(FIXTURE_SERVER_STREAM_START_REQUEST.requestId);
      expect(envelope.data.streamId).toBeTruthy();
    }
    await vi.waitFor(() => {
      expect(mockClient.startStream).toHaveBeenCalled();
    });
  });

  it('passes TLS target to streaming client when tlsMode is tls (Phase 4F)', async () => {
    service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-tls-stream',
      target: {
        address: 'localhost:50051',
        tlsMode: 'tls',
        tlsConfig: { serverNameOverride: 'grpc.local' },
      },
    }, 'tab-1');
    await vi.waitFor(() => {
      expect(mockClient.startStream).toHaveBeenCalledWith(
        expect.objectContaining({
          tlsMode: 'tls',
          tlsConfig: expect.objectContaining({ serverNameOverride: 'grpc.local' }),
        }),
        expect.any(Object),
      );
    });
  });

  it('classifies TLS transport failures on stream_start (Phase 4F)', () => {
    const failingClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => {
        throw new Error('self signed certificate in certificate chain');
      }),
    };
    const failingService = new GrpcStreamService(failingClient);
    const start = failingService.startStream(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-tls-stream-fail',
        target: { address: 'localhost:50051', tlsMode: 'tls' },
      },
      'tab-1',
    );
    expect(start.ok).toBe(false);
    if (!start.ok) {
      expect(start.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
      expect(start.error.message).toMatch(/not trusted/i);
      expect((start.error.details as { tlsFailure?: string })?.tlsFailure).toBe('unknown_ca');
    }
  });

  it('merges basic auth into stream metadata via shared auth policy (Phase 4A)', async () => {
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-basic-auth',
      auth: { type: 'basic', basicUsername: 'alice', basicPassword: 'secret' },
    }, 'tab-1');
    expect(envelope.ok).toBe(true);
    await vi.waitFor(() => {
      expect(mockClient.startStream).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            authorization: expect.stringMatching(/^Basic /),
          }),
        }),
        expect.any(Object),
      );
    });
  });

  it('auth panel overrides conflicting authorization metadata on stream start (Phase 4A)', async () => {
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-auth-precedence',
      metadata: { authorization: 'Bearer manual-token' },
      auth: { type: 'bearer', bearerToken: 'panel-token' },
    }, 'tab-1');
    expect(envelope.ok).toBe(true);
    await vi.waitFor(() => {
      expect(mockClient.startStream).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            authorization: 'Bearer panel-token',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  it('merges api key auth into stream metadata via shared auth policy (Phase 4A)', async () => {
    const envelope = service.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-api-key-stream',
      auth: { type: 'api_key', apiKeyName: 'x-api-key', apiKeyValue: 'stream-secret' },
    }, 'tab-1');
    expect(envelope.ok).toBe(true);
    await vi.waitFor(() => {
      expect(mockClient.startStream).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            'x-api-key': 'stream-secret',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  it('merges oauth2 auth into stream metadata via server-side token acquisition (Phase 4D)', async () => {
    const oauth2TokenService = new GrpcOAuth2TokenService({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        access_token: 'oauth-stream-token',
      }), { status: 200 })),
    });
    const oauthStreamService = new GrpcStreamService(mockClient, oauth2TokenService);
    const envelope = await oauthStreamService.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      requestId: 'req-oauth-stream',
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    }, 'tab-1');
    expect(envelope.ok).toBe(true);
    await vi.waitFor(() => {
      expect(mockClient.startStream).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            authorization: 'Bearer oauth-stream-token',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  it('does not fetch oauth2 token when stream preflight validation fails (Phase 4D)', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'should-not-fetch',
    }), { status: 200 }));
    const oauth2TokenService = new GrpcOAuth2TokenService({ fetch: fetchSpy });
    const oauthStreamService = new GrpcStreamService(mockClient, oauth2TokenService);
    const envelope = await oauthStreamService.startStream({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      descriptorKey: 'missing-descriptor-key',
      requestId: 'req-oauth-preflight',
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
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires tabId on start', () => {
    const envelope = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, undefined);
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('returns 404 when sending to a terminal stream', () => {
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    markGrpcStreamTerminal(start.data.streamId, 'ended');

    const send = service.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 'late' } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    }
  });

  it('returns 404 when sending after stream was cancelled and finalized', () => {
    const start = service.startStream(FIXTURE_BIDI_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    service.cancelStream(start.data.streamId, 'tab-1');

    const send = service.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 'late' } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    }
  });

  it('rejects send on server-streaming with invalid request semantics', () => {
    const start = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const send = service.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 'nope' } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.message).toContain('server-streaming');
    }
  });

  it('rejects end on server-streaming', () => {
    const start = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const end = service.endStream(start.data.streamId, 'tab-1');
    expect(end.ok).toBe(false);
    if (!end.ok) {
      expect(end.error.message).toContain('server-streaming');
    }
  });

  it('sends client-streaming messages and ends stream', () => {
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const send = service.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 'one' } },
    );
    expect(send.ok).toBe(true);

    const end = service.endStream(start.data.streamId, 'tab-1');
    expect(end.ok).toBe(true);
    if (end.ok) {
      expect(end.data.ended).toBe(true);
    }
  });

  it('cancels active stream idempotently', () => {
    const start = service.startStream(FIXTURE_BIDI_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const first = service.cancelStream(start.data.streamId, 'tab-1');
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.data.cancelled).toBe(true);
    }

    const second = service.cancelStream(start.data.streamId, 'tab-1');
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.alreadyEnded).toBe(true);
    }
  });

  it('rejects cross-tab stream control', () => {
    const start = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const cancel = service.cancelStream(start.data.streamId, 'tab-other');
    expect(cancel.ok).toBe(false);
    if (!cancel.ok) {
      expect(cancel.error.message).toContain('tabId');
    }
  });

  it('requires tabId on cancel and end', () => {
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const cancel = service.cancelStream(start.data.streamId, undefined);
    expect(cancel.ok).toBe(false);
    if (!cancel.ok) {
      expect(cancel.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }

    const end = service.endStream(start.data.streamId, undefined);
    expect(end.ok).toBe(false);
    if (!end.ok) {
      expect(end.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('returns alreadyEnded when cancelling unknown stream id', () => {
    const cancel = service.cancelStream('missing-stream', 'tab-1');
    expect(cancel.ok).toBe(true);
    if (cancel.ok) {
      expect(cancel.data.alreadyEnded).toBe(true);
      expect(cancel.data.cancelled).toBe(false);
    }
  });

  it('endStream returns CALL_FAILED when transport endWrites throws', () => {
    const throwingClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(() => {
          throw new Error('endWrites failed');
        }),
        cancel: vi.fn(),
      })),
    };
    const throwingService = new GrpcStreamService(throwingClient);
    const start = throwingService.startStream(
      { ...FIXTURE_CLIENT_STREAM_START_REQUEST, requestId: 'req-end-throw' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const end = throwingService.endStream(start.data.streamId, 'tab-1');
    expect(end.ok).toBe(false);
    if (!end.ok) {
      expect(end.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
      expect(end.error.message).toContain('endWrites failed');
    }
  });

  it('attaches SSE for owned stream', () => {
    const start = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const res = createMockResponse();
    const error = service.attachStreamEvents(start.data.streamId, 'tab-1', res);
    expect(error).toBeNull();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
    }));
  });

  it('replays buffered events when attaching to a terminal stream', () => {
    const start = service.startStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    emitGrpcStreamEvent(start.data.streamId, {
      type: 'grpc-message',
      direction: 'inbound',
      data: { message: 'late-replay' },
    });
    markGrpcStreamTerminal(start.data.streamId, 'ended');
    emitGrpcStreamEvent(start.data.streamId, {
      type: 'grpc-end',
      status: 0,
      statusMessage: 'OK',
    });

    const res = createMockResponse();
    const error = service.attachStreamEvents(start.data.streamId, 'tab-1', res);
    expect(error).toBeNull();
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('late-replay'),
    );
    expect(res.end).toHaveBeenCalled();
    expect(getGrpcStreamEntry(start.data.streamId)).toBeUndefined();
  });

  it('finalizes registry when startStream transport throws synchronously', () => {
    const failingClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => {
        throw new Error('dial failed');
      }),
    };
    const failingService = new GrpcStreamService(failingClient);
    const start = failingService.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-sync-fail' },
      'tab-1',
    );
    expect(start.ok).toBe(false);
    expect(findActiveGrpcStreamsByTabId('tab-1')).toEqual([]);
  });

  it('cancels prior tab stream when starting a new one', () => {
    const first = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-first' },
      'tab-1',
    );
    const second = service.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-second' },
      'tab-1',
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.streamId).not.toBe(second.data.streamId);
  });

  it('endStream is idempotent after first EOF', () => {
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const first = service.endStream(start.data.streamId, 'tab-1');
    const second = service.endStream(start.data.streamId, 'tab-1');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.alreadyEnded).toBe(true);
    }
  });

  it('rejects send after client stream EOF', () => {
    const eofClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const eofService = new GrpcStreamService(eofClient);
    const start = eofService.startStream(
      { ...FIXTURE_CLIENT_STREAM_START_REQUEST, requestId: 'req-cs-eof' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    expect(eofService.endStream(start.data.streamId, 'tab-1').ok).toBe(true);

    const send = eofService.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 'late' } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.message).toContain('after client stream EOF');
    }
  });

  it('emits ordered inbound messages for server streaming', async () => {
    const delayedClient: GrpcStreamingClientFactory = {
      startStream: vi.fn((_params, callbacks) => {
        const handle: GrpcActiveStreamHandle = {
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        };
        queueMicrotask(() => {
          callbacks.onInboundMessage({ message: 'chunk-1' }, {});
          callbacks.onInboundMessage({ message: 'chunk-2' }, {});
        });
        return handle;
      }),
    };
    const delayedService = new GrpcStreamService(delayedClient);
    const start = delayedService.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-seq-delay' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    await vi.waitFor(() => {
      const entry = getGrpcStreamEntry(start.data.streamId);
      expect(entry?.sequence).toBe(2);
    });
  });

  it('emits grpc-message events before grpc-end', async () => {
    const captured: string[] = [];
    const originalEmit = streamRegistry.emitGrpcStreamEvent;
    vi.spyOn(streamRegistry, 'emitGrpcStreamEvent').mockImplementation((streamId, partial) => {
      captured.push(partial.type);
      return originalEmit(streamId, partial);
    });

    const sequencingClient: GrpcStreamingClientFactory = {
      startStream: vi.fn((_params, callbacks) => {
        const handle: GrpcActiveStreamHandle = {
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        };
        queueMicrotask(() => {
          callbacks.onInboundMessage({ message: 'a' }, {});
          callbacks.onInboundMessage({ message: 'b' }, {});
          callbacks.onTerminal({
            status: 0,
            statusMessage: 'OK',
            headers: {},
            trailers: {},
          });
        });
        return handle;
      }),
    };
    const seqService = new GrpcStreamService(sequencingClient);
    const start = seqService.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-seq-order' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    await vi.waitFor(() => {
      expect(captured.includes('grpc-end')).toBe(true);
    });

    const endIndex = captured.indexOf('grpc-end');
    const lastMessageIndex = captured.lastIndexOf('grpc-message');
    expect(lastMessageIndex).toBeGreaterThanOrEqual(0);
    expect(lastMessageIndex).toBeLessThan(endIndex);
  });

  it('endStream returns alreadyEnded for unknown stream id', () => {
    const end = service.endStream('missing-stream-id', 'tab-1');
    expect(end.ok).toBe(true);
    if (end.ok) {
      expect(end.data.alreadyEnded).toBe(true);
      expect(end.data.ended).toBe(false);
    }
  });

  it('endStream returns alreadyEnded when client writes already ended', () => {
    const eofClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const eofService = new GrpcStreamService(eofClient);
    const start = eofService.startStream(
      { ...FIXTURE_CLIENT_STREAM_START_REQUEST, requestId: 'req-cs-double-end' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    expect(eofService.endStream(start.data.streamId, 'tab-1').ok).toBe(true);
    const second = eofService.endStream(start.data.streamId, 'tab-1');
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.alreadyEnded).toBe(true);
      expect(second.data.ended).toBe(true);
    }
  });

  it('sendStreamMessage returns CALL_FAILED when transport write throws', () => {
    const writeFailClient: GrpcStreamingClientFactory = {
      startStream: vi.fn(() => ({
        callType: 'client_streaming',
        write: vi.fn(() => {
          throw new Error('write failed');
        }),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      })),
    };
    const writeFailService = new GrpcStreamService(writeFailClient);
    const start = writeFailService.startStream(
      { ...FIXTURE_CLIENT_STREAM_START_REQUEST, requestId: 'req-write-fail' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const send = writeFailService.sendStreamMessage(
      start.data.streamId,
      'tab-1',
      { body: { message: 'boom' } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
      expect(send.error.message).toContain('write failed');
    }
  });

  it('requires tabId on send', () => {
    const start = service.startStream(FIXTURE_CLIENT_STREAM_START_REQUEST, 'tab-1');
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const send = service.sendStreamMessage(
      start.data.streamId,
      undefined,
      { body: { message: 'x' } },
    );
    expect(send.ok).toBe(false);
    if (!send.ok) {
      expect(send.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('cancel does not surface grpc-error after explicit cancel', async () => {
    const emitted: Array<{ type: string }> = [];
    const trackingClient: GrpcStreamingClientFactory = {
      startStream: vi.fn((_params, callbacks) => ({
        callType: 'server_streaming' as const,
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(() => {
          queueMicrotask(() => callbacks.onError('Cancelled', 1));
        }),
      })),
    };
    const trackingService = new GrpcStreamService(trackingClient);
    const start = trackingService.startStream(
      { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-cancel-race' },
      'tab-1',
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const originalEmit = streamRegistry.emitGrpcStreamEvent;
    const emitSpy = vi.spyOn(streamRegistry, 'emitGrpcStreamEvent').mockImplementation((streamId, partial) => {
      emitted.push({ type: partial.type });
      return originalEmit(streamId, partial);
    });

    trackingService.cancelStream(start.data.streamId, 'tab-1');
    await vi.waitFor(() => {
      expect(emitted.some((event) => event.type === 'grpc-end')).toBe(true);
    });
    expect(emitted.some((event) => event.type === 'grpc-error')).toBe(false);
    emitSpy.mockRestore();
  });
});

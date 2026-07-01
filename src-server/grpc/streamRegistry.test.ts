/**
 * @vitest-environment node
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachGrpcStreamSseClient,
  cancelActiveGrpcStreamsForTab,
  cancelGrpcStreamEntry,
  clearGrpcStreamRegistry,
  detachGrpcStreamSseClient,
  emitGrpcStreamEvent,
  expireGrpcStreamAfterSseGrace,
  finalizeGrpcStreamEntry,
  findActiveGrpcStreamsByTabId,
  getGrpcStreamEntry,
  markGrpcStreamTerminal,
  replayBufferedGrpcStreamEvents,
  tryRegisterGrpcStream,
} from './streamRegistry.js';
import {
  GRPC_STREAM_HEARTBEAT_INTERVAL_MS,
  GRPC_STREAM_SSE_DISCONNECT_GRACE_MS,
} from '../../src/shared/grpc/contracts.js';

function createMockTransport() {
  return {
    callType: 'server_streaming' as const,
    write: vi.fn(),
    endWrites: vi.fn(),
    cancel: vi.fn(),
  };
}

function createMockSseResponse(): Response {
  const listeners = new Map<string, () => void>();
  return {
    write: vi.fn(),
    end: vi.fn(),
    writableEnded: false,
    on: vi.fn((event: string, handler: () => void) => {
      listeners.set(event, handler);
    }),
    emitClose: () => listeners.get('close')?.(),
  } as unknown as Response;
}

describe('streamRegistry', () => {
  beforeEach(() => {
    clearGrpcStreamRegistry();
  });

  it('registers and retrieves stream entries', () => {
    const transport = createMockTransport();
    const result = tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    expect(result.ok).toBe(true);
    expect(getGrpcStreamEntry('stream-1')?.tabId).toBe('tab-a');
  });

  it('rejects duplicate active requestId', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-dup',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const second = tryRegisterGrpcStream({
      streamId: 'stream-2',
      tabId: 'tab-b',
      requestId: 'req-dup',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe('duplicate_active_request');
    }
  });

  it('emits monotonic sequence events to SSE clients', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-1', res, vi.fn());

    const first = emitGrpcStreamEvent('stream-1', {
      type: 'grpc-message',
      direction: 'inbound',
      data: { message: 'one' },
    });
    const second = emitGrpcStreamEvent('stream-1', {
      type: 'grpc-message',
      direction: 'inbound',
      data: { message: 'two' },
    });

    expect(first?.sequence).toBe(1);
    expect(second?.sequence).toBe(2);
    expect(res.write).toHaveBeenCalledTimes(2);
  });

  it('rejects cancel when tabId mismatches', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'bidi_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.EchoRequest',
      transport,
    });
    expect(cancelGrpcStreamEntry('stream-1', 'tab-b')).toBe('tab_mismatch');
    expect(transport.cancel).not.toHaveBeenCalled();
  });

  it('cancels active streams for tab and defers finalize for late SSE replay', () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const cancelled = cancelActiveGrpcStreamsForTab('tab-a');
    expect(cancelled).toEqual(['stream-1']);
    expect(transport.cancel).toHaveBeenCalled();
    expect(getGrpcStreamEntry('stream-1')?.status).toBe('cancelled');

    vi.advanceTimersByTime(GRPC_STREAM_SSE_DISCONNECT_GRACE_MS);
    expect(getGrpcStreamEntry('stream-1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('replays cancelled grpc-end after cancelActiveGrpcStreamsForTab', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    cancelActiveGrpcStreamsForTab('tab-a');

    const res = createMockSseResponse();
    const replayed = replayBufferedGrpcStreamEvents('stream-1', res, 0);
    expect(replayed).toBeGreaterThan(0);
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('Cancelled'),
    );
  });

  it('attachGrpcStreamSseClient clears pending finalize timer on late attach', () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    cancelActiveGrpcStreamsForTab('tab-a');
    expect(getGrpcStreamEntry('stream-1')).toBeDefined();

    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-1', res, vi.fn());

    vi.advanceTimersByTime(GRPC_STREAM_SSE_DISCONNECT_GRACE_MS);
    expect(getGrpcStreamEntry('stream-1')).toBeDefined();

    detachGrpcStreamSseClient('stream-1', res);
    expect(getGrpcStreamEntry('stream-1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('finds active streams by tabId', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    tryRegisterGrpcStream({
      streamId: 'stream-2',
      tabId: 'tab-b',
      requestId: 'req-2',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(findActiveGrpcStreamsByTabId('tab-a').map((e) => e.streamId)).toEqual(['stream-1']);
  });

  it('finalizes terminal entries and clears registry', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    finalizeGrpcStreamEntry('stream-1');
    expect(getGrpcStreamEntry('stream-1')).toBeUndefined();
  });

  it('emits grpc-heartbeat SSE events on interval', () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-1', res, vi.fn());

    vi.advanceTimersByTime(GRPC_STREAM_HEARTBEAT_INTERVAL_MS);

    expect(res.write).toHaveBeenCalledWith(
      expect.stringMatching(/^event: grpc-heartbeat\ndata: \{/),
    );
    vi.useRealTimers();
  });

  it('buffers events for replay after terminal when no SSE client was attached', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });

    emitGrpcStreamEvent('stream-1', {
      type: 'grpc-message',
      direction: 'inbound',
      data: { message: 'buffered' },
    });
    markGrpcStreamTerminal('stream-1', 'ended');

    const res = createMockSseResponse();
    const replayed = replayBufferedGrpcStreamEvents('stream-1', res, 0);
    expect(replayed).toBe(1);
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('buffered'),
    );
  });

  it('expires active stream after SSE disconnect grace', () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-1', res, vi.fn());
    detachGrpcStreamSseClient('stream-1', res);

    vi.advanceTimersByTime(GRPC_STREAM_SSE_DISCONNECT_GRACE_MS);

    expect(getGrpcStreamEntry('stream-1')).toBeUndefined();
    expect(transport.cancel).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('finalizes terminal entries immediately when last SSE client disconnects', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-1', res, vi.fn());
    markGrpcStreamTerminal('stream-1', 'ended');
    detachGrpcStreamSseClient('stream-1', res);

    expect(getGrpcStreamEntry('stream-1')).toBeUndefined();
    expect(transport.cancel).not.toHaveBeenCalled();
  });

  it('expireGrpcStreamAfterSseGrace emits grpc-end and finalizes active stream', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });

    expireGrpcStreamAfterSseGrace('stream-1');

    expect(getGrpcStreamEntry('stream-1')).toBeUndefined();
    expect(transport.cancel).toHaveBeenCalled();
  });
});

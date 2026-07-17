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
  findActiveGrpcStreamByRequestId,
  findActiveGrpcStreamsByTabId,
  finalizeGrpcStreamEntry,
  getGrpcStreamEntry,
  markGrpcStreamTerminal,
  replayBufferedGrpcStreamEvents,
  scheduleFinalizeAfterTerminal,
  tryRegisterGrpcStream,
  expireGrpcStreamAfterSseGrace,
} from './streamRegistry.js';
import { GRPC_STREAM_MESSAGE_CAP } from '../../src/shared/grpc/contracts.js';

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
  } as unknown as Response;
}

describe('streamRegistry coverage gaps', () => {
  beforeEach(() => {
    clearGrpcStreamRegistry();
  });

  it('findActiveGrpcStreamByRequestId returns active entry', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-active',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(findActiveGrpcStreamByRequestId('req-active')?.streamId).toBe('stream-1');
    expect(findActiveGrpcStreamByRequestId('missing')).toBeUndefined();
  });

  it('tryRegisterGrpcStream reuses requestId after prior stream is terminal', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-old',
      tabId: 'tab-a',
      requestId: 'req-reuse',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-old', 'ended');

    const second = tryRegisterGrpcStream({
      streamId: 'stream-new',
      tabId: 'tab-a',
      requestId: 'req-reuse',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(second.ok).toBe(true);
    expect(findActiveGrpcStreamByRequestId('req-reuse')?.streamId).toBe('stream-new');
  });

  it('scheduleFinalizeAfterTerminal skips when SSE clients are attached', () => {
    vi.useFakeTimers();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-1', 'ended');
    attachGrpcStreamSseClient('stream-1', createMockSseResponse(), vi.fn());

    scheduleFinalizeAfterTerminal('stream-1');
    vi.advanceTimersByTime(60_000);
    expect(getGrpcStreamEntry('stream-1')).toBeDefined();
    vi.useRealTimers();
  });

  it('cancelGrpcStreamEntry returns already_terminal for inactive streams', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-1', 'ended');
    expect(cancelGrpcStreamEntry('stream-1', 'tab-a')).toBe('already_terminal');
  });

  it('attachGrpcStreamSseClient returns not_found for missing streams', () => {
    expect(attachGrpcStreamSseClient('missing', createMockSseResponse(), vi.fn())).toBe('not_found');
  });

  it('emitGrpcStreamEvent returns undefined for unknown stream ids', () => {
    expect(emitGrpcStreamEvent('missing', { type: 'grpc-heartbeat' })).toBeUndefined();
  });

  it('detachGrpcStreamSseClient is a no-op for unknown streams', () => {
    expect(() => detachGrpcStreamSseClient('missing', createMockSseResponse())).not.toThrow();
  });

  it('expireGrpcStreamAfterSseGrace skips cancellation while SSE clients remain', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    attachGrpcStreamSseClient('stream-1', createMockSseResponse(), vi.fn());
    expireGrpcStreamAfterSseGrace('stream-1');
    expect(getGrpcStreamEntry('stream-1')?.status).toBe('active');
  });

  it('trims event log when message cap is exceeded', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-cap',
      tabId: 'tab-a',
      requestId: 'req-cap',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    const entry = getGrpcStreamEntry('stream-cap')!;
    for (let i = 0; i < GRPC_STREAM_MESSAGE_CAP; i += 1) {
      entry.eventLog.push({
        type: 'grpc-heartbeat',
        streamId: 'stream-cap',
        requestId: 'req-cap',
        tabId: 'tab-a',
        sequence: i,
        timestamp: new Date().toISOString(),
      });
    }
    emitGrpcStreamEvent('stream-cap', { type: 'grpc-heartbeat' });
    expect(entry.eventLog).toHaveLength(GRPC_STREAM_MESSAGE_CAP);
    expect(entry.eventLog[0]?.sequence).toBe(1);
  });

  it('heartbeat interval skips inactive streams', () => {
    vi.useFakeTimers();
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-1',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    const onEvent = vi.fn();
    attachGrpcStreamSseClient('stream-1', createMockSseResponse(), onEvent);
    markGrpcStreamTerminal('stream-1', 'ended');
    vi.advanceTimersByTime(60_000);
    expect(onEvent).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('tryRegisterGrpcStream rejects duplicate active requestIds', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-1',
      tabId: 'tab-a',
      requestId: 'req-dup',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    const duplicate = tryRegisterGrpcStream({
      streamId: 'stream-2',
      tabId: 'tab-a',
      requestId: 'req-dup',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.reason).toBe('duplicate_active_request');
    }
  });

  it('detachGrpcStreamSseClient triggers close handler cleanup', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-close',
      tabId: 'tab-a',
      requestId: 'req-close',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    const listeners = new Map<string, () => void>();
    const res = {
      write: vi.fn(),
      end: vi.fn(),
      writableEnded: false,
      on: vi.fn((event: string, handler: () => void) => {
        listeners.set(event, handler);
      }),
    } as unknown as Response;
    attachGrpcStreamSseClient('stream-close', res, vi.fn());
    listeners.get('close')?.();
    expect(getGrpcStreamEntry('stream-close')?.sseClients.size).toBe(0);
  });

  it('findActiveGrpcStreamsByTabId returns only active tab streams', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-tab-a',
      tabId: 'tab-a',
      requestId: 'req-a',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    tryRegisterGrpcStream({
      streamId: 'stream-tab-b',
      tabId: 'tab-b',
      requestId: 'req-b',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(findActiveGrpcStreamsByTabId('tab-a').map((e) => e.streamId)).toEqual(['stream-tab-a']);
  });

  it('cancelActiveGrpcStreamsForTab cancels active tab streams', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-cancel-tab',
      tabId: 'tab-a',
      requestId: 'req-cancel-tab',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const cancelled = cancelActiveGrpcStreamsForTab('tab-a');
    expect(cancelled).toEqual(['stream-cancel-tab']);
    expect(transport.cancel).toHaveBeenCalled();
    expect(getGrpcStreamEntry('stream-cancel-tab')?.status).toBe('cancelled');
  });

  it('replayBufferedGrpcStreamEvents writes events after lastSequence', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-replay',
      tabId: 'tab-a',
      requestId: 'req-replay',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    emitGrpcStreamEvent('stream-replay', { type: 'grpc-heartbeat' });
    emitGrpcStreamEvent('stream-replay', { type: 'grpc-heartbeat' });
    const res = createMockSseResponse();
    const replayed = replayBufferedGrpcStreamEvents('stream-replay', res, 1);
    expect(replayed).toBeGreaterThan(0);
    expect(res.write).toHaveBeenCalled();
  });

  it('scheduleFinalizeAfterTerminal finalizes entry after grace when no SSE clients', () => {
    vi.useFakeTimers();
    tryRegisterGrpcStream({
      streamId: 'stream-finalize',
      tabId: 'tab-a',
      requestId: 'req-finalize',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-finalize', 'ended');
    scheduleFinalizeAfterTerminal('stream-finalize');
    vi.advanceTimersByTime(60_000);
    expect(getGrpcStreamEntry('stream-finalize')).toBeUndefined();
    vi.useRealTimers();
  });

  it('cancelGrpcStreamEntry returns tab_mismatch for foreign tabs', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-tab',
      tabId: 'tab-a',
      requestId: 'req-tab',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(cancelGrpcStreamEntry('stream-tab', 'tab-b')).toBe('tab_mismatch');
  });

  it('cancelGrpcStreamEntry tolerates transport cancel failures', () => {
    const transport = createMockTransport();
    transport.cancel.mockImplementation(() => {
      throw new Error('cancel failed');
    });
    tryRegisterGrpcStream({
      streamId: 'stream-cancel-error',
      tabId: 'tab-a',
      requestId: 'req-cancel-error',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    expect(cancelGrpcStreamEntry('stream-cancel-error', 'tab-a')).toBe('cancelled');
  });

  it('detachGrpcStreamSseClient finalizes terminal streams when last client disconnects', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-terminal-detach',
      tabId: 'tab-a',
      requestId: 'req-terminal-detach',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-terminal-detach', 'ended');
    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-terminal-detach', res, vi.fn());
    detachGrpcStreamSseClient('stream-terminal-detach', res);
    expect(getGrpcStreamEntry('stream-terminal-detach')).toBeUndefined();
  });

  it('expireGrpcStreamAfterSseGrace cancels active streams after SSE disconnect', () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-expire',
      tabId: 'tab-a',
      requestId: 'req-expire',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-expire', res, vi.fn());
    detachGrpcStreamSseClient('stream-expire', res);
    vi.advanceTimersByTime(60_000);
    expect(getGrpcStreamEntry('stream-expire')).toBeUndefined();
    expect(transport.cancel).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('emitGrpcStreamEvent writes to attached SSE clients and heartbeat ticks while active', () => {
    vi.useFakeTimers();
    tryRegisterGrpcStream({
      streamId: 'stream-sse',
      tabId: 'tab-a',
      requestId: 'req-sse',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    const res = createMockSseResponse();
    const onEvent = vi.fn();
    attachGrpcStreamSseClient('stream-sse', res, onEvent);
    emitGrpcStreamEvent('stream-sse', { type: 'grpc-heartbeat' });
    expect(res.write).toHaveBeenCalled();
    vi.advanceTimersByTime(15_000);
    expect(onEvent).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('detachGrpcStreamSseClient keeps stream alive while other SSE clients remain', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-multi-sse',
      tabId: 'tab-a',
      requestId: 'req-multi-sse',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    const first = createMockSseResponse();
    const second = createMockSseResponse();
    attachGrpcStreamSseClient('stream-multi-sse', first, vi.fn());
    attachGrpcStreamSseClient('stream-multi-sse', second, vi.fn());
    detachGrpcStreamSseClient('stream-multi-sse', first);
    expect(getGrpcStreamEntry('stream-multi-sse')?.sseClients.size).toBe(1);
  });

  it('re-registers request ids after terminal streams are removed from the registry', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-stale',
      tabId: 'tab-a',
      requestId: 'req-stale',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-stale', 'ended');
    finalizeGrpcStreamEntry('stream-stale');

    const second = tryRegisterGrpcStream({
      streamId: 'stream-stale-2',
      tabId: 'tab-a',
      requestId: 'req-stale',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    expect(second.ok).toBe(true);
    expect(findActiveGrpcStreamByRequestId('req-stale')?.streamId).toBe('stream-stale-2');
  });

  it('cancelGrpcStreamEntry returns not_found for missing streams', () => {
    expect(cancelGrpcStreamEntry('missing', 'tab-a')).toBe('not_found');
  });

  it('expireGrpcStreamAfterSseGrace ignores ended streams', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-ended-expire',
      tabId: 'tab-a',
      requestId: 'req-ended-expire',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-ended-expire', 'ended');
    expireGrpcStreamAfterSseGrace('stream-ended-expire');
    expect(getGrpcStreamEntry('stream-ended-expire')?.status).toBe('ended');
  });

  it('scheduleFinalizeAfterTerminal is a no-op for missing streams', () => {
    expect(() => scheduleFinalizeAfterTerminal('missing')).not.toThrow();
  });

  it('replayBufferedGrpcStreamEvents returns zero when nothing is newer than lastSequence', () => {
    tryRegisterGrpcStream({
      streamId: 'stream-replay-none',
      tabId: 'tab-a',
      requestId: 'req-replay-none',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    emitGrpcStreamEvent('stream-replay-none', { type: 'grpc-heartbeat' });
    const entry = getGrpcStreamEntry('stream-replay-none')!;
    const replayed = replayBufferedGrpcStreamEvents(
      'stream-replay-none',
      createMockSseResponse(),
      entry.sequence,
    );
    expect(replayed).toBe(0);
  });

  it('cancelGrpcStreamEntry supports ended terminal status', () => {
    const transport = createMockTransport();
    tryRegisterGrpcStream({
      streamId: 'stream-end-cancel',
      tabId: 'tab-a',
      requestId: 'req-end-cancel',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    expect(cancelGrpcStreamEntry('stream-end-cancel', 'tab-a', 'ended')).toBe('cancelled');
    expect(getGrpcStreamEntry('stream-end-cancel')?.status).toBe('ended');
  });

  it('markGrpcStreamTerminal is a no-op for missing or inactive entries', () => {
    markGrpcStreamTerminal('missing', 'ended');
    tryRegisterGrpcStream({
      streamId: 'stream-ended',
      tabId: 'tab-a',
      requestId: 'req-ended',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport: createMockTransport(),
    });
    markGrpcStreamTerminal('stream-ended', 'ended');
    markGrpcStreamTerminal('stream-ended', 'cancelled');
    expect(getGrpcStreamEntry('stream-ended')?.status).toBe('ended');
  });

  it('cancelActiveGrpcStreamsForTab tolerates transport cancel failures', () => {
    const transport = createMockTransport();
    transport.cancel.mockImplementation(() => {
      throw new Error('cancel failed');
    });
    tryRegisterGrpcStream({
      streamId: 'stream-tab-cancel-error',
      tabId: 'tab-a',
      requestId: 'req-tab-cancel-error',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    expect(cancelActiveGrpcStreamsForTab('tab-a')).toEqual(['stream-tab-cancel-error']);
  });

  it('expireGrpcStreamAfterSseGrace tolerates transport cancel failures', () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    transport.cancel.mockImplementation(() => {
      throw new Error('cancel failed');
    });
    tryRegisterGrpcStream({
      streamId: 'stream-expire-error',
      tabId: 'tab-a',
      requestId: 'req-expire-error',
      callType: 'server_streaming',
      descriptorKey: 'desc-1',
      requestTypeName: 'echo.StreamRequest',
      transport,
    });
    const res = createMockSseResponse();
    attachGrpcStreamSseClient('stream-expire-error', res, vi.fn());
    detachGrpcStreamSseClient('stream-expire-error', res);
    vi.advanceTimersByTime(60_000);
    expect(getGrpcStreamEntry('stream-expire-error')).toBeUndefined();
    vi.useRealTimers();
  });

  it('replayBufferedGrpcStreamEvents returns zero for missing streams', () => {
    expect(replayBufferedGrpcStreamEvents('missing', createMockSseResponse(), 0)).toBe(0);
  });
});

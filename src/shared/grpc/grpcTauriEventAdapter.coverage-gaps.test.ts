import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrpcStreamEvent } from './contracts';
import type { GrpcTauriEvent } from './grpcTauriContracts';
import { GRPC_TAURI_EVENT_REORDER_BUFFER } from './grpcTauriContracts';
import {
  GrpcTauriEventSequenceBuffer,
  listenGrpcTauriStreamEvents,
  normalizeGrpcTauriEvent,
} from './grpcTauriEventAdapter';

const listenMock = vi.fn();
const attachMock = vi.fn();
const detachMock = vi.fn();
const retainHeartbeatMock = vi.fn();

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

vi.mock('./grpcNativeTauriLifecycle', () => ({
  invokeGrpcTabEventsAttachNative: (...args: unknown[]) => attachMock(...args),
  invokeGrpcTabEventsDetachNative: (...args: unknown[]) => detachMock(...args),
  retainGrpcTabHeartbeat: (...args: unknown[]) => retainHeartbeatMock(...args),
}));

function makeEvent(overrides: Partial<GrpcTauriEvent> = {}): GrpcTauriEvent {
  return {
    schemaVersion: 1,
    type: 'grpc-message',
    streamId: 'stream-1',
    requestId: 'req-1',
    tabId: 'tab-a',
    sequence: 1,
    timestamp: '2026-06-30T00:00:00.000Z',
    data: { message: 'hello' },
    ...overrides,
  };
}

function makeStreamEvent(overrides: Partial<GrpcStreamEvent> = {}): GrpcStreamEvent {
  return {
    type: 'grpc-message',
    streamId: 'stream-1',
    requestId: 'req-1',
    tabId: 'tab-a',
    sequence: 1,
    timestamp: '2026-06-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('grpcTauriEventAdapter coverage gaps', () => {
  beforeEach(() => {
    listenMock.mockReset();
    attachMock.mockReset();
    detachMock.mockReset();
    retainHeartbeatMock.mockReset();
    attachMock.mockResolvedValue(undefined);
    detachMock.mockResolvedValue(undefined);
    retainHeartbeatMock.mockReturnValue(vi.fn());
  });

  it('normalizeGrpcTauriEvent copies headers and trailers', () => {
    const normalized = normalizeGrpcTauriEvent(makeEvent({
      headers: { 'x-test': '1' },
      trailers: { 'grpc-status': '0' },
    }));
    expect(normalized?.headers).toEqual({ 'x-test': '1' });
    expect(normalized?.trailers).toEqual({ 'grpc-status': '0' });
  });

  it('GrpcTauriEventSequenceBuffer trims overflow pending sequences', () => {
    const buffer = new GrpcTauriEventSequenceBuffer(0);
    for (let seq = 2; seq <= GRPC_TAURI_EVENT_REORDER_BUFFER + 3; seq += 1) {
      buffer.accept(makeStreamEvent({ sequence: seq }));
    }
    expect(buffer.getLastSequence()).toBe(GRPC_TAURI_EVENT_REORDER_BUFFER + 3);
  });

  it('GrpcTauriEventSequenceBuffer rejects stale sequences', () => {
    const buffer = new GrpcTauriEventSequenceBuffer(5);
    expect(buffer.accept(makeStreamEvent({ sequence: 5 }))).toEqual([]);
    expect(buffer.accept(makeStreamEvent({ sequence: 3 }))).toEqual([]);
    expect(buffer.getLastSequence()).toBe(5);
  });

  it('GrpcTauriEventSequenceBuffer trims oldest holes when pending exceeds reorder buffer', () => {
    const buffer = new GrpcTauriEventSequenceBuffer(0);
    const pending = (buffer as unknown as { pending: Map<number, GrpcStreamEvent> }).pending;
    for (let i = 0; i < GRPC_TAURI_EVENT_REORDER_BUFFER + 4; i += 1) {
      const sequence = 2 + i * 2;
      pending.set(sequence, makeStreamEvent({ sequence }));
    }
    const released = buffer.accept(makeStreamEvent({ sequence: 10_000 }));
    expect(released[0]?.sequence).toBe(2);
    expect(pending.size).toBeLessThanOrEqual(GRPC_TAURI_EVENT_REORDER_BUFFER);
    expect(pending.has(2)).toBe(false);
  });

  it('GrpcTauriEventSequenceBuffer leaves stale pending when earliest is not ahead of cursor', () => {
    const buffer = new GrpcTauriEventSequenceBuffer(5);
    const pending = (buffer as unknown as { pending: Map<number, GrpcStreamEvent> }).pending;
    pending.set(3, makeStreamEvent({ sequence: 3 }));
    const released = buffer.accept(makeStreamEvent({ sequence: 7 }));
    expect(released).toEqual([]);
    expect(pending.has(3)).toBe(true);
    expect(pending.has(7)).toBe(true);
    expect(buffer.getLastSequence()).toBe(5);
  });

  it('GrpcTauriEventSequenceBuffer recovers when initial sequence is missed', () => {
    const buffer = new GrpcTauriEventSequenceBuffer(0);
    const released = buffer.accept(makeStreamEvent({ sequence: 2 }));
    expect(released).toHaveLength(1);
    expect(released[0]?.sequence).toBe(2);
    expect(buffer.getLastSequence()).toBe(2);
  });

  it('listenGrpcTauriStreamEvents forwards accepted events and reports schema mismatch', async () => {
    const unlisten = vi.fn();
    listenMock.mockResolvedValue(unlisten);

    const onEvent = vi.fn();
    const onError = vi.fn();
    const handle = await listenGrpcTauriStreamEvents({
      tabId: 'tab-a',
      streamId: 'stream-1',
      requestId: 'req-1',
      onEvent,
      onError,
      resolveLastSequence: () => 0,
    });

    const handler = listenMock.mock.calls[0]?.[1] as ((payload: { payload: GrpcTauriEvent }) => void) | undefined;
    expect(handler).toBeTypeOf('function');
    expect(retainHeartbeatMock).toHaveBeenCalledWith('tab-a');

    handler?.({ payload: makeEvent({ schemaVersion: 999, sequence: 1 }) });
    expect(onError).toHaveBeenCalledWith('Native gRPC event schema version mismatch');
    expect(onEvent).not.toHaveBeenCalled();

    handler?.({ payload: makeEvent({ sequence: 1 }) });
    expect(onEvent).toHaveBeenCalledTimes(1);

    handle.dispose();
    expect(unlisten).toHaveBeenCalled();
  });

  it('listenGrpcTauriStreamEvents rolls back listen when native attach fails', async () => {
    const unlisten = vi.fn();
    listenMock.mockResolvedValue(unlisten);
    attachMock.mockRejectedValueOnce(new Error('attach failed'));

    await expect(listenGrpcTauriStreamEvents({
      tabId: 'tab-a',
      streamId: 'stream-1',
      onEvent: vi.fn(),
    })).rejects.toThrow('attach failed');

    expect(unlisten).toHaveBeenCalled();
    expect(detachMock).not.toHaveBeenCalled();
    expect(retainHeartbeatMock).not.toHaveBeenCalled();
  });

  it('listenGrpcTauriStreamEvents ignores cross-stream events', async () => {
    listenMock.mockResolvedValue(vi.fn());

    const onEvent = vi.fn();
    await listenGrpcTauriStreamEvents({
      tabId: 'tab-a',
      streamId: 'stream-1',
      onEvent,
    });
    const handler = listenMock.mock.calls[0]?.[1] as ((payload: { payload: GrpcTauriEvent }) => void) | undefined;
    handler?.({ payload: makeEvent({ streamId: 'other', sequence: 1 }) });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('listenGrpcTauriStreamEvents ignores events for a different requestId', async () => {
    listenMock.mockResolvedValue(vi.fn());
    const onEvent = vi.fn();
    await listenGrpcTauriStreamEvents({
      tabId: 'tab-a',
      streamId: 'stream-1',
      requestId: 'req-1',
      onEvent,
    });
    const handler = listenMock.mock.calls[0]?.[1] as ((payload: { payload: GrpcTauriEvent }) => void) | undefined;
    handler?.({ payload: makeEvent({ requestId: 'req-other', sequence: 1 }) });
    expect(onEvent).not.toHaveBeenCalled();
    handler?.({ payload: makeEvent({ requestId: 'req-1', sequence: 1 }) });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});

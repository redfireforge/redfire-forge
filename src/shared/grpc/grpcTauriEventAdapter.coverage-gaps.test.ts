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

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

vi.mock('./grpcNativeTauriLifecycle', () => ({
  invokeGrpcTabEventsAttachNative: (...args: unknown[]) => attachMock(...args),
  invokeGrpcTabEventsDetachNative: (...args: unknown[]) => detachMock(...args),
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
    attachMock.mockResolvedValue(undefined);
    detachMock.mockResolvedValue(undefined);
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
    expect(buffer.getLastSequence()).toBe(0);
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
});

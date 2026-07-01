import { describe, expect, it, vi } from 'vitest';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import { cancelGrpcStream } from '../../../shared/grpc/grpcStreamClient';
import {
  bindGrpcStreamTransportForTab,
  hasGrpcStreamTransportBinding,
  resetGrpcStreamTransportBindingsForTests,
} from '../../../shared/grpc/grpcTransportFallback';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import {
  abortTabActiveStream,
  bumpStreamGeneration,
  canCancelStreamCall,
  detachStreamEventsForTab,
  detachStreamEventsWhenSwitchingActiveTab,
  isStreamNotFoundSseError,
  buildStreamEventErrorBody,
  buildStreamValidationErrorBody,
  streamErrorFromCaught,
  streamTerminalLifecycleFromGrpcEnd,
  tabAwaitingStreamEvents,
  tabHasActiveStream,
} from './grpcStreamSessionHelpers';

vi.mock('../../../shared/grpc/grpcStreamClient', () => ({
  cancelGrpcStream: vi.fn(() => Promise.resolve()),
}));

function makeTab(overrides: Partial<GrpcStudioTabState> = {}): GrpcStudioTabState {
  return {
    id: 'tab-1',
    title: 'Tab 1',
    target: 'localhost:50051',
    tlsMode: 'plaintext',
    lifecycle: 'idle',
    streamLifecycle: 'idle',
    streamMessages: [],
    lastSequence: 0,
    body: {},
    metadata: {},
    requestMode: 'form',
    ...overrides,
  } as GrpcStudioTabState;
}

describe('grpcStreamSessionHelpers', () => {
  beforeEach(() => {
    resetGrpcStreamTransportBindingsForTests();
  });

  it('tabHasActiveStream detects in-flight lifecycles', () => {
    expect(tabHasActiveStream(makeTab({ streamLifecycle: 'idle' }))).toBe(false);
    expect(tabHasActiveStream(makeTab({ streamLifecycle: 'streaming' }))).toBe(true);
    expect(tabHasActiveStream(makeTab({ streamLifecycle: 'ending' }))).toBe(true);
  });

  it('tabAwaitingStreamEvents requires active stream id and lifecycle', () => {
    expect(tabAwaitingStreamEvents(makeTab())).toBe(false);
    expect(tabAwaitingStreamEvents(makeTab({
      activeStreamId: 's-1',
      streamLifecycle: 'streaming',
    }))).toBe(true);
    expect(tabAwaitingStreamEvents(makeTab({
      activeStreamId: 's-1',
      streamLifecycle: 'ended',
    }))).toBe(false);
  });

  it('bumpStreamGeneration increments per tab', () => {
    const ref = { current: {} as Record<string, number> };
    bumpStreamGeneration(ref, 'a');
    bumpStreamGeneration(ref, 'a');
    bumpStreamGeneration(ref, 'b');
    expect(ref.current).toEqual({ a: 2, b: 1 });
  });

  it('canCancelStreamCall respects terminal and in-flight states', () => {
    expect(canCancelStreamCall(makeTab({ streamLifecycle: 'ended' }))).toBe(false);
    expect(canCancelStreamCall(makeTab({ streamLifecycle: 'streaming' }))).toBe(true);
    expect(canCancelStreamCall(makeTab({
      streamLifecycle: 'idle',
      activeStreamId: 's-1',
    }))).toBe(true);
  });

  it('streamTerminalLifecycleFromGrpcEnd maps gRPC status codes', () => {
    expect(streamTerminalLifecycleFromGrpcEnd(0)).toBe('ended');
    expect(streamTerminalLifecycleFromGrpcEnd(undefined)).toBe('ended');
    expect(streamTerminalLifecycleFromGrpcEnd(1)).toBe('cancelled');
    expect(streamTerminalLifecycleFromGrpcEnd(13)).toBe('error');
  });

  it('buildStreamEventErrorBody preserves grpcStatus 7 for PERMISSION_DENIED hints (Phase 4G)', () => {
    const error = buildStreamEventErrorBody('Access denied', 7);
    expect((error.details as { grpcStatus?: number })?.grpcStatus).toBe(7);
  });

  it('buildStreamEventErrorBody maps TLS failures into details (Phase 4G)', () => {
    const error = buildStreamEventErrorBody('certificate has expired');
    expect((error.details as { tlsFailure?: string })?.tlsFailure).toBe('expired_cert');
  });

  it('buildStreamValidationErrorBody returns validation category (Phase 9I)', () => {
    const error = buildStreamValidationErrorBody('Cannot send stream message without an active execute snapshot');
    expect(error.category).toBe('validation');
    expect(error.code).toBe('GRPC_INVALID_REQUEST');
  });

  it('streamErrorFromCaught preserves GrpcApiClientError envelope details (Phase 4G)', () => {
    const clientError = new GrpcApiClientError('stream_start', 'Access denied', {
      code: 'GRPC_CALL_FAILED',
      category: 'call_failed',
      details: { grpcStatus: 7 },
    });
    expect(streamErrorFromCaught(clientError, 'Stream start failed').details).toEqual({ grpcStatus: 7 });
    expect(streamErrorFromCaught(new Error('network down'), 'Stream start failed').message).toMatch(/network down/i);
  });

  it('isStreamNotFoundSseError matches common SSE error text', () => {
    expect(isStreamNotFoundSseError('No active stream for id')).toBe(true);
    expect(isStreamNotFoundSseError('404 Not Found')).toBe(true);
    expect(isStreamNotFoundSseError('connection reset')).toBe(false);
  });

  it('detachStreamEventsForTab invokes dispose and clears ref', () => {
    const dispose = vi.fn();
    const ref = { current: { 'tab-1': dispose } };
    detachStreamEventsForTab(ref, 'tab-1');
    expect(dispose).toHaveBeenCalledOnce();
    expect(ref.current['tab-1']).toBeUndefined();
  });

  it('detachStreamEventsWhenSwitchingActiveTab only detaches previous tab', () => {
    const dispose = vi.fn();
    const ref = { current: { prev: dispose } };
    detachStreamEventsWhenSwitchingActiveTab(ref, undefined);
    expect(dispose).not.toHaveBeenCalled();
    detachStreamEventsWhenSwitchingActiveTab(ref, 'prev');
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('abortTabActiveStream cancels server stream and bumps generation', () => {
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    const dispose = vi.fn();
    streamDisposeRef.current['tab-1'] = dispose;

    abortTabActiveStream(
      'tab-1',
      makeTab({ streamLifecycle: 'streaming', activeStreamId: 'stream-abc' }),
      streamGenerationRef,
      streamDisposeRef,
    );

    expect(streamGenerationRef.current['tab-1']).toBe(1);
    expect(dispose).toHaveBeenCalledOnce();
    expect(cancelGrpcStream).toHaveBeenCalledWith('stream-abc', 'tab-1');
  });

  it('abortTabActiveStream cancels server stream before clearing transport binding', async () => {
    bindGrpcStreamTransportForTab('tab-1', 'tauri');
    vi.mocked(cancelGrpcStream).mockImplementationOnce(async () => {
      expect(hasGrpcStreamTransportBinding('tab-1')).toBe(true);
      return {
        ok: true,
        op: 'stream_cancel',
        data: { streamId: 'stream-abc', cancelled: true },
        meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-1' },
      };
    });

    abortTabActiveStream(
      'tab-1',
      makeTab({ streamLifecycle: 'streaming', activeStreamId: 'stream-abc' }),
      { current: {} },
      { current: {} },
    );

    expect(hasGrpcStreamTransportBinding('tab-1')).toBe(true);
    await vi.waitFor(() => {
      expect(hasGrpcStreamTransportBinding('tab-1')).toBe(false);
    });
    expect(cancelGrpcStream).toHaveBeenCalledWith('stream-abc', 'tab-1');
  });

  it('abortTabActiveStream clears stream transport binding after cancel (Phase 7F)', async () => {
    bindGrpcStreamTransportForTab('tab-1', 'tauri');
    expect(hasGrpcStreamTransportBinding('tab-1')).toBe(true);

    abortTabActiveStream(
      'tab-1',
      makeTab({ streamLifecycle: 'streaming', activeStreamId: 'stream-abc' }),
      { current: {} },
      { current: {} },
    );

    await vi.waitFor(() => {
      expect(hasGrpcStreamTransportBinding('tab-1')).toBe(false);
    });
  });
});

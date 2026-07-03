import { describe, expect, it, vi } from 'vitest';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import {
  abortTabActiveStream,
  buildStreamEventErrorBody,
  bumpStreamGeneration,
  canCancelStreamCall,
  detachStreamEventsForTab,
  detachStreamEventsWhenSwitchingActiveTab,
  isStreamNotFoundSseError,
  streamTerminalLifecycleFromGrpcEnd,
  streamErrorFromCaught,
  tabAwaitingStreamEvents,
} from './grpcStreamSessionHelpers';

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

describe('grpcStreamSessionHelpers coverage gaps', () => {
  it('tabAwaitingStreamEvents is true while stream is ending', () => {
    expect(tabAwaitingStreamEvents(makeTab({
      activeStreamId: 's-1',
      streamLifecycle: 'ending',
    }))).toBe(true);
  });

  it('abortTabActiveStream is a no-op when stream is idle without activeStreamId', () => {
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    abortTabActiveStream('tab-1', makeTab(), streamGenerationRef, streamDisposeRef);
    expect(streamGenerationRef.current['tab-1']).toBeUndefined();
  });

  it('buildStreamEventErrorBody omits empty details object', () => {
    const body = buildStreamEventErrorBody('generic failure');
    expect(body.details).toBeUndefined();
  });

  it('streamErrorFromCaught classifies plain Error via message', () => {
    const body = streamErrorFromCaught(new Error('network down'), 'fallback');
    expect(body.message).toMatch(/network down/i);
  });

  it('streamErrorFromCaught uses fallback message for unknown error shapes', () => {
    const body = streamErrorFromCaught({ code: 1 }, 'Stream failed');
    expect(body.message).toBe('Stream failed');
  });

  it('abortTabActiveStream cancels when activeStreamId exists on idle lifecycle', () => {
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    abortTabActiveStream(
      'tab-1',
      makeTab({ streamLifecycle: 'idle', activeStreamId: 'stream-only' }),
      streamGenerationRef,
      streamDisposeRef,
    );
    expect(streamGenerationRef.current['tab-1']).toBe(1);
  });

  it('detachStreamEventsForTab invokes and removes dispose handler', () => {
    const dispose = vi.fn();
    const streamDisposeRef = { current: { 'tab-1': dispose } as Record<string, () => void> };
    detachStreamEventsForTab(streamDisposeRef, 'tab-1');
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(streamDisposeRef.current['tab-1']).toBeUndefined();
  });

  it('tabAwaitingStreamEvents is false for active stream ids in non-waiting states', () => {
    expect(tabAwaitingStreamEvents(makeTab({ activeStreamId: 's-1', streamLifecycle: 'starting' }))).toBe(false);
    expect(tabAwaitingStreamEvents(makeTab({ activeStreamId: 's-1', streamLifecycle: 'cancelled' }))).toBe(false);
  });

  it('bumpStreamGeneration increments an existing generation counter', () => {
    const ref = { current: { 'tab-1': 5 } as Record<string, number> };
    bumpStreamGeneration(ref, 'tab-1');
    expect(ref.current['tab-1']).toBe(6);
  });

  it('canCancelStreamCall returns false for terminal lifecycle even with active stream id', () => {
    expect(canCancelStreamCall(makeTab({ streamLifecycle: 'error', activeStreamId: 's-1' }))).toBe(false);
  });

  it('detachStreamEventsWhenSwitchingActiveTab ignores missing previous ids', () => {
    const dispose = vi.fn();
    const ref = { current: { other: dispose } as Record<string, () => void> };
    detachStreamEventsWhenSwitchingActiveTab(ref, 'missing');
    expect(dispose).not.toHaveBeenCalled();
  });

  it('streamTerminalLifecycleFromGrpcEnd maps unknown status codes to error', () => {
    expect(streamTerminalLifecycleFromGrpcEnd(42)).toBe('error');
  });

  it('isStreamNotFoundSseError matches request-not-found phrasing', () => {
    expect(isStreamNotFoundSseError('REQUEST_NOT_FOUND from SSE bridge')).toBe(true);
  });

  it('abortTabActiveStream clears transport binding when stream is in-flight without stream id', () => {
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    abortTabActiveStream(
      'tab-1',
      makeTab({ streamLifecycle: 'starting', activeStreamId: undefined }),
      streamGenerationRef,
      streamDisposeRef,
    );
    expect(streamGenerationRef.current['tab-1']).toBe(1);
  });
});

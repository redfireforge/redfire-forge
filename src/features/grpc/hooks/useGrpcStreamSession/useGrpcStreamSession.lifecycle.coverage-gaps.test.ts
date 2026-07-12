/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES, type GrpcStreamEvent } from '../../../../shared/grpc/contracts';
import { GrpcApiClientError } from '../../../../shared/grpc/grpcApiClient';
import * as grpcStreamClient from '../../../../shared/grpc/grpcStreamClient';
import { FIXTURE_DESCRIPTOR, FIXTURE_SERVER_STREAM_START_REQUEST } from '../../../../shared/grpc/contractFixtures';
import * as callHistoryCapture from '../../utils/grpcStudioCallHistoryCapture';
import { createInitialSessionState } from '../grpcStudioSessionHelpers';
import { useGrpcStreamSession } from '../useGrpcStreamSession';
import {
  makeHarness,
  minimalStreamExecuteSnapshot,
  setupUseGrpcStreamSessionCoverageGapsTest,
} from './useGrpcStreamSessionCoverageGaps.testHelpers';

vi.mock('../../utils/grpcStudioCallHistoryCapture', () => ({
  captureGrpcCallHistoryFromOutcome: vi.fn(),
  captureGrpcCallHistoryFromStreamTerminal: vi.fn(),
}));

vi.mock('../../../../shared/grpc/grpcStreamClient', async () => {
  const actual = await vi.importActual<typeof grpcStreamClient>('../../../../shared/grpc/grpcStreamClient');
  return {
    ...actual,
    startGrpcStream: vi.fn(),
    openGrpcStreamEvents: vi.fn(() => vi.fn()),
    cancelGrpcStream: vi.fn(),
    sendGrpcStreamMessage: vi.fn(),
    endGrpcStream: vi.fn(),
  };
});

describe('useGrpcStreamSession coverage gaps — lifecycle and history', () => {
  beforeEach(() => {
    setupUseGrpcStreamSessionCoverageGapsTest();
  });

  it('aborts pending unary before starting a new stream', async () => {
    const onCancelInFlight = vi.fn();
    const session = createInitialSessionState();
    const sessionRef = { current: session };
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    const callGenerationRef = { current: {} as Record<string, number> };
    const inFlightCallRef = { current: { [session.activeTabId]: 'req-unary' } };
    const tabId = session.activeTabId;
    const prepareExecuteSnapshot = vi.fn(() => ({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming' as const,
    }));

    const hook = renderHook(() => useGrpcStreamSession({
      sessionRef,
      streamGenerationRef,
      streamDisposeRef,
      callGenerationRef,
      inFlightCallRef,
      commitSession: vi.fn((next) => next),
      setSession: vi.fn(),
      updateTab: vi.fn((id, patch) => {
        sessionRef.current = {
          ...sessionRef.current,
          tabs: sessionRef.current.tabs.map((tab) => (
            tab.id === id ? { ...tab, ...patch } : tab
          )),
        };
      }),
      prepareExecuteSnapshot,
      onCancelInFlight,
    }));

    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      lifecycle: 'calling',
    };
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalled();
  });

  it('endStreamCall transitions to ending on success', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };

    await act(async () => {
      await harness.hook.result.current.endStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('ending');
    expect(grpcStreamClient.endGrpcStream).toHaveBeenCalledWith('stream-1', tabId);
  });

  it('records successful grpc-end lifecycle without stream error', () => {
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
    };
    streamDisposeRef.current[tabId] = vi.fn();
    streamGenerationRef.current[tabId] = 1;

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-end',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        status: 0,
        statusMessage: 'OK',
        data: { message: 'done' },
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('ended');
    expect(sessionRef.current.tabs[0]?.streamError).toBeUndefined();
    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(1);
  });

  it('ignores grpc-message events when tab lifecycle is terminal', () => {
    const { hook, tabId, sessionRef, setSession } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'ended',
      streamMessages: [],
      lastSequence: 0,
    };

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        direction: 'inbound',
        data: { message: 'late' },
      } as GrpcStreamEvent, () => false);
    });

    expect(setSession).not.toHaveBeenCalled();
  });

  it('ignores SSE onError when stream generation is stale', async () => {
    let streamHandlers: { onError?: (message: string) => void } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, streamGenerationRef, updateTab } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    streamGenerationRef.current[tabId] = 99;
    updateTab.mockClear();

    act(() => {
      streamHandlers.onError?.('stale failure');
    });

    expect(updateTab).not.toHaveBeenCalled();
  });

  it('captures call history when grpc-end succeeds with execute snapshot', () => {
    const snapshot = {
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId: 'tab-1',
      callType: 'server_streaming' as const,
    };
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
      lastExecuteSnapshot: snapshot,
    };
    streamDisposeRef.current[tabId] = vi.fn();
    streamGenerationRef.current[tabId] = 1;

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-end',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        status: 0,
        statusMessage: 'OK',
        data: { message: 'done' },
      } as GrpcStreamEvent, () => false);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ lastExecuteSnapshot: snapshot }),
      expect.objectContaining({
        result: expect.objectContaining({ status: 0, callType: 'server_streaming' }),
      }),
    );
  });

  it('captures call history when grpc-error arrives with execute snapshot', () => {
    const snapshot = {
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId: 'tab-1',
      callType: 'server_streaming' as const,
    };
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      lastExecuteSnapshot: snapshot,
    };
    streamDisposeRef.current[tabId] = vi.fn();
    streamGenerationRef.current[tabId] = 1;

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-error',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 3,
        timestamp: '2026-01-01T00:00:02.000Z',
        status: 13,
        statusMessage: 'INTERNAL',
      } as GrpcStreamEvent, () => false);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ lastExecuteSnapshot: snapshot }),
      expect.objectContaining({
        error: expect.objectContaining({ message: 'INTERNAL' }),
      }),
    );
  });

  it('successfully sends a stream message without changing lifecycle', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: 'hi' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId),
    };
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockResolvedValue(undefined);

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId);
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).toHaveBeenCalledWith(
      'stream-1',
      tabId,
      expect.objectContaining({ body: { message: 'hi' } }),
    );
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('streaming');
  });

  it('sendStreamMessageCall deep-interpolates templated body with frozen env (Phase 9I)', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: '{{greeting}}' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId, { greeting: 'from-frozen-env' }),
    };
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockResolvedValue(undefined);

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId);
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).toHaveBeenCalledWith(
      'stream-1',
      tabId,
      expect.objectContaining({ body: { message: 'from-frozen-env' } }),
    );
  });

  it('sendStreamMessageCall marks validation error when execute snapshot env is missing (Phase 9I)', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: '{{greeting}}' },
      lastExecuteSnapshot: undefined,
    };

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId);
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).not.toHaveBeenCalled();
    expect(grpcStreamClient.cancelGrpcStream).toHaveBeenCalledWith('stream-1', tabId);
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.streamError?.message).toMatch(/execute snapshot/i);
    expect(sessionRef.current.tabs[0]?.streamError?.category).toBe('validation');
  });

  it('sendStreamMessageCall marks validation error for unresolved body templates (Phase 9I)', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: '{{missing}}' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId, {}),
    };

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId);
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).not.toHaveBeenCalled();
    expect(grpcStreamClient.cancelGrpcStream).toHaveBeenCalledWith('stream-1', tabId);
    expect(sessionRef.current.tabs[0]?.streamError?.category).toBe('validation');
    expect(sessionRef.current.tabs[0]?.streamError?.message).toMatch(/unresolved template variables/i);
  });

  it('uses resolveLastSequence from SSE attachment for replay cursor', async () => {
    let streamHandlers: {
      resolveLastSequence?: () => number;
      onEvent?: (event: GrpcStreamEvent) => void;
    } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
      lastSequence: 4,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      lastSequence: 9,
    };
    expect(streamHandlers.resolveLastSequence?.()).toBe(9);
  });

  it('captures call history when stream start fails after snapshot preparation', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
    };
    const snapshot = {
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming' as const,
    };
    prepareExecuteSnapshot.mockReturnValue(snapshot);
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      new GrpcApiClientError('stream_start', 'refused', { code: GRPC_ERROR_CODES.CALL_FAILED }),
    );

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot,
        error: expect.objectContaining({ message: 'refused' }),
      }),
    );
  });

  it('routes SSE onEvent through attached stream handler', () => {
    let streamHandlers: { onEvent?: (event: GrpcStreamEvent) => void } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      streamMessages: [],
      lastSequence: 0,
    };

    act(() => {
      harness.hook.result.current.attachStreamEventsForTab(tabId);
    });

    act(() => {
      streamHandlers.onEvent?.({
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        direction: 'inbound',
        data: { message: 'via-sse' },
      } as GrpcStreamEvent);
    });

    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(1);
  });

  it('captures call history when cancelling an active stream with snapshot', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    const snapshot = {
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming' as const,
    };
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      lastExecuteSnapshot: snapshot,
    };

    await act(async () => {
      await harness.hook.result.current.cancelStreamCall(tabId);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ lastExecuteSnapshot: snapshot }),
      undefined,
    );
  });

  it('captures call history when SSE reports stream-not-found during ending lifecycle', async () => {
    let streamHandlers: { onError?: (message: string) => void } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    const snapshot = {
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming' as const,
    };
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'ending',
      lastExecuteSnapshot: snapshot,
    };

    act(() => {
      streamHandlers.onError?.('No active stream for id');
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).toHaveBeenCalled();
  });

  it('captures terminal error history when grpc-end returns non-zero status', () => {
    const snapshot = {
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId: 'tab-1',
      callType: 'server_streaming' as const,
    };
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
      lastExecuteSnapshot: snapshot,
    };
    streamDisposeRef.current[tabId] = vi.fn();
    streamGenerationRef.current[tabId] = 1;

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-end',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        status: 13,
        statusMessage: 'INTERNAL',
      } as GrpcStreamEvent, () => false);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ lastExecuteSnapshot: snapshot }),
      expect.objectContaining({
        error: expect.objectContaining({ message: 'INTERNAL' }),
      }),
    );
  });

  it('ignores stale stream events', () => {
    const { hook, tabId, setSession } = makeHarness();
    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        direction: 'inbound',
        data: { message: 'late' },
      } as GrpcStreamEvent, () => true);
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('ignores grpc-end events when tab lifecycle is already terminal', () => {
    const { hook, tabId, sessionRef, setSession } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'ended',
    };
    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-end',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        status: 0,
        statusMessage: 'OK',
      } as GrpcStreamEvent, () => false);
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('skips duplicate grpc-message sequences', () => {
    const { hook, tabId, sessionRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [{
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        direction: 'inbound',
        data: { message: 'first' },
      }],
      lastSequence: 1,
    };
    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:01.000Z',
        direction: 'inbound',
        data: { message: 'dup' },
      } as GrpcStreamEvent, () => false);
    });
    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(1);
  });

  it('appends grpc-end payload data to the stream log', () => {
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
    };
    streamDisposeRef.current[tabId] = vi.fn();
    streamGenerationRef.current[tabId] = 1;

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-end',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        status: 0,
        statusMessage: 'OK',
        data: { message: 'final' },
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(1);
  });

  it('uses fallback status text when grpc-end omits statusMessage', () => {
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
    };
    streamDisposeRef.current[tabId] = vi.fn();
    streamGenerationRef.current[tabId] = 1;

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-end',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        status: 13,
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamError?.message).toMatch(/Stream ended with status/i);
  });

  it('ignores stale stream start validation failures', async () => {
    const harness = makeHarness();
    const { tabId, prepareExecuteSnapshot, streamGenerationRef, updateTab } = harness;
    prepareExecuteSnapshot.mockImplementation(() => {
      streamGenerationRef.current[tabId] = 99;
      throw new Error('invalid body');
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
    }));
  });

  it('ignores stale unary rejection during stream start', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, streamGenerationRef, updateTab } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockImplementation(() => {
      streamGenerationRef.current[tabId] = 99;
      return {
        tabId,
        requestId: 'req-unary',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        timeoutMs: 30000,
      };
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
    }));
  });

  it('cancels server stream when start succeeds for a stale generation', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, streamGenerationRef } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming',
    });
    let resolveStart: (value: Awaited<ReturnType<typeof grpcStreamClient.startGrpcStream>>) => void = () => undefined;
    vi.mocked(grpcStreamClient.startGrpcStream).mockImplementation(
      () => new Promise((resolve) => {
        resolveStart = resolve;
      }),
    );

    const pending = act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });
    streamGenerationRef.current[tabId] = 99;
    resolveStart({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-stale', requestId: 'req-stale' },
      meta: { requestId: 'req-stale', timestamp: '2026-01-01T00:00:00.000Z' },
    });
    await pending;

    expect(grpcStreamClient.cancelGrpcStream).toHaveBeenCalledWith('stream-stale', tabId);
  });

  it('marks stream error when SSE onError fires during streaming', async () => {
    let streamHandlers: { onError?: (message: string) => void } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    act(() => {
      streamHandlers.onError?.('connection reset');
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
  });

  it('ignores grpc-message events that cannot be converted to log entries', () => {
    const { hook, tabId, sessionRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
    };

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(0);
  });
});

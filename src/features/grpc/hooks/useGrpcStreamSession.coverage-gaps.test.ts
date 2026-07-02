/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES, type GrpcStreamEvent } from '../../../shared/grpc/contracts';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import { GrpcNativeTauriStreamTransportError } from '../../../shared/grpc/grpcNativeTauriStreamTransport';
import * as grpcStreamClient from '../../../shared/grpc/grpcStreamClient';
import { FIXTURE_DESCRIPTOR, FIXTURE_SERVER_STREAM_START_REQUEST } from '../../../shared/grpc/contractFixtures';
import { createGrpcInterpolationEnvSnapshotFromMap } from '../../../shared/grpc/grpcInterpolationEnvSnapshot';
import * as callHistoryCapture from '../utils/grpcStudioCallHistoryCapture';
import * as grpcStudioExecuteInterpolation from '../../../shared/grpc/grpcStudioExecuteInterpolation';
import * as transportRouter from '../../../shared/grpc/grpcBrowserTransportRouter';
import { createInitialSessionState } from './grpcStudioSessionHelpers';
import { useGrpcStreamSession } from './useGrpcStreamSession';

vi.mock('../utils/grpcStudioCallHistoryCapture', () => ({
  captureGrpcCallHistoryFromOutcome: vi.fn(),
  captureGrpcCallHistoryFromStreamTerminal: vi.fn(),
}));

vi.mock('../../../shared/grpc/grpcStreamClient', async () => {
  const actual = await vi.importActual<typeof grpcStreamClient>('../../../shared/grpc/grpcStreamClient');
  return {
    ...actual,
    startGrpcStream: vi.fn(),
    openGrpcStreamEvents: vi.fn(() => vi.fn()),
    cancelGrpcStream: vi.fn(),
    sendGrpcStreamMessage: vi.fn(),
    endGrpcStream: vi.fn(),
  };
});

function minimalStreamExecuteSnapshot(
  tabId: string,
  env: Record<string, string> = {},
) {
  return {
    tabId,
    requestId: 'req-stream',
    capturedAt: new Date().toISOString(),
    target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
    service: FIXTURE_SERVER_STREAM_START_REQUEST.service,
    method: FIXTURE_SERVER_STREAM_START_REQUEST.method,
    body: {},
    metadata: {},
    timeoutMs: 10_000,
    descriptorKey: FIXTURE_DESCRIPTOR.key,
    callType: 'server_streaming' as const,
    interpolationEnv: createGrpcInterpolationEnvSnapshotFromMap(env),
  };
}

describe('useGrpcStreamSession coverage gaps', () => {
  beforeEach(() => {
    vi.mocked(grpcStreamClient.startGrpcStream).mockReset();
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockReset();
    vi.mocked(grpcStreamClient.cancelGrpcStream).mockReset();
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockReset();
    vi.mocked(grpcStreamClient.endGrpcStream).mockReset();
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockReturnValue(vi.fn());
    vi.mocked(grpcStreamClient.cancelGrpcStream).mockResolvedValue(undefined);
    vi.mocked(grpcStreamClient.endGrpcStream).mockResolvedValue(undefined);
    vi.mocked(callHistoryCapture.captureGrpcCallHistoryFromOutcome).mockReset();
    vi.mocked(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).mockReset();
  });
  function makeHarness() {
    const session = createInitialSessionState();
    const sessionRef = { current: session };
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    const callGenerationRef = { current: {} as Record<string, number> };
    const inFlightCallRef = { current: {} as Record<string, string> };
    const tabId = session.activeTabId;

    const commitSession = vi.fn((next: typeof session) => {
      sessionRef.current = next;
      return next;
    });
    const setSession = vi.fn((updater: typeof session | ((prev: typeof session) => typeof session)) => {
      sessionRef.current = typeof updater === 'function'
        ? updater(sessionRef.current)
        : updater;
    });
    const updateTab = vi.fn((id: string, patch: Record<string, unknown>) => {
      sessionRef.current = {
        ...sessionRef.current,
        tabs: sessionRef.current.tabs.map((tab) => (
          tab.id === id ? { ...tab, ...patch } : tab
        )),
      };
    });
    const prepareExecuteSnapshot = vi.fn(() => {
      throw new Error('missing method binding');
    });

    const hook = renderHook(() => useGrpcStreamSession({
      sessionRef,
      streamGenerationRef,
      streamDisposeRef,
      callGenerationRef,
      inFlightCallRef,
      commitSession,
      setSession,
      updateTab,
      prepareExecuteSnapshot,
    }));

    return {
      hook,
      tabId,
      sessionRef,
      streamGenerationRef,
      streamDisposeRef,
      updateTab,
      prepareExecuteSnapshot,
      setSession,
    };
  }

  it('ignores grpc-end events after terminal lifecycle', () => {
    const { hook, tabId, sessionRef, setSession } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'ended',
    };

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-end',
        streamId: 's1',
        requestId: 'r1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        status: 0,
        statusMessage: 'OK',
      } as GrpcStreamEvent, () => false);
    });

    expect(setSession).not.toHaveBeenCalled();
  });

  it('records grpc-end terminal data and grpc-error lifecycle', () => {
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
        statusMessage: 'INTERNAL',
        data: { message: 'final' },
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(1);

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-error',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 3,
        timestamp: '2026-01-01T00:00:02.000Z',
        statusMessage: 'boom',
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
  });

  it('marks validation errors when prepareExecuteSnapshot fails', async () => {
    const { hook, tabId, updateTab } = makeHarness();

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
      streamError: expect.objectContaining({
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
      }),
    }));
  });

  it('clears stream log entries for a tab', () => {
    const { hook, tabId, updateTab } = makeHarness();

    act(() => {
      hook.result.current.clearStreamLog(tabId);
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, { streamMessages: [] });
  });

  it('starts a stream call and attaches SSE listeners', async () => {
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

    expect(grpcStreamClient.startGrpcStream).toHaveBeenCalled();
    expect(grpcStreamClient.openGrpcStreamEvents).toHaveBeenCalledWith(
      'stream-1',
      tabId,
      expect.any(Object),
    );
  });

  it('startStreamCall preserves client-streaming pending queue across session reset', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      service: 'echo.EchoService',
      method: 'ClientStream',
      target: 'localhost:50051',
      streamPendingBodies: [{ message: 'queued-a' }, { message: 'queued-b' }],
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...minimalStreamExecuteSnapshot(tabId),
      method: 'ClientStream',
      callType: 'client_streaming',
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

    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamPendingBodies: [{ message: 'queued-a' }, { message: 'queued-b' }],
    }));
    expect(sessionRef.current.tabs[0]!.streamPendingBodies).toEqual([
      { message: 'queued-a' },
      { message: 'queued-b' },
    ]);
  });

  it('cancels an active stream and calls server cancel endpoint', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };

    await act(async () => {
      await harness.hook.result.current.cancelStreamCall(tabId);
    });

    expect(grpcStreamClient.cancelGrpcStream).toHaveBeenCalledWith('stream-1', tabId);
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('cancelled');
  });

  it('marks stream error when sendStreamMessage fails', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: 'hi' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId),
    };
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockRejectedValue(
      new GrpcApiClientError('stream_send', 'send failed', { code: GRPC_ERROR_CODES.CALL_FAILED }),
    );

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
  });

  it('rejects startStreamCall for unary methods', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      tabId,
      requestId: 'req-unary',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      metadata: {},
      body: { message: 'hi' },
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
      streamError: expect.objectContaining({
        message: expect.stringMatching(/unary methods/i),
      }),
    }));
  });

  it('marks stream error when endStreamCall fails', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };
    vi.mocked(grpcStreamClient.endGrpcStream).mockRejectedValue(
      new GrpcApiClientError('stream_end', 'end failed', { code: GRPC_ERROR_CODES.CALL_FAILED }),
    );

    await act(async () => {
      await harness.hook.result.current.endStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.streamError?.message).toMatch(/end failed/i);
  });

  it('treats stream-not-found SSE errors as ended when lifecycle is ending', async () => {
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
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
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
    };

    act(() => {
      streamHandlers.onError?.('stream not found');
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('ended');
  });

  it('ignores SSE onError when stream lifecycle is already terminal', async () => {
    let streamHandlers: { onError?: (message: string) => void } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
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
      streamLifecycle: 'ended',
      streamError: undefined,
    };
    updateTab.mockClear();

    act(() => {
      streamHandlers.onError?.('stream not found');
      streamHandlers.onError?.('connection dropped');
    });

    expect(updateTab).not.toHaveBeenCalled();
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('ended');
  });

  it('marks stream error when SSE listener reports a failure while streaming', async () => {
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
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
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
      streamHandlers.onError?.('connection dropped');
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.streamError?.message).toBe('connection dropped');
  });

  it('no-ops when starting a stream on a tab that already has an active stream', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(grpcStreamClient.startGrpcStream).not.toHaveBeenCalled();
  });

  it('cancels orphan server stream when generation goes stale after start', async () => {
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
    vi.mocked(grpcStreamClient.startGrpcStream).mockImplementation(async () => {
      streamGenerationRef.current[tabId] = (streamGenerationRef.current[tabId] ?? 0) + 1;
      return {
        ok: true,
        op: 'stream_start',
        data: { streamId: 'orphan-stream', requestId: 'req-orphan' },
        meta: { requestId: 'req-orphan', timestamp: '2026-01-01T00:00:00.000Z' },
      };
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(grpcStreamClient.cancelGrpcStream).toHaveBeenCalledWith('orphan-stream', tabId);
  });

  it('records generic stream start failures', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(new Error('network down'));

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
      streamError: expect.objectContaining({ message: 'network down' }),
    }));
  });

  it('ignores stale grpc-message events and missing log entries', () => {
    const { hook, tabId, setSession } = makeHarness();

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        data: { message: 'late' },
      } as GrpcStreamEvent, () => true);
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('skips attachStreamEvents when tab is not awaiting SSE events', () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'idle',
      activeStreamId: undefined,
    };

    act(() => {
      harness.hook.result.current.attachStreamEventsForTab(tabId);
    });

    expect(grpcStreamClient.openGrpcStreamEvents).not.toHaveBeenCalled();
  });

  it('terminalizes ending SSE errors that are not stream-not-found', async () => {
    let streamHandlers: { onError?: (message: string) => void } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
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
    };
    updateTab.mockClear();

    act(() => {
      streamHandlers.onError?.('gateway timeout');
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
      activeStreamId: undefined,
      streamError: expect.objectContaining({ message: 'gateway timeout' }),
    }));
  });

  it('no-ops cancel, send, and end when stream preconditions are missing', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;

    await act(async () => {
      await harness.hook.result.current.cancelStreamCall(tabId);
      await harness.hook.result.current.sendStreamMessageCall(tabId);
      await harness.hook.result.current.endStreamCall(tabId);
    });

    expect(grpcStreamClient.cancelGrpcStream).not.toHaveBeenCalled();
    expect(grpcStreamClient.sendGrpcStreamMessage).not.toHaveBeenCalled();
    expect(grpcStreamClient.endGrpcStream).not.toHaveBeenCalled();
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('idle');
  });

  it('uses generic error text when sendStreamMessage throws a non-API error', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: 'hi' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId),
    };
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockRejectedValue('broken pipe');

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamError?.message).toBe('Send stream message failed');
  });

  it('uses generic error text when endStreamCall throws a non-API error', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };
    vi.mocked(grpcStreamClient.endGrpcStream).mockRejectedValue('broken pipe');

    await act(async () => {
      await harness.hook.result.current.endStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamError?.message).toBe('End stream failed');
  });

  it('records grpc-message events and attaches SSE when lifecycle is streaming', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, setSession } = harness;
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
    expect(grpcStreamClient.openGrpcStreamEvents).toHaveBeenCalled();

    act(() => {
      harness.hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        direction: 'inbound',
        data: { message: 'chunk' },
      } as GrpcStreamEvent, () => false);
    });
    expect(setSession).toHaveBeenCalled();
    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(1);
  });

  it('skips attachStreamEvents when dispose ref already exists', () => {
    const harness = makeHarness();
    const { tabId, sessionRef, streamDisposeRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };
    streamDisposeRef.current[tabId] = vi.fn();

    act(() => {
      harness.hook.result.current.attachStreamEventsForTab(tabId);
    });
    expect(grpcStreamClient.openGrpcStreamEvents).not.toHaveBeenCalled();
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

  it('returns zero from resolveLastSequence when tab is missing', async () => {
    let streamHandlers: { resolveLastSequence?: () => number } = {};
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

    sessionRef.current.tabs = [];
    expect(streamHandlers.resolveLastSequence?.()).toBe(0);
  });

  it('uses generic validation text when prepareExecuteSnapshot throws a non-Error', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    prepareExecuteSnapshot.mockImplementation(() => {
      throw 'bad snapshot';
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamError?.message).toBe('Cannot start stream');
  });

  it('ignores stale stream start failures after the server rejects the call', async () => {
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
    vi.mocked(grpcStreamClient.startGrpcStream).mockImplementation(async () => {
      streamGenerationRef.current[tabId] = 99;
      throw new GrpcApiClientError('stream_start', 'refused', { code: GRPC_ERROR_CODES.CALL_FAILED });
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
    }));
  });

  it('no-ops startStreamCall when a stream is already active', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-existing',
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming',
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(grpcStreamClient.startGrpcStream).not.toHaveBeenCalled();
  });

  it('uses fallback stream request ids when crypto randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
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

    expect(prepareExecuteSnapshot).toHaveBeenCalledWith(
      tabId,
      expect.stringMatching(/^req-stream-/),
      undefined,
    );
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  });

  it('captures successful stream results on grpc-end with execute snapshot', () => {
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
      } as GrpcStreamEvent, () => false);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ lastExecuteSnapshot: snapshot }),
      expect.objectContaining({
        result: expect.objectContaining({ status: 0, callType: 'server_streaming' }),
      }),
    );
  });

  it('offers express fallback for native stream transport errors on tauri tabs', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      transportMode: 'tauri',
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
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
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      new GrpcNativeTauriStreamTransportError('stream_start', 'native invoke failed'),
    );

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
      streamError: expect.objectContaining({
        details: expect.objectContaining({ expressFallbackOffered: true }),
      }),
    }));
  });

  it('ends grpc-end without appending terminal data when event has no payload', () => {
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
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('ended');
    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(0);
  });

  it('cancels stream locally when lifecycle is in-flight without activeStreamId', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'starting',
      activeStreamId: undefined,
    };

    await act(async () => {
      await harness.hook.result.current.cancelStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('cancelled');
    expect(grpcStreamClient.cancelGrpcStream).not.toHaveBeenCalled();
  });

  it('sendStreamMessageCall deep-interpolates override body templates with frozen env (Phase 9I)', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: 'tab-body-literal' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId, { greeting: 'from-override' }),
    };
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockResolvedValue(undefined);

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId, {
        body: { message: '{{greeting}}' },
      });
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).toHaveBeenCalledWith(
      'stream-1',
      tabId,
      expect.objectContaining({ body: { message: 'from-override' } }),
    );
  });

  it('sendStreamMessageCall uses override body when provided', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: 'tab-body' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId),
    };
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockResolvedValue(undefined);

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId, { body: { message: 'override' } });
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).toHaveBeenCalledWith(
      'stream-1',
      tabId,
      expect.objectContaining({ body: { message: 'override' } }),
    );
  });

  it('enqueueStreamMessage appends cloned pending bodies', () => {
    const harness = makeHarness();
    const { tabId, updateTab } = harness;

    act(() => {
      harness.hook.result.current.enqueueStreamMessage(tabId, { message: 'queued' });
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, {
      streamPendingBodies: [{ message: 'queued' }],
    });
  });

  it('removePendingStreamMessage removes a queued body by index', () => {
    const harness = makeHarness();
    const { tabId, sessionRef, updateTab } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamPendingBodies: [{ message: 'a' }, { message: 'b' }],
    };

    act(() => {
      harness.hook.result.current.removePendingStreamMessage(tabId, 0);
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, {
      streamPendingBodies: [{ message: 'b' }],
    });
  });

  it('removePendingStreamMessage no-ops when tab is missing', () => {
    const harness = makeHarness();
    const { updateTab } = harness;
    harness.sessionRef.current.tabs = [];

    act(() => {
      harness.hook.result.current.removePendingStreamMessage('missing', 0);
    });

    expect(updateTab).not.toHaveBeenCalled();
  });

  it('sendAllPendingStreamMessages no-ops when queue is empty', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      streamPendingBodies: [],
    };

    await act(async () => {
      await harness.hook.result.current.sendAllPendingStreamMessages(tabId);
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).not.toHaveBeenCalled();
  });

  it('sendAllPendingStreamMessages drains queue in order', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, updateTab } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      streamPendingBodies: [{ message: 'a' }, { message: 'b' }],
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId),
    };
    vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockResolvedValue(undefined);

    await act(async () => {
      await harness.hook.result.current.sendAllPendingStreamMessages(tabId);
    });

    expect(grpcStreamClient.sendGrpcStreamMessage).toHaveBeenNthCalledWith(
      1,
      'stream-1',
      tabId,
      expect.objectContaining({ body: { message: 'a' } }),
    );
    expect(grpcStreamClient.sendGrpcStreamMessage).toHaveBeenNthCalledWith(
      2,
      'stream-1',
      tabId,
      expect.objectContaining({ body: { message: 'b' } }),
    );
    expect(updateTab).toHaveBeenCalledWith(tabId, { streamPendingBodies: [{ message: 'b' }] });
    expect(updateTab).toHaveBeenCalledWith(tabId, { streamPendingBodies: [] });
    expect(sessionRef.current.tabs[0]!.streamPendingBodies).toEqual([]);
  });

  it('captureStreamHistory no-ops when tab has no execute snapshot', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      lastExecuteSnapshot: undefined,
    };

    await act(async () => {
      await harness.hook.result.current.cancelStreamCall(tabId);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).not.toHaveBeenCalled();
  });

  it('ignores stream events when streamId or requestId does not match tab state', () => {
    const { hook, tabId, sessionRef, setSession } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
      streamRequestId: 'req-1',
    };

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'other-stream',
        requestId: 'req-1',
        tabId,
        sequence: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        data: { n: 1 },
      } as GrpcStreamEvent, () => false);
    });
    expect(setSession).not.toHaveBeenCalled();

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'other-req',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        data: { n: 2 },
      } as GrpcStreamEvent, () => false);
    });
    expect(setSession).not.toHaveBeenCalled();

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-message',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId: 'other-tab',
        sequence: 3,
        timestamp: '2026-01-01T00:00:02.000Z',
        data: { n: 3 },
      } as GrpcStreamEvent, () => false);
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('updates only the matching tab when recording grpc-message events with multiple tabs', () => {
    const session = createInitialSessionState();
    const secondTab = {
      ...session.tabs[0]!,
      id: 'grpc-tab-2',
      label: 'Tab 2',
      streamLifecycle: 'idle' as const,
      streamMessages: [],
      lastSequence: 0,
    };
    session.tabs = [session.tabs[0]!, secondTab];
    const sessionRef = { current: session };
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    const callGenerationRef = { current: {} as Record<string, number> };
    const inFlightCallRef = { current: {} as Record<string, string> };
    const tabId = session.activeTabId;

    const hook = renderHook(() => useGrpcStreamSession({
      sessionRef,
      streamGenerationRef,
      streamDisposeRef,
      callGenerationRef,
      inFlightCallRef,
      commitSession: vi.fn((next) => next),
      setSession: vi.fn((updater) => {
        sessionRef.current = typeof updater === 'function'
          ? updater(sessionRef.current)
          : updater;
      }),
      updateTab: vi.fn(),
      prepareExecuteSnapshot: vi.fn(),
    }));

    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
      streamRequestId: 'req-1',
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
        data: { message: 'chunk' },
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamMessages).toHaveLength(1);
    expect(sessionRef.current.tabs[1]?.streamMessages).toHaveLength(0);
  });

  it('ignores grpc-end updates when the tab disappears before session commit', () => {
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef, setSession } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: 'stream-1',
    };
    streamDisposeRef.current[tabId] = vi.fn();
    streamGenerationRef.current[tabId] = 1;
    setSession.mockImplementation((updater) => {
      sessionRef.current = typeof updater === 'function'
        ? updater({ ...sessionRef.current, tabs: [] })
        : updater;
    });

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

    expect(sessionRef.current.tabs).toHaveLength(0);
  });

  it('blocks stream start for spring-servlet with Phase 10H guidance', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      transportMode: 'spring-servlet',
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
    };
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...minimalStreamExecuteSnapshot(tabId),
      transportMode: 'spring-servlet',
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      new GrpcApiClientError('stream_start', 'Spring Servlet server streaming is not yet available in Studio (Phase 10H). Switch to Express Proxy for server streaming.', {
        code: 'GRPC_INVALID_REQUEST',
        category: 'validation',
        retryable: false,
        details: {
          suggestExpressProxy: true,
          transportMode: 'spring-servlet',
        },
      }),
    );

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(grpcStreamClient.startGrpcStream).toHaveBeenCalled();
    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
      streamError: expect.objectContaining({
        message: expect.stringMatching(/Phase 10H/i),
        details: expect.objectContaining({ expressFallbackOffered: true }),
      }),
    }));
  });

  it('offers express fallback for GrpcApiClientError native stream failures on tauri tabs', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      transportMode: 'tauri',
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
    };
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...minimalStreamExecuteSnapshot(tabId),
      transportMode: 'tauri',
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      new GrpcApiClientError('stream_start', 'native invoke failed', {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
      }),
    );

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamError: expect.objectContaining({
        details: expect.objectContaining({ expressFallbackOffered: true }),
      }),
    }));
  });

  it('uses generic text when transport dispatch guard throws a non-Error', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot, updateTab } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...minimalStreamExecuteSnapshot(tabId),
      callType: 'server_streaming',
    });
    const dispatchSpy = vi.spyOn(transportRouter, 'assertGrpcTransportDispatchReady').mockImplementation(() => {
      throw 'dispatch unavailable';
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    dispatchSpy.mockRestore();
    expect(updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamError: expect.objectContaining({ message: 'Transport dispatch is not available' }),
    }));
  });

  it('ignores stale transport dispatch failures after generation bump', async () => {
    const harness = makeHarness();
    const { tabId, prepareExecuteSnapshot, streamGenerationRef, updateTab } = harness;
    prepareExecuteSnapshot.mockReturnValue({
      ...minimalStreamExecuteSnapshot(tabId),
      callType: 'server_streaming',
    });
    const dispatchSpy = vi.spyOn(transportRouter, 'assertGrpcTransportDispatchReady').mockImplementation(() => {
      streamGenerationRef.current[tabId] = 99;
      throw new Error('dispatch blocked');
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    dispatchSpy.mockRestore();
    expect(updateTab).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'error',
      streamError: expect.objectContaining({ message: 'dispatch blocked' }),
    }));
  });

  it('captures stream start history without template context when tab disappears', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    const snapshot = {
      ...minimalStreamExecuteSnapshot(tabId),
      callType: 'server_streaming' as const,
    };
    prepareExecuteSnapshot.mockReturnValue(snapshot);
    vi.mocked(grpcStreamClient.startGrpcStream).mockImplementation(async () => {
      sessionRef.current = { ...sessionRef.current, tabs: [] };
      throw new GrpcApiClientError('stream_start', 'refused', { code: GRPC_ERROR_CODES.CALL_FAILED });
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(callHistoryCapture.captureGrpcCallHistoryFromOutcome).toHaveBeenCalledWith({
      snapshot,
      error: expect.objectContaining({ message: 'refused' }),
      templateContext: undefined,
    });
  });

  it('binds stream transport using original tab when tab row disappears after start', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef, prepareExecuteSnapshot } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      transportMode: 'tauri',
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
    };
    sessionRef.current.tabDescriptors[tabId] = {
      ...sessionRef.current.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    prepareExecuteSnapshot.mockReturnValue({
      ...minimalStreamExecuteSnapshot(tabId),
      transportMode: 'tauri',
      callType: 'server_streaming',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockImplementation(async () => {
      sessionRef.current = { ...sessionRef.current, tabs: [] };
      return {
        ok: true,
        op: 'stream_start',
        data: { streamId: 'stream-orphan', requestId: 'req-orphan' },
        meta: { requestId: 'req-orphan', timestamp: '2026-01-01T00:00:00.000Z' },
      };
    });

    await act(async () => {
      await harness.hook.result.current.startStreamCall(tabId);
    });

    expect(grpcStreamClient.openGrpcStreamEvents).not.toHaveBeenCalled();
  });

  it('uses generic validation text when stream message body resolution throws a non-Error', async () => {
    const harness = makeHarness();
    const { tabId, sessionRef } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      body: { message: '{{missing}}' },
      lastExecuteSnapshot: minimalStreamExecuteSnapshot(tabId),
    };
    const bodySpy = vi.spyOn(
      grpcStudioExecuteInterpolation,
      'resolveGrpcStudioStreamMessageBodyForSend',
    ).mockImplementation(() => {
      throw 'bad template';
    });

    await act(async () => {
      await harness.hook.result.current.sendStreamMessageCall(tabId);
    });

    bodySpy.mockRestore();
    expect(sessionRef.current.tabs[0]?.streamError?.message).toBe('Send stream message failed');
  });

  it('ignores SSE onError when stream lifecycle is already terminal', async () => {
    let streamHandlers: { onError?: (message: string) => void } = {};
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, handlers) => {
      streamHandlers = handlers;
      return vi.fn();
    });

    const harness = makeHarness();
    const { sessionRef, updateTab } = harness;
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'cancelled',
      activeStreamId: 'stream-1',
    };
    updateTab.mockClear();

    act(() => {
      streamHandlers.onError?.('late connection reset');
    });

    expect(updateTab).not.toHaveBeenCalled();
  });
});

/**
 * @vitest-environment jsdom
 */
import { act} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES, type GrpcStreamEvent } from '@shared/grpc/contracts';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import * as grpcStreamClient from '@shared/grpc/grpcStreamClient';
import { FIXTURE_DESCRIPTOR, FIXTURE_SERVER_STREAM_START_REQUEST } from '@shared/grpc/contractFixtures';
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

describe('useGrpcStreamSession coverage gaps — events and SSE', () => {
  beforeEach(() => {
    setupUseGrpcStreamSessionCoverageGapsTest();
  });

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
    expect(sessionRef.current.tabs[0]?.streamError).toBeUndefined();
  });

  it('cancelStreamCall keeps cancelled when SSE onError fires after cancel', async () => {
    let streamHandlers: { onError?: (message: string) => void } = {};
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
    };

    await act(async () => {
      await harness.hook.result.current.cancelStreamCall(tabId);
    });

    act(() => {
      streamHandlers.onError?.('connection dropped');
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('cancelled');
    expect(sessionRef.current.tabs[0]?.streamError).toBeUndefined();
  });

  it('maps grpc-error status 1 to cancelled lifecycle', () => {
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
        type: 'grpc-error',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        status: 1,
        statusMessage: 'Cancelled',
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('cancelled');
    expect(sessionRef.current.tabs[0]?.streamError).toBeUndefined();
  });

  it('ignores grpc-error after tab already cancelled', () => {
    const { hook, tabId, sessionRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'cancelled',
      activeStreamId: undefined,
      streamError: undefined,
    };

    act(() => {
      hook.result.current.applyStreamEvent(tabId, {
        type: 'grpc-error',
        streamId: 'stream-1',
        requestId: 'req-1',
        tabId,
        sequence: 2,
        timestamp: '2026-01-01T00:00:01.000Z',
        statusMessage: 'connection dropped',
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('cancelled');
    expect(sessionRef.current.tabs[0]?.streamError).toBeUndefined();
  });

  it('ignores grpc-end after tab already cancelled', () => {
    const { hook, tabId, sessionRef, streamDisposeRef, streamGenerationRef } = makeHarness();
    sessionRef.current.tabs[0] = {
      ...sessionRef.current.tabs[0]!,
      streamLifecycle: 'cancelled',
      streamMessages: [],
      lastSequence: 0,
      activeStreamId: undefined,
      streamError: undefined,
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
        status: 14,
        statusMessage: 'connection dropped',
      } as GrpcStreamEvent, () => false);
    });

    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('cancelled');
    expect(sessionRef.current.tabs[0]?.streamError).toBeUndefined();
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
});

/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES, type GrpcStreamEvent } from '@shared/grpc/contracts';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import { GrpcNativeTauriStreamTransportError } from '@shared/grpc/grpcNativeTauriStreamTransport';
import * as grpcStreamClient from '@shared/grpc/grpcStreamClient';
import { FIXTURE_DESCRIPTOR, FIXTURE_SERVER_STREAM_START_REQUEST } from '@shared/grpc/contractFixtures';
import * as callHistoryCapture from '../../utils/grpcStudioCallHistoryCapture';
import * as grpcStudioExecuteInterpolation from '@shared/grpc/grpcStudioExecuteInterpolation';
import * as transportRouter from '@shared/grpc/grpcBrowserTransportRouter';
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

describe('useGrpcStreamSession coverage gaps — transport and pending queue', () => {
  beforeEach(() => {
    setupUseGrpcStreamSessionCoverageGapsTest();
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

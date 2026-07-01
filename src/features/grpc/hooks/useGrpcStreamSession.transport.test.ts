/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES } from '../../../shared/grpc/contracts';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import * as grpcStreamClient from '../../../shared/grpc/grpcStreamClient';
import { FIXTURE_DESCRIPTOR, FIXTURE_SERVER_STREAM_START_REQUEST } from '../../../shared/grpc/contractFixtures';
import {
  hasGrpcStreamTransportBinding,
  isGrpcExpressFallbackOffered,
  resetGrpcStreamTransportBindingsForTests,
} from '../../../shared/grpc/grpcTransportFallback';
import { buildBrowserTransportGrpcApiError } from '../../../shared/grpc/grpcBrowserTransportErrorMapper';
import { resetGrpcTabTransportRoutingForTests, syncGrpcTabTransportMode } from '../../../shared/grpc/grpcTransportTabRouting';
import { createInitialSessionState } from './grpcStudioSessionHelpers';
import { useGrpcStreamSession } from './useGrpcStreamSession';

vi.mock('../../../shared/grpc/grpcStreamClient', async () => {
  const actual = await vi.importActual<typeof grpcStreamClient>('../../../shared/grpc/grpcStreamClient');
  return {
    ...actual,
    startGrpcStream: vi.fn(),
    openGrpcStreamEvents: vi.fn(() => vi.fn()),
    cancelGrpcStream: vi.fn(),
  };
});

describe('useGrpcStreamSession transport fallback (Phase 7F)', () => {
  beforeEach(() => {
    resetGrpcTabTransportRoutingForTests();
    resetGrpcStreamTransportBindingsForTests();
    vi.mocked(grpcStreamClient.startGrpcStream).mockReset();
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockReturnValue(vi.fn());
    vi.mocked(grpcStreamClient.cancelGrpcStream).mockResolvedValue(undefined);
  });

  function makeHarness(transportMode: 'tauri' | 'express' | 'grpc-web' = 'tauri') {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = {
      ...session.tabs[0]!,
      transportMode,
      service: 'echo.EchoService',
      method: 'ServerStream',
      target: 'localhost:50051',
    };
    syncGrpcTabTransportMode(tabId, transportMode);
    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    const sessionRef = { current: session };
    const updateTab = vi.fn((id: string, patch: Record<string, unknown>) => {
      sessionRef.current = {
        ...sessionRef.current,
        tabs: sessionRef.current.tabs.map((tab) => (
          tab.id === id ? { ...tab, ...patch } : tab
        )),
      };
    });
    const prepareExecuteSnapshot = vi.fn(() => ({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming' as const,
    }));

    const hook = renderHook(() => useGrpcStreamSession({
      sessionRef,
      streamGenerationRef: { current: {} },
      streamDisposeRef: { current: {} },
      callGenerationRef: { current: {} },
      inFlightCallRef: { current: {} },
      commitSession: (next) => {
        sessionRef.current = next;
        return next;
      },
      setSession: vi.fn(),
      updateTab,
      prepareExecuteSnapshot,
    }));

    return { hook, tabId, sessionRef, updateTab, prepareExecuteSnapshot };
  }

  it('offers express fallback when native stream_start fails preflight on tauri tab', async () => {
    const { hook, tabId, sessionRef } = makeHarness('tauri');
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      new GrpcApiClientError('stream_start', 'native invoke failed', {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
      }),
    );

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    const streamError = sessionRef.current.tabs[0]?.streamError;
    expect(isGrpcExpressFallbackOffered(streamError)).toBe(true);
    expect(hasGrpcStreamTransportBinding(tabId)).toBe(false);
  });

  it('offers express fallback when grpc-web stream_start fails with browser transport error (Phase 10E)', async () => {
    const { hook, tabId, sessionRef } = makeHarness('grpc-web');
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      buildBrowserTransportGrpcApiError('stream_start', 'proxy_unreachable', {
        transportMode: 'grpc-web',
      }),
    );

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    const streamError = sessionRef.current.tabs[0]?.streamError;
    expect(streamError?.details).toMatchObject({
      browserTransportFailure: 'proxy_unreachable',
      expressFallbackOffered: true,
      transportAttempted: 'grpc-web',
    });
    expect(hasGrpcStreamTransportBinding(tabId)).toBe(false);
  });

  it('prefers frozen snapshot transport mode for browser Express fallback (Phase 10E)', async () => {
    const { hook, tabId, sessionRef, prepareExecuteSnapshot } = makeHarness('express');
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming' as const,
      transportMode: 'grpc-web',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      buildBrowserTransportGrpcApiError('stream_start', 'cors', { transportMode: 'grpc-web' }),
    );

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamError?.details).toMatchObject({
      browserTransportFailure: 'cors',
      expressFallbackOffered: true,
      transportAttempted: 'grpc-web',
    });
  });

  it('offers Express fallback when Phase 10H deferred stream_start fails on grpc-web (Phase 10I)', async () => {
    const { hook, tabId, sessionRef, prepareExecuteSnapshot } = makeHarness('grpc-web');
    prepareExecuteSnapshot.mockReturnValue({
      ...FIXTURE_SERVER_STREAM_START_REQUEST,
      tabId,
      callType: 'server_streaming' as const,
      transportMode: 'grpc-web',
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      new GrpcApiClientError('stream_start', 'gRPC-Web server streaming is not yet available in Studio (Phase 10H). Switch to Express Proxy for server streaming.', {
        code: 'GRPC_INVALID_REQUEST',
        category: 'validation',
        retryable: false,
        details: { suggestExpressProxy: true, transportMode: 'grpc-web' },
      }),
    );

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamError?.details).toMatchObject({
      expressFallbackOffered: true,
      transportAttempted: 'grpc-web',
    });
    expect(isGrpcExpressFallbackOffered(sessionRef.current.tabs[0]?.streamError)).toBe(true);
  });

  it('does not offer Express fallback for browser server_status stream failures (Phase 10E)', async () => {
    const { hook, tabId, sessionRef } = makeHarness('grpc-web');
    vi.mocked(grpcStreamClient.startGrpcStream).mockRejectedValue(
      buildBrowserTransportGrpcApiError('stream_start', 'server_status', {
        transportMode: 'grpc-web',
        httpStatus: 502,
      }),
    );

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    expect(sessionRef.current.tabs[0]?.streamError?.details).toMatchObject({
      browserTransportFailure: 'server_status',
    });
    expect(sessionRef.current.tabs[0]?.streamError?.details).not.toHaveProperty('expressFallbackOffered');
  });

  it('binds stream transport after successful stream_start', async () => {
    const { hook, tabId } = makeHarness('tauri');
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });

    expect(hasGrpcStreamTransportBinding(tabId)).toBe(true);
  });

  it('clears stream transport binding when SSE onError fires', async () => {
    const { hook, tabId, sessionRef } = makeHarness('tauri');
    let capturedOnError: ((message: string) => void) | undefined;
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, opts) => {
      capturedOnError = opts.onError;
      return vi.fn();
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });
    expect(hasGrpcStreamTransportBinding(tabId)).toBe(true);

    await act(async () => {
      capturedOnError?.('connection reset');
    });

    expect(hasGrpcStreamTransportBinding(tabId)).toBe(false);
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('error');
  });

  it('clears binding and ends stream when SSE not-found fires during ending', async () => {
    const { hook, tabId, sessionRef } = makeHarness('tauri');
    let capturedOnError: ((message: string) => void) | undefined;
    vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockImplementation((_streamId, _tabId, opts) => {
      capturedOnError = opts.onError;
      return vi.fn();
    });
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });
    sessionRef.current = {
      ...sessionRef.current,
      tabs: sessionRef.current.tabs.map((tab) => (
        tab.id === tabId
          ? { ...tab, streamLifecycle: 'ending' as const }
          : tab
      )),
    };

    await act(async () => {
      capturedOnError?.('No active stream for id');
    });

    expect(hasGrpcStreamTransportBinding(tabId)).toBe(false);
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('ended');
  });

  it('cancelStreamCall awaits cancel before clearing transport binding', async () => {
    const { hook, tabId, sessionRef } = makeHarness('tauri');
    vi.mocked(grpcStreamClient.startGrpcStream).mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-1', requestId: 'req-1' },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      await hook.result.current.startStreamCall(tabId);
    });
    expect(hasGrpcStreamTransportBinding(tabId)).toBe(true);

    vi.mocked(grpcStreamClient.cancelGrpcStream).mockImplementationOnce(async () => {
      expect(hasGrpcStreamTransportBinding(tabId)).toBe(true);
    });
    sessionRef.current = {
      ...sessionRef.current,
      tabs: sessionRef.current.tabs.map((tab) => (
        tab.id === tabId
          ? {
              ...tab,
              streamLifecycle: 'streaming' as const,
              activeStreamId: 'stream-1',
            }
          : tab
      )),
    };

    await act(async () => {
      await hook.result.current.cancelStreamCall(tabId);
    });

    expect(hasGrpcStreamTransportBinding(tabId)).toBe(false);
    expect(grpcStreamClient.cancelGrpcStream).toHaveBeenCalledWith('stream-1', tabId);
  });
});

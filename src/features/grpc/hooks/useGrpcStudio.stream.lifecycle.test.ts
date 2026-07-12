/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_HAPPY_CALL_ENVELOPE,
} from '../../../shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
import * as grpcStreamClient from '../../../shared/grpc/grpcStreamClient';

const { setGrpcStreamTransport } = grpcStreamClient;
import { createGrpcSuccessEnvelope } from '../../../shared/grpc/contracts';
import { useGrpcStudio } from './useGrpcStudio';
import { PAGE_DEFAULTS, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

beforeEach(() => setupUseGrpcStudioHookTest({ stream: true, restoreMocks: true }));

describe('useGrpcStudio stream lifecycle (Phase 2G)', () => {
  it('starts server streaming and transitions to streaming lifecycle', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });
    setGrpcStreamTransport(async (path, _init) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-test-1',
          requestId: 'req-stream-test',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-test-1',
        requestId: 'req-stream-test',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const serverStream = FIXTURE_DESCRIPTOR.services[0]!.methods.find(
      (entry) => entry.name === 'ServerStream',
    )!;

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', serverStream.name);
    });

    await act(async () => {
      await result.current.startStreamCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('streaming');
    expect(tab.activeStreamId).toBe('stream-test-1');
  });

  it('duplicate tab copies stream message cache but resets lifecycle', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'ended',
        streamMessages: [{
          sequence: 1,
          timestamp: '2026-06-29T00:00:00.000Z',
          direction: 'inbound',
          data: { message: 'cached' },
        }],
        activeStreamId: 'stream-old',
      });
      result.current.duplicateTab(tabId);
    });

    const copy = result.current.tabs.find((tab) => tab.id !== tabId)!;
    expect(copy.streamLifecycle).toBe('idle');
    expect(copy.activeStreamId).toBeUndefined();
    expect(copy.streamMessages).toEqual([{
      sequence: 1,
      timestamp: '2026-06-29T00:00:00.000Z',
      direction: 'inbound',
      data: { message: 'cached' },
    }]);
  });

  it('closeTab cancels active stream via DELETE', async () => {
    const paths: string[] = [];
    setGrpcStreamTransport(async (path) => {
      paths.push(path);
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-close-1',
          requestId: 'req-close',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-close-1',
        requestId: 'req-close',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.addTab();
    });
    const secondId = result.current.tabs.find((tab) => tab.id !== tabId)!.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'ServerStream',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-close-1',
        streamRequestId: 'req-close',
      });
    });

    act(() => {
      result.current.closeTab(tabId);
    });

    await waitFor(() => {
      expect(paths.some((path) => path.includes('stream-close-1') && path.includes('tabId='))).toBe(true);
    });
    expect(result.current.tabs.some((tab) => tab.id === tabId)).toBe(false);
    expect(result.current.activeTabId).toBe(secondId);
  });

  it('addTab detaches SSE subscription from previous active tab', async () => {
    const dispose = vi.fn();
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(dispose);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'ServerStream',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-detach-1',
        streamRequestId: 'req-detach',
      });
    });

    await waitFor(() => {
      expect(grpcStreamClient.openGrpcStreamEvents).toHaveBeenCalled();
    });
    dispose.mockClear();

    act(() => {
      result.current.addTab();
    });

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('maps grpc-end with non-OK status to stream error lifecycle', async () => {
    let capturedOnEvent: ((event: import('../../../shared/grpc/contracts').GrpcStreamEvent) => void) | undefined;
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, _tabId, options) => {
      capturedOnEvent = options.onEvent;
      return vi.fn();
    });

    setGrpcStreamTransport(async (path) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-err-1',
          requestId: 'req-err',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-err-1',
        requestId: 'req-err',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'ServerStream');
    });

    await act(async () => {
      await result.current.startStreamCall(tabId);
    });

    await waitFor(() => {
      expect(capturedOnEvent).toBeDefined();
    });

    await act(async () => {
      capturedOnEvent?.({
        type: 'grpc-end',
        streamId: 'stream-err-1',
        requestId: 'req-err',
        tabId,
        sequence: 2,
        timestamp: '2026-06-29T00:00:00.000Z',
        status: 13,
        statusMessage: 'Internal error',
      });
    });

    await waitFor(() => {
      const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
      expect(tab.streamLifecycle).toBe('error');
      expect(tab.streamError?.message).toBe('Internal error');
      expect(tab.activeStreamId).toBeUndefined();
    });
  });

  it('cancelStreamCall during starting aborts in-flight start', async () => {
    let resolveStart: (() => void) | undefined;
    setGrpcStreamTransport((path) => new Promise((resolve) => {
      if (path.includes('/stream/start')) {
        resolveStart = () => {
          resolve(createGrpcSuccessEnvelope('stream_start', {
            streamId: 'stream-start-race',
            requestId: 'req-race',
            tabId: 'grpc-tab-1',
          }));
        };
        return;
      }
      resolve(createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-start-race',
        requestId: 'req-race',
        tabId: 'grpc-tab-1',
        cancelled: true,
      }));
    }));

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'ServerStream');
    });

    act(() => {
      void result.current.startStreamCall(tabId);
    });

    await waitFor(() => {
      expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('starting');
    });

    await act(async () => {
      await result.current.cancelStreamCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('cancelled');

    await act(async () => {
      resolveStart?.();
      await Promise.resolve();
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('cancelled');
  });

  it('selectTab revisit re-attaches SSE for streaming tab', async () => {
    const dispose = vi.fn();
    const openSpy = vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(dispose);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'ServerStream',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-revisit-1',
        streamRequestId: 'req-revisit',
      });
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    dispose.mockClear();

    act(() => {
      result.current.addTab();
    });

    const secondId = result.current.tabs.find((tab) => tab.id !== tabId)!.id;
    expect(dispose).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.selectTab(tabId);
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(2);
    });
    expect(result.current.activeTabId).toBe(tabId);
    expect(result.current.tabs.some((tab) => tab.id === secondId)).toBe(true);
  });

  it('selectTab away and back preserves in-flight stream snapshot fields', () => {
    const dispose = vi.fn();
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(dispose);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;
    const snapshot = {
      tabId,
      requestId: 'req-snapshot',
      capturedAt: '2026-01-01T00:00:00.000Z',
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hold', repeat_count: 3 },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      callType: 'server_streaming' as const,
    };

    act(() => {
      result.current.updateTab(tabId, {
        target: snapshot.target.address,
        descriptorKey: snapshot.descriptorKey,
        service: snapshot.service,
        method: snapshot.method,
        body: snapshot.body,
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-snapshot-1',
        streamRequestId: snapshot.requestId,
        lastExecuteSnapshot: snapshot,
      });
    });

    act(() => {
      result.current.addTab();
    });
    const secondId = result.current.tabs.find((tab) => tab.id !== tabId)!.id;

    act(() => {
      result.current.selectTab(secondId);
      result.current.selectTab(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('streaming');
    expect(tab.activeStreamId).toBe('stream-snapshot-1');
    expect(tab.service).toBe('echo.EchoService');
    expect(tab.method).toBe('ServerStream');
    expect(tab.body).toEqual({ message: 'hold', repeat_count: 3 });
    expect(tab.lastExecuteSnapshot).toEqual(snapshot);
  });

  it('clearStreamLog clears messages but preserves lastSequence for SSE dedupe', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamMessages: [
          {
            sequence: 3,
            timestamp: '2026-01-01T00:00:00.000Z',
            direction: 'inbound',
            data: { message: 'one' },
          },
        ],
        lastSequence: 3,
      });
    });

    act(() => {
      result.current.clearStreamLog(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamMessages).toEqual([]);
    expect(tab.lastSequence).toBe(3);
  });
});

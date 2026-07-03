/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
} from '../../../shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
import * as grpcStreamClient from '../../../shared/grpc/grpcStreamClient';
import { setGrpcStreamTransport } from '../../../shared/grpc/grpcStreamClient';
import { createGrpcSuccessEnvelope } from '../../../shared/grpc/contracts';
import { withGrpcExpressFallbackOffer } from '../../../shared/grpc/grpcTransportFallback';
import {
  resetGrpcTabTransportRoutingForTests,
} from '../../../shared/grpc/grpcTransportTabRouting';
import * as grpcTransportTabRouting from '../../../shared/grpc/grpcTransportTabRouting';
import { GRPC_STUDIO_MAX_TABS, useGrpcStudio } from './useGrpcStudio';
import { PAGE_DEFAULTS, seedUnaryReadyTab, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

const mountNativeTransport = vi.fn(() => vi.fn());
const registerAppLifecycle = vi.fn(() => vi.fn());
vi.mock('./grpcStudioTabLifecycle', () => ({
  mountGrpcStudioNativeTransport: (...args: unknown[]) => mountNativeTransport(...args),
  registerGrpcStudioAppLifecycle: (...args: unknown[]) => registerAppLifecycle(...args),
  registerGrpcStudioWindowLifecycle: (...args: unknown[]) => registerAppLifecycle(...args),
}));

const hydrateSecrets = vi.fn().mockResolvedValue(undefined);
vi.mock('../utils/grpcTabSecretVault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/grpcTabSecretVault')>();
  return {
    ...actual,
    hydrateActiveTabSecretsFromVault: (...args: unknown[]) => hydrateSecrets(...args),
  };
});

describe('useGrpcStudio coverage gaps', () => {
  beforeEach(() => {
    setupUseGrpcStudioHookTest({ stream: true, restoreMocks: true });
    resetGrpcTabTransportRoutingForTests();
    mountNativeTransport.mockClear();
    hydrateSecrets.mockClear();
  });

  it('mounts native transport on hook mount', () => {
    const { unmount } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(mountNativeTransport).toHaveBeenCalledTimes(1);
    const dispose = mountNativeTransport.mock.results[0]?.value as () => void;
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('skips vault hydration while running in test mode', () => {
    renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(hydrateSecrets).not.toHaveBeenCalled();
  });

  it('syncs transport routing for tabs that can change transport mode', () => {
    const syncSpy = vi.spyOn(grpcTransportTabRouting, 'syncGrpcTabTransportMode');
    renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(syncSpy).toHaveBeenCalled();
    syncSpy.mockRestore();
  });

  it('exposes profiles and enforces maxTabs for canAddTab', () => {
    const profiles = [{ id: 'p1', name: 'Local', target: 'localhost:50051', tlsMode: 'disabled' as const }];
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      profiles,
      maxTabs: 1,
    }));

    expect(result.current.profiles).toBe(profiles);
    expect(result.current.maxTabs).toBe(1);
    expect(result.current.canAddTab).toBe(false);
  });

  it('setTabTransportMode updates tab and syncs routing when allowed', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.setTabTransportMode(tabId, 'express');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.transportMode).toBe('express');
  });

  it('setTabTransportMode no-ops for missing tabs and in-flight streams', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.setTabTransportMode('missing-tab', 'tauri');
    });

    act(() => {
      result.current.updateTab(tabId, { transportMode: 'tauri' });
    });

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-1',
      });
    });

    act(() => {
      result.current.setTabTransportMode(tabId, 'express');
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)?.transportMode).toBe('tauri');
  });

  it('retryUnaryWithExpress switches to express when fallback is offered', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'call') return FIXTURE_HAPPY_CALL_ENVELOPE;
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result, {
      transportMode: 'tauri',
      lifecycle: 'error',
      lastError: withGrpcExpressFallbackOffer(
        { code: 'UNREACHABLE', message: 'native invoke failed' },
        'native invoke failed',
      ),
    });

    act(() => {
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    act(() => {
      result.current.retryUnaryWithExpress(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.transportMode).toBe('express');
  });

  it('retryUnaryWithExpress no-ops when fallback is not offered', async () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        lifecycle: 'error',
        lastError: { code: 'CALL_FAILED', message: 'hard failure' },
        transportMode: 'tauri',
      });
    });

    await act(async () => {
      await result.current.retryUnaryWithExpress(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)?.transportMode).toBe('tauri');
  });

  it('retryStreamWithExpress switches to express when stream fallback is offered', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });
    setGrpcStreamTransport(async () => createGrpcSuccessEnvelope('stream_start', {
      streamId: 'stream-retry',
      requestId: 'req-retry',
      tabId: 'unused',
    }));
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(vi.fn());

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
      result.current.updateTab(tabId, {
        transportMode: 'tauri',
        streamLifecycle: 'error',
        streamError: withGrpcExpressFallbackOffer(
          { code: 'UNREACHABLE', message: 'native stream failed' },
          'native stream failed',
        ),
      });
    });

    act(() => {
      result.current.retryStreamWithExpress(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.transportMode).toBe('express');
  });

  it('retryStreamWithExpress no-ops when stream fallback is not offered', async () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'error',
        streamError: { code: 'CALL_FAILED', message: 'hard failure' },
        transportMode: 'tauri',
      });
    });

    await act(async () => {
      await result.current.retryStreamWithExpress(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)?.transportMode).toBe('tauri');
  });

  it('invokes onCancelInFlight when provided', async () => {
    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        lifecycle: 'calling',
        activeRequestId: 'req-cancel',
      });
    });

    await act(async () => {
      await result.current.cancelUnaryCall(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, 'req-cancel');
  });

  it('attaches stream events when active tab is awaiting SSE', async () => {
    const openSpy = vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(vi.fn());
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-await',
        streamRequestId: 'req-await',
        lastSequence: 0,
      });
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'stream-await',
        tabId,
        expect.objectContaining({ expectedRequestId: 'req-await' }),
      );
    });
  });

  it('registers app lifecycle hooks that expose tab ids and detach stream events', () => {
    renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(registerAppLifecycle).toHaveBeenCalled();
    const config = registerAppLifecycle.mock.calls.at(-1)?.[0] as {
      getTabIds: () => string[];
      detachStreamEvents: (tabId: string) => void;
    };
    expect(config.getTabIds().length).toBeGreaterThan(0);
    expect(() => config.detachStreamEvents(config.getTabIds()[0]!)).not.toThrow();
  });

  it('defaults maxTabs to GRPC_STUDIO_MAX_TABS', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(result.current.maxTabs).toBe(GRPC_STUDIO_MAX_TABS);
    expect(result.current.canAddTab).toBe(true);
  });

  it('restorePersistedSession replaces tabs, descriptors, and active tab id', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.restorePersistedSession({
        version: 1,
        activeTabId: 'persisted-tab-2',
        tabs: [
          {
            id: 'persisted-tab-1',
            title: 'First',
            target: 'localhost:50051',
            tlsMode: 'disabled',
            metadata: {},
            timeoutMs: 30_000,
            requestMode: 'form',
            body: { message: 'one' },
            servicesCollapsed: false,
          },
          {
            id: 'persisted-tab-2',
            title: 'Second',
            target: 'localhost:50052',
            tlsMode: 'disabled',
            metadata: {},
            timeoutMs: 30_000,
            requestMode: 'json',
            body: { message: 'two' },
            servicesCollapsed: true,
          },
        ],
        tabDescriptors: {
          'persisted-tab-1': {
            sourceSelection: { kind: 'reflection', address: 'localhost:50051', tlsMode: 'disabled' },
            expandedServiceIds: ['echo.EchoService'],
            protoIngest: {
              source: 'bsr',
              protoRoots: [],
              importPaths: [],
              bsrModule: 'buf.build/connectrpc/eliza',
              bsrVersion: 'main',
            },
          },
        },
        timestamp: Date.now(),
      });
    });

    expect(result.current.tabs.map((tab) => tab.id)).toEqual(['persisted-tab-1', 'persisted-tab-2']);
    expect(result.current.activeTabId).toBe('persisted-tab-2');
    expect(result.current.activeTab.title).toBe('Second');
    expect(result.current.activeTab.target).toBe('localhost:50052');
    expect(result.current.tabs[0]?.servicesCollapsed).toBe(false);
    expect(result.current.tabs[1]?.servicesCollapsed).toBe(true);
    expect(result.current.getTabDescriptor('persisted-tab-1').protoIngest?.source).toBe('bsr');
    expect(result.current.getTabDescriptor('persisted-tab-1').protoIngest?.bsrModule).toBe('buf.build/connectrpc/eliza');
  });

  it('restorePersistedSession ignores empty persisted tab lists', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const before = result.current.tabs.map((tab) => tab.id);

    act(() => {
      result.current.restorePersistedSession({
        version: 1,
        activeTabId: 'missing',
        tabs: [],
        tabDescriptors: {},
        timestamp: Date.now(),
      });
    });

    expect(result.current.tabs.map((tab) => tab.id)).toEqual(before);
  });

  it('restorePersistedSession falls back to the first tab when active id is missing', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.restorePersistedSession({
        version: 1,
        activeTabId: 'missing-active',
        tabs: [{
          id: 'only-tab',
          title: 'Only',
          target: 'localhost:50051',
          tlsMode: 'disabled',
          metadata: {},
          timeoutMs: 30_000,
          requestMode: 'form',
          body: { message: 'one' },
          servicesCollapsed: false,
        }],
        tabDescriptors: null as never,
        timestamp: Date.now(),
      });
    });

    expect(result.current.activeTabId).toBe('only-tab');
    expect(result.current.getTabDescriptor('only-tab').loadState).toBe('idle');
  });

  it('restorePersistedSession respects maxTabs when restoring persisted tabs', () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      maxTabs: 1,
    }));

    act(() => {
      result.current.restorePersistedSession({
        version: 1,
        activeTabId: 'persisted-tab-2',
        tabs: [
          {
            id: 'persisted-tab-1',
            title: 'First',
            target: 'localhost:50051',
            tlsMode: 'disabled',
            metadata: {},
            timeoutMs: 30_000,
            requestMode: 'form',
            body: { message: 'one' },
            servicesCollapsed: false,
          },
          {
            id: 'persisted-tab-2',
            title: 'Second',
            target: 'localhost:50052',
            tlsMode: 'disabled',
            metadata: {},
            timeoutMs: 30_000,
            requestMode: 'json',
            body: { message: 'two' },
            servicesCollapsed: true,
          },
        ],
        tabDescriptors: {},
        timestamp: Date.now(),
      });
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe('persisted-tab-1');
  });
});

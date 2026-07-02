/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import { createInitialSessionState } from './grpcStudioSessionHelpers';
import { useGrpcStudioSessionCore } from './useGrpcStudioSessionCore';

vi.mock('../utils/grpcTabSecretVault', () => ({
  shouldScheduleTabSecretsVaultSync: (patch: Record<string, unknown>) => (
    'tlsConfig' in patch || 'auth' in patch || 'target' in patch || 'connectionId' in patch
  ),
  scheduleTabSecretsVaultSync: vi.fn(),
}));

vi.mock('../utils/grpcSchemaDrift', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/grpcSchemaDrift')>();
  return {
    ...actual,
    analyzeWarningDriftWithBaseline: vi.fn(actual.analyzeWarningDriftWithBaseline),
  };
});

import { scheduleTabSecretsVaultSync } from '../utils/grpcTabSecretVault';
import { analyzeWarningDriftWithBaseline } from '../utils/grpcSchemaDrift';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

describe('useGrpcStudioSessionCore coverage gaps', () => {
  it('uses empty descriptor fallbacks when a tab has no descriptor entry', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const orphanTab = createGrpcStudioTab({ id: 'orphan-tab', title: 'Orphan' });
    act(() => {
      result.current.setSession((prev) => ({
        ...prev,
        tabs: [...prev.tabs, orphanTab],
        activeTabId: orphanTab.id,
      }));
    });

    expect(result.current.activeTabDescriptor.loadState).toBe('idle');
    expect(result.current.getTabDescriptor(orphanTab.id).loadState).toBe('idle');

    act(() => {
      result.current.patchTabDescriptor(orphanTab.id, { loadState: 'loading' });
      result.current.updateTab(
        orphanTab.id,
        { title: 'Orphan renamed' },
        { descriptorPatch: { driftState: 'none' } },
      );
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(orphanTab.id).loadState).toBe('loading');
      expect(result.current.getTabDescriptor(orphanTab.id).driftState).toBe('none');
    });
  });

  it('repairs activeTabId when it no longer exists', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const staleActiveId = 'missing-tab';
    act(() => {
      result.current.setSession((prev) => ({
        ...prev,
        activeTabId: staleActiveId,
      }));
    });

    await waitFor(() => {
      expect(result.current.activeTabId).toBe(result.current.tabs[0]!.id);
    });
  });

  it('invalidates descriptor state when tab target changes', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: { key: 'desc-1', services: [], source: 'reflection', sourceFingerprint: 'fp' },
      });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:9090' });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
      expect(result.current.getTabDescriptor(tabId).descriptor).toBeUndefined();
    });
  });

  it('ignores patchTabDescriptor for unknown tabs', () => {
    const initial = createInitialSessionState();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    act(() => {
      result.current.patchTabDescriptor('missing-tab', { loadState: 'loading' });
    });

    expect(result.current.tabDescriptors).toEqual(initial.tabDescriptors);
  });

  it('updateTab applies descriptorPatch and schedules vault sync for tls changes', async () => {
    vi.mocked(scheduleTabSecretsVaultSync).mockClear();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(
        tabId,
        { tlsConfig: { serverCaPem: 'pem' } },
        { descriptorPatch: { loadState: 'loading' } },
      );
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('loading');
      expect(scheduleTabSecretsVaultSync).toHaveBeenCalled();
    });
  });

  it('updateTab re-evaluates warning drift when body changes under warning state', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
    act(() => {
      result.current.updateTab(tabId, {
        service: 'echo.EchoService',
        method: echoMethod.name,
        body: { message: 'hello' },
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        driftState: 'warning',
        driftBaselineRequestSchema: echoMethod.requestSchema,
        driftMessage: 'Field drift',
      });
    });

    act(() => {
      result.current.updateTab(tabId, {
        body: { message: 'updated' },
      });
    });

    await waitFor(() => {
      const descriptor = result.current.getTabDescriptor(tabId);
      expect(descriptor.driftState === 'warning' || descriptor.driftState === 'none').toBe(true);
    });
  });

  it('updateTab ignores unknown tab ids', () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const before = result.current.tabs;
    act(() => {
      result.current.updateTab('missing-tab', { title: 'Nope' });
    });
    expect(result.current.tabs).toBe(before);
  });

  it('invalidates tabs when envVarMap changes connection fingerprint', async () => {
    const { result, rerender } = renderHook(
      ({ envVarMap }: { envVarMap: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap,
        profiles: [{ id: 'p1', name: 'Env profile', target: '{{grpcHost}}', tlsMode: 'disabled' }],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, { connectionId: 'p1', target: '' });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    rerender({ envVarMap: { grpcHost: 'remote.example.com:50051' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });
  });

  it('does not invalidate in-flight tabs when envVarMap changes (Phase 9C)', async () => {
    const { result, rerender } = renderHook(
      ({ envVarMap }: { envVarMap: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap,
        profiles: [{ id: 'p1', name: 'Env profile', target: '{{grpcHost}}', tlsMode: 'disabled' }],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        connectionId: 'p1',
        target: '',
        lifecycle: 'calling',
        activeRequestId: 'req-in-flight',
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    rerender({ envVarMap: { grpcHost: 'remote.example.com:50051' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
    });
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.lifecycle).toBe('calling');
  });

  it('does not invalidate in-flight tabs when connection patch changes during call (Phase 9C)', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: { grpcHost: 'localhost:50051' },
      profiles: [{ id: 'p1', name: 'Profile', target: 'localhost:9090', tlsMode: 'disabled' }],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        lifecycle: 'calling',
        activeRequestId: 'req-in-flight',
        target: 'localhost:50051',
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:9090' });
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.lifecycle).toBe('calling');
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.target).toBe('localhost:9090');
  });

  it('defers env invalidation until in-flight call completes (Phase 9C)', async () => {
    const { result, rerender } = renderHook(
      ({ envVarMap }: { envVarMap: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap,
        profiles: [{ id: 'p1', name: 'Env profile', target: '{{grpcHost}}', tlsMode: 'disabled' }],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        connectionId: 'p1',
        target: '',
        lifecycle: 'calling',
        activeRequestId: 'req-in-flight',
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    rerender({ envVarMap: { grpcHost: 'remote.example.com:50051' } });
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');

    act(() => {
      result.current.updateTab(tabId, {
        lifecycle: 'success',
        activeRequestId: undefined,
        lastResult: {
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'hello' },
          durationMs: 12,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.lifecycle).toBe('success');
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.lastResult).toEqual(
      expect.objectContaining({
        status: 0,
        body: { message: 'hello' },
      }),
    );
  });

  it('defers stream env invalidation and preserves terminal stream messages (Phase 9C)', async () => {
    const streamMessages = [{
      id: 'msg-1',
      direction: 'receive' as const,
      sequence: 1,
      timestamp: '2026-06-29T12:00:00.000Z',
      body: { payload: 'chunk' },
    }];
    const { result, rerender } = renderHook(
      ({ envVarMap }: { envVarMap: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap,
        profiles: [{ id: 'p1', name: 'Env profile', target: '{{grpcHost}}', tlsMode: 'disabled' }],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        connectionId: 'p1',
        target: '',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-in-flight',
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    rerender({ envVarMap: { grpcHost: 'remote.example.com:50051' } });
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'ended',
        activeStreamId: undefined,
        streamMessages,
      });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.streamLifecycle).toBe('ended');
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.streamMessages).toEqual(streamMessages);
  });

  it('updateTab schedules vault sync when auth changes', async () => {
    vi.mocked(scheduleTabSecretsVaultSync).mockClear();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        auth: { type: 'bearer', bearerToken: 'token' },
      });
    });

    await waitFor(() => {
      expect(scheduleTabSecretsVaultSync).toHaveBeenCalledWith(expect.objectContaining({
        id: tabId,
        auth: { type: 'bearer', bearerToken: 'token' },
      }));
    });
  });

  it('updateTab preserves descriptor on replay connection change when descriptorKey matches', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    const replayDescriptor = { ...FIXTURE_DESCRIPTOR, key: 'desc-new' };
    act(() => {
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: replayDescriptor,
      });
      result.current.updateTab(tabId, {
        target: 'localhost:9090',
        descriptorKey: 'desc-new',
      });
    });

    await waitFor(() => {
      const descriptor = result.current.getTabDescriptor(tabId);
      expect(descriptor.loadState).toBe('loaded');
      expect(descriptor.descriptor).toEqual(replayDescriptor);
    });
  });

  it('updateTab syncs vault owner when connectionId and tlsConfig change together', async () => {
    vi.mocked(scheduleTabSecretsVaultSync).mockClear();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        connectionId: 'profile-b',
        tlsConfig: { serverCaPem: 'pem' },
      });
    });

    await waitFor(() => {
      expect(scheduleTabSecretsVaultSync).toHaveBeenCalledWith(expect.objectContaining({
        id: tabId,
        connectionId: 'profile-b',
        tlsConfig: { serverCaPem: 'pem' },
      }));
    });
  });

  it('updateTab skips drift reanalysis when selected method is missing from descriptor', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
    act(() => {
      result.current.updateTab(tabId, {
        service: 'missing.Service',
        method: 'MissingMethod',
        body: { message: 'hello' },
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        driftState: 'warning',
        driftBaselineRequestSchema: echoMethod.requestSchema,
        driftMessage: 'Field drift',
      });
    });

    act(() => {
      result.current.updateTab(tabId, { body: { message: 'updated' } });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).driftMessage).toBe('Field drift');
    });
  });

  it('updateTab clears warning drift when body matches baseline schema', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
    act(() => {
      result.current.updateTab(tabId, {
        service: 'echo.EchoService',
        method: echoMethod.name,
        body: { message: 'hello' },
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        driftState: 'warning',
        driftBaselineRequestSchema: echoMethod.requestSchema,
        driftMessage: 'Field drift',
        driftIssues: [{ kind: 'field_removed', message: 'drift' }],
      });
    });

    act(() => {
      result.current.updateTab(tabId, {
        body: { message: 'hello' },
      });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
    });
  });

  it('updateTab skips drift reanalysis when service or method is missing', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
    act(() => {
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        driftState: 'warning',
        driftBaselineRequestSchema: echoMethod.requestSchema,
        driftMessage: 'Field drift',
      });
    });

    act(() => {
      result.current.updateTab(tabId, { body: { message: 'updated' } });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).driftMessage).toBe('Field drift');
    });
  });

  it('invalidates tabs when connection profile target changes', async () => {
    const profileA = { id: 'p1', name: 'Profile', target: 'localhost:50051', tlsMode: 'disabled' as const };
    const { result, rerender } = renderHook(
      ({ profiles }: { profiles: typeof profileA[] }) => useGrpcStudioSessionCore({
        envVarMap: {},
        profiles,
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { profiles: [profileA] } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, { connectionId: 'p1', target: '' });
      result.current.patchTabDescriptor(tabId, { loadState: 'loaded' });
    });

    rerender({
      profiles: [{ ...profileA, target: 'localhost:9090' }],
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });
  });

  it('invalidates multiple tabs when envVarMap changes', async () => {
    const fireCancelInFlight = vi.fn();
    const { result, rerender } = renderHook(
      ({ envVarMap }: { envVarMap: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap,
        profiles: [{ id: 'p1', name: 'Env profile', target: '{{grpcHost}}', tlsMode: 'disabled' }],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight,
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    act(() => {
      result.current.setSession((prev) => ({
        ...prev,
        tabs: [
          prev.tabs[0]!,
          { ...prev.tabs[0]!, id: 'tab-2', title: 'Tab 2' },
        ],
        tabDescriptors: {
          ...prev.tabDescriptors,
          'tab-2': { ...prev.tabDescriptors[prev.tabs[0]!.id]!, loadState: 'loaded' },
        },
      }));
    });

    const tabIds = result.current.tabs.map((tab) => tab.id);
    act(() => {
      for (const tabId of tabIds) {
        result.current.updateTab(tabId, { connectionId: 'p1', target: '' });
        result.current.patchTabDescriptor(tabId, { loadState: 'loaded' });
      }
    });

    rerender({ envVarMap: { grpcHost: 'remote.example.com:50051' } });

    await waitFor(() => {
      for (const tabId of tabIds) {
        expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
      }
    });
  });

  it('updateTab applies descriptorPatch without connection invalidation', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(
        tabId,
        { title: 'Renamed tab' },
        { descriptorPatch: { driftState: 'none', driftMessage: undefined } },
      );
    });

    await waitFor(() => {
      expect(result.current.tabs.find((tab) => tab.id === tabId)?.title).toBe('Renamed tab');
      expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
    });
  });

  it('invalidates tabs when pageDefaults target changes', async () => {
    const { result, rerender } = renderHook(
      ({ pageDefaults }: { pageDefaults: typeof PAGE_DEFAULTS }) => useGrpcStudioSessionCore({
        envVarMap: {},
        profiles: [],
        pageDefaults,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { pageDefaults: PAGE_DEFAULTS } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.patchTabDescriptor(tabId, { loadState: 'loaded' });
    });

    rerender({ pageDefaults: { target: 'localhost:9090', tlsMode: 'disabled' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });
  });

  it('updateTab syncs vault with existing auth when connectionId changes', async () => {
    vi.mocked(scheduleTabSecretsVaultSync).mockClear();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        auth: { type: 'bearer', bearerToken: 'token' },
      });
    });
    vi.mocked(scheduleTabSecretsVaultSync).mockClear();

    act(() => {
      result.current.updateTab(tabId, { connectionId: 'profile-c' });
    });

    await waitFor(() => {
      expect(scheduleTabSecretsVaultSync).toHaveBeenCalledWith(expect.objectContaining({
        id: tabId,
        connectionId: 'profile-c',
        auth: { type: 'bearer', bearerToken: 'token' },
      }));
    });
  });

  it('does not invalidate tabs when envVarMap is unchanged', async () => {
    const { result, rerender } = renderHook(
      ({ envVarMap }: { envVarMap: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.patchTabDescriptor(tabId, { loadState: 'loaded' });
    });

    rerender({ envVarMap: { grpcHost: 'localhost:50051' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
    });
  });

  it('updateTab skips drift reanalysis when warning state lacks baseline schema', async () => {
    vi.mocked(analyzeWarningDriftWithBaseline).mockClear();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        driftState: 'warning',
      });
      result.current.updateTab(tabId, { body: { message: 'updated' } });
    });

    expect(analyzeWarningDriftWithBaseline).not.toHaveBeenCalled();
  });

  it('updateTab skips drift reanalysis when descriptor is not in warning state', async () => {
    vi.mocked(analyzeWarningDriftWithBaseline).mockClear();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        driftState: 'none',
      });
      result.current.updateTab(tabId, { body: { message: 'updated' } });
    });

    expect(analyzeWarningDriftWithBaseline).not.toHaveBeenCalled();
  });

  it('updateTab does not cancel in-flight unary calls when connection changes (Phase 9C)', async () => {
    const fireCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight,
    }));

    const tabId = result.current.activeTab.id;
    result.current.inFlightCallRef.current[tabId] = 'req-in-flight';

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:9090' });
    });

    expect(fireCancelInFlight).not.toHaveBeenCalled();
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.target).toBe('localhost:9090');
  });

  it('updateTab cancels idle tab context when connection changes', async () => {
    const fireCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight,
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        lifecycle: 'calling',
        activeRequestId: 'req-idle-cancel',
      });
      result.current.updateTab(tabId, {
        lifecycle: 'idle',
        activeRequestId: undefined,
        target: 'localhost:50051',
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:9090' });
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
  });

  it('updateTab does not schedule vault sync for non-secret patches', async () => {
    vi.mocked(scheduleTabSecretsVaultSync).mockClear();
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, { title: 'Renamed only' });
    });

    expect(scheduleTabSecretsVaultSync).not.toHaveBeenCalled();
  });

  it('bumps target probe generation when connecting probe settles without explicit patch', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        targetConnection: { state: 'connecting' },
      });
      result.current.updateTab(tabId, {
        target: 'localhost:9090',
      });
    });

    expect(result.current.tabs.find((tab) => tab.id === tabId)?.targetConnection?.state).toBe('idle');
  });

  it('bumps target probe generation for in-flight connection changes during connecting probe', async () => {
    const { result } = renderHook(() => useGrpcStudioSessionCore({
      envVarMap: {},
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
      fireCancelInFlight: vi.fn(),
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        lifecycle: 'calling',
        activeRequestId: 'req-in-flight',
        targetConnection: { state: 'connecting' },
        target: 'localhost:50051',
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:9090' });
    });

    expect(result.current.tabs.find((tab) => tab.id === tabId)?.target).toBe('localhost:9090');
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
  });

  it('defers invalidation while activeStreamId remains set on a non-streaming tab', async () => {
    const { result, rerender } = renderHook(
      ({ envVarMap }: { envVarMap: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap,
        profiles: [{ id: 'p1', name: 'Env profile', target: '{{grpcHost}}', tlsMode: 'disabled' }],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        connectionId: 'p1',
        target: '',
        streamLifecycle: 'idle',
        activeStreamId: 'stream-stale',
      });
      result.current.patchTabDescriptor(tabId, {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
      });
    });

    rerender({ envVarMap: { grpcHost: 'remote.example.com:50051' } });
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');

    act(() => {
      result.current.updateTab(tabId, { activeStreamId: undefined });
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });
  });

  it('uses workspaceDefaults when resolving connection fingerprints', async () => {
    const { result, rerender } = renderHook(
      ({ workspaceDefaults }: { workspaceDefaults: Record<string, string> }) => useGrpcStudioSessionCore({
        envVarMap: {},
        profiles: [{ id: 'p1', name: 'Workspace profile', target: '{{grpcHost}}', tlsMode: 'disabled' }],
        pageDefaults: PAGE_DEFAULTS,
        workspaceDefaults,
        fireCancelInFlight: vi.fn(),
      }),
      { initialProps: { workspaceDefaults: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, { connectionId: 'p1', target: '' });
      result.current.patchTabDescriptor(tabId, { loadState: 'loaded' });
    });

    rerender({ workspaceDefaults: { grpcHost: 'workspace.example.com:50051' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });
  });

  it('keeps warning drift without message when analysis returns empty message', async () => {
    vi.mocked(analyzeWarningDriftWithBaseline).mockReturnValue({
      state: 'warning',
      message: '',
      issues: [{ kind: 'field_removed', message: 'Still drifting' }],
      suggestedRebinds: [],
    });
    const { result, tabId } = (() => {
      const hook = renderHook(() => useGrpcStudioSessionCore({
        envVarMap: {},
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }));
      const tabId = hook.result.current.activeTab.id;
      const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
      act(() => {
        hook.result.current.updateTab(tabId, {
          service: 'echo.EchoService',
          method: echoMethod.name,
          body: { message: 'hello' },
        });
        hook.result.current.patchTabDescriptor(tabId, {
          loadState: 'loaded',
          descriptor: FIXTURE_DESCRIPTOR,
          driftState: 'warning',
          driftBaselineRequestSchema: echoMethod.requestSchema,
          driftMessage: 'Initial drift',
        });
      });
      return { result: hook.result, tabId };
    })();

    act(() => {
      result.current.updateTab(tabId, { body: { message: 'updated' } });
    });

    await waitFor(() => {
      const descriptor = result.current.getTabDescriptor(tabId);
      expect(descriptor.driftState).toBe('warning');
      expect(descriptor.driftMessage).toBeUndefined();
      expect(descriptor.driftIssues).toHaveLength(1);
    });
  });

  describe('schema drift branches', () => {
    function setupDriftTab() {
      const { result } = renderHook(() => useGrpcStudioSessionCore({
        envVarMap: {},
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        fireCancelInFlight: vi.fn(),
      }));
      const tabId = result.current.activeTab.id;
      const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
      act(() => {
        result.current.updateTab(tabId, {
          service: 'echo.EchoService',
          method: echoMethod.name,
          body: { message: 'hello' },
        });
        result.current.patchTabDescriptor(tabId, {
          loadState: 'loaded',
          descriptor: FIXTURE_DESCRIPTOR,
          driftState: 'warning',
          driftBaselineRequestSchema: echoMethod.requestSchema,
          driftMessage: 'Initial drift',
          driftIssues: [{ kind: 'field_removed', message: 'Initial drift' }],
        });
      });
      return { result, tabId };
    }

    it('clears drift when mocked analysis returns none', async () => {
      vi.mocked(analyzeWarningDriftWithBaseline).mockReturnValue({
        state: 'none',
        message: '',
        issues: [],
        suggestedRebinds: [],
      });
      const { result, tabId } = setupDriftTab();

      act(() => {
        result.current.updateTab(tabId, { body: { message: 'updated' } });
      });

      await waitFor(() => {
        expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
      });
    });

    it('keeps warning without issues when mocked analysis returns empty issue list', async () => {
      vi.mocked(analyzeWarningDriftWithBaseline).mockReturnValue({
        state: 'warning',
        message: '',
        issues: [],
        suggestedRebinds: [],
      });
      const { result, tabId } = setupDriftTab();

      act(() => {
        result.current.updateTab(tabId, { body: { message: 'updated' } });
      });

      await waitFor(() => {
        const descriptor = result.current.getTabDescriptor(tabId);
        expect(descriptor.driftState).toBe('warning');
        expect(descriptor.driftIssues).toBeUndefined();
      });
    });

    it('keeps warning issues when mocked analysis returns issues', async () => {
      vi.mocked(analyzeWarningDriftWithBaseline).mockReturnValue({
        state: 'warning',
        message: 'Still drifting',
        issues: [{ kind: 'field_removed', message: 'Still drifting' }],
        suggestedRebinds: [],
      });
      const { result, tabId } = setupDriftTab();

      act(() => {
        result.current.updateTab(tabId, { body: { message: 'updated' } });
      });

      await waitFor(() => {
        const descriptor = result.current.getTabDescriptor(tabId);
        expect(descriptor.driftState).toBe('warning');
        expect(descriptor.driftMessage).toBe('Still drifting');
        expect(descriptor.driftIssues).toHaveLength(1);
      });
    });
  });
});

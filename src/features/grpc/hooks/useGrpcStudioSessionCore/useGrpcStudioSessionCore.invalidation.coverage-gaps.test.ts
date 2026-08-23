/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../../grpcStudioTypes';
import { createInitialSessionState } from '../grpcStudioSessionHelpers';
import { useGrpcStudioSessionCore } from '../useGrpcStudioSessionCore';
vi.mock('../../utils/grpcTabSecretVault', () => ({
  shouldScheduleTabSecretsVaultSync: (patch: Record<string, unknown>) => (
    'tlsConfig' in patch || 'auth' in patch || 'target' in patch || 'connectionId' in patch
  ),
  scheduleTabSecretsVaultSync: vi.fn(),
}));

vi.mock('../../utils/grpcSchemaDrift', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/grpcSchemaDrift')>();
  return {
    ...actual,
    analyzeWarningDriftWithBaseline: vi.fn(actual.analyzeWarningDriftWithBaseline),
  };
});

import { scheduleTabSecretsVaultSync } from '../../utils/grpcTabSecretVault';
import { PAGE_DEFAULTS } from './useGrpcStudioSessionCoreCoverageGaps.testHelpers';

describe('useGrpcStudioSessionCore coverage gaps — invalidation and drift', () => {
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

});

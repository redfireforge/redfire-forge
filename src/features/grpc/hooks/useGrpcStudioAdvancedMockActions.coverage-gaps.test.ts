/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from '../../../shared/grpc/contractFixtures';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  resetGrpcTabCounterForTests,
} from '../grpcStudioTypes';
import { useGrpcStudioAdvancedMockActions } from './useGrpcStudioAdvancedMockActions';
import * as mockListenerClient from '../utils/grpcMockListenerClient';
import * as advancedCommands from '../utils/grpcStudioAdvancedCommands';
import { isTauri } from '../../../shared/utils/platform';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../utils/grpcMockListenerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/grpcMockListenerClient')>();
  return {
    ...actual,
    supportsGrpcMockNetworkListener: vi.fn(() => true),
    startGrpcMockNetworkListener: vi.fn(),
    stopGrpcMockNetworkListener: vi.fn().mockResolvedValue(undefined),
    commitGrpcMockNetworkListener: vi.fn(),
    exportGrpcDescriptorProtoset: vi.fn(),
  };
});

vi.mock('../../../shared/grpc/grpcTauriDescriptorBridge', () => ({
  sha256HexFromBase64: vi.fn(async () => 'abc123'),
}));

describe('useGrpcStudioAdvancedMockActions coverage gaps', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    advancedCommands.resetGrpcStudioMockRuntimeRegistryForTests();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(mockListenerClient.supportsGrpcMockNetworkListener).mockReturnValue(true);
    vi.mocked(mockListenerClient.startGrpcMockNetworkListener).mockResolvedValue({
      running: true,
      tabId: 'tab-1',
      listenTarget: '127.0.0.1:50051',
      generation: 1,
    });
    vi.mocked(mockListenerClient.exportGrpcDescriptorProtoset).mockResolvedValue({
      protosetBase64: 'dGVzdA==',
    });
  });

  function setup(tabStateOverrides: Record<string, unknown> = {}) {
    const tab = createGrpcStudioTab({
      id: 'tab-1',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      connectionId: 'conn-1',
    });
    let tabState = {
      ...createInitialGrpcTabAdvancedFeaturesUiState(),
      ...tabStateOverrides,
      mockServer: {
        ...createInitialGrpcTabAdvancedFeaturesUiState().mockServer,
        rulesJson: '{"rules":[]}',
        exposeNetworkEndpoint: true,
        ...(tabStateOverrides.mockServer as object | undefined),
      },
    };
    const patchTabState = vi.fn((
      _tabId: string,
      patch: unknown,
    ) => {
      tabState = typeof patch === 'function'
        ? (patch as (prev: typeof tabState) => typeof tabState)(tabState)
        : { ...tabState, ...(patch as object) };
    });
    const studio = {
      activeTab: tab,
      activeTabId: tab.id,
      activeTabDescriptor: {
        ...createEmptyTabDescriptorState(),
        loadState: 'loaded' as const,
        descriptor: FIXTURE_DESCRIPTOR,
      },
      profiles: [{ id: 'conn-1', name: 'Local', target: 'localhost:50051', tlsMode: 'disabled' as const }],
      tabs: [tab],
      prepareExecuteSnapshot: vi.fn(),
    };
    const hook = renderHook(() => useGrpcStudioAdvancedMockActions({
      studio,
      activeTabId: tab.id,
      activeMockConfigOverride: tabState.mockServer.mockConfigOverride,
      getTabState: () => tabState,
      patchTabState,
    }));
    return { ...hook, tabState: () => tabState, patchTabState };
  }

  it('fails loudly on Tauri when descriptor export throws', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(mockListenerClient.exportGrpcDescriptorProtoset).mockRejectedValue(new Error('export boom'));
    const { result, tabState } = setup();

    await act(async () => {
      await result.current.startMockServer();
    });

    await waitFor(() => {
      expect(tabState().runtime.mockRuntime.status).toBe('failed');
    });
    expect(tabState().runtime.mockRuntime.error?.message).toMatch(/Native mock listener requires descriptor export: export boom/);
  });

  it('fails loudly on Tauri when export returns empty protoset', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(mockListenerClient.exportGrpcDescriptorProtoset).mockResolvedValue({
      protosetBase64: '   ',
    });
    const { result, tabState } = setup();

    await act(async () => {
      await result.current.startMockServer();
    });

    await waitFor(() => {
      expect(tabState().runtime.mockRuntime.status).toBe('failed');
    });
    expect(tabState().runtime.mockRuntime.error?.message).toMatch(/requires descriptor export before start/);
  });

  it('fails loudly on Tauri when SHA-256 cannot be computed', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(mockListenerClient.exportGrpcDescriptorProtoset).mockResolvedValue({
      protosetBase64: 'dGVzdA==',
    });
    const bridge = await import('../../../shared/grpc/grpcTauriDescriptorBridge');
    vi.mocked(bridge.sha256HexFromBase64).mockReset();
    vi.mocked(bridge.sha256HexFromBase64).mockResolvedValue('');
    const { result, tabState } = setup();

    await act(async () => {
      await result.current.startMockServer();
    });

    await waitFor(() => {
      expect(tabState().runtime.mockRuntime.status).toBe('failed');
    });
    expect(tabState().runtime.mockRuntime.error?.message).toMatch(/requires full descriptor SHA-256/);
  });

  it('returns early when mock runtime is already running', async () => {
    const { result, tabState } = setup({
      runtime: {
        ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
        mockRuntime: {
          ...createInitialGrpcTabAdvancedFeaturesUiState().runtime.mockRuntime,
          status: 'running',
        },
      },
    });

    await act(async () => {
      await result.current.startMockServer();
    });
    expect(tabState().runtime.mockRuntime.status).toBe('running');
  });

  it('records parse errors when mock rules JSON is invalid', async () => {
    const { result, tabState } = setup({
      mockServer: {
        ...createInitialGrpcTabAdvancedFeaturesUiState().mockServer,
        rulesJson: '{not-json',
        exposeNetworkEndpoint: true,
      },
    });

    await act(async () => {
      await result.current.startMockServer();
    });

    await waitFor(() => {
      expect(tabState().runtime.mockRuntime.status).toBe('failed');
    });
    expect(tabState().mockServer.parseError).toBeTruthy();
  });
});

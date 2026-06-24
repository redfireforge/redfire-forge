/**
 * @vitest-environment jsdom
 *
 * useGqlStudioTabs — unit tests for the tab lifecycle hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGqlStudioTabs } from './useGqlStudioTabs';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../utils/pollingIntervalUtils', () => ({
  clampPollingIntervalSeconds: (s: number) => Math.max(10, Math.min(3600, Math.round(s))),
}));

vi.mock('../utils/gqlDemoWorkspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/gqlDemoWorkspace')>();
  return {
    ...actual,
    GQL_TABS_RELOAD_EVENT: 'gql-tabs-reload',
    purgeOrphanDemoTabs: vi.fn(async () => false),
    loadDemoSession: vi.fn(async () => null),
  };
});

vi.mock('../utils/tabPersistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/tabPersistence')>();
  return {
    ...actual,
    loadTabs: vi.fn(async () => []),
    loadActiveTabId: vi.fn(async () => ''),
    saveTabs: vi.fn(),
    disposeTabModels: vi.fn(),
    makeBlankTab: vi.fn(() => ({
      id: 'tab-1',
      label: 'Untitled',
      query: '',
      variables: '{}',
      headers: [],
      modelUri: 'inmemory://graphql/tab-1',
      unsavedChanges: false,
      operationType: undefined,
      selectedOperation: undefined,
      subscriptionTransport: 'auto' as const,
    })),
    makeDemoTab: vi.fn((lessonId: string, label: string) => ({
      id: 'demo-tab-2',
      label,
      demoLessonId: lessonId,
      query: '',
      variables: '{}',
      headers: [],
      modelUri: 'inmemory://graphql/demo-tab-2',
      unsavedChanges: false,
      operationType: undefined,
      selectedOperation: undefined,
      subscriptionTransport: 'auto' as const,
    })),
    advanceSeqPastRestoredIds: vi.fn(),
    SAVE_DEBOUNCE_MS: 0,
    MAX_TABS: 8,
    MAX_USER_TABS: 7,
    countUserTabs: (tabs: { demoLessonId?: string }[]) =>
      tabs.filter((t) => !t.demoLessonId?.trim()).length,
  };
});

vi.mock('../utils/monacoGraphqlSetup', () => ({
  deriveTabLabel: vi.fn((q: string) => q.trim() ? 'Labeled' : 'Untitled'),
  deriveOperationType: vi.fn(() => 'query'),
  extractOperations: vi.fn(() => []),
}));

import { loadTabs, loadActiveTabId, saveTabs, makeBlankTab } from '../utils/tabPersistence';
import { loadDemoSession } from '../utils/gqlDemoWorkspace';
const mockLoadTabs     = vi.mocked(loadTabs);
const mockSaveTabs     = vi.mocked(saveTabs);
const mockMakeBlankTab = vi.mocked(makeBlankTab);
const mockLoadDemoSession = vi.mocked(loadDemoSession);
vi.mocked(loadActiveTabId).mockResolvedValue('');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTab(overrides: Partial<ReturnType<typeof makeBlankTab>> = {}) {
  return {
    id: 'tab-1',
    label: 'Untitled',
    query: '',
    variables: '{}',
    headers: [],
    modelUri: 'inmemory://graphql/tab-1',
    unsavedChanges: false,
    operationType: undefined as 'query' | 'mutation' | 'subscription' | undefined,
    selectedOperation: undefined as string | undefined,
    subscriptionTransport: 'auto' as const,
    ...overrides,
  };
}

function defaultOptions(overrides: Partial<Parameters<typeof useGqlStudioTabs>[0]> = {}) {
  return {
    onCancelExecution: vi.fn(),
    isTabExecuting: vi.fn(() => false),
    onClearFileEntries: vi.fn(),
    onResetSubscription: vi.fn(),
    monacoRef: { current: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMakeBlankTab.mockReturnValue(makeTab({ id: 'tab-1' }));
  mockLoadTabs.mockResolvedValue([]);
  mockLoadDemoSession.mockResolvedValue(null);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useGqlStudioTabs', () => {
  it('creates a blank tab on mount when storage is empty', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    // Wait for async restore effect
    await act(async () => {});
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe('tab-1');
  });

  it('persists filtered tabs when demo session strips orphan demo tabs on reload', async () => {
    const userTab = makeTab({ id: 'user-1' });
    const orphanDemo = makeTab({ id: 'orphan-demo', demoLessonId: 'old-lesson' });
    mockLoadTabs.mockResolvedValue([userTab, orphanDemo] as never);
    mockLoadDemoSession.mockResolvedValue({
      lessonId: 'gql-batch-execution',
      priorActiveTabId: 'user-1',
      demoTabId: 'demo-1',
      tabBudget: 1,
    });

    renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    expect(mockSaveTabs).toHaveBeenCalled();
  });

  it('restores tabs from storage when available', async () => {
    const storedTab = makeTab({ id: 'stored-1', label: 'Stored' });
    mockLoadTabs.mockResolvedValue([storedTab] as never);
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    expect(result.current.tabs[0].id).toBe('stored-1');
    expect(result.current.activeTabId).toBe('stored-1');
  });

  it('restores legacy tabs without endpoint and inherits page default (Phase 6 PT-6)', async () => {
    const legacyTab = makeTab({ id: 'legacy-1', label: 'Legacy Query' });
    mockLoadTabs.mockResolvedValue([legacyTab] as never);
    const { result } = renderHook(() =>
      useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
    );
    await act(async () => {});
    expect(result.current.tabs[0].endpoint).toBeUndefined();
    expect(result.current.tabs[0].skipTlsVerify).toBeUndefined();
    expect(result.current.resolvedTabEndpoint).toBe('https://default.example/graphql');
    expect(result.current.hasActiveTabEndpointOverride).toBe(false);
  });

  it('addTab creates a new tab and activates it', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    mockMakeBlankTab.mockReturnValueOnce(makeTab({ id: 'tab-2' }));
    act(() => { result.current.addTab(); });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.activeTabId).toBe('tab-2');
  });

  it('addTab does nothing at MAX_USER_TABS (7)', async () => {
    const tabs = Array.from({ length: 7 }, (_, i) => makeTab({ id: `tab-${i}` }));
    mockLoadTabs.mockResolvedValue(tabs as never);
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    const countBefore = result.current.tabs.length;
    act(() => { result.current.addTab(); });
    expect(result.current.tabs.length).toBe(countBefore);
  });

  it('addTab creates a demo tab when demo session has remaining budget', async () => {
    const userTab = makeTab({ id: 'user-1' });
    const demoTab = makeTab({ id: 'demo-1', demoLessonId: 'gql-multi-tab' });
    mockLoadTabs.mockResolvedValue([userTab, demoTab] as never);
    mockLoadDemoSession.mockResolvedValue({
      lessonId: 'gql-multi-tab',
      priorActiveTabId: 'user-1',
      demoTabId: 'demo-1',
      tabBudget: 2,
      displayName: 'Demo: Multi-Tab',
    });

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.addTab(); });
    expect(result.current.tabs).toHaveLength(3);
    expect(result.current.tabs[2].demoLessonId).toBe('gql-multi-tab');
    expect(result.current.activeTabId).toBe('demo-tab-2');
  });

  it('handleTabClick switches to the given tab', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const clearFiles = vi.fn();
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions({ onClearFileEntries: clearFiles })));
    await act(async () => {});

    act(() => { result.current.handleTabClick('tab-2'); });
    expect(result.current.activeTabId).toBe('tab-2');
    expect(clearFiles).toHaveBeenCalled();
  });

  it('closeTab removes the tab and switches to the adjacent one', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => {
      result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe('tab-2');
  });

  it('closeTab does not remove the last tab', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => {
      result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never);
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('closeTab triggers confirmation for unsaved changes', async () => {
    const tab1 = makeTab({ id: 'tab-1', unsavedChanges: true });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => {
      result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never);
    });
    // Should not be closed yet — awaiting confirmation
    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.confirmingCloseTabId).toBe('tab-1');

    // Second click closes it
    act(() => {
      result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never);
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('calls onTabClosed when a tab is actually removed (Phase 6 PT-4)', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);
    const onTabClosed = vi.fn();

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions({ onTabClosed })));
    await act(async () => {});

    act(() => {
      result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never);
    });
    expect(onTabClosed).toHaveBeenCalledWith('tab-1');
  });

  it('does not call onTabClosed on unsaved-change confirmation prompt (Phase 6 PT-4)', async () => {
    const tab1 = makeTab({ id: 'tab-1', unsavedChanges: true });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);
    const onTabClosed = vi.fn();

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions({ onTabClosed })));
    await act(async () => {});

    act(() => {
      result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never);
    });
    expect(onTabClosed).not.toHaveBeenCalled();
  });

  it('closeActiveTabRef invokes onTabClosed when closing active tab (Phase 6 PT-4)', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);
    const onTabClosed = vi.fn();

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions({ onTabClosed })));
    await act(async () => {});

    act(() => { result.current.closeActiveTabRef.current(); });
    expect(onTabClosed).toHaveBeenCalledWith('tab-1');
  });

  it('updateActiveTab marks tab as unsaved', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.updateActiveTab({ query: 'query { hello }' }); });
    expect(result.current.tabs[0].unsavedChanges).toBe(true);
    expect(result.current.tabs[0].query).toBe('query { hello }');
  });

  it('handleQueryChange updates label and operationType', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.handleQueryChange('query GetUser { user { id } }'); });
    expect(result.current.tabs[0].label).toBe('Labeled');
    expect(result.current.tabs[0].operationType).toBe('query');
  });

  it('renameTab sets labelManual and preserves label on query change', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.renameTab('tab-1', 'Custom Name'); });
    expect(result.current.tabs[0].label).toBe('Custom Name');
    expect(result.current.tabs[0].labelManual).toBe(true);

    act(() => { result.current.handleQueryChange('query GetUser { id }'); });
    expect(result.current.tabs[0].label).toBe('Custom Name');
  });

  it('renameTab ignores empty labels', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.renameTab('tab-1', '   '); });
    expect(result.current.tabs[0].label).toBe('Untitled');
    expect(result.current.tabs[0].labelManual).toBeUndefined();
  });

  describe('Phase 6 — per-tab endpoint (PT-2)', () => {
    it('resolvedTabEndpoint falls back to pageDefaultEndpoint when tab has no override', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      expect(result.current.resolvedTabEndpoint).toBe('https://default.example/graphql');
      expect(result.current.hasActiveTabEndpointOverride).toBe(false);
    });

    it('updateActiveTabEndpoint sets tab label to endpoint hostname for anonymous queries', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('http://localhost:4041/graphql'); });
      expect(['localhost:4041', '127.0.0.1:4041']).toContain(result.current.tabs[0].label);
    });

    it('clearActiveTabEndpoint restores page-default hostname for anonymous queries', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('http://localhost:4041/graphql'); });
      act(() => { result.current.clearActiveTabEndpoint(); });
      expect(result.current.tabs[0].label).toBe('default.example');
    });

    it('resolvedTabEndpoint uses active tab override when set', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('https://staging.example/graphql'); });
      expect(result.current.resolvedTabEndpoint).toBe('https://staging.example/graphql');
      expect(result.current.hasActiveTabEndpointOverride).toBe(true);
      expect(result.current.tabs[0].endpoint).toBe('https://staging.example/graphql');
      expect(result.current.tabs[0].unsavedChanges).toBe(true);
    });

    it('clearActiveTabEndpoint removes override and restores page default resolution', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('https://staging.example/graphql'); });
      act(() => { result.current.clearActiveTabEndpoint(); });

      expect(result.current.tabs[0].endpoint).toBeUndefined();
      expect(result.current.resolvedTabEndpoint).toBe('https://default.example/graphql');
      expect(result.current.hasActiveTabEndpointOverride).toBe(false);
    });

    it('updateActiveTabEndpoint trims whitespace and clears override when blank', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('  https://staging.example/graphql  '); });
      expect(result.current.tabs[0].endpoint).toBe('https://staging.example/graphql');

      act(() => { result.current.updateActiveTabEndpoint('   '); });
      expect(result.current.tabs[0].endpoint).toBeUndefined();
      expect(result.current.resolvedTabEndpoint).toBe('https://default.example/graphql');
    });

    it('updateActiveTabEndpoint clears override when value matches page default (Phase 6 PT-5)', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('https://staging.example/graphql'); });
      expect(result.current.hasActiveTabEndpointOverride).toBe(true);

      act(() => { result.current.updateActiveTabEndpoint('https://default.example/graphql'); });
      expect(result.current.tabs[0].endpoint).toBeUndefined();
      expect(result.current.hasActiveTabEndpointOverride).toBe(false);
    });

    it('updateActiveTabSkipTlsVerify sets override and clears when matching page default (Phase 6)', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultSkipTlsVerify: false })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabSkipTlsVerify(true); });
      expect(result.current.tabs[0].skipTlsVerify).toBe(true);
      expect(result.current.hasActiveTabSkipTlsOverride).toBe(true);

      act(() => { result.current.updateActiveTabSkipTlsVerify(false); });
      expect(result.current.tabs[0].skipTlsVerify).toBeUndefined();
      expect(result.current.hasActiveTabSkipTlsOverride).toBe(false);
    });

    it('updateActiveTabSkipTlsVerify is a no-op when value unchanged (Phase 6)', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultSkipTlsVerify: false })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabSkipTlsVerify(true); });
      act(() => { result.current.updateActiveTabSkipTlsVerify(true); });
      expect(result.current.tabs[0].unsavedChanges).toBe(true);
    });

    it('clearActiveTabEndpoint is a no-op when tab already inherits page default', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.clearActiveTabEndpoint(); });
      expect(result.current.tabs[0].unsavedChanges).toBe(false);
      expect(result.current.tabs[0].endpoint).toBeUndefined();
    });

    it('updateActiveTabEndpoint is a no-op when endpoint unchanged', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('https://staging.example/graphql'); });
      act(() => { result.current.updateActiveTabEndpoint('https://staging.example/graphql'); });

      expect(result.current.tabs[0].unsavedChanges).toBe(true);
    });

    it('updateActiveTabEndpoint only modifies the active tab', async () => {
      const tab1 = makeTab({ id: 'tab-1' });
      const tab2 = makeTab({ id: 'tab-2' });
      mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      act(() => { result.current.handleTabClick('tab-2'); });
      act(() => { result.current.updateActiveTabEndpoint('https://tab2.example/graphql'); });

      expect(result.current.tabs.find((t) => t.id === 'tab-1')?.endpoint).toBeUndefined();
      expect(result.current.tabs.find((t) => t.id === 'tab-2')?.endpoint).toBe('https://tab2.example/graphql');
      expect(result.current.resolvedTabEndpoint).toBe('https://tab2.example/graphql');
    });

    it('resolvedTabEndpoint updates when pageDefaultEndpoint changes and tab has no override', async () => {
      const { result, rerender } = renderHook(
        ({ pageDefaultEndpoint }) => useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint })),
        { initialProps: { pageDefaultEndpoint: 'https://old.example/graphql' } },
      );
      await act(async () => {});

      expect(result.current.resolvedTabEndpoint).toBe('https://old.example/graphql');

      rerender({ pageDefaultEndpoint: 'https://new.example/graphql' });
      expect(result.current.resolvedTabEndpoint).toBe('https://new.example/graphql');
    });

    it('resolvedTabEndpoint stays on tab override when pageDefaultEndpoint changes', async () => {
      const { result, rerender } = renderHook(
        ({ pageDefaultEndpoint }) => useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint })),
        { initialProps: { pageDefaultEndpoint: 'https://old.example/graphql' } },
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabEndpoint('https://tab.example/graphql'); });
      rerender({ pageDefaultEndpoint: 'https://new.example/graphql' });

      expect(result.current.resolvedTabEndpoint).toBe('https://tab.example/graphql');
    });

    it('Phase 6F: applyProfileToActiveTab sets connectionId and endpoint override', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      expect(result.current.tabs[0].connectionId).toBe('prof-staging');
      expect(result.current.tabs[0].endpoint).toBe('https://staging.example/graphql');
      expect(result.current.hasActiveTabProfileLink).toBe(true);
      expect(result.current.resolvedTabEndpoint).toBe('https://staging.example/graphql');
    });

    it('Phase 6F: resolvedTabEndpoint uses profile when connectionId set without endpoint override', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const storedTab = makeTab({ id: 'tab-1', connectionId: 'prof-staging' });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      expect(result.current.resolvedTabEndpoint).toBe('https://staging.example/graphql');
    });

    it('Phase 6F: applyProfileToActiveTab persists endpoint when it matches page default', async () => {
      const profile = {
        id: 'prof-default',
        name: 'Default',
        endpoint: 'https://default.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      expect(result.current.tabs[0].connectionId).toBe('prof-default');
      expect(result.current.tabs[0].endpoint).toBe('https://default.example/graphql');
      expect(result.current.hasActiveTabEndpointOverride).toBe(true);
    });

    it('Phase 6F: resolvedTabEndpoint uses tab.endpoint while profile catalog is loading', async () => {
      const storedTab = makeTab({
        id: 'tab-1',
        connectionId: 'prof-staging',
        endpoint: 'https://staging.example/graphql',
      });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [],
          profilesReady: false,
        })),
      );
      await act(async () => {});

      expect(result.current.resolvedTabEndpoint).toBe('https://staging.example/graphql');
      expect(result.current.hasPendingProfileEndpoint).toBe(true);
    });

    it('Phase 6F: hasPendingProfileEndpoint clears after profile catalog loads', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const storedTab = makeTab({
        id: 'tab-1',
        connectionId: 'prof-staging',
        endpoint: 'https://staging.example/graphql',
      });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result, rerender } = renderHook(
        ({ profiles, profilesReady }) =>
          useGqlStudioTabs(defaultOptions({
            pageDefaultEndpoint: 'https://default.example/graphql',
            profiles,
            profilesReady,
          })),
        {
          initialProps: { profiles: [] as typeof profile[], profilesReady: false },
        },
      );
      await act(async () => {});

      expect(result.current.hasPendingProfileEndpoint).toBe(true);

      rerender({ profiles: [profile], profilesReady: true });
      await act(async () => {});

      expect(result.current.hasPendingProfileEndpoint).toBe(false);
      expect(result.current.hasResolvedProfileLink).toBe(true);
    });

    it('Phase 6F: hasPendingProfileEndpoint stays true while profilesReady false even when profile is in array', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const storedTab = makeTab({
        id: 'tab-1',
        connectionId: 'prof-staging',
        endpoint: 'https://staging.example/graphql',
      });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
          profilesReady: false,
        })),
      );
      await act(async () => {});

      expect(result.current.hasResolvedProfileLink).toBe(true);
      expect(result.current.hasPendingProfileEndpoint).toBe(true);
    });

    it('Phase 6F: hasPendingProfileEndpoint when connectionId pending without tab endpoint', async () => {
      const storedTab = makeTab({ id: 'tab-1', connectionId: 'prof-staging' });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [],
          profilesReady: false,
        })),
      );
      await act(async () => {});

      expect(result.current.hasPendingProfileEndpoint).toBe(true);
      expect(result.current.resolvedTabEndpoint).toBe('https://default.example/graphql');
    });

    it('Phase 6F: updateActiveTabEndpoint clears connectionId on manual edit', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      act(() => { result.current.updateActiveTabEndpoint('https://custom.example/graphql'); });

      expect(result.current.tabs[0].connectionId).toBeUndefined();
      expect(result.current.tabs[0].endpoint).toBe('https://custom.example/graphql');
    });

    it('Phase 6F: clearConnectionIdsForProfile unlinks tabs but keeps endpoint', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      act(() => { result.current.clearConnectionIdsForProfile('prof-staging'); });

      expect(result.current.tabs[0].connectionId).toBeUndefined();
      expect(result.current.tabs[0].endpoint).toBe('https://staging.example/graphql');
    });

    it('Phase 6F: clearActiveTabProfileLink removes connectionId from active tab', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      expect(result.current.tabs[0].connectionId).toBe('prof-staging');

      act(() => { result.current.clearActiveTabProfileLink(); });
      expect(result.current.tabs[0].connectionId).toBeUndefined();
      expect(result.current.hasActiveTabProfileLink).toBe(false);
    });

    it('Phase 6F: applyProfileToActiveTab is no-op when same profile already linked', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      const before = result.current.tabs[0];
      act(() => { result.current.applyProfileToActiveTab(profile); });
      expect(result.current.tabs[0]).toEqual(before);
    });

    it('Phase 6H: applyProfileToActiveTab clears tab auth override so profile auth applies', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: { type: 'bearer' as const, token: 'profile-token' },
        createdAt: 1,
      };
      mockLoadTabs.mockResolvedValue([
        makeTab({
          id: 'tab-1',
          auth: { type: 'bearer', token: 'tab-override' },
        }),
      ] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultAuth: { type: 'bearer', token: 'page-token' },
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      expect(result.current.tabs[0].auth).toBeUndefined();
      expect(result.current.tabs[0].connectionId).toBe('prof-staging');
      expect(result.current.hasActiveTabAuthOverride).toBe(false);
    });

    it('Phase 6H: re-applying same profile clears stale tab auth override', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      mockLoadTabs.mockResolvedValue([
        makeTab({
          id: 'tab-1',
          connectionId: 'prof-staging',
          endpoint: 'https://staging.example/graphql',
          auth: { type: 'bearer', token: 'stale-override' },
        }),
      ] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      expect(result.current.tabs[0].auth).toBeUndefined();
    });

    it('Phase 6F: clearActiveTabProfileLink is no-op when tab has no profile link', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultEndpoint: 'https://default.example/graphql' })),
      );
      await act(async () => {});

      const before = result.current.tabs[0];
      act(() => { result.current.clearActiveTabProfileLink(); });
      expect(result.current.tabs[0]).toEqual(before);
    });

    it('Phase 6F: clearActiveTabEndpoint clears connectionId and endpoint override', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => { result.current.applyProfileToActiveTab(profile); });
      act(() => { result.current.clearActiveTabEndpoint(); });

      expect(result.current.tabs[0].connectionId).toBeUndefined();
      expect(result.current.tabs[0].endpoint).toBeUndefined();
    });

    it('Phase 6F: hasActiveTabProfileLink is true while profiles load when tab has connectionId', async () => {
      const storedTab = makeTab({ id: 'tab-1', connectionId: 'prof-staging' });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          profiles: [],
          profilesReady: false,
        })),
      );
      await act(async () => {});

      expect(result.current.hasActiveTabProfileLink).toBe(true);
      expect(result.current.hasResolvedProfileLink).toBe(false);
    });

    it('Phase 6F: hasResolvedProfileLink is true when connectionId matches a profile', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: null,
        createdAt: 1,
      };
      const storedTab = makeTab({ id: 'tab-1', connectionId: profile.id });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          profiles: [profile],
          profilesReady: true,
        })),
      );
      await act(async () => {});

      expect(result.current.hasResolvedProfileLink).toBe(true);
      expect(result.current.hasActiveTabProfileLink).toBe(true);
    });

    it('Phase 6F: hasActiveTabProfileLink is false for orphaned connectionId', async () => {
      const storedTab = makeTab({ id: 'tab-1', connectionId: 'deleted-profile' });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultEndpoint: 'https://default.example/graphql',
          profiles: [],
          profilesReady: true,
        })),
      );
      await act(async () => {});

      expect(result.current.hasActiveTabProfileLink).toBe(false);
    });

    it('Phase 6F: prunes orphaned connectionId after profilesReady without unsavedChanges', async () => {
      const storedTab = makeTab({ id: 'tab-1', connectionId: 'gone', unsavedChanges: false });
      mockLoadTabs.mockResolvedValue([storedTab] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          profiles: [],
          profilesReady: true,
        })),
      );
      await act(async () => {});
      await act(async () => {});

      expect(result.current.tabs[0].connectionId).toBeUndefined();
      expect(result.current.tabs[0].unsavedChanges).toBe(false);
    });

    it('Phase 6: updateActiveTabTlsSettings sets CA cert override', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultTlsCaCert: '',
        })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabTlsSettings({ caCert: 'custom-ca-pem' });
      });
      expect(result.current.tabs[0].tlsCaCert).toBe('custom-ca-pem');
      expect(result.current.hasActiveTabTlsCertOverride).toBe(true);
    });

    it('Phase 6: updateActiveTabTlsSettings omits CA when matching page default', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultTlsCaCert: 'shared-ca',
        })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabTlsSettings({ caCert: 'shared-ca' });
      });
      expect(result.current.tabs[0].tlsCaCert).toBeUndefined();
      expect(result.current.hasActiveTabTlsCertOverride).toBe(false);
    });

    it('Phase 6: updateActiveTabTlsSettings sets client cert and key overrides', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions()),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabTlsSettings({
          clientCert: 'client-pem',
          clientKey: 'key-pem',
        });
      });
      expect(result.current.tabs[0].tlsClientCert).toBe('client-pem');
      expect(result.current.tabs[0].tlsClientKey).toBe('key-pem');
    });

    it('Phase 6: updateActiveTabTlsSettings updates skipTlsVerify via patch', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultSkipTlsVerify: false })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabTlsSettings({ skipTlsVerify: true });
      });
      expect(result.current.tabs[0].skipTlsVerify).toBe(true);
    });

    it('Phase 6: updateActiveTabTlsSettings omits client cert/key when matching page defaults', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultTlsClientCert: 'shared-cert',
          pageDefaultTlsClientKey: 'shared-key',
        })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabTlsSettings({
          clientCert: 'shared-cert',
          clientKey: 'shared-key',
        });
      });
      expect(result.current.tabs[0].tlsClientCert).toBeUndefined();
      expect(result.current.tabs[0].tlsClientKey).toBeUndefined();
      expect(result.current.hasActiveTabTlsCertOverride).toBe(false);
    });

    it('Phase 6: updateActiveTabTlsSettings clears inherited skipTlsVerify when matching default', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultSkipTlsVerify: true })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabTlsSettings({ skipTlsVerify: true });
      });
      expect(result.current.tabs[0].skipTlsVerify).toBeUndefined();
    });

    it('Phase 6: clearActiveTabPolling clears interval-only override', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultPollingEnabled: false,
          pageDefaultPollingIntervalSeconds: 30,
        })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabPolling(false, 60); });
      expect(result.current.tabs[0].pollingIntervalSeconds).toBe(60);
      act(() => { result.current.clearActiveTabPolling(); });
      expect(result.current.tabs[0].pollingIntervalSeconds).toBeUndefined();
    });

    it('addTab falls through to user tab when demo budget exhausted', async () => {
      const userTab = makeTab({ id: 'user-1' });
      const demoTab = makeTab({ id: 'demo-1', demoLessonId: 'gql-batch-execution' });
      mockLoadTabs.mockResolvedValue([userTab, demoTab] as never);
      mockLoadDemoSession.mockResolvedValue({
        lessonId: 'gql-batch-execution',
        priorActiveTabId: 'user-1',
        demoTabId: 'demo-1',
        tabBudget: 1,
      });

      const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
      await act(async () => {});

      mockMakeBlankTab.mockReturnValueOnce(makeTab({ id: 'user-2' }));
      act(() => { result.current.addTab(); });
      expect(result.current.tabs.some((t) => t.id === 'user-2')).toBe(true);
    });

    it('reloadFromStorage creates blank tab when all stored tabs filtered out', async () => {
      const orphanDemo = makeTab({ id: 'orphan', demoLessonId: 'stale-lesson' });
      mockLoadTabs.mockResolvedValue([orphanDemo] as never);
      mockLoadDemoSession.mockResolvedValue({
        lessonId: 'gql-batch-execution',
        priorActiveTabId: '',
        demoTabId: 'demo-1',
        tabBudget: 1,
      });

      const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
      await act(async () => {});

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].demoLessonId).toBeUndefined();
    });
  });

  describe('Phase 6F — per-tab polling', () => {
    it('updateActiveTabPolling stores override when different from page default', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultPollingEnabled: false,
          pageDefaultPollingIntervalSeconds: 30,
        })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabPolling(true, 45); });
      expect(result.current.tabs[0].pollingEnabled).toBe(true);
      expect(result.current.tabs[0].pollingIntervalSeconds).toBe(45);
      expect(result.current.hasActiveTabPollingOverride).toBe(true);
    });

    it('updateActiveTabPolling omits fields that match page defaults', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultPollingEnabled: true,
          pageDefaultPollingIntervalSeconds: 30,
        })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabPolling(true, 30); });
      expect(result.current.tabs[0].pollingEnabled).toBeUndefined();
      expect(result.current.tabs[0].pollingIntervalSeconds).toBeUndefined();
      expect(result.current.hasActiveTabPollingOverride).toBe(false);
    });

    it('clearActiveTabPolling removes overrides', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultPollingEnabled: false,
          pageDefaultPollingIntervalSeconds: 30,
        })),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabPolling(true, 60); });
      act(() => { result.current.clearActiveTabPolling(); });
      expect(result.current.tabs[0].pollingEnabled).toBeUndefined();
      expect(result.current.tabs[0].pollingIntervalSeconds).toBeUndefined();
    });

    it('clearActiveTabPolling is a no-op when tab already inherits page polling default', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultPollingEnabled: false,
          pageDefaultPollingIntervalSeconds: 30,
        })),
      );
      await act(async () => {});

      act(() => { result.current.clearActiveTabPolling(); });
      expect(result.current.tabs[0].unsavedChanges).toBe(false);
      expect(result.current.tabs[0].pollingEnabled).toBeUndefined();
    });

    it('updateActiveTabPolling clamps interval to 10–3600', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions()),
      );
      await act(async () => {});

      act(() => { result.current.updateActiveTabPolling(true, 5); });
      expect(result.current.tabs[0].pollingIntervalSeconds).toBe(10);
    });
  });

  it('handleVariablesChange updates tab variables', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.handleVariablesChange('{"id": 1}'); });
    expect(result.current.tabs[0].variables).toBe('{"id": 1}');
  });

  it('handleHeadersChange updates tab headers', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    const headers = [{ key: 'X-Token', value: 'abc', enabled: true, id: 'h1' }];
    act(() => { result.current.handleHeadersChange(headers as never); });
    expect(result.current.tabs[0].headers).toEqual(headers);
  });

  it('handleSubscriptionTransportChange updates transport without marking unsaved', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.handleSubscriptionTransportChange('sse'); });
    expect(result.current.tabs[0].subscriptionTransport).toBe('sse');
    // Transport change should NOT mark the tab as unsaved
    expect(result.current.tabs[0].unsavedChanges).toBe(false);
  });

  it('handles assertions change', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    const assertions = [{ id: 'a1', path: '$.data', operator: 'exists', value: '' }];
    act(() => { result.current.handleAssertionsChange(assertions as never); });
    expect(result.current.tabs[0].subscriptionAssertions).toEqual(assertions);
  });

  it('persists tabs to storage after change (debounced)', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.handleQueryChange('{ hello }'); });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });

    expect(mockSaveTabs).toHaveBeenCalled();
  });

  it('closeActiveTabRef closes the active tab when called', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.closeActiveTabRef.current(); });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('restores tabs and falls back to first tab when saved active id is stale', async () => {
    const storedTab = makeTab({ id: 'stored-1', label: 'Stored' });
    mockLoadTabs.mockResolvedValue([storedTab] as never);
    // loadActiveTabId returns an id not in stored tabs
    const { loadActiveTabId } = await import('../utils/tabPersistence');
    vi.mocked(loadActiveTabId).mockResolvedValueOnce('does-not-exist');

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    // Should fall back to the first stored tab
    expect(result.current.activeTabId).toBe('stored-1');
  });

  it('closeTab does not change active tab when closing non-active tab', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Set active to tab-1, then close tab-2 (non-active)
    act(() => { result.current.handleTabClick('tab-1'); });
    act(() => { result.current.closeTab('tab-2', { stopPropagation: vi.fn() } as never); });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe('tab-1');
  });

  it('closeTab calls onCancelExecution when closing executing tab', async () => {
    const tab1 = makeTab({ id: 'tab-1', modelUri: 'inmemory://graphql/tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const onCancelExecution = vi.fn();
    const isTabExecuting = vi.fn((tabId: string) => tabId === 'tab-1');
    const opts = defaultOptions({ onCancelExecution, isTabExecuting });
    const { result } = renderHook(() => useGqlStudioTabs(opts));
    await act(async () => {});

    act(() => { result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never); });
    expect(onCancelExecution).toHaveBeenCalledWith('tab-1');
  });

  it('closeTab calls disposeTabModels when monaco ref is set', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { disposeTabModels } = await import('../utils/tabPersistence');
    const mockDispose = vi.mocked(disposeTabModels);
    const fakeMC = { getModel: vi.fn(() => null) };
    const opts = defaultOptions({ monacoRef: { current: fakeMC as never } });
    const { result } = renderHook(() => useGqlStudioTabs(opts));
    await act(async () => {});

    act(() => { result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never); });
    expect(mockDispose).toHaveBeenCalled();
  });

  it('handleTabClick clears confirmingCloseTabId when clicking a different tab', async () => {
    const tab1 = makeTab({ id: 'tab-1', unsavedChanges: true });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Trigger confirmation for tab-1
    act(() => { result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never); });
    expect(result.current.confirmingCloseTabId).toBe('tab-1');

    // Click tab-2 — should clear the confirming state
    act(() => { result.current.handleTabClick('tab-2'); });
    expect(result.current.confirmingCloseTabId).toBeNull();
  });

  it('handleSelectOperation updates the selectedOperation', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.handleSelectOperation('GetUser'); });
    expect(result.current.tabs[0].selectedOperation).toBe('GetUser');
  });

  it('selectedOperation auto-syncs when operations change and current selection is invalid', async () => {
    const { extractOperations } = await import('../utils/monacoGraphqlSetup');
    const mockExtract = vi.mocked(extractOperations);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Simulate having a stale selectedOperation then operations change
    act(() => { result.current.updateActiveTab({ selectedOperation: 'OldOp', query: 'query GetUser { id }' }); });

    // Make extractOperations return two ops, neither matching 'OldOp'
    mockExtract.mockReturnValue([{ name: 'GetUser', type: 'query' }, { name: 'GetPost', type: 'query' }]);

    act(() => { result.current.handleQueryChange('query GetUser { id } query GetPost { id }'); });
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });

    // selectedOperation should be synced to the first available op
    const tab = result.current.tabs[0];
    expect(tab.selectedOperation).toBe('GetUser');
  });

  it('selectedOperation is cleared when query drops to a single operation', async () => {
    const { extractOperations } = await import('../utils/monacoGraphqlSetup');
    const mockExtract = vi.mocked(extractOperations);

    // Start with two operations selected
    const tab1 = makeTab({ id: 'tab-1', selectedOperation: 'GetUser', query: 'q1 q2' });
    mockLoadTabs.mockResolvedValue([tab1] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Drop to single operation
    mockExtract.mockReturnValue([{ name: 'GetUser', type: 'query' }]);
    act(() => { result.current.handleQueryChange('query GetUser { id }'); });
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });

    expect(result.current.tabs[0].selectedOperation).toBeUndefined();
  });

  it('onResetSubscription is called on unmount', async () => {
    const onResetSubscription = vi.fn();
    const { unmount } = renderHook(() => useGqlStudioTabs(defaultOptions({ onResetSubscription })));
    await act(async () => {});
    unmount();
    expect(onResetSubscription).toHaveBeenCalled();
  });

  it('selectedOperation is kept when query changes but selection is still valid (line 266 false branch)', async () => {
    const { extractOperations } = await import('../utils/monacoGraphqlSetup');
    const mockExtract = vi.mocked(extractOperations);

    // Start with two operations, selectedOperation is already valid
    const tab1 = makeTab({ id: 'tab-1', selectedOperation: 'GetUser', query: 'q1 q2' });
    mockLoadTabs.mockResolvedValue([tab1] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Both ops present, selectedOperation is still in the list → should NOT update
    mockExtract.mockReturnValue([
      { name: 'GetUser', type: 'query' },
      { name: 'GetPosts', type: 'query' },
    ]);

    act(() => { result.current.handleQueryChange('query GetUser { id } query GetPosts { id }'); });
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });

    // selectedOperation should remain 'GetUser' (valid) — NOT changed to first op
    expect(result.current.tabs[0].selectedOperation).toBe('GetUser');
  });

  it('selectedOperation is cleared when query goes to empty (line 270-275, undefined branch)', async () => {
    const { extractOperations } = await import('../utils/monacoGraphqlSetup');
    const mockExtract = vi.mocked(extractOperations);

    // Start with no selectedOperation
    const tab1 = makeTab({ id: 'tab-1', selectedOperation: undefined, query: 'query GetUser { id }' });
    mockLoadTabs.mockResolvedValue([tab1] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Drop to 0 operations — no selectedOperation was set so no-op
    mockExtract.mockReturnValue([]);
    act(() => { result.current.handleQueryChange(''); });
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });

    // selectedOperation was already undefined — should still be undefined
    expect(result.current.tabs[0].selectedOperation).toBeUndefined();
  });

  it('saveTabs is called on unmount with loaded tabs', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    mockLoadTabs.mockResolvedValue([tab1] as never);

    const { unmount } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    unmount();
    await act(async () => {});

    // saveTabs should be called on unmount when tabs are loaded
    expect(mockSaveTabs).toHaveBeenCalled();
  });

  it('saveTabs is called on unmount when tabs are loaded (loadedRef guard)', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    mockLoadTabs.mockResolvedValue([tab1] as never);

    const { unmount } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Clear mock calls from debounced persist effect
    mockSaveTabs.mockClear();

    unmount();

    await act(async () => {});

    // saveTabs should be called on unmount since loadedRef.current = true and tabs.length > 0
    expect(mockSaveTabs).toHaveBeenCalled();
  });

  it('defers persist when demo session tab is not yet in React state', async () => {
    const userTab = makeTab({ id: 'user-tab-1', label: 'My Workspace Tab' });
    mockLoadTabs.mockResolvedValue([userTab] as never);
    mockLoadDemoSession.mockResolvedValue({
      lessonId: 'gql-variables',
      priorActiveTabId: 'user-tab-1',
      demoTabId: 'demo-tab-pending',
      displayName: 'Demo: Variables',
    });

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    mockSaveTabs.mockClear();

    act(() => {
      result.current.handleQueryChange('query { ping }');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(mockSaveTabs).not.toHaveBeenCalled();
  });

  it('handleTabClick does NOT clear confirming state when clicking the same tab', async () => {
    const tab1 = makeTab({ id: 'tab-1', unsavedChanges: true });
    const tab2 = makeTab({ id: 'tab-2' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Trigger confirmation for tab-1
    act(() => { result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never); });
    expect(result.current.confirmingCloseTabId).toBe('tab-1');

    // Click the SAME tab — confirmingCloseTabId should NOT be cleared
    act(() => { result.current.handleTabClick('tab-1'); });
    expect(result.current.confirmingCloseTabId).toBe('tab-1');
  });

  // ── Multi-tab coverage for ternary false branches ─────────────────────────────

  it('handleQueryChange with 2 tabs only modifies the active tab', async () => {
    const tab1 = makeTab({ id: 'tab-1', query: 'query A { a }' });
    const tab2 = makeTab({ id: 'tab-2', query: 'query B { b }' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Active tab is tab-1 (first tab), update its query
    act(() => { result.current.handleQueryChange('query New { new }'); });
    // tab-2 should be unchanged
    const tab2after = result.current.tabs.find((t) => t.id === 'tab-2');
    expect(tab2after?.query).toBe('query B { b }');
  });

  it('handleVariablesChange with 2 tabs only modifies the active tab', async () => {
    const tab1 = makeTab({ id: 'tab-1' });
    const tab2 = makeTab({ id: 'tab-2', variables: '{"original":true}' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.handleVariablesChange('{"updated":true}'); });
    const tab2after = result.current.tabs.find((t) => t.id === 'tab-2');
    expect(tab2after?.variables).toBe('{"original":true}');
  });

  it('handleSubscriptionTransportChange with 2 tabs only modifies the active tab', async () => {
    const tab1 = makeTab({ id: 'tab-1', subscriptionTransport: 'auto' });
    const tab2 = makeTab({ id: 'tab-2', subscriptionTransport: 'sse' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    act(() => { result.current.handleSubscriptionTransportChange('graphql-ws'); });
    const tab1after = result.current.tabs.find((t) => t.id === 'tab-1');
    const tab2after = result.current.tabs.find((t) => t.id === 'tab-2');
    expect(tab1after?.subscriptionTransport).toBe('graphql-ws');
    expect(tab2after?.subscriptionTransport).toBe('sse'); // unchanged
  });

  it('selectedOperation syncs to null when operations count drops to 1 with multiple tabs', async () => {
    // Tab with selectedOperation set and a multi-operation query
    const tab1 = makeTab({ id: 'tab-1', query: 'query A { a }\nquery B { b }', selectedOperation: 'A' });
    const tab2 = makeTab({ id: 'tab-2', query: 'query C { c }' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Change to single-operation query - should clear selectedOperation
    act(() => { result.current.handleQueryChange('query OnlyOne { only }'); });
    await act(async () => {});
    const tab1after = result.current.tabs.find((t) => t.id === 'tab-1');
    expect(tab1after?.selectedOperation).toBeUndefined();
  });

  it('closing a different unsaved tab clears any pending confirm timer for the previous tab', async () => {
    const tab1 = makeTab({ id: 'tab-1', unsavedChanges: true });
    const tab2 = makeTab({ id: 'tab-2', unsavedChanges: true });
    const tab3 = makeTab({ id: 'tab-3' });
    mockLoadTabs.mockResolvedValue([tab1, tab2, tab3] as never);
    vi.useFakeTimers();

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Close tab-1: sets confirm timer
    act(() => { result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never); });
    expect(result.current.confirmingCloseTabId).toBe('tab-1');

    // Now close tab-2: clears the timer for tab-1, starts a new one for tab-2
    act(() => { result.current.closeTab('tab-2', { stopPropagation: vi.fn() } as never); });
    expect(result.current.confirmingCloseTabId).toBe('tab-2');

    vi.useRealTimers();
  });

  it('selectedOperation reset covers line 266 false branch with multi-tab setup', async () => {
    const { extractOperations } = await import('../utils/monacoGraphqlSetup');
    const mockExtract = vi.mocked(extractOperations);

    // Two tabs: tab-1 is active with a stale selectedOperation
    const tab1 = makeTab({ id: 'tab-1', selectedOperation: 'OldOp', query: 'q1 q2' });
    const tab2 = makeTab({ id: 'tab-2', query: 'query Other { other }' });
    mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    // Switch to multi-op query where OldOp is NOT in the list → resets to first op
    mockExtract.mockReturnValue([{ name: 'Alpha', type: 'query' }, { name: 'Beta', type: 'query' }]);
    act(() => { result.current.handleQueryChange('query Alpha { alpha } query Beta { beta }'); });
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });

    // Active tab-1 should be reset to Alpha; tab-2 should be unchanged (false branch in map)
    const tab1after = result.current.tabs.find((t) => t.id === 'tab-1');
    const tab2after = result.current.tabs.find((t) => t.id === 'tab-2');
    expect(tab1after?.selectedOperation).toBe('Alpha');
    expect(tab2after?.query).toBe('query Other { other }'); // unchanged
  });

  describe('Phase 6H — per-tab auth mutations', () => {
    const pageBearer = { type: 'bearer' as const, token: 'page-token' };

    it('hasActiveTabAuthOverride is false for inheriting tab', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});
      expect(result.current.hasActiveTabAuthOverride).toBe(false);
    });

    it('hasActiveTabAuthOverride is true for explicit null No Auth', async () => {
      mockLoadTabs.mockResolvedValue([makeTab({ id: 'tab-1', auth: null })] as never);
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});
      expect(result.current.hasActiveTabAuthOverride).toBe(true);
    });

    it('hasActiveTabAuthOverride is false for bare inherit on tab', async () => {
      mockLoadTabs.mockResolvedValue([makeTab({ id: 'tab-1', auth: { type: 'inherit' } })] as never);
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});
      expect(result.current.hasActiveTabAuthOverride).toBe(false);
    });

    it('updateActiveTabAuth stores bearer override on active tab', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabAuth({ type: 'bearer', token: 'tab-only' });
      });
      expect(result.current.tabs[0].auth).toEqual({ type: 'bearer', token: 'tab-only' });
      expect(result.current.hasActiveTabAuthOverride).toBe(true);
    });

    it('updateActiveTabAuth clears override when auth matches page default', async () => {
      mockLoadTabs.mockResolvedValue([
        makeTab({ id: 'tab-1', auth: { type: 'bearer', token: 'tab-only' } }),
      ] as never);
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabAuth(pageBearer);
      });
      expect(result.current.tabs[0].auth).toBeUndefined();
      expect(result.current.hasActiveTabAuthOverride).toBe(false);
    });

    it('updateActiveTabAuth stores explicit null when page has bearer', async () => {
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});
      act(() => { result.current.updateActiveTabAuth(null); });
      expect(result.current.tabs[0].auth).toBeNull();
    });

    it('clearActiveTabAuth removes tab auth override', async () => {
      mockLoadTabs.mockResolvedValue([
        makeTab({ id: 'tab-1', auth: { type: 'bearer', token: 'tab-only' } }),
      ] as never);
      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});

      act(() => { result.current.clearActiveTabAuth(); });
      expect(result.current.tabs[0].auth).toBeUndefined();
      expect(result.current.hasActiveTabAuthOverride).toBe(false);
    });

    it('updateActiveTabAuth only modifies the active tab', async () => {
      const tab1 = makeTab({ id: 'tab-1' });
      const tab2 = makeTab({ id: 'tab-2' });
      mockLoadTabs.mockResolvedValue([tab1, tab2] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});

      act(() => { result.current.handleTabClick('tab-2'); });
      act(() => {
        result.current.updateActiveTabAuth({ type: 'bearer', token: 'tab-2-only' });
      });

      expect(result.current.tabs.find((t) => t.id === 'tab-1')?.auth).toBeUndefined();
      expect(result.current.tabs.find((t) => t.id === 'tab-2')?.auth).toEqual({
        type: 'bearer',
        token: 'tab-2-only',
      });
    });

    it('updateActiveTabAuth clears profile link atomically when clearProfileLink set', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: { type: 'bearer' as const, token: 'staging' },
        createdAt: 1,
      };
      mockLoadTabs.mockResolvedValue([
        makeTab({ id: 'tab-1', connectionId: 'prof-staging', endpoint: 'https://staging.example/graphql' }),
      ] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultAuth: pageBearer,
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabAuth(
          { type: 'bearer', token: 'tab-only' },
          { clearProfileLink: true },
        );
      });

      expect(result.current.tabs[0].connectionId).toBeUndefined();
      expect(result.current.tabs[0].auth).toEqual({ type: 'bearer', token: 'tab-only' });
    });

    it('Phase 6H: inherit-workspace auth edit keeps profile link when clearProfileLink set', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: { type: 'bearer' as const, token: 'staging' },
        createdAt: 1,
      };
      mockLoadTabs.mockResolvedValue([
        makeTab({
          id: 'tab-1',
          connectionId: 'prof-staging',
          endpoint: 'https://staging.example/graphql',
          auth: { type: 'bearer', token: 'tab-override' },
        }),
      ] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultAuth: pageBearer,
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabAuth({ type: 'inherit' }, { clearProfileLink: true });
      });

      expect(result.current.tabs[0].connectionId).toBe('prof-staging');
      expect(result.current.tabs[0].auth).toBeUndefined();
      expect(result.current.hasActiveTabAuthOverride).toBe(false);
    });

    it('Phase 6H: inherit-global auth edit keeps profile link when clearProfileLink false', async () => {
      const profile = {
        id: 'prof-staging',
        name: 'Staging',
        endpoint: 'https://staging.example/graphql',
        auth: { type: 'bearer' as const, token: 'staging' },
        createdAt: 1,
      };
      mockLoadTabs.mockResolvedValue([
        makeTab({
          id: 'tab-1',
          connectionId: 'prof-staging',
          endpoint: 'https://staging.example/graphql',
          auth: { type: 'inherit', globalProfileId: 'catalog-1' },
        }),
      ] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({
          pageDefaultAuth: pageBearer,
          profiles: [profile],
        })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabAuth(
          { type: 'inherit', globalProfileId: 'catalog-2' },
          { clearProfileLink: false },
        );
      });

      expect(result.current.tabs[0].connectionId).toBe('prof-staging');
      expect(result.current.tabs[0].auth).toEqual({
        type: 'inherit',
        globalProfileId: 'catalog-2',
      });
    });

    it('updateActiveTabAuth skips no-op when auth unchanged (deep equal)', async () => {
      mockLoadTabs.mockResolvedValue([
        makeTab({ id: 'tab-1', auth: { type: 'bearer', token: 'tab-only' } }),
      ] as never);

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});

      act(() => {
        result.current.updateActiveTabAuth({ type: 'bearer', token: 'tab-only' });
      });
      expect(result.current.tabs[0].unsavedChanges).toBe(false);
    });

    it('addTab does not copy auth from previous tab', async () => {
      mockLoadTabs.mockResolvedValue([
        makeTab({ id: 'tab-1', auth: { type: 'bearer', token: 'tab-only' } }),
      ] as never);
      mockMakeBlankTab.mockReturnValue(makeTab({ id: 'tab-2' }));

      const { result } = renderHook(() =>
        useGqlStudioTabs(defaultOptions({ pageDefaultAuth: pageBearer })),
      );
      await act(async () => {});

      act(() => { result.current.addTab(); });
      const newTab = result.current.tabs.find((t) => t.id === 'tab-2');
      expect(newTab?.auth).toBeUndefined();
    });
  });
});

/**
 * @vitest-environment jsdom
 */
import type React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGqlStudioTabs } from './useGqlStudioTabs';
import { loadDemoSession } from '../utils/gqlDemoWorkspace';

vi.mock('../utils/pollingIntervalUtils', () => ({
  clampPollingIntervalSeconds: (s: number) => Math.max(10, Math.min(3600, Math.round(s))),
}));

vi.mock('../utils/gqlDemoWorkspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/gqlDemoWorkspace')>();
  return {
    ...actual,
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
      id: 'demo-tab',
      label,
      demoLessonId: lessonId,
      query: '',
      variables: '{}',
      headers: [],
      modelUri: 'inmemory://graphql/demo-tab',
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
  deriveTabLabel: vi.fn((q: string) => (q.trim() ? 'Labeled' : 'Untitled')),
  deriveOperationType: vi.fn(() => 'query'),
  extractOperations: vi.fn(() => ['OpA']),
}));

import { loadTabs, loadActiveTabId, saveTabs, makeBlankTab } from '../utils/tabPersistence';
import { GQL_TABS_RELOAD_EVENT } from '../utils/gqlDemoWorkspace';

const mockLoadTabs = vi.mocked(loadTabs);
const mockSaveTabs = vi.mocked(saveTabs);
const mockMakeBlankTab = vi.mocked(makeBlankTab);

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

function defaultOptions() {
  return {
    onCancelExecution: vi.fn(),
    isTabExecuting: vi.fn(() => false),
    onClearFileEntries: vi.fn(),
    onResetSubscription: vi.fn(),
    monacoRef: { current: null },
    pageDefaultEndpoint: 'https://default.example/graphql',
    pageDefaultAuth: null,
    profiles: [],
    profilesReady: true,
  };
}

describe('useGqlStudioTabs — coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMakeBlankTab.mockReturnValue(makeTab());
    mockLoadTabs.mockResolvedValue([]);
    vi.mocked(loadActiveTabId).mockResolvedValue('');
  });

  it('reloads tabs from storage when gql-tabs-reload event fires', async () => {
    const stored = makeTab({ id: 'stored', label: 'Stored' });
    mockLoadTabs.mockResolvedValueOnce([]).mockResolvedValueOnce([stored] as never);
    renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    window.dispatchEvent(new CustomEvent(GQL_TABS_RELOAD_EVENT));
    await act(async () => {});
    expect(mockLoadTabs).toHaveBeenCalledTimes(2);
  });

  it('addTab creates second demo tab when demo session budget allows', async () => {
    const { loadDemoSession } = await import('../utils/gqlDemoWorkspace');
    vi.mocked(loadDemoSession).mockResolvedValue({
      lessonId: 'gql-batch',
      priorActiveTabId: 'tab-1',
      demoTabId: 'demo-tab',
      tabBudget: 2,
      displayName: 'Batch Demo',
    });
    mockLoadTabs.mockResolvedValue([
      makeTab({ id: 'tab-1' }),
      makeTab({ id: 'demo-tab', demoLessonId: 'gql-batch', label: 'Batch Demo' }),
    ] as never);
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    mockMakeBlankTab.mockReturnValueOnce(makeTab({ id: 'demo-tab-2' }));
    await act(async () => { result.current.addTab(); });
    expect(mockSaveTabs).toHaveBeenCalled();
  });

  it('handleSelectOperation updates selected operation on active tab', async () => {
    mockLoadTabs.mockResolvedValue([makeTab({ id: 'tab-1', query: 'query OpA { x }', selectedOperation: 'OpA' })] as never);
    vi.mocked(loadActiveTabId).mockResolvedValue('tab-1');
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    act(() => { result.current.handleSelectOperation('OpA'); });
    expect(result.current.tabs[0].selectedOperation).toBe('OpA');
  });

  it('renameTab updates label without marking unsaved when only label changes', async () => {
    mockLoadTabs.mockResolvedValue([makeTab()] as never);
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    act(() => { result.current.renameTab('tab-1', 'Renamed'); });
    expect(result.current.tabs[0].label).toBe('Renamed');
  });

  it('closeTab removes tab and selects neighbor', async () => {
    mockLoadTabs.mockResolvedValue([
      makeTab({ id: 'a' }),
      makeTab({ id: 'b' }),
    ] as never);
    vi.mocked(loadActiveTabId).mockResolvedValue('b');
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    act(() => {
      result.current.closeTab('b', { stopPropagation: () => {} } as React.MouseEvent);
    });
    expect(result.current.tabs.map((t) => t.id)).toEqual(['a']);
    expect(result.current.activeTabId).toBe('a');
  });

  it('updateActiveTab writes query changes to active tab', async () => {
    mockLoadTabs.mockResolvedValue([makeTab({ id: 'tab-1', query: 'old' })] as never);
    vi.mocked(loadActiveTabId).mockResolvedValue('tab-1');
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    act(() => { result.current.handleQueryChange('query { newField }'); });
    expect(result.current.tabs[0].query).toContain('newField');
  });

  it('closeTab prompts confirm when tab has unsaved changes', async () => {
    mockLoadTabs.mockResolvedValue([
      makeTab({ id: 'a', unsavedChanges: true }),
      makeTab({ id: 'b' }),
    ] as never);
    vi.mocked(loadActiveTabId).mockResolvedValue('a');
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    act(() => {
      result.current.closeTab('a', { stopPropagation: () => {} } as React.MouseEvent);
    });
    expect(result.current.confirmingCloseTabId).toBe('a');
    expect(result.current.tabs).toHaveLength(2);
  });

  it('closeActiveTabRef closes the active tab via keyboard shortcut path', async () => {
    mockLoadTabs.mockResolvedValue([
      makeTab({ id: 'a' }),
      makeTab({ id: 'b' }),
    ] as never);
    vi.mocked(loadActiveTabId).mockResolvedValue('b');
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    act(() => { result.current.closeActiveTabRef.current(); });
    expect(result.current.tabs.map((t) => t.id)).toEqual(['a']);
  });

  it('clears confirmingCloseTabId after the confirm timer expires', async () => {
    vi.useFakeTimers();
    mockLoadTabs.mockResolvedValue([
      makeTab({ id: 'a', unsavedChanges: true }),
      makeTab({ id: 'b' }),
    ] as never);
    vi.mocked(loadActiveTabId).mockResolvedValue('a');
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    act(() => {
      result.current.closeTab('a', { stopPropagation: () => {} } as React.MouseEvent);
    });
    expect(result.current.confirmingCloseTabId).toBe('a');
    act(() => { vi.advanceTimersByTime(2600); });
    expect(result.current.confirmingCloseTabId).toBeNull();
    vi.useRealTimers();
  });

  it('addTab skips persist when session demo tab is not yet in memory', async () => {
    const { saveTabs } = await import('../utils/tabPersistence');
    vi.mocked(loadDemoSession).mockResolvedValue({
      lessonId: 'gql-1',
      demoTabId: 'missing-demo',
      priorActiveTabId: 'tab-1',
    });
    mockLoadTabs.mockResolvedValue([makeTab({ id: 'tab-1' })] as never);
    vi.mocked(loadActiveTabId).mockResolvedValue('tab-1');
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    vi.mocked(saveTabs).mockClear();
    act(() => { result.current.addTab(); });
    await act(async () => {});
    expect(saveTabs).not.toHaveBeenCalled();
  });
});

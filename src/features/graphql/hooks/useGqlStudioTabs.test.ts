/**
 * @vitest-environment jsdom
 *
 * useGqlStudioTabs — unit tests for the tab lifecycle hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGqlStudioTabs } from './useGqlStudioTabs';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../utils/tabPersistence', () => ({
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
  advanceSeqPastRestoredIds: vi.fn(),
  SAVE_DEBOUNCE_MS: 0,
}));

vi.mock('../utils/monacoGraphqlSetup', () => ({
  deriveTabLabel: vi.fn((q: string) => q.trim() ? 'Labeled' : 'Untitled'),
  deriveOperationType: vi.fn(() => 'query'),
  extractOperations: vi.fn(() => []),
}));

import { loadTabs, loadActiveTabId, saveTabs, makeBlankTab } from '../utils/tabPersistence';
const mockLoadTabs     = vi.mocked(loadTabs);
const mockSaveTabs     = vi.mocked(saveTabs);
const mockMakeBlankTab = vi.mocked(makeBlankTab);
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
    executing: false,
    responseModelUriRef: { current: '' },
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

  it('restores tabs from storage when available', async () => {
    const storedTab = makeTab({ id: 'stored-1', label: 'Stored' });
    mockLoadTabs.mockResolvedValue([storedTab] as never);
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});
    expect(result.current.tabs[0].id).toBe('stored-1');
    expect(result.current.activeTabId).toBe('stored-1');
  });

  it('addTab creates a new tab and activates it', async () => {
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    mockMakeBlankTab.mockReturnValueOnce(makeTab({ id: 'tab-2' }));
    act(() => { result.current.addTab(); });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.activeTabId).toBe('tab-2');
  });

  it('addTab does nothing at MAX_TABS (8)', async () => {
    const tabs = Array.from({ length: 8 }, (_, i) => makeTab({ id: `tab-${i}` }));
    mockLoadTabs.mockResolvedValue(tabs as never);
    const { result } = renderHook(() => useGqlStudioTabs(defaultOptions()));
    await act(async () => {});

    const countBefore = result.current.tabs.length;
    act(() => { result.current.addTab(); });
    expect(result.current.tabs.length).toBe(countBefore);
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
    const responseModelUriRef = { current: 'inmemory://graphql/tab-1' };
    const opts = defaultOptions({ onCancelExecution, executing: true, responseModelUriRef });
    const { result } = renderHook(() => useGqlStudioTabs(opts));
    await act(async () => {});

    act(() => { result.current.closeTab('tab-1', { stopPropagation: vi.fn() } as never); });
    expect(onCancelExecution).toHaveBeenCalled();
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
});

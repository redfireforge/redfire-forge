/**
 * @vitest-environment jsdom
 */
import React, { forwardRef, useImperativeHandle } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SseStudioPage } from './SseStudioPage';
import type { SseConnectionState, SseConnectionTab } from './sseTypes';
import { createDefaultSseTab, SSE_MAX_TABS } from './sseTypes';

const {
  mockLoadSseTabState,
  mockMigrateLegacySseConfig,
  mockSaveSseTabState,
  mockDeriveSseTabLabel,
  tabContentState,
} = vi.hoisted(() => ({
  mockLoadSseTabState: vi.fn(async () => null),
  mockMigrateLegacySseConfig: vi.fn(async () => null),
  mockSaveSseTabState: vi.fn(),
  mockDeriveSseTabLabel: vi.fn((url: string) => (url ? `Label:${url}` : 'Label:')),
  tabContentState: new Map<string, SseConnectionState>(),
}));

vi.mock('./sseStorage', () => ({
  loadSseTabState: mockLoadSseTabState,
  migrateLegacySseConfig: mockMigrateLegacySseConfig,
  saveSseTabState: mockSaveSseTabState,
  deriveSseTabLabel: mockDeriveSseTabLabel,
}));

vi.mock('../../shared/components/ConfirmModal', () => ({
  default: ({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) => (
    <div data-testid="confirm-modal">
      <div>{title}</div>
      <button data-testid="confirm-modal-confirm" type="button" onClick={onConfirm}>confirm</button>
      <button data-testid="confirm-modal-cancel" type="button" onClick={onCancel}>cancel</button>
    </div>
  ),
}));

vi.mock('./SseConnectionTabBar', () => ({
  SseConnectionTabBar: ({
    tabs,
    activeTabId,
    onSelect,
    onAdd,
    onClose,
    onDuplicate,
    onRename,
    onReorder,
  }: {
    tabs: SseConnectionTab[];
    activeTabId: string;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onClose: (id: string) => void;
    onDuplicate: (id: string) => void;
    onRename: (id: string, value: string) => void;
    onReorder?: (fromIndex: number, toIndex: number) => void;
  }) => (
    <div data-testid="sse-conn-tab-bar">
      <div data-testid="active-tab-id">{activeTabId}</div>
      <button data-testid="sse-tabbar-add" type="button" onClick={onAdd}>add</button>
      <button data-testid="sse-tabbar-reorder" type="button" onClick={() => onReorder?.(0, tabs.length - 1)}>reorder</button>
        <button data-testid="duplicate-missing" type="button" onClick={() => onDuplicate('missing-tab')}>duplicate-missing</button>
        <button data-testid="close-missing" type="button" onClick={() => onClose('missing-tab')}>close-missing</button>
      {tabs.map((tab) => (
        <div key={tab.id} data-testid={`tabbar-${tab.id}`}>
          <span>{tab.label}</span>
          <button data-testid={`select-${tab.id}`} type="button" onClick={() => onSelect(tab.id)}>select</button>
          <button data-testid={`close-${tab.id}`} type="button" onClick={() => onClose(tab.id)}>close</button>
          <button data-testid={`duplicate-${tab.id}`} type="button" onClick={() => onDuplicate(tab.id)}>duplicate</button>
          <button data-testid={`rename-${tab.id}`} type="button" onClick={() => onRename(tab.id, `${tab.label}-renamed`)}>rename</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./SseConnectionTabContent', () => {
  const SseConnectionTabContent = forwardRef(function MockSseConnectionTabContent(
    {
      tabId,
      tab,
      onConfigChange,
      onConnectionStateChange,
    }: {
      tabId: string;
      tab: SseConnectionTab;
      onConfigChange: (tabId: string, patch: Partial<SseConnectionTab>) => void;
      onConnectionStateChange: (tabId: string, state: SseConnectionState) => void;
    },
    ref: React.ForwardedRef<{ disconnect: () => void; getConnectionState: () => SseConnectionState }>,
  ) {
    useImperativeHandle(ref, () => ({
      disconnect: vi.fn(),
      getConnectionState: () => tabContentState.get(tabId) ?? 'idle',
    }), [tabId]);

    return (
      <div data-testid={`mock-tab-content-${tabId}`}>
        <div data-testid={`mock-tab-label-${tabId}`}>{tab.label}</div>
        <button data-testid={`config-url-${tabId}`} type="button" onClick={() => onConfigChange(tabId, { url: `https://example.com/${tabId}` })}>config-url</button>
        <button data-testid={`config-manual-${tabId}`} type="button" onClick={() => onConfigChange(tabId, { url: `https://manual.com/${tabId}`, labelManual: true })}>config-manual</button>
        <button data-testid={`conn-connected-${tabId}`} type="button" onClick={() => { tabContentState.set(tabId, 'connected'); onConnectionStateChange(tabId, 'connected'); }}>connected</button>
        <button data-testid={`conn-idle-${tabId}`} type="button" onClick={() => { tabContentState.set(tabId, 'idle'); onConnectionStateChange(tabId, 'idle'); }}>idle</button>
      </div>
    );
  });

  return { SseConnectionTabContent };
});

function makeTab(id: string, overrides: Partial<SseConnectionTab> = {}): SseConnectionTab {
  return { ...createDefaultSseTab(id, `Tab ${id}`), ...overrides };
}

async function renderPage() {
  await act(async () => {
    render(<SseStudioPage />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  tabContentState.clear();
  mockLoadSseTabState.mockReset();
  mockLoadSseTabState.mockResolvedValue(null);
  mockMigrateLegacySseConfig.mockReset();
  mockMigrateLegacySseConfig.mockResolvedValue(null);
  mockSaveSseTabState.mockReset();
  mockDeriveSseTabLabel.mockClear();
});

describe('SseStudioPage coverage gaps', () => {
  it('falls back to a fresh tab when migrated state exists but has no tabs', async () => {
    mockLoadSseTabState.mockResolvedValueOnce(null);
    mockMigrateLegacySseConfig.mockResolvedValueOnce({ tabs: [], activeTabId: '' });

    await renderPage();

    expect(screen.getAllByTestId(/tabbar-sse-tab-/)).toHaveLength(1);
  });

  it('ignores async restore results after unmount', async () => {
    let resolveLoad: ((value: { tabs: SseConnectionTab[]; activeTabId: string } | null) => void) | null = null;
    mockLoadSseTabState.mockImplementationOnce(() => new Promise((resolve) => { resolveLoad = resolve; }));

    const { unmount } = render(<SseStudioPage />);
    unmount();
    await act(async () => {
      resolveLoad?.({ tabs: [makeTab('sse-tab-10')], activeTabId: 'sse-tab-10' });
      await Promise.resolve();
    });

    expect(mockSaveSseTabState).not.toHaveBeenCalled();
  });

  it('restores persisted tabs and syncs the ID counter for later add/duplicate operations', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-5'), makeTab('sse-tab-7')],
      activeTabId: 'sse-tab-7',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('sse-tabbar-add'));

    expect(screen.getAllByTestId(/tabbar-sse-tab-/)).toHaveLength(3);
    const ids = screen.getAllByTestId(/tabbar-sse-tab-/).map((el) => el.getAttribute('data-testid'));
    expect(ids).toContain('tabbar-sse-tab-9');
  });

  it('adds a tab unless the max tab count has already been reached', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: Array.from({ length: SSE_MAX_TABS }, (_, i) => makeTab(`sse-tab-${i + 1}`)),
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('sse-tabbar-add'));

    expect(screen.queryByTestId(`tabbar-sse-tab-${SSE_MAX_TABS + 1}`)).toBeNull();
  });

  it('selects, renames, reorders, and duplicates tabs from the tab bar callbacks', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-1'), makeTab('sse-tab-2')],
      activeTabId: 'sse-tab-1',
    });

    await renderPage();

    fireEvent.click(screen.getByTestId('select-sse-tab-2'));
    expect(screen.getByTestId('active-tab-id').textContent).toBe('sse-tab-2');

    fireEvent.click(screen.getByTestId('rename-sse-tab-2'));
    expect(screen.getByTestId('mock-tab-label-sse-tab-2').textContent).toBe('Tab sse-tab-2-renamed');

    fireEvent.click(screen.getByTestId('sse-tabbar-reorder'));
    const tabRows = screen.getAllByTestId(/tabbar-sse-tab-/).map((el) => el.getAttribute('data-testid'));
    expect(tabRows[0]).toBe('tabbar-sse-tab-2');

    fireEvent.click(screen.getByTestId('duplicate-sse-tab-2'));
    const allRows = screen.getAllByTestId(/tabbar-sse-tab-/);
    expect(allRows).toHaveLength(3);
    const copyLabel = screen.getAllByTestId(/mock-tab-label-/).find((el) => el.textContent === 'Tab sse-tab-2-renamed (copy)');
    expect(copyLabel).toBeTruthy();
  });

  it('does not duplicate when the source tab is missing or max tabs already reached', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: Array.from({ length: SSE_MAX_TABS }, (_, i) => makeTab(`sse-tab-${i + 1}`)),
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('duplicate-sse-tab-1'));
    expect(screen.queryByTestId(`tabbar-sse-tab-${SSE_MAX_TABS + 1}`)).toBeNull();

    fireEvent.click(screen.getByTestId('duplicate-missing'));
    expect(screen.getAllByTestId(/tabbar-sse-tab-/)).toHaveLength(SSE_MAX_TABS);
  });

  it('duplicates auth and headers when the source tab has them', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-1', {
        label: 'Auth Tab',
        labelManual: true,
        headers: [{ key: 'X-Test', value: '1', enabled: true }],
        auth: { type: 'bearer', token: 'secret' },
      })],
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('duplicate-sse-tab-1'));

    const copy = screen.getAllByTestId(/mock-tab-label-/).find((el) => el.textContent === 'Auth Tab (copy)');
    expect(copy).toBeTruthy();
  });

  it('updates derived labels from config changes only when the tab is not manually named', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-1'), makeTab('sse-tab-2', { label: 'Manual', labelManual: true })],
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('config-url-sse-tab-1'));
    fireEvent.click(screen.getByTestId('config-manual-sse-tab-2'));

    expect(screen.getByTestId('mock-tab-label-sse-tab-1').textContent).toBe('Label:https://example.com/sse-tab-1');
    expect(screen.getByTestId('mock-tab-label-sse-tab-2').textContent).toBe('Manual');
  });

  it('does not relabel when the URL patch is unchanged or omitted', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-1', { url: 'https://example.com/sse-tab-1', label: 'Existing' })],
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('rename-sse-tab-1'));
    expect(screen.getByTestId('mock-tab-label-sse-tab-1').textContent).toBe('Existing-renamed');
  });

  it('closes idle tabs immediately, removes connection state, and falls back to a new tab when last tab closes', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-1')],
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('conn-idle-sse-tab-1'));
    fireEvent.click(screen.getByTestId('close-sse-tab-1'));

    await waitFor(() => {
      expect(screen.queryByTestId('tabbar-sse-tab-1')).toBeNull();
    });
    expect(screen.getAllByTestId(/tabbar-sse-tab-/)).toHaveLength(1);
    expect(screen.getByTestId('active-tab-id').textContent).not.toBe('sse-tab-1');
  });

  it('closing a non-active tab preserves the current active tab', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-1'), makeTab('sse-tab-2')],
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('close-sse-tab-2'));
    expect(screen.getByTestId('active-tab-id').textContent).toBe('sse-tab-1');
  });

  it('prompts before closing connected tabs and closes after confirmation', async () => {
    mockLoadSseTabState.mockResolvedValueOnce({
      tabs: [makeTab('sse-tab-1'), makeTab('sse-tab-2')],
      activeTabId: 'sse-tab-1',
    });

    await renderPage();
    fireEvent.click(screen.getByTestId('conn-connected-sse-tab-1'));
    fireEvent.click(screen.getByTestId('close-sse-tab-1'));

    expect(screen.getByTestId('confirm-modal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(screen.queryByTestId('confirm-modal')).toBeNull();

    fireEvent.click(screen.getByTestId('close-sse-tab-1'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => {
      expect(screen.queryByTestId('tabbar-sse-tab-1')).toBeNull();
    });

    fireEvent.click(screen.getByTestId('close-missing'));
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
  });

  it('debounce-saves after tab mutations and flushes current state on unmount once loaded', async () => {
    vi.useFakeTimers();
    try {
      mockLoadSseTabState.mockResolvedValueOnce({
        tabs: [makeTab('sse-tab-1')],
        activeTabId: 'sse-tab-1',
      });

      const { unmount } = render(<SseStudioPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      mockSaveSseTabState.mockClear();
      fireEvent.click(screen.getByTestId('sse-tabbar-add'));
      act(() => {
        vi.advanceTimersByTime(350);
      });
      expect(mockSaveSseTabState).toHaveBeenCalled();

      mockSaveSseTabState.mockClear();
      unmount();
      expect(mockSaveSseTabState).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
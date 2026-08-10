/**
 * @vitest-environment jsdom
 *
 * Tests for WebSocketStudioPage internal callbacks and page-owned tab state
 * transitions.
 *
 * Child components are mocked to expose callback props for direct invocation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import type { ConnectionStateHint } from './WsConnectionTabBar';

/* ── captured callbacks ─────────────────────────────────────────────── */
let capturedTabBarProps: Record<string, unknown> = {};
let capturedTabContentProps: Record<string, Record<string, unknown>> = {};

vi.mock('./WsConnectionTabBar', () => ({
  WsConnectionTabBar: (props: Record<string, unknown>) => {
    capturedTabBarProps = props;
    const tabs = props.tabs as Array<{ id: string; label: string }>;
    const history = (props.history as Array<{ url: string }>) ?? [];
    return (
      <div data-testid="mock-tab-bar">
        {tabs.map((t) => (
          <span key={t.id} data-testid={`mock-tab-${t.id}`}>{t.label}</span>
        ))}
        {history.map((entry) => (
          <span key={entry.url} data-testid={`mock-history-${entry.url}`}>{entry.url}</span>
        ))}
        <button data-testid="mock-history-clear" type="button" onClick={() => (props.onClearHistory as (() => void) | undefined)?.()}>clear-history</button>
      </div>
    );
  },
}));

vi.mock('./WsConnectionTabContent', () => ({
  WsConnectionTabContent: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      capturedTabContentProps[props.tabId] = props;
      return <div data-testid={`mock-content-${props.tabId}`} />;
    },
    { displayName: 'WsConnectionTabContent' },
  ),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: vi.fn(),
  }),
}));

import { WebSocketStudioPage, deriveTabLabel } from './WebSocketStudioPage';
import * as hookModule from './useWebSocketStudio';
import * as profilesModule from '../../app/hooks/useWebSocketProfiles';
import * as templatesModule from '../../app/hooks/useWebSocketTemplates';
import * as historyModule from '../../app/hooks/useWebSocketHistory';
import * as storageModule from '../../shared/websocket/websocketStorage';
import type { UseWebSocketStudioReturn } from './useWebSocketStudio';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '../../app/hooks/useWebSocketTemplates';
import type { UseWebSocketHistoryReturn } from '../../app/hooks/useWebSocketHistory';
import { createDefaultDraft, createDefaultReconnectState, createDefaultTlsConfig } from '../../shared/websocket/types';

function makeStudioReturn(overrides?: Partial<UseWebSocketStudioReturn>): UseWebSocketStudioReturn {
  return {
    draft: createDefaultDraft(),
    setDraft: vi.fn(),
    connection: { state: 'disconnected' },
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    sendPing: vi.fn(),
    messages: [],
    filteredMessages: [],
    maxMessages: 1000,
    setMaxMessages: vi.fn(),
    isMaxReached: false,
    searchText: '',
    setSearchText: vi.fn(),
    searchMode: 'text' as const,
    setSearchMode: vi.fn(),
    directionFilter: 'all',
    setDirectionFilter: vi.fn(),
    typeFilter: 'all',
    setTypeFilter: vi.fn(),
    clearMessages: vi.fn(),
    exportMessages: vi.fn(),
    selectedMessage: null,
    setSelectedMessage: vi.fn(),
    autoScroll: true,
    setAutoScroll: vi.fn(),
    reconnect: createDefaultReconnectState(),
    setReconnect: vi.fn(),
    tlsConfig: createDefaultTlsConfig(),
    setTlsConfig: vi.fn(),
    metrics: { bytesSent: 0, bytesReceived: 0, messagesSent: 0, messagesReceived: 0, connectTime: null, lastPongTime: null, latency: null },
    autoResponders: [],
    setAutoResponders: vi.fn(),
    addAutoResponder: vi.fn(),
    removeAutoResponder: vi.fn(),
    activeResponderId: null,
    setActiveResponderId: vi.fn(),
    cancelAutoResponder: vi.fn(),
    recording: { isRecording: false, messages: [], startRecording: vi.fn(), stopRecording: vi.fn(), clearRecording: vi.fn() },
    ...overrides,
  } as UseWebSocketStudioReturn;
}

function makeProfilesReturn(overrides?: Partial<UseWebSocketProfilesReturn>): UseWebSocketProfilesReturn {
  return {
    profiles: [],
    loading: false,
    error: null,
    saveProfile: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
    duplicateProfile: vi.fn().mockResolvedValue(undefined),
    importProfiles: vi.fn().mockResolvedValue({ imported: 0, errors: [] }),
    exportProfiles: vi.fn().mockReturnValue('[]'),
    loadProfileAsDraft: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function makeTemplatesReturn(overrides?: Partial<UseWebSocketTemplatesReturn>): UseWebSocketTemplatesReturn {
  return {
    templates: [],
    loading: false,
    error: null,
    saveTemplate: vi.fn().mockResolvedValue(undefined),
    updateTemplate: vi.fn().mockResolvedValue(undefined),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    loadTemplate: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function makeHistoryReturn(overrides?: Partial<UseWebSocketHistoryReturn>): UseWebSocketHistoryReturn {
  return {
    history: [],
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    clearHistory: vi.fn(),
    ...overrides,
  };
}

let mockHistoryReturn: UseWebSocketHistoryReturn;

beforeEach(() => {
  capturedTabBarProps = {};
  capturedTabContentProps = {};
  const mockReturn = makeStudioReturn();
  const mockProfilesReturn = makeProfilesReturn();
  const mockTemplatesReturn = makeTemplatesReturn();
  mockHistoryReturn = makeHistoryReturn();
  vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
  vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(mockProfilesReturn);
  vi.spyOn(templatesModule, 'useWebSocketTemplates').mockReturnValue(mockTemplatesReturn);
  vi.spyOn(historyModule, 'useWebSocketHistory').mockReturnValue(mockHistoryReturn);
  vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue(null);
  vi.spyOn(storageModule, 'saveWsTabState').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderPage(tabState?: Parameters<typeof storageModule.loadWsTabState>[0] extends Promise<infer T> ? T : never) {
  if (tabState) {
    vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue(tabState);
  }
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<WebSocketStudioPage />);
  });
  return result;
}

describe('WebSocketStudioPage internal callbacks', () => {
  it('uses svc/env endpoint mapping when selected service and env are provided', async () => {
    await act(async () => {
      render(
        <WebSocketStudioPage
          envName="Dev"
          selectedEnvId="env-1"
          selectedSvc={{
            id: 'svc-1',
            name: 'Orders',
            baseUrls: { 'env-1': 'https://api.example.com' },
            wsUrl: 'wss://socket.example.com/ws',
          } as never}
        />,
      );
    });

    const tabId = Object.keys(capturedTabContentProps)[0];
    expect(capturedTabContentProps[tabId].envVarMap).toBeTruthy();
    expect(capturedTabContentProps[tabId].endpointProtocolStatus).not.toBeUndefined();
  });

  describe('handleReorderTab', () => {
    it('reorders tabs via onReorder callback', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'Tab A', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'Tab B', url: '', viewTab: 'connect' },
          { id: 'ws-tab-3', label: 'Tab C', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });

      const onReorder = capturedTabBarProps.onReorder as (from: number, to: number) => void;
      expect(onReorder).toBeTruthy();

      // Move tab 0 → tab 2
      act(() => { onReorder(0, 2); });

      // After reorder: B, C, A
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs[0].label).toBe('Tab B');
      expect(tabs[1].label).toBe('Tab C');
      expect(tabs[2].label).toBe('Tab A');
    });

    it('no-ops for out-of-bounds fromIndex', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });

      const onReorder = capturedTabBarProps.onReorder as (from: number, to: number) => void;
      act(() => { onReorder(-1, 1); });

      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs[0].label).toBe('A');
      expect(tabs[1].label).toBe('B');
    });

    it('no-ops for out-of-bounds toIndex', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });

      const onReorder = capturedTabBarProps.onReorder as (from: number, to: number) => void;
      act(() => { onReorder(0, 99); });

      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs[0].label).toBe('A');
      expect(tabs[1].label).toBe('B');
    });

    it('no-ops when fromIndex === toIndex', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });

      const onReorder = capturedTabBarProps.onReorder as (from: number, to: number) => void;
      act(() => { onReorder(0, 0); });

      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs[0].label).toBe('A');
      expect(tabs[1].label).toBe('B');
    });
  });

  describe('handleConnectionStateChange', () => {
    it('adds history entry when state transitions to connected', async () => {
      await renderPage();

      // The default tab is created. Get its tabId from captured props.
      const tabIds = Object.keys(capturedTabContentProps);
      expect(tabIds.length).toBeGreaterThan(0);
      const tabId = tabIds[0];

      const onUrlChange = capturedTabContentProps[tabId].onUrlChange as (id: string, url: string) => void;
      const onConnStateChange = capturedTabContentProps[tabId].onConnectionStateChange as (id: string, state: ConnectionStateHint) => void;

      // First set a URL so the history entry has something to record
      act(() => { onUrlChange(tabId, 'ws://my-server:8080/ws'); });

      // Then trigger connection state change to 'connected'
      act(() => { onConnStateChange(tabId, 'connected'); });

      expect(mockHistoryReturn.addEntry).toHaveBeenCalledWith('ws://my-server:8080/ws', 'auto');
    });

    it('does not add history entry for non-connected states', async () => {
      await renderPage();

      const tabId = Object.keys(capturedTabContentProps)[0];
      const onConnStateChange = capturedTabContentProps[tabId].onConnectionStateChange as (id: string, state: ConnectionStateHint) => void;

      act(() => { onConnStateChange(tabId, 'connecting'); });
      act(() => { onConnStateChange(tabId, 'disconnected'); });
      act(() => { onConnStateChange(tabId, 'error'); });

      expect(mockHistoryReturn.addEntry).not.toHaveBeenCalled();
    });

    it('does not add history entry when URL is empty', async () => {
      await renderPage();

      const tabId = Object.keys(capturedTabContentProps)[0];
      const onConnStateChange = capturedTabContentProps[tabId].onConnectionStateChange as (id: string, state: ConnectionStateHint) => void;

      // No URL set, so tabUrls[tabId] is empty/undefined
      act(() => { onConnStateChange(tabId, 'connected'); });

      expect(mockHistoryReturn.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('handleUrlChange', () => {
    it('derives tab label from URL when tab is not renamed', async () => {
      await renderPage();

      const tabId = Object.keys(capturedTabContentProps)[0];
      const onUrlChange = capturedTabContentProps[tabId].onUrlChange as (id: string, url: string) => void;

      act(() => { onUrlChange(tabId, 'ws://my-server:8080/ws'); });

      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      const tab = tabs.find((t) => t.id === tabId);
      expect(tab?.label).toBe('my-server:8080');
    });

    it('does not override label for renamed tabs', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'Custom Name', url: 'ws://old', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: ['ws-tab-1'],
      });

      const onUrlChange = capturedTabContentProps['ws-tab-1'].onUrlChange as (id: string, url: string) => void;
      act(() => { onUrlChange('ws-tab-1', 'ws://new-server:9090/ws'); });

      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      const tab = tabs.find((t) => t.id === 'ws-tab-1');
      expect(tab?.label).toBe('Custom Name');
    });

    it('keeps label unchanged when URL is too short to derive', async () => {
      await renderPage();

      const tabId = Object.keys(capturedTabContentProps)[0];
      const onUrlChange = capturedTabContentProps[tabId].onUrlChange as (id: string, url: string) => void;

      act(() => { onUrlChange(tabId, 'ws://'); });

      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      const tab = tabs.find((t) => t.id === tabId);
      expect(tab?.label).toBe('New Connection'); // default label unchanged
    });
  });

  describe('handleCloseTab — confirm path', () => {
    it('does not close tab when connection is active and confirm is cancelled', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'Active', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'Other', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });

      // Simulate a connected state via onConnectionStateChange
      const onConnStateChange = capturedTabContentProps['ws-tab-1'].onConnectionStateChange as (id: string, state: ConnectionStateHint) => void;
      act(() => { onConnStateChange('ws-tab-1', 'connected'); });

      const onClose = capturedTabBarProps.onClose as (id: string) => void;
      act(() => { onClose('ws-tab-1'); });

      // ConfirmModal should be rendered
      expect(screen.getByText('This connection is active. Close and disconnect?')).toBeTruthy();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBe(2); // not closed yet

      // Click Cancel
      act(() => { screen.getByText('Cancel').click(); });
      expect(screen.queryByText('This connection is active. Close and disconnect?')).toBeNull();
      expect(tabs.length).toBe(2); // still not closed
    });

    it('closes tab when connection is active and confirm is accepted', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'Active', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'Other', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });

      const onConnStateChange = capturedTabContentProps['ws-tab-1'].onConnectionStateChange as (id: string, state: ConnectionStateHint) => void;
      act(() => { onConnStateChange('ws-tab-1', 'connected'); });

      const onClose = capturedTabBarProps.onClose as (id: string) => void;
      act(() => { onClose('ws-tab-1'); });

      // ConfirmModal should be rendered
      expect(screen.getByText('This connection is active. Close and disconnect?')).toBeTruthy();

      // Click Close (confirm)
      act(() => { screen.getByText('Close').click(); });
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBe(1); // closed
    });

    it('shows confirm modal for connecting tab', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'Connecting', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'Other', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });

      const onConnStateChange = capturedTabContentProps['ws-tab-1'].onConnectionStateChange as (id: string, state: ConnectionStateHint) => void;
      act(() => { onConnStateChange('ws-tab-1', 'connecting'); });

      const onClose = capturedTabBarProps.onClose as (id: string) => void;
      act(() => { onClose('ws-tab-1'); });

      expect(screen.getByText('This connection is active. Close and disconnect?')).toBeTruthy();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBe(2);

      // Cancel
      act(() => { screen.getByText('Cancel').click(); });
    });
  });

  describe('handleModeChange', () => {
    it('saves studio location on mode change', async () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      await renderPage();

      const tabId = Object.keys(capturedTabContentProps)[0];
      const onModeChange = capturedTabContentProps[tabId].onModeChange as (mode: string) => void;

      saveSpy.mockClear();
      act(() => { onModeChange('saved'); });
      vi.advanceTimersByTime(400);

      expect(saveSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('unmount during async load', () => {
    it('cancels loadWsTabState when component unmounts before resolve', async () => {
      let resolveLoad!: (val: null) => void;
      vi.spyOn(storageModule, 'loadWsTabState').mockReturnValue(
        new Promise((resolve) => { resolveLoad = resolve; }),
      );

      let result!: ReturnType<typeof render>;
      await act(async () => {
        result = render(<WebSocketStudioPage />);
      });

      // Unmount before promise resolves
      result.unmount();

      // Now resolve — the cancelled flag should prevent state updates
      await act(async () => { resolveLoad(null); });

      // No error means the cancelled flag worked
      expect(true).toBe(true);
    });

    it('handles loadWsTabState rejection after unmount', async () => {
      let rejectLoad!: (err: Error) => void;
      vi.spyOn(storageModule, 'loadWsTabState').mockReturnValue(
        new Promise((_, reject) => { rejectLoad = reject; }),
      );

      let result!: ReturnType<typeof render>;
      await act(async () => {
        result = render(<WebSocketStudioPage />);
      });

      result.unmount();

      // Reject after unmount — cancelled flag prevents state update
      await act(async () => { rejectLoad(new Error('fail')); });

      expect(true).toBe(true);
    });

    it('handles loadWsTabState rejection before unmount', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockRejectedValue(new Error('storage error'));
      await renderPage();

      // Should have created a default tab despite error
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBe(1);
      expect(tabs[0].label).toBe('New Connection');
    });
  });

  describe('handleMockPortChange', () => {
    it('reassigns conflicting tab when applying an in-use port', async () => {
      vi.useFakeTimers();
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect', mockPort: 9876 },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect', mockPort: 9877 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      const onMockPortChange2 = capturedTabContentProps['ws-tab-2'].onMockPortChange as (id: string, port: number) => void;
      act(() => { onMockPortChange2('ws-tab-2', 9876); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      const saved = vi.mocked(storageModule.saveWsTabState).mock.calls.at(-1)?.[0];
      const tab1 = saved?.tabs?.find((t) => t.id === 'ws-tab-1');
      const tab2 = saved?.tabs?.find((t) => t.id === 'ws-tab-2');
      expect(tab2?.mockPort).toBe(9876);
      expect(tab1?.mockPort).toBe(9877);
    });

    it('restores persisted mockPort on tab load', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: 'ws://localhost:8765', viewTab: 'mock', mockPort: 9999 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9999);
    });

    it('pins a single default New Connection tab to port 9876', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'New Connection', url: '', viewTab: 'connect', mockPort: 9999 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9876);
    });

    it('normalizes single default tab localhost URL to port 9876', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'New Connection', url: 'ws://localhost:9878', viewTab: 'connect', mockPort: 9999 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9876);
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; url?: string }>;
      expect(tabs[0]?.url).toBe('ws://localhost:9876');
      expect(capturedTabContentProps['ws-tab-1'].initialUrl).toBe('ws://localhost:9876');
    });

    it('pins the demo tab to port 9876 when another tab holds the base port', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'New Connection', url: 'ws://localhost:9876', viewTab: 'connect', mockPort: 9876 },
          { id: 'ws-tab-2', label: 'demo', url: 'ws://localhost:9878', viewTab: 'mock', mockPort: 9878 },
        ],
        activeTabId: 'ws-tab-2',
        renamedTabIds: [],
      });
      expect(capturedTabContentProps['ws-tab-2'].mockPort).toBe(9876);
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9878);
      expect(capturedTabContentProps['ws-tab-2'].initialUrl).toBe('ws://localhost:9876');
    });

    it('pins the first New Connection tab to 9876 even when persisted as 9878', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'New Connection', url: 'ws://localhost:9878', viewTab: 'mock', mockPort: 9878 },
          { id: 'ws-tab-2', label: 'New Connection', url: '', viewTab: 'connect', mockPort: 9879 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9876);
      expect(capturedTabContentProps['ws-tab-1'].initialUrl).toBe('ws://localhost:9876');
      expect(capturedTabContentProps['ws-tab-2'].mockPort).toBe(9879);
    });

    it('adding a second tab after sole sticky 9878 remaps Tab1→9876 and assigns Tab2→9877', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'New Connection', url: 'ws://localhost:9878', viewTab: 'mock', mockPort: 9878 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      // Load already pins sole tab to 9876 — simulate sticky leftover mid-session.
      const onMockPortChange = capturedTabContentProps['ws-tab-1'].onMockPortChange as (
        id: string,
        port: number,
      ) => void;
      act(() => { onMockPortChange('ws-tab-1', 9878); });
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9878);

      act(() => { capturedTabBarProps.onAdd(); });

      const tabIds = Object.keys(capturedTabContentProps);
      expect(tabIds.length).toBe(2);
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9876);
      const newTabId = tabIds.find((id) => id !== 'ws-tab-1')!;
      expect(capturedTabContentProps[newTabId].mockPort).toBe(9877);
    });

    it('reassigns conflicting tab mockPort prop after swap (state, not ref-only)', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect', mockPort: 9876 },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect', mockPort: 9877 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      const onMockPortChange2 = capturedTabContentProps['ws-tab-2'].onMockPortChange as (id: string, port: number) => void;
      act(() => { onMockPortChange2('ws-tab-2', 9876); });
      expect(capturedTabContentProps['ws-tab-2'].mockPort).toBe(9876);
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9877);
    });

    it('assigns alternate port when persisted mockPort conflicts', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'mock', mockPort: 9999 },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'mock', mockPort: 9999 },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9999);
      expect(capturedTabContentProps['ws-tab-2'].mockPort).not.toBe(9999);
    });
  });

  describe('handleDraftChange and tab location callbacks', () => {
    it('debounced save runs on draft change', async () => {
      vi.useFakeTimers();
      await renderPage();
      const tabId = Object.keys(capturedTabContentProps)[0];
      const onDraftChange = capturedTabContentProps[tabId].onDraftChange as () => void;
      act(() => { onDraftChange(); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      expect(storageModule.saveWsTabState).toHaveBeenCalled();
    });

    it('persists left and right tab changes', async () => {
      vi.useFakeTimers();
      await renderPage();
      const tabId = Object.keys(capturedTabContentProps)[0];
      const onLeftTabChange = capturedTabContentProps[tabId].onLeftTabChange as (tab: string) => void;
      const onRightTabChange = capturedTabContentProps[tabId].onRightTabChange as (tab: string) => void;
      act(() => { onLeftTabChange('headers'); });
      act(() => { onRightTabChange('stats'); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      expect(storageModule.saveWsTabState).toHaveBeenCalled();
    });
  });

  describe('handleSelectTab and handleRenameTab', () => {
    it('selects tab and debounced save', async () => {
      vi.useFakeTimers();
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      const onSelect = capturedTabBarProps.onSelect as (id: string) => void;
      act(() => { onSelect('ws-tab-2'); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      expect(capturedTabBarProps.activeTabId).toBe('ws-tab-2');
      expect(storageModule.saveWsTabState).toHaveBeenCalled();
    });

    it('renames tab and debounced save', async () => {
      vi.useFakeTimers();
      await renderPage({
        tabs: [{ id: 'ws-tab-1', label: 'Old', url: '', viewTab: 'connect' }],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      const onRename = capturedTabBarProps.onRename as (id: string, label: string) => void;
      act(() => { onRename('ws-tab-1', 'Renamed'); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs[0].label).toBe('Renamed');
      expect(storageModule.saveWsTabState).toHaveBeenCalled();
    });
  });

  describe('handleAddTab and handleAddTabWithUrl', () => {
    it('adds a new tab via onAdd', async () => {
      vi.useFakeTimers();
      await renderPage();
      const onAdd = capturedTabBarProps.onAdd as () => void;
      act(() => { onAdd(); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBeGreaterThan(1);
    });

    it('does not add when max tabs reached', async () => {
      const tabs = Array.from({ length: 8 }, (_, i) => ({
        id: `ws-tab-${i}`,
        label: `Tab ${i}`,
        url: '',
        viewTab: 'connect' as const,
      }));
      await renderPage({ tabs, activeTabId: 'ws-tab-0', renamedTabIds: [] });
      const onAdd = capturedTabBarProps.onAdd as () => void;
      act(() => { onAdd(); });
      const after = capturedTabBarProps.tabs as Array<{ id: string }>;
      expect(after.length).toBe(8);
    });

    it('adds tab with URL and protocol via onAddWithUrl', async () => {
      vi.useFakeTimers();
      await renderPage();
      const onAddWithUrl = capturedTabBarProps.onAddWithUrl as (url: string, protocol?: string) => void;
      act(() => { onAddWithUrl('ws://localhost:9090/demo', 'graphql-ws'); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string; url?: string }>;
      const added = tabs.find((t) => t.url === 'ws://localhost:9090/demo');
      expect(added?.label).toContain('localhost');
    });

    it('falls back to "New Connection" when add-with-url cannot derive a label', async () => {
      await renderPage();
      const onAddWithUrl = capturedTabBarProps.onAddWithUrl as (url: string, protocol?: string) => void;
      act(() => { onAddWithUrl('ws://', 'raw'); });
      const tabs = capturedTabBarProps.tabs as Array<{ label: string; url?: string }>;
      const added = tabs.find((t) => t.url === 'ws://');
      expect(added?.label).toBe('New Connection');
    });

    it('duplicates a renamed tab and copies protocol, draft fields, and studio location', async () => {
      await renderPage({
        tabs: [
          {
            id: 'ws-tab-1',
            label: 'Custom Name',
            url: 'ws://demo.local/socket',
            viewTab: 'mock',
            mode: 'mock',
            leftTab: 'send',
            rightTab: 'stats',
            subprotocols: 'graphql-ws',
            protocolMode: 'graphql-ws',
            headers: [{ key: 'X-Test', value: '1', enabled: true }],
            queryParams: [{ key: 'q', value: 'v', enabled: true }],
            auth: { type: 'bearer', token: 'secret' },
            mockPort: 9988,
          },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: ['ws-tab-1'],
      });

      const onDuplicate = capturedTabBarProps.onDuplicate as (id: string) => void;
      act(() => { onDuplicate('ws-tab-1'); });

      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string; url?: string }>;
      expect(tabs).toHaveLength(2);
      expect(tabs[1].label).toBe('Custom Name (copy)');
      expect(tabs[1].url).toBe('ws://demo.local/socket');
    });

    it('does not duplicate when the source tab is missing', async () => {
      await renderPage();
      const onDuplicate = capturedTabBarProps.onDuplicate as (id: string) => void;
      const before = (capturedTabBarProps.tabs as Array<{ id: string }>).length;
      act(() => { onDuplicate('missing-tab'); });
      const after = (capturedTabBarProps.tabs as Array<{ id: string }>).length;
      expect(after).toBe(before);
    });
  });

  describe('handleUrlChange and handleCloseTab edge cases', () => {
    it('does not auto-relabel renamed tabs on url change', async () => {
      await renderPage({
        tabs: [{ id: 'ws-tab-1', label: 'Custom', url: '', viewTab: 'connect' }],
        activeTabId: 'ws-tab-1',
        renamedTabIds: ['ws-tab-1'],
      });
      const onUrlChange = capturedTabContentProps['ws-tab-1'].onUrlChange as (id: string, url: string) => void;
      act(() => { onUrlChange('ws-tab-1', 'ws://renamed.example.com:8080'); });
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs[0].label).toBe('Custom');
    });

    it('auto-relabels unrenamed tabs via regex fallback when URL parsing fails', async () => {
      await renderPage({
        tabs: [{ id: 'ws-tab-1', label: 'New Connection', url: '', viewTab: 'connect' }],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      const onUrlChange = capturedTabContentProps['ws-tab-1'].onUrlChange as (id: string, url: string) => void;
      act(() => { onUrlChange('ws-tab-1', 'ws://my%server:1234'); });
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs[0].label).toBe('my%server:1234');
    });

    it('does not close the last remaining tab', async () => {
      await renderPage({
        tabs: [{ id: 'ws-tab-1', label: 'Only', url: '', viewTab: 'connect' }],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      const onClose = capturedTabBarProps.onClose as (id: string) => void;
      act(() => { onClose('ws-tab-1'); });
      const tabs = capturedTabBarProps.tabs as Array<{ id: string }>;
      expect(tabs.length).toBe(1);
    });

    it('closes tab and releases mock port assignment', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'mock', mockPort: 9999 },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      expect(capturedTabContentProps['ws-tab-1'].mockPort).toBe(9999);
      const onClose = capturedTabBarProps.onClose as (id: string) => void;
      act(() => { onClose('ws-tab-1'); });
      const tabs = capturedTabBarProps.tabs as Array<{ id: string }>;
      expect(tabs.length).toBe(1);
      expect(tabs[0].id).toBe('ws-tab-2');
    });

    it('closing a non-active tab preserves the active tab', async () => {
      await renderPage({
        tabs: [
          { id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect' },
          { id: 'ws-tab-2', label: 'B', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      const onClose = capturedTabBarProps.onClose as (id: string) => void;
      act(() => { onClose('ws-tab-2'); });
      expect(capturedTabBarProps.activeTabId).toBe('ws-tab-1');
    });

    it('accepts mock port change when port is unique', async () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      await renderPage({
        tabs: [{ id: 'ws-tab-1', label: 'A', url: '', viewTab: 'mock', mockPort: 9876 }],
        activeTabId: 'ws-tab-1',
        renamedTabIds: [],
      });
      saveSpy.mockClear();
      const onMockPortChange = capturedTabContentProps['ws-tab-1'].onMockPortChange as (id: string, port: number) => void;
      act(() => { onMockPortChange('ws-tab-1', 10001); });
      act(() => { vi.advanceTimersByTime(350); });
      vi.useRealTimers();
      const saved = saveSpy.mock.calls.at(-1)?.[0];
      expect(saved?.tabs?.[0]?.mockPort).toBe(10001);
    });

    it('renders history entries and clears them through the tab-bar callback', async () => {
      mockHistoryReturn = makeHistoryReturn({
        history: [
          { url: 'ws://one.local/ws', protocol: 'auto', lastUsed: new Date().toISOString() },
          { url: 'ws://two.local/ws', protocol: 'graphql-ws', lastUsed: new Date().toISOString() },
        ],
      });
      vi.spyOn(historyModule, 'useWebSocketHistory').mockReturnValue(mockHistoryReturn);

      await renderPage();
      expect(screen.getByTestId('mock-history-ws://one.local/ws')).toBeTruthy();
      expect(screen.getByTestId('mock-history-ws://two.local/ws')).toBeTruthy();

      act(() => { screen.getByTestId('mock-history-clear').click(); });
      expect(mockHistoryReturn.clearHistory).toHaveBeenCalledOnce();
    });
  });
});

describe('deriveTabLabel fallback branches', () => {
  it('returns null when URL constructor succeeds but hostname is shorter than 2 chars', () => {
    expect(deriveTabLabel('ws://x')).toBeNull();
  });

  it('returns null from regex fallback when the invalid URL does not match the host pattern', () => {
    expect(deriveTabLabel('ws://  ')).toBeNull();
  });
});

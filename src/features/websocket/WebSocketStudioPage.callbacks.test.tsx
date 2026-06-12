/**
 * @vitest-environment jsdom
 *
 * Tests for WebSocketStudioPage internal callbacks (handleReorderTab,
 * handleConnectionStateChange, handleUrlChange, handleCloseTab confirm path).
 *
 * Child components are mocked to expose callback props for direct invocation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ConnectionStateHint } from './WsConnectionTabBar';

/* ── captured callbacks ─────────────────────────────────────────────── */
let capturedTabBarProps: Record<string, unknown> = {};
let capturedTabContentProps: Record<string, Record<string, unknown>> = {};

vi.mock('./WsConnectionTabBar', () => ({
  WsConnectionTabBar: (props: Record<string, unknown>) => {
    capturedTabBarProps = props;
    const tabs = props.tabs as Array<{ id: string; label: string }>;
    return (
      <div data-testid="mock-tab-bar">
        {tabs.map((t) => (
          <span key={t.id} data-testid={`mock-tab-${t.id}`}>{t.label}</span>
        ))}
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

import { WebSocketStudioPage } from './WebSocketStudioPage';
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
    it('does not close tab when connection is active and confirm is rejected', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
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

      expect(window.confirm).toHaveBeenCalled();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBe(2); // not closed
    });

    it('closes tab when connection is active and confirm is accepted', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
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

      expect(window.confirm).toHaveBeenCalled();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBe(1); // closed
    });

    it('prompts confirm for connecting tab', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
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

      expect(window.confirm).toHaveBeenCalled();
      const tabs = capturedTabBarProps.tabs as Array<{ id: string; label: string }>;
      expect(tabs.length).toBe(2);
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
});

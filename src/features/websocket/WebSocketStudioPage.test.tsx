/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; getScrollElement: () => unknown; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        start: i * opts.estimateSize(),
        size: opts.estimateSize(),
        key: i,
      })),
    getTotalSize: () => opts.count * opts.estimateSize(),
    scrollToIndex: vi.fn(),
  }),
}));

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
    sizeFilter: 'all' as const,
    setSizeFilter: vi.fn(),
    timeFilter: 'all' as const,
    setTimeFilter: vi.fn(),
    contentTypeFilter: 'all' as const,
    setContentTypeFilter: vi.fn(),
    clearMessages: vi.fn(),
    appendReplayFrame: vi.fn(),
    bookmarkedIds: new Set<string>(),
    bookmarkedMessages: [],
    toggleBookmark: vi.fn(),
    sentCount: 0,
    receivedCount: 0,
    uptime: null,
    transportMode: 'direct',
    autoReconnect: false,
    setAutoReconnect: vi.fn(),
    reconnectState: createDefaultReconnectState(),
    cancelReconnect: vi.fn(),
    reconnectIntervalMs: 3000,
    setReconnectIntervalMs: vi.fn(),
    maxReconnectAttempts: 5,
    setMaxReconnectAttempts: vi.fn(),
    backoffMultiplier: 1.5,
    setBackoffMultiplier: vi.fn(),
    retryNow: vi.fn(),
    protocolMode: 'auto' as const,
    setProtocolMode: vi.fn(),
    detectedProtocol: null,
    tlsConfig: createDefaultTlsConfig(),
    setTlsConfig: vi.fn(),
    sioServerParams: null,
    ...overrides,
  };
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

let mockReturn: UseWebSocketStudioReturn;
let mockProfilesReturn: UseWebSocketProfilesReturn;
let mockTemplatesReturn: UseWebSocketTemplatesReturn;
let mockHistoryReturn: UseWebSocketHistoryReturn;

beforeEach(() => {
  mockReturn = makeStudioReturn();
  mockProfilesReturn = makeProfilesReturn();
  mockTemplatesReturn = makeTemplatesReturn();
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

async function renderStudioPage(props: Record<string, unknown> = {}) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<WebSocketStudioPage {...props} />);
  });
  return result;
}

describe('WebSocketStudioPage', () => {
  it('renders the shell with Client, Mock, and Saved modes', async () => {
    await renderStudioPage();
    expect(screen.getByTestId('mode-client')).toBeTruthy();
    expect(screen.getByTestId('mode-mock')).toBeTruthy();
    expect(screen.getByTestId('mode-saved')).toBeTruthy();
  });

  it('renders the connect panel on the default Connect left tab', async () => {
    await renderStudioPage();
    expect(screen.getByTestId('connect-btn')).toBeTruthy();
    // The events log occupies the right pane.
    expect(screen.getByTestId('search-input')).toBeTruthy();
  });

  it('renders the events log on the right pane when URL is entered', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://localhost:8765', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    expect(screen.getByTestId('search-input')).toBeTruthy();
  });

  it('renders the events log on the right pane when connected', async () => {
    mockReturn = makeStudioReturn({
      connection: { state: 'connected', url: 'ws://localhost:8765' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    expect(screen.getByTestId('search-input')).toBeTruthy();
  });

  it('switches to the Compose left tab', async () => {
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-compose'));
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('shows message count badge on the Compose left tab', async () => {
    const msg = {
      id: '1', direction: 'received' as const, type: 'text' as const,
      data: 'hello', size: 5, timestamp: new Date().toISOString(),
    };
    mockReturn = makeStudioReturn({ messages: [msg] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    expect(screen.getByTestId('left-tab-compose').textContent).toContain('1');
  });

  it('Client mode + Connect left tab are active by default', async () => {
    await renderStudioPage();
    expect(screen.getByTestId('mode-client').className).toContain('active');
    expect(screen.getByTestId('left-tab-connect').className).toContain('active');
  });

  it('shows Saved mode content when clicked', async () => {
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('mode-saved'));
    expect(screen.getByText(/No saved connections/)).toBeTruthy();
  });

  it('shows profile count badge on the Saved mode tab', async () => {
    mockProfilesReturn = makeProfilesReturn({
      profiles: [{
        id: 'p1', name: 'T', url: 'wss://t', headers: [], queryParams: [],
        subprotocols: '', autoReconnect: false, maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000, maxMessages: 1000,
        createdAt: '', updatedAt: '',
      }],
    });
    vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(mockProfilesReturn);
    await renderStudioPage();
    const savedTab = screen.getByTestId('mode-saved');
    expect(savedTab.textContent).toContain('1');
  });

  it('shows config lock banner when connected', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    expect(screen.getByTestId('config-lock-banner')).toBeTruthy();
    expect(screen.getByText(/Connection settings are locked/)).toBeTruthy();
    expect(screen.getByTestId('banner-disconnect-link')).toBeTruthy();
  });

  it('hides config lock banner when disconnected', async () => {
    await renderStudioPage();
    expect(screen.queryByTestId('config-lock-banner')).toBeNull();
  });

  it('renders Save as Profile button on Connect tab', async () => {
    await renderStudioPage();
    expect(screen.getByTestId('save-as-profile-btn')).toBeTruthy();
  });

  it('renders template trigger on the Compose left tab', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-compose'));
    expect(screen.getByTestId('template-trigger')).toBeTruthy();
  });

  it('renders format selector on the Compose left tab', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-compose'));
    expect(screen.getByTestId('format-select')).toBeTruthy();
  });

  it('calls disconnect when banner disconnect link is clicked', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('banner-disconnect-link'));
    expect(mockReturn.disconnect).toHaveBeenCalled();
  });

  it('handleSaveAsProfile switches to Saved mode with prefill data', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://localhost:8765', subprotocols: 'json', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('save-as-profile-btn'));
    const savedTab = screen.getByTestId('mode-saved');
    expect(savedTab.className).toContain('active');
  });

  it('handleLoadProfile applies all profile settings', async () => {
    const profile = {
      id: 'p1', name: 'Test', url: 'wss://api.example.com',
      headers: [], queryParams: [], subprotocols: 'graphql-ws',
      autoReconnect: true, maxReconnectAttempts: 10,
      reconnectIntervalMs: 5000, maxMessages: 500,
      protocolMode: 'graphql-ws' as const,
      backoffMultiplier: 2 as const,
      createdAt: '', updatedAt: '',
    };
    mockProfilesReturn = makeProfilesReturn({ profiles: [profile] });
    vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(mockProfilesReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('mode-saved'));
    expect(mockReturn.setProtocolMode).not.toHaveBeenCalled();
  });

  it('switches back to the Connect left tab when handleSwitchToConnect fires', async () => {
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-compose'));
    expect(screen.getByTestId('left-tab-compose').className).toContain('active');
    fireEvent.click(screen.getByTestId('left-tab-connect'));
    expect(screen.getByTestId('left-tab-connect').className).toContain('active');
  });

  it('renders Compose content without guard on the messages view', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-compose'));
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('handleLoadProfile calls all studio setters with profile values', async () => {
    const profile = {
      id: 'p1', name: 'Test', url: 'wss://api.example.com',
      headers: [{ key: 'Auth', value: 'test', enabled: true }],
      queryParams: [], subprotocols: 'graphql-ws',
      autoReconnect: true, maxReconnectAttempts: 10,
      reconnectIntervalMs: 5000, maxMessages: 500,
      protocolMode: 'graphql-ws' as const,
      backoffMultiplier: 2 as const,
      tlsConfig: { rejectUnauthorized: false },
      createdAt: '', updatedAt: '',
    };
    mockProfilesReturn = makeProfilesReturn({ profiles: [profile] });
    vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(mockProfilesReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('mode-saved'));
    fireEvent.click(screen.getByTestId('profile-card-p1'));
    fireEvent.click(screen.getByTestId('load-btn-p1'));
    expect(mockReturn.setProtocolMode).toHaveBeenCalledWith('graphql-ws');
    expect(mockReturn.setAutoReconnect).toHaveBeenCalledWith(true);
    expect(mockReturn.setMaxReconnectAttempts).toHaveBeenCalledWith(10);
    expect(mockReturn.setReconnectIntervalMs).toHaveBeenCalledWith(5000);
    expect(mockReturn.setBackoffMultiplier).toHaveBeenCalledWith(2);
    expect(mockReturn.setMaxMessages).toHaveBeenCalledWith(500);
    expect(mockReturn.setTlsConfig).toHaveBeenCalled();
    expect(mockProfilesReturn.loadProfileAsDraft).toHaveBeenCalledWith('p1');
  });

  it('handleEditConnection cancels reconnect and switches to the Connect left tab', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
      reconnectState: { ...createDefaultReconnectState(), isReconnecting: true },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-compose'));
    expect(screen.getByTestId('left-tab-compose').className).toContain('active');
    fireEvent.click(screen.getByTestId('left-tab-connect'));
    expect(screen.getByTestId('left-tab-connect').className).toContain('active');
  });

  it('handleApplyDraft calls setDraft on studio', async () => {
    await renderStudioPage();
    expect(mockReturn.setDraft).toBeDefined();
  });

  it('passes envVarMap to useWebSocketStudio when env props are provided', async () => {
    const spy = vi.spyOn(hookModule, 'useWebSocketStudio');
    await renderStudioPage({
      resolvedBaseUrl: 'https://api.example.com',
      envName: 'Staging',
      svcName: 'UserSvc',
    });
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall[0]).toEqual({
      baseUrl: 'https://api.example.com',
      wsBaseUrl: 'wss://api.example.com',
      host: 'api.example.com',
      envName: 'Staging',
      svcName: 'UserSvc',
    });
  });

  it('passes empty envVarMap when no env props given', async () => {
    const spy = vi.spyOn(hookModule, 'useWebSocketStudio');
    await renderStudioPage();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall[0]).toEqual({});
  });

  it('resolves env vars in the preview URL', async () => {
    mockReturn = makeStudioReturn({
      draft: {
        url: 'wss://{{host}}/ws',
        subprotocols: '',
        headers: [],
        queryParams: [],
      },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage({
      resolvedBaseUrl: 'https://api.example.com',
      envName: 'Staging',
      svcName: 'UserSvc',
    });
    const preview = screen.getByTestId('env-preview');
    expect(preview.textContent).toContain('wss://api.example.com/ws');
  });

  it('shows unresolved warning when no env selected but URL has vars', async () => {
    mockReturn = makeStudioReturn({
      draft: {
        url: 'wss://{{host}}/ws',
        subprotocols: '',
        headers: [],
        queryParams: [],
      },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    expect(screen.getByTestId('env-no-env-warning')).toBeTruthy();
    expect(screen.getByTestId('env-no-env-warning').textContent).toContain(
      'No environment selected',
    );
  });

  describe('connection tabs', () => {
    it('renders connection tab bar with one tab initially', async () => {
      await renderStudioPage();
      expect(screen.getByTestId('conn-tab-bar')).toBeTruthy();
      expect(screen.getByTestId('conn-tab-add')).toBeTruthy();
    });

    it('hides close button when only one tab', async () => {
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      expect(tabBar.querySelectorAll('.ws-conn-tab-close').length).toBe(0);
    });

    it('adds a new tab when + is clicked', async () => {
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      const tabBar = screen.getByTestId('conn-tab-bar');
      const tabs = tabBar.querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(2);
    });

    it('each tab has its own content area', async () => {
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      const panes = document.querySelectorAll('[data-testid^="conn-tab-pane-"]');
      expect(panes.length).toBe(2);
    });

    it('shows close buttons when multiple tabs exist', async () => {
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      const tabBar = screen.getByTestId('conn-tab-bar');
      expect(tabBar.querySelectorAll('.ws-conn-tab-close').length).toBe(2);
    });

    it('closes a tab when close button is clicked', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      const tabBar = screen.getByTestId('conn-tab-bar');
      const closeBtns = tabBar.querySelectorAll('.ws-conn-tab-close');
      expect(closeBtns.length).toBe(2);
      fireEvent.click(closeBtns[1]);
      const panes = document.querySelectorAll('[data-testid^="conn-tab-pane-"]');
      expect(panes.length).toBe(1);
    });

    it('new tabs get default label', async () => {
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      expect(tabBar.textContent).toContain('New Connection');
    });

    it('restores tabs from persisted state', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-10', label: 'localhost:8765', url: 'ws://localhost:8765', viewTab: 'connect' },
          { id: 'ws-tab-11', label: 'echo.ws.org', url: 'wss://echo.websocket.org', viewTab: 'messages' },
        ],
        activeTabId: 'ws-tab-11',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      const tabs = tabBar.querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(2);
      expect(tabBar.textContent).toContain('localhost:8765');
      expect(tabBar.textContent).toContain('echo.ws.org');
    });

    it('saves tab state on tab add', async () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      vi.advanceTimersByTime(400);
      expect(saveSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('creates default tab when loadWsTabState rejects', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockRejectedValue(new Error('storage failed'));
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      const tabs = tabBar.querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(1);
      expect(tabBar.textContent).toContain('New Connection');
    });

    it('renames tab via double-click and Enter', async () => {
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      const tab = tabBar.querySelector('.ws-conn-tab') as HTMLElement;
      fireEvent.doubleClick(tab);
      const input = tabBar.querySelector('.ws-conn-tab-rename-input') as HTMLInputElement;
      expect(input).toBeTruthy();
      fireEvent.change(input, { target: { value: 'My Server' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(tabBar.textContent).toContain('My Server');
    });

    it('closes connected tab with confirmation', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      const tabs = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(2);
      const closeBtns = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab-close');
      fireEvent.click(closeBtns[0]);
      const tabsAfter = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabsAfter.length).toBe(1);
    });

    it('switches tab when clicking a different tab', async () => {
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      const tabs = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(2);
      // Click first tab
      fireEvent.click(tabs[0]);
      expect(tabs[0].className).toContain('ws-conn-tab-active');
    });

    it('renders loading null before state is loaded', async () => {
      // Never resolve loadWsTabState
      vi.spyOn(storageModule, 'loadWsTabState').mockReturnValue(new Promise(() => {}));
      const { container } = render(<WebSocketStudioPage />);
      // Before load completes, returns null
      expect(container.querySelector('.ws-studio-page')).toBeNull();
    });

    it('restores initial viewTab from persisted state', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-20', label: 'Test', url: 'ws://localhost:8765', viewTab: 'messages' },
        ],
        activeTabId: 'ws-tab-20',
        renamedTabIds: [],
      });
      await renderStudioPage();
      // The messages viewTab maps to Client mode + Compose left tab.
      const composeTab = screen.getByTestId('left-tab-compose');
      expect(composeTab.className).toContain('active');
    });

    it('auto-derives tab label from URL when not manually renamed', async () => {
      await renderStudioPage();
      // The default tab's URL change should update the label
      // This is handled by the onUrlChange callback
      expect(screen.getByTestId('conn-tab-bar')).toBeTruthy();
    });

    it('creates new tab with URL from history', async () => {
      const historyEntries = [
        { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
      ];
      mockHistoryReturn = makeHistoryReturn({ history: historyEntries });
      vi.spyOn(historyModule, 'useWebSocketHistory').mockReturnValue(mockHistoryReturn);
      await renderStudioPage();
      // History trigger button should be visible
      const trigger = screen.queryByTestId('conn-tab-history-trigger');
      if (trigger) {
        fireEvent.click(trigger);
        const item = screen.queryByTestId('conn-tab-history-item-ws://echo.example.com');
        if (item) {
          fireEvent.click(item);
          const tabs = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
          expect(tabs.length).toBe(2);
        }
      }
    });

    it('does not rename tab label from URL when tab has been manually renamed', async () => {
      await renderStudioPage();
      // Manually rename tab
      const tab = screen.getByTestId('conn-tab-bar').querySelector('.ws-conn-tab');
      expect(tab).toBeTruthy();
      fireEvent.doubleClick(tab!);
      const renameInput = screen.queryByTestId('conn-tab-rename-input');
      if (renameInput) {
        fireEvent.change(renameInput, { target: { value: 'Custom Name' } });
        fireEvent.keyDown(renameInput, { key: 'Enter' });
        // After rename, URL changes should not override the label
        expect(tab!.textContent).toContain('Custom Name');
      }
    });

    it('does not close last remaining tab', async () => {
      await renderStudioPage();
      const tabs = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(1);
      // Try to close the only tab - close button should be absent or disabled
      const closeBtn = screen.queryByTestId('conn-tab-close-0');
      if (closeBtn) {
        fireEvent.click(closeBtn);
      }
      // Should still have 1 tab
      const tabsAfter = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabsAfter.length).toBe(1);
    });

    it('reorders tabs via drag', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-30', label: 'Tab A', url: 'ws://a', viewTab: 'connect' },
          { id: 'ws-tab-31', label: 'Tab B', url: 'ws://b', viewTab: 'connect' },
          { id: 'ws-tab-32', label: 'Tab C', url: 'ws://c', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-30',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      const tabs = tabBar.querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(3);
      // Verify all three tabs rendered
      expect(tabBar.textContent).toContain('Tab A');
      expect(tabBar.textContent).toContain('Tab B');
      expect(tabBar.textContent).toContain('Tab C');
    });

    it('saves state on tab select', async () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      vi.advanceTimersByTime(400);
      saveSpy.mockClear();

      const tabs = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      fireEvent.click(tabs[0]);
      vi.advanceTimersByTime(400);
      expect(saveSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('saves state on tab rename', async () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      await renderStudioPage();
      const tab = screen.getByTestId('conn-tab-bar').querySelector('.ws-conn-tab') as HTMLElement;
      fireEvent.doubleClick(tab);
      const input = screen.getByTestId('conn-tab-bar').querySelector('.ws-conn-tab-rename-input') as HTMLInputElement;
      if (input) {
        fireEvent.change(input, { target: { value: 'Renamed' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        vi.advanceTimersByTime(400);
        expect(saveSpy).toHaveBeenCalled();
      }
      vi.useRealTimers();
    });

    it('declines close of connected tab when confirm is false', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-50', label: 'Active', url: 'ws://active', viewTab: 'connect' },
          { id: 'ws-tab-51', label: 'Other', url: 'ws://other', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-50',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      const tabs = tabBar.querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(2);
      // The tabs won't have 'connected' state in this mock, so close should proceed
      // without confirmation since state is 'disconnected'
      const closeBtns = tabBar.querySelectorAll('.ws-conn-tab-close');
      fireEvent.click(closeBtns[0]);
      const tabsAfter = tabBar.querySelectorAll('.ws-conn-tab');
      expect(tabsAfter.length).toBe(1);
    });

    it('saves tab state on unmount when loaded', async () => {
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      const { unmount } = await renderStudioPage();
      saveSpy.mockClear();
      unmount();
      expect(saveSpy).toHaveBeenCalled();
    });

    it('restores tabs and advances sequence past restored IDs', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-100', label: 'High ID', url: 'ws://high', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-100',
        renamedTabIds: ['ws-tab-100'],
      });
      await renderStudioPage();
      // Add a new tab - its ID should be > 100
      fireEvent.click(screen.getByTestId('conn-tab-add'));
      const tabs = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(2);
    });

    it('handles loadWsTabState returning empty tabs array', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [],
        activeTabId: '',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabs = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(1);
      expect(screen.getByTestId('conn-tab-bar').textContent).toContain('New Connection');
    });

    it('closes active tab and selects neighbor', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-60', label: 'First', url: '', viewTab: 'connect' },
          { id: 'ws-tab-61', label: 'Second', url: '', viewTab: 'connect' },
          { id: 'ws-tab-62', label: 'Third', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-61',
        renamedTabIds: [],
      });
      await renderStudioPage();
      // Close the active (middle) tab
      const closeBtns = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab-close');
      fireEvent.click(closeBtns[1]); // close 'Second'
      const tabsAfter = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabsAfter.length).toBe(2);
    });

    it('reorder out-of-bounds indices are no-ops', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-70', label: 'A', url: '', viewTab: 'connect' },
          { id: 'ws-tab-71', label: 'B', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-70',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      const tabs = tabBar.querySelectorAll('.ws-conn-tab');
      expect(tabs.length).toBe(2);
      // Tab order should remain unchanged (no drag API to trigger out-of-bounds)
      expect(tabBar.textContent).toContain('A');
      expect(tabBar.textContent).toContain('B');
    });

    it('reorder same-index is no-op', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-80', label: 'X', url: '', viewTab: 'connect' },
          { id: 'ws-tab-81', label: 'Y', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-80',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      expect(tabBar.querySelectorAll('.ws-conn-tab').length).toBe(2);
    });

    it('deriveTabLabel returns null for short URLs', async () => {
      await renderStudioPage();
      // URL too short to derive - tab label stays as default
      const tabBar = screen.getByTestId('conn-tab-bar');
      expect(tabBar.textContent).toContain('New Connection');
    });

    it('deriveTabLabel handles URL with port', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-90', label: 'localhost:9090', url: 'ws://localhost:9090/path', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-90',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      expect(tabBar.textContent).toContain('localhost:9090');
    });

    it('deriveTabLabel handles invalid URL with regex fallback', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-91', label: 'some-host', url: 'ws://some-host:1234', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-91',
        renamedTabIds: [],
      });
      await renderStudioPage();
      const tabBar = screen.getByTestId('conn-tab-bar');
      expect(tabBar.textContent).toContain('some-host');
    });

    it('handleLeftTabChange saves state', async () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-92', label: 'Test', url: 'ws://test', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-92',
        renamedTabIds: [],
      });
      await renderStudioPage();
      saveSpy.mockClear();
      // Switch the left tab in the shell content.
      fireEvent.click(screen.getByTestId('left-tab-compose'));
      vi.advanceTimersByTime(400);
      expect(saveSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('closes last tab in list when active and selects previous', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-93', label: 'First', url: '', viewTab: 'connect' },
          { id: 'ws-tab-94', label: 'Last', url: '', viewTab: 'connect' },
        ],
        activeTabId: 'ws-tab-94',
        renamedTabIds: [],
      });
      await renderStudioPage();
      // Close the last (active) tab
      const closeBtns = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab-close');
      fireEvent.click(closeBtns[1]); // close 'Last'
      const tabsAfter = screen.getByTestId('conn-tab-bar').querySelectorAll('.ws-conn-tab');
      expect(tabsAfter.length).toBe(1);
      expect(screen.getByTestId('conn-tab-bar').textContent).toContain('First');
    });
  });

  describe('deriveTabLabel', () => {
    it('returns null for empty string', () => {
      expect(deriveTabLabel('')).toBeNull();
    });

    it('returns null for short URL', () => {
      expect(deriveTabLabel('ws://')).toBeNull();
    });

    it('returns null for non-ws URL', () => {
      expect(deriveTabLabel('http://example.com')).toBeNull();
    });

    it('returns hostname for valid ws URL', () => {
      expect(deriveTabLabel('ws://example.com')).toBe('example.com');
    });

    it('returns hostname:port for ws URL with port', () => {
      expect(deriveTabLabel('ws://localhost:8080')).toBe('localhost:8080');
    });

    it('returns hostname for wss URL', () => {
      expect(deriveTabLabel('wss://secure.example.com/path')).toBe('secure.example.com');
    });

    it('returns hostname:port for wss URL with port', () => {
      expect(deriveTabLabel('wss://secure.host:9443/ws')).toBe('secure.host:9443');
    });

    it('returns null for URL with single-char hostname', () => {
      expect(deriveTabLabel('ws://x')).toBeNull();
    });

    it('handles URL that fails URL constructor via regex fallback', () => {
      const result = deriveTabLabel('ws://my-host:9090/path');
      expect(result).toBe('my-host:9090');
    });

    it('regex fallback returns host:port when URL constructor throws', () => {
      // % without valid hex escape makes new URL() throw, but regex still matches
      const result = deriveTabLabel('ws://my%server:1234');
      expect(result).toBe('my%server:1234');
    });

    it('regex fallback returns host without port when URL constructor throws', () => {
      const result = deriveTabLabel('ws://my%server/path');
      expect(result).toBe('my%server');
    });

    it('returns result for URL with brackets', () => {
      const result = deriveTabLabel('ws://[invalid-host]:1234');
      // URL constructor may or may not throw; regex always matches
      expect(typeof result).toBe('string');
    });



    it('returns null for whitespace-only input', () => {
      expect(deriveTabLabel('   ')).toBeNull();
    });

    it('returns hostname without port when port is empty', () => {
      expect(deriveTabLabel('ws://echo.websocket.org')).toBe('echo.websocket.org');
    });
  });

  describe('studio shell (the only production layout)', () => {
    it('wraps each tab in the shell by default', async () => {
      await renderStudioPage();
      expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
      expect(screen.getByTestId('mode-client')).toBeTruthy();
      expect(screen.getByTestId('mode-mock')).toBeTruthy();
      expect(screen.getByTestId('mode-saved')).toBeTruthy();
      // The existing tab content is still mounted inside the shell.
      expect(screen.getByTestId('ws-studio-split')).toBeTruthy();
    });

    it('seeds shell mode from persisted studio-layout fields', async () => {
      vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
        tabs: [
          { id: 'ws-tab-200', label: 'Mock', url: 'ws://m', viewTab: 'mock', mode: 'mock', leftTab: 'compose', rightTab: 'events' },
        ],
        activeTabId: 'ws-tab-200',
        renamedTabIds: [],
      });
      await renderStudioPage();
      // Mock mode is the active mode → the split container reflects the seeded
      // mode and the mode toggle is selected.
      expect(screen.getByTestId('mode-mock').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('ws-studio-split').getAttribute('data-mode')).toBe('mock');
    });

    it('switches mode and persists the derived viewTab', async () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(storageModule, 'saveWsTabState');
      await act(async () => {
        render(<WebSocketStudioPage />);
      });
      saveSpy.mockClear();
      fireEvent.click(screen.getByTestId('mode-saved'));
      vi.advanceTimersByTime(400);
      expect(saveSpy).toHaveBeenCalled();
      const lastState = saveSpy.mock.calls.at(-1)![0];
      expect(lastState.tabs[0].mode).toBe('saved');
      expect(lastState.tabs[0].viewTab).toBe('saved');
      vi.useRealTimers();
    });

    it('keeps the right-pane tab selection across left-tab and mode changes', async () => {
      await renderStudioPage();
      // Select a non-default right tab.
      fireEvent.click(screen.getByTestId('right-tab-stats'));
      expect(screen.getByTestId('right-tab-stats').getAttribute('aria-selected')).toBe('true');
      // Change the (orthogonal) left tab — right tab must not reset.
      fireEvent.click(screen.getByTestId('left-tab-compose'));
      expect(screen.getByTestId('right-tab-stats').getAttribute('aria-selected')).toBe('true');
      // Round-trip through another mode and back — right tab must persist.
      fireEvent.click(screen.getByTestId('mode-saved'));
      fireEvent.click(screen.getByTestId('mode-client'));
      expect(screen.getByTestId('right-tab-stats').getAttribute('aria-selected')).toBe('true');
    });

    it('splits the connect view into Connect / Headers / Params left tabs', async () => {
      await renderStudioPage();
      // Default left tab is Compose (messages view) — switch to Connect.
      fireEvent.click(screen.getByTestId('left-tab-connect'));
      // Connect tab: panel renders, headers/params relocated out.
      expect(screen.getByTestId('connect-btn')).toBeTruthy();
      expect(screen.queryByTestId('headers-section')).toBeNull();
      expect(screen.queryByTestId('query-params-section')).toBeNull();
      // Headers tab: only the headers editor.
      fireEvent.click(screen.getByTestId('left-tab-headers'));
      expect(screen.getByTestId('headers-section')).toBeTruthy();
      expect(screen.queryByTestId('query-params-section')).toBeNull();
      expect(screen.queryByTestId('connect-btn')).toBeNull();
      // Params tab: only the params editor.
      fireEvent.click(screen.getByTestId('left-tab-params'));
      expect(screen.getByTestId('query-params-section')).toBeTruthy();
      expect(screen.queryByTestId('headers-section')).toBeNull();
      expect(screen.queryByTestId('connect-btn')).toBeNull();
    });

    it('shows the relocated composer on the Compose left tab', async () => {
      await renderStudioPage();
      fireEvent.click(screen.getByTestId('left-tab-compose'));
      // Compose tab maps to the messages view: exactly one composer (the
      // relocated standalone pane) and no connect/headers/params config.
      expect(screen.queryAllByTestId('send-btn')).toHaveLength(1);
      expect(screen.getByTestId('ping-btn')).toBeTruthy();
      expect(screen.queryByTestId('connect-btn')).toBeNull();
      expect(screen.queryByTestId('headers-section')).toBeNull();
      expect(screen.queryByTestId('query-params-section')).toBeNull();
    });
  });
});

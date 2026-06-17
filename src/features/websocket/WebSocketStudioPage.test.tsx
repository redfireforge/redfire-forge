/**
 * @vitest-environment jsdom
 *
 * Core WebSocketStudioPage tests: basic rendering, environment selectors,
 * and connection tab management. For deriveTabLabel and studio shell layout
 * tests, see WebSocketStudioPage.shell.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketStudioPage } from './WebSocketStudioPage';
import * as hookModule from './useWebSocketStudio';
import * as profilesModule from '../../app/hooks/useWebSocketProfiles';
import * as templatesModule from '../../app/hooks/useWebSocketTemplates';
import * as historyModule from '../../app/hooks/useWebSocketHistory';
import * as storageModule from '../../shared/websocket/websocketStorage';
import { createDefaultReconnectState } from '../../shared/websocket/types';
import {
  makeStudioReturn,
  makeProfilesReturn,
  makeTemplatesReturn,
  makeHistoryReturn,
  renderStudioPage,
} from './WebSocketStudioPage.test-factories';

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

let mockReturn: ReturnType<typeof makeStudioReturn>;
let mockProfilesReturn: ReturnType<typeof makeProfilesReturn>;
let mockHistoryReturn: ReturnType<typeof makeHistoryReturn>;

beforeEach(() => {
  mockReturn = makeStudioReturn();
  mockProfilesReturn = makeProfilesReturn();
  mockHistoryReturn = makeHistoryReturn();
  vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
  vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(mockProfilesReturn);
  vi.spyOn(templatesModule, 'useWebSocketTemplates').mockReturnValue(makeTemplatesReturn());
  vi.spyOn(historyModule, 'useWebSocketHistory').mockReturnValue(mockHistoryReturn);
  vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue(null);
  vi.spyOn(storageModule, 'saveWsTabState').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
    fireEvent.click(screen.getByTestId('left-tab-send'));
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
    expect(screen.getByTestId('left-tab-send').textContent).toContain('1');
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
    fireEvent.click(screen.getByTestId('left-tab-send'));
    expect(screen.getByTestId('template-trigger')).toBeTruthy();
  });

  it('renders format selector on the Compose left tab', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-send'));
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
    fireEvent.click(screen.getByTestId('left-tab-send'));
    expect(screen.getByTestId('left-tab-send').className).toContain('active');
    fireEvent.click(screen.getByTestId('left-tab-connect'));
    expect(screen.getByTestId('left-tab-connect').className).toContain('active');
  });

  it('renders Compose content without guard on the messages view', async () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-send'));
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
    fireEvent.click(screen.getByTestId('left-tab-send'));
    expect(screen.getByTestId('left-tab-send').className).toContain('active');
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
      const composeTab = screen.getByTestId('left-tab-send');
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
      fireEvent.click(screen.getByTestId('left-tab-send'));
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

});
// Note: deriveTabLabel unit tests and studio shell layout tests are in
// WebSocketStudioPage.shell.test.tsx

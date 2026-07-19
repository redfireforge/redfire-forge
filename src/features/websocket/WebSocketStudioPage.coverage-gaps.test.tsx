/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebSocketStudioPage } from './WebSocketStudioPage';

const {
  mockLoadWsTabState,
  mockSaveWsTabState,
  mockHistoryReturn,
  capturedTabBarPropsRef,
  capturedContentProps,
} = vi.hoisted(() => ({
  mockLoadWsTabState: vi.fn(async () => null),
  mockSaveWsTabState: vi.fn(async () => undefined),
  mockHistoryReturn: {
    history: [] as Array<{ url: string; protocol: string; lastUsed: string }>,
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    clearHistory: vi.fn(),
  },
  capturedTabBarPropsRef: { current: {} as Record<string, unknown> },
  capturedContentProps: {} as Record<string, Record<string, unknown>>,
}));

function setCapturedContentProps(tabId: string, props: Record<string, unknown>): void {
  capturedContentProps[tabId] = props;
}

vi.mock('../../shared/websocket/websocketStorage', () => ({
  loadWsTabState: mockLoadWsTabState,
  saveWsTabState: mockSaveWsTabState,
}));

vi.mock('../../app/hooks/useWebSocketProfiles', () => ({
  useWebSocketProfiles: () => ({
    profiles: [],
    loading: false,
    error: null,
    saveProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    duplicateProfile: vi.fn(),
    importProfiles: vi.fn(),
    exportProfiles: vi.fn(),
    loadProfileAsDraft: vi.fn(),
  }),
}));

vi.mock('../../app/hooks/useWebSocketTemplates', () => ({
  useWebSocketTemplates: () => ({
    templates: [],
    loading: false,
    error: null,
    saveTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    loadTemplate: vi.fn(),
  }),
}));

vi.mock('../../app/hooks/useWebSocketHistory', () => ({
  useWebSocketHistory: () => mockHistoryReturn,
}));

vi.mock('../../shared/components/ConfirmModal', () => ({
  default: ({ title, message, onConfirm, onCancel }: { title: string; message: React.ReactNode; onConfirm: () => void; onCancel: () => void }) => (
    <div data-testid="ws-confirm-modal">
      <div>{title}</div>
      <div>{message}</div>
      <button data-testid="ws-confirm-confirm" type="button" onClick={onConfirm}>confirm</button>
      <button data-testid="ws-confirm-cancel" type="button" onClick={onCancel}>cancel</button>
    </div>
  ),
}));

vi.mock('./WsConnectionTabBar', () => ({
  WsConnectionTabBar: (props: Record<string, unknown>) => {
    capturedTabBarPropsRef.current = props;
    const tabs = props.tabs as Array<{ id: string; label: string; url?: string }>;
    return (
      <div data-testid="mock-ws-tab-bar">
        <div data-testid="mock-ws-active-tab">{String(props.activeTabId ?? '')}</div>
        <button data-testid="mock-ws-add" type="button" onClick={() => (props.onAdd as (() => void) | undefined)?.()}>add</button>
        <button data-testid="mock-ws-add-url" type="button" onClick={() => (props.onAddWithUrl as ((url: string, protocol?: string) => void) | undefined)?.('ws://my%server:1234', 'graphql-ws')}>add-url</button>
        <button data-testid="mock-ws-add-url-empty" type="button" onClick={() => (props.onAddWithUrl as ((url: string, protocol?: string) => void) | undefined)?.('ws://', undefined)}>add-url-empty</button>
        {tabs.map((tab) => (
          <div key={tab.id} data-testid={`mock-ws-tab-${tab.id}`}>
            <span>{tab.label}</span>
            <button data-testid={`mock-ws-duplicate-${tab.id}`} type="button" onClick={() => (props.onDuplicate as ((id: string) => void) | undefined)?.(tab.id)}>duplicate</button>
            <button data-testid={`mock-ws-close-${tab.id}`} type="button" onClick={() => (props.onClose as ((id: string) => void) | undefined)?.(tab.id)}>close</button>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('./WsConnectionTabContent', () => ({
  WsConnectionTabContent: React.forwardRef(function MockWsConnectionTabContent(props: Record<string, unknown>, _ref) {
    const tabId = String(props.tabId);
    setCapturedContentProps(tabId, props);
    return <div data-testid={`mock-ws-content-${tabId}`} />;
  }),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: vi.fn(),
  }),
}));

beforeEach(() => {
  mockLoadWsTabState.mockReset();
  mockLoadWsTabState.mockResolvedValue(null);
  mockSaveWsTabState.mockReset();
  mockHistoryReturn.history = [];
  mockHistoryReturn.addEntry.mockReset();
  mockHistoryReturn.removeEntry.mockReset();
  mockHistoryReturn.clearHistory.mockReset();
  capturedTabBarPropsRef.current = {};
  for (const key of Object.keys(capturedContentProps)) delete capturedContentProps[key];
});

async function renderPage(state?: unknown) {
  if (state) mockLoadWsTabState.mockResolvedValueOnce(state as never);
  await act(async () => {
    render(<WebSocketStudioPage />);
  });
}

describe('WebSocketStudioPage coverage gaps', () => {
  it('duplicates a renamed tab and copies persisted seed props into the duplicated child', async () => {
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
          headers: [{ key: 'X-Test', value: '1', enabled: true }],
          queryParams: [{ key: 'q', value: 'v', enabled: true }],
          auth: { type: 'bearer', token: 'secret' },
          mockPort: 9988,
        },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: ['ws-tab-1'],
    });

    fireEvent.click(screen.getByTestId('mock-ws-duplicate-ws-tab-1'));

    const tabs = (capturedTabBarPropsRef.current.tabs as Array<{ id: string; label: string; url?: string }>);
    expect(tabs).toHaveLength(2);
    expect(tabs[1].label).toBe('Custom Name (copy)');
    expect(tabs[1].url).toBe('ws://demo.local/socket');

    const duplicateId = tabs[1].id;
    const props = capturedContentProps[duplicateId];
    expect(props.initialUrl).toBe('ws://demo.local/socket');
    expect(props.initialDraft).toMatchObject({
      subprotocols: 'graphql-ws',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      queryParams: [{ key: 'q', value: 'v', enabled: true }],
      auth: { type: 'bearer', token: 'secret' },
    });
    expect(props.controlledMode).toBe('mock');
    expect(props.controlledLeftTab).toBe('send');
    expect(props.controlledRightTab).toBe('stats');
  });

  it('adds a URL tab with regex-fallback label when URL parsing fails', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('mock-ws-add-url'));

    const tabs = capturedTabBarPropsRef.current.tabs as Array<{ label: string; url?: string }>;
    const added = tabs.find((tab) => tab.url === 'ws://my%server:1234');
    expect(added?.label).toBe('my%server:1234');
  });

  it('falls back to "New Connection" when add-with-url cannot derive a label and no protocol is supplied', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('mock-ws-add-url-empty'));

    const tabs = capturedTabBarPropsRef.current.tabs as Array<{ label: string; url?: string; id: string }>;
    const added = tabs.find((tab) => tab.url === 'ws://');
    expect(added?.label).toBe('New Connection');
    if (added) {
      const props = capturedContentProps[added.id];
      expect(props.initialProtocol).toBeUndefined();
    }
  });

  it('does not add or duplicate when already at max tabs', async () => {
    await renderPage({
      tabs: Array.from({ length: 8 }, (_, index) => ({ id: `ws-tab-${index + 1}`, label: `Tab ${index + 1}`, url: '', viewTab: 'connect' })),
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    });

    fireEvent.click(screen.getByTestId('mock-ws-add'));
    fireEvent.click(screen.getByTestId('mock-ws-add-url-empty'));
    fireEvent.click(screen.getByTestId('mock-ws-duplicate-ws-tab-1'));

    const tabs = capturedTabBarPropsRef.current.tabs as Array<{ id: string }>;
    expect(tabs).toHaveLength(8);
  });

  it('duplicates a non-renamed tab without copy suffix and without seed props when none exist', async () => {
    await renderPage({
      tabs: [{ id: 'ws-tab-1', label: 'Plain', url: '', viewTab: 'connect' }],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    });

    fireEvent.click(screen.getByTestId('mock-ws-duplicate-ws-tab-1'));
    const tabs = capturedTabBarPropsRef.current.tabs as Array<{ id: string; label: string; url?: string }>;
    expect(tabs).toHaveLength(2);
    expect(tabs[1].label).toBe('Plain');
    const duplicateProps = capturedContentProps[tabs[1].id];
    expect(duplicateProps.initialDraft).toMatchObject({ subprotocols: '', headers: [], queryParams: [], auth: undefined });
    expect(duplicateProps.controlledMode).toBe('client');
  });

  it('keeps a connected tab open until confirm and then closes it', async () => {
    await renderPage({
      tabs: [
        { id: 'ws-tab-1', label: 'Active', url: 'ws://a', viewTab: 'connect' },
        { id: 'ws-tab-2', label: 'Other', url: '', viewTab: 'connect' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    });

    act(() => {
      (capturedContentProps['ws-tab-1'].onConnectionStateChange as (tabId: string, state: string) => void)('ws-tab-1', 'connected');
    });
    fireEvent.click(screen.getByTestId('mock-ws-close-ws-tab-1'));
    expect(screen.getByTestId('ws-confirm-modal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ws-confirm-confirm'));

    const tabs = capturedTabBarPropsRef.current.tabs as Array<{ id: string }>;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe('ws-tab-2');
  });

  it('closing a disconnected non-active tab preserves the active tab and ignores closing the last tab', async () => {
    await renderPage({
      tabs: [
        { id: 'ws-tab-1', label: 'Active', url: '', viewTab: 'connect' },
        { id: 'ws-tab-2', label: 'Other', url: '', viewTab: 'connect' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    });

    fireEvent.click(screen.getByTestId('mock-ws-close-ws-tab-2'));
    expect(screen.getByTestId('mock-ws-active-tab').textContent).toBe('ws-tab-1');

    fireEvent.click(screen.getByTestId('mock-ws-close-ws-tab-1'));
    const tabs = capturedTabBarPropsRef.current.tabs as Array<{ id: string }>;
    expect(tabs).toHaveLength(1);
  });

  it('adds history entry with explicit protocol and with auto fallback when connected', async () => {
    await renderPage({
      tabs: [{ id: 'ws-tab-1', label: 'Hist', url: '', viewTab: 'connect' }],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    });

    act(() => {
      (capturedContentProps['ws-tab-1'].onUrlChange as (tabId: string, url: string) => void)('ws-tab-1', 'ws://history.local');
      (capturedContentProps['ws-tab-1'].onConnectionStateChange as (tabId: string, state: string, protocol?: string) => void)('ws-tab-1', 'connected', 'graphql-ws');
      (capturedContentProps['ws-tab-1'].onConnectionStateChange as (tabId: string, state: string, protocol?: string) => void)('ws-tab-1', 'connected');
    });

    expect(mockHistoryReturn.addEntry).toHaveBeenNthCalledWith(1, 'ws://history.local', 'graphql-ws');
    expect(mockHistoryReturn.addEntry).toHaveBeenNthCalledWith(2, 'ws://history.local', 'auto');
  });

  it('does not relabel when url change cannot derive a label', async () => {
    await renderPage({
      tabs: [{ id: 'ws-tab-1', label: 'Keep Me', url: '', viewTab: 'connect' }],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    });

    act(() => {
      (capturedContentProps['ws-tab-1'].onUrlChange as (tabId: string, url: string) => void)('ws-tab-1', 'http://not-websocket');
    });
    const tabs = capturedTabBarPropsRef.current.tabs as Array<{ label: string }>;
    expect(tabs[0].label).toBe('Keep Me');
  });
});
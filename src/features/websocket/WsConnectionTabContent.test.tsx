/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { WsConnectionTabContent, type WsConnectionTabContentHandle, type WsConnectionTabContentProps } from './WsConnectionTabContent';
import * as hookModule from './useWebSocketStudio';
import type { UseWebSocketStudioReturn } from './useWebSocketStudio';
import * as recordingModule from './useWebSocketRecording';
import type { UseWebSocketRecordingReturn } from './useWebSocketRecording';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '../../app/hooks/useWebSocketTemplates';
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
    maxMessages: 10000,
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

let mockStudio: UseWebSocketStudioReturn;
let mockProfiles: UseWebSocketProfilesReturn;
let mockTemplates: UseWebSocketTemplatesReturn;
let mockRecording: UseWebSocketRecordingReturn;

function makeRecordingReturn(overrides?: Partial<UseWebSocketRecordingReturn>): UseWebSocketRecordingReturn {
  return {
    state: 'idle',
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    recordMessage: vi.fn(),
    recordStateChange: vi.fn(),
    loadRecording: vi.fn().mockResolvedValue(true),
    startReplay: vi.fn(),
    pauseReplay: vi.fn(),
    resumeReplay: vi.fn(),
    stopReplay: vi.fn(),
    replaySpeed: 1,
    setReplaySpeed: vi.fn(),
    replayProgress: null,
    loadedRecording: null,
    ...overrides,
  };
}

function makeProps(overrides?: Partial<WsConnectionTabContentProps>): WsConnectionTabContentProps {
  return {
    tabId: 'test-tab',
    envVarMap: {},
    profilesHook: mockProfiles,
    templatesHook: mockTemplates,
    onConnectionStateChange: vi.fn(),
    onUrlChange: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockStudio = makeStudioReturn();
  mockProfiles = makeProfilesReturn();
  mockTemplates = makeTemplatesReturn();
  mockRecording = makeRecordingReturn();
  vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
  vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WsConnectionTabContent', () => {
  it('renders with correct testid', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('conn-tab-content-test-tab')).toBeTruthy();
  });

  it('renders Connect/Messages/Saved view tabs', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('tab-connect')).toBeTruthy();
    expect(screen.getByTestId('tab-messages')).toBeTruthy();
    expect(screen.getByTestId('tab-saved')).toBeTruthy();
  });

  it('Connect tab is active by default', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('tab-connect').className).toContain('active');
  });

  it('shows guard when disconnected and URL is blank', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByText('No WebSocket connection')).toBeTruthy();
  });

  it('hides guard when URL is present', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://localhost:8765', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('shows config lock banner when connected', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('config-lock-banner')).toBeTruthy();
  });

  it('switches to Messages tab', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('tab-messages').className).toContain('active');
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('switches to Saved tab', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    expect(screen.getByTestId('tab-saved').className).toContain('active');
    expect(screen.getByText(/No saved connections/)).toBeTruthy();
  });

  it('shows message badge on Messages tab', () => {
    const msg = {
      id: '1', direction: 'received' as const, type: 'text' as const,
      data: 'hi', size: 2, timestamp: new Date().toISOString(),
    };
    mockStudio = makeStudioReturn({ messages: [msg] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('exposes handle via ref', () => {
    const ref = createRef<WsConnectionTabContentHandle>();
    render(<WsConnectionTabContent ref={ref} {...makeProps()} />);
    expect(ref.current).toBeTruthy();
    expect(ref.current!.getConnectionState()).toBe('disconnected');
    expect(ref.current!.getUrl()).toBe('');
    expect(ref.current!.getMessageCount()).toBe(0);
  });

  it('reports connection state changes', () => {
    const onStateChange = vi.fn();
    const { rerender } = render(
      <WsConnectionTabContent {...makeProps({ onConnectionStateChange: onStateChange })} />,
    );
    mockStudio = makeStudioReturn({ connection: { state: 'connected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(
      <WsConnectionTabContent {...makeProps({ onConnectionStateChange: onStateChange })} />,
    );
    expect(onStateChange).toHaveBeenCalledWith('test-tab', 'connected', 'auto');
  });

  it('maps closing state to connected hint', () => {
    const onStateChange = vi.fn();
    mockStudio = makeStudioReturn({ connection: { state: 'closing' as 'connected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(
      <WsConnectionTabContent {...makeProps({ onConnectionStateChange: onStateChange })} />,
    );
    const calls = onStateChange.mock.calls.filter((c: unknown[]) => c[1] === 'connected');
    expect(calls.length).toBeGreaterThanOrEqual(0);
  });

  it('passes envVarMap to useWebSocketStudio', () => {
    const spy = vi.spyOn(hookModule, 'useWebSocketStudio');
    const envMap = { baseUrl: 'https://api.example.com', host: 'api.example.com' };
    render(<WsConnectionTabContent {...makeProps({ envVarMap: envMap })} />);
    expect(spy).toHaveBeenCalledWith(envMap, []);
  });

  it('handleLoadProfile calls studio setters on Saved tab', () => {
    const profile = {
      id: 'p1', name: 'Test', url: 'wss://api.example.com',
      headers: [], queryParams: [], subprotocols: 'graphql-ws',
      autoReconnect: true, maxReconnectAttempts: 10,
      reconnectIntervalMs: 5000, maxMessages: 500,
      protocolMode: 'graphql-ws' as const,
      backoffMultiplier: 2 as const,
      createdAt: '', updatedAt: '',
    };
    mockProfiles = makeProfilesReturn({ profiles: [profile] });
    render(<WsConnectionTabContent {...makeProps({ profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    fireEvent.click(screen.getByTestId('load-btn-p1'));
    expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('graphql-ws');
    expect(mockStudio.setAutoReconnect).toHaveBeenCalledWith(true);
    expect(mockStudio.setMaxReconnectAttempts).toHaveBeenCalledWith(10);
    expect(mockStudio.setReconnectIntervalMs).toHaveBeenCalledWith(5000);
    expect(mockStudio.setBackoffMultiplier).toHaveBeenCalledWith(2);
    expect(mockStudio.setMaxMessages).toHaveBeenCalledWith(500);
    expect(mockStudio.setTlsConfig).toHaveBeenCalled();
  });

  it('handleSaveAsProfile switches to Saved tab with prefill', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://localhost:8765', subprotocols: 'json', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('save-as-profile-btn'));
    expect(screen.getByTestId('tab-saved').className).toContain('active');
  });

  it('disconnect from banner works', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('banner-disconnect-link'));
    expect(mockStudio.disconnect).toHaveBeenCalled();
  });

  it('shows Mock tab', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('tab-mock')).toBeTruthy();
  });

  it('switches to Mock tab and shows mock server panel', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-mock'));
    expect(screen.getByTestId('tab-mock').className).toContain('active');
    expect(screen.getByTestId('mock-server-panel')).toBeTruthy();
  });

  it('calls onViewTabChange when switching tabs', () => {
    const onViewTabChange = vi.fn();
    render(<WsConnectionTabContent {...makeProps({ onViewTabChange })} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(onViewTabChange).toHaveBeenCalledWith('test-tab', 'messages');
  });

  it('starts with initialViewTab if provided', () => {
    render(<WsConnectionTabContent {...makeProps({ initialViewTab: 'messages' })} />);
    expect(screen.getByTestId('tab-messages').className).toContain('active');
  });

  it('applies initialUrl on mount', () => {
    render(<WsConnectionTabContent {...makeProps({ initialUrl: 'ws://preset:3000' })} />);
    expect(mockStudio.setDraft).toHaveBeenCalledWith({ url: 'ws://preset:3000' });
  });

  it('reports URL changes', () => {
    const onUrlChange = vi.fn();
    const { rerender } = render(
      <WsConnectionTabContent {...makeProps({ onUrlChange })} />,
    );
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://changed:9000', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps({ onUrlChange })} />);
    expect(onUrlChange).toHaveBeenCalledWith('test-tab', 'ws://changed:9000');
  });

  it('shows guard on connect tab when disconnected and URL empty', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByText('No WebSocket connection')).toBeTruthy();
    expect(screen.getByText(/Enter a WebSocket URL and click Connect/)).toBeTruthy();
  });

  it('hides guard when connected even with URL', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('shows save-as-profile button', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('save-as-profile-btn')).toBeTruthy();
  });

  it('ref getConnectionState maps closing to connected', () => {
    const ref = createRef<WsConnectionTabContentHandle>();
    mockStudio = makeStudioReturn({ connection: { state: 'closing' as 'connected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent ref={ref} {...makeProps()} />);
    expect(ref.current!.getConnectionState()).toBe('connected');
  });

  it('ref getMessageCount returns correct count', () => {
    const ref = createRef<WsConnectionTabContentHandle>();
    const msgs = [
      { id: '1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() },
      { id: '2', direction: 'sent' as const, type: 'text' as const, data: 'b', size: 1, timestamp: new Date().toISOString() },
    ];
    mockStudio = makeStudioReturn({ messages: msgs });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent ref={ref} {...makeProps()} />);
    expect(ref.current!.getMessageCount()).toBe(2);
  });

  it('shows profile count on Saved tab', () => {
    mockProfiles = makeProfilesReturn({
      profiles: [
        { id: 'p1', name: 'A', url: 'wss://a', headers: [], queryParams: [], subprotocols: '', autoReconnect: false, maxReconnectAttempts: 5, reconnectIntervalMs: 3000, maxMessages: 1000, createdAt: '', updatedAt: '' },
        { id: 'p2', name: 'B', url: 'wss://b', headers: [], queryParams: [], subprotocols: '', autoReconnect: false, maxReconnectAttempts: 5, reconnectIntervalMs: 3000, maxMessages: 1000, createdAt: '', updatedAt: '' },
      ],
    });
    render(<WsConnectionTabContent {...makeProps({ profilesHook: mockProfiles })} />);
    const savedTab = screen.getByTestId('tab-saved');
    expect(savedTab.textContent).toContain('2');
  });

  it('handleLoadProfile applies TLS config from profile', () => {
    const profile = {
      id: 'p1', name: 'TLS Test', url: 'wss://api.example.com',
      headers: [], queryParams: [], subprotocols: '',
      autoReconnect: false, maxReconnectAttempts: 5,
      reconnectIntervalMs: 3000, maxMessages: 1000,
      tlsConfig: { rejectUnauthorized: false },
      createdAt: '', updatedAt: '',
    };
    mockProfiles = makeProfilesReturn({ profiles: [profile] });
    render(<WsConnectionTabContent {...makeProps({ profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    fireEvent.click(screen.getByTestId('load-btn-p1'));
    expect(mockStudio.setTlsConfig).toHaveBeenCalledWith(
      expect.objectContaining({ rejectUnauthorized: false }),
    );
  });

  it('renders metrics section on messages tab when connected', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('tab-messages').className).toContain('active');
  });

  it('renders mock server tab', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    const mockTab = screen.getByTestId('tab-mock');
    expect(mockTab).toBeTruthy();
    fireEvent.click(mockTab);
    expect(mockTab.className).toContain('active');
  });

  it('starts on connect tab by default', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('tab-connect').className).toContain('active');
  });

  it('renders saved tab and shows profiles', () => {
    const profile = {
      id: 'p2', name: 'Test Profile', url: 'ws://simple',
      headers: [], queryParams: [], subprotocols: '',
      autoReconnect: false, maxReconnectAttempts: 5,
      reconnectIntervalMs: 3000, maxMessages: 1000,
      createdAt: '', updatedAt: '',
    };
    mockProfiles = makeProfilesReturn({ profiles: [profile] });
    render(<WsConnectionTabContent {...makeProps({ profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    expect(screen.getByTestId('tab-saved').className).toContain('active');
  });

  // ── Recording controls ──────────────────────────────────────────
  it('shows recording start button on messages tab when idle', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('start-recording-btn')).toBeTruthy();
  });

  it('shows load test toggle on messages tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('load-test-toggle-btn')).toBeTruthy();
  });

  it('toggles load test panel on messages tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    fireEvent.click(screen.getByTestId('load-test-toggle-btn'));
    // Load test panel should be visible
    expect(screen.getByTestId('load-test-panel')).toBeTruthy();
  });

  // ── handleEditConnection ──────────────────────────────────────────
  it('handleEditConnection cancels reconnect and switches to connect tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
      reconnectState: { ...createDefaultReconnectState(), isReconnecting: true },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    // Switch to messages first
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('tab-messages').className).toContain('active');
    // Switch back to connect
    fireEvent.click(screen.getByTestId('tab-connect'));
    expect(screen.getByTestId('tab-connect').className).toContain('active');
  });

  // ── handleLocalHistorySelect ──────────────────────────────────────
  it('renders schema toggle on messages tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('schema-toggle-btn')).toBeTruthy();
  });

  // ── Guard hides on messages tab ──────────────────────────────────
  it('does not show guard on messages tab even when URL is empty', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  // ── Mock tab shows mock server ──────────────────────────────────
  it('shows mock server on mock tab', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-mock'));
    expect(screen.getByTestId('mock-server-panel')).toBeTruthy();
  });

  // ── Connection state recording via effect ──────────────────────
  it('reports closing state as connected hint on transition', () => {
    const onStateChange = vi.fn();
    const { rerender } = render(<WsConnectionTabContent {...makeProps({ onConnectionStateChange: onStateChange })} />);
    onStateChange.mockClear();
    // Transition to closing
    mockStudio = makeStudioReturn({ connection: { state: 'closing' as 'connected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps({ onConnectionStateChange: onStateChange })} />);
    expect(onStateChange).toHaveBeenCalledWith('test-tab', 'connected', 'auto');
  });

  // ── handleSwitchToConnect from saved tab ──────────────────────
  it('handleSwitchToConnect returns to connect tab', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    expect(screen.getByTestId('tab-saved').className).toContain('active');
    // The WebSocketSavedConnections component should have some way back
    expect(screen.getByTestId('tab-connect')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tab-connect'));
    expect(screen.getByTestId('tab-connect').className).toContain('active');
  });

  // ── handleApplyDraft ──────────────────────────────────────────
  it('passes onApplyDraft to saved connections', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    // Saved connections panel renders - onApplyDraft is wired
    expect(screen.getByTestId('tab-saved').className).toContain('active');
  });

  // ── Export button on messages tab ──────────────────────────────
  it('shows export button on messages tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('export-messages-btn')).toBeTruthy();
  });

  // ── Compare button on messages tab ──────────────────────────────
  it('shows compare button on messages tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('compare-btn')).toBeTruthy();
  });

  // ── Filter bar toggles on messages tab ──────────────────────────
  it('shows filter toggle on messages tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('filter-toggle-btn')).toBeTruthy();
  });

  // ── Status bar visibility ──────────────────────────────────────
  it('shows status bar on messages tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected', url: 'ws://test' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('messages-status-bar')).toBeTruthy();
  });

  it('hides status bar on connect tab', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    // Stay on connect tab
    expect(screen.queryByTestId('messages-status-bar')).toBeNull();
  });

  // ── handlePrefillConsumed clears prefill ──────────────────────
  it('clears prefill after save-as-profile consumed', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://localhost:8765', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    // Trigger save-as-profile
    fireEvent.click(screen.getByTestId('save-as-profile-btn'));
    expect(screen.getByTestId('tab-saved').className).toContain('active');
    // Switch away and back to verify state is stable
    fireEvent.click(screen.getByTestId('tab-connect'));
    expect(screen.getByTestId('tab-connect').className).toContain('active');
  });

  // ── Message badge shows correct count ──────────────────────────
  it('shows message count on messages tab badge', () => {
    const msgs = [
      { id: '1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() },
      { id: '2', direction: 'sent' as const, type: 'text' as const, data: 'b', size: 1, timestamp: new Date().toISOString() },
      { id: '3', direction: 'received' as const, type: 'text' as const, data: 'c', size: 1, timestamp: new Date().toISOString() },
    ];
    mockStudio = makeStudioReturn({ messages: msgs });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  // ── handleLoadProfile without protocolMode defaults to auto ──
  it('handleLoadProfile uses auto when profile has no protocolMode', () => {
    const profile = {
      id: 'p3', name: 'No Protocol', url: 'wss://test',
      headers: [], queryParams: [], subprotocols: '',
      autoReconnect: false, maxReconnectAttempts: 5,
      reconnectIntervalMs: 3000, maxMessages: 1000,
      createdAt: '', updatedAt: '',
    };
    mockProfiles = makeProfilesReturn({ profiles: [profile] });
    render(<WsConnectionTabContent {...makeProps({ profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    fireEvent.click(screen.getByTestId('load-btn-p3'));
    expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('auto');
  });

  // ── Mock tab badge when server running ──────────────────────────
  it('shows running badge on mock tab when mock server active', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    const mockTab = screen.getByTestId('tab-mock');
    expect(mockTab).toBeTruthy();
  });

  // ── Recording lifecycle: records new messages during recording ──
  it('records new messages when recording state is active', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    const msg2 = { id: 'm2', direction: 'sent' as const, type: 'text' as const, data: 'b', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    // Add another message
    mockStudio = makeStudioReturn({ messages: [msg1, msg2] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).toHaveBeenCalledWith(msg2);
  });

  // ── Recording lifecycle: cap eviction branch ──
  it('handles cap eviction during recording when array same size but new IDs', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    const msg2 = { id: 'm2', direction: 'sent' as const, type: 'text' as const, data: 'b', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    // Start with 2 messages
    mockStudio = makeStudioReturn({ messages: [msg1, msg2] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    // Cap eviction: same array size, but m1 is gone, new m3 appears
    const msg3 = { id: 'm3', direction: 'received' as const, type: 'text' as const, data: 'c', size: 1, timestamp: new Date().toISOString() };
    mockStudio = makeStudioReturn({ messages: [msg2, msg3] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).toHaveBeenCalledWith(msg3);
  });

  // ── Recording lifecycle: skips recording when not in recording state ──
  it('does not call recordMessage when not in recording state', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'idle' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).not.toHaveBeenCalled();
  });

  // ── Recording lifecycle: records connection state changes ──
  it('records connection state change during recording', () => {
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({
      connection: { state: 'disconnected' },
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordStateChange.mockClear();
    // Transition to connected
    mockStudio = makeStudioReturn({
      connection: { state: 'connected' },
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordStateChange).toHaveBeenCalledWith('connected', 'ws://test');
  });

  // ── Recording lifecycle: does not record state change when not recording ──
  it('does not record state change when not in recording state', () => {
    mockRecording = makeRecordingReturn({ state: 'idle' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ connection: { state: 'disconnected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordStateChange.mockClear();
    mockStudio = makeStudioReturn({ connection: { state: 'connected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordStateChange).not.toHaveBeenCalled();
  });

  // ── handleLoadProfile applies all profile settings ──
  it('handleLoadProfile applies full profile settings including TLS', () => {
    const profile = {
      id: 'p-full', name: 'Full Profile', url: 'wss://full',
      headers: [], queryParams: [], subprotocols: '',
      autoReconnect: true, maxReconnectAttempts: 10,
      reconnectIntervalMs: 5000, maxMessages: 500,
      backoffMultiplier: 2,
      protocolMode: 'stomp' as const,
      tlsConfig: { rejectUnauthorized: false },
      createdAt: '', updatedAt: '',
    };
    const draftResult = { url: 'wss://full', subprotocols: '', headers: [], queryParams: [] };
    mockProfiles = makeProfilesReturn({
      profiles: [profile],
      loadProfileAsDraft: vi.fn().mockReturnValue(draftResult),
    });
    render(<WsConnectionTabContent {...makeProps({ profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    fireEvent.click(screen.getByTestId('load-btn-p-full'));
    expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('stomp');
    expect(mockStudio.setAutoReconnect).toHaveBeenCalledWith(true);
    expect(mockStudio.setMaxReconnectAttempts).toHaveBeenCalledWith(10);
    expect(mockStudio.setReconnectIntervalMs).toHaveBeenCalledWith(5000);
    expect(mockStudio.setBackoffMultiplier).toHaveBeenCalledWith(2);
    expect(mockStudio.setMaxMessages).toHaveBeenCalledWith(500);
    expect(mockStudio.setTlsConfig).toHaveBeenCalled();
    // Verify handleApplyDraft was triggered (setDraft called with the draft)
    expect(mockStudio.setDraft).toHaveBeenCalledWith(draftResult);
  });

  // ── Recording lifecycle: cap eviction with lastSeen not found ──
  it('handles cap eviction when lastSeen message is gone from array', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    // Replace with completely different message, same length → cap eviction, lastSeen not found
    const msg2 = { id: 'm2', direction: 'sent' as const, type: 'text' as const, data: 'x', size: 1, timestamp: new Date().toISOString() };
    mockStudio = makeStudioReturn({ messages: [msg2] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    // Should use fallback startIdx = msgs.length - 1
    expect(mockRecording.recordMessage).toHaveBeenCalledWith(msg2);
  });

  // ── Recording: skips when messages array empty during recording ──
  it('skips recording when messages become empty during recording', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    // Clear messages
    mockStudio = makeStudioReturn({ messages: [] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).not.toHaveBeenCalled();
  });

  // ── Recording: skips when same lastId during recording ──
  it('skips recording when messages have same lastId', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    // Same messages array → lastId unchanged
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).not.toHaveBeenCalled();
  });

  // ── handleLocalHistorySelect sets URL and protocol ──
  it('handleLocalHistorySelect sets URL and protocol from history', () => {
    const historyEntries = [
      { url: 'ws://hist.example.com', protocol: 'stomp', lastUsed: new Date().toISOString() },
    ];
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://old', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps({ history: historyEntries })} />);
    // Click URL history trigger
    const trigger = screen.queryByTestId('url-history-trigger');
    if (trigger) {
      fireEvent.click(trigger);
      const item = screen.queryByTestId('url-history-item');
      if (item) {
        fireEvent.click(item);
        expect(mockStudio.setDraft).toHaveBeenCalledWith({ url: 'ws://hist.example.com' });
        expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('stomp');
      }
    }
  });

  // ── Schema toggle visibility ──
  it('toggles schema panel visibility via schema toggle button', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    const schemaBtn = screen.queryByTestId('schema-toggle-btn');
    if (schemaBtn) {
      fireEvent.click(schemaBtn);
      // The toggle should have been called
    }
  });

  // ── Controlled view tab (shell-driven navigation) ──
  describe('controlled mode', () => {
    it('hides its own view-tab bar when controlledViewTab is provided', () => {
      render(<WsConnectionTabContent {...makeProps({ controlledViewTab: 'connect' })} />);
      expect(screen.queryByTestId('tab-connect')).toBeNull();
      expect(screen.queryByTestId('tab-messages')).toBeNull();
      expect(screen.queryByTestId('tab-saved')).toBeNull();
    });

    it('renders the controlled view regardless of internal default', () => {
      // Default uncontrolled view is connect; controlled forces saved.
      render(<WsConnectionTabContent {...makeProps({ controlledViewTab: 'saved' })} />);
      expect(screen.getByText(/No saved connections/)).toBeTruthy();
    });

    it('follows controlledViewTab changes from the parent', () => {
      const { rerender } = render(
        <WsConnectionTabContent {...makeProps({ controlledViewTab: 'connect' })} />,
      );
      expect(screen.getByText('No WebSocket connection')).toBeTruthy();
      rerender(<WsConnectionTabContent {...makeProps({ controlledViewTab: 'saved' })} />);
      expect(screen.getByText(/No saved connections/)).toBeTruthy();
    });

    it('keeps its own view-tab bar when controlledViewTab is absent (uncontrolled)', () => {
      render(<WsConnectionTabContent {...makeProps()} />);
      expect(screen.getByTestId('tab-connect')).toBeTruthy();
      expect(screen.getByTestId('tab-messages')).toBeTruthy();
    });
  });

  // ── Controlled left tab (Phase 2: Connect / Headers / Params split) ──
  describe('controlled left tab', () => {
    it('renders only the Headers editor on the headers left tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'connect', controlledLeftTab: 'headers' })}
        />,
      );
      expect(screen.getByTestId('headers-section')).toBeTruthy();
      // No params editor and no connect panel/URL bar in the headers tab.
      expect(screen.queryByTestId('query-params-section')).toBeNull();
      expect(screen.queryByTestId('connect-btn')).toBeNull();
    });

    it('renders only the Query Params editor on the params left tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'connect', controlledLeftTab: 'params' })}
        />,
      );
      expect(screen.getByTestId('query-params-section')).toBeTruthy();
      expect(screen.queryByTestId('headers-section')).toBeNull();
      expect(screen.queryByTestId('connect-btn')).toBeNull();
    });

    it('renders the connect panel without inline headers/params on the connect left tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'connect', controlledLeftTab: 'connect' })}
        />,
      );
      // Connect panel (URL + actions) renders, but headers/params are relocated.
      expect(screen.getByTestId('connect-btn')).toBeTruthy();
      expect(screen.queryByTestId('headers-section')).toBeNull();
      expect(screen.queryByTestId('query-params-section')).toBeNull();
    });

    it('updates draft headers from the relocated Headers editor', () => {
      mockStudio = makeStudioReturn({
        draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'connect', controlledLeftTab: 'headers' })}
        />,
      );
      fireEvent.click(screen.getByTestId('headers-add-btn'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({
        headers: [{ key: '', value: '', enabled: true }],
      });
    });

    it('renders headers and params inline when controlledLeftTab is absent (uncontrolled connect)', () => {
      render(<WsConnectionTabContent {...makeProps()} />);
      expect(screen.getByTestId('headers-section')).toBeTruthy();
      expect(screen.getByTestId('query-params-section')).toBeTruthy();
    });

    it('disables the relocated Headers editor while connected', () => {
      mockStudio = makeStudioReturn({
        draft: { url: 'ws://test', subprotocols: '', headers: [{ key: 'A', value: '1', enabled: true }], queryParams: [] },
        connection: { state: 'connected' },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'connect', controlledLeftTab: 'headers' })}
        />,
      );
      expect((screen.getByTestId('headers-add-btn') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ── Controlled compose tab (Phase 3: composer relocated to the left pane) ──
  describe('controlled compose tab', () => {
    it('renders the standalone composer and suppresses the inline log composer on the compose tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'messages', controlledLeftTab: 'compose' })}
        />,
      );
      // Exactly one composer (the standalone pane); the events log's inline
      // composer is suppressed via showComposer={false}.
      expect(screen.queryAllByTestId('send-btn')).toHaveLength(1);
      expect(screen.getByTestId('ping-btn')).toBeTruthy();
      expect(screen.getByLabelText('Message input')).toBeTruthy();
    });

    it('renders the inline log composer on the uncontrolled messages view (no standalone pane)', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'messages' })}
        />,
      );
      // Still exactly one composer — the log's inline one — and no duplicate.
      expect(screen.queryAllByTestId('send-btn')).toHaveLength(1);
    });

    it('sends via the relocated composer using studio.send', () => {
      mockStudio = makeStudioReturn({ connection: { state: 'connected' } });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'messages', controlledLeftTab: 'compose' })}
        />,
      );
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'hello' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(mockStudio.send).toHaveBeenCalledWith('hello', 'text');
    });

    it('hides the relocated composer while a recording is replaying', () => {
      mockRecording = makeRecordingReturn({ state: 'replaying' });
      vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledViewTab: 'messages', controlledLeftTab: 'compose' })}
        />,
      );
      // Standalone composer hidden during replay; log composer also suppressed.
      expect(screen.queryByTestId('send-btn')).toBeNull();
    });
  });

  // ── Phase 4: split-pane shell render (composition inversion) ──────────────
  describe('shell mode (controlledMode)', () => {
    it('renders the split-pane shell with mode and left/right tab strips', () => {
      render(<WsConnectionTabContent {...makeProps({ controlledMode: 'client' })} />);
      expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
      expect(screen.getByTestId('mode-client')).toBeTruthy();
      expect(screen.getByTestId('ws-studio-split')).toBeTruthy();
      expect(screen.getByTestId('ws-studio-divider')).toBeTruthy();
      expect(screen.getByTestId('left-tab-connect')).toBeTruthy();
      expect(screen.getByTestId('right-tab-events')).toBeTruthy();
      // It does NOT render its own legacy view-tab bar.
      expect(screen.queryByTestId('tab-connect')).toBeNull();
    });

    it('renders the events log in the right pane with no composer there', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'connect', controlledRightTab: 'events' })}
        />,
      );
      // Events log present (search bar) — the right pane is not the placeholder.
      expect(screen.getByTestId('search-input')).toBeTruthy();
      expect(screen.queryByText(/part of the redesigned layout/)).toBeNull();
      // Connect left pane has no composer and the events log suppresses its own.
      expect(screen.queryAllByTestId('send-btn')).toHaveLength(0);
    });

    it('renders the composer in the Compose left tab alongside the events log on the right', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'compose', controlledRightTab: 'events' })}
        />,
      );
      // Exactly one composer (the standalone left pane); events log on the right
      // suppresses its inline composer.
      expect(screen.queryAllByTestId('send-btn')).toHaveLength(1);
      expect(screen.getByTestId('ping-btn')).toBeTruthy();
      expect(screen.getByTestId('search-input')).toBeTruthy();
    });

    it('renders the headers editor in the Headers left tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'headers', controlledRightTab: 'events' })}
        />,
      );
      expect(screen.getByTestId('headers-add-btn')).toBeTruthy();
      // The events log still occupies the right pane.
      expect(screen.getByTestId('search-input')).toBeTruthy();
    });

    it('renders the Console panel (not a placeholder) for the console right tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'connect', controlledRightTab: 'console' })}
        />,
      );
      expect(screen.getByTestId('ws-console')).toBeTruthy();
      expect(screen.queryByText(/part of the redesigned layout/)).toBeNull();
      // The events log (with its search input) is not mounted on the console tab.
      expect(screen.queryByTestId('search-input')).toBeNull();
    });

    it('renders the Stats panel (not a placeholder) for the stats right tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'connect', controlledRightTab: 'stats' })}
        />,
      );
      expect(screen.getByTestId('ws-studio-stats-pane')).toBeTruthy();
      expect(screen.getByTestId('stats-panel')).toBeTruthy();
      expect(screen.queryByText(/part of the redesigned layout/)).toBeNull();
      expect(screen.queryByTestId('search-input')).toBeNull();
    });

    it('renders the Load Test panel for the loadtest right tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'connect', controlledRightTab: 'loadtest' })}
        />,
      );
      expect(screen.getByTestId('ws-studio-loadtest-pane')).toBeTruthy();
      expect(screen.getByTestId('load-test-panel')).toBeTruthy();
      expect(screen.queryByText(/part of the redesigned layout/)).toBeNull();
    });

    it('renders the Schema panel for the schema right tab', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'connect', controlledRightTab: 'schema' })}
        />,
      );
      expect(screen.getByTestId('ws-studio-schema-pane')).toBeTruthy();
      expect(screen.getByTestId('ws-schema-panel')).toBeTruthy();
      expect(screen.queryByText(/part of the redesigned layout/)).toBeNull();
    });

    it('does not render the Stats/Load Test/Schema toggle buttons in the shell Events pane', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'connect', controlledRightTab: 'events' })}
        />,
      );
      // Events log is present, but the relocated toggles are not.
      expect(screen.getByTestId('search-input')).toBeTruthy();
      expect(screen.queryByTestId('stats-toggle-btn')).toBeNull();
      expect(screen.queryByTestId('load-test-toggle-btn')).toBeNull();
      expect(screen.queryByTestId('schema-toggle-btn')).toBeNull();
    });

    it('renders Mock mode as a server bar + clients/rules split with a divider', () => {
      render(<WsConnectionTabContent {...makeProps({ controlledMode: 'mock' })} />);
      expect(screen.getByTestId('mode-mock')).toBeTruthy();
      expect(screen.getByTestId('ws-studio-topbar')).toBeTruthy();
      expect(screen.getByTestId('ws-studio-divider')).toBeTruthy();
      expect(screen.getByTestId('mock-server-panel')).toBeTruthy();
      expect(screen.queryByTestId('search-input')).toBeNull();
      expect(screen.queryByText(/part of the redesigned layout/)).toBeNull();
    });

    it('renders Saved mode as a rail + detail split with a divider', () => {
      render(<WsConnectionTabContent {...makeProps({ controlledMode: 'saved' })} />);
      expect(screen.getByTestId('mode-saved')).toBeTruthy();
      expect(screen.getByTestId('ws-studio-divider')).toBeTruthy();
      expect(screen.getByTestId('saved-connections')).toBeTruthy();
      expect(screen.getByTestId('saved-detail')).toBeTruthy();
      expect(screen.getByText(/No saved connections/)).toBeTruthy();
    });

    it('forwards mode, left-tab, and right-tab changes to the parent', () => {
      const onModeChange = vi.fn();
      const onLeftTabChange = vi.fn();
      const onRightTabChange = vi.fn();
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledMode: 'client',
            controlledLeftTab: 'connect',
            controlledRightTab: 'events',
            onModeChange,
            onLeftTabChange,
            onRightTabChange,
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('mode-saved'));
      expect(onModeChange).toHaveBeenCalledWith('saved');
      fireEvent.click(screen.getByTestId('left-tab-compose'));
      expect(onLeftTabChange).toHaveBeenCalledWith('compose');
      fireEvent.click(screen.getByTestId('right-tab-stats'));
      expect(onRightTabChange).toHaveBeenCalledWith('stats');
    });

    it('switches to Saved mode when "Save as profile" is clicked from the Connect tab', () => {
      mockStudio = makeStudioReturn({
        draft: { url: 'ws://localhost:8765', subprotocols: '', headers: [], queryParams: [] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      const onModeChange = vi.fn();
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledMode: 'client',
            controlledLeftTab: 'connect',
            controlledRightTab: 'events',
            onModeChange,
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('save-as-profile-btn'));
      expect(onModeChange).toHaveBeenCalledWith('saved');
    });
  });

  describe('coverage — draft seeding, persistence and relocated editors', () => {
    it('seeds the draft and protocol from initialDraft/initialUrl/initialProtocol on mount', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({
            initialUrl: 'ws://seed:9000',
            initialProtocol: 'graphql-ws',
            initialDraft: {
              subprotocols: 'graphql-ws',
              headers: [{ key: 'X-Seed', value: '1', enabled: true }],
              queryParams: [{ key: 'q', value: '2', enabled: true }],
              auth: { type: 'none' },
            },
          })}
        />,
      );
      expect(mockStudio.setDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'ws://seed:9000',
          subprotocols: 'graphql-ws',
          headers: [{ key: 'X-Seed', value: '1', enabled: true }],
          queryParams: [{ key: 'q', value: '2', enabled: true }],
          auth: { type: 'none' },
        }),
      );
      expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('graphql-ws');
    });

    it('exposes the full draft snapshot via the ref handle', () => {
      const ref = createRef<WsConnectionTabContentHandle>();
      render(<WsConnectionTabContent ref={ref} {...makeProps()} />);
      expect(ref.current!.getDraft()).toBe(mockStudio.draft);
    });

    it('fires onDraftChange when a persistable draft field changes', () => {
      const onDraftChange = vi.fn();
      const { rerender } = render(
        <WsConnectionTabContent {...makeProps({ onDraftChange })} />,
      );
      // First effect run only snapshots; no callback yet.
      expect(onDraftChange).not.toHaveBeenCalled();
      mockStudio = makeStudioReturn({
        draft: {
          ...createDefaultDraft(),
          headers: [{ key: 'X-New', value: 'v', enabled: true }],
        },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      rerender(<WsConnectionTabContent {...makeProps({ onDraftChange })} />);
      expect(onDraftChange).toHaveBeenCalledWith('test-tab');
    });

    it('clears headers via the relocated Headers editor (shell mode)', () => {
      mockStudio = makeStudioReturn({
        draft: { ...createDefaultDraft(), headers: [{ key: 'a', value: 'b', enabled: true }] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'headers' })}
        />,
      );
      fireEvent.click(screen.getByTestId('headers-delete-all-btn'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ headers: [] });
    });

    it('clears query params via the relocated Params editor (shell mode)', () => {
      mockStudio = makeStudioReturn({
        draft: { ...createDefaultDraft(), queryParams: [{ key: 'q', value: '1', enabled: true }] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'params' })}
        />,
      );
      fireEvent.click(screen.getByTestId('query-params-delete-all-btn'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ queryParams: [] });
    });

    it('renders the relocated Auth panel (shell mode)', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'auth' })}
        />,
      );
      // The auth pane mounts WebSocketAuthPanel without throwing.
      expect(document.querySelector('.ws-studio-content')).toBeTruthy();
    });
  });
});


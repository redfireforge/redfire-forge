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

// The component is always shell-driven now: the parent (WebSocketStudioPage)
// owns navigation and feeds `controlledMode`/`controlledLeftTab`/`controlledRightTab`.
// Default props place it in Client mode on the Connect/Events location.
function makeProps(overrides?: Partial<WsConnectionTabContentProps>): WsConnectionTabContentProps {
  return {
    tabId: 'test-tab',
    envVarMap: {},
    profilesHook: mockProfiles,
    templatesHook: mockTemplates,
    onConnectionStateChange: vi.fn(),
    onUrlChange: vi.fn(),
    controlledMode: 'client',
    controlledLeftTab: 'connect',
    controlledRightTab: 'events',
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
  // ── Basic rendering ──────────────────────────────────────────────
  it('renders with correct testid', () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('conn-tab-content-test-tab')).toBeTruthy();
  });

  it('shows config lock banner when connected', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps({ controlledLeftTab: 'connect' })} />);
    expect(screen.getByTestId('config-lock-banner')).toBeTruthy();
  });

  it('disconnect from banner works', () => {
    mockStudio = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps({ controlledLeftTab: 'connect' })} />);
    fireEvent.click(screen.getByTestId('banner-disconnect-link'));
    expect(mockStudio.disconnect).toHaveBeenCalled();
  });

  it('shows save-as-profile button on the connect tab', () => {
    render(<WsConnectionTabContent {...makeProps({ controlledLeftTab: 'connect' })} />);
    expect(screen.getByTestId('save-as-profile-btn')).toBeTruthy();
  });

  it('shows the message count badge on the Compose left tab', () => {
    const msgs = [
      { id: '1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() },
      { id: '2', direction: 'sent' as const, type: 'text' as const, data: 'b', size: 1, timestamp: new Date().toISOString() },
      { id: '3', direction: 'received' as const, type: 'text' as const, data: 'c', size: 1, timestamp: new Date().toISOString() },
    ];
    mockStudio = makeStudioReturn({ messages: msgs });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(<WsConnectionTabContent {...makeProps()} />);
    expect(screen.getByTestId('left-tab-compose').textContent).toContain('3');
  });

  // ── Ref handle ───────────────────────────────────────────────────
  it('exposes handle via ref', () => {
    const ref = createRef<WsConnectionTabContentHandle>();
    render(<WsConnectionTabContent ref={ref} {...makeProps()} />);
    expect(ref.current).toBeTruthy();
    expect(ref.current!.getConnectionState()).toBe('disconnected');
    expect(ref.current!.getUrl()).toBe('');
    expect(ref.current!.getMessageCount()).toBe(0);
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

  // ── Connection state + URL reporting (layout independent) ─────────
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

  it('auto-switches to the Compose tab on a successful connect', () => {
    const onLeftTabChange = vi.fn();
    const { rerender } = render(
      <WsConnectionTabContent {...makeProps({ onLeftTabChange })} />,
    );
    mockStudio = makeStudioReturn({ connection: { state: 'connected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps({ onLeftTabChange })} />);
    expect(onLeftTabChange).toHaveBeenCalledWith('compose');
  });

  it('does not switch tabs while merely connecting', () => {
    const onLeftTabChange = vi.fn();
    const { rerender } = render(
      <WsConnectionTabContent {...makeProps({ onLeftTabChange })} />,
    );
    mockStudio = makeStudioReturn({ connection: { state: 'connecting' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps({ onLeftTabChange })} />);
    expect(onLeftTabChange).not.toHaveBeenCalled();
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

  it('passes envVarMap to useWebSocketStudio', () => {
    const spy = vi.spyOn(hookModule, 'useWebSocketStudio');
    const envMap = { baseUrl: 'https://api.example.com', host: 'api.example.com' };
    render(<WsConnectionTabContent {...makeProps({ envVarMap: envMap })} />);
    expect(spy).toHaveBeenCalledWith(envMap, []);
  });

  it('applies initialUrl on mount', () => {
    render(<WsConnectionTabContent {...makeProps({ initialUrl: 'ws://preset:3000' })} />);
    expect(mockStudio.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'ws://preset:3000' }),
    );
  });

  // ── handleLoadProfile (Saved mode: select then load) ──────────────
  it('handleLoadProfile calls studio setters when a profile is loaded', () => {
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
    render(<WsConnectionTabContent {...makeProps({ controlledMode: 'saved', profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('profile-card-p1'));
    fireEvent.click(screen.getByTestId('load-btn-p1'));
    expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('graphql-ws');
    expect(mockStudio.setAutoReconnect).toHaveBeenCalledWith(true);
    expect(mockStudio.setMaxReconnectAttempts).toHaveBeenCalledWith(10);
    expect(mockStudio.setReconnectIntervalMs).toHaveBeenCalledWith(5000);
    expect(mockStudio.setBackoffMultiplier).toHaveBeenCalledWith(2);
    expect(mockStudio.setMaxMessages).toHaveBeenCalledWith(500);
    expect(mockStudio.setTlsConfig).toHaveBeenCalled();
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
    render(<WsConnectionTabContent {...makeProps({ controlledMode: 'saved', profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('profile-card-p1'));
    fireEvent.click(screen.getByTestId('load-btn-p1'));
    expect(mockStudio.setTlsConfig).toHaveBeenCalledWith(
      expect.objectContaining({ rejectUnauthorized: false }),
    );
  });

  it('handleLoadProfile uses auto when profile has no protocolMode', () => {
    const profile = {
      id: 'p3', name: 'No Protocol', url: 'wss://test',
      headers: [], queryParams: [], subprotocols: '',
      autoReconnect: false, maxReconnectAttempts: 5,
      reconnectIntervalMs: 3000, maxMessages: 1000,
      createdAt: '', updatedAt: '',
    };
    mockProfiles = makeProfilesReturn({ profiles: [profile] });
    render(<WsConnectionTabContent {...makeProps({ controlledMode: 'saved', profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('profile-card-p3'));
    fireEvent.click(screen.getByTestId('load-btn-p3'));
    expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('auto');
  });

  it('handleLoadProfile applies full profile settings including the draft', () => {
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
    render(<WsConnectionTabContent {...makeProps({ controlledMode: 'saved', profilesHook: mockProfiles })} />);
    fireEvent.click(screen.getByTestId('profile-card-p-full'));
    fireEvent.click(screen.getByTestId('load-btn-p-full'));
    expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('stomp');
    expect(mockStudio.setAutoReconnect).toHaveBeenCalledWith(true);
    expect(mockStudio.setMaxReconnectAttempts).toHaveBeenCalledWith(10);
    expect(mockStudio.setReconnectIntervalMs).toHaveBeenCalledWith(5000);
    expect(mockStudio.setBackoffMultiplier).toHaveBeenCalledWith(2);
    expect(mockStudio.setMaxMessages).toHaveBeenCalledWith(500);
    expect(mockStudio.setTlsConfig).toHaveBeenCalled();
    expect(mockStudio.setDraft).toHaveBeenCalledWith(draftResult);
  });

  // ── Recording lifecycle (layout independent) ─────────────────────
  it('records new messages when recording state is active', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    const msg2 = { id: 'm2', direction: 'sent' as const, type: 'text' as const, data: 'b', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    mockStudio = makeStudioReturn({ messages: [msg1, msg2] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).toHaveBeenCalledWith(msg2);
  });

  it('handles cap eviction during recording when array same size but new IDs', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    const msg2 = { id: 'm2', direction: 'sent' as const, type: 'text' as const, data: 'b', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1, msg2] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    const msg3 = { id: 'm3', direction: 'received' as const, type: 'text' as const, data: 'c', size: 1, timestamp: new Date().toISOString() };
    mockStudio = makeStudioReturn({ messages: [msg2, msg3] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).toHaveBeenCalledWith(msg3);
  });

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
    mockStudio = makeStudioReturn({
      connection: { state: 'connected' },
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordStateChange).toHaveBeenCalledWith('connected', 'ws://test');
  });

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

  it('handles cap eviction when lastSeen message is gone from array', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    const msg2 = { id: 'm2', direction: 'sent' as const, type: 'text' as const, data: 'x', size: 1, timestamp: new Date().toISOString() };
    mockStudio = makeStudioReturn({ messages: [msg2] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).toHaveBeenCalledWith(msg2);
  });

  it('skips recording when messages become empty during recording', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    mockStudio = makeStudioReturn({ messages: [] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).not.toHaveBeenCalled();
  });

  it('skips recording when messages have same lastId', () => {
    const msg1 = { id: 'm1', direction: 'received' as const, type: 'text' as const, data: 'a', size: 1, timestamp: new Date().toISOString() };
    mockRecording = makeRecordingReturn({ state: 'recording' });
    vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
    mockStudio = makeStudioReturn({ messages: [msg1] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    const { rerender } = render(<WsConnectionTabContent {...makeProps()} />);
    mockRecording.recordMessage.mockClear();
    rerender(<WsConnectionTabContent {...makeProps()} />);
    expect(mockRecording.recordMessage).not.toHaveBeenCalled();
  });

  // ── Split-pane shell render (composition inversion) ───────────────
  describe('shell mode (controlledMode)', () => {
    it('renders the split-pane shell with mode and left/right tab strips', () => {
      render(<WsConnectionTabContent {...makeProps({ controlledMode: 'client' })} />);
      expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
      expect(screen.getByTestId('mode-client')).toBeTruthy();
      expect(screen.getByTestId('ws-studio-split')).toBeTruthy();
      expect(screen.getByTestId('ws-studio-divider')).toBeTruthy();
      expect(screen.getByTestId('left-tab-connect')).toBeTruthy();
      expect(screen.getByTestId('right-tab-events')).toBeTruthy();
      // It does NOT render any legacy view-tab bar.
      expect(screen.queryByTestId('tab-connect')).toBeNull();
    });

    it('renders the events log in the right pane with no composer there', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'connect', controlledRightTab: 'events' })}
        />,
      );
      expect(screen.getByTestId('search-input')).toBeTruthy();
      expect(screen.queryByText(/part of the redesigned layout/)).toBeNull();
      expect(screen.queryAllByTestId('send-btn')).toHaveLength(0);
    });

    it('renders the composer in the Compose left tab alongside the events log on the right', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'compose', controlledRightTab: 'events' })}
        />,
      );
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
      expect(document.querySelector('.ws-studio-content')).toBeTruthy();
    });
  });

  describe('coverage — tab fallbacks, connection hints and toolbar handlers', () => {
    it('falls back to the connect/events tabs when controlled tabs are undefined', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledLeftTab: undefined, controlledRightTab: undefined })}
        />,
      );
      expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
      expect(screen.getByTestId('left-tab-connect')).toBeTruthy();
      expect(screen.getByTestId('search-input')).toBeTruthy();
    });

    it('seeds nothing from an initialDraft whose fields are all undefined', () => {
      render(<WsConnectionTabContent {...makeProps({ initialDraft: {} })} />);
      expect(mockStudio.setDraft).not.toHaveBeenCalled();
      expect(mockStudio.setProtocolMode).not.toHaveBeenCalled();
    });

    it('reports a connected hint when the socket transitions to closing', () => {
      const onConnectionStateChange = vi.fn();
      const { rerender } = render(
        <WsConnectionTabContent {...makeProps({ onConnectionStateChange })} />,
      );
      mockStudio = makeStudioReturn({ connection: { state: 'closing' } });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      rerender(<WsConnectionTabContent {...makeProps({ onConnectionStateChange })} />);
      expect(onConnectionStateChange).toHaveBeenCalledWith('test-tab', 'connected', 'auto');
    });

    it('renders no right pane when the controlled mode is unknown', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: undefined })}
        />,
      );
      expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
      expect(screen.queryByTestId('search-input')).toBeNull();
    });

    it('starts a recording from the Events toolbar', () => {
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('start-recording-btn'));
      expect(mockRecording.startRecording).toHaveBeenCalledWith(
        mockStudio.draft.url,
        mockStudio.protocolMode,
      );
    });

    it('stops a recording from the Events toolbar', () => {
      mockRecording = makeRecordingReturn({ state: 'recording' });
      vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('stop-recording-btn'));
      expect(mockRecording.stopRecording).toHaveBeenCalled();
    });

    it('loads a recording file from the Events toolbar', async () => {
      render(<WsConnectionTabContent {...makeProps()} />);
      const input = screen.getByTestId('recording-file-input') as HTMLInputElement;
      const file = new File(['{}'], 'rec.json', { type: 'application/json' });
      fireEvent.change(input, { target: { files: [file] } });
      expect(mockRecording.loadRecording).toHaveBeenCalledWith(file);
    });

    it('starts a replay when a recording has been loaded', () => {
      mockRecording = makeRecordingReturn({
        state: 'idle',
        loadedRecording: {
          _format: 'ws-recording-v1',
          metadata: {
            url: 'ws://rec',
            protocol: 'auto',
            startedAt: new Date().toISOString(),
            durationMs: 0,
            messageCount: 0,
          },
          events: [],
        },
      });
      vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('start-replay-btn'));
      expect(mockStudio.clearMessages).toHaveBeenCalled();
      expect(mockRecording.startReplay).toHaveBeenCalledWith(mockStudio.appendReplayFrame);
    });

    it('stops a replay from the replay bar', () => {
      mockRecording = makeRecordingReturn({ state: 'replaying' });
      vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('replay-exit-btn'));
      expect(mockRecording.stopReplay).toHaveBeenCalled();
      expect(mockStudio.clearMessages).toHaveBeenCalled();
    });

    it('applies a URL and protocol from local connection history', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledLeftTab: 'connect',
            history: [{ url: 'ws://history:9000', protocol: 'graphql-ws' }],
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('url-history-trigger'));
      fireEvent.click(screen.getByTestId('url-history-item'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ url: 'ws://history:9000' });
      expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('graphql-ws');
    });

    it('does not change the protocol when the history entry uses auto', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledLeftTab: 'connect',
            history: [{ url: 'ws://history:auto', protocol: 'auto' }],
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('url-history-trigger'));
      fireEvent.click(screen.getByTestId('url-history-item'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ url: 'ws://history:auto' });
      expect(mockStudio.setProtocolMode).not.toHaveBeenCalled();
    });

    it('updates the draft auth via the relocated Auth panel', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'auth' })}
        />,
      );
      const select = document.querySelector('.auth-type-select select') as HTMLSelectElement;
      expect(select).toBeTruthy();
      fireEvent.change(select, { target: { value: 'bearer' } });
      expect(mockStudio.setDraft).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.objectContaining({ type: 'bearer' }) }),
      );
    });

    it('switches back to the Connect tab after loading a profile draft', () => {
      const onModeChange = vi.fn();
      const onLeftTabChange = vi.fn();
      const profile = {
        id: 'p1', name: 'SwitchTest', url: 'wss://api.example.com',
        headers: [], queryParams: [], subprotocols: '',
        autoReconnect: false, maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000, maxMessages: 1000,
        createdAt: '', updatedAt: '',
      };
      mockProfiles = makeProfilesReturn({
        profiles: [profile],
        loadProfileAsDraft: vi.fn().mockReturnValue(createDefaultDraft()),
      });
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledMode: 'saved',
            profilesHook: mockProfiles,
            onModeChange,
            onLeftTabChange,
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('profile-card-p1'));
      fireEvent.click(screen.getByTestId('load-btn-p1'));
      expect(onModeChange).toHaveBeenCalledWith('client');
      expect(onLeftTabChange).toHaveBeenCalledWith('connect');
    });

    it('cancels the reconnect and returns to Connect when editing a failed connection', () => {
      const onModeChange = vi.fn();
      const onLeftTabChange = vi.fn();
      mockStudio = makeStudioReturn({
        reconnectState: {
          active: false,
          attempt: 3,
          maxAttempts: 3,
          lastError: 'boom',
          lostAt: Date.now(),
        },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledMode: 'client',
            controlledLeftTab: 'connect',
            onModeChange,
            onLeftTabChange,
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('edit-connection-btn'));
      expect(mockStudio.cancelReconnect).toHaveBeenCalled();
      expect(onModeChange).toHaveBeenCalledWith('client');
      expect(onLeftTabChange).toHaveBeenCalledWith('connect');
    });
  });
});

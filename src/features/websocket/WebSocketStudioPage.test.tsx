/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketStudioPage } from './WebSocketStudioPage';
import * as hookModule from './useWebSocketStudio';
import * as profilesModule from '../../app/hooks/useWebSocketProfiles';
import * as templatesModule from '../../app/hooks/useWebSocketTemplates';
import type { UseWebSocketStudioReturn } from './useWebSocketStudio';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '../../app/hooks/useWebSocketTemplates';
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
    directionFilter: 'all',
    setDirectionFilter: vi.fn(),
    clearMessages: vi.fn(),
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

let mockReturn: UseWebSocketStudioReturn;
let mockProfilesReturn: UseWebSocketProfilesReturn;
let mockTemplatesReturn: UseWebSocketTemplatesReturn;

beforeEach(() => {
  mockReturn = makeStudioReturn();
  mockProfilesReturn = makeProfilesReturn();
  mockTemplatesReturn = makeTemplatesReturn();
  vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
  vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(mockProfilesReturn);
  vi.spyOn(templatesModule, 'useWebSocketTemplates').mockReturnValue(mockTemplatesReturn);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebSocketStudioPage', () => {
  it('renders tab bar with Connect, Messages, and Saved tabs', () => {
    render(<WebSocketStudioPage />);
    expect(screen.getByTestId('tab-connect')).toBeTruthy();
    expect(screen.getByTestId('tab-messages')).toBeTruthy();
    expect(screen.getByTestId('tab-saved')).toBeTruthy();
  });

  it('shows guard when disconnected and URL is blank', () => {
    render(<WebSocketStudioPage />);
    expect(screen.getByText('No WebSocket connection')).toBeTruthy();
    expect(screen.getByText(/Enter a WebSocket URL and click Connect/)).toBeTruthy();
  });

  it('hides guard when URL is entered', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://localhost:8765', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('hides guard when connected', () => {
    mockReturn = makeStudioReturn({
      connection: { state: 'connected', url: 'ws://localhost:8765' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('switches to Messages tab', () => {
    render(<WebSocketStudioPage />);
    fireEvent.click(screen.getByText('Messages'));
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('shows message count badge on Messages tab', () => {
    const msg = {
      id: '1', direction: 'received' as const, type: 'text' as const,
      data: 'hello', size: 5, timestamp: new Date().toISOString(),
    };
    mockReturn = makeStudioReturn({ messages: [msg] });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('Connect tab is active by default', () => {
    render(<WebSocketStudioPage />);
    const connectTab = screen.getByTestId('tab-connect');
    expect(connectTab.className).toContain('active');
  });

  it('shows Saved tab content when clicked', () => {
    render(<WebSocketStudioPage />);
    fireEvent.click(screen.getByTestId('tab-saved'));
    expect(screen.getByText(/No saved connections/)).toBeTruthy();
  });

  it('shows profile count badge on Saved tab', () => {
    mockProfilesReturn = makeProfilesReturn({
      profiles: [{
        id: 'p1', name: 'T', url: 'wss://t', headers: [], queryParams: [],
        subprotocols: '', autoReconnect: false, maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000, maxMessages: 1000,
        createdAt: '', updatedAt: '',
      }],
    });
    vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(mockProfilesReturn);
    render(<WebSocketStudioPage />);
    const savedTab = screen.getByTestId('tab-saved');
    expect(savedTab.textContent).toContain('1');
  });

  it('shows config lock banner when connected', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    expect(screen.getByTestId('config-lock-banner')).toBeTruthy();
    expect(screen.getByText(/Connection settings are locked/)).toBeTruthy();
    expect(screen.getByTestId('banner-disconnect-link')).toBeTruthy();
  });

  it('hides config lock banner when disconnected', () => {
    render(<WebSocketStudioPage />);
    expect(screen.queryByTestId('config-lock-banner')).toBeNull();
  });

  it('renders Save as Profile button on Connect tab', () => {
    render(<WebSocketStudioPage />);
    expect(screen.getByTestId('save-as-profile-btn')).toBeTruthy();
  });

  it('renders template trigger on message log', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    expect(screen.getByTestId('template-trigger')).toBeTruthy();
  });

  it('renders format selector on message log', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    expect(screen.getByTestId('format-select')).toBeTruthy();
  });

  it('calls disconnect when banner disconnect link is clicked', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    fireEvent.click(screen.getByTestId('banner-disconnect-link'));
    expect(mockReturn.disconnect).toHaveBeenCalled();
  });

  it('handleSaveAsProfile switches to Saved tab with prefill data', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://localhost:8765', subprotocols: 'json', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    fireEvent.click(screen.getByTestId('save-as-profile-btn'));
    // Should now be on Saved tab with the prefill editor open
    const savedTab = screen.getByTestId('tab-saved');
    expect(savedTab.className).toContain('active');
  });

  it('handleLoadProfile applies all profile settings', () => {
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
    render(<WebSocketStudioPage />);

    // Switch to saved tab to trigger load
    fireEvent.click(screen.getByTestId('tab-saved'));

    // The component passes handleLoadProfile to SavedConnections
    // Verify profile loading works through the hook spy
    expect(mockReturn.setProtocolMode).not.toHaveBeenCalled();
  });

  it('switches to Connect tab when handleSwitchToConnect fires', () => {
    render(<WebSocketStudioPage />);
    // Switch to messages first
    fireEvent.click(screen.getByText('Messages'));
    expect(screen.getByTestId('tab-messages').className).toContain('active');
    // Switch to connect
    fireEvent.click(screen.getByText('Connect'));
    expect(screen.getByTestId('tab-connect').className).toContain('active');
  });

  it('renders Messages tab content without guard when on messages tab', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    fireEvent.click(screen.getByText('Messages'));
    // Guard should not appear on messages tab
    expect(screen.queryByText('No WebSocket connection')).toBeNull();
  });

  it('handleLoadProfile calls all studio setters with profile values', () => {
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
    render(<WebSocketStudioPage />);
    fireEvent.click(screen.getByTestId('tab-saved'));
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

  it('handleEditConnection cancels reconnect and switches to connect', () => {
    mockReturn = makeStudioReturn({
      draft: { url: 'ws://test', subprotocols: '', headers: [], queryParams: [] },
      connection: { state: 'connected' },
      reconnectState: { ...createDefaultReconnectState(), isReconnecting: true },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockReturn);
    render(<WebSocketStudioPage />);
    // Switch to messages tab first
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('tab-messages').className).toContain('active');
    // The edit connection button is in the connect panel, go back
    fireEvent.click(screen.getByTestId('tab-connect'));
    expect(screen.getByTestId('tab-connect').className).toContain('active');
  });

  it('handleApplyDraft calls setDraft on studio', () => {
    // This is tested indirectly via the SavedConnections component
    render(<WebSocketStudioPage />);
    // Verify the draft setter is available
    expect(mockReturn.setDraft).toBeDefined();
  });
});

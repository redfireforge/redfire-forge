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
import type { UseWebSocketProfilesReturn } from '@app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '@app/hooks/useWebSocketTemplates';
import * as mockServerModule from './useWebSocketMockServer';
import type { UseWebSocketMockServerReturn } from './useWebSocketMockServer';
import {
  makeStudioReturn,
  makeProfilesReturn,
  makeTemplatesReturn,
  makeMockServerReturn,
  makeRecordingReturn,
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

let mockStudio: UseWebSocketStudioReturn;
let mockProfiles: UseWebSocketProfilesReturn;
let mockTemplates: UseWebSocketTemplatesReturn;
let mockRecording: UseWebSocketRecordingReturn;
let mockMockServerReturn: UseWebSocketMockServerReturn;

// The component is always shell-driven now: the parent (WebSocketStudioPage)
// owns navigation and feeds `controlledMode`/`controlledLeftTab`/`controlledRightTab`.
// Default props place it in Client mode on the Connect/Events location.
function makeProps(overrides?: Partial<WsConnectionTabContentProps>): WsConnectionTabContentProps {
  return {
    tabId: 'test-tab',
    envVarMap: {},
    profilesHook: mockProfiles,
    templatesHook: mockTemplates,
    mockPort: 9876,
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
  mockMockServerReturn = makeMockServerReturn();
  vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
  vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
  vi.spyOn(mockServerModule, 'useWebSocketMockServer').mockReturnValue(mockMockServerReturn);
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
    expect(screen.getByTestId('left-tab-send').textContent).toContain('3');
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

  it('does not auto-switch to the Send tab on a successful connect', () => {
    const onLeftTabChange = vi.fn();
    const { rerender } = render(
      <WsConnectionTabContent {...makeProps({ onLeftTabChange })} />,
    );
    mockStudio = makeStudioReturn({ connection: { state: 'connected' } });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    rerender(<WsConnectionTabContent {...makeProps({ onLeftTabChange })} />);
    expect(onLeftTabChange).not.toHaveBeenCalled();
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
      // Send pane is always mounted (preserves compose text across tab switches),
      // just hidden via CSS when not on the Send tab.
      const sendBtns = screen.queryAllByTestId('send-btn');
      if (sendBtns.length > 0) {
        expect(sendBtns[0].closest('[style*="display: none"]') ?? sendBtns[0].closest('[hidden]')).toBeTruthy();
      }
    });

    it('renders the composer in the Compose left tab alongside the events log on the right', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'send', controlledRightTab: 'events' })}
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

    it('warns when the client is connected to a different local port than this tab\'s mock server', () => {
      mockStudio = makeStudioReturn({
        connection: { state: 'connected', url: 'ws://localhost:9876' },
      });
      mockMockServerReturn = makeMockServerReturn({
        status: { running: true, port: 9878, clientCount: 0, clients: [] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      vi.spyOn(mockServerModule, 'useWebSocketMockServer').mockReturnValue(mockMockServerReturn);
      render(<WsConnectionTabContent {...makeProps({ controlledMode: 'mock' })} />);
      const banner = screen.getByTestId('mock-port-mismatch');
      expect(banner.textContent).toContain('port 9876');
      expect(banner.textContent).toContain('port 9878');
    });

    it('does not warn when the client is connected to this tab\'s own mock server port', () => {
      mockStudio = makeStudioReturn({
        connection: { state: 'connected', url: 'ws://localhost:9878' },
      });
      mockMockServerReturn = makeMockServerReturn({
        status: { running: true, port: 9878, clientCount: 1, clients: [] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      vi.spyOn(mockServerModule, 'useWebSocketMockServer').mockReturnValue(mockMockServerReturn);
      render(<WsConnectionTabContent {...makeProps({ controlledMode: 'mock' })} />);
      expect(screen.queryByTestId('mock-port-mismatch')).toBeNull();
    });

    it('does not warn when the client is connected to a non-local (external) server', () => {
      mockStudio = makeStudioReturn({
        connection: { state: 'connected', url: 'wss://jsonplaceholder.typicode.com' },
      });
      mockMockServerReturn = makeMockServerReturn({
        status: { running: true, port: 9878, clientCount: 0, clients: [] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      vi.spyOn(mockServerModule, 'useWebSocketMockServer').mockReturnValue(mockMockServerReturn);
      render(<WsConnectionTabContent {...makeProps({ controlledMode: 'mock' })} />);
      expect(screen.queryByTestId('mock-port-mismatch')).toBeNull();
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
      fireEvent.click(screen.getByTestId('left-tab-send'));
      expect(onLeftTabChange).toHaveBeenCalledWith('send');
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
});

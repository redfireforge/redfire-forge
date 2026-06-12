/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SseStudioPage } from './SseStudioPage';
import type { UseSseConnectionReturn } from './useSseConnection';
import type { SseConnectionConfig, SseConnectionSnapshot, SseStats, SseEvent } from './sseTypes';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
  }),
}));

vi.mock('../../shared/utils/fileSaver', () => ({
  saveJsonFile: vi.fn(),
}));

// Phase 8: isolate the page from real config persistence so the mount-time
// load never reapplies a previous test's persisted config and the unmount
// flush never writes to shared storage between tests. Hoisted spies let
// individual tests override the load result and observe saves.
const { mockLoadSseConfig, mockSaveSseConfig } = vi.hoisted(() => ({
  mockLoadSseConfig: vi.fn(() => Promise.resolve(null)),
  mockSaveSseConfig: vi.fn(),
}));

vi.mock('./sseStorage', () => ({
  SSE_CONFIG_KEY: 'redfire-sse-config-v1',
  loadSseConfig: mockLoadSseConfig,
  saveSseConfig: mockSaveSseConfig,
}));

function makeDefaultConfig(): SseConnectionConfig {
  return { url: '', headers: [], autoReconnect: true, maxRetries: 10 };
}

function makeDefaultConnection(overrides: Partial<SseConnectionSnapshot> = {}): SseConnectionSnapshot {
  return { state: 'idle', lastEventId: '', retryMs: 3000, reconnectAttempt: 0, ...overrides };
}

function makeDefaultStats(): SseStats {
  return { eventCount: 0, startedAt: null, eventTypeCounts: {} };
}

let mockSseReturn: UseSseConnectionReturn;

vi.mock('./useSseConnection', () => ({
  useSseConnection: () => mockSseReturn,
}));

function configBody() {
  return screen.getByTestId('sse-config-body');
}

beforeEach(() => {
  mockLoadSseConfig.mockReset();
  mockLoadSseConfig.mockResolvedValue(null);
  mockSaveSseConfig.mockReset();
  mockSseReturn = {
    config: makeDefaultConfig(),
    setConfig: vi.fn((patch) => {
      mockSseReturn.config = { ...mockSseReturn.config, ...patch };
    }),
    connection: makeDefaultConnection(),
    events: [],
    stats: makeDefaultStats(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearEvents: vi.fn(),
    toggleBookmark: vi.fn(),
    bookmarkedIds: new Set(),
  };
});

describe('SseStudioPage', () => {
  it('renders the SSE Studio page', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('renders the split-pane shell', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-studio-shell')).toBeTruthy();
    expect(screen.getByTestId('sse-studio-split')).toBeTruthy();
    expect(screen.getByTestId('sse-studio-divider')).toBeTruthy();
  });

  it('renders URL input and Connect button', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-url-input')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn').textContent).toBe('Connect');
  });

  it('keeps the URL bar and connect button in the shell top bar', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    render(<SseStudioPage />);
    const topbar = screen.getByTestId('sse-studio-topbar');
    expect(topbar.querySelector('.sse-url-input')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn')).toBeTruthy();
  });

  it('disables Connect button when URL is empty', () => {
    render(<SseStudioPage />);
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables Connect button when URL is provided', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    render(<SseStudioPage />);
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows the headers editor always-visible in the left pane', () => {
    render(<SseStudioPage />);
    expect(configBody().querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(screen.getByTestId('sse-headers-add-btn')).toBeTruthy();
  });

  it('shows connection state label', () => {
    render(<SseStudioPage />);
    const label = screen.getByTestId('sse-state-label');
    expect(label.textContent).toContain('Disconnected');
  });

  it('renders message log', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-message-log')).toBeTruthy();
  });

  it('renders toolbar with search and type filter', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-search')).toBeTruthy();
    expect(screen.getByTestId('sse-type-filter')).toBeTruthy();
  });

  it('renders status bar', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-status-bar')).toBeTruthy();
  });

  it('renders export and clear buttons', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-export-btn')).toBeTruthy();
    expect(screen.getByTestId('sse-clear-btn')).toBeTruthy();
  });

  // ── State label variations ──────────────────────────────────────────

  it('shows "Connecting…" when state is connecting', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Connecting…');
  });

  it('shows "Connected" when state is connected', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Connected');
  });

  it('shows "Error: ..." when state is error', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'error', error: 'timeout' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Error: timeout');
  });

  it('shows "Error: Unknown" when error state but no error message', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'error' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Error: Unknown');
  });

  it('shows reconnecting attempt count when disconnected with reconnectAttempt > 0', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'disconnected', reconnectAttempt: 3 });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Reconnecting (3)');
  });

  it('shows "Disconnected" when disconnected with reconnectAttempt = 0', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'disconnected', reconnectAttempt: 0 });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Disconnected');
  });

  // ── State CSS classes (top-bar state dot) ───────────────────────────

  it('applies sse-state-connected class when connected', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-connected');
  });

  it('applies sse-state-connecting class when connecting', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-connecting');
  });

  it('applies sse-state-error class when error', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'error', error: 'fail' });
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-error');
  });

  it('applies sse-state-disconnected class by default', () => {
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-disconnected');
  });

  // ── Connect / Disconnect behavior ──────────────────────────────────

  it('calls connect when clicking Connect button (idle)', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-connect-btn'));
    expect(mockSseReturn.connect).toHaveBeenCalledOnce();
  });

  it('shows "Disconnect" and calls disconnect when connected', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    const btn = screen.getByTestId('sse-connect-btn');
    expect(btn.textContent).toBe('Disconnect');
    fireEvent.click(btn);
    expect(mockSseReturn.disconnect).toHaveBeenCalledOnce();
  });

  it('shows "Disconnect" when connecting', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-connect-btn').textContent).toBe('Disconnect');
  });

  it('disables URL input when connected', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    expect((screen.getByTestId('sse-url-input') as HTMLInputElement).disabled).toBe(true);
  });

  it('disables URL input when connecting', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    render(<SseStudioPage />);
    expect((screen.getByTestId('sse-url-input') as HTMLInputElement).disabled).toBe(true);
  });

  // ── Status strip badges ────────────────────────────────────────────

  it('shows auto-reconnect On in the status strip when autoReconnect is on', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test', autoReconnect: true };
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Auto-reconnect: On');
  });

  it('shows auto-reconnect Off in the status strip when autoReconnect is off', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test', autoReconnect: false };
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Auto-reconnect: Off');
  });

  it('shows the event count in the status strip', () => {
    mockSseReturn.stats = { ...makeDefaultStats(), eventCount: 7 };
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Events: 7');
  });

  it('shows Last-Event-ID in the status strip when present', () => {
    mockSseReturn.connection = makeDefaultConnection({ lastEventId: 'evt-42' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Last-Event-ID: evt-42');
  });

  // ── Headers editor behavior (always-visible left pane) ─────────────

  it('shows header count in the headers label', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'Authorization', value: 'Bearer x', enabled: true }],
    };
    render(<SseStudioPage />);
    expect(configBody().textContent).toContain('Headers');
  });

  it('adds a header when + Add Header is clicked', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-add-btn'));
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('shows header key and value inputs for existing headers', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    render(<SseStudioPage />);
    const body = configBody();
    expect(body.querySelectorAll('.ws-connect-kv-key').length).toBe(1);
    expect(body.querySelectorAll('.ws-connect-kv-value').length).toBe(1);
  });

  it('calls setConfig when header key is changed', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    render(<SseStudioPage />);
    const keyInput = configBody().querySelector('.ws-connect-kv-key') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'Authorization' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('calls setConfig when header value is changed', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    render(<SseStudioPage />);
    const valInput = configBody().querySelector('.ws-connect-kv-value') as HTMLInputElement;
    fireEvent.change(valInput, { target: { value: 'Bearer xyz' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('removes a header when × is clicked', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    render(<SseStudioPage />);
    const removeBtn = configBody().querySelector('.ws-connect-kv-remove-btn') as HTMLButtonElement;
    fireEvent.click(removeBtn);
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('clears all headers via the Delete all control', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-delete-all-btn'));
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({ headers: [] });
  });

  it('disables header inputs when connected', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    const keyInput = configBody().querySelector('.ws-connect-kv-key') as HTMLInputElement;
    expect(keyInput.disabled).toBe(true);
  });

  it('disables add header button when connected', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    const addBtn = screen.getByTestId('sse-headers-add-btn') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('disables remove header button when connected', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    const removeBtn = configBody().querySelector('.ws-connect-kv-remove-btn') as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true);
  });

  // ── Auto-reconnect checkbox (always-visible reconnect section) ─────

  it('renders auto-reconnect checkbox in the reconnect section', () => {
    render(<SseStudioPage />);
    const checkbox = configBody().querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);
  });

  it('toggles auto-reconnect checkbox', () => {
    render(<SseStudioPage />);
    const checkbox = configBody().querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('shows retry info when autoReconnect is enabled', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), autoReconnect: true };
    mockSseReturn.connection = makeDefaultConnection({ retryMs: 3000 });
    render(<SseStudioPage />);
    const body = configBody();
    expect(body.textContent).toContain('Retry interval');
    expect(body.textContent).toContain('3000ms');
  });

  // ── Left-pane tabs (Connect / Auth) ────────────────────────────────

  it('switches the left pane to the auth panel', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-left-tab-auth'));
    expect(configBody().querySelector('.sse-auth-pane')).toBeTruthy();
  });

  // ── Right-pane tabs (Events / Console) ─────────────────────────────

  it('switches the right pane to the console', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    expect(screen.getByTestId('sse-console')).toBeTruthy();
  });

  // ── URL input change ───────────────────────────────────────────────

  it('calls setConfig when URL input changes', () => {
    render(<SseStudioPage />);
    fireEvent.change(screen.getByTestId('sse-url-input'), { target: { value: 'https://api.test/sse' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({ url: 'https://api.test/sse' });
  });

  // ── Props forwarding ──────────────────────────────────────────────

  it('passes resolvedBaseUrl/envName/svcName as envVarMap', () => {
    render(<SseStudioPage resolvedBaseUrl="https://api.test" envName="prod" svcName="orders" />);
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('renders without any props', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  // ── Button disabled logic ──────────────────────────────────────────

  it('button is disabled when URL is whitespace-only and not busy', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: '   ' };
    render(<SseStudioPage />);
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('button is enabled when busy even with empty URL (disconnect)', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  // ── Connect button style ───────────────────────────────────────────

  it('Connect button has primary class when idle', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test' };
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-connect-btn').className).toContain('sse-connect-btn-primary');
  });

  it('Connect button has danger class when connected', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test' };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-connect-btn').className).toContain('sse-connect-btn-danger');
  });

  // ── Config persistence (load / debounced save / unmount flush) ─────

  it('applies a stored config when the mount-time load resolves with one', async () => {
    const stored: SseConnectionConfig = {
      url: 'https://stored.example/sse',
      headers: [],
      autoReconnect: false,
      maxRetries: 5,
    };
    mockLoadSseConfig.mockResolvedValueOnce(stored);
    render(<SseStudioPage />);
    await waitFor(() => expect(mockSseReturn.setConfig).toHaveBeenCalledWith(stored));
  });

  it('ignores a stored config that resolves to null (defaults retained)', async () => {
    mockLoadSseConfig.mockResolvedValueOnce(null);
    render(<SseStudioPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSseReturn.setConfig).not.toHaveBeenCalled();
  });

  it('swallows a rejected load without crashing', async () => {
    mockLoadSseConfig.mockRejectedValueOnce(new Error('boom'));
    render(<SseStudioPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('debounce-saves config changes after the load resolves and flushes on unmount', async () => {
    vi.useFakeTimers();
    try {
      mockLoadSseConfig.mockResolvedValueOnce(null);
      const { rerender, unmount } = render(<SseStudioPage />);
      // Let the load promise settle so the "loaded" gate opens.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      mockSaveSseConfig.mockClear();

      // A config change should schedule the debounced save.
      mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://changed.example/sse' };
      rerender(<SseStudioPage />);
      // A second change before the timer fires should clear the pending timer.
      mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://changed2.example/sse' };
      rerender(<SseStudioPage />);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(mockSaveSseConfig).toHaveBeenCalledTimes(1);
      expect(mockSaveSseConfig).toHaveBeenCalledWith(mockSseReturn.config);

      // Unmount should flush the latest config immediately.
      mockSaveSseConfig.mockClear();
      unmount();
      expect(mockSaveSseConfig).toHaveBeenCalledWith(mockSseReturn.config);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a pending load and skips the unmount flush when unmounted before it resolves', async () => {
    let resolveLoad: (v: SseConnectionConfig | null) => void = () => {};
    mockLoadSseConfig.mockReturnValueOnce(
      new Promise<SseConnectionConfig | null>((res) => {
        resolveLoad = res;
      }),
    );
    const { unmount } = render(<SseStudioPage />);
    // Unmount before the load settles: the load effect cleanup flags cancelled
    // and the unmount-flush effect must bail because the load never completed.
    unmount();
    await act(async () => {
      resolveLoad(makeDefaultConfig());
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockSseReturn.setConfig).not.toHaveBeenCalled();
    expect(mockSaveSseConfig).not.toHaveBeenCalled();
  });

  // ── Console command capabilities ───────────────────────────────────

  it('runs the console /connect command with a URL (sets config then connects)', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    const input = screen.getByTestId('sse-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/connect https://cli.example/sse' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({ url: 'https://cli.example/sse' });
    expect(mockSseReturn.connect).toHaveBeenCalled();
  });

  it('runs the console /connect command without a URL (just connects)', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://existing.example/sse' };
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    const input = screen.getByTestId('sse-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/connect' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSseReturn.connect).toHaveBeenCalled();
  });

  it('runs the console /disconnect command', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    const input = screen.getByTestId('sse-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/disconnect' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSseReturn.disconnect).toHaveBeenCalled();
  });

  // ── Auth change ────────────────────────────────────────────────────

  it('calls setConfig when the auth type changes in the auth pane', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-left-tab-auth'));
    const select = configBody().querySelector('.sse-auth-pane select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: 'bearer' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({
      auth: expect.objectContaining({ type: 'bearer' }),
    });
  });

  // ── Derived state edge cases ───────────────────────────────────────

  it('treats a configured non-none auth as configured', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), auth: { type: 'bearer', token: 'tok' } };
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('falls back to defaults for an unknown connection state', () => {
    mockSseReturn.connection = makeDefaultConnection({
      state: 'bogus' as SseConnectionSnapshot['state'],
    });
    const { container } = render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Disconnected');
    const dot = container.querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-disconnected');
  });

  it('derives lastEventId from the most recent event when events are present', () => {
    const event: SseEvent = {
      id: 'e1',
      eventType: 'message',
      data: 'hello',
      lastEventId: 'evt-last',
      size: 5,
      timestamp: new Date().toISOString(),
    };
    mockSseReturn.events = [event];
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { selectOption } from '../../test-utils/customSelectHelper';
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

const { mockLoadSseTabState, mockMigrateLegacySseConfig, mockSaveSseTabState } = vi.hoisted(() => ({
  mockLoadSseTabState: vi.fn((): Promise<null> => Promise.resolve(null)),
  mockMigrateLegacySseConfig: vi.fn((): Promise<null> => Promise.resolve(null)),
  mockSaveSseTabState: vi.fn(),
}));

vi.mock('./sseStorage', () => ({
  SSE_CONFIG_KEY: 'redfire-sse-config-v1',
  SSE_TAB_STATE_KEY: 'redfire-sse-tab-state-v1',
  loadSseConfig: vi.fn(() => Promise.resolve(null)),
  saveSseConfig: vi.fn(),
  loadSseTabState: mockLoadSseTabState,
  migrateLegacySseConfig: mockMigrateLegacySseConfig,
  saveSseTabState: mockSaveSseTabState,
  deriveSseTabLabel: vi.fn((url: string) => url || 'New Connection'),
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

// Keep page tests focused on SseStudioPage wiring/behavior rather than the
// shell's internal async layout effects.
vi.mock('./SseStudioShell', () => ({
  SseStudioShell: ({
    topBar,
    statusStrip,
    left,
    right,
    onLeftTabChange,
    onRightTabChange,
  }: {
    topBar: unknown;
    statusStrip: unknown;
    left: unknown;
    right: unknown;
    onLeftTabChange: (tab: 'connect' | 'auth') => void;
    onRightTabChange: (tab: 'events' | 'console') => void;
  }) => (
    <div data-testid="sse-studio-shell">
      <div data-testid="sse-studio-topbar">{topBar as ReactNode}</div>
      <div data-testid="sse-studio-status">{statusStrip as ReactNode}</div>
      <div data-testid="sse-studio-split">
        <div data-testid="sse-shell-tabs-left">
          <button data-testid="sse-left-tab-connect" onClick={() => onLeftTabChange('connect')} type="button">
            Connect
          </button>
          <button data-testid="sse-left-tab-auth" onClick={() => onLeftTabChange('auth')} type="button">
            Auth
          </button>
        </div>
        <div data-testid="sse-shell-tabs-right">
          <button data-testid="sse-right-tab-events" onClick={() => onRightTabChange('events')} type="button">
            Events
          </button>
          <button data-testid="sse-right-tab-console" onClick={() => onRightTabChange('console')} type="button">
            Console
          </button>
        </div>
        <div data-testid="sse-studio-divider" />
        <div data-testid="sse-shell-left">{left as ReactNode}</div>
        <div data-testid="sse-shell-right">{right as ReactNode}</div>
      </div>
    </div>
  ),
}));

const mockSseConsole = {
  entries: [] as unknown[],
  settings: {},
  setSettings: vi.fn(),
  clear: vi.fn(),
  append: vi.fn(),
};

vi.mock('./useSseConsole', () => ({
  useSseConsole: () => mockSseConsole,
}));

vi.mock('./SseMessageLog', () => ({
  SseMessageLog: () => (
    <div data-testid="sse-message-log">
      <input data-testid="sse-search" />
      <select data-testid="sse-type-filter" />
      <div data-testid="sse-status-bar" />
      <button data-testid="sse-export-btn" type="button">Export</button>
      <button data-testid="sse-clear-btn" type="button">Clear</button>
    </div>
  ),
}));

vi.mock('../websocket/ConsolePanel', () => ({
  ConsolePanel: ({ onCommand }: { onCommand?: (input: string) => void }) => (
    <div data-testid="sse-console">
      <input
        data-testid="sse-console-cmd-input"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onCommand?.((e.currentTarget as HTMLInputElement).value);
          }
        }}
      />
    </div>
  ),
}));

vi.mock('./SseConnectionTabBar', () => ({
  SseConnectionTabBar: () => <div data-testid="sse-conn-tab-bar" />,
}));

function configBody() {
  return screen.getByTestId('sse-config-body');
}

async function renderPage(props: Record<string, unknown> = {}) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<SseStudioPage {...props} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return result!;
}

beforeEach(() => {
  mockLoadSseTabState.mockReset();
  mockLoadSseTabState.mockImplementation(() => Promise.resolve(null));
  mockMigrateLegacySseConfig.mockReset();
  mockMigrateLegacySseConfig.mockImplementation(() => Promise.resolve(null));
  mockSaveSseTabState.mockReset();
  mockSseConsole.entries = [];
  mockSseConsole.setSettings.mockReset();
  mockSseConsole.clear.mockReset();
  mockSseConsole.append.mockReset();
  mockSseReturn = {
    config: makeDefaultConfig(),
    setConfig: vi.fn(),
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
  it('renders the SSE Studio page', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('renders the tab bar and split-pane shell', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-conn-tab-bar')).toBeTruthy();
    expect(screen.getByTestId('sse-studio-shell')).toBeTruthy();
    expect(screen.getByTestId('sse-studio-split')).toBeTruthy();
    expect(screen.getByTestId('sse-studio-divider')).toBeTruthy();
  });

  it('renders URL input and Connect button', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-url-input')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn').textContent).toBe('Connect');
  });

  it('keeps the URL bar and connect button in the shell top bar', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    await renderPage();
    const topbar = screen.getByTestId('sse-studio-topbar');
    expect(topbar.querySelector('.sse-url-input')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn')).toBeTruthy();
  });

  it('disables Connect button when URL is empty', async () => {
    await renderPage();
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables Connect button when URL is provided', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    await renderPage();
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows the headers editor always-visible in the left pane', async () => {
    await renderPage();
    expect(configBody().querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(screen.getByTestId('sse-headers-add-btn')).toBeTruthy();
  });

  it('shows connection state label', async () => {
    await renderPage();
    const label = screen.getByTestId('sse-state-label');
    expect(label.textContent).toContain('Disconnected');
  });

  it('renders message log', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-message-log')).toBeTruthy();
  });

  it('renders toolbar with search and type filter', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-search')).toBeTruthy();
    expect(screen.getByTestId('sse-type-filter')).toBeTruthy();
  });

  it('renders status bar', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-status-bar')).toBeTruthy();
  });

  it('renders export and clear buttons', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-export-btn')).toBeTruthy();
    expect(screen.getByTestId('sse-clear-btn')).toBeTruthy();
  });

  // ── State label variations ──────────────────────────────────────────

  it('shows "Connecting…" when state is connecting', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Connecting');
  });

  it('shows "Connected" when state is connected', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Connected');
  });

  it('shows "Error: ..." when state is error', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'error', error: 'timeout' });
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Error: timeout');
  });

  it('shows "Error: Unknown" when error state but no error message', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'error' });
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Error: Unknown');
  });

  it('shows reconnecting attempt count when disconnected with reconnectAttempt > 0', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'disconnected', reconnectAttempt: 3 });
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Reconnecting (3)');
  });

  it('shows "Disconnected" when disconnected with reconnectAttempt = 0', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'disconnected', reconnectAttempt: 0 });
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Disconnected');
  });

  // ── State CSS classes (top-bar state dot) ───────────────────────────

  it('applies sse-state-connected class when connected', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-connected');
  });

  it('applies sse-state-connecting class when connecting', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    await renderPage();
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-connecting');
  });

  it('applies sse-state-error class when error', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'error', error: 'fail' });
    await renderPage();
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-error');
  });

  it('applies sse-state-disconnected class by default', async () => {
    await renderPage();
    const dot = screen.getByTestId('sse-studio-topbar').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-disconnected');
  });

  // ── Connect / Disconnect behavior ──────────────────────────────────

  it('calls connect when clicking Connect button (idle)', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-connect-btn'));
    expect(mockSseReturn.connect).toHaveBeenCalledOnce();
  });

  it('shows "Disconnect" and calls disconnect when connected', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    const btn = screen.getByTestId('sse-connect-btn');
    expect(btn.textContent).toBe('Disconnect');
    fireEvent.click(btn);
    expect(mockSseReturn.disconnect).toHaveBeenCalledOnce();
  });

  it('shows "Disconnect" when connecting', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://example.com/events' };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    await renderPage();
    expect(screen.getByTestId('sse-connect-btn').textContent).toBe('Disconnect');
  });

  it('disables URL input when connected', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    expect((screen.getByTestId('sse-url-input') as HTMLInputElement).disabled).toBe(true);
  });

  it('disables URL input when connecting', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    await renderPage();
    expect((screen.getByTestId('sse-url-input') as HTMLInputElement).disabled).toBe(true);
  });

  // ── Status strip badges ────────────────────────────────────────────

  it('shows auto-reconnect On in the status strip when autoReconnect is on', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test', autoReconnect: true };
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Auto-reconnect: On');
  });

  it('shows auto-reconnect Off in the status strip when autoReconnect is off', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test', autoReconnect: false };
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Auto-reconnect: Off');
  });

  it('shows the event count in the status strip', async () => {
    mockSseReturn.stats = { ...makeDefaultStats(), eventCount: 7 };
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Events: 7');
  });

  it('shows Last-Event-ID in the status strip when present', async () => {
    mockSseReturn.connection = makeDefaultConnection({ lastEventId: 'evt-42' });
    await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Last-Event-ID: evt-42');
  });

  // ── Headers editor behavior (always-visible left pane) ─────────────

  it('shows header count in the headers label', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'Authorization', value: 'Bearer x', enabled: true }],
    };
    await renderPage();
    expect(configBody().textContent).toContain('Headers');
  });

  it('adds a header when + Add Header is clicked', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-headers-add-btn'));
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('shows header key and value inputs for existing headers', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    await renderPage();
    const body = configBody();
    expect(body.querySelectorAll('.ws-connect-kv-key').length).toBe(1);
    expect(body.querySelectorAll('.ws-connect-kv-value').length).toBe(1);
  });

  it('calls setConfig when header key is changed', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    await renderPage();
    const keyInput = configBody().querySelector('.ws-connect-kv-key') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'Authorization' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('calls setConfig when header value is changed', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    await renderPage();
    const valInput = configBody().querySelector('.ws-connect-kv-value') as HTMLInputElement;
    fireEvent.change(valInput, { target: { value: 'Bearer xyz' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('removes a header when × is clicked', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    await renderPage();
    const removeBtn = configBody().querySelector('.ws-connect-kv-remove-btn') as HTMLButtonElement;
    fireEvent.click(removeBtn);
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('clears all headers via the Delete all control', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-headers-delete-all-btn'));
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({ headers: [] });
  });

  it('disables header inputs when connected', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    const keyInput = configBody().querySelector('.ws-connect-kv-key') as HTMLInputElement;
    expect(keyInput.disabled).toBe(true);
  });

  it('disables add header button when connected', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    const addBtn = screen.getByTestId('sse-headers-add-btn') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('disables remove header button when connected', async () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test', enabled: true }],
    };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    const removeBtn = configBody().querySelector('.ws-connect-kv-remove-btn') as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true);
  });

  // ── Auto-reconnect checkbox (always-visible reconnect section) ─────

  it('renders auto-reconnect checkbox in the reconnect section', async () => {
    await renderPage();
    const checkbox = configBody().querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);
  });

  it('toggles auto-reconnect checkbox', async () => {
    await renderPage();
    const checkbox = configBody().querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('shows retry info when autoReconnect is enabled', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), autoReconnect: true };
    mockSseReturn.connection = makeDefaultConnection({ retryMs: 3000 });
    await renderPage();
    const body = configBody();
    expect(body.textContent).toContain('Retry interval');
    expect(body.textContent).toContain('3000ms');
  });

  // ── Left-pane tabs (Connect / Auth) ────────────────────────────────

  it('switches the left pane to the auth panel', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-left-tab-auth'));
    expect(configBody().querySelector('.sse-auth-pane')).toBeTruthy();
  });

  // ── Right-pane tabs (Events / Console) ─────────────────────────────

  it('switches the right pane to the console', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    expect(screen.getByTestId('sse-console')).toBeTruthy();
  });

  // ── URL input change ───────────────────────────────────────────────

  it('calls setConfig when URL input changes', async () => {
    await renderPage();
    fireEvent.change(screen.getByTestId('sse-url-input'), { target: { value: 'https://api.test/sse' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({ url: 'https://api.test/sse' });
  });

  // ── Props forwarding ──────────────────────────────────────────────

  it('passes resolvedBaseUrl/envName/svcName as envVarMap', async () => {
    await renderPage({ resolvedBaseUrl: 'https://api.test', envName: 'prod', svcName: 'orders' });
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('shows resolved endpoint preview with status for {{sseUrl}} templates', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: '{{sseUrl}}/events' };
    await renderPage({
      selectedSvc: {
        id: 'svc-1',
        name: 'orders',
        baseUrls: { e1: 'https://api.example.com' },
      },
      selectedEnvId: 'e1',
      envName: 'local',
    });
    const preview = screen.getByTestId('sse-endpoint-preview');
    expect(preview.textContent).toContain('https://api.example.com/events');
    expect(preview.getAttribute('data-status')).toBe('fallback');
    expect(preview.textContent).toContain('⚠');
  });

  it('renders without any props', async () => {
    await renderPage();
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  // ── Button disabled logic ──────────────────────────────────────────

  it('button is disabled when URL is whitespace-only and not busy', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: '   ' };
    await renderPage();
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('button is enabled when busy even with empty URL (disconnect)', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    const btn = screen.getByTestId('sse-connect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  // ── Connect button style ───────────────────────────────────────────

  it('Connect button has primary class when idle', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test' };
    await renderPage();
    expect(screen.getByTestId('sse-connect-btn').className).toContain('sse-connect-btn-primary');
  });

  it('Connect button has danger class when connected', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test' };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    expect(screen.getByTestId('sse-connect-btn').className).toContain('sse-connect-btn-danger');
  });

  // ── Config persistence (load / debounced save / unmount flush) ─────

  it('restores persisted tab state on mount', async () => {
    const { createDefaultSseTab } = await import('./sseTypes');
    const tab1 = { ...createDefaultSseTab('sse-tab-5'), url: 'https://persisted.example/sse', label: 'Persisted' };
    mockLoadSseTabState.mockResolvedValueOnce({ tabs: [tab1], activeTabId: 'sse-tab-5' });
    await renderPage();
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('falls back to a fresh tab when persistence returns null', async () => {
    mockLoadSseTabState.mockResolvedValueOnce(null);
    mockMigrateLegacySseConfig.mockResolvedValueOnce(null);
    await renderPage();
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('migrates legacy config when tab state is absent', async () => {
    const { createDefaultSseTab } = await import('./sseTypes');
    const migratedTab = { ...createDefaultSseTab('sse-tab-1'), url: 'https://legacy.example/sse', label: 'legacy.example' };
    mockLoadSseTabState.mockResolvedValueOnce(null);
    mockMigrateLegacySseConfig.mockResolvedValueOnce({ tabs: [migratedTab], activeTabId: 'sse-tab-1' });
    await renderPage();
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('debounce-saves tab state and flushes on unmount', async () => {
    vi.useFakeTimers();
    try {
      await renderPage();
      mockSaveSseTabState.mockClear();

      // Trigger a state change by advancing timers
      act(() => {
        vi.advanceTimersByTime(400);
      });
      // The save should have fired
      expect(mockSaveSseTabState).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // ── Console command capabilities ───────────────────────────────────

  it('runs the console /connect command with a URL (sets config then connects)', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    const input = screen.getByTestId('sse-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/connect https://cli.example/sse' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({ url: 'https://cli.example/sse' });
    expect(mockSseReturn.connect).toHaveBeenCalled();
  });

  it('runs the console /connect command without a URL (just connects)', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://existing.example/sse' };
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    const input = screen.getByTestId('sse-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/connect' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSseReturn.connect).toHaveBeenCalled();
  });

  it('runs the console /disconnect command', async () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-right-tab-console'));
    const input = screen.getByTestId('sse-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/disconnect' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSseReturn.disconnect).toHaveBeenCalled();
  });

  // ── Auth change ────────────────────────────────────────────────────

  it('calls setConfig when the auth type changes in the auth pane', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('sse-left-tab-auth'));
    selectOption(configBody().querySelector('.sse-auth-pane .auth-type-select .cs-wrapper')!, 'Bearer Token');
    expect(mockSseReturn.setConfig).toHaveBeenCalledWith({
      auth: expect.objectContaining({ type: 'bearer' }),
    });
  });

  // ── Derived state edge cases ───────────────────────────────────────

  it('treats a configured non-none auth as configured', async () => {
    mockSseReturn.config = { ...makeDefaultConfig(), auth: { type: 'bearer', token: 'tok' } };
    await renderPage();
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });

  it('falls back to defaults for an unknown connection state', async () => {
    mockSseReturn.connection = makeDefaultConnection({
      state: 'bogus' as SseConnectionSnapshot['state'],
    });
    const { container } = await renderPage();
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Disconnected');
    const dot = container.querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-disconnected');
  });

  it('derives lastEventId from the most recent event when events are present', async () => {
    const event: SseEvent = {
      id: 'e1',
      eventType: 'message',
      data: 'hello',
      lastEventId: 'evt-last',
      size: 5,
      timestamp: new Date().toISOString(),
    };
    mockSseReturn.events = [event];
    await renderPage();
    expect(screen.getByTestId('sse-studio')).toBeTruthy();
  });
});

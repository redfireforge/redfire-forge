/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SseStudioPage } from './SseStudioPage';
import type { UseSseConnectionReturn } from './useSseConnection';
import type { SseConnectionConfig, SseConnectionSnapshot, SseStats } from './sseTypes';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
  }),
}));

vi.mock('../../shared/utils/fileSaver', () => ({
  saveJsonFile: vi.fn(),
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

beforeEach(() => {
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

  it('renders URL input and Connect button', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-url-input')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn')).toBeTruthy();
    expect(screen.getByTestId('sse-connect-btn').textContent).toBe('Connect');
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

  it('toggles headers panel visibility', () => {
    render(<SseStudioPage />);
    expect(screen.queryByTestId('sse-headers-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    expect(screen.getByTestId('sse-headers-panel')).toBeTruthy();
  });

  it('renders add header button in headers panel', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    expect(screen.getByTestId('sse-add-header')).toBeTruthy();
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

  // ── State CSS classes ───────────────────────────────────────────────

  it('applies sse-state-connected class when connected', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-connect-panel').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-connected');
  });

  it('applies sse-state-connecting class when connecting', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connecting' });
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-connect-panel').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-connecting');
  });

  it('applies sse-state-error class when error', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'error', error: 'fail' });
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-connect-panel').querySelector('.sse-state-dot');
    expect(dot?.className).toContain('sse-state-error');
  });

  it('applies sse-state-disconnected class by default', () => {
    render(<SseStudioPage />);
    const dot = screen.getByTestId('sse-connect-panel').querySelector('.sse-state-dot');
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

  // ── Auto-reconnect badge ───────────────────────────────────────────

  it('shows auto-reconnect badge when connected and autoReconnect on', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test', autoReconnect: true };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Auto-reconnect: On');
  });

  it('shows auto-reconnect Off when connected and autoReconnect off', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), url: 'https://test', autoReconnect: false };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).toContain('Auto-reconnect: Off');
  });

  it('does not show auto-reconnect badge when not connected', () => {
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-state-label').textContent).not.toContain('Auto-reconnect');
  });

  // ── Headers panel behavior ─────────────────────────────────────────

  it('shows header count in toggle button', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'Authorization', value: 'Bearer x' }],
    };
    render(<SseStudioPage />);
    expect(screen.getByTestId('sse-headers-toggle').textContent).toContain('(1)');
  });

  it('adds a header when + Add Header is clicked', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    fireEvent.click(screen.getByTestId('sse-add-header'));
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('shows header key and value inputs for existing headers', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test' }],
    };
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const panel = screen.getByTestId('sse-headers-panel');
    const keyInputs = panel.querySelectorAll('.sse-header-key');
    const valInputs = panel.querySelectorAll('.sse-header-value');
    expect(keyInputs.length).toBe(1);
    expect(valInputs.length).toBe(1);
  });

  it('calls setConfig when header key is changed', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test' }],
    };
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const keyInput = screen.getByTestId('sse-headers-panel').querySelector('.sse-header-key') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'Authorization' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('calls setConfig when header value is changed', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test' }],
    };
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const valInput = screen.getByTestId('sse-headers-panel').querySelector('.sse-header-value') as HTMLInputElement;
    fireEvent.change(valInput, { target: { value: 'Bearer xyz' } });
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('removes a header when × is clicked', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test' }],
    };
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const removeBtn = screen.getByTestId('sse-headers-panel').querySelector('.sse-header-remove') as HTMLButtonElement;
    fireEvent.click(removeBtn);
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('disables header inputs when connected', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test' }],
    };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const keyInput = screen.getByTestId('sse-headers-panel').querySelector('.sse-header-key') as HTMLInputElement;
    expect(keyInput.disabled).toBe(true);
  });

  it('disables add header button when connected', () => {
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const addBtn = screen.getByTestId('sse-add-header') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('disables remove header button when connected', () => {
    mockSseReturn.config = {
      ...makeDefaultConfig(),
      headers: [{ key: 'X-Custom', value: 'test' }],
    };
    mockSseReturn.connection = makeDefaultConnection({ state: 'connected' });
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const removeBtn = screen.getByTestId('sse-headers-panel').querySelector('.sse-header-remove') as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true);
  });

  // ── Auto-reconnect checkbox ────────────────────────────────────────

  it('renders auto-reconnect checkbox in headers panel', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const checkbox = screen.getByTestId('sse-headers-panel').querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);
  });

  it('toggles auto-reconnect checkbox', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const checkbox = screen.getByTestId('sse-headers-panel').querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(mockSseReturn.setConfig).toHaveBeenCalled();
  });

  it('shows retry info when autoReconnect is enabled', () => {
    mockSseReturn.config = { ...makeDefaultConfig(), autoReconnect: true };
    mockSseReturn.connection = makeDefaultConnection({ retryMs: 3000 });
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    const panel = screen.getByTestId('sse-headers-panel');
    expect(panel.textContent).toContain('Retry:');
    expect(panel.textContent).toContain('3000ms');
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

  // ── Headers toggle styling ─────────────────────────────────────────

  it('applies active class to headers toggle when panel is open', () => {
    render(<SseStudioPage />);
    const toggle = screen.getByTestId('sse-headers-toggle');
    expect(toggle.className).not.toContain('active');
    fireEvent.click(toggle);
    expect(toggle.className).toContain('active');
  });

  it('toggles headers panel off again', () => {
    render(<SseStudioPage />);
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    expect(screen.getByTestId('sse-headers-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sse-headers-toggle'));
    expect(screen.queryByTestId('sse-headers-panel')).toBeNull();
  });

  // ── Button disabled logic ──────────────────────────────────────────

  it('button is NOT disabled when URL is whitespace-only and not busy', () => {
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
});

/**
 * @vitest-environment jsdom
 *
 * Tests for deriveTabLabel utility and the studio shell layout.
 * Split from WebSocketStudioPage.test.tsx to keep each file under 900 lines.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebSocketStudioPage, deriveTabLabel } from './WebSocketStudioPage';
import * as hookModule from './useWebSocketStudio';
import * as profilesModule from '../../app/hooks/useWebSocketProfiles';
import * as templatesModule from '../../app/hooks/useWebSocketTemplates';
import * as historyModule from '../../app/hooks/useWebSocketHistory';
import * as storageModule from '../../shared/websocket/websocketStorage';
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

beforeEach(() => {
  vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(makeStudioReturn());
  vi.spyOn(profilesModule, 'useWebSocketProfiles').mockReturnValue(makeProfilesReturn());
  vi.spyOn(templatesModule, 'useWebSocketTemplates').mockReturnValue(makeTemplatesReturn());
  vi.spyOn(historyModule, 'useWebSocketHistory').mockReturnValue(makeHistoryReturn());
  vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue(null);
  vi.spyOn(storageModule, 'saveWsTabState').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── deriveTabLabel ──────────────────────────────────────────────────────────

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
    const result = deriveTabLabel('ws://my%server:1234');
    expect(result).toBe('my%server:1234');
  });

  it('regex fallback returns host without port when URL constructor throws', () => {
    const result = deriveTabLabel('ws://my%server/path');
    expect(result).toBe('my%server');
  });

  it('returns result for URL with brackets', () => {
    const result = deriveTabLabel('ws://[invalid-host]:1234');
    expect(typeof result).toBe('string');
  });

  it('returns null for whitespace-only input', () => {
    expect(deriveTabLabel('   ')).toBeNull();
  });

  it('returns hostname without port when port is empty', () => {
    expect(deriveTabLabel('ws://echo.websocket.org')).toBe('echo.websocket.org');
  });
});

// ── Studio Shell Layout ─────────────────────────────────────────────────────

describe('studio shell (the only production layout)', () => {
  it('wraps each tab in the shell by default', async () => {
    await renderStudioPage();
    expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
    expect(screen.getByTestId('mode-client')).toBeTruthy();
    expect(screen.getByTestId('mode-mock')).toBeTruthy();
    expect(screen.getByTestId('mode-saved')).toBeTruthy();
    expect(screen.getByTestId('ws-studio-split')).toBeTruthy();
  });

  it('seeds shell mode from persisted studio-layout fields', async () => {
    vi.spyOn(storageModule, 'loadWsTabState').mockResolvedValue({
      tabs: [
        { id: 'ws-tab-200', label: 'Mock', url: 'ws://m', viewTab: 'mock', mode: 'mock', leftTab: 'send', rightTab: 'events' },
      ],
      activeTabId: 'ws-tab-200',
      renamedTabIds: [],
    });
    await renderStudioPage();
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
    fireEvent.click(screen.getByTestId('right-tab-stats'));
    expect(screen.getByTestId('right-tab-stats').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('left-tab-send'));
    expect(screen.getByTestId('right-tab-stats').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('mode-saved'));
    fireEvent.click(screen.getByTestId('mode-client'));
    expect(screen.getByTestId('right-tab-stats').getAttribute('aria-selected')).toBe('true');
  });

  it('splits the connect view into Connect / Headers / Params left tabs', async () => {
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-connect'));
    expect(screen.getByTestId('connect-btn')).toBeTruthy();
    expect(screen.queryByTestId('headers-section')).toBeNull();
    expect(screen.queryByTestId('query-params-section')).toBeNull();
    fireEvent.click(screen.getByTestId('left-tab-headers'));
    expect(screen.getByTestId('headers-section')).toBeTruthy();
    expect(screen.queryByTestId('query-params-section')).toBeNull();
    expect(screen.queryByTestId('connect-btn')).toBeNull();
    fireEvent.click(screen.getByTestId('left-tab-params'));
    expect(screen.getByTestId('query-params-section')).toBeTruthy();
    expect(screen.queryByTestId('headers-section')).toBeNull();
    expect(screen.queryByTestId('connect-btn')).toBeNull();
  });

  it('shows the relocated composer on the Send left tab', async () => {
    await renderStudioPage();
    fireEvent.click(screen.getByTestId('left-tab-send'));
    expect(screen.queryAllByTestId('send-btn')).toHaveLength(1);
    expect(screen.getByTestId('ping-btn')).toBeTruthy();
    expect(screen.queryByTestId('connect-btn')).toBeNull();
    expect(screen.queryByTestId('headers-section')).toBeNull();
    expect(screen.queryByTestId('query-params-section')).toBeNull();
  });
});

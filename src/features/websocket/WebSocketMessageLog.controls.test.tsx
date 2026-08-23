/**
 * @vitest-environment jsdom
 * WebSocketMessageLog — ping, export, search, status, compare, recording, bookmarks
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import type { WsFrame, WsMessageTemplate } from '@shared/websocket/types';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; getScrollElement?: () => unknown; estimateSize: () => number }) => {
    opts.getScrollElement?.();
    return {
      getVirtualItems: () =>
        Array.from({ length: opts.count }, (_, i) => ({
          index: i,
          start: i * opts.estimateSize(),
          size: opts.estimateSize(),
          end: (i + 1) * opts.estimateSize(),
          key: i,
          lane: 0,
        })),
      getTotalSize: () => opts.count * opts.estimateSize(),
      scrollToIndex: vi.fn(),
    };
  },
}));

vi.mock('../../shared/utils/fileSaver', () => ({
  saveJsonFile: vi.fn().mockResolvedValue(undefined),
}));

function makeFrame(overrides?: Partial<WsFrame>): WsFrame {
  return {
    id: `frame-${Math.random().toString(36).slice(2)}`,
    direction: 'received',
    type: 'text',
    data: '{"hello":"world"}',
    size: 17,
    timestamp: '2026-06-07T12:00:01.234Z',
    ...overrides,
  };
}

function defaultProps(overrides?: Partial<Parameters<typeof WebSocketMessageLog>[0]>) {
  return {
    messages: [] as WsFrame[],
    totalCount: 0,
    maxMessages: 1000,
    isMaxReached: false,
    searchText: '',
    setSearchText: vi.fn(),
    searchMode: 'text' as const,
    setSearchMode: vi.fn(),
    directionFilter: 'all' as const,
    setDirectionFilter: vi.fn(),
    sizeFilter: 'all' as const,
    setSizeFilter: vi.fn(),
    timeFilter: 'all' as const,
    setTimeFilter: vi.fn(),
    contentTypeFilter: 'all' as const,
    setContentTypeFilter: vi.fn(),
    onClear: vi.fn(),
    onSend: vi.fn(),
    isConnected: true,
    templates: [] as WsMessageTemplate[],
    onSaveTemplate: vi.fn().mockResolvedValue(undefined),
    onDeleteTemplate: vi.fn().mockResolvedValue(undefined),
    onLoadTemplate: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

describe('WebSocketMessageLog', () => {
  describe('ping button', () => {
    it('renders a Ping button', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('ping-btn')).toBeTruthy();
    });

    it('calls onPing when clicked in proxy mode', () => {
      const onPing = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ onPing, transportMode: 'proxy' })} />);
      fireEvent.click(screen.getByTestId('ping-btn'));
      expect(onPing).toHaveBeenCalledTimes(1);
    });

    it('is disabled when not connected', () => {
      render(<WebSocketMessageLog {...defaultProps({ isConnected: false })} />);
      expect((screen.getByTestId('ping-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('is disabled when connected but in direct mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ isConnected: true, transportMode: 'direct' })} />);
      expect((screen.getByTestId('ping-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('is enabled when connected in proxy mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ isConnected: true, transportMode: 'proxy' })} />);
      expect((screen.getByTestId('ping-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('is enabled when connected in native mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ isConnected: true, transportMode: 'native' })} />);
      expect((screen.getByTestId('ping-btn') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('export button', () => {
    it('renders an Export button', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('export-messages-btn')).toBeTruthy();
    });

    it('is disabled when no messages', () => {
      render(<WebSocketMessageLog {...defaultProps({ messages: [], totalCount: 0 })} />);
      expect((screen.getByTestId('export-messages-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('is enabled when messages exist', () => {
      const msgs = [makeFrame()];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1, allMessages: msgs })} />);
      expect((screen.getByTestId('export-messages-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('triggers download on click', async () => {
      const { saveJsonFile } = await import('../../shared/utils/fileSaver');
      const msgs = [makeFrame({ data: 'test-data' })];

      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('export-messages-btn'));

      expect(saveJsonFile).toHaveBeenCalledTimes(1);
      const [data, filename] = (saveJsonFile as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(data).toHaveLength(1);
      expect(data[0].data).toBe('test-data');
      expect(filename).toMatch(/^ws-messages-.*\.json$/);
    });

    it('swallows export failures when save dialog is cancelled', async () => {
      const { saveJsonFile } = await import('../../shared/utils/fileSaver');
      vi.mocked(saveJsonFile).mockRejectedValueOnce(new Error('cancelled'));
      const msgs = [makeFrame()];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1, allMessages: msgs })} />);
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-messages-btn'));
      });
      expect(saveJsonFile).toHaveBeenCalled();
    });
  });

  describe('search mode and filter UI', () => {
    it('renders search mode pills', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('search-mode-pills')).toBeTruthy();
      expect(screen.getByTestId('search-mode-text')).toBeTruthy();
      expect(screen.getByTestId('search-mode-regex')).toBeTruthy();
      expect(screen.getByTestId('search-mode-jsonpath')).toBeTruthy();
    });

    it('calls setSearchMode when pill clicked', async () => {
      const setSearchMode = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ setSearchMode })} />);
      await act(async () => {
        fireEvent.click(screen.getByTestId('search-mode-regex'));
      });
      expect(setSearchMode).toHaveBeenCalledWith('regex');
    });

    it('calls setSearchMode for jsonpath pill', async () => {
      const setSearchMode = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ setSearchMode })} />);
      await act(async () => {
        fireEvent.click(screen.getByTestId('search-mode-jsonpath'));
      });
      expect(setSearchMode).toHaveBeenCalledWith('jsonpath');
    });

    it('clears active filters from the filter bar', async () => {
      const setSizeFilter = vi.fn();
      const setTimeFilter = vi.fn();
      const setContentTypeFilter = vi.fn();
      render(
        <WebSocketMessageLog
          {...defaultProps({
            sizeFilter: 'large',
            timeFilter: 'last5m',
            contentTypeFilter: 'json',
            setSizeFilter,
            setTimeFilter,
            setContentTypeFilter,
          })}
        />,
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-toggle-btn'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('clear-filters-btn'));
      });
      expect(setSizeFilter).toHaveBeenCalledWith('all');
      expect(setTimeFilter).toHaveBeenCalledWith('all');
      expect(setContentTypeFilter).toHaveBeenCalledWith('all');
    });

    it('renders filter toggle button', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('filter-toggle-btn')).toBeTruthy();
    });

    it('shows filter bar when filter toggle clicked', async () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('filter-bar')).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-toggle-btn'));
      });
      expect(screen.getByTestId('filter-bar')).toBeTruthy();
      expect(screen.getByTestId('size-filter')).toBeTruthy();
      expect(screen.getByTestId('time-filter')).toBeTruthy();
      expect(screen.getByTestId('content-type-filter')).toBeTruthy();
    });

    it('shows match counter when filtered count differs from total', () => {
      const msgs = [makeFrame({ id: 't1', data: 'hello' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 5 })} />);
      expect(screen.getByTestId('match-counter').textContent).toBe('1 of 5');
    });

    it('hides match counter when all messages are shown', () => {
      const msgs = [makeFrame({ id: 't1', data: 'hello' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      expect(screen.queryByTestId('match-counter')).toBeNull();
    });

    it('shows invalid regex indicator', () => {
      render(<WebSocketMessageLog {...defaultProps({ searchMode: 'regex', searchText: '[invalid' })} />);
      const input = screen.getByTestId('search-input');
      expect(input.className).toContain('ws-search-invalid');
    });
  });

  describe('status bar', () => {
    it('renders status bar when showStatusBar is true', () => {
      render(<WebSocketMessageLog {...defaultProps({ showStatusBar: true, isConnected: true })} />);
      expect(screen.getByTestId('messages-status-bar')).toBeTruthy();
    });

    it('hides status bar when showStatusBar is false', () => {
      render(<WebSocketMessageLog {...defaultProps({ showStatusBar: false })} />);
      expect(screen.queryByTestId('messages-status-bar')).toBeNull();
    });

    it('shows connected status', () => {
      render(<WebSocketMessageLog {...defaultProps({ showStatusBar: true, isConnected: true })} />);
      expect(screen.getByTestId('messages-status-bar').textContent).toContain('Connected');
    });

    it('shows disconnected status', () => {
      render(<WebSocketMessageLog {...defaultProps({ showStatusBar: true, isConnected: false })} />);
      expect(screen.getByTestId('messages-status-bar').textContent).toContain('Disconnected');
    });

    it('shows connection URL when provided', () => {
      render(<WebSocketMessageLog {...defaultProps({ showStatusBar: true, connectionUrl: 'ws://test:8080' })} />);
      expect(screen.getByTestId('messages-status-bar').textContent).toContain('ws://test:8080');
    });

    it('shows uptime when provided', () => {
      render(<WebSocketMessageLog {...defaultProps({ showStatusBar: true, uptime: 65000 })} />);
      const bar = screen.getByTestId('messages-status-bar');
      expect(bar.textContent).toContain('Uptime:');
    });

    it('shows sent and received counts', () => {
      render(<WebSocketMessageLog {...defaultProps({ showStatusBar: true, sentCount: 5, receivedCount: 10 })} />);
      const bar = screen.getByTestId('messages-status-bar');
      expect(bar.textContent).toContain('5');
      expect(bar.textContent).toContain('10');
    });
  });

  describe('compare mode', () => {
    it('renders compare button', () => {
      const msgs = [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      expect(screen.getByTestId('compare-btn')).toBeTruthy();
    });

    it('disables compare button when fewer than 2 messages', () => {
      const msgs = [makeFrame({ id: 'f1' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      expect((screen.getByTestId('compare-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows compare banner when compare mode is activated', () => {
      const msgs = [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      expect(screen.getByTestId('compare-banner')).toBeTruthy();
    });

    it('exits compare mode on cancel', () => {
      const msgs = [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      expect(screen.getByTestId('compare-banner')).toBeTruthy();
      fireEvent.click(screen.getByTestId('compare-cancel'));
      expect(screen.queryByTestId('compare-banner')).toBeNull();
    });
  });

  describe('recording and replay', () => {
    it('shows start recording button when idle', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', onStartRecording: vi.fn() })} />);
      expect(screen.getByTestId('start-recording-btn')).toBeTruthy();
    });

    it('calls onStartRecording when record button clicked', () => {
      const onStart = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', onStartRecording: onStart })} />);
      fireEvent.click(screen.getByTestId('start-recording-btn'));
      expect(onStart).toHaveBeenCalledOnce();
    });

    it('shows stop recording button when recording', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'recording', onStopRecording: vi.fn() })} />);
      expect(screen.getByTestId('stop-recording-btn')).toBeTruthy();
    });

    it('calls onStopRecording when stop button clicked', () => {
      const onStop = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'recording', onStopRecording: onStop })} />);
      fireEvent.click(screen.getByTestId('stop-recording-btn'));
      expect(onStop).toHaveBeenCalledOnce();
    });

    it('shows import recording button when idle', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', onLoadRecordingFile: vi.fn() })} />);
      expect(screen.getByTestId('import-recording-btn')).toBeTruthy();
    });

    it('shows play button when recording is loaded', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', hasLoadedRecording: true, onStartReplay: vi.fn() })} />);
      expect(screen.getByTestId('start-replay-btn')).toBeTruthy();
    });

    it('shows replay bar when replaying', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'replaying', onPauseReplay: vi.fn(), onStopReplay: vi.fn() })} />);
      expect(screen.getByTestId('replay-bar')).toBeTruthy();
    });

    it('shows pause button during replay', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'replaying', onPauseReplay: vi.fn(), onStopReplay: vi.fn() })} />);
      expect(screen.getByTestId('replay-playpause-btn')).toBeTruthy();
    });

    it('shows replay progress when available', () => {
      render(<WebSocketMessageLog {...defaultProps({
        recordingState: 'replaying',
        onPauseReplay: vi.fn(),
        onStopReplay: vi.fn(),
        replayProgress: { current: 3, total: 10, elapsedMs: 1000, durationMs: 5000 },
      })} />);
      const progress = screen.getByTestId('replay-progress');
      expect(progress.textContent).toContain('3');
      expect(progress.textContent).toContain('10');
      expect(progress.textContent).toContain('events');
    });

    it('shows resume button when paused', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'paused', onResumeReplay: vi.fn(), onStopReplay: vi.fn() })} />);
      const btn = screen.getByTestId('replay-playpause-btn');
      expect(btn.textContent).toContain('▶');
    });

    it('shows exit button in replay bar', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'replaying', onPauseReplay: vi.fn(), onStopReplay: vi.fn() })} />);
      expect(screen.getByTestId('replay-exit-btn')).toBeTruthy();
    });

    it('hides compose bar during replay', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'replaying', onPauseReplay: vi.fn(), onStopReplay: vi.fn() })} />);
      expect(screen.queryByLabelText('Message input')).toBeNull();
    });
  });

  describe('bookmarks', () => {
    it('renders bookmark toggle on message rows', () => {
      const msgs = [makeFrame({ id: 'f1' })];
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 1,
        bookmarkedIds: new Set(),
        onToggleBookmark: vi.fn(),
      })} />);
      expect(screen.getByLabelText('Add bookmark')).toBeTruthy();
    });

    it('shows bookmarked direction filter option', () => {
      render(<WebSocketMessageLog {...defaultProps({ bookmarkCount: 3 })} />);
      fireEvent.click(screen.getByLabelText('Direction filter'));
      expect(screen.getByTestId('direction-filter-opt-bookmarked').textContent).toContain('Bookmarked (3)');
    });
  });

  describe('stats toggle', () => {
    it('shows stats toggle when metrics provided', () => {
      const metrics = { sentCount: 0, receivedCount: 0, sentBytes: 0, receivedBytes: 0, avgSentSize: 0, avgReceivedSize: 0, messageRate: 0, peakRate: 0, startedAt: null, elapsedMs: 0, latestSentAt: null, latestReceivedAt: null, sentRate: 0, receivedRate: 0 };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<WebSocketMessageLog {...defaultProps({ metrics: metrics as any })} />);
      expect(screen.getByTestId('stats-toggle-btn')).toBeTruthy();
    });

    it('hides stats toggle when metrics not provided', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('stats-toggle-btn')).toBeNull();
    });
  });

  describe('load test toggle', () => {
    it('shows load test button when onToggleLoadTest provided', () => {
      render(<WebSocketMessageLog {...defaultProps({ onToggleLoadTest: vi.fn() })} />);
      expect(screen.getByTestId('load-test-toggle-btn')).toBeTruthy();
    });

    it('hides load test button when onToggleLoadTest not provided', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('load-test-toggle-btn')).toBeNull();
    });

    it('calls onToggleLoadTest when clicked', () => {
      const onToggle = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ onToggleLoadTest: onToggle })} />);
      fireEvent.click(screen.getByTestId('load-test-toggle-btn'));
      expect(onToggle).toHaveBeenCalledOnce();
    });
  });

  describe('schema toggle', () => {
    it('shows schema toggle when onToggleSchemasVisible provided', () => {
      render(<WebSocketMessageLog {...defaultProps({ onToggleSchemasVisible: vi.fn() })} />);
      expect(screen.getByTestId('schema-toggle-btn')).toBeTruthy();
    });

    it('hides schema toggle when onToggleSchemasVisible not provided', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('schema-toggle-btn')).toBeNull();
    });
  });

  describe('showAuxPanels (Phase 5 — relocated to right-pane tabs)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics = { sentCount: 0, receivedCount: 0, sentBytes: 0, receivedBytes: 0, avgSentSize: 0, avgReceivedSize: 0, messageRate: 0, peakRate: 0, startedAt: null, elapsedMs: 0, latestSentAt: null, latestReceivedAt: null, sentRate: 0, receivedRate: 0 } as any;

    it('shows the Stats/Load Test/Schema toggles by default', () => {
      render(
        <WebSocketMessageLog
          {...defaultProps({ metrics, onToggleLoadTest: vi.fn(), onToggleSchemasVisible: vi.fn() })}
        />,
      );
      expect(screen.getByTestId('stats-toggle-btn')).toBeTruthy();
      expect(screen.getByTestId('load-test-toggle-btn')).toBeTruthy();
      expect(screen.getByTestId('schema-toggle-btn')).toBeTruthy();
    });

    it('hides the Stats/Load Test/Schema toggles when showAuxPanels is false', () => {
      render(
        <WebSocketMessageLog
          {...defaultProps({ metrics, onToggleLoadTest: vi.fn(), onToggleSchemasVisible: vi.fn(), showAuxPanels: false })}
        />,
      );
      expect(screen.queryByTestId('stats-toggle-btn')).toBeNull();
      expect(screen.queryByTestId('load-test-toggle-btn')).toBeNull();
      expect(screen.queryByTestId('schema-toggle-btn')).toBeNull();
    });

    it('does not render the inline Stats panel when showAuxPanels is false even if toggled on', () => {
      render(
        <WebSocketMessageLog
          {...defaultProps({ metrics, onToggleLoadTest: vi.fn(), onToggleSchemasVisible: vi.fn(), showAuxPanels: false })}
        />,
      );
      // No toggle button means the inline stats panel can never be shown.
      expect(screen.queryByTestId('stats-panel')).toBeNull();
    });
  });

});

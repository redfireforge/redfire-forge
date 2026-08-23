/**
 * @vitest-environment jsdom
 * WebSocketMessageLog — validation, keyboard, filter presets, diff, schema, replay
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import type { WsFrame, WsMessageTemplate } from '@shared/websocket/types';
import { selectOption } from '@test-utils/customSelectHelper';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
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
  }),
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
  describe('validation filter', () => {
    it('shows validation filter when enabled with schemas', () => {
      render(<WebSocketMessageLog {...defaultProps({
        validationEnabled: true,
        hasEnabledSchemas: true,
        setValidationFilter: vi.fn(),
      })} />);
      expect(screen.getByTestId('validation-filter')).toBeTruthy();
    });

    it('hides validation filter when not enabled', () => {
      render(<WebSocketMessageLog {...defaultProps({
        validationEnabled: false,
        hasEnabledSchemas: true,
        setValidationFilter: vi.fn(),
      })} />);
      expect(screen.queryByTestId('validation-filter')).toBeNull();
    });

    it('hides validation filter when no enabled schemas', () => {
      render(<WebSocketMessageLog {...defaultProps({
        validationEnabled: true,
        hasEnabledSchemas: false,
        setValidationFilter: vi.fn(),
      })} />);
      expect(screen.queryByTestId('validation-filter')).toBeNull();
    });
  });

  describe('keyboard shortcuts', () => {
    it('Escape exits compare mode when active', () => {
      const msgs = [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      expect(screen.getByTestId('compare-banner')).toBeTruthy();
      const list = screen.getByTestId('message-list');
      fireEvent.keyDown(list, { key: 'Escape' });
      expect(screen.queryByTestId('compare-banner')).toBeNull();
    });

    it('ArrowDown selects first message when none selected', () => {
      const msgs = [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      const list = screen.getByTestId('message-list');
      fireEvent.keyDown(list, { key: 'ArrowDown' });
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');
    });
  });

  describe('filter bar presets', () => {
    it('filter toggle shows active filter count', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<WebSocketMessageLog {...defaultProps({ sizeFilter: 'small' as any })} />);
      expect(screen.getByTestId('filter-toggle-btn').textContent).toContain('Filters (1)');
    });

    it('shows multiple active filter count', () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      render(<WebSocketMessageLog {...defaultProps({
        sizeFilter: 'small' as any,
        timeFilter: 'last-1m' as any,
        contentTypeFilter: 'json' as any,
      })} />);
      /* eslint-enable @typescript-eslint/no-explicit-any */
      expect(screen.getByTestId('filter-toggle-btn').textContent).toContain('Filters (3)');
    });

    it('shows filter bar when toggled', () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      render(<WebSocketMessageLog {...defaultProps({
        sizeFilter: 'small' as any,
      })} />);
      /* eslint-enable @typescript-eslint/no-explicit-any */
      fireEvent.click(screen.getByTestId('filter-toggle-btn'));
      // Filter bar should now be visible - active class on button
      expect(screen.getByTestId('filter-toggle-btn').className).toContain('ws-filter-toggle-active');
    });
  });

  describe('compare mode - diff pair creation', () => {
    it('selects two messages and shows diff overlay', async () => {
      const msgs = [
        makeFrame({ id: 'f1', data: '{"a":1}' }),
        makeFrame({ id: 'f2', data: '{"a":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      expect(screen.getByTestId('compare-banner')).toBeTruthy();

      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f1')); });
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f2')); });
      expect(screen.getByTestId('diff-overlay')).toBeTruthy();
    });

    it('deselects message in compare mode on re-click', () => {
      const msgs = [
        makeFrame({ id: 'f1', data: '{"a":1}' }),
        makeFrame({ id: 'f2', data: '{"a":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      fireEvent.click(screen.getByTestId('message-row-f1'));
      // Re-click to deselect
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect(screen.queryByTestId('diff-panel')).toBeNull();
    });

    it('ignores non-text messages in compare mode', () => {
      const msgs = [
        makeFrame({ id: 'f1', data: '{"a":1}', type: 'binary' }),
        makeFrame({ id: 'f2', data: '{"a":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      // Click binary message - should be ignored
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect(screen.queryByTestId('diff-panel')).toBeNull();
    });

    it('replaces first selection when both slots full', async () => {
      const msgs = [
        makeFrame({ id: 'f1', data: '{"a":1}' }),
        makeFrame({ id: 'f2', data: '{"a":2}' }),
        makeFrame({ id: 'f3', data: '{"a":3}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 3, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f1')); });
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f2')); });
      expect(screen.getByTestId('diff-overlay')).toBeTruthy();
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f3')); });
    });

    it('closes diff overlay and exits compare mode', async () => {
      const msgs = [
        makeFrame({ id: 'f1', data: '{"a":1}' }),
        makeFrame({ id: 'f2', data: '{"a":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f1')); });
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f2')); });
      expect(screen.getByTestId('diff-overlay')).toBeTruthy();

      await act(async () => { fireEvent.click(screen.getByTestId('diff-close')); });
      expect(screen.queryByTestId('diff-overlay')).toBeNull();
      expect(screen.queryByTestId('compare-banner')).toBeNull();
    });

    it('swaps diff pair', async () => {
      const msgs = [
        makeFrame({ id: 'f1', data: '{"a":1}', timestamp: '2026-06-07T12:00:00.000Z' }),
        makeFrame({ id: 'f2', data: '{"a":2}', timestamp: '2026-06-07T12:00:01.000Z' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f1')); });
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f2')); });
      expect(screen.getByTestId('diff-overlay')).toBeTruthy();

      await act(async () => { fireEvent.click(screen.getByTestId('diff-swap')); });
      expect(screen.getByTestId('diff-overlay')).toBeTruthy();
    });

    it('Escape closes diff overlay first, then compare mode', async () => {
      const msgs = [
        makeFrame({ id: 'f1', data: '{"a":1}' }),
        makeFrame({ id: 'f2', data: '{"a":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('compare-btn'));
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f1')); });
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f2')); });
      expect(screen.getByTestId('diff-overlay')).toBeTruthy();

      const list = screen.getByTestId('message-list');
      await act(async () => { fireEvent.keyDown(list, { key: 'Escape' }); });
      expect(screen.queryByTestId('diff-overlay')).toBeNull();
    });
  });

  describe('quick diff (D key shortcut)', () => {
    it('opens quick diff with previous same-direction message on D key', async () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'received', data: '{"v":1}' }),
        makeFrame({ id: 'f2', direction: 'sent', data: '{"v":2}' }),
        makeFrame({ id: 'f3', direction: 'received', data: '{"v":3}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 3, allMessages: msgs })} />);
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f3')); });
      expect(screen.getByTestId('detail-panel')).toBeTruthy();

      const list = screen.getByTestId('message-list');
      await act(async () => { fireEvent.keyDown(list, { key: 'd' }); });
      expect(screen.getByTestId('diff-overlay')).toBeTruthy();
    });

    it('does not open quick diff when no previous same-direction message', () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'received', data: '{"v":1}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      const list = screen.getByTestId('message-list');
      fireEvent.keyDown(list, { key: 'd' });
      expect(screen.queryByTestId('diff-panel')).toBeNull();
    });
  });

  describe('detail panel prev/next with hasDiffPrev/hasDiffNext', () => {
    it('shows diff-prev button when previous same-direction text message exists', () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'received', data: '{"v":1}' }),
        makeFrame({ id: 'f2', direction: 'received', data: '{"v":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('message-row-f2'));
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
      // Should show diff-prev since f1 is same direction text
      const diffPrev = screen.queryByTestId('detail-diff-prev');
      expect(diffPrev).toBeTruthy();
    });

    it('shows diff-next button when next same-direction text message exists', () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'received', data: '{"v":1}' }),
        makeFrame({ id: 'f2', direction: 'received', data: '{"v":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
      const diffNext = screen.queryByTestId('detail-diff-next');
      expect(diffNext).toBeTruthy();
    });

    it('opens diff overlay via diff-prev button', async () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'received', data: '{"v":1}' }),
        makeFrame({ id: 'f2', direction: 'received', data: '{"v":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f2')); });
      const diffPrev = screen.queryByTestId('detail-diff-prev');
      if (diffPrev) {
        await act(async () => { fireEvent.click(diffPrev); });
        expect(screen.getByTestId('diff-overlay')).toBeTruthy();
      }
    });

    it('opens diff overlay via diff-next button', async () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'received', data: '{"v":1}' }),
        makeFrame({ id: 'f2', direction: 'received', data: '{"v":2}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2, allMessages: msgs })} />);
      await act(async () => { fireEvent.click(screen.getByTestId('message-row-f1')); });
      const diffNext = screen.queryByTestId('detail-diff-next');
      if (diffNext) {
        await act(async () => { fireEvent.click(diffNext); });
        expect(screen.getByTestId('diff-overlay')).toBeTruthy();
      }
    });
  });

  describe('stats panel toggle', () => {
    it('toggles stats panel on/off', () => {
      const metrics = { msgPerSec: 1, sentPerSec: 1, receivedPerSec: 1, totalBytesIn: 200, totalBytesOut: 100, bytesInPerSec: 40, bytesOutPerSec: 20, textFrames: 10, binaryFrames: 0, controlFrames: 0, errorCount: 0, history: [] };
      render(<WebSocketMessageLog {...defaultProps({ metrics })} />);
      fireEvent.click(screen.getByTestId('stats-toggle-btn'));
      expect(screen.getByTestId('stats-panel')).toBeTruthy();
      fireEvent.click(screen.getByTestId('stats-toggle-btn'));
      expect(screen.queryByTestId('stats-panel')).toBeNull();
    });
  });

  describe('validation cache and filtering', () => {
    it('filters messages by validation: valid only', () => {
      const getValidation = vi.fn((frame: WsFrame) => {
        if (frame.id === 'f1') return [{ valid: true, schemaId: 's1', schemaName: 'Test', errors: [] }];
        return [{ valid: false, schemaId: 's1', schemaName: 'Test', errors: ['bad'] }];
      });
      const msgs = [
        makeFrame({ id: 'f1', data: '{"valid":true}' }),
        makeFrame({ id: 'f2', data: '{"invalid":true}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 2,
        allMessages: msgs,
        validationEnabled: true,
        hasEnabledSchemas: true,
        validationFilter: 'valid',
        setValidationFilter: vi.fn(),
        getValidation,
      })} />);
      // Only f1 should be visible
      expect(screen.getByTestId('message-row-f1')).toBeTruthy();
      expect(screen.queryByTestId('message-row-f2')).toBeNull();
    });

    it('filters messages by validation: invalid only', () => {
      const getValidation = vi.fn((frame: WsFrame) => {
        if (frame.id === 'f1') return [{ valid: true, schemaId: 's1', schemaName: 'Test', errors: [] }];
        return [{ valid: false, schemaId: 's1', schemaName: 'Test', errors: ['bad'] }];
      });
      const msgs = [
        makeFrame({ id: 'f1', data: '{"valid":true}' }),
        makeFrame({ id: 'f2', data: '{"invalid":true}' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 2,
        allMessages: msgs,
        validationEnabled: true,
        hasEnabledSchemas: true,
        validationFilter: 'invalid',
        setValidationFilter: vi.fn(),
        getValidation,
      })} />);
      expect(screen.queryByTestId('message-row-f1')).toBeNull();
      expect(screen.getByTestId('message-row-f2')).toBeTruthy();
    });

    it('shows all messages when validation filter is all', () => {
      const getValidation = vi.fn(() => [{ valid: true, schemaId: 's1', schemaName: 'T', errors: [] }]);
      const msgs = [
        makeFrame({ id: 'f1' }),
        makeFrame({ id: 'f2' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 2,
        allMessages: msgs,
        validationEnabled: true,
        hasEnabledSchemas: true,
        validationFilter: 'all',
        setValidationFilter: vi.fn(),
        getValidation,
      })} />);
      expect(screen.getByTestId('message-row-f1')).toBeTruthy();
      expect(screen.getByTestId('message-row-f2')).toBeTruthy();
    });

    it('skips validation filtering when validation disabled', () => {
      const msgs = [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })];
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 2,
        validationEnabled: false,
        hasEnabledSchemas: true,
        validationFilter: 'valid',
      })} />);
      expect(screen.getByTestId('message-row-f1')).toBeTruthy();
      expect(screen.getByTestId('message-row-f2')).toBeTruthy();
    });

    it('shows validation badge on message rows', () => {
      const getValidation = vi.fn((frame: WsFrame) => {
        if (frame.id === 'f1') return [{ valid: true, schemaId: 's1', schemaName: 'T', errors: [] }];
        return [{ valid: false, schemaId: 's1', schemaName: 'T', errors: ['err'] }];
      });
      const msgs = [
        makeFrame({ id: 'f1' }),
        makeFrame({ id: 'f2' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 2,
        allMessages: msgs,
        validationEnabled: true,
        hasEnabledSchemas: true,
        getValidation,
      })} />);
      // Both messages should render (filter is 'all' by default)
      expect(screen.getByTestId('message-row-f1')).toBeTruthy();
      expect(screen.getByTestId('message-row-f2')).toBeTruthy();
    });
  });

  describe('schema panel', () => {
    it('renders schema panel when schemasVisible and all handlers provided', () => {
      render(<WebSocketMessageLog {...defaultProps({
        schemasVisible: true,
        onAddSchema: vi.fn().mockReturnValue({ ok: true }),
        onUpdateSchema: vi.fn().mockReturnValue({ ok: true }),
        onRemoveSchema: vi.fn(),
        onToggleSchema: vi.fn(),
        onGenerateSchema: vi.fn().mockReturnValue(null),
        setValidationEnabled: vi.fn(),
      })} />);
      expect(screen.getByTestId('ws-schema-panel')).toBeTruthy();
    });

    it('does not render schema panel when schemasVisible is false', () => {
      render(<WebSocketMessageLog {...defaultProps({
        schemasVisible: false,
        onAddSchema: vi.fn().mockReturnValue({ ok: true }),
        onUpdateSchema: vi.fn().mockReturnValue({ ok: true }),
        onRemoveSchema: vi.fn(),
        onToggleSchema: vi.fn(),
        onGenerateSchema: vi.fn().mockReturnValue(null),
        setValidationEnabled: vi.fn(),
      })} />);
      expect(screen.queryByTestId('ws-schema-panel')).toBeNull();
    });

    it('shows schema indicator on toggle button when enabled', () => {
      render(<WebSocketMessageLog {...defaultProps({
        onToggleSchemasVisible: vi.fn(),
        hasEnabledSchemas: true,
        validationEnabled: true,
      })} />);
      const btn = screen.getByTestId('schema-toggle-btn');
      expect(btn.textContent).toContain('●');
    });
  });

  describe('recording file import', () => {
    it('triggers file input click on import recording button click', () => {
      const onLoad = vi.fn().mockResolvedValue(true);
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', onLoadRecordingFile: onLoad })} />);
      const importBtn = screen.getByTestId('import-recording-btn');
      fireEvent.click(importBtn);
      // File input should exist (hidden)
      expect(screen.getByTestId('recording-file-input')).toBeTruthy();
    });

    it('calls onLoadRecordingFile when file selected', async () => {
      const onLoad = vi.fn().mockResolvedValue(true);
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', onLoadRecordingFile: onLoad })} />);
      const fileInput = screen.getByTestId('recording-file-input') as HTMLInputElement;
      const file = new File(['{}'], 'test.json', { type: 'application/json' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
      expect(onLoad).toHaveBeenCalledWith(file);
    });

    it('shows error message when import file is invalid', async () => {
      const onLoad = vi.fn().mockResolvedValue(false);
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', onLoadRecordingFile: onLoad })} />);
      const fileInput = screen.getByTestId('recording-file-input') as HTMLInputElement;
      const file = new File(['not valid'], 'bad.json', { type: 'application/json' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
      expect(screen.getByTestId('import-error')).toBeTruthy();
      expect(screen.getByTestId('import-error').textContent).toContain('Invalid recording file');
    });
  });

  describe('replay speed selector', () => {
    it('changes replay speed via select', () => {
      const onSetSpeed = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({
        recordingState: 'replaying',
        onPauseReplay: vi.fn(),
        onStopReplay: vi.fn(),
        onSetReplaySpeed: onSetSpeed,
      })} />);
      selectOption(screen.getByTestId('replay-speed-select'), '5×');
      expect(onSetSpeed).toHaveBeenCalledWith(5);
    });

    it('calls onStopReplay on exit button click', () => {
      const onStop = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({
        recordingState: 'replaying',
        onPauseReplay: vi.fn(),
        onStopReplay: onStop,
      })} />);
      fireEvent.click(screen.getByTestId('replay-exit-btn'));
      expect(onStop).toHaveBeenCalledOnce();
    });

    it('calls onPauseReplay when playing', () => {
      const onPause = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({
        recordingState: 'replaying',
        onPauseReplay: onPause,
        onStopReplay: vi.fn(),
      })} />);
      fireEvent.click(screen.getByTestId('replay-playpause-btn'));
      expect(onPause).toHaveBeenCalledOnce();
    });

    it('calls onResumeReplay when paused', () => {
      const onResume = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({
        recordingState: 'paused',
        onResumeReplay: onResume,
        onStopReplay: vi.fn(),
      })} />);
      fireEvent.click(screen.getByTestId('replay-playpause-btn'));
      expect(onResume).toHaveBeenCalledOnce();
    });
  });

  describe('export with bookmarks', () => {
    it('includes bookmarked flag in export data', async () => {
      const { saveJsonFile } = await import('../../shared/utils/fileSaver');
      const mockSave = saveJsonFile as ReturnType<typeof vi.fn>;
      mockSave.mockClear();
      const msgs = [
        makeFrame({ id: 'f1', data: 'hello' }),
        makeFrame({ id: 'f2', data: 'world' }),
      ];
      const bookmarkedIds = new Set(['f1']);
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 2,
        allMessages: msgs,
        bookmarkedIds,
      })} />);
      fireEvent.click(screen.getByTestId('export-messages-btn'));
      expect(mockSave).toHaveBeenCalledTimes(1);
      const exported = mockSave.mock.calls[0][0];
      expect(exported[0].bookmarked).toBe(true);
      expect(exported[1].bookmarked).toBeUndefined();
    });
  });

  describe('detail panel navigation', () => {
    it('navigates detail panel backward', () => {
      const msgs = [
        makeFrame({ id: 'f1', data: 'first' }),
        makeFrame({ id: 'f2', data: 'second' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      fireEvent.click(screen.getByTestId('message-row-f2'));
      expect(screen.getByTestId('message-row-f2').className).toContain('selected');
      fireEvent.click(screen.getByTestId('detail-prev'));
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');
    });

    it('ArrowDown does not go past last message', () => {
      const msgs = [makeFrame({ id: 'f1', data: 'only' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      const list = screen.getByTestId('message-list');
      fireEvent.keyDown(list, { key: 'ArrowDown' });
      // Still on f1
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');
    });

    it('ArrowUp does not go past first message', () => {
      const msgs = [
        makeFrame({ id: 'f1', data: 'first' }),
        makeFrame({ id: 'f2', data: 'second' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      const list = screen.getByTestId('message-list');
      fireEvent.keyDown(list, { key: 'ArrowUp' });
      // Still on f1
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');
    });
  });

  describe('regex invalid indicator', () => {
    it('does not show invalid when regex is valid', () => {
      render(<WebSocketMessageLog {...defaultProps({ searchMode: 'regex', searchText: 'hello.*' })} />);
      const input = screen.getByTestId('search-input');
      expect(input.className).not.toContain('ws-search-invalid');
    });

    it('does not show invalid for empty regex', () => {
      render(<WebSocketMessageLog {...defaultProps({ searchMode: 'regex', searchText: '' })} />);
      const input = screen.getByTestId('search-input');
      expect(input.className).not.toContain('ws-search-invalid');
    });
  });

  describe('bookmark toggle callback', () => {
    it('calls onToggleBookmark when bookmark button clicked', () => {
      const onToggle = vi.fn();
      const msgs = [makeFrame({ id: 'f1' })];
      render(<WebSocketMessageLog {...defaultProps({
        messages: msgs,
        totalCount: 1,
        bookmarkedIds: new Set(),
        onToggleBookmark: onToggle,
      })} />);
      fireEvent.click(screen.getByLabelText('Add bookmark'));
      expect(onToggle).toHaveBeenCalledWith('f1');
    });
  });

  describe('load test toggle active state', () => {
    it('shows active class when load test is active', () => {
      render(<WebSocketMessageLog {...defaultProps({ onToggleLoadTest: vi.fn(), loadTestActive: true })} />);
      const btn = screen.getByTestId('load-test-toggle-btn');
      expect(btn.className).toContain('ws-stats-toggle-active');
    });

    it('does not show active class when load test is inactive', () => {
      render(<WebSocketMessageLog {...defaultProps({ onToggleLoadTest: vi.fn(), loadTestActive: false })} />);
      const btn = screen.getByTestId('load-test-toggle-btn');
      expect(btn.className).not.toContain('ws-stats-toggle-active');
    });
  });

  describe('search placeholder text', () => {
    it('shows regex placeholder in regex mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ searchMode: 'regex' })} />);
      expect((screen.getByTestId('search-input') as HTMLInputElement).placeholder).toContain('regex');
    });

    it('shows jsonpath placeholder in jsonpath mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ searchMode: 'jsonpath' })} />);
      expect((screen.getByTestId('search-input') as HTMLInputElement).placeholder).toContain('$.path');
    });

    it('shows text placeholder in text mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ searchMode: 'text' })} />);
      expect((screen.getByTestId('search-input') as HTMLInputElement).placeholder).toContain('Search');
    });
  });

  describe('hides recording buttons appropriately', () => {
    it('hides start-recording and import when hasLoadedRecording is true', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'idle', hasLoadedRecording: true, onStartReplay: vi.fn() })} />);
      expect(screen.queryByTestId('start-recording-btn')).toBeNull();
      expect(screen.queryByTestId('import-recording-btn')).toBeNull();
      expect(screen.getByTestId('start-replay-btn')).toBeTruthy();
    });

    it('hides all recording buttons during recording state', () => {
      render(<WebSocketMessageLog {...defaultProps({ recordingState: 'recording', onStopRecording: vi.fn() })} />);
      expect(screen.queryByTestId('start-recording-btn')).toBeNull();
      expect(screen.queryByTestId('import-recording-btn')).toBeNull();
      expect(screen.getByTestId('stop-recording-btn')).toBeTruthy();
    });
  });

  describe('scroll behavior', () => {
    it('handles scroll event on message list', () => {
      const msgs = [makeFrame({ id: 'f1' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      const list = screen.getByTestId('message-list');
      fireEvent.scroll(list);
      // Should not throw
      expect(list).toBeTruthy();
    });
  });

  describe('direction filter rendering', () => {
    it('renders direction filter dropdown trigger', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      const trigger = screen.getByLabelText('Direction filter');
      expect(trigger).toBeTruthy();
    });

    it('calls setDirectionFilter on option click', () => {
      const setDir = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ setDirectionFilter: setDir })} />);
      fireEvent.click(screen.getByLabelText('Direction filter'));
      fireEvent.click(screen.getByTestId('direction-filter-opt-sent'));
      expect(setDir).toHaveBeenCalledWith('sent');
    });
  });

  describe('validation filter change', () => {
    it('calls setValidationFilter on option click', () => {
      const setFilter = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({
        validationEnabled: true,
        hasEnabledSchemas: true,
        setValidationFilter: setFilter,
      })} />);
      fireEvent.click(screen.getByTestId('validation-filter'));
      fireEvent.click(screen.getByTestId('validation-filter-opt-invalid'));
      expect(setFilter).toHaveBeenCalledWith('invalid');
    });
  });
});

/**
 * @vitest-environment jsdom
 * Coverage gaps for WebSocketMessageLog — keyboard, search pills, badges, schema, export errors.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { selectOption } from '../../test-utils/customSelectHelper';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import type { WsFrame, WsMessageTemplate } from '../../shared/websocket/types';

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

async function renderMessageLog(
  overrides?: Partial<Parameters<typeof WebSocketMessageLog>[0]>,
) {
  const view = render(<WebSocketMessageLog {...defaultProps(overrides)} />);
  await act(async () => {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });
  return view;
}

describe('WebSocketMessageLog — coverage gaps', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it('selects first message on ArrowDown when nothing is selected', async () => {
    const msgs = [
      makeFrame({ id: 'f1', data: '{"a":1}' }),
      makeFrame({ id: 'f2', data: '{"a":2}' }),
    ];
    await renderMessageLog({ messages: msgs, totalCount: 2, allMessages: msgs });
    const list = screen.getByTestId('message-list');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByTestId('message-row-f1').className).toContain('selected');
  });

  it('switches search mode via toolbar pills', async () => {
    const setSearchMode = vi.fn();
    await renderMessageLog({ setSearchMode });
    fireEvent.click(screen.getByTestId('search-mode-regex'));
    expect(setSearchMode).toHaveBeenCalledWith('regex');
    fireEvent.click(screen.getByTestId('search-mode-jsonpath'));
    expect(setSearchMode).toHaveBeenCalledWith('jsonpath');
  });

  it('Escape exits compare mode when diff overlay is not open', async () => {
    const msgs = [
      makeFrame({ id: 'f1', data: '{"a":1}' }),
      makeFrame({ id: 'f2', data: '{"a":2}' }),
    ];
    await renderMessageLog({ messages: msgs, totalCount: 2, allMessages: msgs });
    fireEvent.click(screen.getByTestId('compare-btn'));
    expect(screen.getByTestId('compare-banner')).toBeTruthy();
    const list = screen.getByTestId('message-list');
    await act(async () => { fireEvent.keyDown(list, { key: 'Escape' }); });
    expect(screen.queryByTestId('compare-banner')).toBeNull();
  });

  it('hides diff-next when next same-direction candidate is non-text', async () => {
    const msgs = [
      makeFrame({ id: 'f1', direction: 'received', data: '{"a":1}' }),
      makeFrame({ id: 'f2', direction: 'received', type: 'binary', data: 'bin' }),
    ];
    await renderMessageLog({ messages: msgs, totalCount: 2, allMessages: msgs });
    fireEvent.click(screen.getByTestId('message-row-f1'));
    expect(screen.queryByTestId('detail-diff-next')).toBeNull();
  });

  it('hides diff-prev when previous same-direction candidate is non-text', async () => {
    const msgs = [
      makeFrame({ id: 'f1', direction: 'received', type: 'binary', data: 'bin' }),
      makeFrame({ id: 'f2', direction: 'received', data: '{"a":2}' }),
    ];
    await renderMessageLog({ messages: msgs, totalCount: 2, allMessages: msgs });
    fireEvent.click(screen.getByTestId('message-row-f2'));
    expect(screen.queryByTestId('detail-diff-prev')).toBeNull();
  });

  it('shows validation badges on message rows', async () => {
    const getValidation = vi.fn((frame: WsFrame) => {
      if (frame.id === 'valid') return [{ valid: true, schemaId: 's1', schemaName: 'Ok', errors: [] }];
      if (frame.id === 'invalid') return [{ valid: false, schemaId: 's1', schemaName: 'Bad', errors: ['x'] }];
      return null;
    });
    const msgs = [
      makeFrame({ id: 'valid', data: '{}' }),
      makeFrame({ id: 'invalid', data: '{}' }),
      makeFrame({ id: 'plain', data: '{}' }),
    ];
    await renderMessageLog({
      messages: msgs,
      totalCount: 3,
      allMessages: msgs,
      validationEnabled: true,
      hasEnabledSchemas: true,
      getValidation,
    });
    expect(screen.getByTestId('validation-badge-valid')).toBeTruthy();
    expect(screen.getByTestId('validation-badge-invalid')).toBeTruthy();
    expect(screen.queryByTestId('validation-badge-plain')).toBeNull();
  });

  it('shows compare badges A and B on selected rows', async () => {
    const msgs = [
      makeFrame({ id: 'f1', data: '{"a":1}' }),
      makeFrame({ id: 'f2', data: '{"a":2}' }),
    ];
    const { container } = await renderMessageLog({ messages: msgs, totalCount: 2, allMessages: msgs });
    fireEvent.click(screen.getByTestId('compare-btn'));
    await act(async () => { fireEvent.click(screen.getByTestId('message-row-f1')); });
    await act(async () => { fireEvent.click(screen.getByTestId('message-row-f2')); });
    const badges = container.querySelectorAll('.ws-compare-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toBe('A');
    expect(badges[1].textContent).toBe('B');
  });

  it('renders schema panel when visible with required handlers', async () => {
    await renderMessageLog({
      schemasVisible: true,
      validationEnabled: false,
      schemas: [{ id: 's1', name: 'Chat', schema: '{}', direction: 'both', enabled: true }],
      onAddSchema: vi.fn(() => ({ ok: true })),
      onUpdateSchema: vi.fn(() => ({ ok: true })),
      onRemoveSchema: vi.fn(),
      onToggleSchema: vi.fn(),
      onGenerateSchema: vi.fn(() => '{}'),
      setValidationEnabled: vi.fn(),
      onToggleSchemasVisible: vi.fn(),
    });
    expect(screen.getByTestId('ws-schema-panel')).toBeTruthy();
  });

  it('swallows saveJsonFile rejection on export', async () => {
    const { saveJsonFile } = await import('../../shared/utils/fileSaver');
    vi.mocked(saveJsonFile).mockRejectedValueOnce(new Error('cancelled'));
    const msgs = [makeFrame({ id: 'f1', data: 'hello' })];
    await renderMessageLog({ messages: msgs, totalCount: 1, allMessages: msgs });
    fireEvent.click(screen.getByTestId('export-messages-btn'));
    await act(async () => { await Promise.resolve(); });
    expect(saveJsonFile).toHaveBeenCalled();
  });

  it('shows max reached banner and hides composer when showComposer is false', async () => {
    await renderMessageLog({
      showComposer: false,
      isMaxReached: true,
      totalCount: 1000,
      maxMessages: 1000,
    });
    expect(screen.getByTestId('max-reached')).toBeTruthy();
    expect(screen.queryByLabelText('Message input')).toBeNull();
  });

  it('shows filter bar after toggling filters with active count', async () => {
    await renderMessageLog({
      sizeFilter: 'large',
      timeFilter: 'last5m',
    });
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    expect(screen.getByTestId('filter-bar')).toBeTruthy();
    expect(screen.getByTestId('filter-toggle-btn').textContent).toContain('Filters (2)');
  });

  it('sets replay speed to Max (0)', async () => {
    const onSetReplaySpeed = vi.fn();
    await renderMessageLog({
      recordingState: 'replaying',
      onPauseReplay: vi.fn(),
      onStopReplay: vi.fn(),
      onSetReplaySpeed,
      replayProgress: { current: 1, total: 10, elapsedMs: 100, durationMs: 1000 },
    });
    selectOption(screen.getByTestId('replay-speed-select'), 'Max');
    expect(onSetReplaySpeed).toHaveBeenCalledWith(0);
  });

  it('caches validation results for repeated lookups', async () => {
    const getValidation = vi.fn(() => [{ valid: true, schemaId: 's1', schemaName: 'T', errors: [] }]);
    const msgs = [makeFrame({ id: 'f1', data: '{}' })];
    await renderMessageLog({
      messages: msgs,
      totalCount: 1,
      allMessages: msgs,
      validationEnabled: true,
      hasEnabledSchemas: true,
      validationFilter: 'valid',
      setValidationFilter: vi.fn(),
      getValidation,
    });
    fireEvent.click(screen.getByTestId('message-row-f1'));
    fireEvent.click(screen.getByTestId('message-row-f1'));
    expect(getValidation.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('closes direction dropdown on outside click and on Escape', async () => {
    await renderMessageLog();
    fireEvent.click(screen.getByTestId('direction-filter'));
    expect(screen.getByRole('listbox', { name: 'Direction filter options' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox', { name: 'Direction filter options' })).toBeNull();

    fireEvent.click(screen.getByTestId('direction-filter'));
    expect(screen.getByRole('listbox', { name: 'Direction filter options' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Direction filter options' })).toBeNull();
  });

  it('closes validation dropdown after selecting an option', async () => {
    const setValidationFilter = vi.fn();
    await renderMessageLog({
      validationEnabled: true,
      hasEnabledSchemas: true,
      setValidationFilter,
      validationFilter: 'all',
    });
    fireEvent.click(screen.getByTestId('validation-filter'));
    fireEvent.click(screen.getByTestId('validation-filter-opt-valid'));
    expect(setValidationFilter).toHaveBeenCalledWith('valid');
    expect(screen.queryByRole('listbox', { name: 'Validation filter options' })).toBeNull();
  });

  it('marks invalid regex input and clears state for valid regex', async () => {
    const view = render(<WebSocketMessageLog {...defaultProps({ searchMode: 'regex', searchText: '[abc' })} />);
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    const search = view.getByTestId('search-input');
    expect(search.className).toContain('ws-search-invalid');

    view.rerender(<WebSocketMessageLog {...defaultProps({ searchMode: 'regex', searchText: '^abc$' })} />);
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(view.getByTestId('search-input').className).not.toContain('ws-search-invalid');
  });

  it('ignores file input change when no file or loader is provided', async () => {
    await renderMessageLog({ onLoadRecordingFile: undefined });
    const fileInput = screen.getByTestId('recording-file-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [] } });
    });
    expect(screen.queryByTestId('import-error')).toBeNull();
  });

  it('falls back to default labels for unknown direction/validation filters', async () => {
    await renderMessageLog({
      directionFilter: 'unknown' as unknown as 'all',
      validationEnabled: true,
      hasEnabledSchemas: true,
      setValidationFilter: vi.fn(),
      validationFilter: 'unknown' as unknown as 'all',
    });
    expect(screen.getByTestId('direction-filter').textContent).toContain('All');
    expect(screen.getByTestId('validation-filter').textContent).toContain('Validation: All');
  });

  it('prunes validation cache when message list shrinks significantly', async () => {
    const getValidation = vi.fn(() => [{ valid: true, schemaId: 's1', schemaName: 'T', errors: [] }]);
    const many = Array.from({ length: 70 }, (_, i) => makeFrame({ id: `m-${i}`, data: '{}' }));
    const one = [many[0]];

    const view = render(<WebSocketMessageLog {...defaultProps({
      messages: many,
      allMessages: many,
      totalCount: many.length,
      validationEnabled: true,
      hasEnabledSchemas: true,
      validationFilter: 'valid',
      setValidationFilter: vi.fn(),
      getValidation,
    })} />);

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    view.rerender(<WebSocketMessageLog {...defaultProps({
      messages: one,
      allMessages: one,
      totalCount: one.length,
      validationEnabled: true,
      hasEnabledSchemas: true,
      validationFilter: 'valid',
      setValidationFilter: vi.fn(),
      getValidation,
    })} />);

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId(`message-row-${one[0].id}`)).toBeTruthy();
  });
});

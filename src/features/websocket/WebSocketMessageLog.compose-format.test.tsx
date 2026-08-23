/**
 * @vitest-environment jsdom
 * WebSocketMessageLog — compose, format, template, toolbar, message list
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import type { WsFrame, WsMessageTemplate } from '@shared/websocket/types';

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

function makeTemplate(overrides?: Partial<WsMessageTemplate>): WsMessageTemplate {
  return {
    id: 'tpl-1',
    name: 'Hello Template',
    body: '{"msg":"hi"}',
    format: 'json',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
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
  describe('compose bar', () => {
    it('renders message input', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByLabelText('Message input')).toBeTruthy();
    });

    it('disables input when not connected', () => {
      render(<WebSocketMessageLog {...defaultProps({ isConnected: false })} />);
      expect((screen.getByLabelText('Message input') as HTMLTextAreaElement).disabled).toBe(true);
    });

    it('sends message on Send click', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'hello' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(props.onSend).toHaveBeenCalledWith('hello', 'text');
    });

    it('keeps input after send so the message can be re-sent', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      const input = screen.getByLabelText('Message input') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(input.value).toBe('hello');
    });

    it('disables Send when input is empty', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('disables Send when not connected', () => {
      render(<WebSocketMessageLog {...defaultProps({ isConnected: false })} />);
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('sends on Cmd+Enter', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
      expect(props.onSend).toHaveBeenCalledWith('hello', 'text');
    });

    it('sends on Ctrl+Enter', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
      expect(props.onSend).toHaveBeenCalledWith('hello', 'text');
    });

    it('does not send on plain Enter', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(props.onSend).not.toHaveBeenCalled();
    });

    it('does not send whitespace-only messages', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: '   ' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
      expect(props.onSend).not.toHaveBeenCalled();
    });

    it('renders the inline composer by default (showComposer defaults to true)', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('send-btn')).toBeTruthy();
      expect(screen.queryByLabelText('Message input')).toBeTruthy();
    });

    it('hides the inline composer when showComposer is false', () => {
      render(<WebSocketMessageLog {...defaultProps({ showComposer: false })} />);
      expect(screen.queryByTestId('send-btn')).toBeNull();
      expect(screen.queryByLabelText('Message input')).toBeNull();
    });

    it('still renders the inline composer when showComposer is explicitly true', () => {
      render(<WebSocketMessageLog {...defaultProps({ showComposer: true })} />);
      expect(screen.queryByTestId('send-btn')).toBeTruthy();
    });
  });

  describe('format selector', () => {
    it('renders format pill buttons', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('format-pills')).toBeTruthy();
      expect(screen.getByTestId('format-pill-text')).toBeTruthy();
      expect(screen.getByTestId('format-pill-json')).toBeTruthy();
      expect(screen.getByTestId('format-pill-binary')).toBeTruthy();
    });

    it('defaults to text format (text pill aria-pressed=true)', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect((screen.getByTestId('format-pill-text') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
      expect((screen.getByTestId('format-pill-json') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false');
    });

    it('shows beautify button in JSON mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('format-pill-json'));
      expect(screen.getByTestId('pretty-format-btn')).toBeTruthy();
    });

    it('hides beautify button in text mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('pretty-format-btn')).toBeNull();
    });

    it('beautifies valid JSON', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('format-pill-json'));
      const input = screen.getByLabelText('Message input') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: '{"a":1}' } });
      fireEvent.click(screen.getByTestId('pretty-format-btn'));
      expect(input.value).toBe('{\n  "a": 1\n}');
    });

    it('sends with format parameter', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      fireEvent.click(screen.getByTestId('format-pill-json'));
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '{"a":1}' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(props.onSend).toHaveBeenCalledWith('{"a":1}', 'json');
    });

    it('shows base64 hint for invalid base64 in binary mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '!invalid!' } });
      expect(screen.getByTestId('base64-hint')).toBeTruthy();
    });

    it('disables send for invalid base64', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '!invalid!' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('enables send for valid base64', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'SGVsbG8=' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends binary format with correct parameter', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'SGVsbG8=' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(props.onSend).toHaveBeenCalledWith('SGVsbG8=', 'binary');
    });

    it('disables beautify button for invalid JSON', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('format-pill-json'));
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '{broken' } });
      expect((screen.getByTestId('pretty-format-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('does not show base64 hint for empty input in binary mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      expect(screen.queryByTestId('base64-hint')).toBeNull();
    });
  });

  describe('template dropdown', () => {
    it('renders template trigger button', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('template-trigger')).toBeTruthy();
    });

    it('opens template dropdown on click', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-dropdown')).toBeTruthy();
    });

    it('shows empty state when no templates', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-empty')).toBeTruthy();
    });

    it('shows template list when templates exist', () => {
      const templates = [makeTemplate({ id: 'tpl-1', name: 'Hello' })];
      render(<WebSocketMessageLog {...defaultProps({ templates })} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-list')).toBeTruthy();
      expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('loads template body and format into compose', () => {
      const templates = [makeTemplate({ id: 'tpl-1', body: 'loaded body', format: 'json' })];
      const onLoad = vi.fn().mockReturnValue({ body: 'loaded body', format: 'json' });
      render(<WebSocketMessageLog {...defaultProps({ templates, onLoadTemplate: onLoad })} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      fireEvent.click(screen.getByText('Hello Template'));
      expect(onLoad).toHaveBeenCalledWith('tpl-1');
      expect((screen.getByLabelText('Message input') as HTMLTextAreaElement).value).toBe('loaded body');
      expect((screen.getByTestId('format-pill-json') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    });

    it('deletes template from dropdown', async () => {
      const templates = [makeTemplate({ id: 'tpl-1' })];
      const props = defaultProps({ templates });
      render(<WebSocketMessageLog {...props} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('template-delete-tpl-1'));
      });
      expect(props.onDeleteTemplate).toHaveBeenCalledWith('tpl-1');
    });

    it('saves new template with name', async () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'body text' } });
      fireEvent.click(screen.getByTestId('template-trigger'));
      fireEvent.change(screen.getByTestId('template-save-name'), { target: { value: 'My Template' } });
      await act(async () => {
        fireEvent.click(screen.getByTestId('template-save-btn'));
      });
      expect(props.onSaveTemplate).toHaveBeenCalledWith('My Template', 'body text', 'text');
    });

    it('disables save when name is empty', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'body' } });
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect((screen.getByTestId('template-save-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('disables save when compose text is empty', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      fireEvent.change(screen.getByTestId('template-save-name'), { target: { value: 'name' } });
      expect((screen.getByTestId('template-save-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('closes dropdown on Escape key', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-dropdown')).toBeTruthy();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('template-dropdown')).toBeNull();
    });

    it('toggles dropdown open/close on trigger click', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-dropdown')).toBeTruthy();
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.queryByTestId('template-dropdown')).toBeNull();
    });
  });

  describe('toolbar', () => {
    it('renders search input', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByLabelText('Search messages')).toBeTruthy();
    });

    it('calls setSearchText on search change', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      fireEvent.change(screen.getByLabelText('Search messages'), { target: { value: 'test' } });
      expect(props.setSearchText).toHaveBeenCalledWith('test');
    });

    it('disables Clear when no messages', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect((screen.getByTestId('clear-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('enables Clear when messages exist', () => {
      render(<WebSocketMessageLog {...defaultProps({ totalCount: 5 })} />);
      expect((screen.getByTestId('clear-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows max reached indicator', () => {
      render(<WebSocketMessageLog {...defaultProps({
        totalCount: 1000,
        maxMessages: 1000,
        isMaxReached: true,
      })} />);
      expect(screen.getByTestId('max-reached').textContent).toContain('1000/1000');
    });
  });

  describe('message list', () => {
    it('shows empty state when no messages', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('empty-state').textContent).toContain('No Messages Yet');
    });

    it('shows filter empty state when filtered to zero', () => {
      render(<WebSocketMessageLog {...defaultProps({ totalCount: 5 })} />);
      expect(screen.getByTestId('empty-state').textContent).toContain('No Results');
    });

    it('renders message rows', () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'sent', data: 'hello' }),
        makeFrame({ id: 'f2', direction: 'received', data: 'world' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      expect(screen.getByText('hello')).toBeTruthy();
      expect(screen.getByText('world')).toBeTruthy();
    });

    it('shows direction arrows', () => {
      const msgs = [
        makeFrame({ id: 'f1', direction: 'sent', data: 'out' }),
        makeFrame({ id: 'f2', direction: 'received', data: 'in' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      expect(screen.getByText('↑')).toBeTruthy();
      expect(screen.getByText('↓')).toBeTruthy();
    });

    it('truncates long messages at 500 chars', () => {
      const longData = 'x'.repeat(600);
      const msgs = [makeFrame({ id: 'f1', data: longData })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      const contents = screen.getByTestId('message-list');
      const contentSpans = contents.querySelectorAll('.ws-message-content');
      expect(contentSpans.length).toBe(1);
      expect(contentSpans[0].textContent!.length).toBeLessThan(600);
    });

    it('opens detail panel on message click', () => {
      const msgs = [makeFrame({ id: 'f1', data: '{"key":"value"}' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      fireEvent.click(screen.getByLabelText('received message'));
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
    });

    it('closes detail panel on second click', () => {
      const msgs = [makeFrame({ id: 'f1' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      fireEvent.click(screen.getByLabelText('received message'));
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
      fireEvent.click(screen.getByLabelText('received message'));
      expect(screen.queryByTestId('detail-panel')).toBeNull();
    });

    it('pretty-prints JSON in message rows', () => {
      const msgs = [makeFrame({ id: 'f1', data: '{"a":1}' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      const content = screen.getByTestId('message-list').querySelector('.ws-message-content');
      expect(content?.textContent).toContain('"a": 1');
    });

    it('selects next message on ArrowDown key', () => {
      const msgs = [
        makeFrame({ id: 'f1', data: 'first' }),
        makeFrame({ id: 'f2', data: 'second' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      const list = screen.getByTestId('message-list');
      fireEvent.keyDown(list, { key: 'ArrowDown' });
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
    });

    it('navigates up with ArrowUp key', () => {
      const msgs = [
        makeFrame({ id: 'f1', data: 'first' }),
        makeFrame({ id: 'f2', data: 'second' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 2 })} />);
      const list = screen.getByTestId('message-list');
      // Select second message
      fireEvent.click(screen.getByTestId('message-row-f2'));
      expect(screen.getByTestId('message-row-f2').className).toContain('selected');
      // Navigate up
      fireEvent.keyDown(list, { key: 'ArrowUp' });
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');
    });

    it('deselects on Escape key in list', () => {
      const msgs = [makeFrame({ id: 'f1', data: 'test' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
      const list = screen.getByTestId('message-list');
      fireEvent.keyDown(list, { key: 'Escape' });
      expect(screen.queryByTestId('detail-panel')).toBeNull();
    });

    it('adds selected class to clicked message row', () => {
      const msgs = [makeFrame({ id: 'f1', data: 'test' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');
    });

    it('navigates detail panel to next/prev message via buttons', () => {
      const msgs = [
        makeFrame({ id: 'f1', data: 'first' }),
        makeFrame({ id: 'f2', data: 'second' }),
        makeFrame({ id: 'f3', data: 'third' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 3 })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
      expect(screen.getByTestId('message-row-f1').className).toContain('selected');

      fireEvent.click(screen.getByTestId('detail-next'));
      expect(screen.getByTestId('message-row-f2').className).toContain('selected');

      fireEvent.click(screen.getByTestId('detail-next'));
      expect(screen.getByTestId('message-row-f3').className).toContain('selected');
    });

    it('does not navigate past first or last message', () => {
      const msgs = [makeFrame({ id: 'f1', data: 'only' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect((screen.getByTestId('detail-prev') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('detail-next') as HTMLButtonElement).disabled).toBe(true);
    });

    it('closes detail panel via close button', () => {
      const msgs = [makeFrame({ id: 'f1', data: 'test' })];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      fireEvent.click(screen.getByTestId('message-row-f1'));
      expect(screen.getByTestId('detail-panel')).toBeTruthy();
      fireEvent.click(screen.getByTestId('detail-close'));
      expect(screen.queryByTestId('detail-panel')).toBeNull();
    });
  });

});

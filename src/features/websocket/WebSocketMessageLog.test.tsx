/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

    it('clears input after send', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      const input = screen.getByLabelText('Message input') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(input.value).toBe('');
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
    it('renders format selector', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('format-select')).toBeTruthy();
    });

    it('defaults to text format', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect((screen.getByTestId('format-select') as HTMLSelectElement).value).toBe('text');
    });

    it('shows beautify button in JSON mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'json' } });
      expect(screen.getByTestId('beautify-btn')).toBeTruthy();
    });

    it('hides beautify button in text mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('beautify-btn')).toBeNull();
    });

    it('beautifies valid JSON', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'json' } });
      const input = screen.getByLabelText('Message input') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: '{"a":1}' } });
      fireEvent.click(screen.getByTestId('beautify-btn'));
      expect(input.value).toBe('{\n  "a": 1\n}');
    });

    it('sends with format parameter', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'json' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '{"a":1}' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(props.onSend).toHaveBeenCalledWith('{"a":1}', 'json');
    });

    it('shows base64 hint for invalid base64 in binary mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '!invalid!' } });
      expect(screen.getByTestId('base64-hint')).toBeTruthy();
    });

    it('disables send for invalid base64', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '!invalid!' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('enables send for valid base64', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'SGVsbG8=' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends binary format with correct parameter', () => {
      const props = defaultProps();
      render(<WebSocketMessageLog {...props} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'SGVsbG8=' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(props.onSend).toHaveBeenCalledWith('SGVsbG8=', 'binary');
    });

    it('disables beautify button for invalid JSON', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'json' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '{broken' } });
      expect((screen.getByTestId('beautify-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('does not show base64 hint for empty input in binary mode', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
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
      expect((screen.getByTestId('format-select') as HTMLSelectElement).value).toBe('json');
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

  describe('Socket.IO compose mode', () => {
    it('shows Socket.IO compose fields when effectiveProtocol is socket-io', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'socket-io' })} />);
      expect(screen.getByTestId('sio-compose-fields')).toBeTruthy();
      expect(screen.getByTestId('sio-event-name')).toBeTruthy();
      expect(screen.getByTestId('sio-namespace')).toBeTruthy();
    });

    it('does not show Socket.IO compose fields for raw protocol', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'raw' })} />);
      expect(screen.queryByTestId('sio-compose-fields')).toBeNull();
    });

    it('does not show Socket.IO compose fields when effectiveProtocol is undefined', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.queryByTestId('sio-compose-fields')).toBeNull();
    });

    it('hides raw format selector in Socket.IO mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'socket-io' })} />);
      expect(screen.queryByTestId('format-select')).toBeNull();
    });

    it('shows Socket.IO mode badge', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'socket-io' })} />);
      expect(screen.getByTestId('sio-mode-badge')).toBeTruthy();
      expect(screen.getByTestId('sio-mode-badge').textContent).toBe('Socket.IO');
    });

    it('requires event name to enable Send', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'socket-io' })} />);
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'chat' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends encoded Socket.IO event on Send click', () => {
      const props = defaultProps({ effectiveProtocol: 'socket-io' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'message' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '"hello"' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      expect(props.onSend).toHaveBeenCalledWith('42["message","hello"]', 'text');
    });

    it('sends event without payload when data is empty', () => {
      const props = defaultProps({ effectiveProtocol: 'socket-io' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'ping' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      expect(props.onSend).toHaveBeenCalledWith('42["ping"]', 'text');
    });

    it('sends with custom namespace', () => {
      const props = defaultProps({ effectiveProtocol: 'socket-io' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'msg' } });
      fireEvent.change(screen.getByTestId('sio-namespace'), { target: { value: '/chat' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '"hi"' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      expect(props.onSend).toHaveBeenCalledWith('42/chat,["msg","hi"]', 'text');
    });

    it('sends non-JSON text as string payload', () => {
      const props = defaultProps({ effectiveProtocol: 'socket-io' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'msg' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'plain text' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      expect(props.onSend).toHaveBeenCalledWith('42["msg","plain text"]', 'text');
    });

    it('disables inputs when not connected', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'socket-io', isConnected: false })} />);
      expect((screen.getByTestId('sio-event-name') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('sio-namespace') as HTMLInputElement).disabled).toBe(true);
    });

    it('sends on Cmd+Enter in Socket.IO mode', () => {
      const props = defaultProps({ effectiveProtocol: 'socket-io' });
      render(<WebSocketMessageLog {...props} />);
      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'test' } });
      const input = screen.getByLabelText('Message input');
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
      expect(props.onSend).toHaveBeenCalled();
    });
  });

  describe('protocol-aware message rendering', () => {
    it('shows protocolMeta summary instead of raw data', () => {
      const msgs = [
        makeFrame({
          id: 'f1',
          data: '42["chat","hello"]',
          protocolMeta: {
            protocol: 'socket-io',
            packetType: 'EVENT',
            summary: 'EVENT: chat',
            eventName: 'chat',
            isSystemPacket: false,
          },
        }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      expect(screen.getByText('EVENT: chat')).toBeTruthy();
      expect(screen.getByText('EVENT')).toBeTruthy();
    });

    it('marks system packets with system class', () => {
      const msgs = [
        makeFrame({
          id: 'f1',
          data: '2',
          protocolMeta: {
            protocol: 'socket-io',
            packetType: 'PING',
            summary: 'PING',
            isSystemPacket: true,
          },
        }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      const row = screen.getByTestId('message-row-f1');
      expect(row.className).toContain('ws-message-system');
      expect(row.className).toContain('ws-message-protocol');
    });

    it('shows ◆ icon for system protocol packets', () => {
      const msgs = [
        makeFrame({
          id: 'f1',
          data: '3',
          direction: 'sent',
          protocolMeta: {
            protocol: 'socket-io',
            packetType: 'PONG',
            summary: 'PONG',
            isSystemPacket: true,
          },
        }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      expect(screen.getByText('◆')).toBeTruthy();
    });

    it('renders normal direction arrows for non-system protocol packets', () => {
      const msgs = [
        makeFrame({
          id: 'f1',
          data: '42["msg","hi"]',
          direction: 'sent',
          protocolMeta: {
            protocol: 'socket-io',
            packetType: 'EVENT',
            summary: 'EVENT: msg',
            eventName: 'msg',
            isSystemPacket: false,
          },
        }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1 })} />);
      expect(screen.getByText('↑')).toBeTruthy();
    });
  });

  describe('STOMP compose mode', () => {
    it('shows STOMP compose fields when effectiveProtocol is stomp', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      expect(screen.getByTestId('stomp-compose-fields')).toBeTruthy();
      expect(screen.getByTestId('stomp-command')).toBeTruthy();
      expect(screen.getByTestId('stomp-destination')).toBeTruthy();
    });

    it('does not show STOMP compose fields for raw protocol', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'raw' })} />);
      expect(screen.queryByTestId('stomp-compose-fields')).toBeNull();
    });

    it('hides raw format selector in STOMP mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      expect(screen.queryByTestId('format-select')).toBeNull();
    });

    it('shows STOMP mode badge', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      expect(screen.getByTestId('stomp-mode-badge')).toBeTruthy();
      expect(screen.getByTestId('stomp-mode-badge').textContent).toBe('STOMP');
    });

    it('requires destination for SEND command', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: '/topic/test' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('does not require destination for DISCONNECT', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'DISCONNECT' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('requires destination for SUBSCRIBE', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'SUBSCRIBE' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: '/topic/news' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends encoded STOMP SEND frame', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: '/topic/chat' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'hello' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      expect(props.onSend).toHaveBeenCalledTimes(1);
      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('SEND\n');
      expect(sent).toContain('destination:/topic/chat\n');
      expect(sent).toContain('hello\0');
    });

    it('sends DISCONNECT without body', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'DISCONNECT' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('DISCONNECT\n');
      expect(sent.endsWith('\n\0')).toBe(true);
    });

    it('sends CONNECT with accept-version header', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'CONNECT' } });
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'my-broker' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('CONNECT\n');
      expect(sent).toContain('accept-version:1.2\n');
      expect(sent).toContain('host:my-broker\n');
      expect(sent).not.toContain('destination:');
    });

    it('sends SUBSCRIBE with auto-generated id', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'SUBSCRIBE' } });
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: '/topic/news' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('SUBSCRIBE\n');
      expect(sent).toContain('destination:/topic/news\n');
      expect(sent).toMatch(/id:sub-\d+/);
    });

    it('disables inputs when not connected', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp', isConnected: false })} />);
      expect((screen.getByTestId('stomp-command') as HTMLSelectElement).disabled).toBe(true);
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).disabled).toBe(true);
    });

    it('sends UNSUBSCRIBE with id header (not destination)', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'UNSUBSCRIBE' } });
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'sub-0' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('UNSUBSCRIBE\n');
      expect(sent).toContain('id:sub-0\n');
      expect(sent).not.toContain('destination:');
    });

    it('requires input for UNSUBSCRIBE', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'UNSUBSCRIBE' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'sub-0' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends ACK with id header (not destination)', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'ACK' } });
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-42' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('ACK\n');
      expect(sent).toContain('id:msg-42\n');
      expect(sent).not.toContain('destination:');
    });

    it('requires input for ACK', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'ACK' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-1' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends NACK with id header (not destination)', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'NACK' } });
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-99' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('NACK\n');
      expect(sent).toContain('id:msg-99\n');
      expect(sent).not.toContain('destination:');
    });

    it('shows correct placeholder for UNSUBSCRIBE/ACK/NACK', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'UNSUBSCRIBE' } });
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).placeholder).toContain('ID');

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'ACK' } });
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).placeholder).toContain('ID');

      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'NACK' } });
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).placeholder).toContain('ID');
    });
  });

  describe('GraphQL-WS compose mode', () => {
    it('shows GraphQL compose fields when effectiveProtocol is graphql-ws', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect(screen.getByTestId('gql-compose-fields')).toBeTruthy();
      expect(screen.getByTestId('gql-variables')).toBeTruthy();
      expect(screen.getByTestId('gql-op-id')).toBeTruthy();
    });

    it('does not show GraphQL compose fields for raw protocol', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'raw' })} />);
      expect(screen.queryByTestId('gql-compose-fields')).toBeNull();
    });

    it('hides raw format selector in GraphQL mode', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect(screen.queryByTestId('format-select')).toBeNull();
    });

    it('shows GraphQL mode badge', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect(screen.getByTestId('gql-mode-badge')).toBeTruthy();
      expect(screen.getByTestId('gql-mode-badge').textContent).toBe('GraphQL');
    });

    it('requires query text to send', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '{ users { id } }' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends encoded subscribe message with incrementing ID', () => {
      const props = defaultProps({ effectiveProtocol: 'graphql-ws' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'subscription { onMsg { id } }' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      expect(props.onSend).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(props.onSend.mock.calls[0][0] as string);
      expect(sent.type).toBe('subscribe');
      expect(sent.id).toBe('1');
      expect(sent.payload.query).toBe('subscription { onMsg { id } }');
    });

    it('includes variables when provided', () => {
      const props = defaultProps({ effectiveProtocol: 'graphql-ws' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('gql-variables'), { target: { value: '{"id": "5"}' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'query GetUser($id: ID!) { user(id: $id) { name } }' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = JSON.parse(props.onSend.mock.calls[0][0] as string);
      expect(sent.payload.variables).toEqual({ id: '5' });
    });

    it('displays operation ID counter', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect(screen.getByTestId('gql-op-id').textContent).toBe('Op #1');
    });

    it('renders operation name input', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect(screen.getByTestId('gql-operation-name')).toBeTruthy();
    });

    it('includes operationName when provided', () => {
      const props = defaultProps({ effectiveProtocol: 'graphql-ws' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByTestId('gql-operation-name'), { target: { value: 'GetUsers' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '{ users { id } }' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = JSON.parse(props.onSend.mock.calls[0][0] as string);
      expect(sent.payload.operationName).toBe('GetUsers');
    });

    it('omits operationName when empty', () => {
      const props = defaultProps({ effectiveProtocol: 'graphql-ws' });
      render(<WebSocketMessageLog {...props} />);

      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: '{ users { id } }' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = JSON.parse(props.onSend.mock.calls[0][0] as string);
      expect(sent.payload.operationName).toBeUndefined();
    });
  });

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
      expect(screen.getByTestId('replay-progress').textContent).toContain('3 / 10');
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
      const filter = screen.getByLabelText('Direction filter');
      expect(filter.textContent).toContain('Bookmarked (3)');
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
      fireEvent.change(screen.getByTestId('replay-speed-select'), { target: { value: '5' } });
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
    it('renders direction filter select', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      const select = screen.getByLabelText('Direction filter');
      expect(select).toBeTruthy();
    });

    it('calls setDirectionFilter on change', () => {
      const setDir = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({ setDirectionFilter: setDir })} />);
      fireEvent.change(screen.getByLabelText('Direction filter'), { target: { value: 'sent' } });
      expect(setDir).toHaveBeenCalledWith('sent');
    });
  });

  describe('validation filter change', () => {
    it('calls setValidationFilter on change', () => {
      const setFilter = vi.fn();
      render(<WebSocketMessageLog {...defaultProps({
        validationEnabled: true,
        hasEnabledSchemas: true,
        setValidationFilter: setFilter,
      })} />);
      fireEvent.change(screen.getByTestId('validation-filter'), { target: { value: 'invalid' } });
      expect(setFilter).toHaveBeenCalledWith('invalid');
    });
  });
});

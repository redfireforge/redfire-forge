/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import type { WsFrame, WsMessageTemplate } from '../../shared/websocket/types';

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
    directionFilter: 'all' as const,
    setDirectionFilter: vi.fn(),
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
      expect(screen.getByTestId('empty-state').textContent).toContain('No messages yet');
    });

    it('shows filter empty state when filtered to zero', () => {
      render(<WebSocketMessageLog {...defaultProps({ totalCount: 5 })} />);
      expect(screen.getByTestId('empty-state').textContent).toContain('No messages match filters');
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

    it('triggers download on click', () => {
      const msgs = [makeFrame({ data: 'test-data' })];
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();
      const clickSpy = vi.fn();

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
        if (tag === 'a') {
          return { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
        }
        return origCreateElement(tag, options);
      });
      Object.defineProperty(globalThis, 'URL', {
        value: { createObjectURL, revokeObjectURL },
        writable: true,
        configurable: true,
      });

      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 1, allMessages: msgs })} />);
      fireEvent.click(screen.getByTestId('export-messages-btn'));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });
  });

  describe('control frame toggle', () => {
    it('renders control frame toggle checkbox', () => {
      render(<WebSocketMessageLog {...defaultProps()} />);
      expect(screen.getByTestId('control-frame-toggle')).toBeTruthy();
      expect(screen.getByTestId('control-frame-checkbox')).toBeTruthy();
    });

    it('shows control frames by default', () => {
      const msgs = [
        makeFrame({ id: 'text-1', type: 'text', data: 'hello' }),
        makeFrame({ id: 'ping-1', type: 'ping', data: '' }),
        makeFrame({ id: 'pong-1', type: 'pong', data: '' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 3 })} />);
      const rows = screen.getAllByRole('button', { name: /message/ });
      expect(rows.length).toBe(3);
    });

    it('hides control frames when toggle is unchecked', async () => {
      const msgs = [
        makeFrame({ id: 'text-1', type: 'text', data: 'hello' }),
        makeFrame({ id: 'ping-1', type: 'ping', data: '' }),
        makeFrame({ id: 'close-1', type: 'close', data: '' }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 3 })} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('control-frame-checkbox'));
      });

      const rows = screen.getAllByRole('button', { name: /message/ });
      expect(rows.length).toBe(1); // Only the text message remains
    });

    it('hides protocol system packets when toggle is unchecked', async () => {
      const msgs = [
        makeFrame({ id: 'text-1', type: 'text', data: '42["msg","hi"]', protocolMeta: {
          protocol: 'socket-io', packetType: 'EVENT', summary: 'EVENT: msg', isSystemPacket: false,
        } }),
        makeFrame({ id: 'sio-ping', type: 'text', data: '2', protocolMeta: {
          protocol: 'socket-io', packetType: 'PING', summary: 'PING', isSystemPacket: true,
        } }),
        makeFrame({ id: 'sio-pong', type: 'text', data: '3', protocolMeta: {
          protocol: 'socket-io', packetType: 'PONG', summary: 'PONG', isSystemPacket: true,
        } }),
      ];
      render(<WebSocketMessageLog {...defaultProps({ messages: msgs, totalCount: 3 })} />);

      // All 3 visible by default
      expect(screen.getAllByRole('button', { name: /message/ }).length).toBe(3);

      await act(async () => {
        fireEvent.click(screen.getByTestId('control-frame-checkbox'));
      });

      // Only the non-system EVENT remains
      const rows = screen.getAllByRole('button', { name: /message/ });
      expect(rows.length).toBe(1);
      expect(screen.getByTestId('message-row-text-1')).toBeTruthy();
    });
  });
});

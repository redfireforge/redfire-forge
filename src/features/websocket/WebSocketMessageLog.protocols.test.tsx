/**
 * @vitest-environment jsdom
 * WebSocketMessageLog — Socket.IO, STOMP, GraphQL-WS protocol modes
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption, isCustomSelectDisabled } from '@test-utils/customSelectHelper';
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
      selectOption(screen.getByTestId('stomp-command'), 'DISCONNECT');
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('requires destination for SUBSCRIBE', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      selectOption(screen.getByTestId('stomp-command'), 'SUBSCRIBE');
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

      selectOption(screen.getByTestId('stomp-command'), 'DISCONNECT');
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('DISCONNECT\n');
      expect(sent.endsWith('\n\0')).toBe(true);
    });

    it('sends CONNECT with accept-version header', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      selectOption(screen.getByTestId('stomp-command'), 'CONNECT');
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

      selectOption(screen.getByTestId('stomp-command'), 'SUBSCRIBE');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: '/topic/news' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('SUBSCRIBE\n');
      expect(sent).toContain('destination:/topic/news\n');
      expect(sent).toMatch(/id:sub-\d+/);
    });

    it('disables inputs when not connected', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp', isConnected: false })} />);
      expect(isCustomSelectDisabled(screen.getByTestId('stomp-command'))).toBe(true);
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).disabled).toBe(true);
    });

    it('sends UNSUBSCRIBE with id header (not destination)', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      selectOption(screen.getByTestId('stomp-command'), 'UNSUBSCRIBE');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'sub-0' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('UNSUBSCRIBE\n');
      expect(sent).toContain('id:sub-0\n');
      expect(sent).not.toContain('destination:');
    });

    it('requires input for UNSUBSCRIBE', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      selectOption(screen.getByTestId('stomp-command'), 'UNSUBSCRIBE');
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'sub-0' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends ACK with id header (not destination)', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      selectOption(screen.getByTestId('stomp-command'), 'ACK');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-42' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('ACK\n');
      expect(sent).toContain('id:msg-42\n');
      expect(sent).not.toContain('destination:');
    });

    it('requires input for ACK', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);
      selectOption(screen.getByTestId('stomp-command'), 'ACK');
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-1' } });
      expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends NACK with id header (not destination)', () => {
      const props = defaultProps({ effectiveProtocol: 'stomp' });
      render(<WebSocketMessageLog {...props} />);

      selectOption(screen.getByTestId('stomp-command'), 'NACK');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-99' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = props.onSend.mock.calls[0][0] as string;
      expect(sent).toContain('NACK\n');
      expect(sent).toContain('id:msg-99\n');
      expect(sent).not.toContain('destination:');
    });

    it('shows correct placeholder for UNSUBSCRIBE/ACK/NACK', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'stomp' })} />);

      selectOption(screen.getByTestId('stomp-command'), 'UNSUBSCRIBE');
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).placeholder).toContain('ID');

      selectOption(screen.getByTestId('stomp-command'), 'ACK');
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).placeholder).toContain('ID');

      selectOption(screen.getByTestId('stomp-command'), 'NACK');
      expect((screen.getByTestId('stomp-destination') as HTMLInputElement).placeholder).toContain('ID');
    });
  });

  describe('GraphQL-WS compose mode', () => {
    it('shows GraphQL compose fields when effectiveProtocol is graphql-ws', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect(screen.getByTestId('gql-compose-fields')).toBeTruthy();
      expect(screen.getByTestId('gql-op-id')).toBeTruthy();
      // Variables panel is in a tab — switch to it before asserting
      fireEvent.click(screen.getByRole('tab', { name: /variables/i }));
      expect(screen.getByTestId('gql-variables')).toBeTruthy();
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
      expect(screen.getByTestId('gql-mode-badge').textContent).toBe('GraphQL-WS');
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

      // Switch to Variables tab before editing
      fireEvent.click(screen.getByRole('tab', { name: /variables/i }));
      fireEvent.change(screen.getByTestId('gql-variables'), { target: { value: '{"id": "5"}' } });
      // Switch back to Query tab to set message and send
      fireEvent.click(screen.getByRole('tab', { name: /^query$/i }));
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'query GetUser($id: ID!) { user(id: $id) { name } }' } });
      fireEvent.click(screen.getByTestId('send-btn'));

      const sent = JSON.parse(props.onSend.mock.calls[0][0] as string);
      expect(sent.payload.variables).toEqual({ id: '5' });
    });

    it('displays operation ID counter', () => {
      render(<WebSocketMessageLog {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
      expect(screen.getByTestId('gql-op-id').textContent).toBe('#1');
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

});

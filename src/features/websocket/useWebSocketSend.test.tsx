/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../test-utils/customSelectHelper';
import '@testing-library/jest-dom/vitest';
import { useWebSocketSend, type UseWebSocketSendOptions } from './useWebSocketSend';

function makeDefaultOptions(overrides: Partial<UseWebSocketSendOptions> = {}): UseWebSocketSendOptions {
  return {
    isConnected: true,
    onSend: vi.fn(),
    onPing: vi.fn(),
    templates: [],
    onSaveTemplate: vi.fn().mockResolvedValue(undefined),
    onDeleteTemplate: vi.fn().mockResolvedValue(undefined),
    onLoadTemplate: vi.fn().mockReturnValue(null),
    transportMode: 'proxy',
    totalCount: 5,
    maxMessages: 100,
    ...overrides,
  };
}

/** Helper that renders the hook and also renders the composeBar JSX for interactive testing */
function renderCompose(options: Partial<UseWebSocketSendOptions> = {}) {
  const opts = makeDefaultOptions(options);
  function Wrapper() {
    const result = useWebSocketSend(opts);
    return <div data-testid="compose-container">{result.composeBar}</div>;
  }
  const rendered = render(<Wrapper />);
  return { ...rendered, opts };
}

describe('useWebSocketSend', () => {
  describe('initial state', () => {
    it('returns empty compose text and text format', () => {
      const { result } = renderHook(() => useWebSocketSend(makeDefaultOptions()));
      expect(result.current.composeText).toBe('');
      expect(result.current.composeFormat).toBe('text');
      expect(result.current.isJsonValid).toBe(false);
      expect(result.current.isBase64Invalid).toBe(false);
    });

    it('renders a compose bar node', () => {
      const { result } = renderHook(() => useWebSocketSend(makeDefaultOptions()));
      expect(result.current.composeBar).not.toBeNull();
    });
  });

  describe('compose bar rendering', () => {
    it('shows message input and send button', () => {
      renderCompose();
      expect(screen.getByLabelText('Message input')).toBeInTheDocument();
      expect(screen.getByTestId('send-btn')).toBeInTheDocument();
    });

    it('shows format pills when no protocol mode', () => {
      renderCompose();
      expect(screen.getByTestId('format-pills')).toBeInTheDocument();
      expect(screen.getByTestId('format-pill-text')).toBeInTheDocument();
      expect(screen.getByTestId('format-pill-json')).toBeInTheDocument();
      expect(screen.getByTestId('format-pill-binary')).toBeInTheDocument();
    });

    it('shows message count in footer', () => {
      renderCompose({ totalCount: 42, maxMessages: 200 });
      expect(screen.getByTestId('compose-footer')).toHaveTextContent('42 / 200');
    });

    it('disables input when disconnected', () => {
      renderCompose({ isConnected: false });
      expect(screen.getByLabelText('Message input')).toBeDisabled();
    });

    it('shows ping button', () => {
      renderCompose({ transportMode: 'proxy' });
      expect(screen.getByTestId('ping-btn')).not.toBeDisabled();
    });

    it('disables ping button for direct transport', () => {
      renderCompose({ transportMode: 'direct' });
      expect(screen.getByTestId('ping-btn')).toBeDisabled();
    });
  });

  describe('send behavior', () => {
    it('sends text message on button click', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'hello world' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledWith('hello world', 'text');
    });

    it('sends on Cmd+Enter', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'msg' } });
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
      expect(onSend).toHaveBeenCalledWith('msg', 'text');
    });

    it('sends on Ctrl+Enter', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'msg' } });
      fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
      expect(onSend).toHaveBeenCalledWith('msg', 'text');
    });

    it('does not send when disconnected', () => {
      const onSend = vi.fn();
      renderCompose({ isConnected: false, onSend });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not send empty text', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('keeps input after sending so the message can be re-sent', () => {
      renderCompose();
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'msg' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(input).toHaveValue('msg');
    });
  });

  describe('format selection', () => {
    it('switches format to json via pill', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('format-pill-json'));
      expect(screen.getByTestId('format-pill-json')).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows beautify button for json format', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('format-pill-json'));
      expect(screen.getByTestId('pretty-format-btn')).toBeInTheDocument();
    });

    it('beautify formats valid JSON', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('format-pill-json'));
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: '{"a":1}' } });
      fireEvent.click(screen.getByTestId('pretty-format-btn'));
      expect(input).toHaveValue('{\n  "a": 1\n}');
    });

    it('shows base64 invalid hint for binary format with bad data', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'not valid base64!!!' } });
      expect(screen.getByTestId('base64-hint')).toHaveTextContent('Invalid Base64');
    });

    it('does not send invalid base64 in binary mode', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: '!!!invalid' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('sends valid base64 in binary mode', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      fireEvent.click(screen.getByTestId('format-pill-binary'));
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'aGVsbG8=' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledWith('aGVsbG8=', 'binary');
    });
  });

  describe('Socket.IO mode', () => {
    it('shows sio compose fields', () => {
      renderCompose({ effectiveProtocol: 'socket-io' });
      expect(screen.getByTestId('sio-compose-fields')).toBeInTheDocument();
      expect(screen.getByTestId('sio-event-name')).toBeInTheDocument();
      expect(screen.getByTestId('sio-namespace')).toBeInTheDocument();
    });

    it('shows Socket.IO badge', () => {
      renderCompose({ effectiveProtocol: 'socket-io' });
      expect(screen.getByTestId('sio-mode-badge')).toHaveTextContent('Socket.IO');
    });

    it('disables send when event name is empty', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'socket-io', onSend });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: '{"key": "val"}' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('sends encoded socket.io event', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'socket-io', onSend });
      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'chat' } });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: '{"msg":"hi"}' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledTimes(1);
      const encoded = onSend.mock.calls[0][0];
      expect(encoded).toContain('chat');
    });
  });

  describe('STOMP mode', () => {
    it('shows stomp compose fields', () => {
      renderCompose({ effectiveProtocol: 'stomp' });
      expect(screen.getByTestId('stomp-compose-fields')).toBeInTheDocument();
      expect(screen.getByTestId('stomp-command')).toBeInTheDocument();
      expect(screen.getByTestId('stomp-destination')).toBeInTheDocument();
    });

    it('shows STOMP badge', () => {
      renderCompose({ effectiveProtocol: 'stomp' });
      expect(screen.getByTestId('stomp-mode-badge')).toHaveTextContent('STOMP');
    });

    it('sends encoded STOMP SEND frame', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'stomp', onSend });
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: '/topic/test' } });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'body text' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledTimes(1);
      const encoded = onSend.mock.calls[0][0];
      expect(encoded).toContain('SEND');
      expect(encoded).toContain('/topic/test');
    });

    it('allows DISCONNECT without destination', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'stomp', onSend });
      selectOption(screen.getByTestId('stomp-command'), 'DISCONNECT');
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('GraphQL mode', () => {
    it('shows graphql compose fields', () => {
      renderCompose({ effectiveProtocol: 'graphql-ws' });
      expect(screen.getByTestId('gql-compose-fields')).toBeInTheDocument();
      expect(screen.getByTestId('gql-operation-name')).toBeInTheDocument();
      expect(screen.getByTestId('gql-op-id')).toHaveTextContent('#1');
      // Variables editor is in the Variables tab — click to show it
      fireEvent.click(screen.getByRole('tab', { name: /variables/i }));
      expect(screen.getByTestId('gql-variables')).toBeInTheDocument();
    });

    it('shows GraphQL badge', () => {
      renderCompose({ effectiveProtocol: 'graphql-ws' });
      expect(screen.getByTestId('gql-mode-badge')).toHaveTextContent('GraphQL-WS');
    });

    it('sends graphql subscription', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'graphql-ws', onSend });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'subscription { onMsg { id } }' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(onSend.mock.calls[0][0]);
      expect(payload.type).toBe('subscribe');
      expect(payload.payload.query).toBe('subscription { onMsg { id } }');
    });

    it('increments operation id after each send', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'graphql-ws', onSend });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'query { a }' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      // After first send, op id should now be 2
      expect(screen.getByTestId('gql-op-id')).toHaveTextContent('#2');
    });
  });

  describe('templates', () => {
    it('shows template trigger button', () => {
      renderCompose();
      expect(screen.getByTestId('template-trigger')).toBeInTheDocument();
    });

    it('opens template dropdown on click', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-dropdown')).toBeInTheDocument();
    });

    it('shows empty state when no templates', () => {
      renderCompose({ templates: [] });
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-empty')).toHaveTextContent('No saved templates');
    });

    it('lists templates and loads on click', () => {
      const tpl = { id: 't1', name: 'My Template', body: '{"test": true}', format: 'json' as const };
      const onLoadTemplate = vi.fn().mockReturnValue({ body: tpl.body, format: tpl.format });
      renderCompose({ templates: [tpl], onLoadTemplate });
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-list')).toBeInTheDocument();
      fireEvent.click(screen.getByText('My Template'));
      expect(onLoadTemplate).toHaveBeenCalledWith('t1');
      expect(screen.getByLabelText('Message input')).toHaveValue('{"test": true}');
    });

    it('deletes template on delete button click', () => {
      const tpl = { id: 't1', name: 'Del Me', body: 'body', format: 'text' as const };
      const onDeleteTemplate = vi.fn().mockResolvedValue(undefined);
      renderCompose({ templates: [tpl], onDeleteTemplate });
      fireEvent.click(screen.getByTestId('template-trigger'));
      fireEvent.click(screen.getByTestId('template-delete-t1'));
      expect(onDeleteTemplate).toHaveBeenCalledWith('t1');
    });

    it('saves template with name and body', async () => {
      const onSaveTemplate = vi.fn().mockResolvedValue(undefined);
      renderCompose({ onSaveTemplate });
      // Type message first
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'save me' } });
      // Open dropdown
      fireEvent.click(screen.getByTestId('template-trigger'));
      // Type template name
      fireEvent.change(screen.getByTestId('template-save-name'), { target: { value: 'Saved One' } });
      fireEvent.click(screen.getByTestId('template-save-btn'));
      expect(onSaveTemplate).toHaveBeenCalledWith('Saved One', 'save me', 'text');
    });

    it('disables save when no name or body', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-save-btn')).toBeDisabled();
    });
  });

  describe('ping', () => {
    it('calls onPing when clicked', () => {
      const onPing = vi.fn();
      renderCompose({ onPing });
      fireEvent.click(screen.getByTestId('ping-btn'));
      expect(onPing).toHaveBeenCalledTimes(1);
    });
  });

  describe('compose utilities', () => {
    it('clears compose text via clear button', () => {
      renderCompose();
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'draft text' } });
      fireEvent.click(screen.getByTestId('compose-clear-btn'));
      expect(input).toHaveValue('');
    });

    it('shows line and character count when text is present', () => {
      const { container } = renderCompose();
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'ab\ncd' } });
      const counter = container.querySelector('.ws-compose-char-count');
      expect(counter?.textContent).toBe('2L · 5c');
    });
  });

  describe('Socket.IO extended', () => {
    it('sends plain-text payload when JSON parse fails', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'socket-io', onSend });
      fireEvent.change(screen.getByTestId('sio-event-name'), { target: { value: 'chat' } });
      fireEvent.change(screen.getByTestId('sio-namespace'), { target: { value: '/admin' } });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'not-json' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend.mock.calls[0][0]).toContain('chat');
    });
  });

  describe('STOMP extended', () => {
    it('sends CONNECT with login and passcode', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'stomp', onSend });
      selectOption(screen.getByTestId('stomp-command'), 'CONNECT');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'localhost' } });
      fireEvent.change(screen.getByTestId('stomp-login'), { target: { value: 'guest' } });
      fireEvent.change(screen.getByTestId('stomp-passcode'), { target: { value: 'secret' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      const encoded = onSend.mock.calls[0][0] as string;
      expect(encoded).toContain('CONNECT');
      expect(encoded).toContain('login');
      expect(encoded).toContain('passcode');
    });

    it('stacks CONNECT login/passcode and toggles passcode visibility', () => {
      renderCompose({ effectiveProtocol: 'stomp' });
      selectOption(screen.getByTestId('stomp-command'), 'CONNECT');
      const fields = screen.getByTestId('stomp-compose-fields');
      expect(fields.className).toContain('ws-stomp-compose-fields--auth');
      expect(screen.getByLabelText('STOMP login')).toBeInTheDocument();
      const passcode = screen.getByTestId('stomp-passcode');
      expect(passcode).toHaveAttribute('type', 'password');
      fireEvent.click(screen.getByTestId('stomp-passcode-toggle'));
      expect(passcode).toHaveAttribute('type', 'text');
      fireEvent.click(screen.getByTestId('stomp-passcode-toggle'));
      expect(passcode).toHaveAttribute('type', 'password');
    });

    it('sends SUBSCRIBE frame with destination', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'stomp', onSend });
      selectOption(screen.getByTestId('stomp-command'), 'SUBSCRIBE');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: '/topic/news' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend.mock.calls[0][0]).toContain('SUBSCRIBE');
    });

    it('sends UNSUBSCRIBE with subscription id', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'stomp', onSend });
      selectOption(screen.getByTestId('stomp-command'), 'UNSUBSCRIBE');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'sub-0' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend.mock.calls[0][0]).toContain('UNSUBSCRIBE');
    });

    it('sends ACK with message id', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'stomp', onSend });
      selectOption(screen.getByTestId('stomp-command'), 'ACK');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-42' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend.mock.calls[0][0]).toContain('ACK');
    });

    it('sends NACK with message id', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'stomp', onSend });
      selectOption(screen.getByTestId('stomp-command'), 'NACK');
      fireEvent.change(screen.getByTestId('stomp-destination'), { target: { value: 'msg-99' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend.mock.calls[0][0]).toContain('NACK');
    });
  });

  describe('GraphQL extended', () => {
    it('sends subscription with variables and operation name', () => {
      const onSend = vi.fn();
      renderCompose({ effectiveProtocol: 'graphql-ws', onSend });
      fireEvent.change(screen.getByTestId('gql-operation-name'), { target: { value: 'OnMsg' } });
      // Switch to Variables tab to fill variables, then back to Query to send
      fireEvent.click(screen.getByRole('tab', { name: /variables/i }));
      fireEvent.change(screen.getByTestId('gql-variables'), { target: { value: '{"id":"1"}' } });
      fireEvent.click(screen.getByRole('tab', { name: /query/i }));
      fireEvent.change(screen.getByLabelText('Message input'), {
        target: { value: 'subscription { onMsg { id } }' },
      });
      fireEvent.click(screen.getByTestId('send-btn'));
      const payload = JSON.parse(onSend.mock.calls[0][0] as string);
      expect(payload.payload.variables).toEqual({ id: '1' });
      expect(payload.payload.operationName).toBe('OnMsg');
      // Valid JSON indicator visible in Variables tab label
      expect(screen.getByLabelText('Valid JSON')).toBeInTheDocument();
    });

    it('shows invalid JSON indicator for bad variables', () => {
      renderCompose({ effectiveProtocol: 'graphql-ws' });
      fireEvent.click(screen.getByRole('tab', { name: /variables/i }));
      fireEvent.change(screen.getByTestId('gql-variables'), { target: { value: '{bad' } });
      expect(screen.getByLabelText('Invalid JSON')).toBeInTheDocument();
    });
  });

  describe('template modal', () => {
    it('closes on Escape key', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByTestId('template-dropdown')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('template-dropdown')).not.toBeInTheDocument();
    });

    it('closes when clicking the overlay backdrop', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('template-trigger'));
      fireEvent.click(screen.getByTestId('template-dropdown'));
      expect(screen.queryByTestId('template-dropdown')).not.toBeInTheDocument();
    });

    it('closes via the header close button', () => {
      renderCompose();
      fireEvent.click(screen.getByTestId('template-trigger'));
      fireEvent.click(screen.getByRole('button', { name: 'Close message templates' }));
      expect(screen.queryByTestId('template-dropdown')).not.toBeInTheDocument();
    });

    it('does not load template when onLoadTemplate returns null', () => {
      const tpl = { id: 't1', name: 'Ghost', body: 'x', format: 'text' as const };
      const onLoadTemplate = vi.fn().mockReturnValue(null);
      renderCompose({ templates: [tpl], onLoadTemplate });
      fireEvent.click(screen.getByTestId('template-trigger'));
      fireEvent.click(screen.getByText('Ghost'));
      expect(onLoadTemplate).toHaveBeenCalledWith('t1');
      expect(screen.getByLabelText('Message input')).toHaveValue('');
    });

    it('truncates long template preview in the list', () => {
      const longBody = 'x'.repeat(150);
      const tpl = { id: 'long', name: 'Long', body: longBody, format: 'text' as const };
      renderCompose({ templates: [tpl] });
      fireEvent.click(screen.getByTestId('template-trigger'));
      expect(screen.getByText(`${'x'.repeat(120)}…`)).toBeInTheDocument();
    });

    it('saves template when Enter is pressed in name field', async () => {
      const onSaveTemplate = vi.fn().mockResolvedValue(undefined);
      renderCompose({ onSaveTemplate });
      fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'payload' } });
      fireEvent.click(screen.getByTestId('template-trigger'));
      const nameInput = screen.getByTestId('template-save-name');
      fireEvent.change(nameInput, { target: { value: 'Enter Save' } });
      fireEvent.keyDown(nameInput, { key: 'Enter' });
      expect(onSaveTemplate).toHaveBeenCalledWith('Enter Save', 'payload', 'text');
    });
  });
});


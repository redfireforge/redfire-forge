/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useWebSocketCompose, type UseWebSocketComposeOptions } from './useWebSocketCompose';

function makeDefaultOptions(overrides: Partial<UseWebSocketComposeOptions> = {}): UseWebSocketComposeOptions {
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
function renderCompose(options: Partial<UseWebSocketComposeOptions> = {}) {
  const opts = makeDefaultOptions(options);
  function Wrapper() {
    const result = useWebSocketCompose(opts);
    return <div data-testid="compose-container">{result.composeBar}</div>;
  }
  const rendered = render(<Wrapper />);
  return { ...rendered, opts };
}

describe('useWebSocketCompose', () => {
  describe('initial state', () => {
    it('returns empty compose text and text format', () => {
      const { result } = renderHook(() => useWebSocketCompose(makeDefaultOptions()));
      expect(result.current.composeText).toBe('');
      expect(result.current.composeFormat).toBe('text');
      expect(result.current.isJsonValid).toBe(false);
      expect(result.current.isBase64Invalid).toBe(false);
    });

    it('renders a compose bar node', () => {
      const { result } = renderHook(() => useWebSocketCompose(makeDefaultOptions()));
      expect(result.current.composeBar).not.toBeNull();
    });
  });

  describe('compose bar rendering', () => {
    it('shows message input and send button', () => {
      renderCompose();
      expect(screen.getByLabelText('Message input')).toBeInTheDocument();
      expect(screen.getByTestId('send-btn')).toBeInTheDocument();
    });

    it('shows format select when no protocol mode', () => {
      renderCompose();
      expect(screen.getByTestId('format-select')).toBeInTheDocument();
    });

    it('shows message count in footer', () => {
      renderCompose({ totalCount: 42, maxMessages: 200 });
      expect(screen.getByTestId('compose-footer')).toHaveTextContent('42 / 200 messages');
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

    it('clears input after sending', () => {
      renderCompose();
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'msg' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(input).toHaveValue('');
    });
  });

  describe('format selection', () => {
    it('switches format to json', () => {
      renderCompose();
      const select = screen.getByTestId('format-select');
      fireEvent.change(select, { target: { value: 'json' } });
      expect(select).toHaveValue('json');
    });

    it('shows beautify button for json format', () => {
      renderCompose();
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'json' } });
      expect(screen.getByTestId('beautify-btn')).toBeInTheDocument();
    });

    it('beautify formats valid JSON', () => {
      renderCompose();
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'json' } });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: '{"a":1}' } });
      fireEvent.click(screen.getByTestId('beautify-btn'));
      expect(input).toHaveValue('{\n  "a": 1\n}');
    });

    it('shows base64 invalid hint for binary format with bad data', () => {
      renderCompose();
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: 'not valid base64!!!' } });
      expect(screen.getByTestId('base64-hint')).toHaveTextContent('Invalid Base64');
    });

    it('does not send invalid base64 in binary mode', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
      const input = screen.getByLabelText('Message input');
      fireEvent.change(input, { target: { value: '!!!invalid' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('sends valid base64 in binary mode', () => {
      const onSend = vi.fn();
      renderCompose({ onSend });
      fireEvent.change(screen.getByTestId('format-select'), { target: { value: 'binary' } });
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
      fireEvent.change(screen.getByTestId('stomp-command'), { target: { value: 'DISCONNECT' } });
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(onSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('GraphQL mode', () => {
    it('shows graphql compose fields', () => {
      renderCompose({ effectiveProtocol: 'graphql-ws' });
      expect(screen.getByTestId('gql-compose-fields')).toBeInTheDocument();
      expect(screen.getByTestId('gql-operation-name')).toBeInTheDocument();
      expect(screen.getByTestId('gql-variables')).toBeInTheDocument();
      expect(screen.getByTestId('gql-op-id')).toHaveTextContent('Op #1');
    });

    it('shows GraphQL badge', () => {
      renderCompose({ effectiveProtocol: 'graphql-ws' });
      expect(screen.getByTestId('gql-mode-badge')).toHaveTextContent('GraphQL');
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
      expect(screen.getByTestId('gql-op-id')).toHaveTextContent('Op #2');
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
});

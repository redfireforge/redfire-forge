/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketSendPane, type WebSocketSendPaneProps } from './WebSocketSendPane';
import type { WsMessageTemplate } from '../../shared/websocket/types';

function defaultProps(overrides?: Partial<WebSocketSendPaneProps>): WebSocketSendPaneProps {
  return {
    isConnected: true,
    onSend: vi.fn(),
    onPing: vi.fn(),
    templates: [] as WsMessageTemplate[],
    onSaveTemplate: vi.fn().mockResolvedValue(undefined),
    onDeleteTemplate: vi.fn().mockResolvedValue(undefined),
    onLoadTemplate: vi.fn().mockReturnValue(null),
    transportMode: 'proxy',
    totalCount: 0,
    maxMessages: 1000,
    ...overrides,
  };
}

describe('WebSocketSendPane', () => {
  it('renders the composer (send + ping + input)', () => {
    render(<WebSocketSendPane {...defaultProps()} />);
    expect(screen.getByTestId('send-btn')).toBeTruthy();
    expect(screen.getByTestId('ping-btn')).toBeTruthy();
    expect(screen.getByLabelText('Message input')).toBeTruthy();
  });

  it('renders nothing when hidden', () => {
    const { container } = render(<WebSocketSendPane {...defaultProps({ hidden: true })} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('send-btn')).toBeNull();
  });

  it('sends the composed message via onSend', () => {
    const onSend = vi.fn();
    render(<WebSocketSendPane {...defaultProps({ onSend })} />);
    fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(onSend).toHaveBeenCalledWith('hello', 'text');
  });

  it('sends on Cmd+Enter', () => {
    const onSend = vi.fn();
    render(<WebSocketSendPane {...defaultProps({ onSend })} />);
    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: 'hi' } });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    expect(onSend).toHaveBeenCalledWith('hi', 'text');
  });

  it('triggers ping via onPing', () => {
    const onPing = vi.fn();
    render(<WebSocketSendPane {...defaultProps({ onPing })} />);
    fireEvent.click(screen.getByTestId('ping-btn'));
    expect(onPing).toHaveBeenCalled();
  });

  it('disables send when not connected', () => {
    render(<WebSocketSendPane {...defaultProps({ isConnected: false })} />);
    expect((screen.getByTestId('send-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the Socket.IO protocol composer fields', () => {
    render(<WebSocketSendPane {...defaultProps({ effectiveProtocol: 'socket-io' })} />);
    expect(screen.getByTestId('sio-compose-fields')).toBeTruthy();
  });

  it('shows the STOMP protocol composer fields', () => {
    render(<WebSocketSendPane {...defaultProps({ effectiveProtocol: 'stomp' })} />);
    expect(screen.getByTestId('stomp-compose-fields')).toBeTruthy();
  });

  it('shows the GraphQL-WS protocol composer fields', () => {
    render(<WebSocketSendPane {...defaultProps({ effectiveProtocol: 'graphql-ws' })} />);
    expect(screen.getByTestId('gql-compose-fields')).toBeTruthy();
  });

  it('exposes the templates dropdown trigger', () => {
    render(<WebSocketSendPane {...defaultProps()} />);
    expect(screen.getByTestId('template-trigger')).toBeTruthy();
  });
});

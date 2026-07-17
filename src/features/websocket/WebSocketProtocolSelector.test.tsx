/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketProtocolSelector } from './WebSocketProtocolSelector';
import type { WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';

describe('WebSocketProtocolSelector', () => {
  const defaultProps = {
    protocolMode: 'auto' as const,
    onProtocolModeChange: vi.fn(),
    detectedProtocol: null as WsProtocolDetectionResult | null,
    disabled: false,
  };

  it('renders the protocol select dropdown', () => {
    render(<WebSocketProtocolSelector {...defaultProps} />);
    expect(screen.getByTestId('protocol-select')).toBeTruthy();
  });

  it('shows all protocol options', () => {
    render(<WebSocketProtocolSelector {...defaultProps} />);
    const select = screen.getByTestId('protocol-select') as HTMLSelectElement;
    const options = Array.from(select.options);
    expect(options).toHaveLength(5);
    expect(options[0].textContent).toBe('Auto-detect');
    expect(options[1].textContent).toBe('Raw');
    expect(options[2].textContent).toContain('Socket.IO');
    expect(options[3].textContent).toContain('STOMP');
    expect(options[4].textContent).toContain('GraphQL-WS');
  });

  it('has no protocols marked as coming soon (all available)', () => {
    render(<WebSocketProtocolSelector {...defaultProps} />);
    const select = screen.getByTestId('protocol-select') as HTMLSelectElement;
    const options = Array.from(select.options);
    for (const opt of options) {
      expect(opt.textContent).not.toContain('(coming soon)');
    }
  });

  it('all protocol options are enabled', () => {
    render(<WebSocketProtocolSelector {...defaultProps} />);
    const select = screen.getByTestId('protocol-select') as HTMLSelectElement;
    const options = Array.from(select.options);
    expect(options[0].disabled).toBe(false); // auto
    expect(options[1].disabled).toBe(false); // raw
    expect(options[2].disabled).toBe(false); // socket-io
    expect(options[3].disabled).toBe(false); // stomp
    expect(options[4].disabled).toBe(false); // graphql-ws
  });

  it('reflects the current protocolMode value', () => {
    render(<WebSocketProtocolSelector {...defaultProps} protocolMode="raw" />);
    const select = screen.getByTestId('protocol-select') as HTMLSelectElement;
    expect(select.value).toBe('raw');
  });

  it('calls onProtocolModeChange when selection changes', () => {
    const onChange = vi.fn();
    render(<WebSocketProtocolSelector {...defaultProps} onProtocolModeChange={onChange} />);
    fireEvent.change(screen.getByTestId('protocol-select'), { target: { value: 'raw' } });
    expect(onChange).toHaveBeenCalledWith('raw');
  });

  it('disables the select when disabled prop is true', () => {
    render(<WebSocketProtocolSelector {...defaultProps} disabled={true} />);
    expect((screen.getByTestId('protocol-select') as HTMLSelectElement).disabled).toBe(true);
  });

  it('does not show detected badge when no detection result', () => {
    render(<WebSocketProtocolSelector {...defaultProps} />);
    expect(screen.queryByTestId('protocol-detected-badge')).toBeNull();
  });

  it('shows detected badge when auto mode and detection result exists', () => {
    const detected: WsProtocolDetectionResult = {
      protocol: 'stomp',
      confidence: 'high',
      reason: 'Subprotocol matches STOMP',
    };
    render(
      <WebSocketProtocolSelector
        {...defaultProps}
        protocolMode="auto"
        detectedProtocol={detected}
      />,
    );
    const badge = screen.getByTestId('protocol-detected-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('STOMP');
  });

  it('does not show detected badge when mode is manual (not auto)', () => {
    const detected: WsProtocolDetectionResult = {
      protocol: 'stomp',
      confidence: 'high',
      reason: 'test',
    };
    render(
      <WebSocketProtocolSelector
        {...defaultProps}
        protocolMode="raw"
        detectedProtocol={detected}
      />,
    );
    expect(screen.queryByTestId('protocol-detected-badge')).toBeNull();
  });

  it('badge title shows detection reason', () => {
    const detected: WsProtocolDetectionResult = {
      protocol: 'graphql-ws',
      confidence: 'high',
      reason: 'Subprotocol matches graphql-ws',
    };
    render(
      <WebSocketProtocolSelector
        {...defaultProps}
        protocolMode="auto"
        detectedProtocol={detected}
      />,
    );
    const badge = screen.getByTestId('protocol-detected-badge');
    expect(badge.getAttribute('title')).toBe('Subprotocol matches graphql-ws');
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  selectOption,
  getCustomSelectValue,
  getCustomSelectOptionLabels,
  isCustomSelectDisabled,
} from '../../test-utils/customSelectHelper';
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
    const labels = getCustomSelectOptionLabels(screen.getByTestId('protocol-select'));
    expect(labels).toHaveLength(5);
    expect(labels[0]).toBe('Auto-detect');
    expect(labels[1]).toBe('Raw');
    expect(labels[2]).toContain('Socket.IO');
    expect(labels[3]).toContain('STOMP');
    expect(labels[4]).toContain('GraphQL-WS');
  });

  it('has no protocols marked as coming soon (all available)', () => {
    render(<WebSocketProtocolSelector {...defaultProps} />);
    const labels = getCustomSelectOptionLabels(screen.getByTestId('protocol-select'));
    for (const label of labels) {
      expect(label).not.toContain('(coming soon)');
    }
  });

  it('all protocol options are enabled', () => {
    render(<WebSocketProtocolSelector {...defaultProps} />);
    const wrapper = screen.getByTestId('protocol-select');
    fireEvent.click(wrapper.querySelector('.cs-trigger')!);
    // CustomSelect portals its menu to document.body, not into the trigger's wrapper.
    const items = document.querySelectorAll('.cs-menu .cs-item');
    expect(items).toHaveLength(5);
    items.forEach((item) => {
      expect(item.classList.contains('disabled')).toBe(false);
    });
    fireEvent.click(wrapper.querySelector('.cs-trigger')!);
  });

  it('reflects the current protocolMode value', () => {
    render(<WebSocketProtocolSelector {...defaultProps} protocolMode="raw" />);
    expect(getCustomSelectValue(screen.getByTestId('protocol-select'))).toBe('Raw');
  });

  it('calls onProtocolModeChange when selection changes', () => {
    const onChange = vi.fn();
    render(<WebSocketProtocolSelector {...defaultProps} onProtocolModeChange={onChange} />);
    selectOption(screen.getByTestId('protocol-select'), 'Raw');
    expect(onChange).toHaveBeenCalledWith('raw');
  });

  it('disables the select when disabled prop is true', () => {
    render(<WebSocketProtocolSelector {...defaultProps} disabled={true} />);
    expect(isCustomSelectDisabled(screen.getByTestId('protocol-select'))).toBe(true);
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

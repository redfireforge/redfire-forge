/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketTlsPanel } from './WebSocketTlsPanel';
import type { WsTlsConfig } from '../../shared/websocket/types';

function defaultProps(overrides: Partial<Parameters<typeof WebSocketTlsPanel>[0]> = {}) {
  return {
    tlsConfig: { rejectUnauthorized: true } as WsTlsConfig,
    onTlsChange: vi.fn(),
    isWss: true,
    isProxyMode: true,
    ...overrides,
  };
}

describe('WebSocketTlsPanel', () => {
  it('renders nothing when not wss', () => {
    const { container } = render(<WebSocketTlsPanel {...defaultProps({ isWss: false })} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders collapsed toggle for wss URLs', () => {
    render(<WebSocketTlsPanel {...defaultProps()} />);
    expect(screen.getByTestId('tls-toggle')).toBeTruthy();
    expect(screen.queryByTestId('tls-body')).toBeNull();
  });

  it('expands body on toggle click', () => {
    render(<WebSocketTlsPanel {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));
    expect(screen.getByTestId('tls-body')).toBeTruthy();
  });

  it('shows proxy notice when not in proxy mode', () => {
    render(<WebSocketTlsPanel {...defaultProps({ isProxyMode: false })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));
    expect(screen.getByTestId('tls-proxy-notice')).toBeTruthy();
  });

  it('hides proxy notice in proxy mode', () => {
    render(<WebSocketTlsPanel {...defaultProps({ isProxyMode: true })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));
    expect(screen.queryByTestId('tls-proxy-notice')).toBeNull();
  });

  it('shows indicator when TLS has content', () => {
    render(<WebSocketTlsPanel {...defaultProps({ tlsConfig: { rejectUnauthorized: false } })} />);
    expect(screen.getByTestId('tls-indicator')).toBeTruthy();
  });

  it('hides indicator when TLS is default', () => {
    render(<WebSocketTlsPanel {...defaultProps({ tlsConfig: { rejectUnauthorized: true } })} />);
    expect(screen.queryByTestId('tls-indicator')).toBeNull();
  });

  it('calls onTlsChange when toggling skip validation', () => {
    const onChange = vi.fn();
    render(<WebSocketTlsPanel {...defaultProps({ onTlsChange: onChange })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    const checkbox = screen.getByTestId('tls-reject-unauthorized').querySelector('input')!;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ rejectUnauthorized: false });
  });

  it('calls onTlsChange when setting CA cert', () => {
    const onChange = vi.fn();
    render(<WebSocketTlsPanel {...defaultProps({ onTlsChange: onChange })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    fireEvent.change(screen.getByTestId('tls-ca-cert'), { target: { value: 'MY_CA_PEM' } });
    expect(onChange).toHaveBeenCalledWith({ caCert: 'MY_CA_PEM' });
  });

  it('calls onTlsChange with undefined when CA cert is cleared', () => {
    const onChange = vi.fn();
    render(<WebSocketTlsPanel {...defaultProps({ onTlsChange: onChange, tlsConfig: { caCert: 'cert' } })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    fireEvent.change(screen.getByTestId('tls-ca-cert'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ caCert: undefined });
  });

  it('calls onTlsChange when setting client cert', () => {
    const onChange = vi.fn();
    render(<WebSocketTlsPanel {...defaultProps({ onTlsChange: onChange })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    fireEvent.change(screen.getByTestId('tls-client-cert'), { target: { value: 'CLIENT_CERT' } });
    expect(onChange).toHaveBeenCalledWith({ clientCert: 'CLIENT_CERT' });
  });

  it('calls onTlsChange when setting client key', () => {
    const onChange = vi.fn();
    render(<WebSocketTlsPanel {...defaultProps({ onTlsChange: onChange })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    fireEvent.change(screen.getByTestId('tls-client-key'), { target: { value: 'PRIVATE_KEY' } });
    expect(onChange).toHaveBeenCalledWith({ clientKey: 'PRIVATE_KEY' });
  });

  it('displays existing TLS values', () => {
    const config: WsTlsConfig = {
      rejectUnauthorized: false,
      caCert: 'ca-content',
      clientCert: 'cert-content',
      clientKey: 'key-content',
    };
    render(<WebSocketTlsPanel {...defaultProps({ tlsConfig: config })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    expect((screen.getByTestId('tls-ca-cert') as HTMLTextAreaElement).value).toBe('ca-content');
    expect((screen.getByTestId('tls-client-cert') as HTMLTextAreaElement).value).toBe('cert-content');
    expect((screen.getByTestId('tls-client-key') as HTMLTextAreaElement).value).toBe('key-content');
  });
});

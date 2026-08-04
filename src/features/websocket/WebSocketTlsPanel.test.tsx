/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    const notice = screen.getByTestId('tls-proxy-notice');
    expect(notice).toBeTruthy();
    expect(notice.textContent).toContain('In browser Direct mode');
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

    const checkbox = screen.getByTestId('tls-skip-cert').querySelector('input')!;
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

  it('disables all inputs when disabled prop is true', () => {
    render(<WebSocketTlsPanel {...defaultProps({ disabled: true })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    const checkbox = screen.getByTestId('tls-skip-cert').querySelector('input')!;
    expect(checkbox.disabled).toBe(true);
    expect((screen.getByTestId('tls-ca-cert') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId('tls-client-cert') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId('tls-client-key') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('enables all inputs when disabled prop is false', () => {
    render(<WebSocketTlsPanel {...defaultProps({ disabled: false })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    const checkbox = screen.getByTestId('tls-skip-cert').querySelector('input')!;
    expect(checkbox.disabled).toBe(false);
    expect((screen.getByTestId('tls-ca-cert') as HTMLTextAreaElement).disabled).toBe(false);
    expect((screen.getByTestId('tls-client-cert') as HTMLTextAreaElement).disabled).toBe(false);
    expect((screen.getByTestId('tls-client-key') as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('shows Configure label when not disabled and View when disabled', () => {
    const { rerender } = render(<WebSocketTlsPanel {...defaultProps({ disabled: false })} />);
    expect(screen.getByTestId('tls-toggle').textContent).toBe('Configure');

    rerender(<WebSocketTlsPanel {...defaultProps({ disabled: true })} />);
    expect(screen.getByTestId('tls-toggle').textContent).toBe('View');
  });

  it('shows mode badges for skip verify, custom CA, and mTLS', () => {
    const { rerender } = render(
      <WebSocketTlsPanel {...defaultProps({ tlsConfig: { rejectUnauthorized: false } })} />,
    );
    expect(screen.getByTestId('tls-indicator').textContent).toBe('Skip Verify');

    rerender(<WebSocketTlsPanel {...defaultProps({ tlsConfig: { caCert: 'ca' } })} />);
    expect(screen.getByTestId('tls-indicator').textContent).toBe('Custom CA');

    rerender(
      <WebSocketTlsPanel
        {...defaultProps({ tlsConfig: { clientCert: 'cert', clientKey: 'key' } })}
      />,
    );
    expect(screen.getByTestId('tls-indicator').textContent).toBe('mTLS');
  });

  it('shows hint when no TLS content is configured', () => {
    render(<WebSocketTlsPanel {...defaultProps({ tlsConfig: { rejectUnauthorized: true } })} />);
    expect(screen.getByText('No certificates configured')).toBeTruthy();
  });

  it('cancel reverts TLS changes when snapshot exists', () => {
    const onChange = vi.fn();
    render(
      <WebSocketTlsPanel
        {...defaultProps({
          onTlsChange: onChange,
          tlsConfig: { rejectUnauthorized: true, caCert: 'original-ca' },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('tls-toggle'));
    fireEvent.change(screen.getByTestId('tls-ca-cert'), { target: { value: 'changed-ca' } });

    fireEvent.click(screen.getByTestId('tls-cancel'));
    expect(onChange).toHaveBeenLastCalledWith({ rejectUnauthorized: true, caCert: 'original-ca' });
    expect(screen.queryByTestId('tls-body')).toBeNull();
  });

  it('save commits changes and disables save until next edit', async () => {
    const onChange = vi.fn();
    render(<WebSocketTlsPanel {...defaultProps({ onTlsChange: onChange })} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));

    const saveBtn = screen.getByTestId('tls-save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('tls-ca-cert'), { target: { value: 'new-ca' } });
    expect(saveBtn.disabled).toBe(false);

    fireEvent.click(saveBtn);
    // Save closes the modal; after reopening, Save is disabled again until another edit.
    await waitFor(() => expect(screen.queryByTestId('tls-body')).toBeNull());
    fireEvent.click(screen.getByTestId('tls-toggle'));
    expect((screen.getByTestId('tls-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('close button closes modal without reverting', () => {
    render(<WebSocketTlsPanel {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('tls-toggle'));
    expect(screen.getByTestId('tls-body')).toBeTruthy();

    fireEvent.click(screen.getByTestId('tls-close'));
    expect(screen.queryByTestId('tls-body')).toBeNull();
  });

  it('clears client cert and key when textarea is emptied', () => {
    const onChange = vi.fn();
    render(
      <WebSocketTlsPanel
        {...defaultProps({
          onTlsChange: onChange,
          tlsConfig: { clientCert: 'cert', clientKey: 'key' },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('tls-toggle'));

    fireEvent.change(screen.getByTestId('tls-client-cert'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ clientCert: undefined });

    fireEvent.change(screen.getByTestId('tls-client-key'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ clientKey: undefined });
  });
});

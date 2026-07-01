/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcTlsPanel } from './GrpcTlsPanel';

const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;

type PanelProps = ComponentProps<typeof GrpcTlsPanel>;

function openModal(props: PanelProps) {
  const { rerender } = render(<GrpcTlsPanel {...props} openRequest={0} />);
  rerender(<GrpcTlsPanel {...props} openRequest={1} />);
}

describe('GrpcTlsPanel coverage gaps', () => {
  const baseProps: PanelProps = {
    tlsMode: 'disabled',
    issues: [],
    onTlsModeChange: vi.fn(),
    onTlsConfigChange: vi.fn(),
  };

  it('cancel reverts mode and config when onTlsStateRestore is absent', () => {
    const onTlsModeChange = vi.fn();
    const onTlsConfigChange = vi.fn();
    const { rerender } = render(
      <GrpcTlsPanel
        {...baseProps}
        tlsMode="disabled"
        tlsConfig={{ serverCaPem: 'stored' }}
        openRequest={0}
        onTlsModeChange={onTlsModeChange}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    rerender(
      <GrpcTlsPanel
        {...baseProps}
        tlsMode="disabled"
        tlsConfig={{ serverCaPem: 'stored' }}
        openRequest={1}
        onTlsModeChange={onTlsModeChange}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    rerender(
      <GrpcTlsPanel
        {...baseProps}
        tlsMode="tls"
        tlsConfig={{ serverCaPem: 'stored' }}
        openRequest={1}
        onTlsModeChange={onTlsModeChange}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-cancel'));
    expect(onTlsModeChange).toHaveBeenCalledWith('disabled');
    expect(onTlsConfigChange).toHaveBeenCalledWith({ serverCaPem: 'stored' });
  });

  it('cancel only patches config when mode unchanged and onTlsStateRestore absent', () => {
    const onTlsModeChange = vi.fn();
    const onTlsConfigChange = vi.fn();
    const { rerender } = render(
      <GrpcTlsPanel
        {...baseProps}
        tlsMode="tls"
        tlsConfig={undefined}
        openRequest={0}
        onTlsModeChange={onTlsModeChange}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    rerender(
      <GrpcTlsPanel
        {...baseProps}
        tlsMode="tls"
        tlsConfig={undefined}
        openRequest={1}
        onTlsModeChange={onTlsModeChange}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-tls-server-ca'), { target: { value: VALID_CERT } });
    rerender(
      <GrpcTlsPanel
        {...baseProps}
        tlsMode="tls"
        tlsConfig={{ serverCaPem: VALID_CERT }}
        openRequest={1}
        onTlsModeChange={onTlsModeChange}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-cancel'));
    expect(onTlsModeChange).not.toHaveBeenCalled();
    expect(onTlsConfigChange).toHaveBeenCalledWith({});
  });

  it('shows plaintext success on test connection in disabled mode', () => {
    openModal({ ...baseProps, tlsMode: 'disabled' });
    fireEvent.click(screen.getByTestId('grpc-tls-test'));
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/Plaintext mode/i);
  });

  it('shows TLS validation success for valid tls configuration', () => {
    openModal({
      ...baseProps,
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: VALID_CERT },
    });
    fireEvent.click(screen.getByTestId('grpc-tls-test'));
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/passed local validation/i);
  });

  it('invokes unmask and clear secret field callbacks from modal', async () => {
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    openModal({
      ...baseProps,
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: 'stored' },
      maskedSecretFields: { serverCaPem: true },
      onUnmaskSecretField,
      onClearSecretField,
    });
    fireEvent.click(screen.getByTestId('grpc-tls-server-ca-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('serverCaPem');
    fireEvent.change(screen.getByTestId('grpc-tls-server-ca'), { target: { value: 'x' } });
    expect(onUnmaskSecretField).toHaveBeenCalledWith('serverCaPem');
  });

  it('disables modal controls when disabled prop is set', () => {
    openModal({ ...baseProps, tlsMode: 'tls', disabled: true });
    expect((screen.getByTestId('grpc-tls-mode-mtls') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-save') as HTMLButtonElement).disabled).toBe(true);
  });
});

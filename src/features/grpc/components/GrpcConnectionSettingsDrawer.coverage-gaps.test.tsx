/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcConnectionSettingsDrawer } from './GrpcConnectionSettingsDrawer';

const emptyPreview = {
  ok: true,
  issues: [],
  conflicts: [],
  previewEntries: [],
};

const defaultProps = {
  open: true,
  activeNav: 'tls' as const,
  tlsMode: 'disabled' as const,
  tlsConfig: undefined,
  tlsIssues: [],
  auth: undefined,
  authPreview: emptyPreview,
  timeoutMs: 30_000,
  compression: undefined,
  healthAvailable: false,
  healthWatchAvailable: false,
  healthProbeReady: true,
  onNavChange: vi.fn(),
  onClose: vi.fn(),
  onTlsModeChange: vi.fn(),
  onTlsConfigChange: vi.fn(),
  onAuthChange: vi.fn(),
  onTimeoutMsChange: vi.fn(),
  onCompressionChange: vi.fn(),
  onHealthCheck: vi.fn(),
  onHealthWatch: vi.fn(),
};

describe('GrpcConnectionSettingsDrawer coverage gaps', () => {
  it('shows plaintext test result for disabled TLS mode', async () => {
    const user = userEvent.setup();
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    await user.click(screen.getByTestId('grpc-tls-test'));
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/Plaintext mode/i);
  });

  it('shows validation errors from test connection for mtls without PEM', async () => {
    const user = userEvent.setup();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        tlsMode="mtls"
      />,
    );
    await user.click(screen.getByTestId('grpc-tls-test'));
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/client cert|TLS|PEM/i);
  });

  it('shows TLS validation success for tls mode with CA PEM', async () => {
    const user = userEvent.setup();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        tlsMode="tls"
        tlsConfig={{ serverCaPem: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----' }}
      />,
    );
    await user.click(screen.getByTestId('grpc-tls-test'));
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/passed local validation/i);
  });

  it('reset defaults clears test result and switches to disabled TLS', async () => {
    const user = userEvent.setup();
    const onTlsModeChange = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        tlsMode="tls"
        onTlsModeChange={onTlsModeChange}
      />,
    );
    await user.click(screen.getByTestId('grpc-tls-test'));
    await user.click(screen.getByTestId('grpc-tls-reset'));
    expect(onTlsModeChange).toHaveBeenCalledWith('disabled');
    expect(screen.queryByTestId('grpc-tls-test-result')).toBeNull();
  });

  it('clears test result when TLS config changes', async () => {
    const user = userEvent.setup();
    const onTlsConfigChange = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        tlsMode="tls"
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    await user.click(screen.getByTestId('grpc-tls-test'));
    await user.type(screen.getByTestId('grpc-tls-server-name'), 'grpc.local');
    expect(onTlsConfigChange).toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-tls-test-result')).toBeNull();
  });

  it('navigates to call and health sections', () => {
    const onNavChange = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onNavChange={onNavChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-settings-nav-call'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    expect(onNavChange).toHaveBeenCalledWith('call');
    expect(onNavChange).toHaveBeenCalledWith('health');
  });

  it('disables nav buttons when drawer is disabled', () => {
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        disabled
      />,
    );
    expect((screen.getByTestId('grpc-settings-nav-auth') as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears test result when drawer closes', () => {
    const { rerender } = render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    fireEvent.click(screen.getByTestId('grpc-tls-test'));
    expect(screen.getByTestId('grpc-tls-test-result')).toBeTruthy();
    rerender(<GrpcConnectionSettingsDrawer {...defaultProps} open={false} />);
    rerender(<GrpcConnectionSettingsDrawer {...defaultProps} open />);
    expect(screen.queryByTestId('grpc-tls-test-result')).toBeNull();
  });
});

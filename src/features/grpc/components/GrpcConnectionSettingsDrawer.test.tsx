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

describe('GrpcConnectionSettingsDrawer (Phase 4J-C/D)', () => {
  it('renders drawer with TLS panel by default', () => {
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    expect(screen.getByTestId('grpc-settings-panel-tls')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
  });

  it('switches to auth panel', () => {
    const onNavChange = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onNavChange={onNavChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-settings-nav-auth'));
    expect(onNavChange).toHaveBeenCalledWith('auth');
  });

  it('shows auth panel when activeNav is auth', () => {
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="auth"
      />,
    );
    expect(screen.getByTestId('grpc-settings-panel-auth')).toBeTruthy();
    expect(screen.getByTestId('grpc-auth-type-select')).toBeTruthy();
  });

  it('shows call settings panel when activeNav is call', () => {
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="call"
      />,
    );
    expect(screen.getByTestId('grpc-settings-panel-call')).toBeTruthy();
    expect(screen.getByTestId('grpc-call-settings-timeout')).toBeTruthy();
  });

  it('shows compression panel when activeNav is compression', () => {
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="compression"
      />,
    );
    expect(screen.getByTestId('grpc-settings-panel-compression')).toBeTruthy();
    expect(screen.getByTestId('grpc-compression-panel')).toBeTruthy();
  });

  it('shows health panel with Spring hint when health service is available', () => {
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="health"
        healthAvailable
      />,
    );
    expect(screen.getByTestId('grpc-health-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-spring-hint-spring_health_actuator')).toBeTruthy();
  });

  it('shows health panel when activeNav is health', () => {
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="health"
      />,
    );
    expect(screen.getByTestId('grpc-settings-panel-health')).toBeTruthy();
    expect(screen.getByTestId('grpc-health-panel')).toBeTruthy();
  });

  it('shows k8s and transport panels', () => {
    const { rerender } = render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="k8s"
      />,
    );
    expect(screen.getByTestId('grpc-settings-panel-k8s')).toBeTruthy();
    rerender(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="transport"
      />,
    );
    expect(screen.getByTestId('grpc-settings-panel-transport')).toBeTruthy();
  });

  it('navigates to compression via nav click', () => {
    const onNavChange = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onNavChange={onNavChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-settings-nav-compression'));
    expect(onNavChange).toHaveBeenCalledWith('compression');
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from footer Close button', () => {
    const onClose = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-settings-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onTlsModeChange from TLS panel', async () => {
    const user = userEvent.setup();
    const onTlsModeChange = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onTlsModeChange={onTlsModeChange}
      />,
    );
    await user.click(screen.getByTestId('grpc-tls-mode-tls'));
    expect(onTlsModeChange).toHaveBeenCalledWith('tls');
  });

  it('does not close on overlay click (passthrough for connection bar badges)', () => {
    const onClose = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(document.querySelector('.grpc-settings-overlay')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(<GrpcConnectionSettingsDrawer {...defaultProps} open={false} />);
    expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
  });

  // Phase 10G — callType forwarded to GrpcTransportPanel
  it('passes callType to transport panel: client_streaming disables grpc-web', () => {
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        activeNav="transport"
        callType="client_streaming"
      />,
    );

    expect(screen.getByTestId('grpc-settings-panel-transport')).toBeTruthy();
    expect(
      (screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled,
    ).toBe(true);
    const reason = screen.getByTestId('grpc-transport-mode-reason-grpc-web');
    expect(reason.textContent).toBe('Not supported for this call type');
  });
});

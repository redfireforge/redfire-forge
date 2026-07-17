/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcConnectionSettingsDrawer } from './GrpcConnectionSettingsDrawer';

const defaultProps = {
  open: true,
  activeNav: 'call' as const,
  timeoutMs: 30_000,
  compression: undefined,
  healthAvailable: false,
  healthWatchAvailable: false,
  healthProbeReady: true,
  onNavChange: vi.fn(),
  onClose: vi.fn(),
  onTimeoutMsChange: vi.fn(),
  onCompressionChange: vi.fn(),
  onHealthCheck: vi.fn(),
  onHealthWatch: vi.fn(),
};

describe('GrpcConnectionSettingsDrawer (Phase 4J-C/D)', () => {
  it('renders drawer with call settings panel by default', () => {
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    expect(screen.getByTestId('grpc-settings-panel-call')).toBeTruthy();
    expect(screen.getByTestId('grpc-call-settings-timeout')).toBeTruthy();
  });

  it('switches to call settings panel', () => {
    const onNavChange = vi.fn();
    render(
      <GrpcConnectionSettingsDrawer
        {...defaultProps}
        onNavChange={onNavChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-settings-nav-call'));
    expect(onNavChange).toHaveBeenCalledWith('call');
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

  it('moves the dialog when dragging the header', () => {
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);

    const header = document.querySelector('.grpc-settings-drawer-header') as HTMLElement;
    const dialog = document.querySelector('.grpc-settings-drawer-modal') as HTMLElement;
    expect(header).toBeTruthy();
    expect(dialog).toBeTruthy();

    fireEvent.mouseDown(header, { clientX: 120, clientY: 80 });
    fireEvent.mouseMove(window, { clientX: 200, clientY: 150 });
    fireEvent.mouseUp(window);

    expect(dialog.style.position).toBe('fixed');
    expect(dialog.style.left).toBe('80px');
    expect(dialog.style.top).toBe('70px');
  });

  it('moves the dialog when dragging via pointer events', () => {
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);

    const header = document.querySelector('.grpc-settings-drawer-header') as HTMLElement;
    const dialog = document.querySelector('.grpc-settings-drawer-modal') as HTMLElement;
    expect(header).toBeTruthy();
    expect(dialog).toBeTruthy();

    fireEvent.pointerDown(header, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 140, clientY: 96 });
    fireEvent.pointerMove(window, { pointerId: 7, pointerType: 'mouse', clientX: 230, clientY: 170 });
    fireEvent.pointerUp(window, { pointerId: 7, pointerType: 'mouse' });

    expect(dialog.style.position).toBe('fixed');
    expect(dialog.style.left).toBe('90px');
    expect(dialog.style.top).toBe('74px');
  });

  it('calls onTlsModeChange from TLS modal (not drawer) — placeholder', () => {
    // TLS is now only accessible via the connection bar badge → TlsConfigModal (shared with GraphQL).
    // The settings drawer no longer contains a TLS panel.
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    expect(screen.queryByTestId('grpc-tls-mode-tls')).toBeNull();
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

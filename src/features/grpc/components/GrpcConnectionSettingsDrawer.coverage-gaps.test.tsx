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

describe('GrpcConnectionSettingsDrawer coverage gaps', () => {
  it('renders call settings panel by default', () => {
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    expect(screen.getByTestId('grpc-settings-panel-call')).toBeTruthy();
    expect(screen.getByTestId('grpc-call-settings-timeout')).toBeTruthy();
  });

  it('navigates to compression panel', () => {
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
    expect((screen.getByTestId('grpc-settings-nav-call') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-settings-nav-health') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not render TLS nav item (TLS moved to connection bar badge modal)', () => {
    render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    expect(screen.queryByTestId('grpc-settings-nav-tls')).toBeNull();
  });

  it('re-opens correctly after close', () => {
    const { rerender } = render(<GrpcConnectionSettingsDrawer {...defaultProps} />);
    expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    rerender(<GrpcConnectionSettingsDrawer {...defaultProps} open={false} />);
    expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
    rerender(<GrpcConnectionSettingsDrawer {...defaultProps} open />);
    expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
  });

  it('resets dragged position when reopened', () => {
    const { rerender } = render(<GrpcConnectionSettingsDrawer {...defaultProps} />);

    const header = document.querySelector('.grpc-settings-drawer-header') as HTMLElement;
    const dialog = document.querySelector('.grpc-settings-drawer-modal') as HTMLElement;
    expect(header).toBeTruthy();
    expect(dialog).toBeTruthy();

    fireEvent.mouseDown(header, { clientX: 120, clientY: 80 });
    fireEvent.mouseMove(window, { clientX: 220, clientY: 180 });
    fireEvent.mouseUp(window);

    expect(dialog.style.position).toBe('fixed');
    expect(dialog.style.left).toBe('100px');
    expect(dialog.style.top).toBe('100px');

    rerender(<GrpcConnectionSettingsDrawer {...defaultProps} open={false} />);
    rerender(<GrpcConnectionSettingsDrawer {...defaultProps} open />);

    const reopenedDialog = document.querySelector('.grpc-settings-drawer-modal') as HTMLElement;
    expect(reopenedDialog.style.position).toBe('');
    expect(reopenedDialog.style.left).toBe('');
    expect(reopenedDialog.style.top).toBe('');
  });
});

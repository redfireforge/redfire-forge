/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcConnectionBar } from './GrpcConnectionBar';

describe('GrpcConnectionBar (Phase 4J-A)', () => {
  const defaultProps = {
    target: 'localhost:50051',
    tlsMode: 'tls' as const,
    tlsValid: true,
    auth: undefined,
    timeoutMs: 30_000,
    onTargetChange: vi.fn(),
  };

  it('renders connection bar with target input and badges', () => {
    render(<GrpcConnectionBar {...defaultProps} />);
    expect(screen.getByTestId('grpc-connection-bar')).toBeTruthy();
    expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).value).toBe('localhost:50051');
    expect(screen.getByTestId('grpc-tls-badge').textContent).toContain('TLS');
    expect(screen.getByTestId('grpc-auth-badge').textContent).toBe('Auth: None');
    expect(screen.getByTestId('grpc-deadline-badge').textContent).toContain('30s');
  });

  it('shows mTLS and configured auth labels', () => {
    render(
      <GrpcConnectionBar
        {...defaultProps}
        tlsMode="mtls"
        auth={{ type: 'bearer', bearerToken: 'secret' }}
      />,
    );
    expect(screen.getByTestId('grpc-tls-badge').textContent).toContain('mTLS');
    expect(screen.getByTestId('grpc-auth-badge').textContent).toBe('Auth: Bearer');
    expect(screen.getByTestId('grpc-auth-badge').className).toContain('configured');
  });

  it('shows TLS invalid badge when tlsValid is false', () => {
    render(<GrpcConnectionBar {...defaultProps} tlsValid={false} />);
    expect(screen.getByTestId('grpc-tls-badge').textContent).toContain('TLS invalid');
  });

  it('calls onTargetChange when target edits', () => {
    const onTargetChange = vi.fn();
    render(<GrpcConnectionBar {...defaultProps} onTargetChange={onTargetChange} />);
    fireEvent.change(screen.getByTestId('grpc-target-input'), {
      target: { value: 'grpc.example.com:50051' },
    });
    expect(onTargetChange).toHaveBeenCalledWith('grpc.example.com:50051');
  });

  it('fires tls, auth, and deadline badge handlers', () => {
    const onTlsBadgeClick = vi.fn();
    const onAuthBadgeClick = vi.fn();
    const onDeadlineBadgeClick = vi.fn();
    render(
      <GrpcConnectionBar
        {...defaultProps}
        onTlsBadgeClick={onTlsBadgeClick}
        onAuthBadgeClick={onAuthBadgeClick}
        onDeadlineBadgeClick={onDeadlineBadgeClick}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    fireEvent.click(screen.getByTestId('grpc-auth-badge'));
    fireEvent.click(screen.getByTestId('grpc-deadline-badge'));
    expect(onTlsBadgeClick).toHaveBeenCalledTimes(1);
    expect(onAuthBadgeClick).toHaveBeenCalledTimes(1);
    expect(onDeadlineBadgeClick).toHaveBeenCalledTimes(1);
  });

  it('disables controls when disabled', () => {
    render(
      <GrpcConnectionBar
        {...defaultProps}
        disabled
        onAuthBadgeClick={vi.fn()}
        onSettingsClick={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-badge') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-auth-badge') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-deadline-badge') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-connection-settings-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks target input invalid when targetInvalid', () => {
    render(<GrpcConnectionBar {...defaultProps} targetInvalid />);
    expect(screen.getByTestId('grpc-target-input').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows settings button when handler is wired (Phase 4J-C)', () => {
    render(<GrpcConnectionBar {...defaultProps} onSettingsClick={vi.fn()} />);
    expect(screen.getByTestId('grpc-connection-settings-btn')).toBeTruthy();
  });

  it('fires settings button handler (Phase 4J-C)', () => {
    const onSettingsClick = vi.fn();
    render(<GrpcConnectionBar {...defaultProps} onSettingsClick={onSettingsClick} />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });

  it('renders the settings button as the last right-edge action', () => {
    const { container } = render(
      <GrpcConnectionBar
        {...defaultProps}
        onConnectionToggle={vi.fn()}
        onSettingsClick={vi.fn()}
        onImportGrpcurlClick={vi.fn()}
        onSaveRequestClick={vi.fn()}
      />,
    );
    const actionButtons = Array.from(
      container.querySelectorAll('.grpc-connection-bar__actions > button'),
    );
    expect(actionButtons.at(-1)?.getAttribute('data-testid')).toBe('grpc-connection-settings-btn');
  });

  it('renders connect in the right-edge action rail before the settings gear', () => {
    const { container } = render(
      <GrpcConnectionBar
        {...defaultProps}
        onConnectionToggle={vi.fn()}
        onSettingsClick={vi.fn()}
        onImportGrpcurlClick={vi.fn()}
        onSaveRequestClick={vi.fn()}
      />,
    );
    const actionButtons = Array.from(
      container.querySelectorAll('.grpc-connection-bar__actions > button'),
    ).map((button) => button.getAttribute('data-testid'));
    expect(actionButtons).toEqual([
      'grpc-import-grpcurl-btn',
      'grpc-save-request-btn',
      'grpc-connection-toggle-btn',
      'grpc-connection-settings-btn',
    ]);
  });

  it('shows plaintext unlock icon on TLS badge', () => {
    render(<GrpcConnectionBar {...defaultProps} tlsMode="disabled" />);
    expect(screen.getByTestId('grpc-tls-badge').textContent).toContain('🔓');
    expect(screen.getByTestId('grpc-tls-badge').textContent).toContain('Plaintext');
  });

  it('renders connection status dot and toggle button (Phase 1)', () => {
    render(
      <GrpcConnectionBar
        {...defaultProps}
        targetConnection={{ state: 'connected', latencyMs: 12 }}
        onConnectionToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-connection-status-dot').className).toContain('connected');
    expect(screen.getByTestId('grpc-connection-toggle-btn').textContent).toBe('Disconnect');
  });
});

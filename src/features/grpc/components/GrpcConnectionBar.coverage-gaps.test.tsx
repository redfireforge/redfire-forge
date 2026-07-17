/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcConnectionBar } from './GrpcConnectionBar';

describe('GrpcConnectionBar coverage gaps', () => {
  const defaultProps = {
    target: 'localhost:50051',
    tlsMode: 'tls' as const,
    tlsValid: true,
    auth: undefined,
    timeoutMs: 30_000,
    onTargetChange: vi.fn(),
  };

  it('shows connection status tooltips for error, connecting, and idle states', () => {
    const { rerender } = render(
      <GrpcConnectionBar
        {...defaultProps}
        targetConnection={{ state: 'error', errorMessage: 'refused' }}
        onConnectionToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-connection-status-dot').getAttribute('title')).toBe('refused');

    rerender(
      <GrpcConnectionBar
        {...defaultProps}
        targetConnection={{ state: 'connecting' }}
        onConnectionToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-connection-status-dot').getAttribute('title')).toBe('Connecting…');

    rerender(
      <GrpcConnectionBar
        {...defaultProps}
        targetConnection={{ state: 'idle' }}
        onConnectionToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-connection-status-dot').getAttribute('title')).toContain('Disconnected');
  });

  it('shows connected tooltip without latency when latencyMs is absent', () => {
    render(
      <GrpcConnectionBar
        {...defaultProps}
        targetConnection={{ state: 'connected' }}
        onConnectionToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-connection-status-dot').getAttribute('title')).toBe('Connected');
  });

  it('fires import grpcurl and save request handlers', () => {
    const onImportGrpcurlClick = vi.fn();
    const onSaveRequestClick = vi.fn();
    render(
      <GrpcConnectionBar
        {...defaultProps}
        onImportGrpcurlClick={onImportGrpcurlClick}
        onSaveRequestClick={onSaveRequestClick}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-import-grpcurl-btn'));
    fireEvent.click(screen.getByTestId('grpc-save-request-btn'));
    expect(onImportGrpcurlClick).toHaveBeenCalledTimes(1);
    expect(onSaveRequestClick).toHaveBeenCalledTimes(1);
  });

  it('disables save request when saveRequestDisabled is true', () => {
    render(
      <GrpcConnectionBar
        {...defaultProps}
        onSaveRequestClick={vi.fn()}
        saveRequestDisabled
      />,
    );
    expect((screen.getByTestId('grpc-save-request-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables connection toggle when target is invalid or tls is invalid', () => {
    const { rerender } = render(
      <GrpcConnectionBar
        {...defaultProps}
        targetInvalid
        onConnectionToggle={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-connection-toggle-btn') as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <GrpcConnectionBar
        {...defaultProps}
        tlsValid={false}
        onConnectionToggle={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-connection-toggle-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('fires connection toggle handler when wired', () => {
    const onConnectionToggle = vi.fn();
    render(
      <GrpcConnectionBar
        {...defaultProps}
        onConnectionToggle={onConnectionToggle}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-connection-toggle-btn'));
    expect(onConnectionToggle).toHaveBeenCalledTimes(1);
  });

  it('shows connected tooltip with latency when latencyMs is present', () => {
    render(
      <GrpcConnectionBar
        {...defaultProps}
        targetConnection={{ state: 'connected', latencyMs: 42 }}
        onConnectionToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-connection-status-dot').getAttribute('title')).toBe('Connected (42ms)');
  });

  it('shows reflection badge when schema methods are loaded', () => {
    const { rerender } = render(
      <GrpcConnectionBar
        {...defaultProps}
        reflectionLoadedCount={1}
      />,
    );
    expect(screen.getByTestId('grpc-connection-reflection-badge').getAttribute('title')).toContain('1 method');

    rerender(
      <GrpcConnectionBar
        {...defaultProps}
        reflectionLoadedCount={3}
      />,
    );
    expect(screen.getByTestId('grpc-connection-reflection-badge').getAttribute('title')).toContain('3 methods');
  });

  it('shows transport badge and opens settings when clicked', () => {
    const onSettingsClick = vi.fn();
    render(
      <GrpcConnectionBar
        {...defaultProps}
        transportMode="express"
        onSettingsClick={onSettingsClick}
      />,
    );
    const badge = screen.getByTestId('grpc-transport-badge');
    expect(badge.className).toContain('grpc-connection-transport-badge--express');
    expect(badge.getAttribute('aria-label')).toContain('Express Proxy');
    fireEvent.click(badge);
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });
});

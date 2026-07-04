/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcCallSettingsPanel } from './GrpcCallSettingsPanel';

const defaultProps = {
  timeoutMs: 30_000,
  maxResponseSizeMb: 4,
  keepaliveIntervalSec: 30,
  onTimeoutMsChange: vi.fn(),
  onMaxResponseSizeMbChange: vi.fn(),
  onKeepaliveIntervalSecChange: vi.fn(),
};

describe('GrpcCallSettingsPanel (Phase 4J-C)', () => {
  it('renders timeout input and preview', () => {
    render(<GrpcCallSettingsPanel {...defaultProps} />);
    expect(screen.getByTestId('grpc-call-settings-panel')).toBeTruthy();
    expect((screen.getByTestId('grpc-call-settings-timeout') as HTMLInputElement).value).toBe('30000');
    expect(screen.getByTestId('grpc-call-settings-preview').textContent).toContain('30S');
  });

  it('calls onTimeoutMsChange when timeout edits', () => {
    const onTimeoutMsChange = vi.fn();
    render(<GrpcCallSettingsPanel {...defaultProps} onTimeoutMsChange={onTimeoutMsChange} />);
    fireEvent.change(screen.getByTestId('grpc-call-settings-timeout'), {
      target: { value: '45000' },
    });
    expect(onTimeoutMsChange).toHaveBeenCalledWith(45_000);
  });

  it('ignores invalid timeout values', () => {
    const onTimeoutMsChange = vi.fn();
    render(<GrpcCallSettingsPanel {...defaultProps} onTimeoutMsChange={onTimeoutMsChange} />);
    fireEvent.change(screen.getByTestId('grpc-call-settings-timeout'), {
      target: { value: '0' },
    });
    expect(onTimeoutMsChange).not.toHaveBeenCalled();
  });

  it('renders max response size input with correct value', () => {
    render(<GrpcCallSettingsPanel {...defaultProps} maxResponseSizeMb={8} />);
    expect((screen.getByTestId('grpc-call-settings-max-response') as HTMLInputElement).value).toBe('8');
  });

  it('calls onMaxResponseSizeMbChange when max response size edits', () => {
    const onMaxResponseSizeMbChange = vi.fn();
    render(<GrpcCallSettingsPanel {...defaultProps} onMaxResponseSizeMbChange={onMaxResponseSizeMbChange} />);
    fireEvent.change(screen.getByTestId('grpc-call-settings-max-response'), {
      target: { value: '16' },
    });
    expect(onMaxResponseSizeMbChange).toHaveBeenCalledWith(16);
  });

  it('ignores invalid max response size values', () => {
    const onMaxResponseSizeMbChange = vi.fn();
    render(<GrpcCallSettingsPanel {...defaultProps} onMaxResponseSizeMbChange={onMaxResponseSizeMbChange} />);
    fireEvent.change(screen.getByTestId('grpc-call-settings-max-response'), {
      target: { value: '0' },
    });
    expect(onMaxResponseSizeMbChange).not.toHaveBeenCalled();
  });

  it('renders keepalive interval input with correct value', () => {
    render(<GrpcCallSettingsPanel {...defaultProps} keepaliveIntervalSec={60} />);
    expect((screen.getByTestId('grpc-call-settings-keepalive') as HTMLInputElement).value).toBe('60');
  });

  it('calls onKeepaliveIntervalSecChange when keepalive edits', () => {
    const onKeepaliveIntervalSecChange = vi.fn();
    render(<GrpcCallSettingsPanel {...defaultProps} onKeepaliveIntervalSecChange={onKeepaliveIntervalSecChange} />);
    fireEvent.change(screen.getByTestId('grpc-call-settings-keepalive'), {
      target: { value: '120' },
    });
    expect(onKeepaliveIntervalSecChange).toHaveBeenCalledWith(120);
  });

  it('ignores invalid keepalive values', () => {
    const onKeepaliveIntervalSecChange = vi.fn();
    render(<GrpcCallSettingsPanel {...defaultProps} onKeepaliveIntervalSecChange={onKeepaliveIntervalSecChange} />);
    fireEvent.change(screen.getByTestId('grpc-call-settings-keepalive'), {
      target: { value: '-5' },
    });
    expect(onKeepaliveIntervalSecChange).not.toHaveBeenCalled();
  });
});

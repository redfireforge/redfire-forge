/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcCallSettingsPanel } from './GrpcCallSettingsPanel';

describe('GrpcCallSettingsPanel (Phase 4J-C)', () => {
  it('renders timeout input and preview', () => {
    render(
      <GrpcCallSettingsPanel
        timeoutMs={30_000}
        onTimeoutMsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-call-settings-panel')).toBeTruthy();
    expect((screen.getByTestId('grpc-call-settings-timeout') as HTMLInputElement).value).toBe('30000');
    expect(screen.getByTestId('grpc-call-settings-preview').textContent).toContain('30S');
  });

  it('calls onTimeoutMsChange when timeout edits', () => {
    const onTimeoutMsChange = vi.fn();
    render(
      <GrpcCallSettingsPanel
        timeoutMs={30_000}
        onTimeoutMsChange={onTimeoutMsChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-call-settings-timeout'), {
      target: { value: '45000' },
    });
    expect(onTimeoutMsChange).toHaveBeenCalledWith(45_000);
  });

  it('ignores invalid timeout values', () => {
    const onTimeoutMsChange = vi.fn();
    render(
      <GrpcCallSettingsPanel
        timeoutMs={30_000}
        onTimeoutMsChange={onTimeoutMsChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-call-settings-timeout'), {
      target: { value: '0' },
    });
    expect(onTimeoutMsChange).not.toHaveBeenCalled();
  });
});

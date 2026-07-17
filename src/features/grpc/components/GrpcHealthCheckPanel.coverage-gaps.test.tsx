/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GrpcHealthCheckPanel } from './GrpcHealthCheckPanel';

const makeResult = (statusLabel: string) => ({
  callType: 'unary' as const,
  status: statusLabel === 'SERVING' ? 0 : 1,
  statusMessage: statusLabel,
  headers: {},
  trailers: {},
  body: { status: statusLabel },
  durationMs: 12,
});

describe('GrpcHealthCheckPanel coverage gaps', () => {
  it('dismisses Spring health hint via onDismiss callback', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-spring-hint-dismiss-spring_health_actuator'));
    expect(screen.queryByTestId('grpc-spring-hint-spring_health_actuator')).toBeNull();
  });

  it('shows warning styling for non-SERVING health results', async () => {
    const onCheckHealth = vi.fn().mockResolvedValue({
      ok: true,
      result: makeResult('NOT_SERVING'),
    });
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        onCheckHealth={onCheckHealth}
        onStartWatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-health-check-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result').className).toContain('grpc-health-result--warning');
    });
    expect(screen.getByTestId('grpc-health-result').textContent).toMatch(/NOT_SERVING/);
  });

  it('disables controls when busy', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        busy
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-health-service-name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-health-check-btn') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-health-watch-btn') as HTMLButtonElement).disabled).toBe(true);
  });
});

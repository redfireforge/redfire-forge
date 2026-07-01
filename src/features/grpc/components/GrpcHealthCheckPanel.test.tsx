/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GrpcHealthCheckPanel } from './GrpcHealthCheckPanel';

const makeResult = () => ({
  callType: 'unary' as const,
  status: 0,
  statusMessage: 'OK',
  headers: {},
  trailers: {},
  body: { status: 'SERVING' },
  durationMs: 12,
});

describe('GrpcHealthCheckPanel (Phase 4J-D)', () => {
  it('shows Spring Actuator hint when health service is available (Phase 4G + 4J-D)', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-spring-hint-spring_health_actuator')).toBeTruthy();
  });

  it('hides Spring hint when health service is unavailable', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable={false}
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('grpc-spring-hint-spring_health_actuator')).toBeNull();
  });

  it('uses Actuator-style service name placeholder (not RPC service name)', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    const input = screen.getByTestId('grpc-health-service-name') as HTMLInputElement;
    expect(input.placeholder).toMatch(/db.*redis/i);
    expect(input.placeholder).not.toMatch(/OrderService/i);
  });

  it('shows unavailable message when health service missing', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable={false}
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-health-unavailable')).toBeTruthy();
    expect((screen.getByTestId('grpc-health-check-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('runs check health and shows result', async () => {
    const onCheckHealth = vi.fn().mockResolvedValue({ ok: true, result: makeResult() });
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        onCheckHealth={onCheckHealth}
        onStartWatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-health-check-btn'));
    await waitFor(() => {
      expect(onCheckHealth).toHaveBeenCalledWith('');
    });
    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result')).toBeTruthy();
    });
    expect(screen.getByTestId('grpc-health-result').textContent).toMatch(/SERVING/i);
  });

  it('shows error when probe fails', async () => {
    const onCheckHealth = vi.fn().mockResolvedValue({ ok: false, error: 'Unreachable' });
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        onCheckHealth={onCheckHealth}
        onStartWatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-health-check-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result-error')).toBeTruthy();
    });
  });

  it('disables watch when Watch method is unavailable', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        healthWatchAvailable={false}
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-health-watch-btn') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-health-check-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables probes when target/TLS is not ready', () => {
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        probeReady={false}
        onCheckHealth={vi.fn()}
        onStartWatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-health-probe-blocked')).toBeTruthy();
    expect((screen.getByTestId('grpc-health-check-btn') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-health-watch-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('delegates watch to callback with service name', () => {
    const onStartWatch = vi.fn();
    render(
      <GrpcHealthCheckPanel
        healthAvailable
        onCheckHealth={vi.fn()}
        onStartWatch={onStartWatch}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-health-service-name'), {
      target: { value: 'orders' },
    });
    fireEvent.click(screen.getByTestId('grpc-health-watch-btn'));
    expect(onStartWatch).toHaveBeenCalledWith('orders');
  });
});

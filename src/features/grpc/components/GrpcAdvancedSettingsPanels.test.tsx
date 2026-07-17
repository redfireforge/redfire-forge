/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GrpcK8sPortForwardPanel } from './GrpcK8sPortForwardPanel';
import { GrpcTransportPanel } from './GrpcTransportPanel';

const grpcK8sApiMocks = vi.hoisted(() => ({
  getStatus: vi.fn(async () => ({ scopeId: 'tab-1', active: false })),
  getLogs: vi.fn(async () => ({
    scopeId: 'tab-1',
    lines: [{ seq: 1, ts: '2026-07-01T00:00:00.000Z', stream: 'system', text: 'Starting: kubectl ...' }],
    latestSeq: 1,
  })),
  start: vi.fn(async () => ({
    scopeId: 'tab-1',
    active: true,
    pid: 321,
    target: 'localhost:50051',
    command: 'kubectl port-forward -n default svc/order-service 50051:50051',
  })),
  stop: vi.fn(async () => ({ scopeId: 'tab-1', active: false })),
  clearLogs: vi.fn(async () => ({ scopeId: 'tab-1', latestSeq: 5 })),
}));

vi.mock('../../../shared/grpc/grpcApiClient', () => ({
  getGrpcK8sPortForwardStatus: grpcK8sApiMocks.getStatus,
  getGrpcK8sPortForwardLogs: grpcK8sApiMocks.getLogs,
  postGrpcK8sPortForwardClearLogs: grpcK8sApiMocks.clearLogs,
  postGrpcK8sPortForwardStart: grpcK8sApiMocks.start,
  postGrpcK8sPortForwardStop: grpcK8sApiMocks.stop,
}));

describe('GrpcK8sPortForwardPanel (Phase 4J-D)', () => {
  it('persists draft config synchronously before panel unmount', () => {
    const onSessionChange = vi.fn();
    const { unmount } = render(
      <GrpcK8sPortForwardPanel onSessionChange={onSessionChange} />,
    );

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), {
      target: { value: 'order-service' },
    });
    expect(onSessionChange).toHaveBeenCalledWith(expect.objectContaining({
      active: false,
      config: expect.objectContaining({ name: 'order-service' }),
    }));

    unmount();
    render(
      <GrpcK8sPortForwardPanel
        session={{
          active: false,
          config: {
            namespace: 'default',
            targetType: 'service',
            name: 'order-service',
            remotePort: 50051,
            localPort: 50051,
            context: '',
          },
        }}
      />,
    );
    expect((screen.getByTestId('grpc-k8s-name') as HTMLInputElement).value).toBe('order-service');
  });

  it('enables start when name is filled and applies target on start', async () => {
    const onSessionChange = vi.fn();
    const onApplyTarget = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        onSessionChange={onSessionChange}
        onApplyTarget={onApplyTarget}
      />,
    );

    const startBtn = screen.getByTestId('grpc-k8s-start-btn') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), {
      target: { value: 'order-service' },
    });
    expect(startBtn.disabled).toBe(false);
    expect(onSessionChange).toHaveBeenCalledWith(expect.objectContaining({
      active: false,
      config: expect.objectContaining({ name: 'order-service' }),
    }));

    fireEvent.click(startBtn);
    expect(onApplyTarget).toHaveBeenCalledWith('localhost:50051');
    expect(onSessionChange).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      config: expect.objectContaining({ name: 'order-service' }),
    }));
    expect(screen.getByTestId('grpc-k8s-status').textContent).toContain('localhost:50051');
    expect(screen.getByTestId('grpc-k8s-command').textContent).toContain('kubectl port-forward');
  });

  it('restores draft config from session when remounted', () => {
    const { unmount } = render(
      <GrpcK8sPortForwardPanel
        session={{
          active: false,
          config: {
            namespace: 'production',
            targetType: 'service',
            name: 'order-service',
            remotePort: 50051,
            localPort: 50051,
            context: '',
          },
        }}
      />,
    );
    expect((screen.getByTestId('grpc-k8s-name') as HTMLInputElement).value).toBe('order-service');
    unmount();
    render(
      <GrpcK8sPortForwardPanel
        session={{
          active: false,
          config: {
            namespace: 'production',
            targetType: 'service',
            name: 'order-service',
            remotePort: 50051,
            localPort: 50051,
            context: '',
          },
        }}
      />,
    );
    expect((screen.getByTestId('grpc-k8s-namespace') as HTMLInputElement).value).toBe('production');
  });

  it('stops active session without clearing target', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{
          active: true,
          config: {
            namespace: 'default',
            targetType: 'service',
            name: 'echo',
            remotePort: 50051,
            localPort: 50051,
            context: '',
          },
        }}
        onSessionChange={onSessionChange}
      />,
    );

    const stopBtn = screen.getByTestId('grpc-k8s-stop-btn') as HTMLButtonElement;
    expect(stopBtn.disabled).toBe(false);
    fireEvent.click(stopBtn);
    expect(onSessionChange).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('allows stop while parent disabled (UI-only session flag)', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        disabled
        session={{
          active: true,
          config: {
            namespace: 'default',
            targetType: 'service',
            name: 'echo',
            remotePort: 50051,
            localPort: 50051,
            context: '',
          },
        }}
        onSessionChange={onSessionChange}
      />,
    );

    const stopBtn = screen.getByTestId('grpc-k8s-stop-btn') as HTMLButtonElement;
    expect(stopBtn.disabled).toBe(false);
    fireEvent.click(stopBtn);
    expect(onSessionChange).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('trims name and namespace when starting port-forward', () => {
    const onSessionChange = vi.fn();
    const onApplyTarget = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{
          active: false,
          config: {
            namespace: ' staging ',
            targetType: 'service',
            name: ' order-service ',
            remotePort: 50051,
            localPort: 50051,
            context: '',
          },
        }}
        onSessionChange={onSessionChange}
        onApplyTarget={onApplyTarget}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    expect(onSessionChange).toHaveBeenCalledWith({
      active: true,
      config: expect.objectContaining({
        namespace: 'staging',
        name: 'order-service',
      }),
    });
    expect(onApplyTarget).toHaveBeenCalledWith('localhost:50051');
  });

  it('uses backend automation when scope id is provided', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 321,
    });
    const onSessionChange = vi.fn();
    const onApplyTarget = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        onSessionChange={onSessionChange}
        onApplyTarget={onApplyTarget}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), {
      target: { value: 'order-service' },
    });

    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));

    await waitFor(() => {
      expect(grpcK8sApiMocks.start).toHaveBeenCalledWith('tab-1', expect.objectContaining({
        name: 'order-service',
      }));
      expect(screen.getByTestId('grpc-k8s-automation-state').textContent).toContain('PID: 321');
      expect(screen.getByTestId('grpc-k8s-log-lines').textContent).toContain('Starting: kubectl');
      expect(onApplyTarget).toHaveBeenCalledWith('localhost:50051');
    });

    fireEvent.click(screen.getByTestId('grpc-k8s-log-autoscroll-btn'));
    expect(screen.getByTestId('grpc-k8s-log-autoscroll-btn').textContent).toContain('Resume Auto-Scroll');

    fireEvent.click(screen.getByTestId('grpc-k8s-log-clear-btn'));
    await waitFor(() => {
      expect(grpcK8sApiMocks.clearLogs).toHaveBeenCalledWith('tab-1');
      expect(screen.getByTestId('grpc-k8s-log-empty').textContent).toContain('No log lines yet');
    });

    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));

    await waitFor(() => {
      expect(grpcK8sApiMocks.stop).toHaveBeenCalledWith('tab-1');
      expect(onSessionChange).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
    });
  });
});

describe('GrpcTransportPanel (Phase 4J-D)', () => {
  it('shows express proxy as active mode on web', () => {
    render(<GrpcTransportPanel transportMode="express" />);
    expect(screen.getByTestId('grpc-transport-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-transport-mode-express').className).toMatch(/active/);
    expect(screen.getByTestId('grpc-transport-mode-tauri').className).toMatch(/disabled/);
  });
});

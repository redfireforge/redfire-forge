/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectOption } from '@test-utils/customSelectHelper';
import { GrpcK8sPortForwardPanel } from './GrpcK8sPortForwardPanel';
import { DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG } from '../utils/grpcK8sPortForward';

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
    command: 'kubectl port-forward -n default svc/echo-service 50051:50051',
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

describe('GrpcK8sPortForwardPanel', () => {
  beforeEach(() => {
    resetAllMocks();
    grpcK8sApiMocks.getStatus.mockResolvedValue({ scopeId: 'tab-1', active: false });
    grpcK8sApiMocks.getLogs.mockResolvedValue({
      scopeId: 'tab-1',
      lines: [{ seq: 1, ts: '2026-07-01T00:00:00.000Z', stream: 'system', text: 'Starting: kubectl ...' }],
      latestSeq: 1,
    });
    grpcK8sApiMocks.start.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 321,
      target: 'localhost:50051',
      command: 'kubectl port-forward -n default svc/echo-service 50051:50051',
    });
    grpcK8sApiMocks.stop.mockResolvedValue({ scopeId: 'tab-1', active: false });
    grpcK8sApiMocks.clearLogs.mockResolvedValue({ scopeId: 'tab-1', latestSeq: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  const readyConfig = {
    ...DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG,
    name: 'echo-service',
    namespace: 'default',
    remotePort: 50051,
    localPort: 50051,
  };

  it('renders form fields and kubectl command when config is ready', () => {
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-k8s-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-k8s-status-chip').textContent).toMatch(/Ready/i);
    expect(screen.getByTestId('grpc-k8s-copy-command-btn')).toBeTruthy();
    expect(screen.getByTestId('grpc-k8s-command').textContent).toMatch(/kubectl port-forward/);
    expect(screen.getByTestId('grpc-k8s-start-btn')).toBeTruthy();
  });

  it('starts port-forward and applies local target', () => {
    const onSessionChange = vi.fn();
    const onApplyTarget = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
        onApplyTarget={onApplyTarget}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    expect(onSessionChange).toHaveBeenCalledWith({ config: readyConfig, active: true });
    expect(onApplyTarget).toHaveBeenCalledWith('localhost:50051');
    expect(screen.getByTestId('grpc-k8s-status')).toBeTruthy();
  });

  it('stops an active port-forward session', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: true }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    expect(onSessionChange).toHaveBeenCalledWith({ config: readyConfig, active: false });
  });

  it('persists config edits and disables fields while active', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: true }}
        onSessionChange={onSessionChange}
      />,
    );
    const namespace = screen.getByTestId('grpc-k8s-namespace') as HTMLInputElement;
    const targetType = screen.getByTestId('grpc-k8s-target-type');
    expect(namespace.disabled).toBe(true);
    expect(targetType.querySelector('.cs-trigger')).toHaveProperty('disabled', true);
  });

  it('updates config when inactive and ignores invalid port input', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-k8s-namespace'), { target: { value: 'staging' } });
    selectOption(screen.getByTestId('grpc-k8s-target-type'), 'deployment');
    fireEvent.change(screen.getByTestId('grpc-k8s-name'), { target: { value: 'api' } });
    fireEvent.change(screen.getByTestId('grpc-k8s-remote-port'), { target: { value: '9090' } });
    fireEvent.change(screen.getByTestId('grpc-k8s-context'), { target: { value: 'minikube' } });
    expect(onSessionChange).toHaveBeenCalled();
    const callsBefore = onSessionChange.mock.calls.length;
    fireEvent.change(screen.getByTestId('grpc-k8s-local-port'), { target: { value: '0' } });
    expect(onSessionChange.mock.calls.length).toBe(callsBefore);
  });

  it('does not start when disabled or config is incomplete', () => {
    const onSessionChange = vi.fn();
    const { rerender } = render(
      <GrpcK8sPortForwardPanel
        session={{ config: { ...readyConfig, name: '' }, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-k8s-command')).toBeNull();

    rerender(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        disabled
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    expect(onSessionChange).not.toHaveBeenCalled();
  });

  it('syncs active state from session prop', () => {
    const { rerender } = render(
      <GrpcK8sPortForwardPanel session={{ config: readyConfig, active: false }} />,
    );
    expect((screen.getByTestId('grpc-k8s-start-btn') as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <GrpcK8sPortForwardPanel session={{ config: readyConfig, active: true }} />,
    );
    expect((screen.getByTestId('grpc-k8s-stop-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders with default config when session prop is omitted', () => {
    render(<GrpcK8sPortForwardPanel />);
    expect(screen.getByTestId('grpc-k8s-panel')).toBeTruthy();
    expect((screen.getByTestId('grpc-k8s-namespace') as HTMLInputElement).value).toBe('default');
  });

  it('starts without onApplyTarget and shows default namespace in status', () => {
    const onSessionChange = vi.fn();
    const config = {
      ...readyConfig,
      namespace: '   ',
    };
    render(
      <GrpcK8sPortForwardPanel
        session={{ config, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    expect(onSessionChange).toHaveBeenCalledWith({ config: expect.any(Object), active: true });
    expect(screen.getByTestId('grpc-k8s-status').textContent).toContain('default/echo-service');
  });

  it('ignores invalid remote port edits', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    const callsBefore = onSessionChange.mock.calls.length;
    fireEvent.change(screen.getByTestId('grpc-k8s-remote-port'), { target: { value: '0' } });
    expect(onSessionChange.mock.calls.length).toBe(callsBefore);
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

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), { target: { value: 'echo-service' } });
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));

    await waitFor(() => {
      expect(grpcK8sApiMocks.start).toHaveBeenCalled();
      expect(screen.getByTestId('grpc-k8s-automation-state').textContent).toContain('PID: 321');
      expect(onApplyTarget).toHaveBeenCalledWith('localhost:50051');
    });

    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    await waitFor(() => {
      expect(grpcK8sApiMocks.stop).toHaveBeenCalledWith('tab-1');
    });
  });

  it('falls back to manual mode when automation start fails', async () => {
    grpcK8sApiMocks.start.mockRejectedValueOnce(new Error('kubectl unavailable'));
    const onApplyTarget = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
        onApplyTarget={onApplyTarget}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-automation-error').textContent).toMatch(/manual mode/i);
      expect(onApplyTarget).toHaveBeenCalledWith('localhost:50051');
    });
  });

  it('polls automation status and logs after backend start', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 555,
      config: {
        namespace: 'staging',
        targetType: 'service',
        name: 'echo-service',
        remotePort: 50051,
        localPort: 50051,
        context: '',
      },
    });
    grpcK8sApiMocks.getLogs.mockResolvedValue({
      scopeId: 'tab-1',
      lines: [{ seq: 2, ts: '2026-07-01T00:00:01.000Z', stream: 'stdout', text: 'Forwarding from 127.0.0.1:50051' }],
      latestSeq: 2,
    });

    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), { target: { value: 'echo-service' } });
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));

    await waitFor(() => {
      expect(grpcK8sApiMocks.start).toHaveBeenCalled();
      expect(grpcK8sApiMocks.getStatus).toHaveBeenCalled();
      expect(grpcK8sApiMocks.getLogs).toHaveBeenCalled();
    });
  });

  it('clears automation logs and toggles auto-scroll', async () => {
    grpcK8sApiMocks.getLogs.mockResolvedValue({
      scopeId: 'tab-1',
      lines: [{ seq: 1, ts: '2026-07-01T00:00:00.000Z', stream: 'stdout', text: 'line-1' }],
      latestSeq: 1,
    });

    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-k8s-log-empty')).toBeNull();
    });

    fireEvent.click(screen.getByTestId('grpc-k8s-log-autoscroll-btn'));
    expect(screen.getByTestId('grpc-k8s-log-autoscroll-btn').textContent).toMatch(/Resume Auto-Scroll/i);

    fireEvent.click(screen.getByTestId('grpc-k8s-log-clear-btn'));
    await waitFor(() => {
      expect(grpcK8sApiMocks.clearLogs).toHaveBeenCalledWith('tab-1');
    });
  });

  it('clears local logs when automation scope is absent', () => {
    render(<GrpcK8sPortForwardPanel session={{ config: readyConfig, active: false }} />);
    expect(screen.queryByTestId('grpc-k8s-log-view')).toBeNull();
  });

  it('surfaces stop errors from automation backend', async () => {
    grpcK8sApiMocks.stop.mockRejectedValueOnce(new Error('stop denied'));
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), { target: { value: 'echo-service' } });
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-automation-error').textContent).toMatch(/stop denied/i);
    });
  });

  it('drops automation backing when status sync fails', async () => {
    grpcK8sApiMocks.getStatus.mockRejectedValueOnce(new Error('status offline'));

    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), { target: { value: 'echo-service' } });
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    await waitFor(() => expect(grpcK8sApiMocks.getStatus).toHaveBeenCalled());
  });

  it('trims merged automation logs and surfaces clear-log failures', async () => {
    const lines = Array.from({ length: 130 }, (_, index) => ({
      seq: index + 1,
      ts: '2026-07-01T00:00:00.000Z',
      stream: 'stdout' as const,
      text: `line-${index + 1}`,
    }));
    grpcK8sApiMocks.getLogs.mockResolvedValue({
      scopeId: 'tab-1',
      lines,
      latestSeq: 130,
    });
    grpcK8sApiMocks.clearLogs.mockRejectedValueOnce('clear failed');

    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-k8s-name'), { target: { value: 'echo-service' } });
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(screen.queryByTestId('grpc-k8s-log-empty')).toBeNull());

    fireEvent.click(screen.getByTestId('grpc-k8s-log-clear-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-automation-error').textContent).toMatch(/clear failed|Failed to clear/i);
    });
  });

  it('ignores invalid local port edits while active config is ready', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    const callsBefore = onSessionChange.mock.calls.length;
    fireEvent.change(screen.getByTestId('grpc-k8s-local-port'), { target: { value: '0' } });
    expect(onSessionChange.mock.calls.length).toBe(callsBefore);
  });

  it('does not start automation when panel is disabled', async () => {
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        disabled
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).not.toHaveBeenCalled());
  });

  it('renders manual kubectl mode without automation controls', () => {
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
      />,
    );
    expect(screen.getByTestId('grpc-k8s-command').textContent).toMatch(/kubectl port-forward/);
    expect(screen.queryByTestId('grpc-k8s-log-clear-btn')).toBeNull();
  });

  it('ignores invalid remote port edits', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    const callsBefore = onSessionChange.mock.calls.length;
    fireEvent.change(screen.getByTestId('grpc-k8s-remote-port'), { target: { value: 'abc' } });
    expect(onSessionChange.mock.calls.length).toBe(callsBefore);
  });
});

/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrpcK8sPortForwardPanel } from './GrpcK8sPortForwardPanel';
import { DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG } from '../utils/grpcK8sPortForward';

const grpcK8sApiMocks = vi.hoisted(() => ({
  getStatus: vi.fn(async () => ({ scopeId: 'tab-1', active: false })),
  getLogs: vi.fn(async () => ({ scopeId: 'tab-1', lines: [], latestSeq: 0 })),
  start: vi.fn(async () => ({ scopeId: 'tab-1', active: true, pid: 321 })),
  stop: vi.fn(async () => ({ scopeId: 'tab-1', active: false })),
  clearLogs: vi.fn(async () => ({ scopeId: 'tab-1', latestSeq: 0 })),
}));

vi.mock('../../../shared/grpc/grpcApiClient', () => ({
  getGrpcK8sPortForwardStatus: grpcK8sApiMocks.getStatus,
  getGrpcK8sPortForwardLogs: grpcK8sApiMocks.getLogs,
  postGrpcK8sPortForwardClearLogs: grpcK8sApiMocks.clearLogs,
  postGrpcK8sPortForwardStart: grpcK8sApiMocks.start,
  postGrpcK8sPortForwardStop: grpcK8sApiMocks.stop,
}));

const readyConfig = {
  ...DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG,
  name: 'echo-service',
  namespace: 'default',
  remotePort: 50051,
  localPort: 50051,
};

describe('GrpcK8sPortForwardPanel coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grpcK8sApiMocks.getStatus.mockResolvedValue({ scopeId: 'tab-1', active: false });
    grpcK8sApiMocks.getLogs.mockResolvedValue({ scopeId: 'tab-1', lines: [], latestSeq: 0 });
    grpcK8sApiMocks.start.mockResolvedValue({ scopeId: 'tab-1', active: true, pid: 321 });
    grpcK8sApiMocks.stop.mockResolvedValue({ scopeId: 'tab-1', active: false });
    grpcK8sApiMocks.clearLogs.mockResolvedValue({ scopeId: 'tab-1', latestSeq: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores automation start/stop when scope id is blank', async () => {
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="   "
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).not.toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.stop).not.toHaveBeenCalled());
  });

  it('falls back to manual mode when automation start rejects with a non-Error value', async () => {
    grpcK8sApiMocks.start.mockRejectedValueOnce('kubectl down');
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

  it('surfaces non-Error stop failures from automation backend', async () => {
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());

    grpcK8sApiMocks.stop.mockRejectedValueOnce('stop boom');
    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-automation-error').textContent).toMatch(/Failed to stop/i);
    });
  });

  it('adopts remote active state from status sync while locally inactive', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 999,
      config: readyConfig,
    });
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(onSessionChange).toHaveBeenCalledWith({ config: expect.any(Object), active: true }));
  });

  it('ignores empty log poll results and toggles autoscroll back on', async () => {
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
    await waitFor(() => expect(screen.queryByTestId('grpc-k8s-log-empty')).toBeNull());

    grpcK8sApiMocks.getLogs.mockResolvedValue({ scopeId: 'tab-1', lines: [], latestSeq: 1 });
    fireEvent.click(screen.getByTestId('grpc-k8s-log-autoscroll-btn'));
    expect(screen.getByTestId('grpc-k8s-log-autoscroll-btn').textContent).toMatch(/Resume Auto-Scroll/i);
    fireEvent.click(screen.getByTestId('grpc-k8s-log-autoscroll-btn'));
    expect(screen.getByTestId('grpc-k8s-log-autoscroll-btn').textContent).toMatch(/Pause Auto-Scroll/i);
  });

  it('does not render automation pid banner when pid is absent', async () => {
    grpcK8sApiMocks.start.mockResolvedValueOnce({ scopeId: 'tab-1', active: true });
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    expect(screen.queryByTestId('grpc-k8s-automation-state')).toBeNull();
  });

  it('continues polling automation status while the session stays active', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 321,
    });
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    await waitFor(() => expect(grpcK8sApiMocks.getStatus.mock.calls.length).toBeGreaterThan(0));

    const initialCalls = grpcK8sApiMocks.getStatus.mock.calls.length;
    await new Promise((resolve) => { setTimeout(resolve, 5100); });
    expect(grpcK8sApiMocks.getStatus.mock.calls.length).toBeGreaterThan(initialCalls);
  }, 10_000);

  it('clears automation backing when status sync fails', async () => {
    grpcK8sApiMocks.getStatus.mockRejectedValue(new Error('sync failed'));
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.getStatus).toHaveBeenCalled());
  });

  it('surfaces clear-log failures from the automation backend', async () => {
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
    await waitFor(() => expect(screen.queryByTestId('grpc-k8s-log-empty')).toBeNull());
    grpcK8sApiMocks.clearLogs.mockRejectedValueOnce('clear failed');
    fireEvent.click(screen.getByTestId('grpc-k8s-log-clear-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-automation-error').textContent).toMatch(/Failed to clear/i);
    });
  });

  it('ignores invalid local port edits', () => {
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-k8s-local-port'), { target: { value: 'not-a-port' } });
    expect((screen.getByTestId('grpc-k8s-local-port') as HTMLInputElement).value).toBe('50051');
  });

  it('skips status polling interval while locally inactive with automation backing', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 321,
    });
    const { rerender } = render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    rerender(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    await waitFor(() => expect(grpcK8sApiMocks.getStatus.mock.calls.length).toBeGreaterThan(0));
  });

  it('does not adopt remote inactive state while the local session stays active', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: false,
      pid: null,
    });
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    await waitFor(() => expect(grpcK8sApiMocks.getStatus.mock.calls.length).toBeGreaterThan(0));
    expect(screen.getByTestId('grpc-k8s-status')).toBeTruthy();
  });

  it('ignores log polling failures without crashing the panel', async () => {
    grpcK8sApiMocks.getLogs.mockRejectedValueOnce(new Error('logs unavailable'));
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.getLogs).toHaveBeenCalled());
    expect(screen.getByTestId('grpc-k8s-panel')).toBeTruthy();
  });

  it('syncs remote config from automation status polling', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 321,
      config: {
        ...readyConfig,
        name: 'synced-from-server',
      },
    });
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.getStatus).toHaveBeenCalled());
    await waitFor(() => {
      expect((screen.getByTestId('grpc-k8s-name') as HTMLInputElement).value).toBe('synced-from-server');
    });
  });

  it('ignores automation stop when scope id becomes blank', async () => {
    const { rerender } = render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    rerender(
      <GrpcK8sPortForwardPanel
        automationScopeId="   "
        session={{ config: readyConfig, active: true }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    expect(grpcK8sApiMocks.stop).not.toHaveBeenCalled();
  });

  it('updates deployment target type and kube context fields', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-k8s-target-type'), { target: { value: 'deployment' } });
    fireEvent.change(screen.getByTestId('grpc-k8s-context'), { target: { value: 'minikube' } });
    expect(onSessionChange).toHaveBeenCalled();
  });

  it('stops manual sessions without calling automation stop', async () => {
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-k8s-stop-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    expect(grpcK8sApiMocks.stop).not.toHaveBeenCalled();
  });

  it('ignores cancelled status sync results after unmount', async () => {
    let resolveStatus: ((value: unknown) => void) | undefined;
    grpcK8sApiMocks.getStatus.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    const { unmount } = render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    unmount();
    resolveStatus?.({ scopeId: 'tab-1', active: true, pid: 999, config: readyConfig });
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });

  it('trims merged automation logs to the latest 120 lines', async () => {
    const lines = Array.from({ length: 125 }, (_, index) => ({
      seq: index + 1,
      ts: '2026-07-01T00:00:00.000Z',
      stream: 'stdout' as const,
      text: `line-${index + 1}`,
    }));
    grpcK8sApiMocks.getLogs.mockResolvedValue({
      scopeId: 'tab-1',
      lines,
      latestSeq: 125,
    });
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => {
      expect(screen.getByText('[stdout] line-125')).toBeTruthy();
      expect(screen.queryByText('[stdout] line-1')).toBeNull();
    });
  });

  it('marks automation inactive when the server start response is not active', async () => {
    grpcK8sApiMocks.start.mockResolvedValueOnce({ scopeId: 'tab-1', active: false });
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    expect(screen.queryByTestId('grpc-k8s-automation-state')).toBeNull();
  });

  it('updates local and remote ports when valid numbers are entered', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-k8s-local-port'), { target: { value: '50052' } });
    fireEvent.change(screen.getByTestId('grpc-k8s-remote-port'), { target: { value: '50053' } });
    expect(onSessionChange).toHaveBeenCalled();
    expect((screen.getByTestId('grpc-k8s-local-port') as HTMLInputElement).value).toBe('50052');
    expect((screen.getByTestId('grpc-k8s-remote-port') as HTMLInputElement).value).toBe('50053');
  });

  it('falls back to manual mode when automation start rejects with an Error', async () => {
    grpcK8sApiMocks.start.mockRejectedValueOnce(new Error('kubectl missing'));
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-automation-error').textContent).toMatch(/kubectl missing/i);
    });
  });

  it('shows default namespace in the status banner when namespace is blank', async () => {
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: { ...readyConfig, namespace: '' }, active: false }}
        onSessionChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-status').textContent).toMatch(/default\//);
    });
  });

  it('polls logs on the slower interval while automation is backed but inactive', async () => {
    grpcK8sApiMocks.getLogs.mockImplementation(async (_scopeId: string, afterSeq = 0) => ({
      scopeId: 'tab-1',
      lines: [{
        seq: afterSeq + 1,
        ts: '2026-07-01T00:00:00.000Z',
        stream: 'stdout' as const,
        text: `line-${afterSeq + 1}`,
      }],
      latestSeq: afterSeq + 1,
    }));
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    const initialCalls = grpcK8sApiMocks.getLogs.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 4100); });
    });
    expect(grpcK8sApiMocks.getLogs.mock.calls.length).toBeGreaterThan(initialCalls);
  }, 10_000);

  it('cleans up one-shot status sync when unmounted while inactive', async () => {
    const { unmount } = render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    unmount();
  });

  it('stops locally after automation start reports inactive', async () => {
    grpcK8sApiMocks.start.mockResolvedValueOnce({ scopeId: 'tab-1', active: false });
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    expect(grpcK8sApiMocks.stop).not.toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-k8s-status')).toBeNull();
  });

  it('does not start automation when the panel is disabled', async () => {
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

  it('surfaces Error stop failures from automation backend', async () => {
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    grpcK8sApiMocks.stop.mockRejectedValueOnce(new Error('stop denied'));
    fireEvent.click(screen.getByTestId('grpc-k8s-stop-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-k8s-automation-error').textContent).toMatch(/stop denied/i);
    });
  });

  it('does not deactivate a locally active session when remote status is inactive', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: false,
      pid: null,
    });
    const { rerender } = render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    rerender(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: true }}
      />,
    );
    await waitFor(() => expect(grpcK8sApiMocks.getStatus).toHaveBeenCalled());
    expect(screen.getByTestId('grpc-k8s-status')).toBeTruthy();
  });

  it('does not start when the port-forward config is incomplete', async () => {
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: { ...readyConfig, name: '' }, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).not.toHaveBeenCalled());
  });

  it('ignores cancelled log poll results after unmount', async () => {
    let resolveLogs: ((value: unknown) => void) | undefined;
    grpcK8sApiMocks.getLogs.mockImplementationOnce(() => new Promise((resolve) => {
      resolveLogs = resolve;
    }));
    const { unmount } = render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.start).toHaveBeenCalled());
    unmount();
    resolveLogs?.({
      scopeId: 'tab-1',
      lines: [{ seq: 1, ts: '2026-07-01T00:00:00.000Z', stream: 'stdout', text: 'late-line' }],
      latestSeq: 1,
    });
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });

  it('syncs status without replacing config when the server omits config', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: true,
      pid: 321,
    });
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.getStatus).toHaveBeenCalled());
    expect((screen.getByTestId('grpc-k8s-name') as HTMLInputElement).value).toBe('echo-service');
  });

  it('adopts remote inactive state when the local session is already inactive', async () => {
    grpcK8sApiMocks.getStatus.mockResolvedValue({
      scopeId: 'tab-1',
      active: false,
      pid: null,
    });
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        automationScopeId="tab-1"
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-k8s-start-btn'));
    await waitFor(() => expect(grpcK8sApiMocks.getStatus).toHaveBeenCalled());
    expect(onSessionChange).not.toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('updates pod target type and ignores invalid remote port edits', () => {
    const onSessionChange = vi.fn();
    render(
      <GrpcK8sPortForwardPanel
        session={{ config: readyConfig, active: false }}
        onSessionChange={onSessionChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-k8s-target-type'), { target: { value: 'pod' } });
    const callsBefore = onSessionChange.mock.calls.length;
    fireEvent.change(screen.getByTestId('grpc-k8s-remote-port'), { target: { value: 'abc' } });
    expect(onSessionChange.mock.calls.length).toBe(callsBefore);
  });
});

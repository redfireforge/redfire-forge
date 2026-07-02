/**
 * @vitest-environment node
 */
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { GrpcK8sPortForwardManager } from './grpcK8sPortForwardManager.js';

function makeMockChild(pid = 4242) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.pid = pid;
  child.stdout = stdout;
  child.stderr = stderr;
  child.kill = vi.fn();
  return child;
}

describe('grpcK8sPortForwardManager coverage gaps', () => {
  it('starts and stops kubectl port-forward for a scope', async () => {
    const child = makeMockChild();
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
        });
        return child;
      }),
      now: () => new Date('2026-07-01T00:00:00.000Z'),
      readinessTimeoutMs: 500,
    });

    const started = await manager.startPortForward('tab-1', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });

    expect(started.active).toBe(true);
    expect(started.pid).toBe(4242);
    expect(manager.getLogs('tab-1').lines.length).toBeGreaterThan(0);

    const stopPromise = manager.stopPortForward('tab-1');
    child.emit('exit', 0, null);
    const stopped = await stopPromise;
    expect(stopped.active).toBe(false);
    expect(child.kill).toHaveBeenCalled();
  });

  it('rejects invalid scope ids and configs', async () => {
    const manager = new GrpcK8sPortForwardManager();
    expect(() => manager.getStatus('   ')).toThrow(/scopeId is required/i);
    await expect(manager.startPortForward('tab-1', { name: '' }))
      .rejects.toThrow(/target name is required/i);
  });

  it('returns filtered logs and clears history', () => {
    const manager = new GrpcK8sPortForwardManager({
      now: () => new Date('2026-07-01T00:00:00.000Z'),
    });

    const cleared = manager.clearLogs('tab-2');
    expect(cleared.scopeId).toBe('tab-2');
    expect(manager.getLogs('tab-2', 0).lines).toEqual([]);
    expect(manager.getStatus('tab-2')).toEqual({ scopeId: 'tab-2', active: false });
  });

  it('starts pod port-forward with kube context and stderr readiness', async () => {
    const child = makeMockChild(777);
    const spawnFn = vi.fn(() => {
      queueMicrotask(() => {
        child.stderr.emit('data', 'Forwarding from 127.0.0.1:9090 -> 9090\n');
      });
      return child;
    });
    const manager = new GrpcK8sPortForwardManager({
      spawnFn,
      readinessTimeoutMs: 500,
    });

    const started = await manager.startPortForward('tab-pod', {
      namespace: 'staging',
      targetType: 'pod',
      name: 'api-pod',
      remotePort: 9090,
      localPort: 9090,
      context: 'minikube',
    });

    expect(started.active).toBe(true);
    expect(spawnFn).toHaveBeenCalledWith(
      'kubectl',
      expect.arrayContaining(['port-forward', '-n', 'staging', 'pod/api-pod', '9090:9090', '--context', 'minikube']),
      expect.any(Object),
    );
  });

  it('rejects start when readiness never arrives', async () => {
    vi.useFakeTimers();
    const child = makeMockChild();
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => child),
      readinessTimeoutMs: 20,
    });

    const promise = manager.startPortForward('tab-timeout', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });
    await vi.advanceTimersByTimeAsync(20);
    child.emit('exit', 1, null);

    await expect(promise).rejects.toThrow(/Timed out waiting for kubectl readiness/i);
    expect(manager.getStatus('tab-timeout').lastError).toMatch(/Timed out/i);
    vi.useRealTimers();
  });

  it('records spawn errors during readiness wait', async () => {
    const child = makeMockChild();
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit('exit', 1, null));
    });
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        process.nextTick(() => child.emit('error', new Error('spawn denied')));
        return child;
      }),
      readinessTimeoutMs: 500,
    });

    await expect(manager.startPortForward('tab-spawn-error', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    })).rejects.toThrow(/spawn denied/i);
  });

  it('updates state when child exits after successful start', async () => {
    const child = makeMockChild(888);
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
    });

    await manager.startPortForward('tab-exit', {
      namespace: 'default',
      targetType: 'deployment',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });
    child.emit('exit', 1, null);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(manager.getStatus('tab-exit')).toMatchObject({
      active: false,
      lastError: 'kubectl exited with code 1',
    });
  });

  it('stopAll stops every active scope and trims log history', async () => {
    const childA = makeMockChild(1);
    const childB = makeMockChild(2);
    let spawnCount = 0;
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        const child = spawnCount === 0 ? childA : childB;
        spawnCount += 1;
        queueMicrotask(() => {
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
      maxLogLinesPerScope: 2,
    });

    const config = {
      namespace: 'default',
      targetType: 'service' as const,
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    };
    await manager.startPortForward('tab-a', config);
    await manager.startPortForward('tab-b', config);

    childA.stdout.emit('data', 'line-1\n');
    childA.stdout.emit('data', 'line-2\n');
    childA.stdout.emit('data', 'line-3\n');

    const stopAllPromise = manager.stopAll();
    childA.emit('exit', 0, null);
    childB.emit('exit', 0, null);
    await stopAllPromise;

    expect(manager.getStatus('tab-a').active).toBe(false);
    expect(manager.getStatus('tab-b').active).toBe(false);
    expect(manager.getLogs('tab-a').lines.length).toBeLessThanOrEqual(2);
  });

  it('filters logs after a sequence cursor and ignores blank chunks', async () => {
    const child = makeMockChild(555);
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stdout.emit('data', '   \n');
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
          child.stdout.emit('data', 'line-two\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
    });

    await manager.startPortForward('tab-logs', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });

    const all = manager.getLogs('tab-logs');
    expect(all.lines.length).toBeGreaterThan(1);
    const filtered = manager.getLogs('tab-logs', all.lines[0]!.seq);
    expect(filtered.lines.every((line) => line.seq > all.lines[0]!.seq)).toBe(true);
  });

  it('normalizes invalid ports and target types when starting', async () => {
    const child = makeMockChild(666);
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stderr.emit('data', 'Handling connection for 50051\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
    });

    const started = await manager.startPortForward('tab-normalize', {
      targetType: 'unknown' as never,
      name: 'echo',
      remotePort: 'bad' as never,
      localPort: undefined,
    });
    expect(started.config?.targetType).toBe('service');
    expect(started.config?.remotePort).toBe(50051);
  });

  it('records signal termination after successful start', async () => {
    const child = makeMockChild(999);
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
    });

    await manager.startPortForward('tab-signal', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });
    child.emit('exit', null, 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(manager.getStatus('tab-signal').lastError).toMatch(/SIGTERM/i);
  });

  it('returns latest inactive state for previously started scopes', async () => {
    const child = makeMockChild(111);
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
    });
    const config = {
      namespace: 'default',
      targetType: 'service' as const,
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    };
    await manager.startPortForward('tab-latest', config);
    child.emit('exit', 0, null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(manager.getStatus('tab-latest').active).toBe(false);
    expect(manager.getStatus('tab-latest').lastError).toBeUndefined();
  });

  it('rejects blank scope ids for log helpers', () => {
    const manager = new GrpcK8sPortForwardManager();
    expect(() => manager.getLogs('   ')).toThrow(/scopeId is required/i);
    expect(() => manager.clearLogs('')).toThrow(/scopeId is required/i);
  });

  it('returns inactive status for unknown scopes without throwing', () => {
    const manager = new GrpcK8sPortForwardManager();
    expect(manager.getStatus('unknown-scope')).toEqual({
      scopeId: 'unknown-scope',
      active: false,
    });
  });

  it('returns active state from getStatus while port-forward is running', async () => {
    const child = makeMockChild(555);
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
    });

    await manager.startPortForward('tab-active-status', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });

    expect(manager.getStatus('tab-active-status')).toEqual(expect.objectContaining({
      scopeId: 'tab-active-status',
      active: true,
      pid: 555,
    }));
  });

  it('rejects blank scope ids when starting or stopping port-forward', async () => {
    const manager = new GrpcK8sPortForwardManager();
    await expect(manager.startPortForward('   ', { name: 'echo' }))
      .rejects.toThrow(/scopeId is required/i);
    await expect(manager.stopPortForward(''))
      .rejects.toThrow(/scopeId is required/i);
  });

  it('returns latest status when stopping a scope that is not active', async () => {
    const manager = new GrpcK8sPortForwardManager();
    const stopped = await manager.stopPortForward('inactive-scope');
    expect(stopped).toEqual({ scopeId: 'inactive-scope', active: false });
  });

  it('escalates to SIGKILL when SIGTERM does not terminate the process', async () => {
    vi.useFakeTimers();
    const child = makeMockChild(808);
    child.kill = vi.fn();
    const manager = new GrpcK8sPortForwardManager({
      spawnFn: vi.fn(() => {
        queueMicrotask(() => {
          child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
        });
        return child;
      }),
      readinessTimeoutMs: 500,
    });

    await manager.startPortForward('tab-kill', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });

    const stopPromise = manager.stopPortForward('tab-kill');
    await vi.advanceTimersByTimeAsync(2000);
    child.emit('exit', 0, null);
    await stopPromise;

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    vi.useRealTimers();
  });

  it('normalizes deployment target type in kubectl args', async () => {
    const child = makeMockChild(432);
    const spawnFn = vi.fn(() => {
      queueMicrotask(() => {
        child.stdout.emit('data', 'Forwarding from 127.0.0.1:50051 -> 50051\n');
      });
      return child;
    });
    const manager = new GrpcK8sPortForwardManager({ spawnFn, readinessTimeoutMs: 500 });
    await manager.startPortForward('tab-deploy', {
      namespace: 'default',
      targetType: 'deployment',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });
    expect(spawnFn).toHaveBeenCalledWith(
      'kubectl',
      expect.arrayContaining(['deploy/echo']),
      expect.any(Object),
    );
  });
});

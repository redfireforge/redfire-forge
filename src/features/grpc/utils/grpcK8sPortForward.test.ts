import { describe, expect, it } from 'vitest';
import {
  buildKubectlPortForwardCommand,
  buildK8sLocalTarget,
  finalizeGrpcK8sPortForwardConfig,
  formatK8sPortForwardStatus,
  isGrpcK8sPortForwardConfigReady,
  normalizeGrpcK8sPortForwardConfig,
} from './grpcK8sPortForward';

describe('grpcK8sPortForward', () => {
  const baseConfig = normalizeGrpcK8sPortForwardConfig({
    namespace: 'production',
    targetType: 'service',
    name: 'order-service',
    remotePort: 50051,
    localPort: 50051,
    context: 'minikube',
  });

  it('normalizes defaults and port numbers', () => {
    const config = normalizeGrpcK8sPortForwardConfig({
      name: 'echo',
      remotePort: '9090',
      localPort: '9091',
    });
    expect(config.namespace).toBe('default');
    expect(config.targetType).toBe('service');
    expect(config.remotePort).toBe(9090);
    expect(config.localPort).toBe(9091);
  });

  it('detects when config is ready to start', () => {
    expect(isGrpcK8sPortForwardConfigReady(baseConfig)).toBe(true);
    expect(isGrpcK8sPortForwardConfigReady({ ...baseConfig, name: '' })).toBe(false);
    expect(isGrpcK8sPortForwardConfigReady({ ...baseConfig, name: '   ' })).toBe(false);
  });

  it('finalizes trimmed strings for apply without trimming on every keystroke', () => {
    const draft = normalizeGrpcK8sPortForwardConfig({
      namespace: ' staging ',
      targetType: 'service',
      name: ' order-service ',
      remotePort: 50051,
      localPort: 50051,
      context: ' minikube ',
    });
    expect(draft.namespace).toBe(' staging ');
    const finalized = finalizeGrpcK8sPortForwardConfig(draft);
    expect(finalized).toEqual({
      namespace: 'staging',
      targetType: 'service',
      name: 'order-service',
      remotePort: 50051,
      localPort: 50051,
      context: 'minikube',
    });
  });

  it('builds kubectl command with optional context', () => {
    expect(buildKubectlPortForwardCommand(baseConfig)).toBe(
      'kubectl port-forward -n production svc/order-service 50051:50051 --context=minikube',
    );
  });

  it('shell-quotes kubeconfig context values with spaces', () => {
    const config = normalizeGrpcK8sPortForwardConfig({
      ...baseConfig,
      context: 'gke myproject us-central1 production',
    });
    expect(buildKubectlPortForwardCommand(config)).toContain(
      '--context="gke myproject us-central1 production"',
    );
  });

  it('shell-quotes namespace and resource segments with spaces', () => {
    const config = normalizeGrpcK8sPortForwardConfig({
      namespace: 'my team',
      targetType: 'service',
      name: 'order service',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });
    expect(buildKubectlPortForwardCommand(config)).toBe(
      'kubectl port-forward -n "my team" "svc/order service" 50051:50051',
    );
  });

  it('builds local target and status line', () => {
    expect(buildK8sLocalTarget(baseConfig)).toBe('localhost:50051');
    expect(formatK8sPortForwardStatus(baseConfig)).toBe(
      'Forwarding: localhost:50051 → production/order-service:50051',
    );
  });
});

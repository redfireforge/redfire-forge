import { describe, expect, it } from 'vitest';
import {
  buildKubectlPortForwardCommand,
  DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG,
  formatK8sPortForwardStatus,
  isGrpcK8sPortForwardConfigReady,
  normalizeGrpcK8sPortForwardConfig,
  normalizeGrpcK8sPortNumber,
} from './grpcK8sPortForward';

describe('grpcK8sPortForward coverage gaps', () => {
  it('normalizeGrpcK8sPortNumber rejects invalid values', () => {
    expect(normalizeGrpcK8sPortNumber('')).toBeUndefined();
    expect(normalizeGrpcK8sPortNumber('abc')).toBeUndefined();
    expect(normalizeGrpcK8sPortNumber(0)).toBeUndefined();
    expect(normalizeGrpcK8sPortNumber(70000)).toBeUndefined();
    expect(normalizeGrpcK8sPortNumber('50051')).toBe(50051);
    expect(normalizeGrpcK8sPortNumber(8080)).toBe(8080);
  });

  it('normalizeGrpcK8sPortForwardConfig handles pod and deployment target types', () => {
    const pod = normalizeGrpcK8sPortForwardConfig({ targetType: 'pod', name: 'echo' });
    expect(pod.targetType).toBe('pod');
    const deploy = normalizeGrpcK8sPortForwardConfig({ targetType: 'deployment', name: 'echo' });
    expect(deploy.targetType).toBe('deployment');
    const invalid = normalizeGrpcK8sPortForwardConfig({ targetType: 'invalid' as 'pod', name: 'x' });
    expect(invalid.targetType).toBe('service');
  });

  it('normalizeGrpcK8sPortForwardConfig preserves explicit namespace and defaults local port', () => {
    const config = normalizeGrpcK8sPortForwardConfig({
      namespace: 'staging',
      name: 'api',
      remotePort: 9090,
    });
    expect(config.namespace).toBe('staging');
    expect(config.localPort).toBe(9090);
  });

  it('buildKubectlPortForwardCommand omits context flag when empty', () => {
    const config = normalizeGrpcK8sPortForwardConfig({
      namespace: 'default',
      targetType: 'pod',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });
    expect(buildKubectlPortForwardCommand(config)).toBe(
      'kubectl port-forward -n default pod/echo 50051:50051',
    );
  });

  it('formatK8sPortForwardStatus falls back to default namespace', () => {
    const config = normalizeGrpcK8sPortForwardConfig({
      namespace: '  ',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
    });
    expect(formatK8sPortForwardStatus(config)).toContain('default/echo');
  });

  it('isGrpcK8sPortForwardConfigReady rejects invalid port numbers', () => {
    expect(isGrpcK8sPortForwardConfigReady({
      ...DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG,
      name: 'echo',
      remotePort: 0,
      localPort: 50051,
    })).toBe(false);
    expect(isGrpcK8sPortForwardConfigReady({
      ...DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG,
      name: 'echo',
      remotePort: 50051,
      localPort: 0,
    })).toBe(false);
  });
});

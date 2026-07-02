/**
 * Phase 4J-D — Kubernetes port-forward helpers (manual + automation fallback workflow).
 */

export type GrpcK8sTargetType = 'service' | 'pod' | 'deployment';

export interface GrpcK8sPortForwardConfig {
  namespace: string;
  targetType: GrpcK8sTargetType;
  name: string;
  remotePort: number;
  localPort: number;
  context: string;
}

export interface GrpcK8sPortForwardSession {
  config: GrpcK8sPortForwardConfig;
  active: boolean;
}

export const DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG: GrpcK8sPortForwardConfig = {
  namespace: 'default',
  targetType: 'service',
  name: '',
  remotePort: 50051,
  localPort: 50051,
  context: '',
};

const K8S_TARGET_RESOURCE_PREFIX: Record<GrpcK8sTargetType, string> = {
  service: 'svc',
  pod: 'pod',
  deployment: 'deploy',
};

export function normalizeGrpcK8sPortNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
      return parsed;
    }
  }
  return undefined;
}

export function normalizeGrpcK8sPortForwardConfig(
  config: Partial<GrpcK8sPortForwardConfig> | undefined,
): GrpcK8sPortForwardConfig {
  const remotePort = normalizeGrpcK8sPortNumber(config?.remotePort) ?? 50051;
  const localPort = normalizeGrpcK8sPortNumber(config?.localPort) ?? remotePort;
  const targetType = config?.targetType === 'pod' || config?.targetType === 'deployment'
    ? config.targetType
    : 'service';
  return {
    namespace: config?.namespace !== undefined ? config.namespace : 'default',
    targetType,
    name: config?.name ?? '',
    remotePort,
    localPort,
    context: config?.context ?? '',
  };
}

export function isGrpcK8sPortForwardConfigReady(config: GrpcK8sPortForwardConfig): boolean {
  return Boolean(
    config.name.trim()
    && normalizeGrpcK8sPortNumber(config.remotePort) != null
    && normalizeGrpcK8sPortNumber(config.localPort) != null,
  );
}

/** Trim user-entered strings before persisting an active/inactive session (not on every keystroke). */
export function finalizeGrpcK8sPortForwardConfig(
  config: GrpcK8sPortForwardConfig,
): GrpcK8sPortForwardConfig {
  return normalizeGrpcK8sPortForwardConfig({
    ...config,
    namespace: config.namespace.trim() || 'default',
    name: config.name.trim(),
    context: config.context.trim(),
  });
}

function shellQuoteKubectlArg(value: string): string {
  if (/^[A-Za-z0-9._:@/=-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function buildK8sLocalTarget(config: GrpcK8sPortForwardConfig): string {
  return `localhost:${config.localPort}`;
}

export function formatK8sPortForwardStatus(config: GrpcK8sPortForwardConfig): string {
  const namespace = config.namespace.trim() || 'default';
  const name = config.name.trim();
  return `Forwarding: localhost:${config.localPort} → ${namespace}/${name}:${config.remotePort}`;
}

export function buildKubectlPortForwardCommand(config: GrpcK8sPortForwardConfig): string {
  const namespace = shellQuoteKubectlArg(config.namespace.trim() || 'default');
  const name = config.name.trim();
  const resource = shellQuoteKubectlArg(`${K8S_TARGET_RESOURCE_PREFIX[config.targetType]}/${name}`);
  const contextFlag = config.context.trim()
    ? ` --context=${shellQuoteKubectlArg(config.context.trim())}`
    : '';
  return `kubectl port-forward -n ${namespace} ${resource} ${config.localPort}:${config.remotePort}${contextFlag}`;
}

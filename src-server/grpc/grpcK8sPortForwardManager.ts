import { spawn as nodeSpawn, type ChildProcess, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { once } from 'node:events';

export type GrpcK8sTargetType = 'service' | 'pod' | 'deployment';

export interface GrpcK8sPortForwardConfig {
  namespace: string;
  targetType: GrpcK8sTargetType;
  name: string;
  remotePort: number;
  localPort: number;
  context: string;
}

export interface GrpcK8sPortForwardState {
  scopeId: string;
  active: boolean;
  pid?: number;
  command?: string;
  target?: string;
  startedAt?: string;
  lastError?: string;
  config?: GrpcK8sPortForwardConfig;
}

export interface GrpcK8sPortForwardLogLine {
  seq: number;
  ts: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

export interface GrpcK8sPortForwardLogsResult {
  scopeId: string;
  lines: GrpcK8sPortForwardLogLine[];
  latestSeq: number;
}

export interface GrpcK8sPortForwardLogClearResult {
  scopeId: string;
  latestSeq: number;
}

type SpawnFn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcess;

interface GrpcK8sPortForwardManagerDeps {
  spawnFn?: SpawnFn;
  now?: () => Date;
  readinessTimeoutMs?: number;
  maxLogLinesPerScope?: number;
}

interface ActiveProcessEntry {
  child: ChildProcess;
  state: GrpcK8sPortForwardState;
}

const RESOURCE_PREFIX: Record<GrpcK8sTargetType, string> = {
  service: 'svc',
  pod: 'pod',
  deployment: 'deploy',
};

function parsePort(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

function normalizeConfig(input: Partial<GrpcK8sPortForwardConfig>): GrpcK8sPortForwardConfig {
  const namespace = (input.namespace ?? '').trim() || 'default';
  const name = (input.name ?? '').trim();
  const targetType = input.targetType === 'pod' || input.targetType === 'deployment'
    ? input.targetType
    : 'service';
  const remotePort = parsePort(input.remotePort) ?? 50051;
  const localPort = parsePort(input.localPort) ?? remotePort;
  const context = (input.context ?? '').trim();
  return {
    namespace,
    targetType,
    name,
    remotePort,
    localPort,
    context,
  };
}

function assertReadyConfig(config: GrpcK8sPortForwardConfig): void {
  if (!config.name) {
    throw new Error('K8s target name is required');
  }
  if (parsePort(config.remotePort) == null || parsePort(config.localPort) == null) {
    throw new Error('K8s port values must be within 1-65535');
  }
}

function buildKubectlArgs(config: GrpcK8sPortForwardConfig): string[] {
  const args = [
    'port-forward',
    '-n',
    config.namespace,
    `${RESOURCE_PREFIX[config.targetType]}/${config.name}`,
    `${config.localPort}:${config.remotePort}`,
  ];
  if (config.context) {
    args.push('--context', config.context);
  }
  return args;
}

function buildCommandText(args: string[]): string {
  return ['kubectl', ...args].join(' ');
}

async function waitForExit(child: ChildProcess): Promise<void> {
  try {
    await once(child, 'exit');
  } catch {
    // Ignore event race conditions during shutdown.
  }
}

export class GrpcK8sPortForwardManager {
  private readonly spawnFn: SpawnFn;

  private readonly now: () => Date;

  private readonly readinessTimeoutMs: number;

  private readonly maxLogLinesPerScope: number;

  private readonly activeByScope = new Map<string, ActiveProcessEntry>();

  private readonly latestStateByScope = new Map<string, GrpcK8sPortForwardState>();

  private readonly logsByScope = new Map<string, GrpcK8sPortForwardLogLine[]>();

  private readonly latestSeqByScope = new Map<string, number>();

  constructor(deps: GrpcK8sPortForwardManagerDeps = {}) {
    this.spawnFn = deps.spawnFn ?? nodeSpawn;
    this.now = deps.now ?? (() => new Date());
    this.readinessTimeoutMs = deps.readinessTimeoutMs ?? 8_000;
    this.maxLogLinesPerScope = deps.maxLogLinesPerScope ?? 250;
  }

  getLogs(scopeId: string, afterSeq?: number): GrpcK8sPortForwardLogsResult {
    const normalizedScopeId = scopeId.trim();
    if (!normalizedScopeId) {
      throw new Error('scopeId is required');
    }
    const lines = this.logsByScope.get(normalizedScopeId) ?? [];
    const filtered = afterSeq == null
      ? lines
      : lines.filter((line) => line.seq > afterSeq);
    return {
      scopeId: normalizedScopeId,
      lines: filtered,
      latestSeq: this.latestSeqByScope.get(normalizedScopeId) ?? 0,
    };
  }

  clearLogs(scopeId: string): GrpcK8sPortForwardLogClearResult {
    const normalizedScopeId = scopeId.trim();
    if (!normalizedScopeId) {
      throw new Error('scopeId is required');
    }
    this.logsByScope.set(normalizedScopeId, []);
    return {
      scopeId: normalizedScopeId,
      latestSeq: this.latestSeqByScope.get(normalizedScopeId) ?? 0,
    };
  }

  private appendLog(scopeId: string, stream: GrpcK8sPortForwardLogLine['stream'], text: string): void {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return;
    }
    const nextSeq = (this.latestSeqByScope.get(scopeId) ?? 0) + 1;
    this.latestSeqByScope.set(scopeId, nextSeq);
    const entry: GrpcK8sPortForwardLogLine = {
      seq: nextSeq,
      ts: this.now().toISOString(),
      stream,
      text: normalizedText,
    };
    const current = this.logsByScope.get(scopeId) ?? [];
    current.push(entry);
    if (current.length > this.maxLogLinesPerScope) {
      current.splice(0, current.length - this.maxLogLinesPerScope);
    }
    this.logsByScope.set(scopeId, current);
  }

  getStatus(scopeId: string): GrpcK8sPortForwardState {
    const normalizedScopeId = scopeId.trim();
    if (!normalizedScopeId) {
      throw new Error('scopeId is required');
    }
    const active = this.activeByScope.get(normalizedScopeId);
    if (active) {
      return {
        ...active.state,
        active: true,
      };
    }
    const latest = this.latestStateByScope.get(normalizedScopeId);
    if (latest) {
      return {
        ...latest,
        active: false,
      };
    }
    return {
      scopeId: normalizedScopeId,
      active: false,
    };
  }

  async startPortForward(
    scopeId: string,
    inputConfig: Partial<GrpcK8sPortForwardConfig>,
  ): Promise<GrpcK8sPortForwardState> {
    const normalizedScopeId = scopeId.trim();
    if (!normalizedScopeId) {
      throw new Error('scopeId is required');
    }

    const config = normalizeConfig(inputConfig);
    assertReadyConfig(config);

    await this.stopPortForward(normalizedScopeId, true);

    const args = buildKubectlArgs(config);
    const startedAt = this.now().toISOString();
    const state: GrpcK8sPortForwardState = {
      scopeId: normalizedScopeId,
      active: false,
      command: buildCommandText(args),
      target: `localhost:${config.localPort}`,
      startedAt,
      config,
    };

    const child = this.spawnFn('kubectl', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    this.appendLog(normalizedScopeId, 'system', `Starting: ${state.command}`);

    child.stdout?.on('data', (chunk: Buffer | string) => {
      this.appendLog(normalizedScopeId, 'stdout', String(chunk).trim());
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      this.appendLog(normalizedScopeId, 'stderr', String(chunk).trim());
    });

    if (child.pid != null) {
      state.pid = child.pid;
    }

    const entry: ActiveProcessEntry = {
      child,
      state,
    };

    this.activeByScope.set(normalizedScopeId, entry);

    const readinessError = await new Promise<string | null>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
      };
      const finish = (error: string | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(error);
      };

      const onData = (chunk: Buffer | string) => {
        const text = String(chunk);
        if (text.includes('Forwarding from') || text.includes('Handling connection for')) {
          finish(null);
        }
      };

      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);

      child.once('error', (error) => {
        finish(error instanceof Error ? error.message : 'Failed to start kubectl');
      });

      child.once('exit', (code, signal) => {
        const details = signal
          ? `kubectl exited via ${signal}`
          : `kubectl exited with code ${code ?? 'unknown'}`;
        finish(details);
      });

      timeout = setTimeout(() => {
        finish(`Timed out waiting for kubectl readiness after ${this.readinessTimeoutMs}ms`);
      }, this.readinessTimeoutMs);
    });

    if (readinessError) {
      await this.stopPortForward(normalizedScopeId, true);
      this.appendLog(normalizedScopeId, 'system', `Start failed: ${readinessError}`);
      const failedState: GrpcK8sPortForwardState = {
        ...state,
        active: false,
        lastError: readinessError,
      };
      this.latestStateByScope.set(normalizedScopeId, failedState);
      throw new Error(readinessError);
    }

    entry.state = {
      ...entry.state,
      active: true,
      lastError: undefined,
    };
    this.latestStateByScope.set(normalizedScopeId, entry.state);
    this.appendLog(normalizedScopeId, 'system', `Ready: ${entry.state.target ?? 'localhost'}`);

    child.once('exit', (code, signal) => {
      this.activeByScope.delete(normalizedScopeId);
      const lastError = signal
        ? `kubectl terminated (${signal})`
        : (code && code !== 0 ? `kubectl exited with code ${code}` : undefined);
      this.appendLog(
        normalizedScopeId,
        'system',
        signal ? `Exited via ${signal}` : `Exited with code ${code ?? 'unknown'}`,
      );
      this.latestStateByScope.set(normalizedScopeId, {
        ...entry.state,
        active: false,
        lastError,
      });
    });

    return entry.state;
  }

  async stopPortForward(scopeId: string, ignoreMissing = false): Promise<GrpcK8sPortForwardState> {
    const normalizedScopeId = scopeId.trim();
    if (!normalizedScopeId) {
      throw new Error('scopeId is required');
    }

    const entry = this.activeByScope.get(normalizedScopeId);
    if (!entry) {
      if (!ignoreMissing) {
        return this.getStatus(normalizedScopeId);
      }
      return {
        scopeId: normalizedScopeId,
        active: false,
      };
    }

    const { child, state } = entry;
    this.activeByScope.delete(normalizedScopeId);

    try {
      child.kill('SIGTERM');
      this.appendLog(normalizedScopeId, 'system', 'Stopping process (SIGTERM)');
    } catch {
      // ignore kill race
    }

    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore kill race
      }
    }, 2_000);

    await waitForExit(child);
    clearTimeout(timeout);

    const stopped: GrpcK8sPortForwardState = {
      ...state,
      active: false,
    };
    this.latestStateByScope.set(normalizedScopeId, stopped);
    return stopped;
  }

  async stopAll(): Promise<void> {
    const scopes = [...this.activeByScope.keys()];
    for (const scopeId of scopes) {
      await this.stopPortForward(scopeId, true);
    }
  }
}

export const grpcK8sPortForwardManager = new GrpcK8sPortForwardManager();

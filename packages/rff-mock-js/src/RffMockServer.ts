/**
 * RffMockServer — subprocess wrapper around the rff CLI.
 *
 * Manages the full lifecycle: start, wait-ready (via /__rff/health/ready),
 * expose baseUrl, stop.
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, mkdtempSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/** Tuning options for {@link RffMockServer}. */
export interface RffMockConfig {
  /**
   * Path or name of the rff binary.
   * Defaults to `RFF_BINARY` env var, then `rff` (resolved from PATH).
   */
  rffBinary?: string;

  /** Specific server id from a multi-server workspace. Defaults to first/active server. */
  serverId?: string;

  /** Max milliseconds to wait for the server to become ready (default: 30 000). */
  timeoutMs?: number;

  /** Milliseconds between readiness poll attempts (default: 250). */
  pollIntervalMs?: number;
}

/** Built-in health check paths on every mock listener. */
export const HEALTH_READY_PATH = '/__rff/health/ready';
export const HEALTH_LIVE_PATH  = '/__rff/health/live';

/**
 * Manages the lifecycle of a RedfireForge API Mock server subprocess.
 *
 * @example Jest / Vitest global setup
 * ```ts
 * // jest.globalSetup.ts  (or vitest.globalSetup.ts)
 * import { RffMockServer } from '@redfireforge/mock-jest';
 *
 * let mock: RffMockServer;
 *
 * export async function setup() {
 *   mock = await RffMockServer.start('mocks/orders.json');
 *   process.env.MOCK_BASE_URL = mock.baseUrl;
 * }
 *
 * export async function teardown() {
 *   await mock?.stop();
 * }
 * ```
 *
 * @example Direct usage
 * ```ts
 * const mock = await RffMockServer.start('mocks/orders.json');
 * const res = await fetch(`${mock.baseUrl}/orders`);
 * await mock.stop();
 * ```
 */
export class RffMockServer {
  private readonly _process: ChildProcess;
  private readonly _port: number;
  private readonly _portFile: string;

  private constructor(process: ChildProcess, port: number, portFile: string) {
    this._process  = process;
    this._port     = port;
    this._portFile = portFile;
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  /**
   * Start a mock server and wait for it to become ready.
   * @param definitionFile Path to the workspace / server JSON or YAML.
   * @param config         Optional tuning options.
   */
  static async start(definitionFile: string, config?: RffMockConfig): Promise<RffMockServer> {
    const cfg = resolveConfig(config);
    const portFile = join(mkdtempSync(join(tmpdir(), 'rff-mock-')), 'mock.port');

    const args = [
      'mock', 'start', definitionFile,
      '--port', 'auto',
      '--port-file', portFile,
      '--standalone',
    ];
    if (cfg.serverId) args.push('--server', cfg.serverId);

    const proc = spawn(cfg.rffBinary, args, {
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: false,
    });

    proc.on('error', (err) => {
      throw new Error(`Failed to spawn rff: ${err.message}`);
    });

    await waitForReady(portFile, cfg);

    const port = parseInt(readFileSync(portFile, 'utf8').trim(), 10);
    return new RffMockServer(proc, port, portFile);
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  /** The OS port the mock server is listening on. */
  get port(): number { return this._port; }

  /** Full base URL, e.g. `http://localhost:51432`. */
  get baseUrl(): string { return `http://localhost:${this._port}`; }

  /** URL of the built-in readiness probe. */
  get readyUrl(): string { return `${this.baseUrl}${HEALTH_READY_PATH}`; }

  /** URL of the built-in liveness probe. */
  get liveUrl(): string { return `${this.baseUrl}${HEALTH_LIVE_PATH}`; }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /** Stop the mock server and clean up the port file. */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._process.pid || this._process.killed) {
        cleanup(this._portFile);
        resolve();
        return;
      }
      this._process.once('exit', () => { cleanup(this._portFile); resolve(); });
      this._process.kill('SIGTERM');
      // Force-kill after 5 s if it doesn't exit gracefully.
      setTimeout(() => { if (!this._process.killed) this._process.kill('SIGKILL'); }, 5000);
    });
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function resolveConfig(config?: RffMockConfig): Required<RffMockConfig> {
  return {
    rffBinary:      config?.rffBinary      ?? process.env['RFF_BINARY'] ?? 'rff',
    serverId:       config?.serverId       ?? '',
    timeoutMs:      config?.timeoutMs      ?? 30_000,
    pollIntervalMs: config?.pollIntervalMs ?? 250,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function cleanup(portFile: string): void {
  try { if (existsSync(portFile)) unlinkSync(portFile); } catch { /* ignore */ }
}

async function waitForReady(portFile: string, cfg: Required<RffMockConfig>): Promise<void> {
  const deadline = Date.now() + cfg.timeoutMs;

  // Phase 1: wait for the port file to appear (written by mock start).
  while (!(existsSync(portFile) && readFileSync(portFile, 'utf8').trim())) {
    if (Date.now() >= deadline) {
      throw new Error(`rff mock did not write port file within ${cfg.timeoutMs}ms: ${portFile}`);
    }
    await sleep(cfg.pollIntervalMs);
  }

  const port = parseInt(readFileSync(portFile, 'utf8').trim(), 10);
  const healthUrl = `http://localhost:${port}${HEALTH_READY_PATH}`;

  // Phase 2: poll /__rff/health/ready until 200.
  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(500) });
      if (res.ok) return;
      // 503 = alive but not ready; keep polling.
    } catch {
      // ECONNREFUSED — server not yet accepting connections.
    }
    await sleep(cfg.pollIntervalMs);
  }

  throw new Error(`rff mock did not become ready at ${healthUrl} within ${cfg.timeoutMs}ms`);
}

/**
 * In-process mock listeners for `redfireforge mock start --standalone`
 * (and automatic fallback when the companion is unreachable).
 */
import { existsSync } from 'fs';
import type { ApiMockServerDefinitionV1 } from '../src/shared/api-mock/contracts';
import { ApiMockServerPool } from '../src-server/api-mock/ApiMockServerPool.js';

export interface StandaloneStartResult {
  serverId: string;
  ok: boolean;
  port?: number;
  error?: string;
  mode: 'standalone';
}

export interface StandaloneStartHandle {
  results: StandaloneStartResult[];
  stopAll: () => Promise<void>;
}

/** Loopback binds are unreachable via `docker run -p`; listen on all interfaces in a container. */
export function standaloneBindHost(
  host: string | undefined,
  inDocker = existsSync('/.dockerenv'),
): ApiMockServerDefinitionV1['host'] {
  if (inDocker) return '0.0.0.0';
  if (host === '0.0.0.0' || host === 'localhost' || host === '127.0.0.1') return host;
  return '127.0.0.1';
}

export async function startStandaloneServers(
  servers: ApiMockServerDefinitionV1[],
  opts?: { inDocker?: boolean },
): Promise<StandaloneStartHandle> {
  const inDocker = opts?.inDocker ?? existsSync('/.dockerenv');
  const pool = new ApiMockServerPool();
  const results: StandaloneStartResult[] = [];
  for (const srv of servers) {
    const definition = { ...srv, host: standaloneBindHost(srv.host, inDocker) };
    try {
      const status = await pool.start(definition);
      results.push({ serverId: definition.id, ok: true, port: status.port, mode: 'standalone' });
    } catch (e) {
      results.push({
        serverId: srv.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        mode: 'standalone',
      });
    }
  }
  if (!results.every(r => r.ok)) {
    await pool.stopAllAsync();
    // Successful listeners were rolled back — do not report them as still running.
    for (const r of results) {
      if (!r.ok) continue;
      r.ok = false;
      r.port = undefined;
      r.error = 'Rolled back because another listener failed to start';
    }
  }
  return {
    results,
    stopAll: () => pool.stopAllAsync(),
  };
}

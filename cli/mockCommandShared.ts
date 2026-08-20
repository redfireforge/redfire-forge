import { createServer as createNetServer } from 'net';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import type {
  ApiMockServerDefinitionV1,
  ApiMockWorkspaceV1,
} from '../src/shared/api-mock/contracts';

export const ROLLBACK_ERROR = 'Rolled back because another listener failed to start';

/** Ask the OS for a free ephemeral port by binding to :0. */
export function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = createNetServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolvePort((addr as { port: number }).port));
    });
    srv.on('error', reject);
  });
}

export function loadDefinitionFile(file: string): Record<string, unknown> {
  const abs = resolve(file);
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const text = readFileSync(abs, 'utf8');
  const parsed = /\.ya?ml$/i.test(abs) ? parseYaml(text) : JSON.parse(text);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`File is not a mock workspace object: ${abs}`);
  }
  return parsed as Record<string, unknown>;
}

export function coerceListenPort(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

export function coerceWorkspaceServerPorts(raw: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(raw.servers)) return raw;
  return {
    ...raw,
    servers: raw.servers.map(s => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
      const rec = s as Record<string, unknown>;
      const port = coerceListenPort(rec.port);
      return port != null ? { ...rec, port } : rec;
    }),
  };
}

export function asWorkspace(raw: Record<string, unknown>): Record<string, unknown> {
  // Accept full workspace, export envelope, or single server definition.
  if (raw._exportMeta && raw.data && typeof raw.data === 'object') {
    const data = raw.data as Record<string, unknown>;
    if (data.scope === 'workspace' && data.workspace && typeof data.workspace === 'object') {
      return coerceWorkspaceServerPorts(data.workspace as Record<string, unknown>);
    }
    if (data.scope === 'servers' && Array.isArray(data.servers)) {
      return coerceWorkspaceServerPorts({
        schemaVersion: 1,
        servers: data.servers,
        tabOrder: (data.servers as { id: string }[]).map(s => s.id),
      });
    }
  }
  if (Array.isArray((raw as ApiMockWorkspaceV1).servers)) return coerceWorkspaceServerPorts(raw);
  const port = coerceListenPort(raw.port);
  if (typeof raw.id === 'string' && port != null) {
    const srv = { ...raw, port } as unknown as ApiMockServerDefinitionV1;
    return { schemaVersion: 1, servers: [srv], activeServerId: srv.id, tabOrder: [srv.id] };
  }
  return raw;
}

export function reportValidation(errors: string[]): boolean {
  if (!errors.length) return false;
  console.error('Validation errors:');
  for (const e of errors) console.error(`  - ${e}`);
  return true;
}

export function requireWorkspaceServers(workspace: ApiMockWorkspaceV1): boolean {
  if (workspace.servers.length > 0) return false;
  console.error('No servers in definition.');
  return true;
}

export function resolveServerId(workspace: ApiMockWorkspaceV1, requested?: string): string | undefined {
  if (requested) return requested;
  if (workspace.activeServerId && workspace.servers.some(s => s.id === workspace.activeServerId)) {
    return workspace.activeServerId;
  }
  return workspace.servers[0]?.id;
}

export function requireExistingServer(workspace: ApiMockWorkspaceV1, serverId?: string): serverId is string {
  if (!serverId) {
    console.error('No server id found in definition.');
    return false;
  }
  if (!workspace.servers.some(s => s.id === serverId)) {
    console.error(`Server ${serverId} not found in definition.`);
    return false;
  }
  return true;
}

export function readPortOverride(port: number | undefined): { ok: true; port?: number } | { ok: false } {
  if (port == null) return { ok: true };
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('--port must be an integer between 1 and 65535.');
    return { ok: false };
  }
  return { ok: true, port };
}

export function readNonNegInt(value: number | undefined, flag: string): { ok: true; value?: number } | { ok: false } {
  if (value == null) return { ok: true };
  if (!Number.isInteger(value) || value < 0) {
    console.error(`${flag} must be a non-negative integer.`);
    return { ok: false };
  }
  return { ok: true, value };
}

export function markRolledBack<T extends { ok: boolean; port?: number; error?: string }>(results: T[]): void {
  for (const r of results) {
    if (!r.ok) continue;
    r.ok = false;
    r.port = undefined;
    r.error = ROLLBACK_ERROR;
  }
}

export async function rollbackCompanionStarts(
  results: Array<{ ok: boolean; serverId: string; port?: number; error?: string }>,
  base: string,
): Promise<void> {
  for (const r of results) {
    if (!r.ok) continue;
    try {
      await fetch(`${base}/api/mock/servers/${encodeURIComponent(r.serverId)}/stop`, { method: 'POST' });
    } catch {
      // ignore
    }
  }
  markRolledBack(results);
}

export function companionUnreachable(results: Array<{ ok: boolean; error?: string }>): boolean {
  return results.every(r => !r.ok && /unreachable|ECONNREFUSED|fetch failed|Failed to fetch/i.test(r.error ?? ''));
}

export function isFailedSimulation(r: { passed?: boolean; outcome: string }): boolean {
  if (r.passed === false) return true;
  if (r.passed === true) return false;
  return r.outcome === 'ambiguous';
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
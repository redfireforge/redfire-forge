/**
 * Phase 8B/8C — `redfireforge mock` CLI commands.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  cliAssertJournal,
  cliFetchJournal,
  cliLoadAndValidate,
  cliSimulateSamples,
} from '../src/shared/api-mock/cliMock';
import type { ApiMockServerDefinitionV1, ApiMockTransactionOutcome, ApiMockWorkspaceV1 } from '../src/shared/api-mock/contracts';
import { startStandaloneServers } from './mockStandalone';

function loadDefinitionFile(file: string): Record<string, unknown> {
  const abs = resolve(file);
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const text = readFileSync(abs, 'utf8');
  const parsed = /\.ya?ml$/i.test(abs) ? parseYaml(text) : JSON.parse(text);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`File is not a mock workspace object: ${abs}`);
  }
  return parsed as Record<string, unknown>;
}

function coerceWorkspaceServerPorts(raw: Record<string, unknown>): Record<string, unknown> {
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

function asWorkspace(raw: Record<string, unknown>): Record<string, unknown> {
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

function coerceListenPort(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

const ROLLBACK_ERROR = 'Rolled back because another listener failed to start';

function reportValidation(errors: string[]): boolean {
  if (!errors.length) return false;
  console.error('Validation errors:');
  for (const e of errors) console.error(`  - ${e}`);
  return true;
}

function requireWorkspaceServers(workspace: ApiMockWorkspaceV1): boolean {
  if (workspace.servers.length > 0) return false;
  console.error('No servers in definition.');
  return true;
}

function resolveServerId(workspace: ApiMockWorkspaceV1, requested?: string): string | undefined {
  if (requested) return requested;
  if (workspace.activeServerId && workspace.servers.some(s => s.id === workspace.activeServerId)) {
    return workspace.activeServerId;
  }
  return workspace.servers[0]?.id;
}

function requireExistingServer(workspace: ApiMockWorkspaceV1, serverId?: string): serverId is string {
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

function readPortOverride(port: number | undefined): { ok: true; port?: number } | { ok: false } {
  if (port == null) return { ok: true };
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('--port must be an integer between 1 and 65535.');
    return { ok: false };
  }
  return { ok: true, port };
}

function readNonNegInt(value: number | undefined, flag: string): { ok: true; value?: number } | { ok: false } {
  if (value == null) return { ok: true };
  if (!Number.isInteger(value) || value < 0) {
    console.error(`${flag} must be a non-negative integer.`);
    return { ok: false };
  }
  return { ok: true, value };
}

function markRolledBack<T extends { ok: boolean; port?: number; error?: string }>(results: T[]): void {
  for (const r of results) {
    if (!r.ok) continue;
    r.ok = false;
    r.port = undefined;
    r.error = ROLLBACK_ERROR;
  }
}

async function rollbackCompanionStarts(
  results: Array<{ ok: boolean; serverId: string; port?: number; error?: string }>,
  base: string,
): Promise<void> {
  for (const r of results) {
    if (!r.ok) continue;
    try {
      await fetch(`${base}/api/mock/servers/${encodeURIComponent(r.serverId)}/stop`, { method: 'POST' });
    } catch { /* ignore */ }
  }
  markRolledBack(results);
}

export async function runMockSimulate(opts: {
  file: string;
  serverId?: string;
  output?: string;
  junit?: string;
}): Promise<number> {
  const raw = asWorkspace(loadDefinitionFile(opts.file));
  const loaded = cliLoadAndValidate(raw);
  if (reportValidation(loaded.validationErrors)) return 1;
  if (requireWorkspaceServers(loaded.workspace)) return 1;
  const serverId = resolveServerId(loaded.workspace, opts.serverId);
  if (!requireExistingServer(loaded.workspace, serverId)) return 1;
  const results = cliSimulateSamples({ workspace: loaded.workspace, serverId });
  if (results.length === 0) {
    console.error('No samples to simulate.');
    return 1;
  }
  const failed = results.filter(isFailedSimulation);
  const summary = {
    serverId,
    total: results.length,
    failed: failed.length,
    results,
  };
  const json = JSON.stringify(summary, null, 2);
  if (opts.output) writeFileSync(resolve(opts.output), json, 'utf8');
  else console.log(json);

  if (opts.junit) {
    const cases = results.map(r => {
      const name = r.sampleId;
      if (isFailedSimulation(r)) {
        return `<testcase classname="api-mock" name="${escapeXml(name)}"><failure message="${escapeXml(r.outcome)}"/></testcase>`;
      }
      return `<testcase classname="api-mock" name="${escapeXml(name)}"/>`;
    }).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="api-mock-simulate" tests="${results.length}" failures="${failed.length}">\n${cases}\n</testsuite>\n`;
    writeFileSync(resolve(opts.junit), xml, 'utf8');
  }

  console.error(`Simulated ${results.length} sample(s); ${failed.length} failure(s).`);
  return failed.length > 0 ? 1 : 0;
}

async function startViaCompanion(
  servers: ApiMockServerDefinitionV1[],
  base: string,
): Promise<Array<{ serverId: string; ok: boolean; port?: number; error?: string; mode: 'companion' }>> {
  const results: Array<{ serverId: string; ok: boolean; port?: number; error?: string; mode: 'companion' }> = [];
  for (const srv of servers) {
    try {
      const res = await fetch(`${base}/api/mock/servers/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(srv),
      });
      const body = await res.json() as { ok?: boolean; data?: { port: number; generation: number }; error?: { message?: string } };
      if (!res.ok || body.ok === false) {
        results.push({ serverId: srv.id, ok: false, error: body.error?.message ?? `HTTP ${res.status}`, mode: 'companion' });
      } else {
        results.push({ serverId: srv.id, ok: true, port: body.data?.port, mode: 'companion' });
      }
    } catch (e) {
      results.push({
        serverId: srv.id,
        ok: false,
        error: e instanceof Error ? `${e.message} — companion unreachable` : 'Companion unreachable',
        mode: 'companion',
      });
    }
  }
  return results;
}

function companionUnreachable(results: Array<{ ok: boolean; error?: string }>): boolean {
  return results.every(r => !r.ok && /unreachable|ECONNREFUSED|fetch failed|Failed to fetch/i.test(r.error ?? ''));
}

export async function runMockStart(opts: {
  file: string;
  port?: number;
  controlBase?: string;
  waitReady?: boolean;
  standalone?: boolean;
  /** When false, skip parking so tests can return without process.exit (listeners stay up). */
  hold?: boolean;
}): Promise<number> {
  const raw = asWorkspace(loadDefinitionFile(opts.file));
  const loaded = cliLoadAndValidate(raw);
  if (reportValidation(loaded.validationErrors)) return 1;
  if (requireWorkspaceServers(loaded.workspace)) return 1;

  const portOpt = readPortOverride(opts.port);
  if (!portOpt.ok) return 1;
  if (portOpt.port != null && portOpt.port + loaded.workspace.servers.length - 1 > 65535) {
    console.error('--port range exceeds 65535 for this workspace.');
    return 1;
  }
  const servers = loaded.workspace.servers.map((srv, i) => (
    portOpt.port != null ? { ...srv, port: portOpt.port + i } : srv
  ));
  const base = (opts.controlBase ?? 'http://127.0.0.1:3001').replace(/\/$/, '');

  let results: Array<{ serverId: string; ok: boolean; port?: number; error?: string; mode: string }>;
  let stopAll: (() => Promise<void>) | undefined;

  if (opts.standalone) {
    const handle = await startStandaloneServers(servers);
    results = handle.results;
    stopAll = handle.stopAll;
  } else {
    results = await startViaCompanion(servers, base);
    if (!results.every(r => r.ok)) {
      if (companionUnreachable(results)) {
        console.error('Companion unreachable — starting in-process listeners (standalone).');
        const handle = await startStandaloneServers(servers);
        results = handle.results;
        stopAll = handle.stopAll;
      } else {
        await rollbackCompanionStarts(results, base);
      }
    }
  }

  console.log(JSON.stringify({ ready: results.every(r => r.ok), results }, null, 2));

  const inProcess = Boolean(stopAll);
  if ((opts.waitReady || inProcess) && results.every(r => r.ok)) {
    console.error(inProcess && !opts.waitReady
      ? 'In-process listeners keep this process alive. Press Ctrl+C to stop.'
      : 'Listeners running. Press Ctrl+C to stop.');
    if (opts.hold === false) return 0;
    await holdMockStartUntilSignal({
      stopAll,
      controlBase: base,
      results,
    });
  }

  return results.every(r => r.ok) ? 0 : 1;
}

/** Keep the CLI process alive until SIGINT/SIGTERM. `hold: false` shuts down immediately (tests). */
export async function holdMockStartUntilSignal(opts: {
  stopAll?: () => Promise<void>;
  controlBase: string;
  results: Array<{ ok: boolean; serverId: string }>;
  fetchImpl?: typeof fetch;
  hold?: boolean;
  exit?: (code: number) => void;
}): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const exit = opts.exit ?? ((code: number) => { process.exit(code); });
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    try {
      if (opts.stopAll) {
        await opts.stopAll();
      } else {
        for (const r of opts.results) {
          if (!r.ok) continue;
          try {
            await fetchImpl(`${opts.controlBase}/api/mock/servers/${encodeURIComponent(r.serverId)}/stop`, { method: 'POST' });
          } catch { /* ignore */ }
        }
      }
    } catch { /* best-effort shutdown */ } finally {
      exit(0);
    }
  };
  function onSignal() { void shutdown(); }
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  if (opts.hold === false) {
    await shutdown();
    return;
  }
  await new Promise(() => { /* keep alive */ });
}

export async function runMockVerify(opts: {
  file: string;
  serverId?: string;
  minCalls?: number;
  expectOutcome?: string;
  routeId?: string;
  lastCallWithinMs?: number;
  bodyContains?: string;
  controlBase?: string;
  simulate?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const minCalls = readNonNegInt(opts.minCalls, '--min-calls');
  if (!minCalls.ok) return 1;
  const lastCallWithinMs = readNonNegInt(opts.lastCallWithinMs, '--last-call-within-ms');
  if (!lastCallWithinMs.ok) return 1;

  if (opts.simulate) {
    if (lastCallWithinMs.value != null) {
      console.error('--last-call-within-ms requires a live journal (omit --simulate).');
      return 1;
    }
    const raw = asWorkspace(loadDefinitionFile(opts.file));
    const loaded = cliLoadAndValidate(raw);
    if (reportValidation(loaded.validationErrors)) return 1;
    if (requireWorkspaceServers(loaded.workspace)) return 1;
    const serverId = resolveServerId(loaded.workspace, opts.serverId);
    if (!requireExistingServer(loaded.workspace, serverId)) return 1;
    const results = cliSimulateSamples({
      workspace: loaded.workspace,
      serverId,
      routeId: opts.routeId,
    });
    if (results.length === 0) {
      console.error(opts.routeId
        ? `No simulated samples matched route ${opts.routeId}`
        : 'No samples to simulate.');
      return 1;
    }
    const failed = results.filter(isFailedSimulation);
    console.log(JSON.stringify({
      mode: 'simulate',
      serverId,
      total: results.length,
      failed: failed.length,
      results,
    }, null, 2));
    if (failed.length > 0) {
      console.error(`Simulated ${results.length} sample(s); ${failed.length} failure(s).`);
      return 1;
    }
    if (minCalls.value != null && results.length < minCalls.value) {
      console.error(`Expected at least ${minCalls.value} samples, got ${results.length}`);
      return 1;
    }
    if (opts.expectOutcome) {
      const bad = results.filter(r => r.outcome !== opts.expectOutcome);
      if (bad.length) {
        console.error(`${bad.length} sample(s) did not have outcome ${opts.expectOutcome}`);
        return 1;
      }
    }
    if (opts.bodyContains) {
      const bad = results.filter(r => !String(r.renderedResponse?.body ?? '').includes(opts.bodyContains!));
      if (bad.length) {
        console.error(`${bad.length} sample(s) did not contain ${JSON.stringify(opts.bodyContains)}`);
        return 1;
      }
    }
    console.error(`Simulated ${results.length} sample(s); 0 failure(s).`);
    return 0;
  }

  const raw = asWorkspace(loadDefinitionFile(opts.file));
  const loaded = cliLoadAndValidate(raw);
  if (reportValidation(loaded.validationErrors)) return 1;
  if (requireWorkspaceServers(loaded.workspace)) return 1;
  const serverId = resolveServerId(loaded.workspace, opts.serverId);
  if (!requireExistingServer(loaded.workspace, serverId)) return 1;

  const journal = await cliFetchJournal({
    controlBase: opts.controlBase ?? 'http://127.0.0.1:3001',
    serverId,
    fetchImpl: opts.fetchImpl,
  });
  if (!journal.ok) {
    console.error(`Live journal verify failed: ${journal.error}`);
    return 1;
  }

  const result = cliAssertJournal(journal.transactions, {
    serverId,
    routeId: opts.routeId,
    expectedMinCount: minCalls.value ?? (opts.expectOutcome ? 1 : undefined),
    expectedOutcome: opts.expectOutcome as ApiMockTransactionOutcome | undefined,
    expectedLastCallWithinMs: lastCallWithinMs.value,
    expectedBodyContains: opts.bodyContains,
  });
  console.log(JSON.stringify({
    mode: 'live-journal',
    serverId,
    passed: result.passed,
    expected: result.expected,
    actual: result.actual,
    matchingCount: result.matchingCount,
    matchingIds: result.matchingIds,
    nearMisses: result.nearMisses,
  }, null, 2));
  if (!result.passed) {
    console.error(`Journal assertion failed: expected ${result.expected}; actual ${result.actual}`);
    return 1;
  }
  console.error(`Live journal: ${result.matchingCount} matching call(s).`);
  return 0;
}

function isFailedSimulation(r: { passed?: boolean; outcome: string }): boolean {
  if (r.passed === false) return true;
  if (r.passed === true) return false;
  return r.outcome === 'ambiguous';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

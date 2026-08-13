/**
 * Phase 8B/8C — `redfireforge mock` CLI commands.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  cliLoadAndValidate,
  cliSimulateSamples,
} from '../src/shared/api-mock/cliMock';
import type { ApiMockServerDefinitionV1, ApiMockWorkspaceV1 } from '../src/shared/api-mock/contracts';

function loadDefinitionFile(file: string): Record<string, unknown> {
  const abs = resolve(file);
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const text = readFileSync(abs, 'utf8');
  if (/\.ya?ml$/i.test(abs)) return parseYaml(text) as Record<string, unknown>;
  return JSON.parse(text) as Record<string, unknown>;
}

function asWorkspace(raw: Record<string, unknown>): Record<string, unknown> {
  // Accept full workspace, export envelope, or single server definition.
  if (raw._exportMeta && raw.data && typeof raw.data === 'object') {
    const data = raw.data as Record<string, unknown>;
    if (data.scope === 'workspace' && data.workspace) return data.workspace as Record<string, unknown>;
    if (data.scope === 'servers' && Array.isArray(data.servers)) {
      return { schemaVersion: 1, servers: data.servers, tabOrder: (data.servers as { id: string }[]).map(s => s.id) };
    }
  }
  if (Array.isArray((raw as ApiMockWorkspaceV1).servers)) return raw;
  if (typeof raw.id === 'string' && typeof raw.port === 'number') {
    const srv = raw as unknown as ApiMockServerDefinitionV1;
    return { schemaVersion: 1, servers: [srv], activeServerId: srv.id, tabOrder: [srv.id] };
  }
  return raw;
}

export async function runMockSimulate(opts: {
  file: string;
  serverId?: string;
  output?: string;
  junit?: string;
}): Promise<number> {
  const raw = asWorkspace(loadDefinitionFile(opts.file));
  const loaded = cliLoadAndValidate(raw);
  if (loaded.validationErrors.length) {
    console.error('Validation errors:');
    for (const e of loaded.validationErrors) console.error(`  - ${e}`);
    return 1;
  }
  const serverId = opts.serverId ?? loaded.workspace.activeServerId ?? loaded.workspace.servers[0]?.id;
  if (!serverId) {
    console.error('No server id found in definition.');
    return 1;
  }
  const results = cliSimulateSamples({ workspace: loaded.workspace, serverId });
  const failed = results.filter(r => r.passed === false || r.outcome === 'ambiguous');
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
      if (r.passed === false || r.outcome === 'ambiguous') {
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

export async function runMockStart(opts: {
  file: string;
  port?: number;
  controlBase?: string;
  waitReady?: boolean;
}): Promise<number> {
  const raw = asWorkspace(loadDefinitionFile(opts.file));
  const loaded = cliLoadAndValidate(raw);
  if (loaded.validationErrors.length) {
    console.error('Validation errors:');
    for (const e of loaded.validationErrors) console.error(`  - ${e}`);
    return 1;
  }

  const base = (opts.controlBase ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  const results: Array<{ serverId: string; ok: boolean; port?: number; error?: string }> = [];

  for (const srv of loaded.workspace.servers) {
    const def = opts.port != null ? { ...srv, port: opts.port } : srv;
    // Port override must not mutate the source file — we only send a copy.
    try {
      const res = await fetch(`${base}/api/mock/servers/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(def),
      });
      const body = await res.json() as { ok?: boolean; data?: { port: number; generation: number }; error?: { message?: string } };
      if (!res.ok || body.ok === false) {
        results.push({ serverId: srv.id, ok: false, error: body.error?.message ?? `HTTP ${res.status}` });
      } else {
        results.push({ serverId: srv.id, ok: true, port: body.data?.port });
      }
    } catch (e) {
      results.push({
        serverId: srv.id,
        ok: false,
        error: e instanceof Error ? e.message : 'Companion unreachable — start with `npm run server:dev`',
      });
    }
  }

  console.log(JSON.stringify({ ready: results.every(r => r.ok), results }, null, 2));

  if (opts.waitReady && results.every(r => r.ok)) {
    console.error('Listeners running. Press Ctrl+C to stop (SIGINT drains via companion stop).');
    const stopAll = async () => {
      for (const r of results) {
        if (!r.ok) continue;
        try {
          await fetch(`${base}/api/mock/servers/${encodeURIComponent(r.serverId)}/stop`, { method: 'POST' });
        } catch { /* ignore */ }
      }
      process.exit(0);
    };
    process.on('SIGINT', () => { void stopAll(); });
    process.on('SIGTERM', () => { void stopAll(); });
    await new Promise(() => { /* keep alive */ });
  }

  return results.every(r => r.ok) ? 0 : 1;
}

export async function runMockVerify(opts: {
  file: string;
  serverId?: string;
  minCalls?: number;
  expectOutcome?: string;
}): Promise<number> {
  // Verify uses side-effect-free simulation corpus (same engine as GUI).
  const code = await runMockSimulate({ file: opts.file, serverId: opts.serverId });
  if (code !== 0) return code;
  if (opts.minCalls != null || opts.expectOutcome) {
    const raw = asWorkspace(loadDefinitionFile(opts.file));
    const loaded = cliLoadAndValidate(raw);
    const serverId = opts.serverId ?? loaded.workspace.activeServerId ?? loaded.workspace.servers[0]?.id;
    if (!serverId) return 1;
    const results = cliSimulateSamples({ workspace: loaded.workspace, serverId });
    if (opts.minCalls != null && results.length < opts.minCalls) {
      console.error(`Expected at least ${opts.minCalls} samples, got ${results.length}`);
      return 1;
    }
    if (opts.expectOutcome) {
      const bad = results.filter(r => r.outcome !== opts.expectOutcome);
      if (bad.length) {
        console.error(`${bad.length} sample(s) did not have outcome ${opts.expectOutcome}`);
        return 1;
      }
    }
  }
  return 0;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

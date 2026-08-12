/**
 * API Mock Studio — Phase 12C recovery/reliability drills (pure engine).
 *
 * Each drill exercises a recovery path and asserts a user-facing diagnostic and
 * no silent corruption: companion crash, port theft, stale UI state,
 * corrupt storage, migration failure, and secret export.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyRuntimeError,
  reconcileRuntimeState,
  safeLoadWorkspace,
} from './recoveryDiagnostics';
import { exportWorkspace } from './exportUtils';
import { DEFAULT_SETTINGS, createDefaultResponse } from './defaults';
import type { ApiMockWorkspaceV1, ApiMockServerDefinitionV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id: string): ApiMockServerDefinitionV1 {
  return {
    id, name: `Server ${id}`, enabled: true, host: '127.0.0.1',
    port: 4600, basePath: '', folders: [], variables: [], samples: [],
    routes: [{
      id: `${id}-r1`, name: 'Route', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/test' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules', responses: [createDefaultResponse(`${id}-resp`)],
      tags: [], createdAt: ts, updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
  };
}

function makeWorkspace(servers: ApiMockServerDefinitionV1[] = []): ApiMockWorkspaceV1 {
  return { schemaVersion: 1, activeServerId: servers[0]?.id, servers, tabOrder: servers.map(s => s.id) } as ApiMockWorkspaceV1;
}

describe('drill: companion crash', () => {
  it('classifies connection failures as recoverable, retryable companion outages', () => {
    for (const msg of ['ECONNREFUSED', 'fetch failed', 'Failed to fetch', 'socket hang up', 'NetworkError when attempting to fetch']) {
      const diag = classifyRuntimeError(new Error(msg));
      expect(diag.code).toBe('COMPANION_UNAVAILABLE');
      expect(diag.retry).toBe(true);
      expect(diag.recoverable).toBe(true);
      expect(diag.message).not.toContain(msg); // no raw error leaked to the user
    }
  });

  it('never throws on non-Error inputs', () => {
    expect(classifyRuntimeError(undefined).code).toBe('MOCK_RUNTIME_ERROR');
    expect(classifyRuntimeError('boom').code).toBe('MOCK_RUNTIME_ERROR');
  });
});

describe('drill: port theft', () => {
  it('classifies EADDRINUSE as a port-in-use diagnostic', () => {
    const diag = classifyRuntimeError(new Error('listen EADDRINUSE: address already in use :::4600'));
    expect(diag.code).toBe('MOCK_PORT_IN_USE');
    expect(diag.retry).toBe(false);
    expect(diag.message).toMatch(/already in use/i);
  });

  it('classifies internal ownership conflicts distinctly', () => {
    const diag = classifyRuntimeError(new Error('Port 4600 is owned by server "srv-a"'));
    expect(diag.code).toBe('MOCK_PORT_OWNED');
  });
});

describe('drill: stale UI state (reconciliation)', () => {
  it('clears persisted running when the companion says stopped', () => {
    const result = reconcileRuntimeState(
      [{ serverId: 'a', persistedRunning: true }],
      [{ serverId: 'a', state: 'stopped' }],
    );
    expect(result.companionAvailable).toBe(true);
    expect(result.servers[0]).toMatchObject({ state: 'stopped', notice: 'was_running' });
  });

  it('trusts a live running status', () => {
    const result = reconcileRuntimeState(
      [{ serverId: 'a', persistedRunning: false }],
      [{ serverId: 'a', state: 'running' }],
    );
    expect(result.servers[0]).toMatchObject({ state: 'running' });
    expect(result.servers[0].notice).toBeUndefined();
  });

  it('marks all servers unknown when the companion is unreachable', () => {
    const result = reconcileRuntimeState(
      [{ serverId: 'a', persistedRunning: true }, { serverId: 'b' }],
      null,
    );
    expect(result.companionAvailable).toBe(false);
    expect(result.servers.every(s => s.state === 'unknown' && s.notice === 'companion_unavailable')).toBe(true);
  });
});

describe('drill: corrupt storage', () => {
  it('rejects invalid JSON without throwing', () => {
    const result = safeLoadWorkspace('{ not: valid json ');
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('AMS-STORAGE-CORRUPT');
    expect(result.workspace).toBeUndefined();
  });

  it('rejects missing or non-object payloads without throwing', () => {
    expect(safeLoadWorkspace(null).ok).toBe(false);
    expect(safeLoadWorkspace(undefined).ok).toBe(false);
    expect(safeLoadWorkspace(42).ok).toBe(false);
  });

  it('loads a valid workspace round-tripped through JSON', () => {
    const ws = makeWorkspace([makeServer('a')]);
    const result = safeLoadWorkspace(JSON.stringify(ws));
    expect(result.ok).toBe(true);
    expect(result.workspace?.servers).toHaveLength(1);
  });
});

describe('drill: migration failure', () => {
  it('rejects an unsupported future schema version with a diagnostic, not a crash', () => {
    const result = safeLoadWorkspace({ schemaVersion: 999, servers: [], tabOrder: [] });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'AMS-IMPORT-VERSION-UNKNOWN')).toBe(true);
  });
});

describe('drill: secret export', () => {
  it('redacts sensitive variable values from exports', () => {
    const server = makeServer('a');
    server.variables = [
      { id: 'v1', key: 'apiKey', value: 'super-secret-token', sensitive: true },
      { id: 'v2', key: 'tenant', value: 'acme', sensitive: false },
    ];
    const ws = makeWorkspace([server]);

    const redacted = JSON.stringify(exportWorkspace(ws, { scope: 'workspace', redact: true }));
    expect(redacted).not.toContain('super-secret-token');
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).toContain('acme'); // non-sensitive values are preserved

    const clear = JSON.stringify(exportWorkspace(ws, { scope: 'workspace', redact: false }));
    expect(clear).toContain('super-secret-token'); // control: redaction is opt-in
  });
});

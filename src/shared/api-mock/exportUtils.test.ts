import { describe, it, expect } from 'vitest';
import { exportFilename, exportWorkspace, serializeExport } from './exportUtils';
import { DEFAULT_SETTINGS, createDefaultResponse } from './defaults';
import type { ApiMockWorkspaceV1, ApiMockServerDefinitionV1 } from './contracts';

const ts = '2026-08-11T00:00:00.000Z';

function makeSrv(id: string, port: number): ApiMockServerDefinitionV1 {
  return {
    id, name: `Server ${id}`, enabled: true, host: '127.0.0.1', port,
    basePath: '', folders: [], samples: [],
    routes: [{ id: 'r1', name: 'R', enabled: true, method: 'GET', path: { kind: 'exact', value: '/' }, priority: 10, predicates: { id: 'pg', combinator: 'all', children: [] }, responseMode: 'rules', responses: [createDefaultResponse('resp-1')], tags: [], createdAt: ts, updatedAt: ts }],
    variables: [
      { id: 'v1', key: 'pub', value: 'visible', sensitive: false },
      { id: 'v2', key: 'secret', value: 'hidden', sensitive: true },
    ],
    settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
  };
}

function makeWs(): ApiMockWorkspaceV1 {
  return { schemaVersion: 1, servers: [makeSrv('a', 4600), makeSrv('b', 4601)], tabOrder: ['a', 'b'] };
}

describe('exportWorkspace', () => {
  it('exports full workspace', () => {
    const result = exportWorkspace(makeWs(), { scope: 'workspace' });
    expect(result._exportMeta.kind).toBe('redfireforge-api-mock');
    expect(result._exportMeta.schemaVersion).toBe(1);
    expect(result._exportMeta.redacted).toBe(false);
    expect(result.data.scope).toBe('workspace');
    if (result.data.scope === 'workspace') {
      expect(result.data.workspace.servers).toHaveLength(2);
    }
  });

  it('exports servers in deterministic order', () => {
    const ws = makeWs();
    ws.servers.reverse();
    const result = exportWorkspace(ws, { scope: 'workspace' });
    if (result.data.scope === 'workspace') {
      expect(result.data.workspace.servers[0].id).toBe('a');
      expect(result.data.workspace.servers[1].id).toBe('b');
    }
  });

  it('exports selected servers only', () => {
    const result = exportWorkspace(makeWs(), { scope: 'servers', selectedServerIds: ['b'] });
    if (result.data.scope === 'servers') {
      expect(result.data.servers).toHaveLength(1);
      expect(result.data.servers[0].id).toBe('b');
    }
  });

  it('exports selected routes with samples', () => {
    const result = exportWorkspace(makeWs(), { scope: 'routes', sourceServerId: 'a', selectedRouteIds: ['r1'] });
    if (result.data.scope === 'routes') {
      expect(result.data.routes).toHaveLength(1);
      expect(result.data.sourceServerId).toBe('a');
    }
  });

  it('filters samples when exporting a route subset', () => {
    const ws = makeWs();
    ws.servers[0].samples = [
      {
        id: 'sample-a',
        name: 'A',
        routeId: 'r1',
        request: {
          method: 'GET', path: '/', rawPath: '/', query: {}, headers: {}, cookies: {},
          body: null, bodyTruncated: false, receivedAt: ts,
        },
      },
      {
        id: 'sample-b',
        name: 'B',
        routeId: 'r2',
        request: {
          method: 'GET', path: '/other', rawPath: '/other', query: {}, headers: {}, cookies: {},
          body: null, bodyTruncated: false, receivedAt: ts,
        },
      },
    ];
    ws.servers[0].routes.push({
      id: 'r2', name: 'R2', enabled: true, method: 'GET', path: { kind: 'exact', value: '/other' },
      priority: 10, predicates: { id: 'pg2', combinator: 'all', children: [] }, responseMode: 'rules',
      responses: [createDefaultResponse('resp-2')], tags: [], createdAt: ts, updatedAt: ts,
    });
    const result = exportWorkspace(ws, { scope: 'routes', sourceServerId: 'a', selectedRouteIds: ['r1'] });
    if (result.data.scope === 'routes') {
      expect(result.data.samples.map(s => s.id)).toEqual(['sample-a']);
    }
  });

  it('redacts sensitive variables', () => {
    const result = exportWorkspace(makeWs(), { scope: 'workspace', redact: true });
    expect(result._exportMeta.redacted).toBe(true);
    if (result.data.scope === 'workspace') {
      const vars = result.data.workspace.servers[0].variables;
      expect(vars.find(v => v.key === 'pub')?.value).toBe('visible');
      expect(vars.find(v => v.key === 'secret')?.value).toBe('[REDACTED]');
    }
  });

  it('preserves non-sensitive variables when redacting', () => {
    const result = exportWorkspace(makeWs(), { scope: 'servers', redact: true });
    if (result.data.scope === 'servers') {
      const v = result.data.servers[0].variables.find(v => v.key === 'pub');
      expect(v?.value).toBe('visible');
    }
  });

  it('sets exportedAt timestamp', () => {
    const result = exportWorkspace(makeWs(), { scope: 'workspace' });
    expect(result._exportMeta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('variables sorted by key', () => {
    const result = exportWorkspace(makeWs(), { scope: 'workspace' });
    if (result.data.scope === 'workspace') {
      const keys = result.data.workspace.servers[0].variables.map(v => v.key);
      expect(keys).toEqual([...keys].sort());
    }
  });

  it('serializes JSON and YAML', () => {
    const envelope = exportWorkspace(makeWs(), { scope: 'workspace' });
    expect(serializeExport(envelope, 'json')).toContain('"redfireforge-api-mock"');
    expect(serializeExport(envelope, 'yaml')).toMatch(/kind:\s*redfireforge-api-mock/);
  });

  it('builds stable filenames', () => {
    expect(exportFilename('workspace', 'json', 'demo')).toMatch(/^api-mock-workspace-demo-\d{4}-\d{2}-\d{2}\.json$/);
    expect(exportFilename('servers', 'yaml', 'svc')).toMatch(/\.yaml$/);
    expect(exportFilename('routes', 'json')).toMatch(/^api-mock-routes-/);
  });
});

describe('exportWorkspace — TLS redaction', () => {
  function withTls(): ApiMockWorkspaceV1 {
    const ws = makeWs();
    ws.servers[0].settings = {
      ...ws.servers[0].settings,
      tls: {
        enabled: true,
        certPem: '-----BEGIN CERTIFICATE-----\nSRV\n-----END CERTIFICATE-----',
        keyPem: '-----BEGIN PRIVATE KEY-----\nSRVKEY\n-----END PRIVATE KEY-----',
        passphrase: 'hunter2',
        mtls: {
          enabled: true,
          clientCaPem: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
          clientCertPem: '-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----',
          clientKeyPem: '-----BEGIN PRIVATE KEY-----\nCLIENTKEY\n-----END PRIVATE KEY-----',
        },
      },
    };
    return ws;
  }

  it('redacts server and client private keys but keeps public certificates', () => {
    const out = exportWorkspace(withTls(), { scope: 'workspace', redact: true });
    const raw = JSON.stringify(out);

    expect(raw).not.toContain('SRVKEY');
    expect(raw).not.toContain('CLIENTKEY');
    expect(raw).not.toContain('hunter2');
    // Public material stays so an import can still verify/serve.
    expect(raw).toContain('CA');
    expect(raw).toContain('CLIENT');
  });
});

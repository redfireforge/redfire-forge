import { describe, it, expect } from 'vitest';
import { exportFilename, exportWorkspace, serializeExport, settingsForRedaction } from './exportUtils';
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

describe('exportWorkspace — harSourceEntry.originalBody redaction', () => {
  function makeRouteWithHarSource(): ApiMockWorkspaceV1 {
    const ws = makeWs();
    ws.servers[0].routes[0] = {
      ...ws.servers[0].routes[0],
      harSourceEntry: {
        originalStatus: 200,
        originalBody: '{"token":"super-secret","id":42}',
        originalContentType: 'application/json',
        requestFingerprint: 'abc123',
      },
    };
    return ws;
  }

  it('strips originalBody on redacted workspace export', () => {
    const out = exportWorkspace(makeRouteWithHarSource(), { scope: 'workspace', redact: true });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain('super-secret');
    if (out.data.scope === 'workspace') {
      const entry = out.data.workspace.servers[0].routes[0].harSourceEntry;
      expect(entry?.originalBody).toBeUndefined();
    }
  });

  it('preserves non-body harSourceEntry fields on redacted export', () => {
    const out = exportWorkspace(makeRouteWithHarSource(), { scope: 'workspace', redact: true });
    if (out.data.scope === 'workspace') {
      const entry = out.data.workspace.servers[0].routes[0].harSourceEntry;
      expect(entry?.originalStatus).toBe(200);
      expect(entry?.originalContentType).toBe('application/json');
      expect(entry?.requestFingerprint).toBe('abc123');
    }
  });

  it('strips originalBody on redacted routes-scope export', () => {
    const out = exportWorkspace(makeRouteWithHarSource(), { scope: 'routes', sourceServerId: 'a', redact: true });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain('super-secret');
    if (out.data.scope === 'routes') {
      expect(out.data.routes[0].harSourceEntry?.originalBody).toBeUndefined();
    }
  });

  it('preserves originalBody on non-redacted export', () => {
    const out = exportWorkspace(makeRouteWithHarSource(), { scope: 'workspace', redact: false });
    if (out.data.scope === 'workspace') {
      expect(out.data.workspace.servers[0].routes[0].harSourceEntry?.originalBody)
        .toBe('{"token":"super-secret","id":42}');
    }
  });

  it('leaves routes without harSourceEntry unchanged on redacted export', () => {
    const ws = makeWs();
    const out = exportWorkspace(ws, { scope: 'workspace', redact: true });
    if (out.data.scope === 'workspace') {
      expect(out.data.workspace.servers[0].routes[0].harSourceEntry).toBeUndefined();
    }
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

describe('exportWorkspace — response header and cookie redaction', () => {
  it('redacts sensitive response headers in route responses', () => {
    const ws = makeWs();
    ws.servers[0].settings = {
      ...ws.servers[0].settings,
      redaction: { ...ws.servers[0].settings.redaction, headerNames: ['x-api-key'] },
    };
    ws.servers[0].routes[0] = {
      ...ws.servers[0].routes[0],
      responses: [{
        ...ws.servers[0].routes[0].responses[0],
        headers: [
          { id: 'h1', key: 'X-API-Key', value: 'super-secret', enabled: true },
          { id: 'h2', key: 'Content-Type', value: 'application/json', enabled: true },
        ],
      }],
    };
    const out = exportWorkspace(ws, { scope: 'workspace', redact: true });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain('super-secret');
    expect(raw).toContain('[REDACTED]');
    // Non-sensitive header is preserved
    expect(raw).toContain('application/json');
  });

  it('redacts all response cookies on redacted export', () => {
    const ws = makeWs();
    ws.servers[0].routes[0] = {
      ...ws.servers[0].routes[0],
      responses: [{
        ...ws.servers[0].routes[0].responses[0],
        cookies: [{ id: 'c1', name: 'session', value: 'abc123', enabled: true }],
      }],
    };
    const out = exportWorkspace(ws, { scope: 'workspace', redact: true });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain('abc123');
    expect(raw).toContain('[REDACTED]');
  });

  it('redacts sample request headers on redacted export', () => {
    const ws = makeWs();
    ws.servers[0].settings = {
      ...ws.servers[0].settings,
      redaction: { ...ws.servers[0].settings.redaction, headerNames: ['authorization'] },
    };
    ws.servers[0].samples = [{
      id: 's1',
      name: 'Test sample',
      request: {
        method: 'GET',
        path: '/api',
        rawPath: '/api',
        query: {},
        headers: { authorization: ['Bearer secret-token'], 'content-type': ['application/json'] },
        cookies: { session: 'cookie-value' },
        body: null,
        bodyTruncated: false,
        receivedAt: ts,
      },
    }];
    const out = exportWorkspace(ws, { scope: 'workspace', redact: true });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain('secret-token');
    expect(raw).not.toContain('cookie-value');
    expect(raw).toContain('[REDACTED]');
  });
});

describe('settingsForRedaction', () => {
  it('returns lowercased header names from settings', () => {
    const names = settingsForRedaction({
      ...DEFAULT_SETTINGS,
      redaction: { ...DEFAULT_SETTINGS.redaction, headerNames: ['Authorization', 'X-Api-Key'] },
    });
    expect(names).toContain('authorization');
    expect(names).toContain('x-api-key');
  });

  it('returns default header names when settings is undefined', () => {
    const names = settingsForRedaction(undefined);
    expect(Array.isArray(names)).toBe(true);
  });
});

describe('exportWorkspace — routes scope edge cases', () => {
  it('returns empty arrays when sourceServerId matches no server', () => {
    // Covers the `srv ? ... : []` false branch (lines 43/46)
    const result = exportWorkspace(makeWs(), { scope: 'routes', sourceServerId: 'nonexistent' });
    if (result.data.scope === 'routes') {
      expect(result.data.routes).toHaveLength(0);
      expect(result.data.samples).toHaveLength(0);
      expect(result.data.sourceServerId).toBe('nonexistent');
    }
  });

  it('uses empty string sourceServerId when none provided', () => {
    // Covers the `sourceServerId ?? ''` false branch (line 53)
    const result = exportWorkspace(makeWs(), { scope: 'routes' });
    if (result.data.scope === 'routes') {
      expect(result.data.sourceServerId).toBe('');
    }
  });

  it('returns all routes and samples when selectedRouteIds is not provided', () => {
    // Covers the `selectedRouteIds ? filter : srv.samples` false branch (line 48)
    const ws = makeWs();
    ws.servers[0].samples = [{
      id: 's1', name: 'All routes sample',
      request: {
        method: 'GET', path: '/api', rawPath: '/api', query: {},
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
    }];
    const result = exportWorkspace(ws, { scope: 'routes', sourceServerId: 'a' });
    if (result.data.scope === 'routes') {
      expect(result.data.routes).toHaveLength(1);
      expect(result.data.samples).toHaveLength(1);
    }
  });

  it('excludes orphan samples (no routeId) when filtering by selectedRouteIds (covers routeId ?? "")', () => {
    // Covers the `s.routeId ?? ''` false branch — sample without routeId never matches
    const ws = makeWs();
    ws.servers[0].samples = [{
      id: 's-no-route', name: 'Orphan',
      // routeId intentionally absent — exercises the `?? ''` fallback
      request: {
        method: 'GET', path: '/api', rawPath: '/api', query: {},
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
    }];
    const result = exportWorkspace(ws, { scope: 'routes', sourceServerId: 'a', selectedRouteIds: ['r1'] });
    if (result.data.scope === 'routes') {
      expect(result.data.samples).toHaveLength(0);
    }
  });
});

describe('exportWorkspace — TLS redaction edge cases', () => {
  it('handles TLS with empty keyPem and no mtls (covers false branches of ternaries on lines 128/130)', () => {
    const ws = makeWs();
    ws.servers[0].settings = {
      ...ws.servers[0].settings,
      tls: {
        enabled: true,
        certPem: 'CERT',
        keyPem: '',  // empty — covers `tls.keyPem ? ... : ''` false branch
        // no mtls — covers `tls.mtls ? ... : {}` false branch
      },
    };
    const out = exportWorkspace(ws, { scope: 'workspace', redact: true });
    if (out.data.scope === 'workspace') {
      const tls = out.data.workspace.servers[0].settings.tls;
      expect(tls?.keyPem).toBe('');
      expect(tls?.mtls).toBeUndefined();
    }
  });

  it('handles mtls with empty clientKeyPem (covers false branch of line 131)', () => {
    const ws = makeWs();
    ws.servers[0].settings = {
      ...ws.servers[0].settings,
      tls: {
        enabled: true,
        certPem: 'CERT',
        keyPem: 'KEY',
        mtls: {
          enabled: true,
          clientCaPem: 'CA',
          clientCertPem: 'CLIENT_CERT',
          clientKeyPem: '',  // empty — covers `clientKeyPem ? ... : undefined` false branch
        },
      },
    };
    const out = exportWorkspace(ws, { scope: 'workspace', redact: true });
    if (out.data.scope === 'workspace') {
      const mtls = out.data.workspace.servers[0].settings.tls?.mtls;
      expect(mtls?.clientKeyPem).toBeUndefined();
    }
  });
});

describe('exportWorkspace — sample cookies edge case', () => {
  it('skips cookie redaction when sample has no cookies (covers if(cookies) false branch)', () => {
    const ws = makeWs();
    ws.servers[0].settings = {
      ...ws.servers[0].settings,
      redaction: { ...ws.servers[0].settings.redaction, headerNames: ['authorization'] },
    };
    ws.servers[0].samples = [{
      id: 's1', name: 'No cookies',
      request: {
        method: 'GET', path: '/api', rawPath: '/api', query: {},
        headers: { authorization: ['Bearer secret'] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cookies: null as any,  // covers the falsy-cookies branch
        body: null, bodyTruncated: false, receivedAt: ts,
      },
    }];
    const out = exportWorkspace(ws, { scope: 'workspace', redact: true });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain('Bearer secret');
  });
});

import { describe, expect, it } from 'vitest';
import { exportWorkspace, settingsForRedaction } from './exportUtils';
import { DEFAULT_SETTINGS, createDefaultResponse } from './defaults';
import type { ApiMockServerDefinitionV1, ApiMockWorkspaceV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeSrv(id: string, port: number): ApiMockServerDefinitionV1 {
  return {
    id,
    name: `Server ${id}`,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    samples: [{
      id: `sample-${id}`,
      name: `Sample ${id}`,
      routeId: 'r1',
      request: {
        method: 'GET',
        path: '/',
        rawPath: '/',
        query: {},
        headers: {},
        cookies: {},
        body: null,
        bodyTruncated: false,
        receivedAt: ts,
      },
    }],
    routes: [{
      id: 'r1',
      name: 'R',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [createDefaultResponse('resp-1')],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    variables: [
      { id: 'v1', key: 'pub', value: 'visible', sensitive: false },
      { id: 'v2', key: 'secret', value: 'hidden', sensitive: true },
    ],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeWs(): ApiMockWorkspaceV1 {
  return { schemaVersion: 1, servers: [makeSrv('a', 4600), makeSrv('b', 4601)], tabOrder: ['a', 'b'] };
}

describe('exportUtils coverage gaps', () => {
  it('exports all routes with their samples when route ids are omitted', () => {
    const result = exportWorkspace(makeWs(), { scope: 'routes', sourceServerId: 'a' });
    expect(result.data.scope).toBe('routes');
    if (result.data.scope === 'routes') {
      expect(result.data.routes).toHaveLength(1);
      // Routes scope is documented as "Rules + samples"; omitting ids must not drop them.
      expect(result.data.samples.map(s => s.id)).toEqual(['sample-a']);
    }
  });

  it('falls back to an empty route export when source server is missing or omitted', () => {
    const missing = exportWorkspace(makeWs(), { scope: 'routes', sourceServerId: 'missing', selectedRouteIds: ['r1'] });
    if (missing.data.scope === 'routes') {
      expect(missing.data.sourceServerId).toBe('missing');
      expect(missing.data.routes).toEqual([]);
      expect(missing.data.samples).toEqual([]);
    }

    const omitted = exportWorkspace(makeWs(), { scope: 'routes' });
    if (omitted.data.scope === 'routes') {
      expect(omitted.data.sourceServerId).toBe('');
      expect(omitted.data.routes).toEqual([]);
      expect(omitted.data.samples).toEqual([]);
    }
  });

  it('keeps route-scope exports unchanged when redact is enabled', () => {
    const result = exportWorkspace(makeWs(), { scope: 'routes', sourceServerId: 'a', selectedRouteIds: ['r1'], redact: true });
    expect(result._exportMeta.redacted).toBe(true);
    if (result.data.scope === 'routes') {
      expect(result.data.routes).toHaveLength(1);
      expect(result.data.samples).toHaveLength(1);
    }
  });

  it('redacts sample cookies, response secrets, and TLS keys without passphrase', () => {
    const ws = makeWs();
    ws.servers[0].samples[0].request.cookies = { sid: 'secret-cookie' };
    ws.servers[0].samples[0].request.headers = { authorization: ['Bearer tok'], accept: ['json'] };
    ws.servers[0].settings = {
      ...ws.servers[0].settings,
      redaction: { headerNames: ['authorization'], preserveScheme: true },
      tls: {
        enabled: true,
        certPem: 'CERT',
        keyPem: '',
        mtls: { enabled: true, clientCaPem: 'CA', clientCertPem: 'CC', clientKeyPem: '' },
      },
    };
    ws.servers[0].routes[0].responses[0].headers = [
      { id: 'h1', key: 'Authorization', value: 'Bearer x', enabled: true },
    ];
    ws.servers[0].routes[0].responses[0].cookies = [
      { id: 'c1', name: 'sid', value: 'cookie-val', enabled: true },
    ];

    const workspaceExport = exportWorkspace(ws, { scope: 'workspace', redact: true });
    if (workspaceExport.data.scope === 'workspace') {
      const sample = workspaceExport.data.workspace.servers[0].samples[0];
      expect(sample.request.cookies?.sid).toBe('[REDACTED]');
      expect(sample.request.headers.authorization).toEqual(['[REDACTED]']);
    }

    const routesExport = exportWorkspace(ws, { scope: 'routes', sourceServerId: 'a', selectedRouteIds: ['r1'], redact: true });
    if (routesExport.data.scope === 'routes') {
      const variant = routesExport.data.routes[0].responses[0];
      expect(variant.headers[0].value).toBe('[REDACTED]');
      expect(variant.cookies[0].value).toBe('[REDACTED]');
    }
  });

  it('exposes header names for redaction from server settings', () => {
    expect(settingsForRedaction(undefined)).toContain('authorization');
    expect(settingsForRedaction({
      ...DEFAULT_SETTINGS,
      redaction: { headerNames: ['X-Custom'], preserveScheme: true },
    })).toEqual(['x-custom']);
  });
});

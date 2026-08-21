import { describe, expect, it } from 'vitest';
import {
  batchToRoutes,
  parseNativeExport,
  parseOpenApiOperations,
  parseWireMockMappings,
  requestItemsToSources,
} from './importParsers';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(id: string, path: string): ApiMockRouteV1 {
  return {
    id,
    name: id,
    enabled: true,
    method: 'ANY',
    path: { kind: 'exact', value: path },
    priority: 5,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [{
      ...createDefaultResponse('v1'),
      status: 418,
      behavior: { delayMs: 5, jitterMs: 0, fault: 'timeout' },
    }],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('parseNativeExport coverage gaps', () => {
  it('collects routes from workspace, servers, and bare arrays', () => {
    const workspace = parseNativeExport(JSON.stringify({
      data: { scope: 'workspace', workspace: { servers: [{ routes: [makeRoute('w1', '/w')] }] } },
    }));
    expect(workspace.sources[0].path).toBe('/w');
    expect(workspace.sources[0].method).toBe('GET');

    const servers = parseNativeExport(JSON.stringify({
      data: { scope: 'servers', servers: [{ routes: [makeRoute('s1', '/s')] }] },
    }));
    expect(servers.sources[0].path).toBe('/s');

    const bare = parseNativeExport(JSON.stringify({
      servers: [{ routes: [makeRoute('b1', '/b')] }],
    }));
    expect(bare.sources[0].path).toBe('/b');

    const routesOnly = parseNativeExport(JSON.stringify({
      routes: [makeRoute('r1', '/r')],
    }));
    expect(routesOnly.sources[0].status).toBe(418);
    expect(routesOnly.sources[0].fault).toBe('timeout');
  });

  it('reports empty native exports', () => {
    const batch = parseNativeExport(JSON.stringify({ data: { scope: 'routes', routes: [] } }));
    expect(batch.sources).toHaveLength(0);
    expect(batch.diagnostics.some(d => d.code === 'AMS-IMPORT-EMPTY')).toBe(true);
  });
});

describe('parseWireMockMappings coverage gaps', () => {
  const stub = (req: Record<string, unknown>, res: Record<string, unknown> = { status: 200 }) =>
    parseWireMockMappings(JSON.stringify({ request: req, response: res }));

  it('maps remaining fault kinds and url patterns', () => {
    expect(stub({ method: 'GET', urlPathPattern: '^/api$' }, { fault: 'EMPTY_RESPONSE' }).sources[0].fault).toBe('close');
    expect(stub({ method: 'GET', url: '/x' }, { fault: 'MALFORMED_RESPONSE_CHUNK' }).sources[0].fault).toBe('malformed');
    expect(stub({ method: 'GET', url: '/x' }, { fault: 'RANDOM_DATA' }).sources[0].fault).toBe('dribble');
    expect(stub({ method: 'GET', url: '/x' }, { fault: 'OTHER' }).sources[0].fault).toBe('timeout');
    expect(stub({ method: 'GET', urlPattern: 'items' }).sources[0].path).toBe('/items');
  });

  it('imports plain header/query matchers and delay distribution loss', () => {
    const batch = stub({
      method: 'GET',
      url: '/q',
      headers: { Plain: 'yes' },
      queryParameters: { q: '1' },
    }, { delayDistribution: { type: 'uniform' } });
    expect(batch.sources[0].headers.Plain).toBe('yes');
    expect(batch.sources[0].query).toEqual({ q: '1' });
    expect(batch.lossReport.some(l => l.includes('delayDistribution'))).toBe(true);
  });

  it('maps advanced body patterns and reports losses', () => {
    const xpathEqual = stub({
      method: 'POST',
      url: '/x',
      bodyPatterns: [{ matchesXPath: { expression: '//a', equalTo: 'b', xPathNamespaces: { ns: 'u' } } }],
    });
    expect(xpathEqual.sources[0].predicates?.[0]).toMatchObject({
      operator: 'xpath_equals',
      options: { matchStyle: 'exact' },
    });
    expect(xpathEqual.lossReport.some(l => l.includes('xPathNamespaces'))).toBe(true);

    const xpathMatches = stub({
      method: 'POST',
      url: '/x',
      bodyPatterns: [{ matchesXPath: { expression: '//a', matches: '.*' } }],
    });
    expect(xpathMatches.sources[0].predicates?.[0].operator).toBe('xpath_exists');
    expect(xpathMatches.lossReport.some(l => l.includes('matches'))).toBe(true);

    const jsonPathObj = stub({
      method: 'POST',
      url: '/x',
      bodyPatterns: [{ matchesJsonPath: { expression: '$.a' } }],
    });
    expect(jsonPathObj.sources[0].predicates?.[0].operator).toBe('jsonPath_exists');

    const absent = stub({ method: 'POST', url: '/x', bodyPatterns: [{ absent: true }] });
    expect(absent.lossReport.some(l => l.includes('Negated body matcher'))).toBe(true);

    const unknown = stub({ method: 'POST', url: '/x', bodyPatterns: [{ weird: 1 }] });
    expect(unknown.lossReport.some(l => l.includes('Unsupported body matcher'))).toBe(true);
  });

  it('returns empty when no mappings are found', () => {
    const batch = parseWireMockMappings(JSON.stringify({ notMappings: [] }));
    expect(batch.sources).toHaveLength(0);
    expect(batch.diagnostics[0].code).toBe('AMS-IMPORT-EMPTY');
  });
});

describe('parseOpenApiOperations coverage gaps', () => {
  it('parses JSON with header/query parameters and missing examples', () => {
    const doc = {
      openapi: '3.0.0',
      paths: {
        '/pets': {
          get: {
            parameters: [
              { in: 'header', name: 'X-Trace', example: 't1' },
              { in: 'query', name: 'limit', example: 10 },
            ],
          },
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
          },
        },
      },
    };
    const batch = parseOpenApiOperations(JSON.stringify(doc));
    expect(batch.sources).toHaveLength(2);
    expect(batch.sources.find(s => s.method === 'GET')?.headers['X-Trace']).toBe('t1');
    expect(batch.sources.find(s => s.method === 'GET')?.query).toEqual({ limit: '10' });
    expect(batch.lossReport.some(l => l.includes('no request example'))).toBe(true);
  });

  it('reports empty OpenAPI documents', () => {
    expect(parseOpenApiOperations('{ "openapi": "3.0.0" }').diagnostics[0].code).toBe('AMS-IMPORT-EMPTY');
    expect(parseOpenApiOperations('[[[').diagnostics[0].code).toBe('AMS-IMPORT-PARSE');
    const noOps = parseOpenApiOperations('openapi: 3.0.0\npaths:\n  /x:\n    parameters: []');
    expect(noOps.diagnostics.some(d => d.code === 'AMS-IMPORT-EMPTY')).toBe(true);
  });
});

describe('requestItemsToSources coverage gaps', () => {
  it('falls back when URL parsing fails and normalizes bare paths', () => {
    const items = requestItemsToSources([
      { method: '', url: 'relative/path?q=1' },
      { method: 'GET', path: 'no-slash', headers: [{ key: '', value: 'skip' }, { key: 'A', value: '1' }] },
    ]);
    expect(items[0].method).toBe('GET');
    expect(items[0].path).toBe('/relative/path');
    expect(items[1].path).toBe('no-slash');
    expect(items[1].headers).toEqual({ A: '1' });
  });
});

describe('batchToRoutes options', () => {
  it('passes folderId through conversion', () => {
    const batch = parseNativeExport(JSON.stringify({
      data: {
        scope: 'routes',
        routes: [makeRoute('f1', '/folder')],
      },
    }));
    const { routes } = batchToRoutes(batch, { sourceKind: 'redfireforge', folderId: 'fld-1', defaultPriority: 3 });
    expect(routes[0].folderId).toBe('fld-1');
    expect(routes[0].priority).toBe(5);
  });
});

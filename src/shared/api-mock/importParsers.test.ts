import { describe, expect, it } from 'vitest';
import {
  batchToRoutes,
  catalogEndpointsToSources,
  parseNativeExport,
  parseOpenApiOperations,
  parseWireMockMappings,
  requestItemsToSources,
} from './importParsers';

describe('importParsers', () => {
  it('parses native workspace export routes', () => {
    const text = JSON.stringify({
      schemaVersion: 1,
      data: {
        scope: 'routes',
        routes: [{
          id: 'r1', name: 'Users', enabled: true, method: 'GET',
          path: { kind: 'exact', value: '/users' }, priority: 10,
          predicates: { id: 'pg', combinator: 'all', children: [] },
          responseMode: 'rules',
          responses: [{
            id: 'v1', name: 'ok', enabled: true, isDefault: true, status: 200,
            headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
            cookies: [], body: { kind: 'json', content: '{"ok":true}', contentType: 'application/json' },
            behavior: { delayMs: 0, jitterMs: 0 },
          }],
          tags: [], createdAt: 't', updatedAt: 't',
        }],
      },
    });
    const batch = parseNativeExport(text);
    expect(batch.sources).toHaveLength(1);
    expect(batch.sources[0].path).toBe('/users');
    const converted = batchToRoutes(batch, { sourceKind: 'redfireforge' });
    expect(converted.routes[0].enabled).toBe(false);
  });

  it('returns error for invalid native JSON', () => {
    const batch = parseNativeExport('{not-json');
    expect(batch.sources).toHaveLength(0);
    expect(batch.diagnostics[0].severity).toBe('error');
  });

  it('parses WireMock mappings with scenario, query, delay, fault, and priority', () => {
    const text = JSON.stringify({
      mappings: [{
        priority: 5,
        scenarioName: 'OrderFlow',
        requiredScenarioState: 'Started',
        newScenarioState: 'Paid',
        request: {
          method: 'POST',
          urlPath: '/pay',
          headers: { 'X-Id': { equalTo: '1' }, 'X-Complex': { matches: '.*' } },
          queryParameters: { ref: { equalTo: 'abc' } },
          bodyPatterns: [{ equalToJson: '{}' }],
        },
        response: {
          status: 202,
          jsonBody: { ok: true },
          headers: { 'Content-Type': 'application/json' },
          fixedDelayMilliseconds: 120,
          fault: 'CONNECTION_RESET_BY_PEER',
        },
      }],
    });
    const batch = parseWireMockMappings(text);
    expect(batch.sources).toHaveLength(1);
    expect(batch.sources[0].method).toBe('POST');
    expect(batch.sources[0].query).toEqual({ ref: 'abc' });
    expect(batch.sources[0].priority).toBe(5);
    expect(batch.sources[0].delayMs).toBe(120);
    expect(batch.sources[0].fault).toBe('reset');
    expect(batch.sources[0].scenario?.name).toBe('OrderFlow');
    expect(batch.lossReport.length).toBeGreaterThan(0);
    const converted = batchToRoutes(batch, { sourceKind: 'wiremock' });
    expect(converted.routes[0].tags).toContain('scenario:OrderFlow');
    expect(converted.routes[0].responses[0].transition?.targetState).toBe('Paid');
    expect(converted.routes[0].responses[0].behavior.fault).toBe('reset');
  });

  it('parses OpenAPI YAML operations', () => {
    const yaml = `
openapi: 3.0.0
info: { title: Demo, version: 1.0.0 }
paths:
  /items:
    get:
      summary: List
    post:
      requestBody:
        content:
          application/json:
            example: { name: A }
`;
    const batch = parseOpenApiOperations(yaml);
    expect(batch.sources.map(s => s.method).sort()).toEqual(['GET', 'POST']);
  });

  it('maps catalog and request items to sources', () => {
    expect(catalogEndpointsToSources([{ method: 'GET', path: '/a' }])).toEqual([
      { method: 'GET', path: '/a' },
    ]);
    const fromUrl = requestItemsToSources([{ method: 'PUT', url: 'https://x.test/v1/orders?q=1', headers: [{ key: 'A', value: '1' }], body: '{}' }]);
    expect(fromUrl[0].path).toBe('/v1/orders');
    expect(fromUrl[0].headers.A).toBe('1');
  });
});

describe('batchToRoutes samples', () => {
  function harBatch(entries: Array<{ method: string; path: string; status?: number }>) {
    return {
      sources: entries.map(e => ({
        method: e.method,
        path: e.path,
        status: e.status ?? 200,
      })),
      diagnostics: [],
      lossReport: [],
      label: 'HAR',
    };
  }

  it('returns a sample for every route, in the same order', () => {
    const batch = harBatch([
      { method: 'GET', path: '/users', status: 200 },
      { method: 'POST', path: '/orders', status: 201 },
    ]);
    const converted = batchToRoutes(batch, { sourceKind: 'har' });
    expect(converted.routes).toHaveLength(2);
    expect(converted.samples).toHaveLength(2);
  });

  it('sample[i].routeId === route[i].id for positional alignment', () => {
    const batch = harBatch([
      { method: 'GET', path: '/a', status: 200 },
      { method: 'DELETE', path: '/b', status: 204 },
    ]);
    const { routes, samples } = batchToRoutes(batch, { sourceKind: 'har' });
    expect(samples[0].routeId).toBe(routes[0].id);
    expect(samples[1].routeId).toBe(routes[1].id);
  });

  it('raw samples before fix have default outcome=matched and status=200 regardless of HAR status', () => {
    // Proves that fixHarSampleExpected is mandatory — batchToRoutes never sets real status.
    const batch = harBatch([{ method: 'GET', path: '/not-found', status: 404 }]);
    const { samples } = batchToRoutes(batch, { sourceKind: 'har' });
    expect(samples[0].expected?.outcome).toBe('matched');
    expect(samples[0].expected?.status).toBe(200);
  });

  it('sample name contains method and path', () => {
    const batch = harBatch([{ method: 'PATCH', path: '/v1/item', status: 200 }]);
    const { samples } = batchToRoutes(batch, { sourceKind: 'har' });
    expect(samples[0].name).toContain('PATCH');
    expect(samples[0].name).toContain('/v1/item');
  });
});

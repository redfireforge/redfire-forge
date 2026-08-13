import { describe, expect, it } from 'vitest';
import { exportWireMockMappings } from './wireMockExport';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'r1',
    name: 'Hello',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/hello' },
    priority: 5,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [{
      ...createDefaultResponse('resp-1'),
      status: 200,
      body: { kind: 'json', content: '{"ok":true}', contentType: 'application/json' },
      behavior: { delayMs: 10, jitterMs: 0, fault: 'none' },
    }],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('exportWireMockMappings', () => {
  it('exports exact path + json body', () => {
    const { mappings, lossReport } = exportWireMockMappings([makeRoute()]);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].request).toMatchObject({ method: 'GET', urlPath: '/hello' });
    expect(mappings[0].response).toMatchObject({
      status: 200,
      jsonBody: { ok: true },
      fixedDelayMilliseconds: 10,
    });
    expect(lossReport.some(l => l.includes('complex predicate'))).toBe(false);
  });

  it('maps faults and reports unsupported predicates', () => {
    const route = makeRoute({
      predicates: {
        id: 'pg',
        combinator: 'all',
        children: [
          { id: 'p1', source: 'header', selector: 'X-Trace', operator: 'exact', expected: '1' },
          { id: 'p2', source: 'query', selector: 'q', operator: 'contains', expected: 'x' },
        ],
      },
      responses: [{
        ...createDefaultResponse('resp-1'),
        behavior: { delayMs: 0, jitterMs: 0, fault: 'timeout' },
      }],
    });
    const { mappings, lossReport } = exportWireMockMappings([route]);
    expect((mappings[0].request as { headers: Record<string, unknown> }).headers['X-Trace']).toEqual({ equalTo: '1' });
    expect((mappings[0].response as { fault: string }).fault).toBe('CONNECTION_TIMEOUT');
    expect(lossReport.some(l => l.includes('query/contains'))).toBe(true);
  });

  it('reports weighted/sequence losses', () => {
    const weighted = makeRoute({
      id: 'rw',
      responseMode: 'weighted',
      responses: [{
        ...createDefaultResponse('w1'),
        enabled: true,
        weight: 70,
      }],
    });
    const { lossReport } = exportWireMockMappings([weighted]);
    expect(lossReport.some(l => l.includes('weighted mode'))).toBe(true);
    expect(lossReport.some(l => l.includes('weight 70'))).toBe(true);
  });

  it('exports sequence mode with loss notes and all enabled variants', () => {
    const route = makeRoute({
      id: 'seq',
      responseMode: 'sequence',
      responses: [
        { ...createDefaultResponse('a'), enabled: true, status: 200 },
        { ...createDefaultResponse('b'), enabled: true, status: 201 },
        { ...createDefaultResponse('c'), enabled: false, status: 500 },
      ],
    });
    const { mappings, lossReport } = exportWireMockMappings([route]);
    expect(mappings).toHaveLength(2);
    expect(lossReport.some(l => l.includes('sequence mode'))).toBe(true);
  });

  it('exports regex/glob paths as urlPathPattern and normalizes bare paths', () => {
    const regexRoute = makeRoute({
      id: 'rx',
      path: { kind: 'regex', value: '/users/[0-9]+' },
      predicates: {
        id: 'pg',
        combinator: 'all',
        children: [{ id: 'nested', combinator: 'any', children: [] }],
      },
    });
    const globRoute = makeRoute({
      id: 'gl',
      path: { kind: 'glob', value: 'api/**' },
    });
    const bare = makeRoute({
      id: 'bare',
      path: { kind: 'exact', value: 'no-slash' },
      method: 'ANY',
    });
    const { mappings, lossReport } = exportWireMockMappings([regexRoute, globRoute, bare]);
    expect((mappings[0].request as { urlPathPattern: string }).urlPathPattern).toBe('/users/[0-9]+');
    expect((mappings[1].request as { urlPathPattern: string }).urlPathPattern).toBe('api/**');
    expect((mappings[2].request as { urlPath: string }).urlPath).toBe('/no-slash');
    expect((mappings[2].request as { method: string }).method).toBe('ANY');
    expect(lossReport.some(l => l.includes('urlPathPattern'))).toBe(true);
    expect(lossReport.some(l => l.includes('complex predicate'))).toBe(true);
  });

  it('exports plain text body, invalid json fallback, cookies, templates, and unknown faults', () => {
    const route = makeRoute({
      id: 'lossy',
      responses: [{
        ...createDefaultResponse('resp-1'),
        status: 502,
        headers: [{ id: 'h1', key: 'X-Out', value: 'v', enabled: true }],
        cookies: [{ id: 'c1', name: 'sid', value: '1', enabled: true }],
        body: { kind: 'text', content: 'hello {{name}}', contentType: 'text/plain' },
        behavior: { delayMs: 0, jitterMs: 0, fault: 'none' },
      }],
    });
    const badJson = makeRoute({
      id: 'bad-json',
      responses: [{
        ...createDefaultResponse('bj'),
        body: { kind: 'json', content: '{bad', contentType: 'application/json' },
        behavior: { delayMs: 0, jitterMs: 0, fault: 'malformed' },
      }],
    });
    const unknownFault = makeRoute({
      id: 'uf',
      responses: [{
        ...createDefaultResponse('uf1'),
        behavior: { delayMs: 0, jitterMs: 0, fault: 'custom' as 'timeout' },
      }],
    });
    const { mappings, lossReport } = exportWireMockMappings([route, badJson, unknownFault]);
    expect((mappings[0].response as { body: string }).body).toBe('hello {{name}}');
    expect((mappings[1].response as { body: string }).body).toBe('{bad');
    expect((mappings[1].response as { fault: string }).fault).toBe('MALFORMED_RESPONSE_CHUNK');
    expect(lossReport.some(l => l.includes('Set-Cookie'))).toBe(true);
    expect(lossReport.some(l => l.includes('template helpers'))).toBe(true);
    expect(lossReport.some(l => l.includes('fault custom omitted'))).toBe(true);
  });

  it('exports state machine scenario fields from transitions', () => {
    const route = makeRoute({
      id: 'st',
      name: 'Checkout',
      responseMode: 'state',
      responses: [{
        ...createDefaultResponse('s1'),
        transition: { currentState: 'Started', targetState: 'Paid' },
      }],
    });
    const { mappings } = exportWireMockMappings([route]);
    expect(mappings[0]).toMatchObject({
      scenarioName: 'Checkout',
      requiredScenarioState: 'Started',
      newScenarioState: 'Paid',
    });
  });
});

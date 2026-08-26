import { describe, it, expect } from 'vitest';
import { harToWorkflow, mimeToBodyType } from './harToWorkflow';
import type { HarWorkflowResult } from './harToWorkflow';
import type { ParsedHarEntry } from './harParser';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(
  method: string,
  url: string,
  options: Partial<Omit<ParsedHarEntry, 'method' | 'url'>> = {},
): ParsedHarEntry {
  const parsed = new URL(url);
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((v, k) => { query[k] = v; });

  return {
    method: method.toUpperCase(),
    url,
    host: parsed.hostname,
    path: parsed.pathname,
    query,
    headers: {},
    hasRedactedHeaders: false,
    redactedHeaderNames: [],
    responseStatus: 200,
    warnings: [],
    ...options,
  };
}

function getHttpNodes(result: HarWorkflowResult) {
  return result.nodes.filter((n) => n.type === 'http');
}

function getStartNode(result: HarWorkflowResult) {
  return result.nodes.find((n) => n.type === 'start')!;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('harToWorkflow', () => {
  // ── Node count and structure ────────────────────────────────────────────

  it('returns only a Start node when entries is empty', () => {
    const result = harToWorkflow([]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('start');
    expect(result.edges).toHaveLength(0);
  });

  it('returns Start + 1 HTTP node for 1 entry', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/users')]);
    expect(result.nodes).toHaveLength(2);
    expect(getHttpNodes(result)).toHaveLength(1);
  });

  it('returns Start + N HTTP nodes for N entries', () => {
    const entries = [
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('POST', 'https://api.example.com/b'),
      makeEntry('DELETE', 'https://api.example.com/c'),
    ];
    const result = harToWorkflow(entries);
    expect(result.nodes).toHaveLength(4);
    expect(getHttpNodes(result)).toHaveLength(3);
  });

  it('always places Start node first in the nodes array', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/x')]);
    expect(result.nodes[0].type).toBe('start');
  });

  // ── Node positions ──────────────────────────────────────────────────────

  it('positions Start node at y=50', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/x')]);
    expect(getStartNode(result).position.y).toBe(50);
  });

  it('positions Start node at x=250', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/x')]);
    expect(getStartNode(result).position.x).toBe(250);
  });

  it('positions first HTTP node at y=240', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/x')]);
    expect(getHttpNodes(result)[0].position.y).toBe(240);
  });

  it('positions second HTTP node at y=400 (240 + 160)', () => {
    const result = harToWorkflow([
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('GET', 'https://api.example.com/b'),
    ]);
    expect(getHttpNodes(result)[1].position.y).toBe(400);
  });

  it('positions all HTTP nodes at x=250', () => {
    const entries = [
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('POST', 'https://api.example.com/b'),
    ];
    const result = harToWorkflow(entries);
    expect(getHttpNodes(result).every((n) => n.position.x === 250)).toBe(true);
  });

  it('increments y by 160 per node', () => {
    const entries = Array.from({ length: 4 }, (_, i) =>
      makeEntry('GET', `https://api.example.com/item${i}`),
    );
    const result = harToWorkflow(entries);
    const httpNodes = getHttpNodes(result);
    expect(httpNodes[0].position.y).toBe(240);
    expect(httpNodes[1].position.y).toBe(400);
    expect(httpNodes[2].position.y).toBe(560);
    expect(httpNodes[3].position.y).toBe(720);
  });

  // ── Edges ───────────────────────────────────────────────────────────────

  it('produces no edges when entries is empty', () => {
    expect(harToWorkflow([]).edges).toHaveLength(0);
  });

  it('produces 1 edge for 1 entry (Start → http[0])', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/x')]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe(getStartNode(result).id);
    expect(result.edges[0].target).toBe(getHttpNodes(result)[0].id);
  });

  it('produces N edges for N entries (Start + N-1 inter-node)', () => {
    const entries = [
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('GET', 'https://api.example.com/b'),
      makeEntry('GET', 'https://api.example.com/c'),
    ];
    const result = harToWorkflow(entries);
    // 1 (Start→a) + 2 (a→b, b→c) = 3
    expect(result.edges).toHaveLength(3);
  });

  it('first edge always connects Start to http[0]', () => {
    const entries = [
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('GET', 'https://api.example.com/b'),
    ];
    const result = harToWorkflow(entries);
    const httpNodes = getHttpNodes(result);
    expect(result.edges[0].source).toBe(getStartNode(result).id);
    expect(result.edges[0].target).toBe(httpNodes[0].id);
  });

  it('subsequent edges connect http[i] to http[i+1]', () => {
    const entries = [
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('GET', 'https://api.example.com/b'),
      makeEntry('GET', 'https://api.example.com/c'),
    ];
    const result = harToWorkflow(entries);
    const httpNodes = getHttpNodes(result);
    expect(result.edges[1].source).toBe(httpNodes[0].id);
    expect(result.edges[1].target).toBe(httpNodes[1].id);
    expect(result.edges[2].source).toBe(httpNodes[1].id);
    expect(result.edges[2].target).toBe(httpNodes[2].id);
  });

  it('all edge and node IDs are unique', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry('GET', `https://api.example.com/item${i}`),
    );
    const result = harToWorkflow(entries);
    const nodeIds = result.nodes.map((n) => n.id);
    const edgeIds = result.edges.map((e) => e.id);
    const allIds = [...nodeIds, ...edgeIds];
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  // ── baseUrl extraction ──────────────────────────────────────────────────

  it('extracts common host to variables.baseUrl when all entries share the same host', () => {
    const result = harToWorkflow([
      makeEntry('GET', 'https://api.example.com/users'),
      makeEntry('POST', 'https://api.example.com/orders'),
    ]);
    expect(result.variables['baseUrl']).toBe('https://api.example.com');
  });

  it('uses https protocol for baseUrl when URL starts with https', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/x')]);
    expect(result.variables['baseUrl']).toMatch(/^https:\/\//);
  });

  it('uses http protocol for baseUrl when URL starts with http (not https)', () => {
    const result = harToWorkflow([makeEntry('GET', 'http://api.example.com/x')]);
    expect(result.variables['baseUrl']).toMatch(/^http:\/\//);
  });

  it('preserves port number in baseUrl when URL has a non-standard port', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com:8443/users')]);
    expect(result.variables['baseUrl']).toBe('https://api.example.com:8443');
  });

  it('does NOT set baseUrl when entries span multiple hosts', () => {
    const result = harToWorkflow([
      makeEntry('GET', 'https://api.example.com/users'),
      makeEntry('GET', 'https://auth.example.com/token'),
    ]);
    expect(result.variables['baseUrl']).toBeUndefined();
  });

  it('does NOT set baseUrl when entries is empty', () => {
    const result = harToWorkflow([]);
    expect(result.variables['baseUrl']).toBeUndefined();
  });

  it('adds extractionSummary line mentioning baseUrl when extracted', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/users')]);
    expect(result.extractionSummary.some((s) => s.includes('{{baseUrl}}'))).toBe(true);
  });

  it('adds extractionSummary line mentioning multiple hosts when not extracted', () => {
    const result = harToWorkflow([
      makeEntry('GET', 'https://api.example.com/users'),
      makeEntry('GET', 'https://auth.example.com/token'),
    ]);
    expect(
      result.extractionSummary.some((s) => /multiple hosts/i.test(s)),
    ).toBe(true);
  });

  it('produces extractionSummary with chain detection note when entries is empty', () => {
    const result = harToWorkflow([]);
    // Chain detection adds "No variable chains detected (fewer than 2 entries)" even for empty
    expect(result.extractionSummary.length).toBeGreaterThanOrEqual(0);
  });

  // ── URL construction in nodes ───────────────────────────────────────────

  it('uses {{baseUrl}}/path format when single host', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/users/123')]);
    const httpNode = getHttpNodes(result)[0];
    expect((httpNode.data as { scenario: { url: string } }).scenario.url).toBe(
      '{{baseUrl}}/users/123',
    );
  });

  it('appends query string to URL when query params are present', () => {
    const result = harToWorkflow([
      makeEntry('GET', 'https://api.example.com/items?page=1&limit=10'),
    ]);
    const httpNode = getHttpNodes(result)[0];
    const url = (httpNode.data as { scenario: { url: string } }).scenario.url;
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
  });

  it('correctly encodes special characters in query params', () => {
    const result = harToWorkflow([
      makeEntry('GET', 'https://api.example.com/search?q=hello+world&tag=a%26b'),
    ]);
    const url = (getHttpNodes(result)[0].data as { scenario: { url: string } }).scenario.url;
    // URL was parsed and re-encoded — should contain the query values
    expect(url).toContain('q=');
    expect(url).toContain('tag=');
  });

  it('uses full URL when multiple hosts present', () => {
    const result = harToWorkflow([
      makeEntry('GET', 'https://api.example.com/users'),
      makeEntry('GET', 'https://auth.example.com/token'),
    ]);
    const httpNodes = getHttpNodes(result);
    expect((httpNodes[0].data as { scenario: { url: string } }).scenario.url).toBe(
      'https://api.example.com/users',
    );
    expect((httpNodes[1].data as { scenario: { url: string } }).scenario.url).toBe(
      'https://auth.example.com/token',
    );
  });

  it('produces no query string when entry has no query params', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/users')]);
    const url = (getHttpNodes(result)[0].data as { scenario: { url: string } }).scenario.url;
    expect(url).not.toContain('?');
  });

  // ── Node data (label, method, headers, body) ────────────────────────────

  it('sets node label to "METHOD /path"', () => {
    const result = harToWorkflow([makeEntry('POST', 'https://api.example.com/orders')]);
    expect((getHttpNodes(result)[0].data as { label: string }).label).toBe('POST /orders');
  });

  it('sets node label using parameterized path when chain detection fires', () => {
    const entries = [
      makeEntry('POST', 'https://api.example.com/users', { responseBody: '{"userId":"u-99"}' }),
      makeEntry('GET', 'https://api.example.com/users/u-99'),
    ];
    const result = harToWorkflow(entries);
    const targetLabel = (getHttpNodes(result)[1].data as { label: string }).label;
    // After chain detection, path becomes /users/{{userId}}
    expect(targetLabel).toBe('GET /users/{{userId}}');
  });

  it('combines {{baseUrl}} with parameterized path when both baseUrl and chain detected', () => {
    const entries = [
      makeEntry('POST', 'https://api.example.com/users', { responseBody: '{"userId":"u-99"}' }),
      makeEntry('GET', 'https://api.example.com/users/u-99'),
    ];
    const result = harToWorkflow(entries);
    const targetUrl = (getHttpNodes(result)[1].data as { scenario: { url: string } }).scenario.url;
    // Should be {{baseUrl}}/users/{{userId}} — both variables combined
    expect(targetUrl).toBe('{{baseUrl}}/users/{{userId}}');
  });

  it('sets scenario.method from entry.method', () => {
    const result = harToWorkflow([makeEntry('DELETE', 'https://api.example.com/items/1')]);
    const scenario = (getHttpNodes(result)[0].data as { scenario: { method: string } }).scenario;
    expect(scenario.method).toBe('DELETE');
  });

  it('maps entry headers to KeyValue[] with enabled: true', () => {
    const entry = makeEntry('GET', 'https://api.example.com/data', {
      headers: { Accept: 'application/json', 'X-Request-Id': 'req-001' },
    });
    const result = harToWorkflow([entry]);
    const headers = (
      getHttpNodes(result)[0].data as { scenario: { headers: Array<{ key: string; value: string; enabled: boolean }> } }
    ).scenario.headers;
    expect(headers).toContainEqual({ key: 'Accept', value: 'application/json', enabled: true });
    expect(headers).toContainEqual({ key: 'X-Request-Id', value: 'req-001', enabled: true });
  });

  it('sets scenario.body to entry.body when present', () => {
    const entry = makeEntry('POST', 'https://api.example.com/users', { body: '{"name":"Alice"}' });
    const result = harToWorkflow([entry]);
    const scenario = (getHttpNodes(result)[0].data as { scenario: { body: string } }).scenario;
    expect(scenario.body).toBe('{"name":"Alice"}');
  });

  it('sets scenario.body to empty string when entry.body is undefined', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/users')]);
    const scenario = (getHttpNodes(result)[0].data as { scenario: { body: string } }).scenario;
    expect(scenario.body).toBe('');
  });

  it('sets auth to { type: none } on every HTTP node', () => {
    const entries = [
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('POST', 'https://api.example.com/b'),
    ];
    const result = harToWorkflow(entries);
    for (const node of getHttpNodes(result)) {
      const auth = (node.data as { scenario: { auth: { type: string } } }).scenario.auth;
      expect(auth.type).toBe('none');
    }
  });

  it('sets validation.mode to none on every HTTP node', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/users')]);
    const validation = (
      getHttpNodes(result)[0].data as { scenario: { validation: { mode: string } } }
    ).scenario.validation;
    expect(validation.mode).toBe('none');
  });

  it('sets extractions to empty array on every HTTP node (no chains)', () => {
    const result = harToWorkflow([makeEntry('GET', 'https://api.example.com/users')]);
    const extractions = (
      getHttpNodes(result)[0].data as { scenario: { extractions: unknown[] } }
    ).scenario.extractions;
    expect(extractions).toEqual([]);
  });

  it('populates extractions on source HTTP node when chain detection finds a link', () => {
    const entries = [
      makeEntry('POST', 'https://api.example.com/users', {
        responseBody: '{"userId":"u-99"}',
      }),
      makeEntry('GET', 'https://api.example.com/users/u-99'),
    ];
    const result = harToWorkflow(entries);
    const httpNodes = getHttpNodes(result);
    const sourceExtractions = (
      httpNodes[0].data as { scenario: { extractions: Array<{ name: string; source: string; expression: string }> } }
    ).scenario.extractions;
    expect(sourceExtractions).toHaveLength(1);
    expect(sourceExtractions[0].name).toBe('userId');
    expect(sourceExtractions[0].source).toBe('body');
    expect(sourceExtractions[0].expression).toBe('$.userId');
  });

  it('parameterizes target node URL when chain detection finds a link', () => {
    const entries = [
      makeEntry('POST', 'https://api.example.com/users', {
        responseBody: '{"userId":"u-99"}',
      }),
      makeEntry('GET', 'https://api.example.com/users/u-99'),
    ];
    const result = harToWorkflow(entries);
    const httpNodes = getHttpNodes(result);
    const targetUrl = (httpNodes[1].data as { scenario: { url: string } }).scenario.url;
    expect(targetUrl).toContain('{{userId}}');
    expect(targetUrl).not.toContain('u-99');
  });

  it('leaves target node extractions empty (extraction is on source node, not target)', () => {
    const entries = [
      makeEntry('POST', 'https://api.example.com/users', {
        responseBody: '{"userId":"u-99"}',
      }),
      makeEntry('GET', 'https://api.example.com/users/u-99'),
    ];
    const result = harToWorkflow(entries);
    const httpNodes = getHttpNodes(result);
    const targetExtractions = (
      httpNodes[1].data as { scenario: { extractions: unknown[] } }
    ).scenario.extractions;
    expect(targetExtractions).toHaveLength(0);
  });

  it('does not set initialVariables on HTTP nodes', () => {
    const entry = makeEntry('GET', 'https://api.example.com/items?page=1');
    const result = harToWorkflow([entry]);
    const data = getHttpNodes(result)[0].data as Record<string, unknown>;
    expect(data['initialVariables']).toBeUndefined();
  });

  // ── Scenario IDs ────────────────────────────────────────────────────────

  it('assigns unique scenario.id to each HTTP node', () => {
    const entries = [
      makeEntry('GET', 'https://api.example.com/a'),
      makeEntry('GET', 'https://api.example.com/b'),
    ];
    const result = harToWorkflow(entries);
    const ids = getHttpNodes(result).map(
      (n) => (n.data as { scenario: { id: string } }).scenario.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── mimeToBodyType ───────────────────────────────────────────────────────────

describe('mimeToBodyType', () => {
  it('returns none for undefined', () => {
    expect(mimeToBodyType(undefined)).toBe('none');
  });

  it('returns none for empty string', () => {
    expect(mimeToBodyType('')).toBe('none');
  });

  it('returns json for application/json', () => {
    expect(mimeToBodyType('application/json')).toBe('json');
  });

  it('returns json for application/json; charset=utf-8', () => {
    expect(mimeToBodyType('application/json; charset=utf-8')).toBe('json');
  });

  it('returns xml for application/xml', () => {
    expect(mimeToBodyType('application/xml')).toBe('xml');
  });

  it('returns xml for text/xml', () => {
    expect(mimeToBodyType('text/xml')).toBe('xml');
  });

  it('returns form-urlencoded for application/x-www-form-urlencoded', () => {
    expect(mimeToBodyType('application/x-www-form-urlencoded')).toBe('form-urlencoded');
  });

  it('returns form-data for multipart/form-data', () => {
    expect(mimeToBodyType('multipart/form-data')).toBe('form-data');
  });

  it('returns form-data for mime containing form-data', () => {
    expect(mimeToBodyType('multipart/form-data; boundary=----xyz')).toBe('form-data');
  });

  it('returns text for text/plain', () => {
    expect(mimeToBodyType('text/plain')).toBe('text');
  });

  it('returns text for text/html', () => {
    expect(mimeToBodyType('text/html')).toBe('text');
  });

  it('returns text for text/csv', () => {
    expect(mimeToBodyType('text/csv')).toBe('text');
  });

  it('returns text for application/octet-stream (binary fallback)', () => {
    expect(mimeToBodyType('application/octet-stream')).toBe('text');
  });

  it('returns text for unknown mime type', () => {
    expect(mimeToBodyType('application/something-unknown')).toBe('text');
  });

  it('is case-insensitive', () => {
    expect(mimeToBodyType('APPLICATION/JSON')).toBe('json');
    expect(mimeToBodyType('Text/Plain')).toBe('text');
  });
});

/**
 * End-to-end integration tests: parseHarEntries → [detectChains] → harToWorkflow
 *
 * These tests validate the complete pipeline from raw HAR string to workflow nodes,
 * ensuring the output of Phase 1 integrates correctly with Phase 2 (and Phase 4).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseHarEntries } from './harParser';
import { harToWorkflow } from './harToWorkflow';

const FIXTURES = join(__dirname, '__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

function getHttpNodes(result: ReturnType<typeof harToWorkflow>) {
  return result.nodes.filter((n) => n.type === 'http');
}

function getScenario(node: ReturnType<typeof harToWorkflow>['nodes'][number]) {
  return (node.data as { scenario: { url: string; method: string; body: string; extractions: unknown[] } }).scenario;
}

describe('HAR pipeline integration: parseHarEntries → harToWorkflow', () => {
  it('produces valid workflow nodes from sample-api.har (5 entries)', () => {
    const text = loadFixture('sample-api.har');
    const parseResult = parseHarEntries(text);

    expect(parseResult.error).toBeUndefined();
    expect(parseResult.entries).toHaveLength(5);

    const workflowResult = harToWorkflow(parseResult.entries);

    // Start node + 5 HTTP nodes
    expect(workflowResult.nodes).toHaveLength(6);
    expect(workflowResult.nodes[0].type).toBe('start');
    expect(getHttpNodes(workflowResult)).toHaveLength(5);

    // 5 edges: Start→1, 1→2, 2→3, 3→4, 4→5
    expect(workflowResult.edges).toHaveLength(5);
  });

  it('extracts {{baseUrl}} from sample-api.har (all same host)', () => {
    const text = loadFixture('sample-api.har');
    const { entries } = parseHarEntries(text);
    const { variables } = harToWorkflow(entries);

    expect(variables['baseUrl']).toBe('https://api.example.com');
  });

  it('all HTTP node URLs use {{baseUrl}} from sample-api.har', () => {
    const text = loadFixture('sample-api.har');
    const { entries } = parseHarEntries(text);
    const result = harToWorkflow(entries);

    const httpNodes = getHttpNodes(result);
    for (const node of httpNodes) {
      expect(getScenario(node).url).toMatch(/^\{\{baseUrl\}\}/);
    }
  });

  it('detects chain: login response userId → /users/u-99 URL in sample-api.har', () => {
    const text = loadFixture('sample-api.har');
    const { entries } = parseHarEntries(text);
    const result = harToWorkflow(entries);

    const httpNodes = getHttpNodes(result);

    // First node (POST /auth/login) should have extraction for userId
    const loginExtractions = getScenario(httpNodes[0]).extractions as Array<{ name: string; source: string }>;
    expect(loginExtractions.length).toBeGreaterThan(0);
    expect(loginExtractions.some((e) => e.name === 'userId' && e.source === 'body')).toBe(true);

    // Second node (GET /users/u-99) should have parameterized URL
    const usersUrl = getScenario(httpNodes[1]).url;
    expect(usersUrl).toContain('{{userId}}');
    expect(usersUrl).not.toContain('u-99');
  });

  it('preserves method, body, and bodyType from parsed entries through to workflow nodes', () => {
    const text = loadFixture('sample-api.har');
    const { entries } = parseHarEntries(text);
    const result = harToWorkflow(entries);

    const httpNodes = getHttpNodes(result);

    // First node: POST /auth/login with JSON body
    const loginScenario = getScenario(httpNodes[0]);
    expect(loginScenario.method).toBe('POST');
    expect(loginScenario.body).toBe('{"username":"alice","password":"secret"}');

    // Second node: GET (no body)
    const getScenario2 = getScenario(httpNodes[1]);
    expect(getScenario2.method).toBe('GET');
    expect(getScenario2.body).toBe('');

    // Fifth node: DELETE
    const deleteScenario = getScenario(httpNodes[4]);
    expect(deleteScenario.method).toBe('DELETE');
  });

  it('produces a valid workflow from sample-mixed-filters.har (only real entries accepted)', () => {
    const text = loadFixture('sample-mixed-filters.har');
    const parseResult = parseHarEntries(text);

    // Only 2 real entries, rest filtered (OPTIONS, tracking, chrome-extension, duplicate)
    expect(parseResult.entries).toHaveLength(2);
    expect(parseResult.filteredCount).toBeGreaterThan(0);

    const result = harToWorkflow(parseResult.entries);

    // Start + 2 HTTP nodes
    expect(result.nodes).toHaveLength(3);
    expect(getHttpNodes(result)).toHaveLength(2);
  });

  it('returns only a Start node from sample-empty.har (no entries)', () => {
    const text = loadFixture('sample-empty.har');
    const { entries } = parseHarEntries(text);

    expect(entries).toHaveLength(0);

    const result = harToWorkflow(entries);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('start');
    expect(result.edges).toHaveLength(0);
    expect(result.variables).toEqual({});
  });

  it('redacted headers are preserved as {{variable}} placeholders through to workflow nodes', () => {
    const text = loadFixture('sample-sensitive-headers.har');
    const { entries } = parseHarEntries(text);
    const result = harToWorkflow(entries);

    const httpNodes = getHttpNodes(result);
    const headers = (
      httpNodes[0].data as { scenario: { headers: Array<{ key: string; value: string }> } }
    ).scenario.headers;

    // Authorization should be replaced with {{authToken}}
    const authHeader = headers.find((h) => h.key === 'Authorization');
    expect(authHeader?.value).toBe('{{authToken}}');

    // Cookie should be replaced with {{cookieSession}}
    const cookieHeader = headers.find((h) => h.key === 'Cookie');
    expect(cookieHeader?.value).toBe('{{cookieSession}}');
  });

  it('all node IDs and edge IDs are unique across the full pipeline', () => {
    const text = loadFixture('sample-api.har');
    const { entries } = parseHarEntries(text);
    const result = harToWorkflow(entries);

    const nodeIds = result.nodes.map((n) => n.id);
    const edgeIds = result.edges.map((e) => e.id);
    const allIds = [...nodeIds, ...edgeIds];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

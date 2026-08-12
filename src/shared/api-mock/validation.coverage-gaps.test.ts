import { describe, expect, it } from 'vitest';
import {
  validateRoute,
  validateServer,
  validateWorkspace,
  validatePredicateGroup,
} from './validation';
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, HARD_CEILINGS, createDefaultResponse } from './defaults';
import type {
  ApiMockPredicateGroupV1,
  ApiMockRouteV1,
  ApiMockServerDefinitionV1,
  ApiMockWorkspaceV1,
} from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'route-1',
    name: 'Test Route',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/test' },
    priority: 10,
    predicates: { id: 'pg-1', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [createDefaultResponse('resp-1')],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeServer(overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Test Server',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [makeRoute()],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<ApiMockWorkspaceV1> = {}): ApiMockWorkspaceV1 {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, servers: [makeServer()], tabOrder: ['srv-1'], ...overrides };
}

describe('validation coverage gaps', () => {
  it('covers empty workspace and missing server id branches', () => {
    expect(validateWorkspace(makeWorkspace({ servers: [] }))).toEqual([]);
    const diags = validateServer(makeServer({ id: '', name: '' }));
    expect(diags.some(d => d.path.endsWith('/id'))).toBe(true);
    expect(diags.some(d => d.path.endsWith('/name'))).toBe(true);
  });

  it('covers route-count, predicate-count, folder-parent, and sample-route ceilings', () => {
    const nestedPredicates: ApiMockPredicateGroupV1 = {
      id: 'pg-root',
      combinator: 'all',
      children: Array.from({ length: HARD_CEILINGS.maxPredicates + 1 }, (_, index) =>
        index === HARD_CEILINGS.maxPredicates
          ? {
            id: 'pg-child',
            combinator: 'all',
            children: [
              { id: `p-nested-${index}`, source: 'header', selector: `x-${index}`, operator: 'exact', expected: String(index) },
            ],
          }
          : { id: `p-${index}`, source: 'header', selector: `x-${index}`, operator: 'exact', expected: String(index) },
      ),
    };

    const routes = Array.from({ length: HARD_CEILINGS.maxRoutes + 1 }, (_, index) =>
      makeRoute({ id: `route-${index}`, name: `Route ${index}`, predicates: nestedPredicates }),
    );

    const diags = validateServer(makeServer({
      routes,
      folders: [{ id: 'folder-1', name: 'Folder', parentId: 'missing-parent' } as any],
      samples: [{
        id: 'sample-1',
        name: 'Sample',
        routeId: 'missing-route',
        request: { method: 'GET', path: '/t', rawPath: '/t', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
      } as any],
    }));

    expect(diags.some(d => d.code === 'AMS-LIMIT-ROUTES')).toBe(true);
    expect(diags.some(d => d.code === 'AMS-LIMIT-PREDICATES')).toBe(true);
    expect(diags.some(d => d.path.includes('/folders/0/parentId'))).toBe(true);
    expect(diags.some(d => d.path.includes('/samples/0/routeId'))).toBe(true);
  });

  it('covers missing route fields, variant ceilings, and rules-mode transition gate', () => {
    const variants = Array.from({ length: HARD_CEILINGS.maxVariantsPerRoute + 1 }, (_, index) => {
      const response = createDefaultResponse(`resp-${index}`);
      response.isDefault = index === 0;
      response.enabled = true;
      return response;
    });
    variants[0].transition = { on: 'always', targetState: 'next' } as any;

    const diags = validateRoute(makeRoute({ id: '', name: '', responses: variants }));
    expect(diags.some(d => d.path.endsWith('/id'))).toBe(true);
    expect(diags.some(d => d.path.endsWith('/name'))).toBe(true);
    expect(diags.some(d => d.code === 'AMS-LIMIT-VARIANTS')).toBe(true);
    expect(diags.some(d => d.path.includes('/responses/0/transition'))).toBe(true);
  });

  it('covers all response behavior capability gates', () => {
    const response = createDefaultResponse('resp-1');
    response.behavior.chunkSchedule = [{ afterMs: 1, bytes: 'x' } as any];
    response.behavior.maxMatches = 1;
    response.behavior.expiresAt = ts;
    response.behavior.probability = 0.5;
    const diags = validateRoute(makeRoute({ responses: [response] }));
    expect(diags.some(d => d.path.includes('/chunkSchedule'))).toBe(true);
    expect(diags.some(d => d.path.includes('/maxMatches'))).toBe(true);
    expect(diags.some(d => d.path.includes('/expiresAt'))).toBe(true);
    expect(diags.some(d => d.path.includes('/probability'))).toBe(true);
  });

  it('covers regex predicate length and non-string security-selector branches', () => {
    const group: ApiMockPredicateGroupV1 = {
      id: 'pg',
      combinator: 'all',
      children: [
        { id: 'p1', source: 'security', operator: 'exact', expected: 'x' },
        { id: 'p2', source: 'security', selector: 'scheme', operator: 'exact', expected: 'Bearer' },
        { id: 'p3', source: 'header', selector: 'x-test', operator: 'regex', expected: 'a'.repeat(HARD_CEILINGS.maxRegexLength + 1) },
        { id: 'p4', source: 'header', selector: 'x-test', operator: 'regex', expected: 123 as any },
      ],
    };
    const diags = validatePredicateGroup(group, '/predicates', 0);
    expect(diags.some(d => d.code === 'AMS-LIMIT-REGEX-LENGTH')).toBe(true);
    expect(diags.some(d => d.code === 'AMS-REGEX-INVALID')).toBe(false);
  });

  it('covers remaining settings ceilings including maxDelayMs', () => {
    const settings = { ...DEFAULT_SETTINGS };
    settings.limits.maxResponseBodyBytes = HARD_CEILINGS.maxResponseBodyBytes + 1;
    settings.limits.maxConcurrentConnections = HARD_CEILINGS.maxConcurrentConnections + 1;
    settings.limits.gracefulDrainMs = HARD_CEILINGS.maxGracefulDrainMs + 1;
    settings.limits.maxDelayMs = HARD_CEILINGS.maxDelayMs + 1;
    const diags = validateServer(makeServer({ settings }));
    expect(diags.filter(d => d.code === 'AMS-LIMIT-EXCEEDED').length).toBeGreaterThanOrEqual(4);
    expect(diags.some(d => d.path.includes('/maxDelayMs'))).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  validateWorkspace,
  validateServer,
  validateRoute,
  validatePredicateGroup,
} from './validation';
import { DEFAULT_SETTINGS, HARD_CEILINGS, createDefaultResponse } from './defaults';
import type {
  ApiMockWorkspaceV1,
  ApiMockServerDefinitionV1,
  ApiMockRouteV1,
  ApiMockPredicateGroupV1,
} from './contracts';

const ts = '2026-08-11T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'route-1', name: 'Test Route', enabled: true, method: 'GET',
    path: { kind: 'exact', value: '/test' }, priority: 10,
    predicates: { id: 'pg-1', combinator: 'all', children: [] },
    responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
    tags: [], createdAt: ts, updatedAt: ts,
    ...overrides,
  };
}

function makeServer(overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1', name: 'Test Server', enabled: true, host: '127.0.0.1',
    port: 4600, basePath: '', folders: [], routes: [makeRoute()],
    samples: [], variables: [], settings: { ...DEFAULT_SETTINGS },
    createdAt: ts, updatedAt: ts,
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<ApiMockWorkspaceV1> = {}): ApiMockWorkspaceV1 {
  return { schemaVersion: 1, servers: [makeServer()], tabOrder: ['srv-1'], ...overrides };
}

describe('validateWorkspace', () => {
  it('passes for a valid workspace', () => {
    expect(validateWorkspace(makeWorkspace())).toEqual([]);
  });

  it('rejects future schema versions', () => {
    const ws = { ...makeWorkspace(), schemaVersion: 999 as 1 };
    const diags = validateWorkspace(ws);
    expect(diags).toHaveLength(1);
    expect(diags[0].code).toBe('AMS-IMPORT-VERSION-UNKNOWN');
  });

  it('detects duplicate server IDs', () => {
    const ws = makeWorkspace({ servers: [makeServer(), makeServer()] });
    const diags = validateWorkspace(ws);
    expect(diags.some(d => d.code === 'AMS-SCHEMA-DUPLICATE-ID')).toBe(true);
  });
});

describe('validateServer', () => {
  it('passes for a valid server', () => {
    expect(validateServer(makeServer())).toEqual([]);
  });

  it('detects missing server name', () => {
    const diags = validateServer(makeServer({ name: '' }));
    expect(diags.some(d => d.code === 'AMS-SCHEMA-MISSING-FIELD')).toBe(true);
  });

  it('detects duplicate route IDs', () => {
    const diags = validateServer(makeServer({ routes: [makeRoute(), makeRoute()] }));
    expect(diags.some(d => d.code === 'AMS-SCHEMA-DUPLICATE-ID')).toBe(true);
  });

  it('detects dangling folder references', () => {
    const diags = validateServer(makeServer({ routes: [makeRoute({ folderId: 'no-such-folder' })] }));
    expect(diags.some(d => d.code === 'AMS-REF-DANGLING-FOLDER')).toBe(true);
  });

  it('detects dangling sample routeId', () => {
    const srv = makeServer({
      samples: [{
        id: 's1', name: 'S', request: {
          method: 'GET', path: '/t', rawPath: '/t', query: {}, headers: {},
          cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
        }, routeId: 'no-such-route',
      }],
    });
    const diags = validateServer(srv);
    expect(diags.some(d => d.code === 'AMS-REF-DANGLING-ROUTE')).toBe(true);
  });

  it('rejects settings limits above hard ceilings', () => {
    const srv = makeServer();
    srv.settings.limits.maxInboundBodyBytes = HARD_CEILINGS.maxInboundBodyBytes + 1;
    const diags = validateServer(srv);
    expect(diags.some(d => d.code === 'AMS-LIMIT-EXCEEDED')).toBe(true);
  });
});

describe('validateRoute', () => {
  it('passes for a valid route', () => {
    expect(validateRoute(makeRoute())).toEqual([]);
  });

  it('rejects empty responses', () => {
    const diags = validateRoute(makeRoute({ responses: [] }));
    expect(diags.some(d => d.code === 'AMS-SCHEMA-MISSING-FIELD')).toBe(true);
  });

  it('rejects Phase 7 response modes', () => {
    for (const mode of ['sequence', 'weighted', 'state'] as const) {
      const diags = validateRoute(makeRoute({ responseMode: mode }));
      expect(diags.some(d => d.code === 'AMS-CAPABILITY-GATED')).toBe(true);
    }
  });

  it('rejects invalid regex path', () => {
    const diags = validateRoute(makeRoute({ path: { kind: 'regex', value: '(unclosed' } }));
    expect(diags.some(d => d.code === 'AMS-REGEX-INVALID')).toBe(true);
  });

  it('rejects regex exceeding length limit', () => {
    const diags = validateRoute(makeRoute({ path: { kind: 'regex', value: 'a'.repeat(HARD_CEILINGS.maxRegexLength + 1) } }));
    expect(diags.some(d => d.code === 'AMS-LIMIT-REGEX-LENGTH')).toBe(true);
  });

  it('detects no enabled default in rules mode', () => {
    const resp = createDefaultResponse('r1');
    resp.isDefault = false;
    resp.conditions = { id: 'c1', combinator: 'all', children: [] };
    const diags = validateRoute(makeRoute({ responses: [resp] }));
    expect(diags.some(d => d.code === 'AMS-RESPONSE-NO-DEFAULT')).toBe(true);
  });

  it('detects multiple defaults in rules mode', () => {
    const r1 = createDefaultResponse('r1');
    const r2 = createDefaultResponse('r2');
    r2.name = 'Second Default';
    const diags = validateRoute(makeRoute({ responses: [r1, r2] }));
    expect(diags.some(d => d.code === 'AMS-RESPONSE-MULTIPLE-DEFAULTS')).toBe(true);
  });

  it('detects all variants disabled', () => {
    const resp = createDefaultResponse('r1');
    resp.enabled = false;
    const diags = validateRoute(makeRoute({ responses: [resp] }));
    expect(diags.some(d => d.code === 'AMS-RESPONSE-NO-ENABLED-VARIANT')).toBe(true);
  });

  it('rejects weight in rules mode', () => {
    const r1 = createDefaultResponse('r1');
    (r1 as ApiMockRouteV1['responses'][0]).weight = 50;
    const diags = validateRoute(makeRoute({ responses: [r1] }));
    expect(diags.some(d => d.code === 'AMS-RESPONSE-INVALID-MODE')).toBe(true);
  });

  it('rejects Phase 7 behavior fields', () => {
    const resp = createDefaultResponse('r1');
    resp.behavior.fault = 'timeout';
    const diags = validateRoute(makeRoute({ responses: [resp] }));
    expect(diags.some(d => d.code === 'AMS-CAPABILITY-GATED')).toBe(true);
  });
});

describe('validatePredicateGroup', () => {
  it('passes for a valid group', () => {
    const group: ApiMockPredicateGroupV1 = { id: 'pg', combinator: 'all', children: [] };
    expect(validatePredicateGroup(group, '/predicates', 0)).toEqual([]);
  });

  it('rejects excessive nesting', () => {
    let group: ApiMockPredicateGroupV1 = { id: 'pg-leaf', combinator: 'all', children: [] };
    for (let i = 0; i < HARD_CEILINGS.maxNestingDepth + 2; i++) {
      group = { id: `pg-${i}`, combinator: 'all', children: [group] };
    }
    const diags = validatePredicateGroup(group, '/predicates', 0);
    expect(diags.some(d => d.code === 'AMS-LIMIT-NESTING-DEPTH')).toBe(true);
  });

  it('rejects invalid security selectors', () => {
    const group: ApiMockPredicateGroupV1 = {
      id: 'pg', combinator: 'all',
      children: [{ id: 'p1', source: 'security', selector: 'invalid', operator: 'exact', expected: 'x' }],
    };
    const diags = validatePredicateGroup(group, '/predicates', 0);
    expect(diags.some(d => d.code === 'AMS-SCHEMA-INVALID-TYPE')).toBe(true);
  });

  it('rejects certSubject as capability-gated', () => {
    const group: ApiMockPredicateGroupV1 = {
      id: 'pg', combinator: 'all',
      children: [{ id: 'p1', source: 'security', selector: 'certSubject', operator: 'exact', expected: 'CN=test' }],
    };
    const diags = validatePredicateGroup(group, '/predicates', 0);
    expect(diags.some(d => d.code === 'AMS-CAPABILITY-GATED')).toBe(true);
  });

  it('rejects invalid regex in predicates', () => {
    const group: ApiMockPredicateGroupV1 = {
      id: 'pg', combinator: 'all',
      children: [{ id: 'p1', source: 'header', selector: 'x-test', operator: 'regex', expected: '(bad' }],
    };
    const diags = validatePredicateGroup(group, '/predicates', 0);
    expect(diags.some(d => d.code === 'AMS-REGEX-INVALID')).toBe(true);
  });
});

/**
 * Conflict-track API Mock gallery factories.
 */
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import { TS, emptyGroup, jsonBody, jsonHeader, storeRoute } from './presets-helpers';

/**
 * Eight rules, four path-disjoint overlapping pairs — one finding of each
 * Conflict Inspector kind. Quiet corpus for the conflicts lesson; analysis,
 * filters, witness Simulate, goto, priority, and acknowledge are authored live.
 *
 *   duplicate         — two identical GET /health (empty Match, priority 10)
 *   shadowed          — GET /orders catch-all at 20 vs tenant header at 10
 *   definite_overlap  — GET /reports/daily exact vs GET /reports/* glob, equal priority
 *   potential_overlap — GET /search with two header regexes whose intersection is undecidable
 */
export function createOverlapsMock(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-gallery-overlaps',
    name: 'Overlaps API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      storeRoute({
        id: 'route-health-a',
        name: 'Health A',
        method: 'GET',
        path: { kind: 'exact', value: '/health' },
        priority: 10,
        operationId: 'getHealthA',
        tags: ['gallery', 'overlaps', 'duplicate'],
        body: '{"ok":true,"copy":"A"}',
      }),
      storeRoute({
        id: 'route-health-b',
        name: 'Health B',
        method: 'GET',
        path: { kind: 'exact', value: '/health' },
        priority: 10,
        operationId: 'getHealthB',
        tags: ['gallery', 'overlaps', 'duplicate'],
        body: '{"ok":true,"copy":"B"}',
      }),
      storeRoute({
        id: 'route-orders-catchall',
        name: 'Orders catch-all',
        method: 'GET',
        path: { kind: 'exact', value: '/orders' },
        priority: 20,
        operationId: 'getOrdersCatchAll',
        tags: ['gallery', 'overlaps', 'shadowed'],
        body: '{"orders":[],"scope":"all"}',
      }),
      storeRoute({
        id: 'route-orders-tenant',
        name: 'Orders tenant',
        method: 'GET',
        path: { kind: 'exact', value: '/orders' },
        priority: 10,
        operationId: 'getOrdersTenant',
        tags: ['gallery', 'overlaps', 'shadowed'],
        predicates: {
          id: 'pg-route-orders-tenant',
          combinator: 'all',
          children: [{
            id: 'pred-orders-tenant',
            source: 'header',
            selector: 'x-tenant',
            operator: 'exact',
            expected: 'acme',
          }],
        },
        body: '{"orders":[],"scope":"acme"}',
      }),
      storeRoute({
        id: 'route-reports-daily',
        name: 'Daily report',
        method: 'GET',
        path: { kind: 'exact', value: '/reports/daily' },
        priority: 10,
        operationId: 'getDailyReport',
        tags: ['gallery', 'overlaps', 'definite'],
        body: '{"report":"daily"}',
      }),
      storeRoute({
        id: 'route-reports-glob',
        name: 'Reports glob',
        method: 'GET',
        path: { kind: 'glob', value: '/reports/*' },
        priority: 10,
        operationId: 'getReportsGlob',
        tags: ['gallery', 'overlaps', 'definite'],
        body: '{"report":"any"}',
      }),
      storeRoute({
        id: 'route-search-prefix',
        name: 'Search prefix',
        method: 'GET',
        path: { kind: 'exact', value: '/search' },
        priority: 10,
        operationId: 'searchPrefix',
        tags: ['gallery', 'overlaps', 'potential'],
        predicates: {
          id: 'pg-route-search-prefix',
          combinator: 'all',
          children: [{
            id: 'pred-search-prefix',
            source: 'header',
            selector: 'x-client',
            operator: 'regex',
            expected: '^acme',
          }],
        },
        body: '{"hits":[],"matcher":"prefix"}',
      }),
      storeRoute({
        id: 'route-search-region',
        name: 'Search region',
        method: 'GET',
        path: { kind: 'exact', value: '/search' },
        priority: 10,
        operationId: 'searchRegion',
        tags: ['gallery', 'overlaps', 'potential'],
        predicates: {
          id: 'pg-route-search-region',
          combinator: 'all',
          children: [{
            id: 'pred-search-region',
            source: 'header',
            selector: 'x-client',
            operator: 'regex',
            expected: '^acme-.*',
          }],
        },
        body: '{"hits":[],"matcher":"region"}',
      }),
    ],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/** Two overlapping GETs — Conflict Inspector witness sample. */
export function createAmbiguousRoutesMock(): ApiMockServerDefinitionV1 {
  const makeRoute = (
    id: string,
    name: string,
    priority: number,
    body: string,
  ): ApiMockServerDefinitionV1['routes'][0] => ({
    id,
    name,
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/orders' },
    priority,
    predicates: emptyGroup(`pg-${id}`),
    responseMode: 'rules',
    responses: [{
      id: `resp-${id}`,
      name: '200 Default',
      enabled: true,
      isDefault: true,
      status: 200,
      headers: [jsonHeader(`h-${id}`)],
      cookies: [],
      body: jsonBody(body),
      behavior: { delayMs: 0, jitterMs: 0 },
    }],
    tags: ['gallery', 'conflicts'],
    createdAt: TS,
    updatedAt: TS,
  });

  return {
    id: 'srv-gallery-conflicts',
    name: 'Ambiguous routes',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      makeRoute('route-orders-a', 'Orders A (priority 10)', 10, '{"source":"A","orders":[]}'),
      makeRoute('route-orders-b', 'Orders B (priority 10)', 10, '{"source":"B","orders":[]}'),
    ],
    samples: [{
      id: 'sample-orders-witness',
      name: 'GET /orders witness',
      routeId: 'route-orders-a',
      request: {
        method: 'GET',
        path: '/orders',
        rawPath: '/orders',
        query: {},
        headers: {},
        cookies: {},
        body: null,
        bodyTruncated: false,
        receivedAt: TS,
      },
      expected: { outcome: 'ambiguous', status: 409 },
    }],
    variables: [],
    settings: {
      ...structuredClone(DEFAULT_SETTINGS),
      selection: {
        ...structuredClone(DEFAULT_SETTINGS.selection),
        multipleMatchPolicy: 'reject_multiple',
        equalPriorityPolicy: 'reject',
      },
    },
    createdAt: TS,
    updatedAt: TS,
  };
}

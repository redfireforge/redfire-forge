import { describe, it, expect } from 'vitest';
import { apiMockSampleCatalog } from './index';
import { analyzeConflicts } from '../../../shared/api-mock/conflictAnalyzer';
import { matchPath } from '../../../shared/api-mock/pathMatcher';
import { evaluateOperator } from '../../../shared/api-mock/predicateEvaluatorHelpers';
import {
  createHealthCheckMock,
  createStoreLibraryMock,
  createUsersApiMock,
} from './presets-getting-started';
import {
  createBodyMatchingMock,
  createPathMatchingMock,
  createPayloadFormatsMock,
  createPredicateStarterMock,
  createSelectionPolicyMock,
} from './presets-matching';
import {
  createAmbiguousRoutesMock,
  createOverlapsMock,
} from './presets-conflicts';
import {
  createCheckoutCartMock,
  createPaymentMock,
  createResponseContentMock,
  createTemplatingMock,
} from './presets-responses';
import { createSimulationSuiteMock } from './presets-simulation';

describe('api-mock gallery catalog', () => {
  it('ships the Phase 12E samples in curriculum order', () => {
    expect(apiMockSampleCatalog.map(e => e.id)).toEqual([
      'am-gallery-health',
      'am-gallery-users',
      'am-gallery-store',
      'am-gallery-paths',
      'am-gallery-predicates',
      'am-gallery-bodies',
      'am-gallery-formats',
      'am-gallery-selection',
      'am-gallery-overlaps',
      'am-gallery-response',
      'am-gallery-templating',
      'am-gallery-checkout',
      'am-gallery-payment',
      'am-gallery-conflicts',
      'am-gallery-suite',
    ]);
    for (const entry of apiMockSampleCatalog) {
      expect(entry.domain).toBe('api-mock');
      expect(entry.factory().routes.length).toBe(entry.routeCount);
      expect(entry.factory().name).toBeTruthy();
    }
  });

  it('health sample serves GET /health', () => {
    const server = createHealthCheckMock();
    expect(server.routes[0]?.path.value).toBe('/health');
    expect(server.routes[0]?.method).toBe('GET');
    expect(server.samples).toHaveLength(1);
  });

  it('users sample includes parameterized path and POST body predicate', () => {
    const server = createUsersApiMock();
    expect(server.basePath).toBe('/api/v1');
    expect(server.routes.some(r => r.path.kind === 'parameterized')).toBe(true);
    expect(server.routes.some(r => r.method === 'POST')).toBe(true);
  });

  describe('store library sample', () => {
    const server = createStoreLibraryMock();

    it('files twelve rules across the three storefront folders', () => {
      expect(server.routes).toHaveLength(12);
      expect(server.folders.map(f => f.name)).toEqual(['Catalog', 'Cart', 'Orders']);
      for (const route of server.routes) {
        expect(server.folders.some(f => f.id === route.folderId), route.name).toBe(true);
      }
    });

    it('keeps two unfinished drafts so the show-disabled filter has a subject', () => {
      const drafts = server.routes.filter(r => !r.enabled);
      expect(drafts.map(r => r.path.value)).toEqual(['/products/search', '/products/:id/reviews']);
    });

    it('leaves the search draft undocumented for the Documentation tab', () => {
      const draft = server.routes.find(r => r.path.value === '/products/search');
      expect(draft?.operationId).toBeUndefined();
      expect(draft?.tags).toEqual(['store']);
    });

    it('tags three rules for smoke so a tag search crosses folders', () => {
      const smoke = server.routes.filter(r => r.tags.includes('smoke'));
      expect(smoke).toHaveLength(3);
      expect(new Set(smoke.map(r => r.folderId)).size).toBeGreaterThan(1);
    });

    it('reports exactly one overlap: the parameterized order rule captures /orders/latest', async () => {
      const { findings } = await analyzeConflicts(server.routes, server.id);
      expect(findings).toHaveLength(1);
      const pair = findings[0].ruleIds.map(id => server.routes.find(r => r.id === id));
      expect(pair.map(r => r?.path.value).sort()).toEqual(['/orders/:id', '/orders/latest']);
      expect(pair[0]?.priority).toBe(pair[1]?.priority);
      expect(findings[0].selectionOutcome).toBe('reject_ambiguous');
    });
  });

  describe('literal path sample', () => {
    const server = createPathMatchingMock();

    it('ships a single exact rule with no folders and no samples', () => {
      expect(server.routes).toHaveLength(1);
      expect(server.folders).toEqual([]);
      expect(server.samples).toEqual([]);
      expect(server.routes[0]?.folderId).toBeUndefined();
    });

    it('matches only the one product it was recorded from', () => {
      const matcher = server.routes[0]!.path;
      expect(matcher.kind).toBe('exact');
      expect(matchPath(matcher, '/products/42').matched).toBe(true);
      expect(matchPath(matcher, '/products/43').matched).toBe(false);
    });

    it('answers with a product body the lesson can read in Simulate', () => {
      const body = server.routes[0]?.responses[0]?.body.content ?? '';
      expect(JSON.parse(body)).toMatchObject({ id: 42, name: 'Espresso' });
    });
  });

  describe('unconditioned rule sample', () => {
    const server = createPredicateStarterMock();

    it('ships one rule whose match group is empty', () => {
      expect(server.routes).toHaveLength(1);
      expect(server.routes[0]?.predicates.children).toEqual([]);
      expect(server.routes[0]?.predicates.combinator).toBe('all');
    });

    it('matches the report path on method and path alone', () => {
      const route = server.routes[0]!;
      expect(route.method).toBe('GET');
      expect(matchPath(route.path, '/reports').matched).toBe(true);
    });

    it('answers with a tenant-scoped page the lesson shapes requests against', () => {
      const body = server.routes[0]?.responses[0]?.body.content ?? '';
      expect(JSON.parse(body)).toMatchObject({ tenant: 'acme-eu', page: 2, format: 'json' });
    });
  });

  describe('body subset sample', () => {
    const server = createBodyMatchingMock();
    const route = server.routes[0]!;
    const baseline = route.predicates.children[0] as {
      source: string; operator: string; expected: string;
    };
    const richOrder = JSON.stringify({
      customer: { id: 'C-4421', tier: 'gold' },
      items: [{ sku: 'RF-100', qty: 2 }, { sku: 'RF-250', qty: 1 }],
      note: 'gift wrap',
    });

    it('ships one POST rule whose single condition reads the body', () => {
      expect(server.routes).toHaveLength(1);
      expect(route.method).toBe('POST');
      expect(matchPath(route.path, '/orders').matched).toBe(true);
      expect(route.predicates.children).toHaveLength(1);
      expect(baseline).toMatchObject({ source: 'body', operator: 'json_subset' });
    });

    it('accepts a payload with extra fields, because subset means "contains at least"', () => {
      expect(evaluateOperator('json_subset', richOrder, baseline.expected)).toBe(true);
      expect(evaluateOperator('json_strict', richOrder, baseline.expected)).toBe(false);
    });

    it('still rejects the wrong tier', () => {
      const silver = JSON.stringify({ customer: { id: 'C-9', tier: 'silver' } });
      expect(evaluateOperator('json_subset', silver, baseline.expected)).toBe(false);
    });

    it('answers 201 with a confirmation body the lesson reads in Rendered', () => {
      const variant = route.responses[0]!;
      expect(variant.status).toBe(201);
      expect(JSON.parse(variant.body.content)).toMatchObject({ orderId: 'O-7781', status: 'confirmed' });
    });
  });

  describe('non-JSON payload sample', () => {
    const server = createPayloadFormatsMock();

    it('ships four bare rules, one per payload family', () => {
      expect(server.routes).toHaveLength(4);
      expect(server.routes.map(r => `${r.method} ${r.path.value}`)).toEqual([
        'POST /oauth/token',
        'POST /uploads',
        'POST /soap/orders',
        'PUT /firmware',
      ]);
      // Every matcher is authored live, so nothing ships with conditions.
      for (const route of server.routes) {
        expect(route.predicates.children, route.name).toEqual([]);
      }
    });

    it('answers the SOAP rule with XML and the rest with JSON', () => {
      const soap = server.routes.find(r => r.path.value === '/soap/orders')!.responses[0]!;
      expect(soap.body.kind).toBe('xml');
      expect(soap.body.contentType).toBe('application/xml');
      expect(soap.headers[0]).toMatchObject({ key: 'Content-Type', value: 'application/xml' });
      expect(soap.body.content).toContain('<orderId>A-1098</orderId>');

      for (const route of server.routes.filter(r => r.path.value !== '/soap/orders')) {
        const variant = route.responses[0]!;
        expect(variant.body.kind, route.name).toBe('json');
        expect(() => JSON.parse(variant.body.content)).not.toThrow();
      }
    });

    it('answers the upload rule with 201, so Rendered has something to show', () => {
      const upload = server.routes.find(r => r.path.value === '/uploads')!;
      expect(upload.responses[0]?.status).toBe(201);
    });
  });

  describe('overlapping catalog sample', () => {
    const server = createSelectionPolicyMock();

    it('ships two equal-priority GET /catalog rules', () => {
      expect(server.name).toBe('Catalog API');
      expect(server.routes).toHaveLength(2);
      expect(server.routes.map(r => `${r.method} ${r.path.value}`)).toEqual([
        'GET /catalog',
        'GET /catalog',
      ]);
      expect(server.routes.map(r => r.name)).toEqual(['Regional catalog', 'Default catalog']);
      expect(server.routes[0]?.priority).toBe(10);
      expect(server.routes[1]?.priority).toBe(10);
    });

    it('gates the regional rule on X-Api-Version and leaves Default unconditioned', () => {
      const regional = server.routes[0]!;
      expect(regional.predicates.combinator).toBe('all');
      expect(regional.predicates.children).toEqual([
        expect.objectContaining({
          source: 'header',
          selector: 'x-api-version',
          operator: 'exact',
          expected: '2024-11',
        }),
      ]);
      expect(server.routes[1]?.predicates.children).toEqual([]);
    });

    it('refuses equal-priority ties so Simulate starts on AMBIGUOUS', () => {
      expect(server.settings.selection.multipleMatchPolicy).toBe('highest_priority');
      expect(server.settings.selection.equalPriorityPolicy).toBe('reject');
    });
  });

  describe('four overlap kinds sample', () => {
    const server = createOverlapsMock();

    it('ships eight path-disjoint pairs and refuses equal-priority ties', () => {
      expect(server.routes).toHaveLength(8);
      expect(server.settings.selection.equalPriorityPolicy).toBe('reject');
      expect(new Set(server.routes.map(r => r.path.value)).size).toBe(5);
    });

    it('produces exactly one finding of each inspector kind', async () => {
      const { findings } = await analyzeConflicts(server.routes, server.id);
      expect(findings.map(f => f.kind).sort()).toEqual([
        'definite_overlap',
        'duplicate',
        'potential_overlap',
        'shadowed',
      ]);
    });

    it('keeps the glob on /reports/* from colliding with health, orders, or search', () => {
      const glob = server.routes.find(r => r.path.kind === 'glob')!.path;
      expect(matchPath(glob, '/reports/daily').matched).toBe(true);
      expect(matchPath(glob, '/reports').matched).toBe(false);
      expect(matchPath(glob, '/health').matched).toBe(false);
      expect(matchPath(glob, '/orders').matched).toBe(false);
      expect(matchPath(glob, '/search').matched).toBe(false);
    });
  });

  it('response-content sample is a plain GET /orders 200 {}', () => {
    const server = createResponseContentMock();
    expect(server.routes).toHaveLength(1);
    const route = server.routes[0]!;
    expect(route.method).toBe('GET');
    expect(route.path).toMatchObject({ kind: 'exact', value: '/orders' });
    expect(route.predicates.children).toEqual([]);
    expect(route.responses[0]?.status).toBe(200);
    expect(route.responses[0]?.headers).toEqual([]);
    expect(route.responses[0]?.cookies).toEqual([]);
    expect(route.responses[0]?.body).toMatchObject({
      kind: 'json',
      contentType: 'application/json',
      content: '{}',
    });
  });

  it('templating sample is a parameterized GET /products/:id with a static JSON body', () => {
    const server = createTemplatingMock();
    expect(server.routes).toHaveLength(1);
    const route = server.routes[0]!;
    expect(route.method).toBe('GET');
    expect(route.path).toMatchObject({ kind: 'parameterized', value: '/products/:id' });
    expect(route.predicates.children).toEqual([]);
    expect(route.responses[0]?.status).toBe(200);
    expect(route.responses[0]?.body).toMatchObject({
      kind: 'json',
      contentType: 'application/json',
      content: '{"id":"static","name":"Widget"}',
    });
    expect(server.variables).toEqual([]);
    expect(matchPath(route.path, '/products/42').matched).toBe(true);
    expect(matchPath(route.path, '/products/42').params).toEqual({ id: '42' });
  });

  it('checkout sample is a single POST /cart with one 200 variant', () => {
    const server = createCheckoutCartMock();
    expect(server.routes).toHaveLength(1);
    const route = server.routes[0]!;
    expect(route.method).toBe('POST');
    expect(route.path).toMatchObject({ kind: 'exact', value: '/cart' });
    expect(route.responseMode).toBe('rules');
    expect(route.predicates.children).toEqual([]);
    expect(route.responses).toHaveLength(1);
    expect(route.responses[0]?.isDefault).toBe(true);
    expect(route.responses[0]?.status).toBe(200);
    expect(route.responses[0]?.conditions).toBeUndefined();
    expect(route.responses[0]?.body).toMatchObject({
      kind: 'json',
      contentType: 'application/json',
      content: '{"ok":true,"items":[]}',
    });
  });

  it('payment sample is a single POST /payments with a plain 200', () => {
    const server = createPaymentMock();
    expect(server.routes).toHaveLength(1);
    const route = server.routes[0]!;
    expect(route.method).toBe('POST');
    expect(route.path).toMatchObject({ kind: 'exact', value: '/payments' });
    expect(route.responseMode).toBe('rules');
    expect(route.predicates.children).toEqual([]);
    expect(route.responses).toHaveLength(1);
    expect(route.responses[0]?.name).toBe('Paid');
    expect(route.responses[0]?.status).toBe(200);
    expect(route.responses[0]?.behavior).toMatchObject({ delayMs: 0, jitterMs: 0 });
    expect(route.responses[0]?.behavior.fault).toBeUndefined();
    expect(route.responses[0]?.behavior.maxMatches).toBeUndefined();
    expect(route.responses[0]?.body).toMatchObject({
      kind: 'json',
      contentType: 'application/json',
      content: '{"ok":true,"id":"pay-1001"}',
    });
  });

  it('conflicts sample has two equal-priority overlapping GETs', () => {
    const server = createAmbiguousRoutesMock();
    expect(server.routes).toHaveLength(2);
    expect(server.routes.every(r => r.path.value === '/orders')).toBe(true);
    expect(server.routes[0]?.priority).toBe(server.routes[1]?.priority);
    expect(server.settings.selection.multipleMatchPolicy).toBe('reject_multiple');
  });

  it('simulation suite ships eight samples covering pass, ambiguous, fault, unmatched, weighted, state, and an unassociated example', () => {
    const server = createSimulationSuiteMock();
    expect(server.routes).toHaveLength(6);
    expect(server.samples).toHaveLength(8);
    expect(server.samples?.map(s => s.id)).toEqual([
      'sample-health',
      'sample-overlap',
      'sample-fault',
      'sample-dice',
      'sample-cart',
      'sample-missing',
      'sample-health-alt',
      'sample-orphan',
    ]);
    expect(server.samples?.every(s => s.expected?.outcome)).toBe(true);
    expect(server.samples?.find(s => s.id === 'sample-orphan')?.routeId).toBeUndefined();
    expect(server.routes.find(r => r.id === 'route-dice')?.responseMode).toBe('weighted');
    expect(server.routes.find(r => r.id === 'route-cart')?.responseMode).toBe('state');
    expect(server.routes.find(r => r.id === 'route-fault')?.responses[0]?.behavior.fault).toBe('reset');
  });
});

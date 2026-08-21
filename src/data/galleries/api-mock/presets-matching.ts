/**
 * Matching-track API Mock gallery factories.
 */
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import { TS, storeRoute } from './presets-helpers';

/**
 * One literal rule, captured from a single real request — the starting point for
 * path matching.
 *
 * Deliberately minimal: `GET /products/42` is what a recording or a hand-written
 * first mock actually looks like, and it only ever answers id 42. Every other path
 * kind (parameterized, glob, regex) is authored on top of it in the lesson, so the
 * corpus teaches nothing by itself — it only sets up the problem.
 */
export function createPathMatchingMock(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-gallery-paths',
    name: 'Catalog API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      storeRoute({
        id: 'route-product-42',
        name: 'Get Product 42',
        method: 'GET',
        path: { kind: 'exact', value: '/products/42' },
        priority: 10,
        operationId: 'getProduct',
        tags: ['gallery', 'paths'],
        body: '{"id":42,"name":"Espresso","price":3.5,"inStock":true}',
      }),
    ],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * One rule with **no** match conditions — the starting point for request predicates.
 *
 * `GET /reports` answers every shape of request that reaches it: any query string,
 * any headers, any cookie, authenticated or not. Query, header, cookie, security and
 * absence conditions are all authored live in the lesson, so the corpus ships the
 * problem (a rule that cannot tell two callers apart) rather than the solution.
 */
export function createPredicateStarterMock(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-gallery-predicates',
    name: 'Reports API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      storeRoute({
        id: 'route-list-reports',
        name: 'List Reports',
        method: 'GET',
        path: { kind: 'exact', value: '/reports' },
        priority: 10,
        operationId: 'listReports',
        tags: ['gallery', 'predicates'],
        body: '{"tenant":"acme-eu","page":2,"format":"json",'
          + '"items":[{"id":"R-1042","total":18400},{"id":"R-1043","total":9250}]}',
      }),
    ],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * One rule whose only condition reads the **request body** — the starting point for
 * body matching.
 *
 * `POST /orders` accepts any payload that *contains* `customer.tier = "gold"`, which
 * is the forgiving default (`json_subset`) and the right place to start explaining
 * body matchers. The expected fragment is a compact one-liner so the Match row
 * shows the whole matcher. Strict equality, JSONPath, and
 * a JSON Schema contract are all authored live in the lesson, so the corpus ships
 * one honest baseline rather than a finished matcher stack.
 */
export function createBodyMatchingMock(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-gallery-bodies',
    name: 'Orders API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      storeRoute({
        id: 'route-create-order',
        name: 'Create Order',
        method: 'POST',
        path: { kind: 'exact', value: '/orders' },
        priority: 10,
        status: 201,
        operationId: 'createOrder',
        tags: ['gallery', 'bodies'],
        predicates: {
          id: 'pg-route-create-order',
          combinator: 'all',
          children: [{
            id: 'pred-order-subset',
            source: 'body',
            selector: '',
            operator: 'json_subset',
            expected: '{"customer":{"tier":"gold"}}',
          }],
        },
        body: '{"orderId":"O-7781","status":"confirmed","tier":"gold","total":1240}',
      }),
    ],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * Four rules that answer **non-JSON** payloads and match on nothing — the starting
 * point for form, multipart, XML, and binary matchers.
 *
 * A token endpoint (urlencoded), an upload endpoint (multipart), a SOAP-shaped order
 * endpoint (XML in *and* out), and a firmware endpoint (raw bytes). Every one of them
 * currently answers any body at all, which is the problem the lesson fixes: each
 * payload family has its own matcher, and none of them is a JSON matcher. The rules
 * ship bare so the whole condition stack is authored live.
 */
export function createPayloadFormatsMock(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-gallery-formats',
    name: 'Intake API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      storeRoute({
        id: 'route-token-form',
        name: 'Issue Token (form)',
        method: 'POST',
        path: { kind: 'exact', value: '/oauth/token' },
        priority: 10,
        operationId: 'issueToken',
        tags: ['gallery', 'formats', 'form'],
        body: '{"access_token":"at-7f31c9","token_type":"Bearer","expires_in":3600}',
      }),
      storeRoute({
        id: 'route-upload-multipart',
        name: 'Upload Document (multipart)',
        method: 'POST',
        path: { kind: 'exact', value: '/uploads' },
        priority: 10,
        status: 201,
        operationId: 'uploadDocument',
        tags: ['gallery', 'formats', 'multipart'],
        body: '{"uploadId":"U-3391","status":"stored","scanned":true}',
      }),
      storeRoute({
        id: 'route-soap-order',
        name: 'Submit Order (SOAP)',
        method: 'POST',
        path: { kind: 'exact', value: '/soap/orders' },
        priority: 10,
        operationId: 'submitOrder',
        tags: ['gallery', 'formats', 'xml'],
        bodyKind: 'xml',
        body: '<OrderAck><orderId>A-1098</orderId><status>accepted</status></OrderAck>',
      }),
      storeRoute({
        id: 'route-firmware-binary',
        name: 'Publish Firmware (binary)',
        method: 'PUT',
        path: { kind: 'exact', value: '/firmware' },
        priority: 10,
        operationId: 'publishFirmware',
        tags: ['gallery', 'formats', 'binary'],
        body: '{"artifact":"firmware","version":"2.4.0","accepted":true}',
      }),
    ],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * Two overlapping GET /catalog rules at equal priority — the starting point for
 * boolean groups and selection policy.
 *
 * Regional already requires `X-Api-Version: 2024-11` (the AND). Default matches
 * every GET /catalog. A request that carries the version header matches **both**,
 * and the default equal-priority policy refuses to guess (409). Nested OR tenants,
 * a None-of guard, priority, and the two multiple-match policies are authored live.
 */
export function createSelectionPolicyMock(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-gallery-selection',
    name: 'Catalog API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      storeRoute({
        id: 'route-catalog-regional',
        name: 'Regional catalog',
        method: 'GET',
        path: { kind: 'exact', value: '/catalog' },
        priority: 10,
        operationId: 'getRegionalCatalog',
        tags: ['gallery', 'selection', 'regional'],
        predicates: {
          id: 'pg-route-catalog-regional',
          combinator: 'all',
          children: [{
            id: 'pred-catalog-version',
            source: 'header',
            selector: 'x-api-version',
            operator: 'exact',
            expected: '2024-11',
          }],
        },
        body: '{"catalog":"regional","version":"2024-11"}',
      }),
      storeRoute({
        id: 'route-catalog-default',
        name: 'Default catalog',
        method: 'GET',
        path: { kind: 'exact', value: '/catalog' },
        priority: 10,
        operationId: 'getDefaultCatalog',
        tags: ['gallery', 'selection', 'default'],
        body: '{"catalog":"default"}',
      }),
    ],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

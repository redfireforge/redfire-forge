/**
 * Response-track API Mock gallery factories.
 */
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse } from '@shared/api-mock/defaults';
import { TS, emptyGroup, jsonBody } from './presets-helpers';

/**
 * One rule returning a plain `200 {}` — the starting point for response content.
 *
 * `GET /orders` already matches, but the payload is an empty JSON object with no
 * extra headers or cookies. Status, reason phrase, Content-Type, Format, headers,
 * cookies, and the other body kinds are all authored live in the lesson.
 */
export function createResponseContentMock(): ApiMockServerDefinitionV1 {
  const resp = createDefaultResponse('resp-orders');
  resp.status = 200;
  resp.headers = [];
  resp.cookies = [];
  resp.body = jsonBody('{}');
  return {
    id: 'srv-gallery-response',
    name: 'Orders API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: 'route-create-order',
      name: 'Create order',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/orders' },
      priority: 10,
      predicates: emptyGroup('pg-orders'),
      responseMode: 'rules',
      responses: [resp],
      tags: ['gallery', 'response'],
      createdAt: TS,
      updatedAt: TS,
    }],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * One parameterized rule returning a static JSON body — the starting point for
 * templates, faker, variables, and Map body.
 *
 * `GET /products/:id` already matches `/products/42`, but the payload is a
 * hard-coded `{"id":"static","name":"Widget"}` with no helpers. Every template
 * helper is authored live in the lesson.
 */
export function createTemplatingMock(): ApiMockServerDefinitionV1 {
  const resp = createDefaultResponse('resp-product');
  resp.status = 200;
  resp.headers = [];
  resp.cookies = [];
  resp.body = jsonBody('{"id":"static","name":"Widget"}');
  return {
    id: 'srv-gallery-templating',
    name: 'Products API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: 'route-get-product',
      name: 'Get product',
      enabled: true,
      method: 'GET',
      path: { kind: 'parameterized', value: '/products/:id' },
      priority: 10,
      predicates: emptyGroup('pg-product'),
      responseMode: 'rules',
      responses: [resp],
      tags: ['gallery', 'templating'],
      createdAt: TS,
      updatedAt: TS,
    }],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * One cart rule with a single 200 variant — the starting point for response
 * variants and sequence mode.
 *
 * `POST /cart` already matches and answers `{"ok":true,"items":[]}`. The 404
 * sibling, its JSONPath condition, Default, and sequence mode are authored live.
 */
export function createCheckoutCartMock(): ApiMockServerDefinitionV1 {
  const resp = createDefaultResponse('resp-cart');
  resp.name = 'In cart';
  resp.status = 200;
  resp.headers = [];
  resp.cookies = [];
  resp.body = jsonBody('{"ok":true,"items":[]}');
  return {
    id: 'srv-gallery-checkout',
    name: 'Cart API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: 'route-post-cart',
      name: 'Add to cart',
      enabled: true,
      method: 'POST',
      path: { kind: 'exact', value: '/cart' },
      priority: 10,
      predicates: emptyGroup('pg-cart'),
      responseMode: 'rules',
      responses: [resp],
      tags: ['gallery', 'checkout', 'cart'],
      createdAt: TS,
      updatedAt: TS,
    }],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * One `POST /payments` already matches, but the 200 has no delay, jitter,
 * eligibility, or faults. Timing, match limits, and connection faults are all
 * authored live in the lesson.
 */
export function createPaymentMock(): ApiMockServerDefinitionV1 {
  const resp = createDefaultResponse('resp-payment');
  resp.name = 'Paid';
  resp.status = 200;
  resp.headers = [];
  resp.cookies = [];
  resp.body = jsonBody('{"ok":true,"id":"pay-1001"}');
  return {
    id: 'srv-gallery-payment',
    name: 'Payments API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: 'route-post-payments',
      name: 'Charge payment',
      enabled: true,
      method: 'POST',
      path: { kind: 'exact', value: '/payments' },
      priority: 10,
      predicates: emptyGroup('pg-payments'),
      responseMode: 'rules',
      responses: [resp],
      tags: ['gallery', 'payment', 'timing'],
      createdAt: TS,
      updatedAt: TS,
    }],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

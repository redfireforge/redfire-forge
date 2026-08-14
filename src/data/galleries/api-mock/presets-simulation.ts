/**
 * Simulation-suite API Mock gallery factory.
 */
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../../shared/api-mock/defaults';
import { TS, emptyGroup, jsonBody, jsonHeader } from './presets-helpers';

/**
 * Eight simulation samples with expectations — the suite is the subject of
 * the simulation-as-a-test-suite lesson. Ad-hoc runs, the wrong-status edit,
 * Attach, and Try in Requests are authored live.
 */
export function createSimulationSuiteMock(): ApiMockServerDefinitionV1 {
  const healthId = 'route-health';
  const overlapA = 'route-overlap-a';
  const overlapB = 'route-overlap-b';
  const faultId = 'route-fault';
  const diceId = 'route-dice';
  const cartId = 'route-cart';

  const health = createDefaultResponse('resp-health');
  health.headers = [jsonHeader('h-health')];
  health.body = jsonBody('{"ok":true}');

  const overlapResp = (id: string, source: string) => {
    const resp = createDefaultResponse(id);
    resp.headers = [jsonHeader(`h-${id}`)];
    resp.body = jsonBody(`{"source":"${source}"}`);
    return resp;
  };

  const fault = createDefaultResponse('resp-fault');
  fault.headers = [jsonHeader('h-fault')];
  fault.body = jsonBody('{"ok":false}');
  fault.behavior = { delayMs: 0, jitterMs: 0, fault: 'reset' };

  const heads = createDefaultResponse('resp-heads');
  heads.name = 'Heads';
  heads.weight = 50;
  heads.headers = [jsonHeader('h-heads')];
  heads.body = jsonBody('{"face":"heads"}');

  const tails = createDefaultResponse('resp-tails');
  tails.name = 'Tails';
  tails.isDefault = false;
  tails.weight = 50;
  tails.headers = [jsonHeader('h-tails')];
  tails.body = jsonBody('{"face":"tails"}');

  const cartOpen = createDefaultResponse('resp-cart-open');
  cartOpen.name = 'Opened';
  cartOpen.headers = [jsonHeader('h-cart-open')];
  cartOpen.body = jsonBody('{"cart":"opened"}');
  cartOpen.transition = { currentState: '', targetState: 'opened' };

  const cartDone = createDefaultResponse('resp-cart-done');
  cartDone.name = 'Done';
  cartDone.isDefault = false;
  cartDone.headers = [jsonHeader('h-cart-done')];
  cartDone.body = jsonBody('{"cart":"done"}');
  cartDone.transition = { currentState: 'opened', targetState: 'done' };

  const req = (method: 'GET' | 'POST', path: string) => ({
    method,
    path,
    rawPath: path,
    query: {},
    headers: {},
    cookies: {},
    body: null as string | null,
    bodyTruncated: false,
    receivedAt: TS,
  });

  const makeRoute = (
    id: string,
    name: string,
    method: 'GET' | 'POST',
    path: string,
    mode: ApiMockServerDefinitionV1['routes'][0]['responseMode'],
    responses: ApiMockServerDefinitionV1['routes'][0]['responses'],
    priority = 10,
  ): ApiMockServerDefinitionV1['routes'][0] => ({
    id,
    name,
    enabled: true,
    method,
    path: { kind: 'exact', value: path },
    priority,
    predicates: emptyGroup(`pg-${id}`),
    responseMode: mode,
    responses,
    tags: ['gallery', 'suite'],
    createdAt: TS,
    updatedAt: TS,
  });

  return {
    id: 'srv-gallery-suite',
    name: 'Simulation suite',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      makeRoute(healthId, 'Health', 'GET', '/health', 'rules', [health]),
      makeRoute(overlapA, 'Overlap A', 'GET', '/overlap', 'rules', [overlapResp('resp-overlap-a', 'A')]),
      makeRoute(overlapB, 'Overlap B', 'GET', '/overlap', 'rules', [overlapResp('resp-overlap-b', 'B')]),
      makeRoute(faultId, 'Fault', 'GET', '/fault', 'rules', [fault]),
      makeRoute(diceId, 'Dice', 'GET', '/dice', 'weighted', [heads, tails]),
      makeRoute(cartId, 'Cart', 'POST', '/cart', 'state', [cartOpen, cartDone]),
    ],
    samples: [
      {
        id: 'sample-health',
        name: 'GET /health',
        routeId: healthId,
        request: req('GET', '/health'),
        expected: { outcome: 'matched', routeId: healthId, status: 200, bodyContains: 'ok' },
      },
      {
        id: 'sample-overlap',
        name: 'GET /overlap',
        routeId: overlapA,
        request: req('GET', '/overlap'),
        expected: { outcome: 'ambiguous', status: 409 },
      },
      {
        id: 'sample-fault',
        name: 'GET /fault',
        routeId: faultId,
        request: req('GET', '/fault'),
        expected: { outcome: 'fault' },
      },
      {
        id: 'sample-dice',
        name: 'GET /dice',
        routeId: diceId,
        request: req('GET', '/dice'),
        expected: { outcome: 'matched', routeId: diceId, status: 200 },
      },
      {
        id: 'sample-cart',
        name: 'POST /cart',
        routeId: cartId,
        request: req('POST', '/cart'),
        expected: { outcome: 'matched', routeId: cartId, status: 200, bodyContains: 'opened' },
      },
      {
        id: 'sample-missing',
        name: 'GET /missing',
        request: req('GET', '/missing'),
        expected: { outcome: 'unmatched', status: 404, bodyContains: 'not_found' },
      },
      {
        id: 'sample-health-alt',
        name: 'GET /health (alt)',
        routeId: healthId,
        request: req('GET', '/health'),
        expected: { outcome: 'matched', routeId: healthId, status: 200 },
      },
      {
        id: 'sample-orphan',
        name: 'Unassociated GET /health',
        request: req('GET', '/health'),
        expected: { outcome: 'matched', status: 200, bodyContains: 'ok' },
      },
    ],
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

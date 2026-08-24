/**
 * State-mode API Mock gallery factories.
 */
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse } from '@shared/api-mock/defaults';
import { TS, emptyGroup, jsonBody, jsonHeader } from './presets-helpers';

/**
 * AM-STATE-01 — Order lifecycle: idle → pending → paid → complete.
 *
 * Four routes share one state key. POST /orders creates the order (idle→pending).
 * POST /orders/:id/pay requires the pending state and advances to paid.
 * POST /orders/:id/confirm requires paid and advances to complete.
 * GET /orders/:id returns a different status body per state via conditional variants.
 */
export function createOrderFlowMock(): ApiMockServerDefinitionV1 {
  // ── POST /orders ──────────────────────────────────────────────────────────
  const createOrder = createDefaultResponse('resp-orders-create');
  createOrder.name = 'Created (idle→pending)';
  createOrder.status = 201;
  createOrder.headers = [jsonHeader('h-orders-create')];
  createOrder.body = jsonBody('{"id":"ord-1","status":"pending"}');
  createOrder.transition = { targetState: 'pending' };

  // ── POST /orders/:id/pay ──────────────────────────────────────────────────
  const payOk = createDefaultResponse('resp-pay-ok');
  payOk.name = '200 Paid (pending→paid)';
  payOk.status = 200;
  payOk.headers = [jsonHeader('h-pay-ok')];
  payOk.body = jsonBody('{"id":"ord-1","status":"paid"}');
  payOk.transition = { currentState: 'pending', targetState: 'paid' };
  payOk.conditions = {
    id: 'cond-pay-pending',
    combinator: 'all',
    children: [{
      id: 'pred-pay-state',
      source: 'transport',
      selector: 'state',
      operator: 'exact',
      expected: 'pending',
    }],
  };

  const payConflict = createDefaultResponse('resp-pay-conflict');
  payConflict.name = '409 Wrong state';
  payConflict.isDefault = false;
  payConflict.status = 409;
  payConflict.headers = [jsonHeader('h-pay-conflict')];
  payConflict.body = jsonBody('{"error":"order_not_pending","currentStatus":"not pending"}');

  // ── POST /orders/:id/confirm ──────────────────────────────────────────────
  const confirmOk = createDefaultResponse('resp-confirm-ok');
  confirmOk.name = '200 Complete (paid→complete)';
  confirmOk.status = 200;
  confirmOk.headers = [jsonHeader('h-confirm-ok')];
  confirmOk.body = jsonBody('{"id":"ord-1","status":"complete","receipt":"REC-001"}');
  confirmOk.transition = { currentState: 'paid', targetState: 'complete' };
  confirmOk.conditions = {
    id: 'cond-confirm-paid',
    combinator: 'all',
    children: [{
      id: 'pred-confirm-state',
      source: 'transport',
      selector: 'state',
      operator: 'exact',
      expected: 'paid',
    }],
  };

  const confirmConflict = createDefaultResponse('resp-confirm-conflict');
  confirmConflict.name = '409 Wrong state';
  confirmConflict.isDefault = false;
  confirmConflict.status = 409;
  confirmConflict.headers = [jsonHeader('h-confirm-conflict')];
  confirmConflict.body = jsonBody('{"error":"order_not_paid","currentStatus":"not paid"}');

  // ── GET /orders/:id ───────────────────────────────────────────────────────
  const getPending = createDefaultResponse('resp-get-pending');
  getPending.name = 'Pending';
  getPending.status = 200;
  getPending.headers = [jsonHeader('h-get-pending')];
  getPending.body = jsonBody('{"id":"ord-1","status":"pending"}');
  getPending.conditions = {
    id: 'cond-get-pending',
    combinator: 'all',
    children: [{
      id: 'pred-get-pending',
      source: 'transport',
      selector: 'state',
      operator: 'exact',
      expected: 'pending',
    }],
  };

  const getPaid = createDefaultResponse('resp-get-paid');
  getPaid.name = 'Paid';
  getPaid.isDefault = false;
  getPaid.status = 200;
  getPaid.headers = [jsonHeader('h-get-paid')];
  getPaid.body = jsonBody('{"id":"ord-1","status":"paid"}');
  getPaid.conditions = {
    id: 'cond-get-paid',
    combinator: 'all',
    children: [{
      id: 'pred-get-paid',
      source: 'transport',
      selector: 'state',
      operator: 'exact',
      expected: 'paid',
    }],
  };

  const getComplete = createDefaultResponse('resp-get-complete');
  getComplete.name = 'Complete';
  getComplete.isDefault = false;
  getComplete.status = 200;
  getComplete.headers = [jsonHeader('h-get-complete')];
  getComplete.body = jsonBody('{"id":"ord-1","status":"complete","receipt":"REC-001"}');
  getComplete.conditions = {
    id: 'cond-get-complete',
    combinator: 'all',
    children: [{
      id: 'pred-get-complete',
      source: 'transport',
      selector: 'state',
      operator: 'exact',
      expected: 'complete',
    }],
  };

  const getIdle = createDefaultResponse('resp-get-idle');
  getIdle.name = '404 Not found / idle';
  getIdle.isDefault = false;
  getIdle.status = 404;
  getIdle.headers = [jsonHeader('h-get-idle')];
  getIdle.body = jsonBody('{"error":"order_not_found"}');

  return {
    id: 'srv-gallery-order-flow',
    name: 'Stateful order flow',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      {
        id: 'route-orders-create',
        name: 'POST /orders',
        enabled: true,
        method: 'POST',
        path: { kind: 'exact', value: '/orders' },
        priority: 10,
        predicates: emptyGroup('pg-orders-create'),
        responseMode: 'state',
        responses: [createOrder],
        tags: ['gallery', 'state', 'order'],
        operationId: 'createOrder',
        createdAt: TS,
        updatedAt: TS,
      },
      {
        id: 'route-orders-pay',
        name: 'POST /orders/:id/pay',
        enabled: true,
        method: 'POST',
        path: { kind: 'parameterized', value: '/orders/:id/pay' },
        priority: 10,
        predicates: emptyGroup('pg-orders-pay'),
        responseMode: 'state',
        responses: [payOk, payConflict],
        tags: ['gallery', 'state', 'order', 'pay'],
        operationId: 'payOrder',
        createdAt: TS,
        updatedAt: TS,
      },
      {
        id: 'route-orders-confirm',
        name: 'POST /orders/:id/confirm',
        enabled: true,
        method: 'POST',
        path: { kind: 'parameterized', value: '/orders/:id/confirm' },
        priority: 10,
        predicates: emptyGroup('pg-orders-confirm'),
        responseMode: 'state',
        responses: [confirmOk, confirmConflict],
        tags: ['gallery', 'state', 'order', 'confirm'],
        operationId: 'confirmOrder',
        createdAt: TS,
        updatedAt: TS,
      },
      {
        id: 'route-orders-get',
        name: 'GET /orders/:id',
        enabled: true,
        method: 'GET',
        path: { kind: 'parameterized', value: '/orders/:id' },
        priority: 10,
        predicates: emptyGroup('pg-orders-get'),
        responseMode: 'state',
        responses: [getPending, getPaid, getComplete, getIdle],
        tags: ['gallery', 'state', 'order', 'get'],
        operationId: 'getOrder',
        createdAt: TS,
        updatedAt: TS,
      },
    ],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

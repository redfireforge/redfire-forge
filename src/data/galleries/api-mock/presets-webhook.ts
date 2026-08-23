/**
 * Webhook-receiver API Mock gallery factories.
 */
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse } from '@shared/api-mock/defaults';
import { TS, emptyGroup, jsonBody, jsonHeader } from './presets-helpers';

/**
 * AM-WH-01 — Inbound webhook receiver with event-type routing.
 *
 * Three variants on POST /webhook gate on $.event via json_subset matching.
 * The first two match specific event types and return 200; the third is the
 * default catch-all returning 400 for unknown events.
 *
 * Note: HMAC signature verification (X-Hub-Signature-256) is not yet a
 * predicate operator in this engine — see Part 6f of missing-samples-in-gallery.md.
 */
export function createWebhookReceiverMock(): ApiMockServerDefinitionV1 {
  const orderCreated = createDefaultResponse('resp-wh-order-created');
  orderCreated.name = 'order.created → 200';
  orderCreated.status = 200;
  orderCreated.headers = [jsonHeader('h-wh-order-created')];
  orderCreated.body = jsonBody('{"ok":true,"event":"order.created"}');
  orderCreated.conditions = {
    id: 'cond-wh-order-created',
    combinator: 'all',
    children: [{
      id: 'pred-wh-order-created',
      source: 'body',
      selector: '',
      operator: 'json_subset',
      expected: '{"event":"order.created"}',
    }],
  };

  const orderCancelled = createDefaultResponse('resp-wh-order-cancelled');
  orderCancelled.name = 'order.cancelled → 200';
  orderCancelled.isDefault = false;
  orderCancelled.status = 200;
  orderCancelled.headers = [jsonHeader('h-wh-order-cancelled')];
  orderCancelled.body = jsonBody('{"ok":true,"event":"order.cancelled"}');
  orderCancelled.conditions = {
    id: 'cond-wh-order-cancelled',
    combinator: 'all',
    children: [{
      id: 'pred-wh-order-cancelled',
      source: 'body',
      selector: '',
      operator: 'json_subset',
      expected: '{"event":"order.cancelled"}',
    }],
  };

  // Default catch-all for unknown event types — no conditions, responds 400
  const unknown = createDefaultResponse('resp-wh-unknown');
  unknown.name = 'Unknown event → 400';
  unknown.isDefault = false;
  unknown.status = 400;
  unknown.headers = [jsonHeader('h-wh-unknown')];
  unknown.body = jsonBody('{"error":"unknown_event","hint":"supported: order.created, order.cancelled"}');

  return {
    id: 'srv-gallery-webhook',
    name: 'Webhook receiver',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: 'route-webhook',
      name: 'POST /webhook',
      enabled: true,
      method: 'POST',
      path: { kind: 'exact', value: '/webhook' },
      priority: 10,
      predicates: emptyGroup('pg-webhook'),
      responseMode: 'rules',
      responses: [orderCreated, orderCancelled, unknown],
      tags: ['gallery', 'webhook', 'json-subset', 'event'],
      operationId: 'receiveWebhook',
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

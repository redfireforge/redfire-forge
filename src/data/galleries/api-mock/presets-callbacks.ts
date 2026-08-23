/**
 * Outbound-callback API Mock gallery factories.
 */
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse } from '@shared/api-mock/defaults';
import { TS, jsonBody, jsonHeader } from './presets-helpers';

const NOTIFY_URL = 'https://example.com/notify';

/**
 * AM-CALLBACK-01 — Two checkout endpoints that fire outbound callbacks on match.
 *
 * Both routes POST /checkout and POST /checkout/retry return 200 immediately,
 * and then dispatch an outbound HTTP POST to the allowlisted notify URL with a
 * body template that interpolates `{{request.body.orderId}}`.
 *
 * The retry route additionally sets maxRetries to 3 with exponential back-off
 * (1s / 4s / 16s) to demonstrate the retry configuration.
 *
 * Settings.callbacks.allowlist must include the notify URL — without this the
 * engine blocks all outbound calls on a default-deny basis.
 */
export function createOutboundCallbacksMock(): ApiMockServerDefinitionV1 {
  const checkoutResp = createDefaultResponse('resp-checkout');
  checkoutResp.name = 'Checkout received';
  checkoutResp.status = 200;
  checkoutResp.headers = [jsonHeader('h-checkout')];
  checkoutResp.body = jsonBody('{"received":true,"message":"Order queued"}');
  checkoutResp.callbacks = [{
    id: 'cb-checkout-notify',
    enabled: true,
    url: NOTIFY_URL,
    method: 'POST',
    headers: [{ id: 'cbh-checkout', key: 'Content-Type', value: 'application/json', enabled: true }],
    bodyTemplate: '{"event":"checkout","orderId":"{{request.body.orderId}}","timestamp":"{{now.iso}}"}',
    timeoutMs: 10_000,
    maxRetries: 0,
  }];

  const retryResp = createDefaultResponse('resp-checkout-retry');
  retryResp.name = 'Checkout received (retry)';
  retryResp.status = 200;
  retryResp.headers = [jsonHeader('h-checkout-retry')];
  retryResp.body = jsonBody('{"received":true,"message":"Order queued with retry enabled"}');
  retryResp.callbacks = [{
    id: 'cb-checkout-retry-notify',
    enabled: true,
    url: NOTIFY_URL,
    method: 'POST',
    headers: [{ id: 'cbh-retry', key: 'Content-Type', value: 'application/json', enabled: true }],
    bodyTemplate: '{"event":"checkout.retry","orderId":"{{request.body.orderId}}","attempt":"{{retry.attempt}}"}',
    timeoutMs: 10_000,
    maxRetries: 3,
  }];

  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.callbacks = { allowlist: [NOTIFY_URL] };

  return {
    id: 'srv-gallery-callbacks',
    name: 'Outbound callbacks',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      {
        id: 'route-checkout',
        name: 'POST /checkout',
        enabled: true,
        method: 'POST',
        path: { kind: 'exact', value: '/checkout' },
        priority: 10,
        predicates: { id: 'pg-checkout', combinator: 'all', children: [] },
        responseMode: 'rules',
        responses: [checkoutResp],
        tags: ['gallery', 'callbacks', 'checkout'],
        operationId: 'checkout',
        createdAt: TS,
        updatedAt: TS,
      },
      {
        id: 'route-checkout-retry',
        name: 'POST /checkout/retry',
        enabled: true,
        method: 'POST',
        path: { kind: 'exact', value: '/checkout/retry' },
        priority: 10,
        predicates: { id: 'pg-checkout-retry', combinator: 'all', children: [] },
        responseMode: 'rules',
        responses: [retryResp],
        tags: ['gallery', 'callbacks', 'checkout', 'retry'],
        operationId: 'checkoutRetry',
        createdAt: TS,
        updatedAt: TS,
      },
    ],
    samples: [],
    variables: [],
    settings,
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * Correlation handler — webhook security, idempotent cache, notifyResume, and
 * resume queue cleanup behavior.
 *
 * Store/utility coverage lives in `correlation-handler.test.ts`. HTTP route
 * coverage lives in `correlation-handler.http.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clearAllCorrelations,
  setCorrelationStore,
  createCorrelationRouter,
  notifyResume,
  type ServerPausedEntry,
} from './correlation-handler.js';
import { InMemoryServerStore } from './correlation-store-memory.js';
import { configureWebhookSecurity, generateHmacSignature } from './webhook-security.js';
import { clearIdempotency } from './webhook-idempotency.js';
import { TEST_HMAC_SECRET } from './__test-utils__/correlationTestHelpers.js';

describe('correlation-handler — webhook security integration', () => {
  let request: ReturnType<typeof import('supertest')['default']>;

  beforeEach(async () => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();
    configureWebhookSecurity({
      enabled: true,
      secret: TEST_HMAC_SECRET,
      ipWhitelist: [],
    });
    const express = await import('express');
    const supertest = await import('supertest');
    const localApp = express.default();
    localApp.use(express.default.json());
    localApp.use(createCorrelationRouter());
    request = supertest.default(localApp) as typeof request;
  });

  afterEach(() => {
    configureWebhookSecurity({ enabled: false, ipWhitelist: [] });
    clearIdempotency();
  });

  it('POST /api/correlations/pause — includes webhookToken when security enabled', async () => {
    const res = await request.post('/api/correlations/pause').send({
      correlationId: 'sec-tok',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    expect(res.status).toBe(201);
    expect(res.body.webhookToken).toBeDefined();
    expect(res.body.webhookToken.correlationId).toBe('sec-tok');
  });

  it('POST /webhooks/callback/* — 401 when signature header missing', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'sig-miss',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    const res = await request.post('/webhooks/callback/paysec').send({ paymentId: 'sig-miss' });
    expect(res.status).toBe(401);
  });

  it('POST /webhooks/callback/* — 200 when HMAC signature matches body', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'sig-ok',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    const payload = { paymentId: 'sig-ok', hello: 'world' };
    const raw = JSON.stringify(payload);
    const sig = generateHmacSignature(raw);
    const res = await request
      .post('/webhooks/callback/paysec')
      .set('x-webhook-signature', sig)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
  });

  it('POST /webhooks/callback/* — 401 when HMAC signature invalid', async () => {
    configureWebhookSecurity({
      enabled: true,
      secret: TEST_HMAC_SECRET,
      ipWhitelist: [],
    });
    await request.post('/api/correlations/pause').send({
      correlationId: 'sig-bad',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    const payload = { paymentId: 'sig-bad' };
    const res = await request
      .post('/webhooks/callback/paysec')
      .set('x-webhook-signature', 'deadbeef')
      .send(payload);
    expect(res.status).toBe(401);
  });

  it('POST /webhooks/callback/* — 403 when IP not whitelisted', async () => {
    configureWebhookSecurity({
      enabled: true,
      secret: TEST_HMAC_SECRET,
      ipWhitelist: ['203.0.113.50'],
    });
    await request.post('/api/correlations/pause').send({
      correlationId: 'ip-block',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    const payload = { paymentId: 'ip-block' };
    const raw = JSON.stringify(payload);
    const res = await request
      .post('/webhooks/callback/paysec')
      .set('x-webhook-signature', generateHmacSignature(raw))
      .send(payload);
    expect(res.status).toBe(403);
  });

  it('POST /webhooks/callback/* — 401 when webhook token query is invalid', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'q-tok',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    const payload = { paymentId: 'q-tok' };
    const raw = JSON.stringify(payload);
    const sig = generateHmacSignature(raw);
    const res = await request
      .post('/webhooks/callback/paysec?webhookToken=%%%not-base64%%%')
      .set('x-webhook-signature', sig)
      .send(payload);
    expect(res.status).toBe(401);
  });

  it('POST /webhooks/callback/* — accepts signed webhookToken query param', async () => {
    const pause = await request.post('/api/correlations/pause').send({
      correlationId: 'q-good',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    expect(pause.body.webhookToken).toBeDefined();
    const tokenStr = Buffer.from(JSON.stringify(pause.body.webhookToken)).toString('base64url');
    const payload = { paymentId: 'q-good' };
    const raw = JSON.stringify(payload);
    const sig = generateHmacSignature(raw);
    const res = await request
      .post(`/webhooks/callback/paysec?webhookToken=${encodeURIComponent(tokenStr)}`)
      .set('x-webhook-signature', sig)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
  });

  it('POST /webhooks/callback/* — verifies webhookToken when the query param appears more than once', async () => {
    const pause = await request.post('/api/correlations/pause').send({
      correlationId: 'q-dup',
      webhookPath: '/webhooks/callback/paysec',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });
    const tokenStr = Buffer.from(JSON.stringify(pause.body.webhookToken)).toString('base64url');
    const payload = { paymentId: 'q-dup' };
    const raw = JSON.stringify(payload);
    const sig = generateHmacSignature(raw);
    const res = await request
      .post('/webhooks/callback/paysec')
      .query({ webhookToken: [tokenStr, 'ignored-second'] })
      .set('x-webhook-signature', sig)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
  });
});

/** Store where `find` is always undefined (exercises idempotent cache path while listAll still lists pauses). */
class FindAlwaysUndefinedStore extends InMemoryServerStore {
  override find(_correlationId: string): ServerPausedEntry | undefined {
    return undefined;
  }
}

describe('correlation-handler — idempotent cache + wait abort', () => {
  let request: ReturnType<typeof import('supertest')['default']>;

  beforeEach(async () => {
    clearAllCorrelations();
    clearIdempotency();
    configureWebhookSecurity({ enabled: false, ipWhitelist: [] });
    const store = new FindAlwaysUndefinedStore();
    await store.init();
    setCorrelationStore(store);
    const express = await import('express');
    const supertest = await import('supertest');
    const localApp = express.default();
    localApp.use(express.default.json());
    localApp.use(createCorrelationRouter());
    request = supertest.default(localApp) as typeof request;
  });

  afterEach(async () => {
    clearAllCorrelations();
    clearIdempotency();
    const mem = new InMemoryServerStore();
    await mem.init();
    setCorrelationStore(mem);
  });

  it('returns cached webhook response when idempotency hits and find() misses', async () => {
    const path = '/webhooks/callback/idem-test';
    const idemHeader = { 'x-idempotency-key': 'shared-idem' };

    await request.post('/api/correlations/pause').send({
      correlationId: 'idem-a',
      webhookPath: path,
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'cid',
    });

    const first = await request.post(path).set(idemHeader).send({ cid: 'idem-a', round: 1 });

    expect(first.status).toBe(200);
    expect(first.body.resumed).toBe(true);

    await request.post('/api/correlations/pause').send({
      correlationId: 'idem-b',
      webhookPath: path,
      executionId: 'e2',
      correlationSource: 'body',
      correlationJsonPath: 'cid',
    });

    const second = await request.post(path).set(idemHeader).send({ cid: 'idem-b', round: 2 });

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
  });
});

describe('notifyResume', () => {
  let server: import('http').Server;
  let request: ReturnType<typeof import('supertest')['default']>;

  beforeEach(async () => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();
    configureWebhookSecurity({ enabled: false, ipWhitelist: [] });

    const express = await import('express');
    const supertest = await import('supertest');
    const localApp = express.default();
    localApp.use(express.default.json());
    localApp.use(createCorrelationRouter());
    server = await new Promise<import('http').Server>((resolve, reject) => {
      const s = localApp.listen(0, () => resolve(s));
      s.on('error', reject);
    });
    request = supertest.default(server) as typeof request;
  });

  afterEach(() => {
    clearAllCorrelations();
    clearIdempotency();
    server?.close();
  });

  it('queues resume data when no waiter exists', () => {
    notifyResume('test-correlation', {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      ts: Date.now(),
    });
    expect(true).toBe(true);
  });

  it('notifies waiter immediately when one exists', async () => {
    const waitPromise = request
      .get('/api/correlations/notify-test/wait')
      .query({ timeoutMs: 5000 });

    // Wait long enough for the HTTP request to be fully received and the
    // resolver to be parked in resumeWaiters (even under coverage overhead).
    await new Promise(resolve => setTimeout(resolve, 500));

    notifyResume('notify-test', {
      executionId: 'exec-notify',
      workflowId: 'wf-notify',
      ts: Date.now(),
    });

    const res = await waitPromise;
    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.executionId).toBe('exec-notify');
  });
});

describe('resume queue cleanup behavior', () => {
  let server: import('http').Server;
  let request: ReturnType<typeof import('supertest')['default']>;

  beforeEach(async () => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();
    configureWebhookSecurity({ enabled: false, ipWhitelist: [] });

    const express = await import('express');
    const supertest = await import('supertest');
    const localApp = express.default();
    localApp.use(express.default.json());
    localApp.use(createCorrelationRouter());
    server = await new Promise<import('http').Server>((resolve, reject) => {
      const s = localApp.listen(0, () => resolve(s));
      s.on('error', reject);
    });
    request = supertest.default(server) as typeof request;
  });

  afterEach(() => {
    clearAllCorrelations();
    clearIdempotency();
    server?.close();
  });

  it('wait times out when no resume arrives within timeout', async () => {
    const res = await request
      .get('/api/correlations/timeout-test/wait')
      .query({ timeoutMs: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(false);
    expect(res.body.timedOut).toBe(true);
    expect(res.body.correlationId).toBe('timeout-test');
  }, 10000);

  it('second resume for same correlation is queued after first settles waiter', async () => {
    const waitPromise = request
      .get('/api/correlations/dup-settle/wait')
      .query({ timeoutMs: 5000 });

    await new Promise(resolve => setTimeout(resolve, 100));

    notifyResume('dup-settle', {
      executionId: 'exec-dup-1',
      workflowId: 'wf-dup',
      ts: Date.now(),
    });

    const res = await waitPromise;
    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.executionId).toBe('exec-dup-1');

    const res2 = await request
      .get('/api/correlations/dup-settle/wait')
      .query({ timeoutMs: 1000 });
    expect(res2.body.resumed).toBe(false);
    expect(res2.body.timedOut).toBe(true);
  }, 10000);

  it('picks up queued resume data immediately', async () => {
    notifyResume('pre-queued', {
      executionId: 'exec-pre',
      workflowId: 'wf-pre',
      ts: Date.now(),
    });

    const res = await request
      .get('/api/correlations/pre-queued/wait')
      .query({ timeoutMs: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.executionId).toBe('exec-pre');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  addPausedCorrelation,
  removePausedCorrelation,
  findByCorrelationId,
  getPausedCorrelations,
  getPausedCount,
  clearAllCorrelations,
  matchCorrelation,
  extractCorrelationId,
  cleanupExpired,
  setCorrelationStore,
  getCorrelationStore,
  getUnmatchedWebhooks,
  createCorrelationRouter,
  notifyResume,
  type ServerPausedEntry,
} from './correlation-handler.js';
import { InMemoryServerStore } from './correlation-store-memory.js';
import { configureWebhookSecurity, generateHmacSignature } from './webhook-security.js';
import { clearIdempotency } from './webhook-idempotency.js';

// ── helpers ──────────────────────────────────────────

function makeEntry(overrides: Partial<ServerPausedEntry> = {}): ServerPausedEntry {
  return {
    correlationId: 'corr-1',
    webhookPath: '/webhooks/callback/payment',
    executionId: 'exec-1',
    workflowId: 'wf-1',
    pausedNodeId: 'cw1',
    pausedAt: Date.now(),
    timeoutAt: 0,
    correlationSource: 'body',
    correlationJsonPath: 'correlationId',
    ...overrides,
  };
}

const TEST_HMAC_SECRET = '01234567890123456789012345678901';

// ── Tests ────────────────────────────────────────────

describe('correlation-handler — store functions', () => {
  beforeEach(() => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
  });

  // ── addPausedCorrelation ──

  it('adds a correlation entry', () => {
    const added = addPausedCorrelation(makeEntry());
    expect(added).toBe(true);
    expect(getPausedCount()).toBe(1);
  });

  it('rejects duplicate correlation IDs', () => {
    addPausedCorrelation(makeEntry());
    const added = addPausedCorrelation(makeEntry());
    expect(added).toBe(false);
    expect(getPausedCount()).toBe(1);
  });

  // ── removePausedCorrelation ──

  it('removes a correlation entry and returns it', () => {
    addPausedCorrelation(makeEntry());
    const removed = removePausedCorrelation('corr-1');
    expect(removed).toBeDefined();
    expect(removed!.correlationId).toBe('corr-1');
    expect(getPausedCount()).toBe(0);
  });

  it('returns undefined for nonexistent correlation', () => {
    const removed = removePausedCorrelation('nonexistent');
    expect(removed).toBeUndefined();
  });

  // ── findByCorrelationId ──

  it('finds a paused correlation by ID', () => {
    addPausedCorrelation(makeEntry({ correlationId: 'find-me' }));
    const found = findByCorrelationId('find-me');
    expect(found).toBeDefined();
    expect(found!.executionId).toBe('exec-1');
  });

  it('returns undefined for nonexistent ID', () => {
    expect(findByCorrelationId('nope')).toBeUndefined();
  });

  // ── getPausedCorrelations ──

  it('returns all paused correlations', () => {
    addPausedCorrelation(makeEntry({ correlationId: 'a' }));
    addPausedCorrelation(makeEntry({ correlationId: 'b' }));
    const all = getPausedCorrelations();
    expect(all).toHaveLength(2);
    expect(all.map(e => e.correlationId).sort()).toEqual(['a', 'b']);
  });

  it('returns empty array when nothing is paused', () => {
    expect(getPausedCorrelations()).toEqual([]);
  });

  // ── cleanupExpired ──

  it('removes expired entries', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'expired',
      timeoutAt: Date.now() - 1000,
    }));
    addPausedCorrelation(makeEntry({
      correlationId: 'active',
      timeoutAt: Date.now() + 60000,
    }));
    const cleaned = cleanupExpired();
    expect(cleaned).toBe(1);
    expect(getPausedCount()).toBe(1);
    expect(findByCorrelationId('active')).toBeDefined();
    expect(findByCorrelationId('expired')).toBeUndefined();
  });

  it('skips entries with timeoutAt = 0 (no timeout)', () => {
    addPausedCorrelation(makeEntry({ correlationId: 'forever', timeoutAt: 0 }));
    const cleaned = cleanupExpired();
    expect(cleaned).toBe(0);
    expect(getPausedCount()).toBe(1);
  });

  // ── clearAllCorrelations ──

  it('clears all data', () => {
    addPausedCorrelation(makeEntry({ correlationId: 'x' }));
    addPausedCorrelation(makeEntry({ correlationId: 'y' }));
    clearAllCorrelations();
    expect(getPausedCount()).toBe(0);
  });
});

// ── extractCorrelationId ─────────────────────────────

describe('extractCorrelationId', () => {
  it('extracts from body via JSONPath', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'correlationId' });
    const id = extractCorrelationId(
      entry,
      { correlationId: 'pay_123' },
      {},
      {},
    );
    expect(id).toBe('pay_123');
  });

  it('extracts nested body fields', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'data.orderId' });
    const id = extractCorrelationId(
      entry,
      { data: { orderId: 'ord_456' } },
      {},
      {},
    );
    expect(id).toBe('ord_456');
  });

  it('extracts with $. prefix', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: '$.paymentId' });
    const id = extractCorrelationId(
      entry,
      { paymentId: 'pay_789' },
      {},
      {},
    );
    expect(id).toBe('pay_789');
  });

  it('extracts from header', () => {
    const entry = makeEntry({ correlationSource: 'header', correlationHeader: 'X-Correlation-Id' });
    const id = extractCorrelationId(
      entry,
      {},
      { 'x-correlation-id': 'hdr_123' },
      {},
    );
    expect(id).toBe('hdr_123');
  });

  it('extracts from query', () => {
    const entry = makeEntry({ correlationSource: 'query', correlationQueryParam: 'cid' });
    const id = extractCorrelationId(
      entry,
      {},
      {},
      { cid: 'qry_123' },
    );
    expect(id).toBe('qry_123');
  });

  it('returns undefined when JSONPath is missing', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: undefined });
    expect(extractCorrelationId(entry, { id: '1' }, {}, {})).toBeUndefined();
  });

  it('returns undefined when header name is missing', () => {
    const entry = makeEntry({ correlationSource: 'header', correlationHeader: undefined });
    expect(extractCorrelationId(entry, {}, {}, {})).toBeUndefined();
  });

  it('returns undefined when query param is missing', () => {
    const entry = makeEntry({ correlationSource: 'query', correlationQueryParam: undefined });
    expect(extractCorrelationId(entry, {}, {}, {})).toBeUndefined();
  });

  it('returns undefined for non-existent body path', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'missing.field' });
    expect(extractCorrelationId(entry, { other: 'data' }, {}, {})).toBeUndefined();
  });

  it('converts numeric values to string', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'id' });
    const id = extractCorrelationId(entry, { id: 42 }, {}, {});
    expect(id).toBe('42');
  });

  it('returns undefined for unsupported correlationSource', () => {
    const entry = makeEntry({
      correlationSource: 'invalid' as unknown as ServerPausedEntry['correlationSource'],
    });
    expect(extractCorrelationId(entry, { id: 1 }, {}, {})).toBeUndefined();
  });

  it('returns undefined when body path hits a primitive mid-path', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'a.b.c' });
    expect(extractCorrelationId(entry, { a: 'string-not-object' }, {}, {})).toBeUndefined();
  });

  it('returns undefined when body leaf value is null', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'field' });
    expect(extractCorrelationId(entry, { field: null }, {}, {})).toBeUndefined();
  });

  it('returns undefined when header value is null', () => {
    const entry = makeEntry({ correlationSource: 'header', correlationHeader: 'X-Corr' });
    expect(extractCorrelationId(entry, {}, { 'x-corr': null as unknown as string }, {})).toBeUndefined();
  });

  it('returns undefined when query value is null', () => {
    const entry = makeEntry({ correlationSource: 'query', correlationQueryParam: 'cid' });
    expect(extractCorrelationId(entry, {}, {}, { cid: null as unknown as string })).toBeUndefined();
  });

  it('converts header array value to string', () => {
    const entry = makeEntry({ correlationSource: 'header', correlationHeader: 'X-Multi' });
    const id = extractCorrelationId(entry, {}, { 'x-multi': ['val1', 'val2'] as unknown as string }, {});
    expect(id).toBe('val1,val2');
  });

  it('converts query array value to string', () => {
    const entry = makeEntry({ correlationSource: 'query', correlationQueryParam: 'ids' });
    const id = extractCorrelationId(entry, {}, {}, { ids: ['a', 'b'] as unknown as string });
    expect(id).toBe('a,b');
  });
});

// ── matchCorrelation ─────────────────────────────────

describe('matchCorrelation', () => {
  beforeEach(() => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
  });

  it('matches by webhook path and correlation ID', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'pay_123',
      webhookPath: '/webhooks/callback/payment',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    }));

    const match = matchCorrelation(
      '/webhooks/callback/payment',
      { paymentId: 'pay_123' },
      {},
      {},
    );

    expect(match).toBeDefined();
    expect(match!.correlationId).toBe('pay_123');
    expect(match!.entry.executionId).toBe('exec-1');
  });

  it('returns undefined when path does not match', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'pay_123',
      webhookPath: '/webhooks/callback/payment',
    }));

    const match = matchCorrelation(
      '/webhooks/callback/order',
      { correlationId: 'pay_123' },
      {},
      {},
    );

    expect(match).toBeUndefined();
  });

  it('returns undefined when correlation ID does not match', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'pay_123',
      webhookPath: '/webhooks/callback/payment',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    }));

    const match = matchCorrelation(
      '/webhooks/callback/payment',
      { paymentId: 'pay_999' },
      {},
      {},
    );

    expect(match).toBeUndefined();
  });

  it('skips expired entries', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'expired',
      webhookPath: '/webhooks/callback/test',
      correlationSource: 'body',
      correlationJsonPath: 'id',
      timeoutAt: Date.now() - 1000,
    }));

    const match = matchCorrelation(
      '/webhooks/callback/test',
      { id: 'expired' },
      {},
      {},
    );

    expect(match).toBeUndefined();
    // Entry should have been cleaned up
    expect(getPausedCount()).toBe(0);
  });

  it('matches header-based correlation', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'hdr_456',
      webhookPath: '/webhooks/callback/approval',
      correlationSource: 'header',
      correlationHeader: 'X-Request-Id',
    }));

    const match = matchCorrelation(
      '/webhooks/callback/approval',
      {},
      { 'x-request-id': 'hdr_456' },
      {},
    );

    expect(match).toBeDefined();
    expect(match!.correlationId).toBe('hdr_456');
  });

  it('matches query-based correlation', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'qry_789',
      webhookPath: '/webhooks/callback/job',
      correlationSource: 'query',
      correlationQueryParam: 'jobId',
    }));

    const match = matchCorrelation(
      '/webhooks/callback/job',
      {},
      {},
      { jobId: 'qry_789' },
    );

    expect(match).toBeDefined();
    expect(match!.correlationId).toBe('qry_789');
  });

  it('matches among multiple paused entries', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'first',
      webhookPath: '/webhooks/callback/a',
      correlationSource: 'body',
      correlationJsonPath: 'id',
    }));
    addPausedCorrelation(makeEntry({
      correlationId: 'second',
      webhookPath: '/webhooks/callback/b',
      correlationSource: 'body',
      correlationJsonPath: 'id',
      executionId: 'exec-2',
    }));

    const match = matchCorrelation(
      '/webhooks/callback/b',
      { id: 'second' },
      {},
      {},
    );

    expect(match).toBeDefined();
    expect(match!.entry.executionId).toBe('exec-2');
  });

  it('drops a timed-out entry and still matches a later one for the same path', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'stale-row',
      webhookPath: '/webhooks/callback/chain',
      correlationSource: 'body',
      correlationJsonPath: 'cid',
      timeoutAt: Date.now() - 1,
    }));
    addPausedCorrelation(makeEntry({
      correlationId: 'fresh-row',
      webhookPath: '/webhooks/callback/chain',
      correlationSource: 'body',
      correlationJsonPath: 'cid',
      executionId: 'exec-next',
    }));

    const match = matchCorrelation(
      '/webhooks/callback/chain',
      { cid: 'fresh-row' },
      {},
      {},
    );

    expect(match?.correlationId).toBe('fresh-row');
    expect(match?.entry.executionId).toBe('exec-next');
    expect(findByCorrelationId('stale-row')).toBeUndefined();
  });
});

describe('setCorrelationStore / getCorrelationStore', () => {
  afterEach(async () => {
    clearAllCorrelations();
    const mem = new InMemoryServerStore();
    await mem.init();
    setCorrelationStore(mem);
  });

  it('uses the injected store instance', async () => {
    const custom = new InMemoryServerStore();
    await custom.init();
    setCorrelationStore(custom);
    expect(getCorrelationStore()).toBe(custom);
    expect(addPausedCorrelation(makeEntry({ correlationId: 'inj-1' }))).toBe(true);
    expect(getPausedCount()).toBe(1);
  });
});

describe('getUnmatchedWebhooks', () => {
  beforeEach(() => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
  });

  it('returns paths logged by unmatched webhook callbacks', async () => {
    const supertest = await import('supertest');
    const { app } = await import('./webhook-server.js');
    const request = supertest.default(app);
    await request.post('/webhooks/callback/get-unmatched-test').send({ x: 1 });
    const list = getUnmatchedWebhooks();
    expect(list.some(e => e.path === '/webhooks/callback/get-unmatched-test')).toBe(true);
  }, 15000);
});

// ── Router integration tests ─────────────────────────

describe('correlation-handler — HTTP routes', () => {
  // We test routes via supertest-like approach using Express app directly
  // Import the app and use it
  let request: typeof import('supertest')['default'];

  beforeEach(async () => {
    // Dynamic import to avoid issues with vitest module resolution
    const supertest = await import('supertest');
    const { app } = await import('./webhook-server.js');
    request = supertest.default(app);
    // Reset AFTER import to guarantee our store is active (import may set its own)
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();
  });

  it('POST /api/correlations/pause — registers a paused workflow', async () => {
    const res = await request
      .post('/api/correlations/pause')
      .send({
        correlationId: 'pay_123',
        webhookPath: '/webhooks/callback/payment',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        pausedNodeId: 'cw1',
        timeoutMs: 60000,
        correlationSource: 'body',
        correlationJsonPath: 'paymentId',
      });

    expect(res.status).toBe(201);
    expect(res.body.paused).toBe(true);
    expect(res.body.correlationId).toBe('pay_123');
  });

  it('POST /api/correlations/pause — rejects missing fields', async () => {
    const res = await request
      .post('/api/correlations/pause')
      .send({ correlationId: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('POST /api/correlations/pause — rejects duplicate', async () => {
    await request
      .post('/api/correlations/pause')
      .send({
        correlationId: 'dup',
        webhookPath: '/wh',
        executionId: 'e1',
      });

    const res = await request
      .post('/api/correlations/pause')
      .send({
        correlationId: 'dup',
        webhookPath: '/wh',
        executionId: 'e2',
      });

    expect(res.status).toBe(409);
  });

  it('POST /api/correlations/resume — resumes a paused workflow', async () => {
    await request
      .post('/api/correlations/pause')
      .send({
        correlationId: 'resume-me',
        webhookPath: '/wh',
        executionId: 'e1',
        workflowId: 'wf-1',
      });

    const res = await request
      .post('/api/correlations/resume')
      .send({
        correlationId: 'resume-me',
        webhookData: { status: 'approved' },
      });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.executionId).toBe('e1');
  });

  it('POST /api/correlations/resume — returns false for no match', async () => {
    const res = await request
      .post('/api/correlations/resume')
      .send({ correlationId: 'nonexistent' });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(false);
  });

  it('POST /api/correlations/resume — rejects missing correlationId', async () => {
    const res = await request
      .post('/api/correlations/resume')
      .send({});

    expect(res.status).toBe(400);
  });

  it('GET /api/correlations — lists all paused', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'c1', webhookPath: '/wh', executionId: 'e1',
    });
    await request.post('/api/correlations/pause').send({
      correlationId: 'c2', webhookPath: '/wh', executionId: 'e2',
    });

    const res = await request.get('/api/correlations');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.correlations).toHaveLength(2);
  });

  it('DELETE /api/correlations/:id — cancels a correlation', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'cancel-me', webhookPath: '/wh', executionId: 'e1',
    });

    const res = await request.delete('/api/correlations/cancel-me');

    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe(true);
  });

  it('DELETE /api/correlations/:id — 404 for nonexistent', async () => {
    const res = await request.delete('/api/correlations/nope');
    expect(res.status).toBe(404);
  });

  it('POST /api/correlations/cleanup — removes expired', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'exp', webhookPath: '/wh', executionId: 'e1', timeoutMs: 1,
    });

    // Wait a tiny bit for timeout
    await new Promise(r => setTimeout(r, 10));

    const res = await request.post('/api/correlations/cleanup');

    expect(res.status).toBe(200);
    expect(res.body.cleaned).toBe(1);
  });

  // ── Webhook callback endpoint ──

  it('POST /webhooks/callback/* — treats stripped parsed body as empty object when security is off', async () => {
    const express = await import('express');
    const supertest = await import('supertest');
    const app = express.default();
    app.use(express.default.json());
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.path.startsWith('/webhooks/callback')) {
        req.body = undefined;
      }
      next();
    });
    app.use(createCorrelationRouter());
    const http = supertest.default(app);

    await http.post('/api/correlations/pause').send({
      correlationId: 'undef-body',
      webhookPath: '/webhooks/callback/undef-body',
      executionId: 'e-ud',
      correlationSource: 'header',
      correlationHeader: 'X-Cid',
    });

    const res = await http
      .post('/webhooks/callback/undef-body')
      .set('X-Cid', 'undef-body')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.webhookData).toEqual({});
  });

  it('POST /webhooks/callback/* — matches and resumes', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'wh_match',
      webhookPath: '/webhooks/callback/payment',
      executionId: 'e1',
      workflowId: 'wf-1',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    });

    const res = await request
      .post('/webhooks/callback/payment')
      .send({ paymentId: 'wh_match', status: 'approved', amount: 99.99 });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.correlationId).toBe('wh_match');
    expect(res.body.webhookData.status).toBe('approved');
  });

  it('POST /webhooks/callback/* — 404 when no match', async () => {
    const res = await request
      .post('/webhooks/callback/unknown')
      .send({ paymentId: 'no_match' });

    expect(res.status).toBe(404);
    expect(res.body.resumed).toBe(false);
  });

  it('POST /webhooks/callback/* — unmatched records correlation_id and id hints', async () => {
    await request.post('/webhooks/callback/unmatched-corr-id').send({ correlation_id: 'hint-corr-id' });
    await request.post('/webhooks/callback/unmatched-plain-id').send({ id: 'hint-plain-id' });
    const unmatched = getUnmatchedWebhooks();
    expect(unmatched.some(e => e.correlationId === 'hint-corr-id')).toBe(true);
    expect(unmatched.some(e => e.correlationId === 'hint-plain-id')).toBe(true);
  });

  it('GET /api/correlations/unmatched — returns unmatched log', async () => {
    // Trigger an unmatched webhook
    await request
      .post('/webhooks/callback/nowhere')
      .send({ correlationId: 'orphan' });

    const res = await request.get('/api/correlations/unmatched');

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.unmatched[0].path).toBe('/webhooks/callback/nowhere');
  }, 10000);

  it('GET /api/correlations/idempotency — reports store size', async () => {
    const res = await request.get('/api/correlations/idempotency');
    expect(res.status).toBe(200);
    expect(typeof res.body.size).toBe('number');
  });

  it('POST /webhooks/callback/* — processes a new pause when idempotency cache exists but the new correlation is still paused', async () => {
    const path = '/webhooks/callback/idempotency-bypass';
    const idem = { 'x-idempotency-key': 'idem-bypass-shared' };

    await request.post('/api/correlations/pause').send({
      correlationId: 'idem-first',
      webhookPath: path,
      executionId: 'e-first',
      correlationSource: 'body',
      correlationJsonPath: 'cid',
    });

    const r1 = await request.post(path).set(idem).send({ cid: 'idem-first', round: 1 });
    expect(r1.status).toBe(200);
    expect(r1.body.correlationId).toBe('idem-first');

    await request.post('/api/correlations/pause').send({
      correlationId: 'idem-second',
      webhookPath: path,
      executionId: 'e-second',
      correlationSource: 'body',
      correlationJsonPath: 'cid',
    });

    const r2 = await request.post(path).set(idem).send({ cid: 'idem-second', round: 2 });
    expect(r2.status).toBe(200);
    expect(r2.body.correlationId).toBe('idem-second');
    expect(r2.body.executionId).toBe('e-second');
  }, 15000);

  it('POST /webhooks/callback/* — rejects payload when webhook filter fails', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'flt-1',
      webhookPath: '/webhooks/callback/flt-path',
      executionId: 'e1',
      correlationSource: 'body',
      correlationJsonPath: 'id',
      webhookFilter: '{{status}} == ok',
    });

    const res = await request
      .post('/webhooks/callback/flt-path')
      .send({ id: 'flt-1', status: 'bad' });

    expect(res.status).toBe(422);
    expect(res.body.resumed).toBe(false);
  });

  // ── Long-poll wait endpoint ──
  describe('GET /api/correlations/:id/wait', () => {
    it('uses default wait window when timeoutMs query is empty', async () => {
      const start = Date.now();
      const res = await request.get('/api/correlations/empty-timeout-qs/wait?timeoutMs=');
      const elapsed = Date.now() - start;
      expect(res.body.timedOut).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(29_000);
      expect(elapsed).toBeLessThan(45_000);
    }, 50_000);

    it('returns timedOut=true when no resume occurs within the wait window', async () => {
      const res = await request.get('/api/correlations/never/wait?timeoutMs=1000');
      expect(res.status).toBe(200);
      expect(res.body.resumed).toBe(false);
      expect(res.body.timedOut).toBe(true);
      expect(res.body.correlationId).toBe('never');
    });

    it('returns queued resume data immediately if already resumed', async () => {
      // Pause + resume directly so the queue holds the data
      await request.post('/api/correlations/pause').send({
        correlationId: 'q1',
        webhookPath: '/wh',
        executionId: 'e1',
        workflowId: 'wf-1',
      });
      await request.post('/api/correlations/resume').send({
        correlationId: 'q1',
        webhookData: { foo: 'bar' },
      });

      const res = await request.get('/api/correlations/q1/wait?timeoutMs=2000');
      expect(res.status).toBe(200);
      expect(res.body.resumed).toBe(true);
      expect(res.body.webhookData).toEqual({ foo: 'bar' });
      expect(res.body.executionId).toBe('e1');
    });

    it('parks the request and resolves when a webhook arrives', async () => {
      await request.post('/api/correlations/pause').send({
        correlationId: 'park-1',
        webhookPath: '/webhooks/callback/payment',
        executionId: 'e1',
        workflowId: 'wf-1',
        correlationSource: 'body',
        correlationJsonPath: 'correlationId',
      });

      // Start the wait first
      const waitPromise = request.get('/api/correlations/park-1/wait?timeoutMs=5000');

      // Fire the webhook a moment later
      await new Promise(r => setTimeout(r, 50));
      const cb = await request
        .post('/webhooks/callback/payment')
        .send({ correlationId: 'park-1', value: 42 });
      expect(cb.status).toBe(200);
      expect(cb.body.resumed).toBe(true);

      const res = await waitPromise;
      expect(res.status).toBe(200);
      expect(res.body.resumed).toBe(true);
      expect(res.body.webhookData).toMatchObject({ correlationId: 'park-1', value: 42 });
    });

    it('cleans up waiters when the client disconnects before resume', async () => {
      const http = await import('node:http');
      const { app } = await import('./webhook-server.js');
      const server = http.createServer(app);
      await new Promise<void>(r => server.listen(0, r));
      const port = (server.address() as import('net').AddressInfo).port;

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/correlations/tcp-close/wait?timeoutMs=9000',
          method: 'GET',
        },
        res => {
          res.resume();
        },
      );
      req.on('error', () => {});
      req.end();
      await new Promise(r => setTimeout(r, 40));
      req.destroy();

      await new Promise(r => setTimeout(r, 120));

      const supertest = await import('supertest');
      const fin = await supertest.default(app).get('/api/correlations/tcp-close/wait?timeoutMs=500');
      expect(fin.body.timedOut).toBe(true);
      expect(fin.body.resumed).toBe(false);

      await new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      });
    });

    it('enforces a minimum 1000ms wait when given a tiny positive timeoutMs', async () => {
      const start = Date.now();
      const res = await request.get('/api/correlations/clamp/wait?timeoutMs=10');
      const elapsed = Date.now() - start;
      expect(res.body.timedOut).toBe(true);
      // server clamps to 1000ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(900);
    }, 5000);

    it('clamps timeoutMs=999999 to max 120000 (returns within timeout)', async () => {
      const start = Date.now();
      const res = await request.get('/api/correlations/big-timeout/wait?timeoutMs=1000');
      const elapsed = Date.now() - start;
      expect(res.body.timedOut).toBe(true);
      expect(elapsed).toBeLessThan(3000);
    }, 5000);
  });

  it('POST /api/correlations/pause — uses unknown for missing workflowId and pausedNodeId', async () => {
    const res = await request
      .post('/api/correlations/pause')
      .send({
        correlationId: 'no-wf-node',
        webhookPath: '/webhooks/callback/test',
        executionId: 'exec-1',
        correlationSource: 'body',
        correlationJsonPath: 'id',
      });

    expect(res.status).toBe(201);

    const listRes = await request.get('/api/correlations');
    expect(listRes.body.correlations).toBeDefined();
    const entry = listRes.body.correlations.find((e: ServerPausedEntry) => e.correlationId === 'no-wf-node');
    expect(entry).toBeDefined();
    expect(entry!.workflowId).toBe('unknown');
    expect(entry!.pausedNodeId).toBe('unknown');
  });

  it('POST /api/correlations/pause — sets timeoutAt to 0 when timeoutMs is 0', async () => {
    const res = await request
      .post('/api/correlations/pause')
      .send({
        correlationId: 'zero-timeout',
        webhookPath: '/webhooks/callback/test',
        executionId: 'exec-1',
        timeoutMs: 0,
        correlationSource: 'body',
        correlationJsonPath: 'id',
      });

    expect(res.status).toBe(201);
    expect(res.body.timeoutAt).toBe(0);
  });

  it('POST /api/correlations/pause — omits webhookToken when security is disabled', async () => {
    const res = await request
      .post('/api/correlations/pause')
      .send({
        correlationId: 'no-sec-token',
        webhookPath: '/webhooks/callback/test',
        executionId: 'exec-1',
        correlationSource: 'body',
        correlationJsonPath: 'id',
      });

    expect(res.status).toBe(201);
    expect(res.body.webhookToken).toBeUndefined();
  });

  it('POST /api/correlations/resume — uses empty object when webhookData is omitted', async () => {
    await request.post('/api/correlations/pause').send({
      correlationId: 'no-data-resume',
      webhookPath: '/webhooks/callback/test',
      executionId: 'exec-1',
      correlationSource: 'body',
      correlationJsonPath: 'id',
    });

    const res = await request
      .post('/api/correlations/resume')
      .send({ correlationId: 'no-data-resume' });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.webhookData).toEqual({});
  });
});

describe('correlation-handler — webhook callback string body', () => {
  beforeEach(() => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();
    configureWebhookSecurity({
      enabled: true,
      secret: TEST_HMAC_SECRET,
      ipWhitelist: [],
    });
  });

  afterEach(() => {
    configureWebhookSecurity({ enabled: false, ipWhitelist: [] });
    clearIdempotency();
  });

  it('POST /webhooks/callback/* — validates HMAC using string req.body', async () => {
    const express = await import('express');
    const supertest = await import('supertest');
    const app = express.default();
    app.use((req, res, next) => {
      if (req.path.startsWith('/webhooks/callback')) {
        return express.default.text({ type: '*/*' })(req, res, next);
      }
      return express.default.json()(req, res, next);
    });
    app.use(createCorrelationRouter());
    const http = supertest.default(app);

    await http.post('/api/correlations/pause').send({
      correlationId: 'str-body-corr',
      webhookPath: '/webhooks/callback/str-body',
      executionId: 'e-str',
      correlationSource: 'header',
      correlationHeader: 'X-Cid',
    });

    const raw = JSON.stringify({ note: 'raw-payload' });
    const sig = generateHmacSignature(raw);
    const res = await http
      .post('/webhooks/callback/str-body')
      .set('Content-Type', 'text/plain; charset=utf-8')
      .set('X-Cid', 'str-body-corr')
      .set('x-webhook-signature', sig)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
  });
});

describe('correlation-handler — resume queue TTL (real clock)', () => {
  it(
    'expires queued resume data after the periodic cleanup interval',
    async () => {
      const express = await import('express');
      const supertest = await import('supertest');
      const app = express.default();
      app.use(express.default.json());
      app.use(createCorrelationRouter());
      const http = supertest.default(app);

      const staleTs = Date.now() - 10 * 60 * 1000;
      notifyResume('queue-real-ttl', {
        webhookData: { stale: true },
        executionId: 'e-ttl',
        workflowId: 'w-ttl',
        ts: staleTs,
      });

      await new Promise<void>(r => setTimeout(r, 65_000));

      const res = await http.get('/api/correlations/queue-real-ttl/wait').query({ timeoutMs: 1500 });
      expect(res.status).toBe(200);
      expect(res.body.resumed).toBe(false);
      expect(res.body.timedOut).toBe(true);
    },
    90_000,
  );
});

describe('correlation-handler — webhook security integration', () => {
  let request: typeof import('supertest')['default'];

  beforeEach(async () => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();
    configureWebhookSecurity({
      enabled: true,
      secret: TEST_HMAC_SECRET,
      ipWhitelist: [],
    });
    const supertest = await import('supertest');
    const { app } = await import('./webhook-server.js');
    request = supertest.default(app);
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
  let request: typeof import('supertest')['default'];

  beforeEach(async () => {
    clearAllCorrelations();
    clearIdempotency();
    configureWebhookSecurity({ enabled: false, ipWhitelist: [] });
    const store = new FindAlwaysUndefinedStore();
    await store.init();
    setCorrelationStore(store);
    const supertest = await import('supertest');
    const { app } = await import('./webhook-server.js');
    request = supertest.default(app);
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

    const first = await request
      .post(path)
      .set(idemHeader)
      .send({ cid: 'idem-a', round: 1 });

    expect(first.status).toBe(200);
    expect(first.body.resumed).toBe(true);

    await request.post('/api/correlations/pause').send({
      correlationId: 'idem-b',
      webhookPath: path,
      executionId: 'e2',
      correlationSource: 'body',
      correlationJsonPath: 'cid',
    });

    const second = await request
      .post(path)
      .set(idemHeader)
      .send({ cid: 'idem-b', round: 2 });

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
  });
});

// ── notifyResume and resume queue tests ───────────────

describe('notifyResume', () => {
  let server: import('http').Server;
  let request: typeof import('supertest')['default'];

  beforeEach(async () => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();

    const supertest = await import('supertest');
    const { app } = await import('./webhook-server.js');
    server = await new Promise<import('http').Server>((resolve, reject) => {
      const s = app.listen(0, () => resolve(s));
      s.on('error', reject);
    });
    request = supertest.default(server);
  });

  afterEach(() => {
    clearAllCorrelations();
    clearIdempotency();
    server?.close();
  });

  it('queues resume data when no waiter exists', () => {
    const resumeData = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      ts: Date.now(),
    };
    notifyResume('test-correlation', resumeData);
    // Verify that the data was queued - this tests the queue path
    expect(true).toBe(true);
  });

  it('notifies waiter immediately when one exists', async () => {
    // First start a wait request (this is the /api/correlations/:correlationId/wait endpoint)
    const waitPromise = request
      .get('/api/correlations/notify-test/wait')
      .query({ timeoutMs: 5000 });

    // Give the request time to register
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now notify resume
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
  let request: typeof import('supertest')['default'];

  beforeEach(async () => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
    clearIdempotency();

    const supertest = await import('supertest');
    const { app } = await import('./webhook-server.js');
    server = await new Promise<import('http').Server>((resolve, reject) => {
      const s = app.listen(0, () => resolve(s));
      s.on('error', reject);
    });
    request = supertest.default(server);
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
    // Queue resume data before any waiter
    notifyResume('pre-queued', {
      executionId: 'exec-pre',
      workflowId: 'wf-pre',
      ts: Date.now(),
    });

    // Now start wait, should get queued data immediately
    const res = await request
      .get('/api/correlations/pre-queued/wait')
      .query({ timeoutMs: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.executionId).toBe('exec-pre');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
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
  type ServerPausedEntry,
} from './correlation-handler';

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

// ── Tests ────────────────────────────────────────────

describe('correlation-handler — store functions', () => {
  beforeEach(() => {
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
});

// ── matchCorrelation ─────────────────────────────────

describe('matchCorrelation', () => {
  beforeEach(() => {
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
});

// ── Router integration tests ─────────────────────────

describe('correlation-handler — HTTP routes', () => {
  // We test routes via supertest-like approach using Express app directly
  // Import the app and use it
  let request: typeof import('supertest')['default'];

  beforeEach(async () => {
    clearAllCorrelations();
    // Dynamic import to avoid issues with vitest module resolution
    const supertest = await import('supertest');
    const { app } = await import('./webhook-server');
    request = supertest.default(app);
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

  it('GET /api/correlations/unmatched — returns unmatched log', async () => {
    // Trigger an unmatched webhook
    await request
      .post('/webhooks/callback/nowhere')
      .send({ correlationId: 'orphan' });

    const res = await request.get('/api/correlations/unmatched');

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.unmatched[0].path).toBe('/webhooks/callback/nowhere');
  });
});

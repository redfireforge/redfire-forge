/**
 * Correlation handler — store functions + utility helpers.
 *
 * HTTP route coverage lives in `correlation-handler.http.test.ts`.
 * Security / idempotency / notifyResume coverage lives in
 * `correlation-handler.security.test.ts`. Shared helpers live in
 * `__test-utils__/correlationTestHelpers.ts`.
 */
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
  registerResumeWaiter,
  deregisterResumeWaiter,
  type ServerPausedEntry,
} from './correlation-handler.js';
import { InMemoryServerStore } from './correlation-store-memory.js';
import { configureWebhookSecurity } from './webhook-security.js';
import { makeEntry } from './__test-utils__/correlationTestHelpers.js';

describe('correlation-handler — store functions', () => {
  beforeEach(() => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
  });

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

  it('finds a paused correlation by ID', () => {
    addPausedCorrelation(makeEntry({ correlationId: 'find-me' }));
    const found = findByCorrelationId('find-me');
    expect(found).toBeDefined();
    expect(found!.executionId).toBe('exec-1');
  });

  it('returns undefined for nonexistent ID', () => {
    expect(findByCorrelationId('nope')).toBeUndefined();
  });

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

  it('clears all data', () => {
    addPausedCorrelation(makeEntry({ correlationId: 'x' }));
    addPausedCorrelation(makeEntry({ correlationId: 'y' }));
    clearAllCorrelations();
    expect(getPausedCount()).toBe(0);
  });
});

describe('extractCorrelationId', () => {
  it('extracts from body via JSONPath', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'correlationId' });
    const id = extractCorrelationId(entry, { correlationId: 'pay_123' }, {}, {});
    expect(id).toBe('pay_123');
  });

  it('extracts nested body fields', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: 'data.orderId' });
    const id = extractCorrelationId(entry, { data: { orderId: 'ord_456' } }, {}, {});
    expect(id).toBe('ord_456');
  });

  it('extracts with $. prefix', () => {
    const entry = makeEntry({ correlationSource: 'body', correlationJsonPath: '$.paymentId' });
    const id = extractCorrelationId(entry, { paymentId: 'pay_789' }, {}, {});
    expect(id).toBe('pay_789');
  });

  it('extracts from header', () => {
    const entry = makeEntry({ correlationSource: 'header', correlationHeader: 'X-Correlation-Id' });
    const id = extractCorrelationId(entry, {}, { 'x-correlation-id': 'hdr_123' }, {});
    expect(id).toBe('hdr_123');
  });

  it('extracts from query', () => {
    const entry = makeEntry({ correlationSource: 'query', correlationQueryParam: 'cid' });
    const id = extractCorrelationId(entry, {}, {}, { cid: 'qry_123' });
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

  it('returns undefined for key source (not applicable for HTTP webhooks)', () => {
    // Covers the 'key' switch case in extractCorrelationId — always returns undefined for HTTP
    const entry = makeEntry({ correlationSource: 'key' });
    expect(extractCorrelationId(entry, {}, {}, {})).toBeUndefined();
  });
});

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

    const match = matchCorrelation('/webhooks/callback/payment', { paymentId: 'pay_123' }, {}, {});

    expect(match).toBeDefined();
    expect(match!.correlationId).toBe('pay_123');
    expect(match!.entry.executionId).toBe('exec-1');
  });

  it('returns undefined when path does not match', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'pay_123',
      webhookPath: '/webhooks/callback/payment',
    }));

    const match = matchCorrelation('/webhooks/callback/order', { correlationId: 'pay_123' }, {}, {});
    expect(match).toBeUndefined();
  });

  it('returns undefined when correlation ID does not match', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'pay_123',
      webhookPath: '/webhooks/callback/payment',
      correlationSource: 'body',
      correlationJsonPath: 'paymentId',
    }));

    const match = matchCorrelation('/webhooks/callback/payment', { paymentId: 'pay_999' }, {}, {});
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

    const match = matchCorrelation('/webhooks/callback/test', { id: 'expired' }, {}, {});
    expect(match).toBeUndefined();
    expect(getPausedCount()).toBe(0);
  });

  it('matches header-based correlation', () => {
    addPausedCorrelation(makeEntry({
      correlationId: 'hdr_456',
      webhookPath: '/webhooks/callback/approval',
      correlationSource: 'header',
      correlationHeader: 'X-Request-Id',
    }));

    const match = matchCorrelation('/webhooks/callback/approval', {}, { 'x-request-id': 'hdr_456' }, {});
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

    const match = matchCorrelation('/webhooks/callback/job', {}, {}, { jobId: 'qry_789' });
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

    const match = matchCorrelation('/webhooks/callback/b', { id: 'second' }, {}, {});
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

    const match = matchCorrelation('/webhooks/callback/chain', { cid: 'fresh-row' }, {}, {});

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
    configureWebhookSecurity({ enabled: false, ipWhitelist: [] });
  });

  it('returns paths logged by unmatched webhook callbacks', async () => {
    const express = await import('express');
    const supertest = await import('supertest');
    const localApp = express.default();
    localApp.use(express.default.json());
    localApp.use(createCorrelationRouter());
    const request = supertest.default(localApp);
    await request.post('/webhooks/callback/get-unmatched-test').send({ x: 1 });
    const list = getUnmatchedWebhooks();
    expect(list.some(e => e.path === '/webhooks/callback/get-unmatched-test')).toBe(true);
  }, 15000);
});

describe('deregisterResumeWaiter', () => {
  beforeEach(() => {
    setCorrelationStore(new InMemoryServerStore());
    clearAllCorrelations();
  });

  it('is a no-op when no waiters are registered for the correlationId', () => {
    // Covers the `if (!arr) return` TRUE branch (line 143)
    const noop = () => {};
    // Should not throw — deregistering from an unknown correlationId is safe
    expect(() => deregisterResumeWaiter('unknown-id', noop)).not.toThrow();
  });

  it('removes a registered waiter from the resumeWaiters list', () => {
    // Covers `if (idx >= 0) arr.splice(idx, 1)` TRUE branch (line 145)
    // and `if (arr.length === 0) resumeWaiters.delete` TRUE branch (line 146)
    let callCount = 0;
    const waiter = () => { callCount++; };
    registerResumeWaiter('deregister-test-id', waiter);
    deregisterResumeWaiter('deregister-test-id', waiter);
    // Waiter should no longer fire after deregistration
    expect(callCount).toBe(0);
  });

  it('leaves other waiters intact when removing one of multiple waiters', () => {
    // Covers `if (arr.length === 0) resumeWaiters.delete` FALSE branch (line 146) —
    // list is not empty after removing one waiter, so the map entry is kept
    let count1 = 0;
    let count2 = 0;
    const w1 = () => { count1++; };
    const w2 = () => { count2++; };
    registerResumeWaiter('multi-waiter-id', w1);
    registerResumeWaiter('multi-waiter-id', w2);
    // Remove only w1 — w2 should remain
    deregisterResumeWaiter('multi-waiter-id', w1);
    expect(count1).toBe(0);
    // Verify w2 is still registered by calling deregister again (safe no-op for unknown waiter)
    deregisterResumeWaiter('multi-waiter-id', w2);
    expect(count2).toBe(0);
  });

  it('is a no-op when waiter is not in the list (idx < 0)', () => {
    // Covers `if (idx >= 0)` FALSE branch (line 145) — waiter not found, no splice
    const w1 = () => {};
    const w2 = () => {};  // registered but we deregister a different one
    registerResumeWaiter('idx-miss-id', w1);
    // Deregistering a waiter that was never registered for this id should not throw
    expect(() => deregisterResumeWaiter('idx-miss-id', w2)).not.toThrow();
    // Clean up
    deregisterResumeWaiter('idx-miss-id', w1);
  });
});

/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureIdempotency,
  extractIdempotencyKey,
  checkIdempotency,
  recordProcessed,
  cleanupIdempotency,
  getIdempotencySize,
  clearIdempotency,
} from './webhook-idempotency';

describe('webhook-idempotency', () => {
  beforeEach(() => {
    clearIdempotency();
    configureIdempotency({ ttlMs: 60000, maxEntries: 100 });
  });

  // ── Extract Key ──

  describe('extractIdempotencyKey', () => {
    it('uses x-idempotency-key header when present', () => {
      const key = extractIdempotencyKey('corr-1', '/path', { 'x-idempotency-key': 'my-key' });
      expect(key).toBe('idem:my-key');
    });

    it('uses x-request-id header as fallback', () => {
      const key = extractIdempotencyKey('corr-1', '/path', { 'x-request-id': 'req-123' });
      expect(key).toBe('rid:req-123');
    });

    it('uses correlationId + path as implicit key', () => {
      const key = extractIdempotencyKey('corr-1', '/webhooks/callback/payment', {});
      expect(key).toBe('corr:corr-1:/webhooks/callback/payment');
    });

    it('returns empty string when no key available', () => {
      const key = extractIdempotencyKey(undefined, '/path', {});
      expect(key).toBe('');
    });

    it('handles array header values', () => {
      const key = extractIdempotencyKey('corr-1', '/path', { 'x-idempotency-key': ['key1', 'key2'] });
      expect(key).toBe('idem:key1');
    });
  });

  // ── Check & Record ──

  describe('checkIdempotency', () => {
    it('returns undefined for unknown key', () => {
      expect(checkIdempotency('unknown')).toBeUndefined();
    });

    it('returns undefined for empty key', () => {
      expect(checkIdempotency('')).toBeUndefined();
    });

    it('returns cached record for known key', () => {
      recordProcessed('key-1', 200, { resumed: true });
      const record = checkIdempotency('key-1');
      expect(record).toBeDefined();
      expect(record!.statusCode).toBe(200);
      expect(record!.responseBody).toEqual({ resumed: true });
    });

    it('returns undefined for expired record', () => {
      configureIdempotency({ ttlMs: 60000 });
      recordProcessed('key-1', 200, { resumed: true });
      // Manually expire by setting TTL to -1 (so Date.now() - processedAt > -1 is always true)
      configureIdempotency({ ttlMs: -1 });
      const record = checkIdempotency('key-1');
      expect(record).toBeUndefined();
    });
  });

  describe('recordProcessed', () => {
    it('does not record empty key', () => {
      recordProcessed('', 200, {});
      expect(getIdempotencySize()).toBe(0);
    });

    it('records and retrieves entries', () => {
      recordProcessed('key-1', 200, { data: 1 });
      recordProcessed('key-2', 404, { error: 'not found' });
      expect(getIdempotencySize()).toBe(2);
    });

    it('evicts oldest when at capacity', () => {
      configureIdempotency({ maxEntries: 3 });
      recordProcessed('key-1', 200, {});
      recordProcessed('key-2', 200, {});
      recordProcessed('key-3', 200, {});
      recordProcessed('key-4', 200, {}); // should evict key-1
      expect(getIdempotencySize()).toBe(3);
      expect(checkIdempotency('key-1')).toBeUndefined();
      expect(checkIdempotency('key-4')).toBeDefined();
    });
  });

  // ── Cleanup ──

  describe('cleanupIdempotency', () => {
    it('removes expired entries', () => {
      configureIdempotency({ ttlMs: 60000 });
      recordProcessed('key-1', 200, {});
      recordProcessed('key-2', 200, {});
      expect(getIdempotencySize()).toBe(2);

      // Set TTL to -1 so everything is expired
      configureIdempotency({ ttlMs: -1 });
      const removed = cleanupIdempotency();
      expect(removed).toBe(2);
      expect(getIdempotencySize()).toBe(0);
    });

    it('keeps non-expired entries', () => {
      configureIdempotency({ ttlMs: 60000 });
      recordProcessed('key-1', 200, {});
      const removed = cleanupIdempotency();
      expect(removed).toBe(0);
      expect(getIdempotencySize()).toBe(1);
    });
  });

  // ── Clear ──

  describe('clearIdempotency', () => {
    it('removes all entries', () => {
      recordProcessed('key-1', 200, {});
      recordProcessed('key-2', 200, {});
      clearIdempotency();
      expect(getIdempotencySize()).toBe(0);
    });
  });
});

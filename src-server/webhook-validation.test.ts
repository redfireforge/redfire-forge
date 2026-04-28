/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateWebhookFilter,
  validatePayloadStructure,
  preValidateWebhook,
} from './webhook-validation';

describe('webhook-validation', () => {

  // ── Webhook Filter Expression ──

  describe('evaluateWebhookFilter', () => {
    it('returns valid for empty filter', () => {
      expect(evaluateWebhookFilter('', {})).toEqual({ valid: true });
    });

    it('returns valid for whitespace-only filter', () => {
      expect(evaluateWebhookFilter('   ', {})).toEqual({ valid: true });
    });

    // ── Equality ──

    it('matches equality expression', () => {
      const result = evaluateWebhookFilter('{{type}} == payment', { type: 'payment' });
      expect(result.valid).toBe(true);
    });

    it('rejects non-matching equality', () => {
      const result = evaluateWebhookFilter('{{type}} == payment', { type: 'refund' });
      expect(result.valid).toBe(false);
    });

    it('handles quoted values', () => {
      const result = evaluateWebhookFilter('{{type}} == "payment"', { type: 'payment' });
      expect(result.valid).toBe(true);
    });

    // ── Inequality ──

    it('matches inequality expression', () => {
      const result = evaluateWebhookFilter('{{status}} != failed', { status: 'success' });
      expect(result.valid).toBe(true);
    });

    it('rejects matching inequality', () => {
      const result = evaluateWebhookFilter('{{status}} != failed', { status: 'failed' });
      expect(result.valid).toBe(false);
    });

    // ── Contains ──

    it('matches contains expression', () => {
      const result = evaluateWebhookFilter('{{message}} contains success', { message: 'Payment success confirmed' });
      expect(result.valid).toBe(true);
    });

    it('rejects non-matching contains', () => {
      const result = evaluateWebhookFilter('{{message}} contains success', { message: 'Payment failed' });
      expect(result.valid).toBe(false);
    });

    // ── Exists ──

    it('matches exists expression', () => {
      const result = evaluateWebhookFilter('{{paymentId}} exists', { paymentId: 'pay_123' });
      expect(result.valid).toBe(true);
    });

    it('rejects non-existing field', () => {
      const result = evaluateWebhookFilter('{{paymentId}} exists', { other: 'value' });
      expect(result.valid).toBe(false);
    });

    // ── Numeric Comparisons ──

    it('matches > expression', () => {
      expect(evaluateWebhookFilter('{{amount}} > 100', { amount: 150 }).valid).toBe(true);
      expect(evaluateWebhookFilter('{{amount}} > 100', { amount: 50 }).valid).toBe(false);
    });

    it('matches < expression', () => {
      expect(evaluateWebhookFilter('{{amount}} < 100', { amount: 50 }).valid).toBe(true);
      expect(evaluateWebhookFilter('{{amount}} < 100', { amount: 150 }).valid).toBe(false);
    });

    it('matches >= expression', () => {
      expect(evaluateWebhookFilter('{{amount}} >= 100', { amount: 100 }).valid).toBe(true);
      expect(evaluateWebhookFilter('{{amount}} >= 100', { amount: 99 }).valid).toBe(false);
    });

    it('matches <= expression', () => {
      expect(evaluateWebhookFilter('{{amount}} <= 100', { amount: 100 }).valid).toBe(true);
      expect(evaluateWebhookFilter('{{amount}} <= 100', { amount: 101 }).valid).toBe(false);
    });

    // ── Nested Fields ──

    it('resolves nested field paths', () => {
      const result = evaluateWebhookFilter('{{data.type}} == payment', { data: { type: 'payment' } });
      expect(result.valid).toBe(true);
    });

    it('strips webhook. prefix', () => {
      const result = evaluateWebhookFilter('{{webhook.type}} == payment', { type: 'payment' });
      expect(result.valid).toBe(true);
    });

    it('handles deeply nested paths', () => {
      const result = evaluateWebhookFilter('{{a.b.c}} == deep', { a: { b: { c: 'deep' } } });
      expect(result.valid).toBe(true);
    });

    // ── AND expressions ──

    it('evaluates AND expressions (all true)', () => {
      const result = evaluateWebhookFilter(
        '{{type}} == payment && {{status}} == success',
        { type: 'payment', status: 'success' },
      );
      expect(result.valid).toBe(true);
    });

    it('rejects AND expressions (one false)', () => {
      const result = evaluateWebhookFilter(
        '{{type}} == payment && {{status}} == success',
        { type: 'payment', status: 'failed' },
      );
      expect(result.valid).toBe(false);
    });

    // ── OR expressions ──

    it('evaluates OR expressions (one true)', () => {
      const result = evaluateWebhookFilter(
        '{{type}} == payment || {{type}} == refund',
        { type: 'refund' },
      );
      expect(result.valid).toBe(true);
    });

    it('rejects OR expressions (none true)', () => {
      const result = evaluateWebhookFilter(
        '{{type}} == payment || {{type}} == refund',
        { type: 'chargeback' },
      );
      expect(result.valid).toBe(false);
    });

    // ── Error cases ──

    it('rejects expression without field reference', () => {
      const result = evaluateWebhookFilter('invalid expression', {});
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('no field reference');
    });

    it('returns not found for missing field', () => {
      const result = evaluateWebhookFilter('{{missing}} == value', {});
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  // ── Payload Structure Validation ──

  describe('validatePayloadStructure', () => {
    it('validates required fields present', () => {
      const result = validatePayloadStructure(
        { name: 'John', age: 30 },
        [{ path: 'name' }, { path: 'age' }],
      );
      expect(result.valid).toBe(true);
    });

    it('rejects missing required field', () => {
      const result = validatePayloadStructure(
        { name: 'John' },
        [{ path: 'name' }, { path: 'age' }],
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('age');
    });

    it('allows missing optional field', () => {
      const result = validatePayloadStructure(
        { name: 'John' },
        [{ path: 'name' }, { path: 'age', required: false }],
      );
      expect(result.valid).toBe(true);
    });

    it('validates field types', () => {
      const result = validatePayloadStructure(
        { name: 'John', age: '30' },
        [{ path: 'name', type: 'string' }, { path: 'age', type: 'number' }],
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expected type "number"');
    });

    it('validates array type', () => {
      const result = validatePayloadStructure(
        { items: [1, 2, 3] },
        [{ path: 'items', type: 'array' }],
      );
      expect(result.valid).toBe(true);
    });

    it('validates nested field paths', () => {
      const result = validatePayloadStructure(
        { data: { id: 123 } },
        [{ path: 'data.id', type: 'number' }],
      );
      expect(result.valid).toBe(true);
    });
  });

  // ── Pre-Validation ──

  describe('preValidateWebhook', () => {
    it('rejects undefined correlationId', () => {
      const result = preValidateWebhook({ data: 1 }, undefined, undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('correlation ID');
    });

    it('passes with valid correlationId and no filter', () => {
      const result = preValidateWebhook({ data: 1 }, undefined, 'corr-123');
      expect(result.valid).toBe(true);
    });

    it('evaluates filter and passes', () => {
      const result = preValidateWebhook(
        { type: 'payment' },
        '{{type}} == payment',
        'corr-123',
      );
      expect(result.valid).toBe(true);
    });

    it('evaluates filter and rejects', () => {
      const result = preValidateWebhook(
        { type: 'refund' },
        '{{type}} == payment',
        'corr-123',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('filter rejected');
    });
  });
});

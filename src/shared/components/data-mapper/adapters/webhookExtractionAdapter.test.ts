import { describe, it, expect } from 'vitest';
import {
  createWebhookExtractionAdapter,
  type WebhookExtractionOutput,
} from './webhookExtractionAdapter';
import type { Mapping } from '../types';

// ─── Fixtures ──────────────────────────────────────────────

const samplePayload = {
  event: 'payment.completed',
  data: {
    transactionId: 'tx-123',
    amount: 99.95,
    currency: 'USD',
    customer: { id: 'cust-1', email: 'test@example.com' },
  },
};

function makeMappings(overrides?: Partial<Mapping>[]): Mapping[] {
  const defaults: Mapping[] = [
    { id: 'wh-0', sourceId: 'webhook-payload', sourcePath: '$.data.transactionId', targetPath: 'txnId' },
    { id: 'wh-1', sourceId: 'webhook-payload', sourcePath: '$.data.amount', targetPath: 'amount' },
  ];
  if (!overrides) return defaults;
  return overrides.map((o, i) => ({ ...defaults[i % defaults.length], ...o, id: o.id ?? `m${i}` }));
}

// ─── Tests ─────────────────────────────────────────────────

describe('webhookExtractionAdapter', () => {
  describe('creation', () => {
    it('has correct contextId', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.contextId).toBe('webhook-extraction');
    });

    it('has correct category', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.category).toBe('webhook');
    });

    it('has default title and source label', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.title).toBe('Webhook Payload → Variables');
      expect(adapter.sources[0].label).toBe('Webhook Payload');
    });

    it('allows custom title and source label', () => {
      const adapter = createWebhookExtractionAdapter({
        sourceLabel: 'Correlation Payload',
        title: 'Correlation Payload → Variables',
      });
      expect(adapter.title).toBe('Correlation Payload → Variables');
      expect(adapter.sources[0].label).toBe('Correlation Payload');
    });

    it('uses custom sourceLabel in default title when no explicit title', () => {
      const adapter = createWebhookExtractionAdapter({
        sourceLabel: 'Callback Body',
      });
      expect(adapter.title).toBe('Callback Body → Variables');
    });

    it('has single source with id webhook-payload', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      expect(adapter.sources).toHaveLength(1);
      expect(adapter.sources[0].id).toBe('webhook-payload');
      expect(adapter.sources[0].format).toBe('json');
    });

    it('parses object samplePayload as source sampleData', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      expect(adapter.sources[0].sampleData).toEqual(samplePayload);
    });

    it('parses string samplePayload as source sampleData', () => {
      const adapter = createWebhookExtractionAdapter({
        samplePayload: JSON.stringify(samplePayload),
      });
      expect(adapter.sources[0].sampleData).toEqual(samplePayload);
    });

    it('handles invalid JSON string gracefully', () => {
      const adapter = createWebhookExtractionAdapter({
        samplePayload: 'not-json' as unknown as string,
      });
      expect(adapter.sources[0].sampleData).toBeUndefined();
    });

    it('handles undefined samplePayload', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.sources[0].sampleData).toBeUndefined();
    });

    it('has target with allowCustomFields', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.target.allowCustomFields).toBe(true);
      expect(adapter.target.label).toBe('Extracted Variables');
    });

    it('does not support live fetch', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.sources[0].supportsLiveFetch).toBeFalsy();
      expect(adapter.fetchSampleData).toBeUndefined();
    });
  });

  describe('serialize', () => {
    it('converts mappings to extractVariables shape', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const result = adapter.serialize(makeMappings());
      expect(result).toEqual([
        { name: 'txnId', jsonPath: '$.data.transactionId' },
        { name: 'amount', jsonPath: '$.data.amount' },
      ]);
    });

    it('adds $. prefix to paths without it', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: 'data.currency', targetPath: 'cur' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].jsonPath).toBe('$.data.currency');
    });

    it('preserves $[...] bracket paths without double-prefixing', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '$[0].field', targetPath: 'first' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].jsonPath).toBe('$[0].field');
    });

    it('normalizes empty path to $', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '', targetPath: 'root' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].jsonPath).toBe('$');
    });

    it('preserves bare $ path', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '$', targetPath: 'whole' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].jsonPath).toBe('$');
    });

    it('does not double-prefix paths starting with $.', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '$.data.currency', targetPath: 'cur' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].jsonPath).toBe('$.data.currency');
    });

    it('uses expression over sourcePath when available', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: 'data.amount', targetPath: 'amt', expression: '$.data.amount' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].jsonPath).toBe('$.data.amount');
    });

    it('returns empty array for empty mappings', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      expect(adapter.serialize([])).toEqual([]);
    });
  });

  describe('deserialize', () => {
    it('converts extractVariables to mappings', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const input: WebhookExtractionOutput = [
        { name: 'txnId', jsonPath: '$.data.transactionId' },
        { name: 'amount', jsonPath: '$.data.amount' },
      ];
      const result = adapter.deserialize(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'wh-0',
        sourceId: 'webhook-payload',
        sourcePath: '$.data.transactionId',
        targetPath: 'txnId',
      });
      expect(result[1]).toMatchObject({
        id: 'wh-1',
        sourceId: 'webhook-payload',
        sourcePath: '$.data.amount',
        targetPath: 'amount',
      });
    });

    it('returns empty array for null input', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.deserialize(null as unknown as WebhookExtractionOutput)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.deserialize(undefined as unknown as WebhookExtractionOutput)).toEqual([]);
    });

    it('returns empty array for empty array input', () => {
      const adapter = createWebhookExtractionAdapter();
      expect(adapter.deserialize([])).toEqual([]);
    });

    it('normalizes bare field paths in deserialize for consistency', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const input: WebhookExtractionOutput = [
        { name: 'txnId', jsonPath: 'data.transactionId' },
      ];
      const result = adapter.deserialize(input);
      expect(result[0].sourcePath).toBe('$.data.transactionId');
    });

    it('generates stable sequential ids', () => {
      const adapter = createWebhookExtractionAdapter();
      const input: WebhookExtractionOutput = [
        { name: 'a', jsonPath: '$.x' },
        { name: 'b', jsonPath: '$.y' },
        { name: 'c', jsonPath: '$.z' },
      ];
      const result = adapter.deserialize(input);
      expect(result.map((m) => m.id)).toEqual(['wh-0', 'wh-1', 'wh-2']);
    });
  });

  describe('round-trip', () => {
    it('serialize → deserialize preserves mapping structure', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings = makeMappings();
      const serialized = adapter.serialize(mappings);
      const restored = adapter.deserialize(serialized);

      expect(restored).toHaveLength(mappings.length);
      for (let i = 0; i < mappings.length; i++) {
        expect(restored[i].sourcePath).toBe(mappings[i].sourcePath);
        expect(restored[i].targetPath).toBe(mappings[i].targetPath);
        expect(restored[i].sourceId).toBe('webhook-payload');
      }
    });

    it('deserialize → serialize preserves extractVariables shape', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const input: WebhookExtractionOutput = [
        { name: 'eventType', jsonPath: '$.event' },
        { name: 'custEmail', jsonPath: '$.data.customer.email' },
      ];
      const restored = adapter.deserialize(input);
      const serialized = adapter.serialize(restored);

      expect(serialized).toEqual(input);
    });

    it('normalizes paths without $. on round-trip', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: 'data.transactionId', targetPath: 'txnId' },
      ];
      const serialized = adapter.serialize(mappings);
      expect(serialized[0].jsonPath).toBe('$.data.transactionId');
      const restored = adapter.deserialize(serialized);
      expect(restored[0].sourcePath).toBe('$.data.transactionId');
    });
  });

  describe('validate', () => {
    it('returns no issues for valid mappings', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const issues = adapter.validate!(makeMappings());
      expect(issues).toHaveLength(0);
    });

    it('reports error for empty variable name', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings = makeMappings([
        { id: 'm1', targetPath: '', sourcePath: '$.data.id' },
      ]);
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toContain('Variable name is required');
    });

    it('reports error for whitespace-only variable name', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings = makeMappings([
        { id: 'm1', targetPath: '   ', sourcePath: '$.data.id' },
      ]);
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.message.includes('Variable name is required'))).toBe(true);
    });

    it('reports error for empty JSON path', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings = makeMappings([
        { id: 'm1', targetPath: 'txnId', sourcePath: '' },
      ]);
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toContain('JSON path is empty');
    });

    it('reports error for duplicate variable names', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '$.data.id', targetPath: 'dup' },
        { id: 'm2', sourceId: 'webhook-payload', sourcePath: '$.data.name', targetPath: 'dup' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'error' && i.message.includes('Duplicate'))).toBe(true);
    });

    it('warns about braces in variable names', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings = makeMappings([
        { id: 'm1', targetPath: '{{txnId}}', sourcePath: '$.data.id' },
      ]);
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'warning' && i.message.includes('braces'))).toBe(true);
    });

    it('returns no issues for empty mappings', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      expect(adapter.validate!([])).toHaveLength(0);
    });

    it('checks expression when set instead of sourcePath for empty check', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '', targetPath: 'txnId', expression: '$.data.id' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(0);
    });
  });

  describe('normalizePath edge cases (serialize)', () => {
    it('strips leading dots before prefixing', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const result = adapter.serialize([
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '.foo', targetPath: 'myVar' },
      ]);
      expect(result[0].jsonPath).toBe('$.foo');
    });

    it('handles bracket-only paths like [0].name', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const result = adapter.serialize([
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '[0].name', targetPath: 'myVar' },
      ]);
      expect(result[0].jsonPath).toBe('$[0].name');
    });

    it('preserves already-normalized $. paths', () => {
      const adapter = createWebhookExtractionAdapter({ samplePayload });
      const result = adapter.serialize([
        { id: 'm1', sourceId: 'webhook-payload', sourcePath: '$.data.id', targetPath: 'myVar' },
      ]);
      expect(result[0].jsonPath).toBe('$.data.id');
    });
  });
});

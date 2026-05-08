/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadWebhookScenarios,
  saveWebhookScenario,
  updateWebhookScenario,
  deleteWebhookScenario,
  clearWebhookScenarios,
  exportWebhookScenarios,
  importWebhookScenarios,
  fireWebhook,
  buildPayloadWithCorrelationId,
} from './webhookScenarioStorage';
import type { WebhookScenario } from '../components/MultiWebhookTestingPanel';

describe('webhookScenarioStorage', () => {
  const workflowId = 'test-workflow-123';
  const storageKey = `webhook_scenarios_${workflowId}`;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('loadWebhookScenarios', () => {
    it('returns empty array when no scenarios stored', () => {
      const result = loadWebhookScenarios(workflowId);
      expect(result).toEqual([]);
    });

    it('returns stored scenarios', () => {
      const scenarios: WebhookScenario[] = [
        { id: '1', name: 'Scenario 1', payloads: [], createdAt: 1000 },
        { id: '2', name: 'Scenario 2', payloads: [], createdAt: 2000 },
      ];
      localStorage.setItem(storageKey, JSON.stringify(scenarios));

      const result = loadWebhookScenarios(workflowId);
      expect(result).toEqual(scenarios);
    });

    it('returns empty array on parse error', () => {
      localStorage.setItem(storageKey, 'invalid json');
      const result = loadWebhookScenarios(workflowId);
      expect(result).toEqual([]);
    });

    it('returns empty array if stored value is not an array', () => {
      localStorage.setItem(storageKey, JSON.stringify({ not: 'array' }));
      const result = loadWebhookScenarios(workflowId);
      expect(result).toEqual([]);
    });
  });

  describe('saveWebhookScenario', () => {
    it('saves a new scenario and returns it with generated id and timestamp', () => {
      const scenario = {
        name: 'Test Scenario',
        payloads: [{ nodeId: 'node-1', payload: { status: 'completed' } }],
      };

      const result = saveWebhookScenario(workflowId, scenario);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Scenario');
      expect(result.payloads).toEqual(scenario.payloads);
      expect(result.createdAt).toBeGreaterThan(0);

      const stored = loadWebhookScenarios(workflowId);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(result);
    });

    it('appends to existing scenarios', () => {
      saveWebhookScenario(workflowId, { name: 'First', payloads: [] });
      saveWebhookScenario(workflowId, { name: 'Second', payloads: [] });

      const stored = loadWebhookScenarios(workflowId);
      expect(stored).toHaveLength(2);
      expect(stored[0].name).toBe('First');
      expect(stored[1].name).toBe('Second');
    });

    it('includes description if provided', () => {
      const result = saveWebhookScenario(workflowId, {
        name: 'With Desc',
        description: 'A helpful description',
        payloads: [],
      });

      expect(result.description).toBe('A helpful description');
    });
  });

  describe('updateWebhookScenario', () => {
    it('updates an existing scenario', () => {
      const saved = saveWebhookScenario(workflowId, { name: 'Original', payloads: [] });

      const updated = updateWebhookScenario(workflowId, saved.id, { name: 'Updated' });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated');
      expect(updated!.id).toBe(saved.id);

      const stored = loadWebhookScenarios(workflowId);
      expect(stored[0].name).toBe('Updated');
    });

    it('returns null if scenario not found', () => {
      const result = updateWebhookScenario(workflowId, 'nonexistent', { name: 'Updated' });
      expect(result).toBeNull();
    });

    it('preserves unchanged fields', () => {
      const saved = saveWebhookScenario(workflowId, {
        name: 'Original',
        description: 'Original desc',
        payloads: [{ nodeId: 'n1', payload: {} }],
      });

      const updated = updateWebhookScenario(workflowId, saved.id, { name: 'New Name' });

      expect(updated!.description).toBe('Original desc');
      expect(updated!.payloads).toEqual(saved.payloads);
    });
  });

  describe('deleteWebhookScenario', () => {
    it('deletes an existing scenario', () => {
      const saved = saveWebhookScenario(workflowId, { name: 'To Delete', payloads: [] });

      const result = deleteWebhookScenario(workflowId, saved.id);

      expect(result).toBe(true);
      expect(loadWebhookScenarios(workflowId)).toHaveLength(0);
    });

    it('returns false if scenario not found', () => {
      saveWebhookScenario(workflowId, { name: 'Keep', payloads: [] });

      const result = deleteWebhookScenario(workflowId, 'nonexistent');

      expect(result).toBe(false);
      expect(loadWebhookScenarios(workflowId)).toHaveLength(1);
    });

    it('preserves other scenarios', () => {
      const first = saveWebhookScenario(workflowId, { name: 'First', payloads: [] });
      saveWebhookScenario(workflowId, { name: 'Second', payloads: [] });
      saveWebhookScenario(workflowId, { name: 'Third', payloads: [] });

      deleteWebhookScenario(workflowId, first.id);

      const stored = loadWebhookScenarios(workflowId);
      expect(stored).toHaveLength(2);
      expect(stored.map(s => s.name)).toEqual(['Second', 'Third']);
    });
  });

  describe('clearWebhookScenarios', () => {
    it('removes all scenarios for a workflow', () => {
      saveWebhookScenario(workflowId, { name: 'First', payloads: [] });
      saveWebhookScenario(workflowId, { name: 'Second', payloads: [] });

      clearWebhookScenarios(workflowId);

      expect(loadWebhookScenarios(workflowId)).toHaveLength(0);
    });

    it('does not affect other workflows', () => {
      const otherWorkflowId = 'other-workflow';
      saveWebhookScenario(workflowId, { name: 'This', payloads: [] });
      saveWebhookScenario(otherWorkflowId, { name: 'Other', payloads: [] });

      clearWebhookScenarios(workflowId);

      expect(loadWebhookScenarios(workflowId)).toHaveLength(0);
      expect(loadWebhookScenarios(otherWorkflowId)).toHaveLength(1);
    });
  });

  describe('exportWebhookScenarios', () => {
    it('exports scenarios as JSON string', () => {
      saveWebhookScenario(workflowId, { name: 'Export Me', payloads: [] });

      const exported = exportWebhookScenarios(workflowId);
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].name).toBe('Export Me');
    });

    it('exports empty array when no scenarios', () => {
      const exported = exportWebhookScenarios(workflowId);
      expect(exported).toBe('[]');
    });
  });

  describe('importWebhookScenarios', () => {
    it('imports scenarios from JSON', () => {
      const toImport: WebhookScenario[] = [
        { id: 'import-1', name: 'Imported', payloads: [], createdAt: 1000 },
      ];

      const result = importWebhookScenarios(workflowId, JSON.stringify(toImport));

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Imported');
    });

    it('merges with existing scenarios', () => {
      saveWebhookScenario(workflowId, { name: 'Existing', payloads: [] });

      const toImport: WebhookScenario[] = [
        { id: 'import-1', name: 'New', payloads: [], createdAt: 1000 },
      ];

      const result = importWebhookScenarios(workflowId, JSON.stringify(toImport));

      expect(result).toHaveLength(2);
    });

    it('skips duplicates by id', () => {
      const saved = saveWebhookScenario(workflowId, { name: 'Existing', payloads: [] });

      const toImport: WebhookScenario[] = [
        { id: saved.id, name: 'Duplicate', payloads: [], createdAt: 1000 },
      ];

      const result = importWebhookScenarios(workflowId, JSON.stringify(toImport));

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Existing');
    });

    it('throws on invalid JSON', () => {
      expect(() => importWebhookScenarios(workflowId, 'not json')).toThrow();
    });

    it('throws on non-array JSON', () => {
      expect(() => importWebhookScenarios(workflowId, '{"not": "array"}')).toThrow();
    });

    it('generates id and timestamp for incomplete scenarios', () => {
      const toImport = [{ name: 'Incomplete' }];

      const result = importWebhookScenarios(workflowId, JSON.stringify(toImport));

      expect(result[0].id).toBeDefined();
      expect(result[0].createdAt).toBeGreaterThan(0);
      expect(result[0].payloads).toEqual([]);
    });
  });

  describe('buildPayloadWithCorrelationId', () => {
    it('replaces {{correlationId}} placeholder', () => {
      const template = {
        transactionId: '{{correlationId}}',
        status: 'completed',
      };

      const result = buildPayloadWithCorrelationId(template, 'corr-123');

      expect(result.transactionId).toBe('corr-123');
      expect(result.status).toBe('completed');
    });

    it('replaces multiple occurrences', () => {
      const template = {
        id: '{{correlationId}}',
        ref: '{{correlationId}}',
      };

      const result = buildPayloadWithCorrelationId(template, 'xyz');

      expect(result.id).toBe('xyz');
      expect(result.ref).toBe('xyz');
    });

    it('handles nested objects', () => {
      const template = {
        outer: {
          inner: {
            id: '{{correlationId}}',
          },
        },
      };

      const result = buildPayloadWithCorrelationId(template, 'nested-123');

      expect((result.outer as { inner: { id: string } }).inner.id).toBe('nested-123');
    });

    it('preserves payload without placeholders', () => {
      const template = {
        status: 'completed',
        amount: 100,
      };

      const result = buildPayloadWithCorrelationId(template, 'unused');

      expect(result).toEqual(template);
    });
  });

  describe('fireWebhook', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('sends POST request to correlations resume endpoint', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

      await fireWebhook('corr-123', { status: 'completed' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/correlations/resume'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('corr-123'),
        })
      );
    });

    it('includes webhook path in request body', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

      await fireWebhook('corr-123', { status: 'completed' }, '/webhooks/callback/payment');

      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.webhookPath).toBe('/webhooks/callback/payment');
    });

    it('throws on non-ok response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(fireWebhook('bad', {})).rejects.toThrow('Failed to fire webhook');
    });
  });
});

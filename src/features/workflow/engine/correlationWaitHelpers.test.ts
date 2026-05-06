import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  injectWebhookPayload,
  createAbortPromise,
  calculateSyntheticDelay,
  waitWithAbort,
  getMockPayload,
} from './correlationWaitHelpers';
import { VariableContext } from './variableContext';
import type { CorrelationWaitNodeData } from '../types/workflow';

describe('correlationWaitHelpers', () => {
  describe('injectWebhookPayload', () => {
    it('sets webhook.body and webhook.correlationId in context', () => {
      const ctx = new VariableContext({});
      const log = vi.fn();
      const data = { extractVariables: [] } as Partial<CorrelationWaitNodeData> as CorrelationWaitNodeData;

      injectWebhookPayload({ status: 'ok' }, 'corr-123', data, ctx, log, 'TestNode');

      expect(ctx.resolve('{{webhook.body}}')).toBe('{"status":"ok"}');
      expect(ctx.resolve('{{webhook.correlationId}}')).toBe('corr-123');
    });

    it('extracts variables from payload', () => {
      const ctx = new VariableContext({});
      const log = vi.fn();
      const data = {
        extractVariables: [
          { name: 'myStatus', jsonPath: '$.status' },
          { name: 'myCode', jsonPath: '$.code' },
        ],
      } as Partial<CorrelationWaitNodeData> as CorrelationWaitNodeData;

      injectWebhookPayload({ status: 'completed', code: 42 }, 'corr-456', data, ctx, log, 'TestNode');

      expect(ctx.resolve('{{myStatus}}')).toBe('completed');
      expect(ctx.resolve('{{myCode}}')).toBe('42');
      expect(log).toHaveBeenCalledTimes(2);
    });

    it('truncates long values in log output', () => {
      const ctx = new VariableContext({});
      const log = vi.fn();
      const longValue = 'a'.repeat(100);
      const data = {
        extractVariables: [{ name: 'longField', jsonPath: '$.data' }],
      } as Partial<CorrelationWaitNodeData> as CorrelationWaitNodeData;

      injectWebhookPayload({ data: longValue }, 'corr-789', data, ctx, log, 'TestNode');

      expect(log).toHaveBeenCalledWith({
        prefix: '#',
        text: expect.stringContaining('…'),
      });
    });
  });

  describe('createAbortPromise', () => {
    it('returns null when no abort signal provided', () => {
      const result = createAbortPromise(undefined);
      expect(result).toBeNull();
    });

    it('returns a promise that rejects on abort', async () => {
      const controller = new AbortController();
      const promise = createAbortPromise(controller.signal);

      expect(promise).not.toBeNull();

      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow('Workflow run aborted');
    });

    it('rejects immediately if already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = createAbortPromise(controller.signal);

      await expect(promise).rejects.toThrow('Workflow run aborted');
    });
  });

  describe('calculateSyntheticDelay', () => {
    it('returns base delay when no jitter', () => {
      expect(calculateSyntheticDelay(1000, 0)).toBe(1000);
      expect(calculateSyntheticDelay(500)).toBe(500);
    });

    it('applies jitter within range', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Middle of range
      expect(calculateSyntheticDelay(1000, 100)).toBe(1000); // 0.5 * 200 - 100 = 0

      vi.spyOn(Math, 'random').mockReturnValue(0); // Low end
      expect(calculateSyntheticDelay(1000, 100)).toBe(900); // 0 * 200 - 100 = -100

      vi.spyOn(Math, 'random').mockReturnValue(1); // High end
      expect(calculateSyntheticDelay(1000, 100)).toBe(1100); // 1 * 200 - 100 = +100

      vi.restoreAllMocks();
    });

    it('never returns negative delay', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(calculateSyntheticDelay(50, 100)).toBe(0); // Would be -50, clamped to 0
      vi.restoreAllMocks();
    });
  });

  describe('waitWithAbort', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('resolves true after delay completes', async () => {
      const promise = waitWithAbort(100);
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;
      expect(result).toBe(true);
    });

    it('resolves false when aborted', async () => {
      const controller = new AbortController();
      const promise = waitWithAbort(1000, controller.signal);

      await vi.advanceTimersByTimeAsync(50);
      controller.abort();
      await vi.advanceTimersByTimeAsync(10);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('resolves false immediately if already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = waitWithAbort(1000, controller.signal);
      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('getMockPayload', () => {
    it('returns runner-level payload when available', () => {
      const result = getMockPayload(
        'node-1',
        { 'node-1': { status: 'runner' } },
        { status: 'node' },
      );
      expect(result).toEqual({ status: 'runner' });
    });

    it('falls back to node-level payload', () => {
      const result = getMockPayload(
        'node-1',
        { 'other-node': { status: 'other' } },
        { status: 'node' },
      );
      expect(result).toEqual({ status: 'node' });
    });

    it('returns empty object when nothing configured', () => {
      const result = getMockPayload('node-1', undefined, undefined);
      expect(result).toEqual({});
    });

    it('returns empty object for unknown node', () => {
      const result = getMockPayload(
        'unknown',
        { 'node-1': { status: 'runner' } },
        undefined,
      );
      expect(result).toEqual({});
    });
  });
});

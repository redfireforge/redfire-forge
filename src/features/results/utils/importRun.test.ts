import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateImportedRun } from './importRun';

// Mock crypto.randomUUID for deterministic tests
beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`);
});

/** Minimal valid TestRun-shaped object matching CLI buildJsonReport() output */
function makeValidRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'original-id',
    timestamp: 1716700000000,
    config: {
      concurrency: 5,
      iterations: 10,
      scenarioWeights: [{ scenarioName: 'GET /api', weight: 1 }],
      executionMode: 'batch',
    },
    summary: {
      totalRequests: 50,
      totalDurationMs: 1234.5,
      avgResponseTime: 45.2,
      minResponseTime: 10,
      maxResponseTime: 200,
      p50: 40,
      p90: 80,
      p95: 100,
      p99: 180,
      failedRequests: 0,
      failedValidations: 0,
      errorRate: 0,
      rps: 40.5,
    },
    results: [
      {
        scenarioName: 'GET /api',
        url: 'http://localhost/api',
        method: 'GET',
        status: 200,
        responseTimeMs: 45,
        timestamp: 1716700001000,
        passed: true,
      },
    ],
    ...overrides,
  };
}

describe('validateImportedRun', () => {
  describe('valid inputs', () => {
    it('accepts a valid TestRun and assigns a fresh id', () => {
      const result = validateImportedRun(makeValidRun());
      expect(result.valid).toBe(true);
      if (!result.valid) throw new Error('expected valid');
      expect(result.run.id).toBe('test-uuid-1234');
      expect(result.run.timestamp).toBe(1716700000000);
      expect(result.run.config.concurrency).toBe(5);
      expect(result.run.summary.totalRequests).toBe(50);
      expect(result.run.results).toHaveLength(1);
    });

    it('accepts a run without an id field', () => {
      const { id: _, ...noId } = makeValidRun();
      const result = validateImportedRun(noId);
      expect(result.valid).toBe(true);
      if (!result.valid) throw new Error('expected valid');
      expect(result.run.id).toBe('test-uuid-1234');
    });

    it('defaults timestamp to Date.now() when missing', () => {
      const now = Date.now();
      const { timestamp: _, ...noTs } = makeValidRun();
      const result = validateImportedRun(noTs);
      expect(result.valid).toBe(true);
      if (!result.valid) throw new Error('expected valid');
      expect(result.run.timestamp).toBeGreaterThanOrEqual(now);
    });

    it('defaults timestamp when timestamp is not a number', () => {
      const now = Date.now();
      const result = validateImportedRun(makeValidRun({ timestamp: 'not-a-number' }));
      expect(result.valid).toBe(true);
      if (!result.valid) throw new Error('expected valid');
      expect(result.run.timestamp).toBeGreaterThanOrEqual(now);
    });

    it('preserves optional fields (projectName, envName, slaTargets)', () => {
      const run = makeValidRun({
        projectName: 'My API Test',
        envName: 'staging',
        config: {
          ...makeValidRun().config,
          slaTargets: [{ id: 'sla-1', metric: 'p95', operator: 'lte', value: 200 }],
        },
      });
      const result = validateImportedRun(run);
      expect(result.valid).toBe(true);
      if (!result.valid) throw new Error('expected valid');
      expect(result.run.projectName).toBe('My API Test');
      expect(result.run.envName).toBe('staging');
      expect(result.run.config.slaTargets).toHaveLength(1);
    });

    it('accepts all valid execution modes', () => {
      for (const mode of ['sequential', 'batch', 'pool', 'load-profile', 'workflow']) {
        const result = validateImportedRun(makeValidRun({
          config: { ...makeValidRun().config, executionMode: mode },
        }));
        expect(result.valid).toBe(true);
      }
    });

    it('accepts an empty results array', () => {
      const result = validateImportedRun(makeValidRun({ results: [] }));
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects null', () => {
      const result = validateImportedRun(null);
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('JSON object');
    });

    it('rejects undefined', () => {
      const result = validateImportedRun(undefined);
      expect(result.valid).toBe(false);
    });

    it('rejects a string', () => {
      const result = validateImportedRun('hello');
      expect(result.valid).toBe(false);
    });

    it('rejects an array', () => {
      const result = validateImportedRun([1, 2, 3]);
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('config');
    });

    it('rejects missing config', () => {
      const { config: _, ...noConfig } = makeValidRun();
      const result = validateImportedRun(noConfig);
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('config');
    });

    it('rejects config.concurrency not a number', () => {
      const result = validateImportedRun(makeValidRun({
        config: { ...makeValidRun().config, concurrency: 'five' },
      }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('concurrency');
    });

    it('rejects config.iterations not a number', () => {
      const result = validateImportedRun(makeValidRun({
        config: { ...makeValidRun().config, iterations: null },
      }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('iterations');
    });

    it('rejects config.scenarioWeights not an array', () => {
      const result = validateImportedRun(makeValidRun({
        config: { ...makeValidRun().config, scenarioWeights: 'not-array' },
      }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('scenarioWeights');
    });

    it('rejects invalid executionMode', () => {
      const result = validateImportedRun(makeValidRun({
        config: { ...makeValidRun().config, executionMode: 'invalid-mode' },
      }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('executionMode');
    });

    it('rejects missing summary', () => {
      const { summary: _, ...noSummary } = makeValidRun();
      const result = validateImportedRun(noSummary);
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('summary');
    });

    it('rejects summary.totalRequests not a number', () => {
      const result = validateImportedRun(makeValidRun({
        summary: { ...makeValidRun().summary, totalRequests: 'many' },
      }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('totalRequests');
    });

    it('rejects summary.totalDurationMs not a number', () => {
      const result = validateImportedRun(makeValidRun({
        summary: { ...makeValidRun().summary, totalDurationMs: undefined },
      }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('totalDurationMs');
    });

    it('rejects results not an array', () => {
      const result = validateImportedRun(makeValidRun({ results: 'not-array' }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('results');
    });

    it('rejects results as null', () => {
      const result = validateImportedRun(makeValidRun({ results: null }));
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error('expected invalid');
      expect(result.error).toContain('results');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from './circuitBreaker';
import type { RequestResult } from '../types';

function makeResult(passed: boolean, errorMessage?: string): RequestResult {
  return {
    id: '1',
    scenarioId: 's1',
    scenarioName: 'test',
    url: 'http://example.com',
    method: 'GET',
    httpStatus: passed ? 200 : 500,
    responseTimeMs: 100,
    responseBody: '',
    timestamp: Date.now(),
    passed,
    validationMode: 'none',
    failureDetails: [],
    errorMessage,
  };
}

describe('CircuitBreaker', () => {
  describe('continue policy', () => {
    it('never trips regardless of errors', () => {
      const breaker = new CircuitBreaker('continue');
      for (let i = 0; i < 100; i++) breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(false);
    });

    it('tracks counts even in continue mode', () => {
      const breaker = new CircuitBreaker('continue');
      breaker.record(makeResult(true));
      breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(false);
    });
  });

  describe('stop-first policy', () => {
    it('trips on first error', () => {
      const breaker = new CircuitBreaker('stop-first');
      breaker.record(makeResult(true));
      expect(breaker.shouldStop).toBe(false);
      breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(true);
    });

    it('provides correct reason message', () => {
      const breaker = new CircuitBreaker('stop-first');
      breaker.record(makeResult(false));
      expect(breaker.reason).toBe('Stopped: first error encountered');
    });

    it('does not trip on success', () => {
      const breaker = new CircuitBreaker('stop-first');
      for (let i = 0; i < 50; i++) breaker.record(makeResult(true));
      expect(breaker.shouldStop).toBe(false);
    });
  });

  describe('stop-threshold policy', () => {
    it('trips when error count reaches maxErrors', () => {
      const breaker = new CircuitBreaker('stop-threshold', 3, 100, 100);
      breaker.record(makeResult(false));
      breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(false);
      breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(true);
      expect(breaker.reason).toContain('3 errors reached max');
    });

    it('trips when error rate exceeds maxErrorRate after minSampleSize', () => {
      const breaker = new CircuitBreaker('stop-threshold', 100, 50, 4);

      breaker.record(makeResult(true));
      breaker.record(makeResult(false));
      breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(false);

      breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(true);
      expect(breaker.reason).toContain('error rate');
    });

    it('does not trip below minSampleSize even with high error rate', () => {
      const breaker = new CircuitBreaker('stop-threshold', 100, 50, 10);
      for (let i = 0; i < 5; i++) breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(false);
    });

    it('does not trip when error rate is under threshold', () => {
      const breaker = new CircuitBreaker('stop-threshold', 100, 50, 10);
      for (let i = 0; i < 8; i++) breaker.record(makeResult(true));
      for (let i = 0; i < 4; i++) breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(false);
    });
  });

  describe('default parameters', () => {
    it('defaults to continue policy', () => {
      const breaker = new CircuitBreaker();
      for (let i = 0; i < 100; i++) breaker.record(makeResult(false));
      expect(breaker.shouldStop).toBe(false);
    });
  });
});

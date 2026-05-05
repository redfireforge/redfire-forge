import { describe, it, expect } from 'vitest';
import { generateReport } from './reportGenerator';
import type { TestRun, RequestResult } from '../../../shared/types';

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: '1',
    scenarioId: 's1',
    scenarioName: 'test-scenario',
    featureGroupName: 'Feature A',
    groupName: 'Group 1',
    url: 'http://example.com',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

function makeRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      concurrency: 5,
      totalTransactions: 10,
      executionMode: 'batch',
      scenarioWeights: [],
    },
    summary: {
      tps: 10,
      avgResponseTime: 100,
      minResponseTime: 50,
      maxResponseTime: 200,
      p50ResponseTime: 95,
      p95ResponseTime: 190,
      p99ResponseTime: 198,
      errorRate: 10,
      errorsByStatus: {},
      totalRequests: 10,
      successfulRequests: 9,
      failedRequests: 1,
      failedValidations: 0,
      totalDurationMs: 1000,
    },
    results: [
      makeResult({ id: 'r1', passed: true }),
      makeResult({ id: 'r2', passed: false, httpStatus: 500, errorMessage: 'Internal Server Error' }),
    ],
    ...overrides,
  };
}

describe('generateReport', () => {
  describe('HTML format', () => {
    it('generates valid HTML with summary stats', () => {
      const html = generateReport(makeRun(), { format: 'html' });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('RedfireForge');
      expect(html).toContain('10'); // TPS
      expect(html).toContain('Internal Server Error');
    });

    it('includes data row labels for parameterized results', () => {
      const run = makeRun({
        results: [
          makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1: VIN=ABC', passed: false, httpStatus: 404, errorMessage: 'Not Found' }),
          makeResult({ dataRowId: 'r2', dataRowLabel: 'Row 2: VIN=DEF', passed: true }),
        ],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('Row 1: VIN=ABC');
      expect(html).toContain('Parameterized');
    });

    it('escapes HTML in scenario names', () => {
      const run = makeRun({
        results: [makeResult({ scenarioName: '<script>alert("xss")</script>', passed: false, errorMessage: 'err' })],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('JSON format', () => {
    it('generates valid JSON with summary', () => {
      const json = generateReport(makeRun(), { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.summary.tps).toBe(10);
      expect(parsed.results.length).toBe(2);
    });

    it('includes parameterized section for data row results', () => {
      const run = makeRun({
        results: [
          makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1', passed: false, errorMessage: 'err' }),
          makeResult({ dataRowId: 'r2', dataRowLabel: 'Row 2', passed: true }),
        ],
      });
      const json = generateReport(run, { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.parameterized.totalRows).toBe(2);
      expect(parsed.parameterized.failedRows).toBe(1);
      expect(parsed.parameterized.failedRowDetails[0].label).toBe('Row 1');
    });

    it('strips response bodies by default', () => {
      const json = generateReport(makeRun(), { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.results[0]).not.toHaveProperty('responseBody');
    });

    it('includes response bodies when requested', () => {
      const json = generateReport(makeRun(), { format: 'json', includeResponseBodies: true });
      const parsed = JSON.parse(json);
      expect(parsed.results[0].responseBody).toBe('{}');
    });
  });

  describe('Markdown format', () => {
    it('generates markdown with summary table', () => {
      const md = generateReport(makeRun(), { format: 'markdown' });
      expect(md).toContain('# ');
      expect(md).toContain('| TPS | 10 |');
      expect(md).toContain('## Failed');
    });

    it('shows no failed section when all pass', () => {
      const run = makeRun({
        results: [makeResult({ passed: true })],
        summary: { ...makeRun().summary, failedRequests: 0 },
      });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).not.toContain('## Failed');
    });
  });
});

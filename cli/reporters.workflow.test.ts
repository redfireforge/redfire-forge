/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  printWorkflowConsoleSummary,
  buildWorkflowJunitXml,
  buildWorkflowMarkdownReport,
} from './reporters';
import { makeResult, makeWorkflow, makeSummary } from './reporters.test.utils';

describe('Workflow reporters', () => {
  describe('printWorkflowConsoleSummary', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('prints workflow summary header', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();

      printWorkflowConsoleSummary(summary, workflow, 10, 5);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Workflow Test Run Summary');
      expect(output).toContain('Workflow:     Test Workflow');
      expect(output).toContain('Mode:         workflow (I:10 C:5)');
    });

    it('prints iterations per second', () => {
      const summary = makeSummary({ totalDurationMs: 10000 });
      const workflow = makeWorkflow();

      printWorkflowConsoleSummary(summary, workflow, 10, 5);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Iterations/s: 1.00');
    });

    it('prints per-step metrics when results provided', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();
      const results = [
        makeResult({ workflowNodeId: 'node-1', scenarioName: 'Step 1', responseTimeMs: 100, passed: true }),
        makeResult({ id: 'r2', workflowNodeId: 'node-1', scenarioName: 'Step 1', responseTimeMs: 200, passed: true }),
        makeResult({ id: 'r3', workflowNodeId: 'node-2', scenarioName: 'Step 2', responseTimeMs: 50, passed: false }),
      ];

      printWorkflowConsoleSummary(summary, workflow, 2, 1, results);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Per-Step Metrics');
      expect(output).toContain('Step 1');
      expect(output).toContain('Step 2');
    });

    it('prints failed iterations summary', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();
      const results = [
        makeResult({ iterationIndex: 0, passed: false }),
        makeResult({ id: 'r2', iterationIndex: 1, passed: true }),
      ];

      printWorkflowConsoleSummary(summary, workflow, 2, 1, results);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Failed Iterations: 1/2');
    });

    it('limits failed iterations display to 5', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();
      const results = Array.from({ length: 10 }, (_, i) => 
        makeResult({ id: `r${i}`, iterationIndex: i, passed: false })
      );

      printWorkflowConsoleSummary(summary, workflow, 10, 1, results);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('... and 5 more');
    });

    it('handles empty results gracefully', () => {
      const summary = makeSummary({ failedRequests: 0, failedValidations: 0 });
      const workflow = makeWorkflow();

      printWorkflowConsoleSummary(summary, workflow, 10, 5, []);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('PASSED');
    });

    it('shows dash for undefined p999 in console', () => {
      const summary = makeSummary({ p999ResponseTime: undefined as unknown as number });
      const workflow = makeWorkflow();

      printWorkflowConsoleSummary(summary, workflow, 10, 5);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('P99.9:        —');
    });

    it('uses nodeId as label when scenarioName is missing', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();
      const results = [
        makeResult({ workflowNodeId: 'node-xyz', scenarioName: '', passed: true }),
      ];

      printWorkflowConsoleSummary(summary, workflow, 1, 1, results);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('node-xyz');
    });

    it('omits failed iterations section when all pass', () => {
      const summary = makeSummary({ failedRequests: 0, failedValidations: 0 });
      const workflow = makeWorkflow();
      const results = [
        makeResult({ iterationIndex: 0, passed: true }),
        makeResult({ id: 'r2', iterationIndex: 1, passed: true }),
      ];

      printWorkflowConsoleSummary(summary, workflow, 2, 1, results);

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Per-Step Metrics');
      expect(output).not.toContain('Failed Iterations');
    });
  });

  describe('buildWorkflowJunitXml', () => {
    it('creates valid JUnit XML structure', () => {
      const summary = makeSummary();
      const results = [
        makeResult({ iterationIndex: 0, passed: true }),
        makeResult({ id: 'r2', iterationIndex: 1, passed: true }),
      ];

      const xml = buildWorkflowJunitXml(results, summary, 'Test Workflow', 2);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<testsuites name="Test Workflow"');
      expect(xml).toContain('<testsuite name="Test Workflow"');
      expect(xml).toContain('tests="2"');
      expect(xml).toContain('</testsuites>');
    });

    it('creates test cases for each iteration', () => {
      const summary = makeSummary();
      const results = [
        makeResult({ iterationIndex: 0, passed: true, responseTimeMs: 100 }),
        makeResult({ id: 'r2', iterationIndex: 1, passed: true, responseTimeMs: 200 }),
      ];

      const xml = buildWorkflowJunitXml(results, summary, 'Test Workflow', 2);

      expect(xml).toContain('Iteration 1');
      expect(xml).toContain('Iteration 2');
    });

    it('includes failure elements for failed iterations', () => {
      const summary = makeSummary();
      const results = [
        makeResult({ iterationIndex: 0, passed: false, errorMessage: 'Network error', httpStatus: 0 }),
      ];

      const xml = buildWorkflowJunitXml(results, summary, 'Test Workflow', 1);

      expect(xml).toContain('failures="1"');
      expect(xml).toContain('<failure');
      expect(xml).toContain('WorkflowIterationFailure');
      expect(xml).toContain('Network error');
    });

    it('escapes XML special characters', () => {
      const summary = makeSummary();
      const results = [
        makeResult({ iterationIndex: 0, passed: false, errorMessage: 'Error: <test> & "quote"', url: 'https://api.com/?a=1&b=2' }),
      ];

      const xml = buildWorkflowJunitXml(results, summary, 'Test <Workflow>', 1);

      expect(xml).toContain('Test &lt;Workflow&gt;');
      expect(xml).toContain('&lt;test&gt;');
      expect(xml).toContain('&amp;');
    });

    it('counts failures correctly', () => {
      const summary = makeSummary();
      const results = [
        makeResult({ iterationIndex: 0, passed: true }),
        makeResult({ id: 'r2', iterationIndex: 1, passed: false }),
        makeResult({ id: 'r3', iterationIndex: 2, passed: false }),
      ];

      const xml = buildWorkflowJunitXml(results, summary, 'Test Workflow', 3);

      expect(xml).toContain('failures="2"');
    });
  });

  describe('buildWorkflowMarkdownReport', () => {
    it('creates markdown report with workflow name', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow({ name: 'Payment Flow' });

      const md = buildWorkflowMarkdownReport(summary, workflow, 10, 5);

      expect(md).toContain('# Workflow Test: Payment Flow');
      expect(md).toContain('**Mode:** workflow | Iterations: 10 | Concurrency: 5');
    });

    it('includes summary metrics table', () => {
      const summary = makeSummary({ totalDurationMs: 10000 });
      const workflow = makeWorkflow();

      const md = buildWorkflowMarkdownReport(summary, workflow, 10, 5);

      expect(md).toContain('## Summary');
      expect(md).toContain('| **Iterations/s** | 1.00 |');
      expect(md).toContain('| **Avg Response** |');
      expect(md).toContain('| **P95** |');
    });

    it('includes per-step metrics when results provided', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();
      const results = [
        makeResult({ workflowNodeId: 'n1', scenarioName: 'Login', passed: true, responseTimeMs: 100 }),
        makeResult({ id: 'r2', workflowNodeId: 'n1', scenarioName: 'Login', passed: true, responseTimeMs: 150 }),
      ];

      const md = buildWorkflowMarkdownReport(summary, workflow, 2, 1, results);

      expect(md).toContain('## Per-Step Metrics');
      expect(md).toContain('| Login |');
    });

    it('includes failed iterations section when failures exist', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();
      const results = [
        makeResult({ iterationIndex: 0, passed: false, scenarioName: 'Step A' }),
        makeResult({ id: 'r2', iterationIndex: 1, passed: true }),
      ];

      const md = buildWorkflowMarkdownReport(summary, workflow, 2, 1, results);

      expect(md).toContain('## Failed Iterations');
      expect(md).toContain('**1** of **2** iterations failed');
      expect(md).toContain('Step A');
    });

    it('limits failed iterations to 20 in markdown', () => {
      const summary = makeSummary();
      const workflow = makeWorkflow();
      const results = Array.from({ length: 25 }, (_, i) => 
        makeResult({ id: `r${i}`, iterationIndex: i, passed: false, scenarioName: `Step ${i}` })
      );

      const md = buildWorkflowMarkdownReport(summary, workflow, 25, 1, results);

      expect(md).toContain('5 more iterations');
    });

    it('shows PASSED result when no failures', () => {
      const summary = makeSummary({ failedRequests: 0, failedValidations: 0 });
      const workflow = makeWorkflow();

      const md = buildWorkflowMarkdownReport(summary, workflow, 10, 5);

      expect(md).toContain('## Result: PASSED ✅');
    });

    it('shows FAILED result when failures exist', () => {
      const summary = makeSummary({ failedRequests: 1 });
      const workflow = makeWorkflow();

      const md = buildWorkflowMarkdownReport(summary, workflow, 10, 5);

      expect(md).toContain('## Result: FAILED ❌');
    });

    it('shows dash for undefined p999 in markdown', () => {
      const summary = makeSummary({ p999ResponseTime: undefined as unknown as number });
      const workflow = makeWorkflow();

      const md = buildWorkflowMarkdownReport(summary, workflow, 10, 5);

      expect(md).toContain('| **P99.9** | — ms |');
    });

    it('omits failed iterations when all pass in markdown', () => {
      const summary = makeSummary({ failedRequests: 0, failedValidations: 0 });
      const workflow = makeWorkflow();
      const results = [
        makeResult({ iterationIndex: 0, passed: true }),
        makeResult({ id: 'r2', iterationIndex: 1, passed: true }),
      ];

      const md = buildWorkflowMarkdownReport(summary, workflow, 2, 1, results);

      expect(md).toContain('Per-Step Metrics');
      expect(md).not.toContain('Failed Iterations');
    });
  });
});

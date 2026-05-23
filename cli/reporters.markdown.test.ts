/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { buildMarkdownReport } from './reporters';
import { makeResult, makeConfig, makeSummary } from './reporters.test.utils';

describe('buildMarkdownReport', () => {
  it('builds valid Markdown structure', () => {
    const summary = makeSummary();
    const config = makeConfig();

    const md = buildMarkdownReport(summary, config, { name: 'Test Run' });

    expect(md).toContain('# Test Run');
    expect(md).toContain('## Summary');
    expect(md).toContain('| Metric | Value |');
    expect(md).toContain('| **TPS** |');
  });

  it('includes environment when provided', () => {
    const summary = makeSummary();
    const config = makeConfig();

    const md = buildMarkdownReport(summary, config, { name: 'Test', env: 'staging' });

    expect(md).toContain('**Environment:** staging');
  });

  it('includes timing breakdown when results have timing', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({
        timing: {
          dnsLookup: 5,
          tcpConnect: 10,
          tlsHandshake: 15,
          ttfb: 30,
          download: 10,
          total: 70,
        },
      }),
    ];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).toContain('## Timing Breakdown');
    expect(md).toContain('| **DNS Lookup** |');
  });

  it('includes errors section when there are failures', () => {
    const summary = makeSummary({ failedRequests: 1, errorsByStatus: { 500: 1 } });
    const config = makeConfig();

    const md = buildMarkdownReport(summary, config, {});

    expect(md).toContain('## Errors');
    expect(md).toContain('| 500 | 1 |');
  });

  it('includes data row summary when results have data rows', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1', passed: true }),
      makeResult({ id: 'r2', dataRowId: 'r2', dataRowLabel: 'Row 2', passed: false, httpStatus: 500 }),
    ];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).toContain('## Data Row Summary');
    expect(md).toContain('### Failed Rows');
    expect(md).toContain('| Row 2 | 500 |');
  });

  it('shows validation failure count for failed data rows in markdown', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'r1',
        dataRowLabel: 'Row 1',
        passed: false,
        httpStatus: 200,
        errorMessage: '',
        failureDetails: ['field mismatch', 'type error'],
      }),
    ];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).toContain('2 validation failure(s)');
  });

  it('omits failed rows when all data rows pass in markdown', () => {
    const summary = makeSummary({ failedRequests: 0, failedValidations: 0 });
    const config = makeConfig();
    const results = [
      makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1', passed: true }),
      makeResult({ id: 'r2', dataRowId: 'r2', dataRowLabel: 'Row 2', passed: true }),
    ];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).toContain('Data Row Summary');
    expect(md).not.toContain('### Failed Rows');
  });

  it('uses dataRowId as label when dataRowLabel missing in markdown', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-xyz',
        dataRowLabel: '',
        passed: false,
        httpStatus: 500,
        failureDetails: [],
      }),
    ];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).toContain('row-xyz');
  });

  // ─── Scenario Tags Tests ────────────────────────────────

  it('includes Tags row when results have scenarioTags', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({ scenarioTags: ['smoke', 'critical'] }),
      makeResult({ id: 'r2', scenarioTags: ['regression'] }),
    ];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).toContain('| **Tags** | critical, regression, smoke |');
  });

  it('omits Tags row when no results have scenarioTags', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [makeResult({ scenarioTags: undefined })];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).not.toContain('| **Tags** |');
  });

  it('omits Tags row when all scenarioTags are empty', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [makeResult({ scenarioTags: [] })];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).not.toContain('| **Tags** |');
  });

  it('deduplicates and sorts tags', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({ scenarioTags: ['smoke', 'critical'] }),
      makeResult({ id: 'r2', scenarioTags: ['smoke', 'regression'] }),
    ];

    const md = buildMarkdownReport(summary, config, {}, results);

    expect(md).toContain('| **Tags** | critical, regression, smoke |');
  });
});

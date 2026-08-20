/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printConsoleSummary } from './reporters';
import { makeResult, makeConfig, makeSummary } from './reporters.test.utils';

describe('printConsoleSummary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('prints summary to console', () => {
    const summary = makeSummary({ failedRequests: 0, failedValidations: 0 });
    const config = makeConfig();

    printConsoleSummary(summary, config);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('RedfireForge');
    expect(output).toContain('TPS:');
    expect(output).toContain('PASSED');
  });

  it('prints FAILED when there are failures', () => {
    const summary = makeSummary({ failedRequests: 1 });
    const config = makeConfig();

    printConsoleSummary(summary, config);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('FAILED');
  });

  // ─── Sequential Mode Concurrency Display (NOTE-2 fix) ────────────

  it('shows C:1 for sequential mode regardless of configured concurrency', () => {
    const summary = makeSummary();
    const config = makeConfig({ executionMode: 'sequential', concurrency: 5 });

    printConsoleSummary(summary, config);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Mode:         sequential (C:1 I:10)');
  });

  it('shows the real configured concurrency for non-sequential modes', () => {
    const summary = makeSummary();
    const config = makeConfig({ executionMode: 'pool', concurrency: 5 });

    printConsoleSummary(summary, config);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Mode:         pool (C:5 I:10)');
  });

  it('prints data row breakdown when results have data rows', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1', passed: true }),
      makeResult({ id: 'r2', dataRowId: 'r2', dataRowLabel: 'Row 2', passed: false, httpStatus: 500 }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Data Rows:');
    expect(output).toContain('2 total');
    expect(output).toContain('1 failed');
  });

  // ─── Scenario Tags Tests ────────────────────────────────

  it('prints tags when results have scenarioTags', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({ scenarioTags: ['smoke', 'critical'] }),
      makeResult({ id: 'r2', scenarioTags: ['regression'] }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Tags:');
    expect(output).toContain('critical, regression, smoke');
  });

  it('does not print tags when no results have scenarioTags', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [makeResult({ scenarioTags: undefined })];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).not.toContain('Tags:');
  });

  it('deduplicates and sorts tags in console output', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({ scenarioTags: ['smoke', 'critical'] }),
      makeResult({ id: 'r2', scenarioTags: ['smoke', 'regression'] }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('critical, regression, smoke');
  });

  it('shows dash for undefined p999 in standard console', () => {
    const summary = makeSummary({ p999ResponseTime: undefined as unknown as number });
    const config = makeConfig();

    printConsoleSummary(summary, config);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('P99.9:        —');
  });

  it('prints tags with mixed undefined/defined scenarioTags', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({ scenarioTags: ['smoke'] }),
      makeResult({ id: 'r2', scenarioTags: undefined }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Tags:');
    expect(output).toContain('smoke');
  });

  it('prints failed data row details with validation failures', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-1',
        dataRowLabel: 'Row 1',
        passed: false,
        httpStatus: 200,
        errorMessage: '',
        failureDetails: ['field "name" expected "foo" got "bar"'],
      }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('1 validation failure(s)');
  });

  it('prints failed data row with HTTP error when no validation failures', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-1',
        passed: false,
        httpStatus: 500,
        errorMessage: '',
        failureDetails: [],
      }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('HTTP 500');
  });

  it('uses errorMessage directly when set', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-1',
        passed: false,
        httpStatus: 500,
        errorMessage: 'Connection refused',
        failureDetails: [],
      }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Connection refused');
  });

  it('uses dataRowId when dataRowLabel is empty', () => {
    const summary = makeSummary();
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-abc',
        dataRowLabel: '',
        passed: false,
        httpStatus: 500,
        failureDetails: [],
      }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('row-abc');
  });

  it('prints timing breakdown when results have timing', () => {
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

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Timing Breakdown');
    expect(output).toContain('DNS Lookup:');
  });

  it('prints KAFKA (produce) in failed data row details for Kafka produce results', () => {
    const summary = makeSummary({ failedRequests: 1 });
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-1',
        dataRowLabel: 'Row 1',
        passed: false,
        transportType: 'kafkaProduce',
        method: 'KAFKA',
        httpStatus: undefined as unknown as number,
        failureDetails: [],
      }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('PRODUCE');
  });

  it('prints CONSUME in failed data row details for Kafka consume results', () => {
    const summary = makeSummary({ failedRequests: 1 });
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-2',
        dataRowLabel: 'Row 2',
        passed: false,
        transportType: 'kafkaConsume',
        method: 'KAFKA',
        httpStatus: undefined as unknown as number,
        failureDetails: [],
      }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('CONSUME');
  });

  it('prints WS_RECEIVE in failed data row details for WebSocket receive results', () => {
    const summary = makeSummary({ failedRequests: 1 });
    const config = makeConfig();
    const results = [
      makeResult({
        dataRowId: 'row-3',
        dataRowLabel: 'Row 3',
        passed: false,
        transportType: 'wsReceive',
        method: 'WS',
        httpStatus: undefined as unknown as number,
        failureDetails: [],
      }),
    ];

    printConsoleSummary(summary, config, results);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('WS_RECEIVE');
  });
});

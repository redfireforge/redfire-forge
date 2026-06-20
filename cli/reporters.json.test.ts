/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { buildJsonReport, buildDataRowSummary } from './reporters';
import { makeResult, makeConfig, makeSummary } from './reporters.test.utils';

describe('buildJsonReport', () => {
  it('builds valid JSON report structure', () => {
    const results = [makeResult()];
    const summary = makeSummary();
    const config = makeConfig();

    const report = buildJsonReport(results, summary, config, { name: 'Test', env: 'staging' });

    expect(report.id).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(report.config).toBe(config);
    expect(report.summary).toBe(summary);
    expect(report.results).toBe(results);
    expect(report.envName).toBe('staging');
    expect(report.projectName).toBe('Test');
  });
});

describe('buildDataRowSummary', () => {
  it('returns empty array when no data row results', () => {
    const results = [makeResult()];

    const summary = buildDataRowSummary(results);

    expect(summary).toEqual([]);
  });

  it('groups results by scenario and counts pass/fail', () => {
    const results = [
      makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1', passed: true }),
      makeResult({ id: 'r2', dataRowId: 'r2', dataRowLabel: 'Row 2', passed: true }),
      makeResult({ id: 'r3', dataRowId: 'r3', dataRowLabel: 'Row 3', passed: false, httpStatus: 500 }),
    ];

    const summary = buildDataRowSummary(results);

    expect(summary).toHaveLength(1);
    expect(summary[0].pattern).toBe('Get Users');
    expect(summary[0].totalRows).toBe(3);
    expect(summary[0].passedRows).toBe(2);
    expect(summary[0].failedRows).toBe(1);
  });

  it('includes failed row details', () => {
    const results = [
      makeResult({
        dataRowId: 'r1',
        dataRowLabel: 'Row 1',
        passed: false,
        httpStatus: 400,
        errorMessage: 'Bad Request',
      }),
    ];

    const summary = buildDataRowSummary(results);

    expect(summary[0].failedRowDetails).toHaveLength(1);
    expect(summary[0].failedRowDetails[0]).toEqual({
      row: 'r1',
      label: 'Row 1',
      status: 400,
      error: 'Bad Request',
    });
  });

  it('uses PRODUCE status label for failed Kafka produce data rows', () => {
    const results = [
      makeResult({
        dataRowId: 'r1',
        dataRowLabel: 'Row 1',
        passed: false,
        method: 'KAFKA',
        transportType: 'kafkaProduce',
        httpStatus: 0,
        errorMessage: 'Broker unreachable',
        kafkaResultMeta: { topic: 'orders', partition: 0, offset: 0 },
      }),
    ];

    const summary = buildDataRowSummary(results);

    expect(summary[0].failedRowDetails[0].status).toBe('PRODUCE');
  });

  it('uses CONSUME status label for failed Kafka consume data rows', () => {
    const results = [
      makeResult({
        dataRowId: 'r1',
        dataRowLabel: 'Row 1',
        passed: false,
        method: 'KAFKA',
        transportType: 'kafkaConsume',
        httpStatus: 0,
        errorMessage: 'No messages received',
        kafkaResultMeta: { topic: 'events', partition: 0, offset: 0 },
      }),
    ];

    const summary = buildDataRowSummary(results);

    expect(summary[0].failedRowDetails[0].status).toBe('CONSUME');
  });

  it('uses WS_CONNECT status label for failed WebSocket connect data rows', () => {
    const results = [
      makeResult({
        dataRowId: 'r1',
        dataRowLabel: 'Row 1',
        passed: false,
        method: 'WS',
        transportType: 'wsConnect',
        httpStatus: 0,
        errorMessage: 'Connection refused',
        wsResultMeta: { url: 'ws://localhost:9876' },
      }),
    ];

    const summary = buildDataRowSummary(results);

    expect(summary[0].failedRowDetails[0].status).toBe('WS_CONNECT');
  });

  it('uses WS_SEND status label for failed WebSocket send data rows', () => {
    const results = [
      makeResult({
        dataRowId: 'r1',
        dataRowLabel: 'Row 1',
        passed: false,
        method: 'WS',
        transportType: 'wsSend',
        httpStatus: 0,
        errorMessage: 'Send failed',
      }),
    ];

    const summary = buildDataRowSummary(results);

    expect(summary[0].failedRowDetails[0].status).toBe('WS_SEND');
  });
});

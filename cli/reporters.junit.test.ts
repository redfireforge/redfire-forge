/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { buildJunitXml } from './reporters';
import { makeResult, makeSummary } from './reporters.test.utils';

describe('buildJunitXml', () => {
  it('builds valid JUnit XML structure', () => {
    const results = [makeResult()];
    const summary = makeSummary();

    const xml = buildJunitXml(results, summary, 'Test Suite');

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuites name="Test Suite"');
    expect(xml).toContain('<testsuite name="Test Suite"');
    expect(xml).toContain('<testcase');
    expect(xml).toContain('</testsuites>');
  });

  it('includes correct test counts in testsuite', () => {
    const results = [
      makeResult({ passed: true }),
      makeResult({ id: 'r2', passed: false, httpStatus: 500, failureDetails: [{ path: '$.id', expected: '1', actual: '2' }] }),
    ];
    const summary = makeSummary({ totalRequests: 2, failedRequests: 1 });

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="1"');
  });

  it('includes failure element for failed tests', () => {
    const results = [
      makeResult({
        passed: false,
        httpStatus: 500,
        errorMessage: 'Internal Server Error',
        failureDetails: [],
      }),
    ];
    const summary = makeSummary({ failedRequests: 1 });

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).toContain('<failure');
    expect(xml).toContain('Internal Server Error');
    expect(xml).toContain('type="HttpError"');
  });

  it('includes data row label in test name', () => {
    const results = [makeResult({ dataRowLabel: 'Row 1: userId=123' })];
    const summary = makeSummary();

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).toContain('[Row 1: userId=123]');
  });

  it('escapes XML special characters', () => {
    const results = [makeResult({ scenarioName: 'Test <with> "special" & chars' })];
    const summary = makeSummary();

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).toContain('Test &lt;with&gt; &quot;special&quot; &amp; chars');
  });

  // ─── Scenario Tags Tests ────────────────────────────────

  it('includes tags attribute when scenarioTags is present', () => {
    const results = [makeResult({ scenarioTags: ['smoke', 'regression'] })];
    const summary = makeSummary();

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).toContain('tags="smoke,regression"');
  });

  it('omits tags attribute when scenarioTags is undefined', () => {
    const results = [makeResult({ scenarioTags: undefined })];
    const summary = makeSummary();

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).not.toContain('tags=');
  });

  it('omits tags attribute when scenarioTags is empty', () => {
    const results = [makeResult({ scenarioTags: [] })];
    const summary = makeSummary();

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).not.toContain('tags=');
  });

  it('escapes special characters in tags', () => {
    const results = [makeResult({ scenarioTags: ['tag<with>special&chars'] })];
    const summary = makeSummary();

    const xml = buildJunitXml(results, summary, 'Suite');

    expect(xml).toContain('tags="tag&lt;with&gt;special&amp;chars"');
  });

  describe('Kafka action results', () => {
    it('uses KafkaError failure type for Kafka produce results', () => {
      const results = [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaProduce',
          httpStatus: 0,
          errorMessage: 'Kafka broker unreachable',
          kafkaResultMeta: { topic: 'orders', partition: 0, offset: 0 },
        }),
      ];
      const summary = makeSummary({ failedRequests: 1 });

      const xml = buildJunitXml(results, summary, 'Suite');

      expect(xml).toContain('type="KafkaError"');
      expect(xml).not.toContain('type="HttpError"');
    });

    it('uses KafkaError failure type for Kafka consume results', () => {
      const results = [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaConsume',
          httpStatus: 0,
          errorMessage: 'No messages received within timeout',
          kafkaResultMeta: { topic: 'events', partition: 0, offset: 0 },
        }),
      ];
      const summary = makeSummary({ failedRequests: 1 });

      const xml = buildJunitXml(results, summary, 'Suite');

      expect(xml).toContain('type="KafkaError"');
    });

    it('shows KAFKA topic in failure body and testcase name for Kafka produce with empty URL', () => {
      const results = [
        makeResult({
          passed: false,
          method: 'KAFKA',
          url: '',
          transportType: 'kafkaProduce',
          httpStatus: 0,
          errorMessage: 'Produce failed',
          kafkaResultMeta: { topic: 'orders', partition: 0, offset: 0 },
        }),
      ];
      const summary = makeSummary({ failedRequests: 1 });

      const xml = buildJunitXml(results, summary, 'Suite');

      // failure body uses topic
      expect(xml).toContain('KAFKA KAFKA orders');
      // testcase name must use topic instead of empty URL — no trailing space before ]
      expect(xml).toContain('[KAFKA orders]');
      expect(xml).not.toContain('[KAFKA ]');
      expect(xml).not.toContain('HTTP 0');
    });

    it('falls back to \'kafka\' identifier in testcase name and failure body when kafkaResultMeta is absent', () => {
      const results = [
        makeResult({
          passed: false,
          method: 'KAFKA',
          url: '',
          transportType: 'kafkaProduce',
          httpStatus: 0,
          errorMessage: 'Broker connection refused',
          // kafkaResultMeta absent — broker never responded
        }),
      ];
      const summary = makeSummary({ failedRequests: 1 });

      const xml = buildJunitXml(results, summary, 'Suite');

      // testcase name uses 'kafka' fallback — no bare trailing space
      expect(xml).toContain('[KAFKA kafka]');
      expect(xml).not.toContain('[KAFKA ]');
      // failure body also uses 'kafka' fallback
      expect(xml).toContain('KAFKA KAFKA kafka');
    });

    it('uses KafkaError type for Kafka result with assertion failures', () => {
      const results = [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaProduce',
          httpStatus: 200,
          errorMessage: undefined,
          failureDetails: [{ path: 'kafka.key', expected: 'abc', actual: 'xyz' }],
          kafkaResultMeta: { topic: 'orders', partition: 0, offset: 1 },
        }),
      ];
      const summary = makeSummary({ failedRequests: 0, failedValidations: 1 });

      const xml = buildJunitXml(results, summary, 'Suite');

      expect(xml).toContain('type="KafkaError"');
    });
  });
});

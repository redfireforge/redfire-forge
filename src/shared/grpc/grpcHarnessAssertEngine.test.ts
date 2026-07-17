/**
 * Phase 8D — harness assertion engine tests.
 */
import { describe, expect, it } from 'vitest';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import {
  buildGrpcHarnessAssertionName,
  evaluateGrpcHarnessAssertions,
  evaluateGrpcHarnessAssertionsDetailed,
  formatGrpcHarnessAssertionFailure,
} from './grpcHarnessAssertEngine';

const unary: GrpcHarnessCallOutcome = {
  callType: 'unary',
  passed: true,
  grpcStatus: 0,
  grpcStatusMessage: 'OK',
  durationMs: 25,
  body: { message: 'hello', code: '42', big: '9223372036854775807' },
  trailers: { 'x-trace': 'abc' },
  attempts: 1,
};

const serverStream: GrpcHarnessCallOutcome = {
  callType: 'server_streaming',
  passed: true,
  grpcStatus: 0,
  durationMs: 100,
  messages: [{ n: 1 }, { n: 2 }, { n: 3 }],
  attempts: 1,
};

describe('evaluateGrpcHarnessAssertions (Phase 8D)', () => {
  it('passes grpcStatus assertion', () => {
    const outcome = evaluateGrpcHarnessAssertions(unary, [{ grpcStatus: 0 }]);
    expect(outcome.passed).toBe(true);
  });

  it('fails grpcStatus with stable message', () => {
    const outcome = evaluateGrpcHarnessAssertions(unary, [{ grpcStatus: 3 }]);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures[0]).toBe(formatGrpcHarnessAssertionFailure(0, 'grpcStatus expected 3, got 0'));
  });

  it('evaluates grpcField equals, contains, and exists', () => {
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.message',
      equals: 'hello',
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.message',
      contains: 'ell',
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.missing',
      exists: false,
    }]).passed).toBe(true);
  });

  it('evaluates grpcNumericField with large integer strings', () => {
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcNumericField: '$.big',
      operator: '==',
      value: '9223372036854775807',
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcNumericField: 'code',
      operator: '>=',
      value: 40,
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions({
      ...unary,
      body: { ...unary.body, uint: '18446744073709551615' },
    }, [{
      grpcNumericField: '$.uint',
      operator: '==',
      value: '18446744073709551615',
    }]).passed).toBe(true);
  });

  it('evaluates grpcStreamField at index', () => {
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamField: '$.n',
      index: 1,
      equals: 2,
    }]).passed).toBe(true);
  });

  it('fails grpcStreamField when index is out of range', () => {
    const outcome = evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamField: '$.n',
      index: 9,
      exists: true,
    }]);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures[0]).toContain('messages[9] does not exist');
  });

  it('passes grpcStreamField exists:false when message index is out of range', () => {
    // When the message itself is absent, the field is also absent — exists:false is satisfied.
    const outcome = evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamField: '$.n',
      index: 9,
      exists: false,
    }]);
    expect(outcome.passed).toBe(true);
    expect(outcome.failures).toHaveLength(0);
  });

  it('reports digit text in grpcNumericField failure messages', () => {
    const outcome = evaluateGrpcHarnessAssertions(unary, [{
      grpcNumericField: '$.big',
      operator: '==',
      value: '9223372036854775806',
    }]);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures[0]).toBe(formatGrpcHarnessAssertionFailure(
      0,
      '$.big == expected 9223372036854775806, got 9223372036854775807',
    ));
  });

  it('evaluates grpcTrailer exists against last-wins normalized maps', () => {
    const outcome = {
      ...unary,
      trailers: { 'X-Trace': 'first', 'x-trace': 'second' },
    };
    expect(evaluateGrpcHarnessAssertions(outcome, [{
      grpcTrailer: 'X-TRACE',
      exists: true,
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions({
      ...unary,
      trailers: {},
    }, [{
      grpcTrailer: 'X-Trace',
      exists: false,
    }]).passed).toBe(true);
  });

  it('evaluates grpcTrailer case-insensitively', () => {
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcTrailer: 'X-Trace',
      equals: 'abc',
    }]).passed).toBe(true);
  });

  it('evaluates grpcTrailer against mixed-case trailer maps', () => {
    const outcome = {
      ...unary,
      trailers: { 'X-Trace': 'abc', 'GRPC-Status': '0' },
    };
    expect(evaluateGrpcHarnessAssertions(outcome, [{
      grpcTrailer: 'grpc-status',
      equals: '0',
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions({
      ...outcome,
      trailers: { 'X-Trace': 'first', 'x-trace': 'second' },
    }, [{
      grpcTrailer: 'X-TRACE',
      equals: 'second',
    }]).passed).toBe(true);
  });

  it('evaluates grpcDuration min/max', () => {
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcDuration: { min: 10, max: 50 },
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcDuration: { max: 10 },
    }]).passed).toBe(false);
  });

  it('evaluates grpcStreamLength on streaming outcomes', () => {
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamLength: { equals: 3 },
    }]).passed).toBe(true);
    const unaryLength = evaluateGrpcHarnessAssertions(unary, [{
      grpcStreamLength: { min: 1 },
    }]);
    expect(unaryLength.passed).toBe(false);
    expect(unaryLength.failures[0]).toContain('streaming callType');
  });

  it('evaluates grpcField on bidi terminal body when inbound messages are absent', () => {
    const bidi: GrpcHarnessCallOutcome = {
      callType: 'bidi_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 12,
      body: { count: 5 },
      attempts: 1,
    };
    expect(evaluateGrpcHarnessAssertions(bidi, [{
      grpcField: '$.count',
      equals: 5,
    }]).passed).toBe(true);
  });

  it('evaluates grpcField on client_streaming inbound messages when terminal body is absent', () => {
    const client: GrpcHarnessCallOutcome = {
      callType: 'client_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 8,
      messages: [{ reply: 'ok' }],
      attempts: 1,
    };
    expect(evaluateGrpcHarnessAssertions(client, [{
      grpcField: '$.reply',
      equals: 'ok',
    }]).passed).toBe(true);
  });

  it('collects multiple failures in order', () => {
    const outcome = evaluateGrpcHarnessAssertions(unary, [
      { grpcStatus: 3 },
      { grpcField: '$.message', equals: 'bye' },
    ]);
    expect(outcome.failures).toHaveLength(2);
    expect(outcome.failures[0]).toContain('assertions[0]:');
    expect(outcome.failures[1]).toContain('assertions[1]:');
  });

  it('evaluates assertions even when transport passed is false', () => {
    const failed: GrpcHarnessCallOutcome = {
      ...unary,
      passed: false,
      grpcStatus: 3,
      grpcStatusMessage: 'INVALID_ARGUMENT',
    };
    const outcome = evaluateGrpcHarnessAssertions(failed, [{ grpcStatus: 3 }]);
    expect(outcome.passed).toBe(true);
  });
});

describe('formatGrpcHarnessAssertionFailure snapshots', () => {
  it('matches stable failure prefix', () => {
    expect(formatGrpcHarnessAssertionFailure(2, 'grpcStatus expected 0, got 3'))
      .toMatchInlineSnapshot('"assertions[2]: grpcStatus expected 0, got 3"');
  });
});

describe('Phase 8G detailed assertion evaluation', () => {
  it('builds stable assertion names', () => {
    expect(buildGrpcHarnessAssertionName({ grpcStatus: 0 }, 0)).toBe('grpcStatus');
    expect(buildGrpcHarnessAssertionName({ grpcField: '$.message', equals: 'x' }, 1))
      .toBe('grpcField:$.message');
    expect(buildGrpcHarnessAssertionName({
      grpcStreamField: '$.n',
      index: 2,
      equals: 3,
    }, 0)).toBe('grpcStreamField:$.n@2');
    expect(buildGrpcHarnessAssertionName({ grpcTrailer: 'X-Trace', equals: '1' }, 0))
      .toBe('grpcTrailer:x-trace');
  });

  it('returns per-assertion results aligned with failures', () => {
    const detailed = evaluateGrpcHarnessAssertionsDetailed(unary, [
      { grpcStatus: 0 },
      { grpcField: '$.message', equals: 'wrong' },
    ]);
    expect(detailed.passed).toBe(false);
    expect(detailed.failures).toHaveLength(1);
    expect(detailed.assertionResults).toEqual([
      { name: 'grpcStatus', passed: true },
      { name: 'grpcField:$.message', passed: false, message: detailed.failures[0] },
    ]);
  });
});

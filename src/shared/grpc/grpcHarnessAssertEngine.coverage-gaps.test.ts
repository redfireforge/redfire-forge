/**
 * Coverage gaps — grpcHarnessAssertEngine.ts (Phase 8D/8G).
 */
import { describe, expect, it } from 'vitest';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import {
  buildGrpcHarnessAssertionName,
  evaluateGrpcHarnessAssertions,
  evaluateGrpcHarnessAssertionsDetailed,
} from './grpcHarnessAssertEngine';

const unary: GrpcHarnessCallOutcome = {
  callType: 'unary',
  passed: true,
  grpcStatus: 0,
  durationMs: 25,
  body: { message: 'hello', tags: ['a', 'b'], nested: { id: 1 } },
  trailers: { 'x-trace': 'abc' },
  attempts: 1,
};

const serverStream: GrpcHarnessCallOutcome = {
  callType: 'server_streaming',
  passed: true,
  grpcStatus: 0,
  durationMs: 100,
  messages: [{ n: 1 }, { n: 2 }],
  attempts: 1,
};

describe('grpcHarnessAssertEngine coverage gaps', () => {
  it('builds names for numeric, duration, stream length, and fallback kinds', () => {
    expect(buildGrpcHarnessAssertionName({
      grpcNumericField: '$.count',
      operator: '==',
      value: 1,
    }, 0)).toBe('grpcNumericField:$.count');
    expect(buildGrpcHarnessAssertionName({ grpcDuration: { max: 100 } }, 0)).toBe('grpcDuration');
    expect(buildGrpcHarnessAssertionName({ grpcStreamLength: { min: 1 } }, 0)).toBe('grpcStreamLength');
    expect(buildGrpcHarnessAssertionName({} as { grpcStatus: number }, 3)).toBe('unknown[3]');
  });

  it('evaluates grpcField contains on strings, arrays, and objects', () => {
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.message',
      contains: 'ell',
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions({
      ...unary,
      body: { ...unary.body, tags: ['alpha', 'beta'] },
    }, [{
      grpcField: '$.tags',
      contains: 'beta',
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.nested',
      contains: { id: 1 },
    }]).passed).toBe(true);
  });

  it('fails grpcField exists, equals, contains, and missing-operator cases', () => {
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.missing',
      exists: true,
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.message',
      equals: 'wrong',
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.message',
      contains: 'zzz',
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcField: '$.message',
    }]).passed).toBe(false);
  });

  it('fails grpcNumericField comparisons with operator text', () => {
    const outcome = evaluateGrpcHarnessAssertions(unary, [{
      grpcNumericField: '$.nested.id',
      operator: '>',
      value: 99,
    }]);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures[0]).toContain('>');
  });

  it('covers grpcStreamField contains, exists, and missing-operator failures', () => {
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamField: '$.n',
      index: 0,
      contains: 1,
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamField: '$.missing',
      index: 0,
      exists: false,
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamField: '$.n',
      index: 0,
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcStreamField: '$.n',
      index: 0,
      equals: 1,
    }]).passed).toBe(false);
  });

  it('evaluates grpcTrailer exists false and equals mismatch', () => {
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcTrailer: 'missing-trailer',
      exists: false,
    }]).passed).toBe(true);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcTrailer: 'x-trace',
      equals: 'wrong',
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcTrailer: 'x-trace',
    }]).passed).toBe(false);
  });

  it('fails grpcDuration when durationMs is missing or out of bounds', () => {
    const noDuration: GrpcHarnessCallOutcome = { ...unary, durationMs: undefined };
    expect(evaluateGrpcHarnessAssertions(noDuration, [{
      grpcDuration: { max: 100 },
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcDuration: { min: 1000 },
    }]).passed).toBe(false);
  });

  it('fails grpcStreamLength min/max and unary misuse', () => {
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamLength: { min: 5 },
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamLength: { max: 1 },
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(serverStream, [{
      grpcStreamLength: { equals: 99 },
    }]).passed).toBe(false);
    expect(evaluateGrpcHarnessAssertions(unary, [{
      grpcStreamLength: { equals: 1 },
    }]).passed).toBe(false);
  });

  it('uses valueContains fallback for primitive actual values', () => {
    expect(evaluateGrpcHarnessAssertions({
      ...unary,
      body: { code: 404 },
    }, [{
      grpcField: 'code',
      contains: '40',
    }]).passed).toBe(true);
  });

  it('returns detailed assertion results for mixed pass/fail batches', () => {
    const detailed = evaluateGrpcHarnessAssertionsDetailed(serverStream, [
      { grpcStreamLength: { equals: 2 } },
      { grpcStreamField: '$.n', index: 1, equals: 99 },
    ]);
    expect(detailed.passed).toBe(false);
    expect(detailed.assertionResults).toHaveLength(2);
    expect(detailed.assertionResults[0]?.passed).toBe(true);
    expect(detailed.assertionResults[1]?.passed).toBe(false);
  });
});

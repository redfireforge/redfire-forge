/**
 * Coverage gaps — grpcWorkflowAssertEngine.ts
 */
import { describe, expect, it } from 'vitest';
import { evaluateGrpcWorkflowAssertions } from './grpcWorkflowAssertEngine';
import type { GrpcWorkflowAssertion, GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

const unary: GrpcWorkflowStepResult = {
  nodeId: 'u1',
  callType: 'unary',
  status: 'success',
  grpcStatus: 0,
  grpcStatusMessage: 'OK',
  durationMs: 25,
  body: { message: 'hello', tags: ['a', 'b'], nested: { key: 'value' } },
  trailers: { 'grpc-status': '0', 'X-Trace': 'abc' },
};

const stream: GrpcWorkflowStepResult = {
  nodeId: 's1',
  callType: 'server_streaming',
  status: 'success',
  grpcStatus: 0,
  messages: [{ n: 1 }, { n: 2 }, { n: 3 }],
  durationMs: 100,
};

describe('grpcWorkflowAssertEngine coverage gaps', () => {
  it('fails grpcField equals, contains, and exists mismatches', () => {
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.message',
      equals: 'bye',
    }]).failures[0]).toContain('equals expected');

    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.message',
      contains: 'missing',
    }]).failures[0]).toContain('contains expected');

    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.missing',
      exists: true,
    }]).failures[0]).toContain('exists expected');
  });

  it('requires equals, contains, or exists on grpcField assertions', () => {
    const outcome = evaluateGrpcWorkflowAssertions(unary, [{ grpcField: '$.message' }]);
    expect(outcome.failures[0]).toContain('requires equals, contains, or exists');
  });

  it('evaluates valueContains for arrays, objects, and primitives', () => {
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.tags',
      contains: 'a',
    }]).passed).toBe(true);
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.nested',
      contains: { key: 'value' },
    }]).passed).toBe(true);
    expect(evaluateGrpcWorkflowAssertions({
      ...unary,
      body: { code: 404 },
    }, [{
      grpcField: '$.code',
      contains: 404,
    }]).passed).toBe(true);
    expect(evaluateGrpcWorkflowAssertions({
      ...unary,
      body: { code: null },
    }, [{
      grpcField: '$.code',
      contains: 'x',
    }]).passed).toBe(false);
  });

  it('evaluates grpcTrailer exists and equals failures', () => {
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcTrailer: 'missing-trailer',
      exists: true,
    }]).failures[0]).toContain('exists expected true');

    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcTrailer: 'X-Trace',
      exists: false,
    }]).failures[0]).toContain('exists expected false');

    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcTrailer: 'X-Trace',
      equals: 'wrong',
    }]).failures[0]).toContain('equals expected');

    expect(evaluateGrpcWorkflowAssertions(unary, [{ grpcTrailer: 'X-Trace' }]).failures[0])
      .toContain('requires equals or exists');
  });

  it('evaluates grpcDuration min/max edge failures', () => {
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcDuration: { min: 100 },
    }]).failures[0]).toContain('below min');

    expect(evaluateGrpcWorkflowAssertions({
      ...unary,
      durationMs: undefined,
    }, [{
      grpcDuration: { max: 10 },
    }]).failures[0]).toContain('requires durationMs');
  });

  it('evaluates grpcStreamLength min/max/equals failures', () => {
    expect(evaluateGrpcWorkflowAssertions(stream, [{
      grpcStreamLength: { equals: 2 },
    }]).failures[0]).toContain('stream length expected 2');

    expect(evaluateGrpcWorkflowAssertions(stream, [{
      grpcStreamLength: { min: 5 },
    }]).failures[0]).toContain('below min');

    expect(evaluateGrpcWorkflowAssertions(stream, [{
      grpcStreamLength: { max: 1 },
    }]).failures[0]).toContain('exceeds max');
  });

  it('reports unsupported assertion kinds', () => {
    const outcome = evaluateGrpcWorkflowAssertions(unary, [{
      unknownKind: true,
    } as unknown as GrpcWorkflowAssertion]);
    expect(outcome.failures[0]).toContain('unsupported assertion kind');
  });

  it('uses stable stringify fallback for circular values in equals', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const outcome = evaluateGrpcWorkflowAssertions({
      ...unary,
      body: { circular },
    }, [{
      grpcField: '$.circular',
      equals: { other: true },
    }]);
    expect(outcome.passed).toBe(false);
  });

  it('passes grpcField exists, grpcTrailer exists, and stream length min rules', () => {
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.message',
      exists: true,
    }]).passed).toBe(true);

    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcTrailer: 'grpc-status',
      exists: true,
    }]).passed).toBe(true);

    expect(evaluateGrpcWorkflowAssertions(stream, [{
      grpcStreamLength: { min: 2, max: 5 },
    }]).passed).toBe(true);
  });

  it('evaluates nested array contains via recursive valueContains', () => {
    expect(evaluateGrpcWorkflowAssertions({
      ...unary,
      body: { groups: [{ tags: ['alpha'] }] },
    }, [{
      grpcField: '$.groups',
      contains: 'alpha',
    }]).passed).toBe(true);
  });

  it('uses direct trailer key match before case-insensitive lookup', () => {
    expect(evaluateGrpcWorkflowAssertions({
      ...unary,
      trailers: { 'x-trace': 'direct' },
    }, [{
      grpcTrailer: 'x-trace',
      equals: 'direct',
    }]).passed).toBe(true);
  });
});

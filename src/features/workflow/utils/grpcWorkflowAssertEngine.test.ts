import { describe, expect, it } from 'vitest';
import { evaluateGrpcWorkflowAssertions } from './grpcWorkflowAssertEngine';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

const unary: GrpcWorkflowStepResult = {
  nodeId: 'u1',
  callType: 'unary',
  status: 'success',
  grpcStatus: 0,
  grpcStatusMessage: 'OK',
  durationMs: 25,
  body: { message: 'hello', code: 42 },
  trailers: { 'x-trace': 'abc' },
};

const stream: GrpcWorkflowStepResult = {
  nodeId: 's1',
  callType: 'server_streaming',
  status: 'success',
  grpcStatus: 0,
  messages: [{ n: 1 }, { n: 2 }, { n: 3 }],
  durationMs: 100,
};

describe('evaluateGrpcWorkflowAssertions', () => {
  it('passes grpcStatus assertion', () => {
    const outcome = evaluateGrpcWorkflowAssertions(unary, [{ grpcStatus: 0 }]);
    expect(outcome.passed).toBe(true);
  });

  it('fails grpcStatus assertion with clear message', () => {
    const outcome = evaluateGrpcWorkflowAssertions(unary, [{ grpcStatus: 3 }]);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures[0]).toContain('grpcStatus expected 3');
  });

  it('evaluates grpcField equals, contains, and exists', () => {
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.message',
      equals: 'hello',
    }]).passed).toBe(true);
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.message',
      contains: 'ell',
    }]).passed).toBe(true);
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcField: '$.missing',
      exists: false,
    }]).passed).toBe(true);
  });

  it('evaluates grpcTrailer assertions', () => {
    const outcome = evaluateGrpcWorkflowAssertions(unary, [{
      grpcTrailer: 'x-trace',
      equals: 'abc',
    }]);
    expect(outcome.passed).toBe(true);
  });

  it('matches grpcTrailer keys case-insensitively', () => {
    const outcome = evaluateGrpcWorkflowAssertions(unary, [{
      grpcTrailer: 'X-Trace',
      equals: 'abc',
    }]);
    expect(outcome.passed).toBe(true);
  });

  it('evaluates grpcDuration min/max', () => {
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcDuration: { min: 10, max: 50 },
    }]).passed).toBe(true);
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcDuration: { max: 10 },
    }]).passed).toBe(false);
  });

  it('evaluates grpcStreamLength on server stream results', () => {
    expect(evaluateGrpcWorkflowAssertions(stream, [{
      grpcStreamLength: { equals: 3 },
    }]).passed).toBe(true);
    expect(evaluateGrpcWorkflowAssertions(unary, [{
      grpcStreamLength: { min: 1 },
    }]).passed).toBe(false);
  });

  it('collects multiple failures', () => {
    const outcome = evaluateGrpcWorkflowAssertions(unary, [
      { grpcStatus: 3 },
      { grpcField: '$.message', equals: 'bye' },
    ]);
    expect(outcome.failures).toHaveLength(2);
  });
});

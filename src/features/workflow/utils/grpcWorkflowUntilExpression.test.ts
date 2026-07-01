import { describe, expect, it } from 'vitest';
import { evaluateGrpcStreamUntilExpression } from './grpcWorkflowUntilExpression';

describe('evaluateGrpcStreamUntilExpression', () => {
  it('matches equality on json path', () => {
    expect(evaluateGrpcStreamUntilExpression('$.message == "done"', { message: 'done' })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.message == "done"', { message: 'pending' })).toBe(false);
  });

  it('matches numeric comparisons', () => {
    expect(evaluateGrpcStreamUntilExpression('$.count >= 3', { count: 3 })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.count > 3', { count: 3 })).toBe(false);
  });

  it('returns false for invalid expressions', () => {
    expect(evaluateGrpcStreamUntilExpression('', { ok: true })).toBe(false);
    expect(evaluateGrpcStreamUntilExpression('not-a-dsl', { ok: true })).toBe(false);
  });
});

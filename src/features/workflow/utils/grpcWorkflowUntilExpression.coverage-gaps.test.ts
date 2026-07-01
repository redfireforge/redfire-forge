/**
 * Coverage gaps — grpcWorkflowUntilExpression.ts
 */
import { describe, expect, it } from 'vitest';
import { evaluateGrpcStreamUntilExpression } from './grpcWorkflowUntilExpression';

describe('grpcWorkflowUntilExpression coverage gaps', () => {
  it('evaluates != operator', () => {
    expect(evaluateGrpcStreamUntilExpression('$.phase != "done"', { phase: 'pending' })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.phase != "done"', { phase: 'done' })).toBe(false);
  });

  it('evaluates < and <= operators', () => {
    expect(evaluateGrpcStreamUntilExpression('$.count < 5', { count: 4 })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.count <= 5', { count: 5 })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.count < 5', { count: 5 })).toBe(false);
  });

  it('evaluates > operator', () => {
    expect(evaluateGrpcStreamUntilExpression('$.count > 2', { count: 3 })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.count > 2', { count: 2 })).toBe(false);
  });

  it('parses boolean and numeric expected values', () => {
    expect(evaluateGrpcStreamUntilExpression('$.ready == true', { ready: true })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.ready == false', { ready: false })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.ratio == 1.5', { ratio: 1.5 })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.ratio == -2', { ratio: -2 })).toBe(true);
  });

  it('parses quoted string literals with single and double quotes', () => {
    expect(evaluateGrpcStreamUntilExpression(`$.label == "done"`, { label: 'done' })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression(`$.label == 'done'`, { label: 'done' })).toBe(true);
  });

  it('coerces numeric strings for == comparisons', () => {
    expect(evaluateGrpcStreamUntilExpression('$.count == 3', { count: '3' })).toBe(true);
    expect(evaluateGrpcStreamUntilExpression('$.count == 3', { count: 'not-a-number' })).toBe(false);
  });

  it('returns false for non-numeric relational comparisons', () => {
    expect(evaluateGrpcStreamUntilExpression('$.value > 1', { value: 'abc' })).toBe(false);
  });

  it('returns false for unknown relational operators', () => {
    expect(evaluateGrpcStreamUntilExpression('$.value <> 1', { value: 2 })).toBe(false);
  });

  it('matches unquoted bare expected tokens', () => {
    expect(evaluateGrpcStreamUntilExpression('$.phase == pending', { phase: 'pending' })).toBe(true);
  });
});

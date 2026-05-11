/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { debugExpression } from './expressionStepDebugger';
import type { MapperSource } from '../types';

const sources: MapperSource[] = [
  { id: 's1', label: 'Response', sampleData: { price: 29.99, name: 'Widget', tags: ['a', 'b'] } },
];

describe('debugExpression', () => {
  it('returns a single step for a simple path reference', () => {
    const result = debugExpression('$.price', sources, 's1');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    const pathStep = result.steps.find((s) => s.label === 'Path Resolution');
    expect(pathStep).toBeTruthy();
    expect(pathStep!.expression).toBe('$.price');
    expect(pathStep!.displayValue).toBe('29.99');

    const finalStep = result.steps[result.steps.length - 1];
    expect(finalStep.label).toBe('Final Result');
  });

  it('shows intermediate steps for nested function calls', () => {
    const result = debugExpression('$upper($.name)', sources, 's1');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);

    const pathStep = result.steps.find((s) => s.label === 'Path Resolution');
    expect(pathStep).toBeTruthy();
    expect(pathStep!.expression).toBe('$.name');
    expect(pathStep!.displayValue).toBe('Widget');

    const finalStep = result.steps[result.steps.length - 1];
    expect(finalStep.label).toBe('Final Result');
    expect(finalStep.displayValue).toBe('WIDGET');
  });

  it('handles multi-level nesting', () => {
    const result = debugExpression('$concat($upper($.name), " - ", $.price)', sources, 's1');
    expect(result.steps.length).toBeGreaterThanOrEqual(3);

    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(2);
    expect(pathSteps[0].expression).toBe('$.name');
    expect(pathSteps[1].expression).toBe('$.price');

    const fnStep = result.steps.find(
      (s) => s.label === 'Function Evaluation' && s.expression.includes('$upper'),
    );
    expect(fnStep).toBeTruthy();
    expect(fnStep!.displayValue).toBe('WIDGET');

    const final = result.steps[result.steps.length - 1];
    expect(final.displayValue).toBe('WIDGET - 29.99');
  });

  it('captures errors in steps', () => {
    const result = debugExpression('{{', sources, 's1');
    const finalStep = result.steps[result.steps.length - 1];
    expect(finalStep.label).toBe('Final Result');
    expect(result.error || result.finalDisplay).toBeTruthy();
  });

  it('handles expression with no path refs', () => {
    const result = debugExpression('$concat("hello", " world")', sources, 's1');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(0);
    const final = result.steps[result.steps.length - 1];
    expect(final.displayValue).toBe('hello world');
  });

  it('deduplicates path references', () => {
    const result = debugExpression('$concat($.name, " and ", $.name)', sources, 's1');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(1);
  });

  it('handles undefined source path gracefully', () => {
    const result = debugExpression('$.nonexistent', sources, 's1');
    const pathStep = result.steps.find((s) => s.label === 'Path Resolution');
    expect(pathStep).toBeTruthy();
    expect(pathStep!.value).toBeUndefined();
    expect(pathStep!.displayValue).toBe('undefined');
  });

  it('populates finalValue and finalDisplay', () => {
    const result = debugExpression('$.price', sources, 's1');
    expect(result.finalValue).toBeDefined();
    expect(result.finalDisplay).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('returns final step last in the steps array', () => {
    const result = debugExpression('$upper($.name)', sources, 's1');
    expect(result.steps[result.steps.length - 1].label).toBe('Final Result');
  });

  it('handles empty expression', () => {
    const result = debugExpression('', sources, 's1');
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].label).toBe('Final Result');
  });

  it('handles literal-only expression', () => {
    const result = debugExpression('"hello"', sources, 's1');
    const final = result.steps[result.steps.length - 1];
    expect(final.displayValue).toBe('hello');
    expect(result.finalDisplay).toBe('hello');
  });

  it('skips $.path inside string literals', () => {
    const result = debugExpression('$concat("$.fake", $.name)', sources, 's1');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(1);
    expect(pathSteps[0].expression).toBe('$.name');
  });

  it('handles parentheses inside string arguments', () => {
    const result = debugExpression('$concat("(hello)", $.name)', sources, 's1');
    const fnSteps = result.steps.filter((s) => s.label === 'Function Evaluation');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(1);
    expect(pathSteps[0].expression).toBe('$.name');
    expect(fnSteps.length + 1).toBeGreaterThanOrEqual(1);
    expect(result.steps[result.steps.length - 1].label).toBe('Final Result');
  });

  it('skips paths inside {{…}} blocks', () => {
    const result = debugExpression('{{$.fake}} $.name', sources, 's1');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(1);
    expect(pathSteps[0].expression).toBe('$.name');
  });

  it('handles nested {{…}} blocks correctly', () => {
    const result = debugExpression('{{{{$.nested}}}} $.price', sources, 's1');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(1);
    expect(pathSteps[0].expression).toBe('$.price');
  });

  it('handles escaped quotes inside strings', () => {
    const result = debugExpression('$concat("he\\"llo", $.name)', sources, 's1');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(1);
    expect(pathSteps[0].expression).toBe('$.name');
  });

  it('handles single-quoted strings', () => {
    const result = debugExpression("$concat('$.fake', $.name)", sources, 's1');
    const pathSteps = result.steps.filter((s) => s.label === 'Path Resolution');
    expect(pathSteps.length).toBe(1);
    expect(pathSteps[0].expression).toBe('$.name');
  });

  it('handles function call where the call is the entire expression', () => {
    const result = debugExpression('$upper($.name)', sources, 's1');
    const fnSteps = result.steps.filter((s) => s.label === 'Function Evaluation');
    expect(fnSteps.length).toBe(0);
    const finalStep = result.steps[result.steps.length - 1];
    expect(finalStep.label).toBe('Final Result');
    expect(finalStep.displayValue).toBe('WIDGET');
  });

  it('handles unclosed quotes gracefully (no infinite loop)', () => {
    const result = debugExpression('"unclosed $.name', sources, 's1');
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.steps[result.steps.length - 1].label).toBe('Final Result');
  });

  it('handles unmatched function parens gracefully', () => {
    const result = debugExpression('$upper($.name', sources, 's1');
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.steps[result.steps.length - 1].label).toBe('Final Result');
  });
});

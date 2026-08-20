import { describe, it, expect } from 'vitest';
import { cliErrorPoliciesLesson } from './cli-error-policies';

describe('cli-error-policies lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliErrorPoliciesLesson.id).toBe('cli-error-policies');
    expect(cliErrorPoliciesLesson.domainId).toBe('cli');
    expect(cliErrorPoliciesLesson.category).toBe('execution');
    expect(cliErrorPoliciesLesson.estimatedMinutes).toBe(5);
    expect(cliErrorPoliciesLesson.desktopOnly).toBe(false);
    expect(cliErrorPoliciesLesson.initialTab).toBeUndefined();
    expect(cliErrorPoliciesLesson.steps.map(s => s.id)).toEqual([
      'cli4-continue',
      'cli4-stop-first',
      'cli4-stop-threshold',
      'cli4-fail-on-error',
      'cli4-fail-threshold',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliErrorPoliciesLesson.concept.title).toBe('Error Policies & CI Gating');
    expect(cliErrorPoliciesLesson.concept.keyTerms?.length).toBe(3);
    expect(cliErrorPoliciesLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliErrorPoliciesLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliErrorPoliciesLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('circuit-breaker policies progressively reduce the total requests run', () => {
    const cont = cliErrorPoliciesLesson.steps.find(s => s.id === 'cli4-continue');
    const stopFirst = cliErrorPoliciesLesson.steps.find(s => s.id === 'cli4-stop-first');
    const stopThreshold = cliErrorPoliciesLesson.steps.find(s => s.id === 'cli4-stop-threshold');
    expect(cont?.terminalOutput).toContain('Total:        25');
    expect(stopFirst?.terminalOutput).toContain('Total:        12');
    expect(stopThreshold?.terminalOutput).toContain('Total:        10');
  });

  it('captures the real gotcha: --fail-on-error is what changes the exit code, not the summary', () => {
    const failOnError = cliErrorPoliciesLesson.steps.find(s => s.id === 'cli4-fail-on-error');
    expect(failOnError?.terminalOutput).toContain('exit: 0');
    expect(failOnError?.terminalOutput).toContain('exit: 1');
    expect((failOnError?.terminalOutput?.match(/FAILED ❌/g) ?? []).length).toBe(2);
  });

  it('fail-threshold prints its explanation line even under -q', () => {
    const failThreshold = cliErrorPoliciesLesson.steps.find(s => s.id === 'cli4-fail-threshold');
    expect(failThreshold?.terminalCommand).toContain('-q');
    expect(failThreshold?.terminalOutput).toContain('Error rate 20% exceeds threshold 5%');
    expect(failThreshold?.terminalOutput).toContain('exit: 1');
  });
});

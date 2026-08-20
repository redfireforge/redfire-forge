import { describe, it, expect } from 'vitest';
import { cliBaselineRegressionLesson } from './cli-baseline-regression';

describe('cli-baseline-regression lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliBaselineRegressionLesson.id).toBe('cli-baseline-regression');
    expect(cliBaselineRegressionLesson.domainId).toBe('cli');
    expect(cliBaselineRegressionLesson.category).toBe('reliability');
    expect(cliBaselineRegressionLesson.estimatedMinutes).toBe(6);
    expect(cliBaselineRegressionLesson.desktopOnly).toBe(false);
    expect(cliBaselineRegressionLesson.initialTab).toBeUndefined();
    expect(cliBaselineRegressionLesson.steps.map(s => s.id)).toEqual([
      'cli8-fast-mock',
      'cli8-save-baseline',
      'cli8-slow-mock',
      'cli8-compare-latest',
      'cli8-fail-on-regression',
      'cli8-comparison-report',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliBaselineRegressionLesson.concept.title).toBe('Baselines & Regression Detection');
    expect(cliBaselineRegressionLesson.concept.keyTerms?.length).toBe(2);
    expect(cliBaselineRegressionLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliBaselineRegressionLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliBaselineRegressionLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('demonstrates a saved baseline and a detected regression', () => {
    const save = cliBaselineRegressionLesson.steps.find(s => s.id === 'cli8-save-baseline');
    expect(save?.terminalOutput).toContain('Baseline saved (pre-change)');

    const compare = cliBaselineRegressionLesson.steps.find(s => s.id === 'cli8-compare-latest');
    expect(compare?.terminalOutput).toContain('Performance Regression Report');
    expect(compare?.terminalOutput).toContain('🔴 CRITICAL');
  });

  it('demonstrates the exit code priority: 2 for regression alone, 3 for regression + failure', () => {
    const fail = cliBaselineRegressionLesson.steps.find(s => s.id === 'cli8-fail-on-regression');
    expect(fail?.terminalOutput).toContain('exit: 2');
    expect(fail?.terminalOutput).toContain('exit: 3');
    expect(fail?.terminalOutput).toContain('Result:       FAILED ❌');
  });

  it('comparison-report markdown includes a dedicated Regressions table', () => {
    const report = cliBaselineRegressionLesson.steps.find(s => s.id === 'cli8-comparison-report');
    expect(report?.terminalOutput).toContain('## Metric Deltas');
    expect(report?.terminalOutput).toContain('## Regressions');
  });
});

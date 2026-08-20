import { describe, it, expect } from 'vitest';
import { cliQuickStartLesson } from './cli-quick-start';

describe('cli-quick-start lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliQuickStartLesson.id).toBe('cli-quick-start');
    expect(cliQuickStartLesson.domainId).toBe('cli');
    expect(cliQuickStartLesson.category).toBe('getting-started');
    expect(cliQuickStartLesson.estimatedMinutes).toBe(5);
    expect(cliQuickStartLesson.desktopOnly).toBe(false);
    expect(cliQuickStartLesson.initialTab).toBeUndefined();
    expect(cliQuickStartLesson.steps.map(s => s.id)).toEqual([
      'cli1-install-options',
      'cli2-verify',
      'cli3-first-run',
      'cli4-read-summary',
      'cli5-exit-codes',
    ]);
  });

  it('has a concept slide with key terms', () => {
    expect(cliQuickStartLesson.concept.title).toBe('The RedfireForge CLI');
    expect(cliQuickStartLesson.concept.keyTerms?.length).toBeGreaterThan(0);
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliQuickStartLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliQuickStartLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('captures real PASSED and FAILED runs with matching exit codes', () => {
    const firstRun = cliQuickStartLesson.steps.find(s => s.id === 'cli3-first-run');
    expect(firstRun?.terminalOutput).toContain('Result:       PASSED ✅');

    const exitCodes = cliQuickStartLesson.steps.find(s => s.id === 'cli5-exit-codes');
    expect(exitCodes?.terminalOutput).toContain('exit: 0');
    expect(exitCodes?.terminalOutput).toContain('Result:       FAILED ❌');
    expect(exitCodes?.terminalOutput).toContain('exit: 1');
  });
});

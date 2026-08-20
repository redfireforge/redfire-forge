import { describe, it, expect } from 'vitest';
import { cliExecutionModesLesson } from './cli-execution-modes';

describe('cli-execution-modes lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliExecutionModesLesson.id).toBe('cli-execution-modes');
    expect(cliExecutionModesLesson.domainId).toBe('cli');
    expect(cliExecutionModesLesson.category).toBe('execution');
    expect(cliExecutionModesLesson.estimatedMinutes).toBe(6);
    expect(cliExecutionModesLesson.desktopOnly).toBe(false);
    expect(cliExecutionModesLesson.initialTab).toBeUndefined();
    expect(cliExecutionModesLesson.steps.map(s => s.id)).toEqual([
      'cli3-concurrency-iterations',
      'cli3-sequential',
      'cli3-batch-pool',
      'cli3-load-profile',
      'cli3-timeout-retries',
      'cli3-recap',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliExecutionModesLesson.concept.title).toBe('Execution Modes & Concurrency');
    expect(cliExecutionModesLesson.concept.keyTerms?.length).toBe(4);
    expect(cliExecutionModesLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliExecutionModesLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliExecutionModesLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('demonstrates the sequential-mode concurrency-header fix (C:1, not the file\'s C:5)', () => {
    const sequential = cliExecutionModesLesson.steps.find(s => s.id === 'cli3-sequential');
    expect(sequential?.terminalOutput).toContain('Mode:         sequential (C:1 I:3)');
  });

  it('load-profile step is time-boxed, not iteration-boxed', () => {
    const loadProfile = cliExecutionModesLesson.steps.find(s => s.id === 'cli3-load-profile');
    expect(loadProfile?.terminalOutput).toContain('Mode:         load-profile');
    expect(loadProfile?.terminalCommand).toContain('--duration');
  });

  it('captures the real gotcha: FAILED result still exits 0 without --fail-on-error', () => {
    const timeoutStep = cliExecutionModesLesson.steps.find(s => s.id === 'cli3-timeout-retries');
    expect(timeoutStep?.terminalOutput).toContain('Result:       FAILED ❌');
    expect(timeoutStep?.terminalOutput).toContain('exit: 0');
    expect(timeoutStep?.terminalCommand).not.toContain('--fail-on-error');
  });

  it('recap step has no live command, only a comment cheat sheet', () => {
    const recap = cliExecutionModesLesson.steps.find(s => s.id === 'cli3-recap');
    expect(recap?.terminalCommand).toBeUndefined();
    expect(recap?.terminalOutput).toContain('# pool');
  });
});

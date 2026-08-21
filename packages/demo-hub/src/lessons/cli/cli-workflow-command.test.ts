import { describe, it, expect } from 'vitest';
import { cliWorkflowCommandLesson } from './cli-workflow-command';

describe('cli-workflow-command lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliWorkflowCommandLesson.id).toBe('cli-workflow-command');
    expect(cliWorkflowCommandLesson.domainId).toBe('cli');
    expect(cliWorkflowCommandLesson.category).toBe('execution');
    expect(cliWorkflowCommandLesson.estimatedMinutes).toBe(6);
    expect(cliWorkflowCommandLesson.desktopOnly).toBe(false);
    expect(cliWorkflowCommandLesson.initialTab).toBeUndefined();
    expect(cliWorkflowCommandLesson.steps.map(s => s.id)).toEqual([
      'cli9-workflow-file',
      'cli9-run-workflow',
      'cli9-vars',
      'cli9-parallel',
      'cli9-workflow-reports',
      'cli9-trace-output',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliWorkflowCommandLesson.concept.title).toBe('Workflow Performance Testing');
    expect(cliWorkflowCommandLesson.concept.keyTerms?.length).toBe(2);
    expect(cliWorkflowCommandLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliWorkflowCommandLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliWorkflowCommandLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('demonstrates Total Steps counting nodes-per-iteration, not iterations', () => {
    const step2 = cliWorkflowCommandLesson.steps.find(s => s.id === 'cli9-run-workflow');
    expect(step2?.terminalOutput).toContain('Total Steps:  40');
  });

  it('demonstrates the fixed conditional branching (BUG-8) for both country values', () => {
    const step3 = cliWorkflowCommandLesson.steps.find(s => s.id === 'cli9-vars');
    expect(step3?.terminalOutput).toContain('European Country');
    expect(step3?.terminalOutput).toContain('Asian Country');
  });

  it('demonstrates fork/join producing 200 steps across all 4 nodes', () => {
    const step4 = cliWorkflowCommandLesson.steps.find(s => s.id === 'cli9-parallel');
    expect(step4?.terminalOutput).toContain('Total Steps:  200');
    for (const node of ['Get User', 'Get Posts', 'Get Todos', 'Get Albums']) {
      expect(step4?.terminalOutput).toContain(node);
    }
  });

  it('demonstrates the fixed --trace-output (BUG-9): full vs standard capture levels differ', () => {
    const step6 = cliWorkflowCommandLesson.steps.find(s => s.id === 'cli9-trace-output');
    expect(step6?.terminalOutput).toContain('"request"');
    expect(step6?.terminalOutput).toContain('no "request" / "response" keys at all');
  });
});

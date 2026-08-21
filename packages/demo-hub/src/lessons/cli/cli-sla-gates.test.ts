import { describe, it, expect } from 'vitest';
import { cliSlaGatesLesson } from './cli-sla-gates';

describe('cli-sla-gates lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliSlaGatesLesson.id).toBe('cli-sla-gates');
    expect(cliSlaGatesLesson.domainId).toBe('cli');
    expect(cliSlaGatesLesson.category).toBe('reliability');
    expect(cliSlaGatesLesson.estimatedMinutes).toBe(5);
    expect(cliSlaGatesLesson.desktopOnly).toBe(false);
    expect(cliSlaGatesLesson.initialTab).toBeUndefined();
    expect(cliSlaGatesLesson.steps.map(s => s.id)).toEqual([
      'cli7-sla-shape',
      'cli7-run-with-sla',
      'cli7-tighten-sla',
      'cli7-fail-on-sla',
      'cli7-priority',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliSlaGatesLesson.concept.title).toBe('SLA Targets as Quality Gates');
    expect(cliSlaGatesLesson.concept.keyTerms?.length).toBe(2);
    expect(cliSlaGatesLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliSlaGatesLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliSlaGatesLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('demonstrates the deterministically-failing Create Post TPS target', () => {
    const step2 = cliSlaGatesLesson.steps.find(s => s.id === 'cli7-run-with-sla');
    expect(step2?.terminalOutput).toContain('✗ Create Post TPS');
    expect(step2?.terminalOutput).toContain('1 violation, 7 passing');
  });

  it('demonstrates all three SLA states (pass, warn, fail) together', () => {
    const step3 = cliSlaGatesLesson.steps.find(s => s.id === 'cli7-tighten-sla');
    expect(step3?.terminalOutput).toContain('✓ ');
    expect(step3?.terminalOutput).toContain('⚠ Posts P95');
    expect(step3?.terminalOutput).toContain('✗ Users P95');
  });

  it('demonstrates --fail-on-sla producing exit code 4', () => {
    const step4 = cliSlaGatesLesson.steps.find(s => s.id === 'cli7-fail-on-sla');
    expect(step4?.terminalOutput).toContain('Result:       PASSED ✅');
    expect(step4?.terminalOutput).toContain('exit: 4');
  });

  it('recap step lists the real exit code priority order', () => {
    const recap = cliSlaGatesLesson.steps.find(s => s.id === 'cli7-priority');
    expect(recap?.terminalOutput).toContain('4 = SLA failure');
    expect(recap?.terminalOutput).toContain('1 = plain test failure');
  });
});

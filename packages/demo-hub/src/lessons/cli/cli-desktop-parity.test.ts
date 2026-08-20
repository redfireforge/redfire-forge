import { describe, it, expect } from 'vitest';
import { cliDesktopParityLesson } from './cli-desktop-parity';

describe('cli-desktop-parity lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliDesktopParityLesson.id).toBe('cli-desktop-parity');
    expect(cliDesktopParityLesson.domainId).toBe('cli');
    expect(cliDesktopParityLesson.category).toBe('getting-started');
    expect(cliDesktopParityLesson.estimatedMinutes).toBe(4);
    expect(cliDesktopParityLesson.desktopOnly).toBe(true);
    expect(cliDesktopParityLesson.initialTab).toBeUndefined();
    expect(cliDesktopParityLesson.steps.map(s => s.id)).toEqual([
      'cli11-cli-flag',
      'cli11-install-symlink',
      'cli11-full-parity',
      'cli11-mock-gap',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliDesktopParityLesson.concept.title).toBe('Desktop App CLI Mode');
    expect(cliDesktopParityLesson.concept.keyTerms?.length).toBe(3);
    expect(cliDesktopParityLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliDesktopParityLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliDesktopParityLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('demonstrates --cli producing the same PASSED output as the npm CLI', () => {
    const step1 = cliDesktopParityLesson.steps.find(s => s.id === 'cli11-cli-flag');
    expect(step1?.terminalOutput).toContain('Total:        9');
    expect(step1?.terminalOutput).toContain('Result:       PASSED ✅');
  });

  it('demonstrates the fixed BUG-10 SLA flag parity producing exit code 4', () => {
    const step3 = cliDesktopParityLesson.steps.find(s => s.id === 'cli11-full-parity');
    expect(step3?.terminalOutput).toContain('SLA Evaluation:');
    expect(step3?.terminalOutput).toContain('exit: 4');
  });

  it('demonstrates the real mock gap: unrecognized subcommand, exit code 2', () => {
    const step4 = cliDesktopParityLesson.steps.find(s => s.id === 'cli11-mock-gap');
    expect(step4?.terminalOutput).toContain("unrecognized subcommand 'mock'");
    expect(step4?.terminalOutput).toContain('exit: 2');
  });
});

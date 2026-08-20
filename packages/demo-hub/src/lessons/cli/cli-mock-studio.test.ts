import { describe, it, expect } from 'vitest';
import { cliMockStudioLesson } from './cli-mock-studio';

describe('cli-mock-studio lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliMockStudioLesson.id).toBe('cli-mock-studio');
    expect(cliMockStudioLesson.domainId).toBe('cli');
    expect(cliMockStudioLesson.category).toBe('reliability');
    expect(cliMockStudioLesson.estimatedMinutes).toBe(7);
    expect(cliMockStudioLesson.desktopOnly).toBe(false);
    expect(cliMockStudioLesson.initialTab).toBeUndefined();
    expect(cliMockStudioLesson.steps.map(s => s.id)).toEqual([
      'cli10-workspace-file',
      'cli10-simulate',
      'cli10-start-standalone',
      'cli10-verify-simulate',
      'cli10-verify-live',
      'cli10-docker',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliMockStudioLesson.concept.title).toBe('API Mock Studio, Headless');
    expect(cliMockStudioLesson.concept.keyTerms?.length).toBe(2);
    expect(cliMockStudioLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliMockStudioLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliMockStudioLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('demonstrates mock simulate producing an offline, zero-network trace', () => {
    const step2 = cliMockStudioLesson.steps.find(s => s.id === 'cli10-simulate');
    expect(step2?.terminalOutput).toContain('"outcome": "matched"');
    expect(step2?.terminalOutput).toContain('Simulated 1 sample(s); 0 failure(s).');
  });

  it('demonstrates the passing and deliberately-failing verify --simulate cases', () => {
    const step4 = cliMockStudioLesson.steps.find(s => s.id === 'cli10-verify-simulate');
    expect(step4?.terminalOutput).toContain('exit: 0');
    expect(step4?.terminalOutput).toContain('Expected at least 5 samples, got 1');
    expect(step4?.terminalOutput).toContain('exit: 1');
  });

  it('demonstrates the NOTE-4 gotcha: live-journal verify only works against companion mode', () => {
    const step5 = cliMockStudioLesson.steps.find(s => s.id === 'cli10-verify-live');
    expect(step5?.terminalOutput).toContain('"mode": "companion"');
    expect(step5?.terminalOutput).toContain('Live journal: 1 matching call(s).');
    expect(step5?.terminalOutput).toContain('fetch failed');
  });

  it('docker step reflects the real committed Dockerfile CMD', () => {
    const step6 = cliMockStudioLesson.steps.find(s => s.id === 'cli10-docker');
    expect(step6?.terminalOutput).toContain('--standalone","--wait-ready');
    expect(step6?.terminalOutput).toContain('HEALTHCHECK');
  });
});

import { describe, it, expect } from 'vitest';
import { cliValidateAuthoringLesson } from './cli-validate-authoring';

describe('cli-validate-authoring lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliValidateAuthoringLesson.id).toBe('cli-validate-authoring');
    expect(cliValidateAuthoringLesson.domainId).toBe('cli');
    expect(cliValidateAuthoringLesson.category).toBe('getting-started');
    expect(cliValidateAuthoringLesson.estimatedMinutes).toBe(5);
    expect(cliValidateAuthoringLesson.desktopOnly).toBe(false);
    expect(cliValidateAuthoringLesson.initialTab).toBeUndefined();
    expect(cliValidateAuthoringLesson.steps.map(s => s.id)).toEqual([
      'cli2-anatomy',
      'cli2-validate-good',
      'cli2-validate-workflow',
      'cli2-break-it',
      'cli2-fix-and-confirm',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliValidateAuthoringLesson.concept.title).toBe('Validate Before You Run');
    expect(cliValidateAuthoringLesson.concept.keyTerms?.length).toBeGreaterThan(0);
    expect(cliValidateAuthoringLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliValidateAuthoringLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliValidateAuthoringLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('captures real valid and invalid validate output', () => {
    const goodFile = cliValidateAuthoringLesson.steps.find(s => s.id === 'cli2-validate-good');
    expect(goodFile?.terminalOutput).toContain('✅ Valid test file');

    const workflow = cliValidateAuthoringLesson.steps.find(s => s.id === 'cli2-validate-workflow');
    expect(workflow?.terminalOutput).toContain('✅ Valid workflow');

    const brokenFiles = cliValidateAuthoringLesson.steps.find(s => s.id === 'cli2-break-it');
    expect(brokenFiles?.terminalOutput).toContain('❌ Invalid');
    expect((brokenFiles?.terminalOutput?.match(/❌ Invalid/g) ?? []).length).toBe(2);

    const fixed = cliValidateAuthoringLesson.steps.find(s => s.id === 'cli2-fix-and-confirm');
    expect(fixed?.terminalOutput).toContain('✅ Valid test file');
  });
});

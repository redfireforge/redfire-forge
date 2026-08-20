import { describe, it, expect } from 'vitest';
import { cliDataDrivenLesson } from './cli-data-driven';

describe('cli-data-driven lesson', () => {
  it('has valid lesson structure', () => {
    expect(cliDataDrivenLesson.id).toBe('cli-data-driven');
    expect(cliDataDrivenLesson.domainId).toBe('cli');
    expect(cliDataDrivenLesson.category).toBe('data-and-ci');
    expect(cliDataDrivenLesson.estimatedMinutes).toBe(6);
    expect(cliDataDrivenLesson.desktopOnly).toBe(false);
    expect(cliDataDrivenLesson.initialTab).toBeUndefined();
    expect(cliDataDrivenLesson.steps.map(s => s.id)).toEqual([
      'cli5-inline-datasource',
      'cli5-external-csv',
      'cli5-scenario-filter',
      'cli5-row-tags',
      'cli5-scenario-tags',
      'cli5-data-rows-summary',
    ]);
  });

  it('has a concept slide with key terms and a diagram', () => {
    expect(cliDataDrivenLesson.concept.title).toBe('Data-Driven Testing — What Actually Works');
    expect(cliDataDrivenLesson.concept.keyTerms?.length).toBe(3);
    expect(cliDataDrivenLesson.concept.diagram).toContain('<svg');
  });

  it('every step is a terminal step (no DOM highlight/action)', () => {
    for (const step of cliDataDrivenLesson.steps) {
      expect(step.highlight).toBeUndefined();
      expect(step.action).toBeUndefined();
      expect(Boolean(step.terminalCommand || step.terminalOutput)).toBe(true);
    }
  });

  it('every terminalHighlightLines range is within bounds of its own terminalOutput', () => {
    for (const step of cliDataDrivenLesson.steps) {
      if (!step.terminalHighlightLines) continue;
      const lineCount = step.terminalOutput?.split('\n').length ?? 0;
      for (const [start, end] of step.terminalHighlightLines) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        expect(end).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it('demonstrates the fixed native dataSource: bug (6 rows x 6 iterations = 36 total)', () => {
    const step1 = cliDataDrivenLesson.steps.find(s => s.id === 'cli5-inline-datasource');
    expect(step1?.terminalOutput).toContain('[6 data rows]');
    expect(step1?.terminalOutput).toContain('Total:        36');
  });

  it('demonstrates clean CSV request params (no leaked _tags/_label metadata)', () => {
    const step2 = cliDataDrivenLesson.steps.find(s => s.id === 'cli5-external-csv');
    expect(step2?.terminalOutput).not.toContain('_tags=');
    expect(step2?.terminalOutput).toContain('Data Rows:    25 total, 25 passed, 0 failed');
  });

  it('demonstrates the dropped-scenario behavior for a fully-filtered test', () => {
    const step4 = cliDataDrivenLesson.steps.find(s => s.id === 'cli5-row-tags');
    expect(step4?.terminalOutput).toContain('Dropped: No Smoke Rows');
  });

  it('demonstrates the zero-match scenario-tags exit code', () => {
    const step5 = cliDataDrivenLesson.steps.find(s => s.id === 'cli5-scenario-tags');
    expect(step5?.terminalOutput).toContain('❌ No scenarios match the specified tags.');
    expect(step5?.terminalOutput).toContain('exit: 1');
  });

  it('data-rows-summary JSON includes totalRows/passedRows/failedRows', () => {
    const step6 = cliDataDrivenLesson.steps.find(s => s.id === 'cli5-data-rows-summary');
    expect(step6?.terminalOutput).toContain('"totalRows"');
    expect(step6?.terminalOutput).toContain('"passedRows"');
    expect(step6?.terminalOutput).toContain('"failedRows"');
  });
});

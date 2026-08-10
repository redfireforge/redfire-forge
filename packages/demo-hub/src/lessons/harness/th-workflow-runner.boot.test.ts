/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { thWorkflowRunnerLesson } from './th-workflow-runner';

const lessonSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'th-workflow-runner.ts'),
  'utf8',
);

describe('thWorkflowRunnerLesson boot surface', () => {
  it('seeds via prepareBeforeNavigate and keeps sidebar collapsed on Start', () => {
    expect(thWorkflowRunnerLesson.initialTab).toBe('workflow');
    expect(typeof thWorkflowRunnerLesson.prepareBeforeNavigate).toBe('function');
    expect(thWorkflowRunnerLesson.collapseAppSidebarOnStart).toBe(true);
    expect(thWorkflowRunnerLesson.estimatedMinutes).toBe(9);
    expect(thWorkflowRunnerLesson.steps).toHaveLength(7);
  });

  it('keeps designer tour, Run in Harness, and picker as separate beats', () => {
    const ids = thWorkflowRunnerLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'th21-designer-tour',
      'th21-run-in-harness',
      'th21-picker',
      'th21-variables',
      'th21-trace-config',
      'th21-correlation',
      'th21-run-button',
    ]);
    const tour = thWorkflowRunnerLesson.steps.find((s) => s.id === 'th21-designer-tour');
    const harness = thWorkflowRunnerLesson.steps.find((s) => s.id === 'th21-run-in-harness');
    const vars = thWorkflowRunnerLesson.steps.find((s) => s.id === 'th21-variables');
    expect(tour?.verify).toBeDefined();
    expect(harness?.highlight).toBeDefined();
    expect(vars?.description).toMatch(/Initial Variables/);
  });

  it('detects selected runner workflow via picker trigger, not summary', () => {
    // Summary is "N HTTP step(s)" — using it made every Preparing re-open the picker.
    expect(lessonSrc).toContain('WF_PICKER_TRIGGER');
    expect(lessonSrc).toMatch(/isRunnerWorkflowSelected/);
    expect(lessonSrc).not.toMatch(
      /WF_PICKER_SUMMARY[\s\S]{0,80}includes\(TH21_WORKFLOW_NAME\)/,
    );
  });
});

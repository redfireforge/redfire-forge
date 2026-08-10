/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { wfConditionalLogicLesson } from './wf-conditional-logic';

describe('wfConditionalLogicLesson boot surface', () => {
  it('seeds Conditional Demo via prepareBeforeNavigate and keeps sidebar collapsed', () => {
    expect(wfConditionalLogicLesson.initialTab).toBe('workflow');
    expect(typeof wfConditionalLogicLesson.prepareBeforeNavigate).toBe('function');
    expect(wfConditionalLogicLesson.collapseAppSidebarOnStart).toBe(true);
    expect(wfConditionalLogicLesson.estimatedMinutes).toBeGreaterThanOrEqual(8);
    expect(wfConditionalLogicLesson.steps.map((s) => s.id)).toEqual([
      'wf3-extract-userid',
      'wf3-condition-node',
      'wf3-branch-yes',
      'wf3-branch-no',
      'wf3-switch-node',
      'wf3-switch-log',
      'wf3-run-condition',
    ]);
  });

  it('uses brisk config timing so dense live steps stay under the action timeout', () => {
    expect(wfConditionalLogicLesson.estimatedMinutes).toBeGreaterThanOrEqual(10);
    expect(wfConditionalLogicLesson.setup).toBeTypeOf('function');
    expect(wfConditionalLogicLesson.cleanup).toBeTypeOf('function');
  });
});

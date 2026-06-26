import { describe, it, expect } from 'vitest';
import { isWorkflowDesignerLesson } from './workflowLessonUi';

describe('isWorkflowDesignerLesson', () => {
  it('returns true for workflow designer tab lessons', () => {
    expect(isWorkflowDesignerLesson({ initialTab: 'workflow' })).toBe(true);
  });

  it('returns false for other tabs', () => {
    expect(isWorkflowDesignerLesson({ initialTab: 'workflow-runner' })).toBe(false);
    expect(isWorkflowDesignerLesson({ initialTab: 'graphql-studio' })).toBe(false);
    expect(isWorkflowDesignerLesson({})).toBe(false);
  });
});

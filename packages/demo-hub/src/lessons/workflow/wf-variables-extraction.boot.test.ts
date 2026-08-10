/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { wfVariablesExtractionLesson } from './wf-variables-extraction';

describe('wfVariablesExtractionLesson boot surface', () => {
  it('seeds Variables Demo via prepareBeforeNavigate so Start skips a stale canvas', () => {
    expect(wfVariablesExtractionLesson.initialTab).toBe('workflow');
    expect(typeof wfVariablesExtractionLesson.prepareBeforeNavigate).toBe('function');
    expect(wfVariablesExtractionLesson.collapseAppSidebarOnStart).toBe(true);
  });
});

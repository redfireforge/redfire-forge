import { describe, it, expect } from 'vitest';
import { shouldExitLiveDemoForTabChange } from './liveDemoTabGuard';

describe('shouldExitLiveDemoForTabChange', () => {
  const lesson = {
    initialTab: 'workflow',
    allowedTabs: ['workflow', 'workflow-runner'],
  };

  it('returns false when re-selecting the same tab', () => {
    expect(shouldExitLiveDemoForTabChange('workflow', 'workflow', lesson)).toBe(false);
  });

  it('returns false for the lesson initial tab', () => {
    expect(shouldExitLiveDemoForTabChange('workflow', 'demo-hub', lesson)).toBe(false);
  });

  it('returns false for an allowed lesson tab', () => {
    expect(shouldExitLiveDemoForTabChange('workflow-runner', 'workflow', lesson)).toBe(false);
  });

  it('returns true when leaving to an unrelated tab', () => {
    expect(shouldExitLiveDemoForTabChange('requests', 'workflow', lesson)).toBe(true);
    expect(shouldExitLiveDemoForTabChange('test-runner', 'workflow', lesson)).toBe(true);
  });

  it('returns true when lesson has no tab hints', () => {
    expect(shouldExitLiveDemoForTabChange('requests', 'workflow', null)).toBe(true);
  });
});

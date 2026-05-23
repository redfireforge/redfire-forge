import { describe, it, expect } from 'vitest';
import { ONBOARDING_HINTS, ONBOARDING_STORAGE_KEY } from './onboardingHints';

describe('onboardingHints', () => {
  it('exports a non-empty array of hints', () => {
    expect(Array.isArray(ONBOARDING_HINTS)).toBe(true);
    expect(ONBOARDING_HINTS.length).toBeGreaterThan(0);
  });

  it('each hint has required fields', () => {
    for (const hint of ONBOARDING_HINTS) {
      expect(hint.id).toMatch(/^[\w-]+$/);
      expect(hint.target).toBeTruthy();
      expect(hint.title.length).toBeGreaterThan(0);
      expect(hint.message.length).toBeGreaterThan(0);
      expect(['top', 'bottom', 'left', 'right']).toContain(hint.placement);
      expect(['mount', 'first-node', 'empty-canvas']).toContain(hint.triggerOn);
      expect(typeof hint.priority).toBe('number');
    }
  });

  it('all hint IDs are unique', () => {
    const ids = ONBOARDING_HINTS.map(h => h.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('priorities are unique per trigger type', () => {
    const byTrigger = new Map<string, number[]>();
    for (const hint of ONBOARDING_HINTS) {
      const list = byTrigger.get(hint.triggerOn) ?? [];
      list.push(hint.priority);
      byTrigger.set(hint.triggerOn, list);
    }
    for (const [_trigger, priorities] of byTrigger) {
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBe(priorities.length);
    }
  });

  it('exports a storage key', () => {
    expect(ONBOARDING_STORAGE_KEY).toBe('redfire-onboarding-dismissed');
  });

  it('includes hints for different trigger types', () => {
    const triggers = new Set(ONBOARDING_HINTS.map(h => h.triggerOn));
    expect(triggers.has('mount')).toBe(true);
    expect(triggers.has('first-node')).toBe(true);
  });
});

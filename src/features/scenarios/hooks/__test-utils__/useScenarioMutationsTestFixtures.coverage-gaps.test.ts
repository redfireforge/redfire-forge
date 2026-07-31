/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../shared/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));

import {
  emptySnapshot,
  scenarioFixture,
  makeFg,
  setup,
  setupWithoutEnv,
  setupWithTrash,
} from './useScenarioMutationsTestFixtures';

describe('useScenarioMutationsTestFixtures coverage gaps', () => {
  it('builds snapshot/scenario/feature-group fixtures with overrides', () => {
    expect(emptySnapshot()).toEqual({
      name: '',
      url: '',
      method: 'GET',
      headers: [],
      body: '',
      auth: { type: 'none' },
    });

    const scenario = scenarioFixture({ id: 's2', method: 'POST' as const });
    expect(scenario.id).toBe('s2');
    expect(scenario.method).toBe('POST');

    const fg = makeFg({ id: 'fg-2', name: 'Feature 2' });
    expect(fg.id).toBe('fg-2');
    expect(fg.name).toBe('Feature 2');
  });

  it('setup wrappers expose mutable state updater branches', () => {
    const a = setup([makeFg({ id: 'fg-a' })]);
    const b = setupWithoutEnv([makeFg({ id: 'fg-b' })]);
    const c = setupWithTrash([makeFg({ id: 'fg-c' })]);

    // setup(): function updater branch.
    a.setFeatureGroups((prev) => [...prev, makeFg({ id: 'fg-a2' })]);
    expect(a.getFeatureGroups().map((x) => x.id)).toContain('fg-a2');

    // setup(): direct value branch.
    a.setFeatureGroups([makeFg({ id: 'fg-a3' })]);
    expect(a.getFeatureGroups().map((x) => x.id)).toEqual(['fg-a3']);

    // setupWithoutEnv(): direct value branch.
    b.setFeatureGroups([makeFg({ id: 'fg-b2' })]);
    expect(b.getFeatureGroups().map((x) => x.id)).toEqual(['fg-b2']);

    // setupWithoutEnv(): function updater branch.
    b.setFeatureGroups((prev) => [...prev, makeFg({ id: 'fg-b3' })]);
    expect(b.getFeatureGroups().map((x) => x.id)).toEqual(['fg-b2', 'fg-b3']);

    // setupWithTrash(): direct value branch.
    c.setFeatureGroups([makeFg({ id: 'fg-c2' })]);
    expect(c.getFeatureGroups().map((x) => x.id)).toEqual(['fg-c2']);

    // setupWithTrash(): function updater branch.
    c.setFeatureGroups((prev) => [...prev, makeFg({ id: 'fg-c3' })]);
    expect(c.getFeatureGroups().map((x) => x.id)).toEqual(['fg-c2', 'fg-c3']);

    expect(typeof c.moveToTrash).toBe('function');
    expect(typeof a.clearAuthVerifyResult).toBe('function');
    expect(typeof b.clearAuthVerifyResult).toBe('function');
  });
});

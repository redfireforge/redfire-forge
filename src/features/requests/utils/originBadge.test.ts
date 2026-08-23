import { describe, it, expect } from 'vitest';
import type { Scenario } from '@shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const makeScenario = (overrides?: Partial<Scenario>): Scenario =>
  _makeScenario({ id: 't1', name: 'Get Users', ...overrides });

describe('Origin badge display logic', () => {
  it('shows when sourceRequestId is set', () => {
    const scenario = makeScenario({
      sourceRequestId: 'req-1',
      sourceSpecVersionLabel: '1.0.7',
    });
    expect(scenario.sourceRequestId).toBeTruthy();
    const label = scenario.sourceSpecVersionLabel ? `v${scenario.sourceSpecVersionLabel}` : 'From Requests';
    expect(label).toBe('v1.0.7');
  });

  it('hides when no sourceRequestId', () => {
    const scenario = makeScenario({ sourceRequestId: undefined });
    expect(scenario.sourceRequestId).toBeFalsy();
  });

  it('shows "From Requests" when no version label', () => {
    const scenario = makeScenario({
      sourceRequestId: 'req-1',
      sourceSpecVersionLabel: undefined,
    });
    const label = scenario.sourceSpecVersionLabel ? `v${scenario.sourceSpecVersionLabel}` : 'From Requests';
    expect(label).toBe('From Requests');
  });

  it('counts promoted tests in a scenario', () => {
    const tests = [
      makeScenario({ sourceRequestId: 'req-1' }),
      makeScenario({ sourceRequestId: 'req-2' }),
      makeScenario({ sourceRequestId: undefined }),
    ];
    const fromReqs = tests.filter(t => t.sourceRequestId).length;
    expect(fromReqs).toBe(2);
  });
});

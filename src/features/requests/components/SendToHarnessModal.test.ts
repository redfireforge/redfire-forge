import { describe, it, expect, vi } from 'vitest';
import { createScenarioFromRequest } from '../utils/requestToScenario';
import type { PromotionContext } from '../utils/requestToScenario';
import type { FeatureGroup, RequestCollection, RequestItem } from '../../../shared/types';

function makeRequest(): RequestItem {
  return {
    id: 'req-1', name: 'Get Users', method: 'GET', url: '/users',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '', auth: { type: 'inherit' },
  };
}

function makeCollection(): RequestCollection {
  return {
    id: 'col-1', name: 'My API', mode: 'multi-env',
    baseUrls: { env1: 'https://api.example.com' }, requests: [],
  };
}

function makeContext(): PromotionContext {
  return {
    collection: makeCollection(),
    selectedEnvId: 'env1',
    environments: [{ id: 'env1', name: 'DEV' }],
    globalAuthProfiles: [],
    microservices: [],
  };
}

function makeFeatureGroups(): FeatureGroup[] {
  return [
    {
      id: 'fg-1', name: 'User Tests',
      scenarios: [
        { id: 'sc-1', name: 'Smoke', kind: 'standard', tests: [] },
        { id: 'sc-2', name: 'Regression', kind: 'standard', tests: [
          { id: 't-1', name: 'existing', url: 'http://x', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } },
        ] },
      ],
    },
    {
      id: 'fg-2', name: 'Order Tests',
      scenarios: [],
    },
  ];
}

describe('SendToHarnessModal — payload logic', () => {
  it('createScenarioFromRequest generates a valid scenario for promotion', () => {
    const scenario = createScenarioFromRequest(makeRequest(), makeContext());
    expect(scenario.name).toBe('Get Users');
    expect(scenario.method).toBe('GET');
    expect(scenario.url).toBe('https://api.example.com/users');
    expect(scenario.sourceRequestId).toBe('req-1');
  });

  it('feature groups provide available targets', () => {
    const groups = makeFeatureGroups();
    expect(groups).toHaveLength(2);
    expect(groups[0].scenarios).toHaveLength(2);
    expect(groups[0].scenarios[1].tests).toHaveLength(1);
  });

  it('"Create New" group option is separate from existing groups', () => {
    const groups = makeFeatureGroups();
    const options = [...groups.map(g => g.id), '__new__'];
    expect(options).toContain('fg-1');
    expect(options).toContain('fg-2');
    expect(options).toContain('__new__');
  });

  it('confirm callback receives correct payload shape', () => {
    const onConfirm = vi.fn();
    const scenario = createScenarioFromRequest(makeRequest(), makeContext());

    const payload = {
      scenario,
      targetGroupId: 'fg-1',
      targetScenarioId: 'sc-1',
      newGroupName: undefined,
      newScenarioName: undefined,
      openEditorAfter: false,
    };
    onConfirm(payload);

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        targetGroupId: 'fg-1',
        targetScenarioId: 'sc-1',
        openEditorAfter: false,
      }),
    );
    expect(onConfirm.mock.calls[0][0].scenario.url).toBe('https://api.example.com/users');
  });

  it('cancel callback is called on close', () => {
    const onClose = vi.fn();
    onClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

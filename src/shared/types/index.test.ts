import { describe, it, expect } from 'vitest';
import type { TestScenario, Scenario, RequestResult, FeatureGroup } from './index';
import { isParameterizedScenario } from './index';

// ── 1A.4 — Type round-trip tests ────────────────────────────

describe('TestScenario.tags', () => {
  it('accepts a tags array', () => {
    const sc: TestScenario = {
      id: 'sc-1',
      name: 'Smoke Suite',
      kind: 'standard',
      tags: ['smoke', 'regression'],
      tests: [],
    };
    expect(sc.tags).toEqual(['smoke', 'regression']);
  });

  it('works without tags (backward compatibility)', () => {
    const sc: TestScenario = {
      id: 'sc-2',
      name: 'Legacy Suite',
      kind: 'standard',
      tests: [],
    };
    expect(sc.tags).toBeUndefined();
  });

  it('accepts an empty tags array', () => {
    const sc: TestScenario = {
      id: 'sc-3',
      name: 'Empty Tags',
      kind: 'standard',
      tags: [],
      tests: [],
    };
    expect(sc.tags).toEqual([]);
  });
});

describe('Scenario.scenarioTags', () => {
  it('accepts scenarioTags transient field', () => {
    const scenario: Partial<Scenario> & { id: string; name: string } = {
      id: 'test-1',
      name: 'GET /users',
      scenarioTags: ['smoke', 'critical'],
    };
    expect(scenario.scenarioTags).toEqual(['smoke', 'critical']);
  });

  it('works without scenarioTags', () => {
    const scenario: Partial<Scenario> & { id: string; name: string } = {
      id: 'test-2',
      name: 'POST /login',
    };
    expect(scenario.scenarioTags).toBeUndefined();
  });
});

describe('RequestResult.scenarioTags', () => {
  it('accepts scenarioTags field', () => {
    const result: Partial<RequestResult> & { id: string } = {
      id: 'r-1',
      scenarioTags: ['smoke', 'regression'],
    };
    expect(result.scenarioTags).toEqual(['smoke', 'regression']);
  });

  it('works without scenarioTags', () => {
    const result: Partial<RequestResult> & { id: string } = {
      id: 'r-2',
    };
    expect(result.scenarioTags).toBeUndefined();
  });
});

describe('FeatureGroup → JSON round-trip', () => {
  it('preserves TestScenario.tags through JSON serialization', () => {
    const fg: FeatureGroup = {
      id: 'fg-1',
      name: 'My Feature',
      scenarios: [
        { id: 'sc-1', name: 'Smoke', kind: 'standard', tags: ['smoke', 'critical'], tests: [] },
        { id: 'sc-2', name: 'Regression', kind: 'standard', tags: ['regression'], tests: [] },
        { id: 'sc-3', name: 'No Tags', kind: 'standard', tests: [] },
      ],
    };

    const json = JSON.stringify(fg);
    const restored: FeatureGroup = JSON.parse(json);

    expect(restored.scenarios[0].tags).toEqual(['smoke', 'critical']);
    expect(restored.scenarios[1].tags).toEqual(['regression']);
    expect(restored.scenarios[2].tags).toBeUndefined();
  });

  it('preserves tags through nested stringify/parse of multiple feature groups', () => {
    const featureGroups: FeatureGroup[] = [
      {
        id: 'fg-a',
        name: 'Feature A',
        scenarios: [
          { id: 'sc-a1', name: 'API Tests', kind: 'standard', tags: ['e2e', 'integration'], tests: [] },
        ],
      },
      {
        id: 'fg-b',
        name: 'Feature B',
        scenarios: [
          { id: 'sc-b1', name: 'Load Tests', kind: 'standard', tags: ['performance', 'slow'], tests: [] },
          { id: 'sc-b2', name: 'Unit Tests', kind: 'standard', tests: [] },
        ],
      },
    ];

    const restored: FeatureGroup[] = JSON.parse(JSON.stringify(featureGroups));

    expect(restored[0].scenarios[0].tags).toEqual(['e2e', 'integration']);
    expect(restored[1].scenarios[0].tags).toEqual(['performance', 'slow']);
    expect(restored[1].scenarios[1].tags).toBeUndefined();
  });
});

describe('isParameterizedScenario', () => {
  it('returns true when kind is parameterized', () => {
    const scenario: TestScenario = {
      id: 'sc-param',
      name: 'Param suite',
      kind: 'parameterized',
      tests: [],
    };
    expect(isParameterizedScenario(scenario)).toBe(true);
  });

  it('returns false when kind is standard', () => {
    const scenario: TestScenario = {
      id: 'sc-std',
      name: 'Standard suite',
      kind: 'standard',
      tests: [],
    };
    expect(isParameterizedScenario(scenario)).toBe(false);
  });
});

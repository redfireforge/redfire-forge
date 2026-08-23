/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenarioBuilderSearch } from './useScenarioBuilderSearch';
import type { FeatureGroup, Scenario, TestScenario } from '@shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario =>
  _makeScenario({ id: 'test-1', ...overrides });

function makeTestScenario(overrides: Partial<TestScenario> = {}): TestScenario {
  return {
    id: 'sc-1',
    name: 'My Scenario',
    kind: 'standard',
    tests: [makeScenario()],
    ...overrides,
  };
}

function makeFeatureGroup(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'Feature Group 1',
    scenarios: [makeTestScenario()],
    ...overrides,
  };
}

describe('useScenarioBuilderSearch', () => {
  it('returns initial state with empty search', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));

    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.matchCount).toBe(0);
  });

  it('updates searchQuery when setSearchQuery is called', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));

    act(() => {
      result.current.setSearchQuery('test');
    });

    expect(result.current.searchQuery).toBe('test');
    expect(result.current.isSearching).toBe(true);
  });

  it('testMatches returns true for all when no search query', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));
    const test = makeScenario();

    expect(result.current.testMatches(test)).toBe(true);
  });

  it('testMatches returns true when test matches query', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));

    act(() => {
      result.current.setSearchQuery('users');
    });

    const test = makeScenario({ url: 'https://api.example.com/users' });
    expect(result.current.testMatches(test)).toBe(true);
  });

  it('testMatches returns false when test does not match query', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));

    act(() => {
      result.current.setSearchQuery('nonexistent');
    });

    const test = makeScenario();
    expect(result.current.testMatches(test)).toBe(false);
  });

  describe('scenario tag search', () => {
    it('scenarioMatches returns true when scenario has matching tag', () => {
      const fg = makeFeatureGroup({
        scenarios: [
          makeTestScenario({
            id: 'sc-tagged',
            name: 'Tagged Scenario',
            tags: ['smoke', 'critical'],
            tests: [makeScenario({ name: 'Test 1' })],
          }),
        ],
      });
      const { result } = renderHook(() => useScenarioBuilderSearch([fg]));

      act(() => {
        result.current.setSearchQuery('smoke');
      });

      expect(result.current.scenarioMatches(fg.scenarios[0])).toBe(true);
    });

    it('scenarioMatches returns false when scenario does not have matching tag', () => {
      const fg = makeFeatureGroup({
        scenarios: [
          makeTestScenario({
            id: 'sc-tagged',
            name: 'Tagged Scenario',
            tags: ['smoke', 'critical'],
            tests: [makeScenario({ name: 'Test 1' })],
          }),
        ],
      });
      const { result } = renderHook(() => useScenarioBuilderSearch([fg]));

      act(() => {
        result.current.setSearchQuery('regression');
      });

      expect(result.current.scenarioMatches(fg.scenarios[0])).toBe(false);
    });

    it('scenarioMatches returns true when test has matching tag in scenarioTags', () => {
      const fg = makeFeatureGroup({
        scenarios: [
          makeTestScenario({
            id: 'sc-1',
            name: 'Scenario Without Tags',
            tests: [makeScenario({ name: 'Test 1', scenarioTags: ['smoke'] })],
          }),
        ],
      });
      const { result } = renderHook(() => useScenarioBuilderSearch([fg]));

      act(() => {
        result.current.setSearchQuery('smoke');
      });

      expect(result.current.scenarioMatches(fg.scenarios[0])).toBe(true);
    });

    it('matchCount includes tests that individually match the query', () => {
      const fg = makeFeatureGroup({
        scenarios: [
          makeTestScenario({
            id: 'sc-smoke',
            name: 'Smoke Tests',
            tags: ['smoke'],
            tests: [
              makeScenario({ id: 't1', name: 'Smoke Test 1', scenarioTags: ['smoke'] }),
              makeScenario({ id: 't2', name: 'Smoke Test 2', scenarioTags: ['smoke'] }),
            ],
          }),
          makeTestScenario({
            id: 'sc-regression',
            name: 'Regression Tests',
            tags: ['regression'],
            tests: [
              makeScenario({ id: 't3', name: 'Test 3' }),
            ],
          }),
        ],
      });
      const { result } = renderHook(() => useScenarioBuilderSearch([fg]));

      act(() => {
        result.current.setSearchQuery('smoke');
      });

      expect(result.current.matchCount).toBe(2);
    });

    it('scenarioMatches handles undefined tags', () => {
      const fg = makeFeatureGroup({
        scenarios: [
          makeTestScenario({
            id: 'sc-no-tags',
            name: 'No Tags Scenario',
            tags: undefined,
            tests: [makeScenario({ name: 'Test 1' })],
          }),
        ],
      });
      const { result } = renderHook(() => useScenarioBuilderSearch([fg]));

      act(() => {
        result.current.setSearchQuery('smoke');
      });

      expect(result.current.scenarioMatches(fg.scenarios[0])).toBe(false);
    });

    it('scenarioMatches handles empty tags array', () => {
      const fg = makeFeatureGroup({
        scenarios: [
          makeTestScenario({
            id: 'sc-empty-tags',
            name: 'Empty Tags Scenario',
            tags: [],
            tests: [makeScenario({ name: 'Test 1' })],
          }),
        ],
      });
      const { result } = renderHook(() => useScenarioBuilderSearch([fg]));

      act(() => {
        result.current.setSearchQuery('smoke');
      });

      expect(result.current.scenarioMatches(fg.scenarios[0])).toBe(false);
    });
  });

  it('scenarioMatches returns true for all when no search query', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));
    const sc = makeTestScenario();
    expect(result.current.scenarioMatches(sc)).toBe(true);
  });

  it('featureMatches returns true for all when no search query', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));
    const fg = makeFeatureGroup();
    expect(result.current.featureMatches(fg)).toBe(true);
  });

  it('featureMatches returns true when feature group name matches', () => {
    const fg = makeFeatureGroup({ name: 'User API Tests' });
    const { result } = renderHook(() => useScenarioBuilderSearch([fg]));

    act(() => {
      result.current.setSearchQuery('User API');
    });

    expect(result.current.featureMatches(fg)).toBe(true);
  });

  it('showSearchHelp can be toggled', () => {
    const { result } = renderHook(() => useScenarioBuilderSearch([makeFeatureGroup()]));

    expect(result.current.showSearchHelp).toBe(false);

    act(() => {
      result.current.setShowSearchHelp(true);
    });

    expect(result.current.showSearchHelp).toBe(true);
  });
});

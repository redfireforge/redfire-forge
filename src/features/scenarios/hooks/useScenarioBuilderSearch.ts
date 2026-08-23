import { useCallback, useMemo, useState } from 'react';
import type { Scenario, TestScenario, FeatureGroup } from '@shared/types';
import { buildSearchText, evaluateQuery, parseSearchQuery } from '../utils/scenarioSearch';

export function useScenarioBuilderSearch(featureGroups: FeatureGroup[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const parsedQuery = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);
  const isSearching = parsedQuery !== null;

  const testMatches = useCallback(
    (t: Scenario): boolean => {
      if (!parsedQuery) return true;
      return evaluateQuery(parsedQuery, buildSearchText(t));
    },
    [parsedQuery]
  );

  const scenarioMatches = useCallback(
    (sc: TestScenario): boolean => {
      if (!parsedQuery) return true;
      const scText = [sc.name, ...(sc.tags ?? [])].join(' ');
      if (evaluateQuery(parsedQuery, scText)) return true;
      return sc.tests.some((t) => testMatches(t));
    },
    [parsedQuery, testMatches]
  );

  const featureMatches = useCallback(
    (fg: FeatureGroup): boolean => {
      if (!parsedQuery) return true;
      if (evaluateQuery(parsedQuery, fg.name)) return true;
      return fg.scenarios.some((sc) => scenarioMatches(sc));
    },
    [parsedQuery, scenarioMatches]
  );

  const matchCount = useMemo(() => {
    if (!isSearching) return 0;
    let count = 0;
    for (const fg of featureGroups) {
      if (!featureMatches(fg)) continue;
      for (const sc of fg.scenarios) {
        if (!scenarioMatches(sc)) continue;
        count += sc.tests.filter(testMatches).length;
      }
    }
    return count;
  }, [featureGroups, isSearching, featureMatches, scenarioMatches, testMatches]);

  return {
    searchQuery,
    setSearchQuery,
    showSearchHelp,
    setShowSearchHelp,
    isSearching,
    testMatches,
    scenarioMatches,
    featureMatches,
    matchCount,
  };
}

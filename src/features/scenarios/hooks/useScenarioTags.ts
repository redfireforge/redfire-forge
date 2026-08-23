import { useCallback, useMemo } from 'react';
import type { FeatureGroup } from '@shared/types';
import { BUILT_IN_SCENARIO_TAGS, collectAllScenarioTags, countScenariosByTag, normalizeTag } from '@engine/dataSourceExpander';

interface UseScenarioTagsResult {
  /** Add a tag to a scenario */
  addTag: (fgId: string, scId: string, tag: string) => void;
  /** Remove a tag from a scenario */
  removeTag: (fgId: string, scId: string, tag: string) => void;
  /** Add a tag to multiple scenarios at once */
  bulkAddTag: (targets: Array<{ fgId: string; scId: string }>, tag: string) => void;
  /** Remove a tag from multiple scenarios at once */
  bulkRemoveTag: (targets: Array<{ fgId: string; scId: string }>, tag: string) => void;
  /** Clear all tags from a scenario */
  clearTags: (fgId: string, scId: string) => void;
  /** All unique tags across all scenarios (sorted) */
  allTags: string[];
  /** Tag → scenario count */
  tagCounts: Record<string, number>;
  /** Combined suggestions: built-in + existing tags (deduplicated, sorted) */
  tagSuggestions: string[];
}

export function useScenarioTags(
  featureGroups: FeatureGroup[],
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>,
): UseScenarioTagsResult {
  
  const allTags = useMemo(() => collectAllScenarioTags(featureGroups), [featureGroups]);
  const tagCounts = useMemo(() => countScenariosByTag(featureGroups), [featureGroups]);
  
  const tagSuggestions = useMemo(() => {
    const set = new Set([...BUILT_IN_SCENARIO_TAGS, ...allTags]);
    return [...set].sort();
  }, [allTags]);

  const addTag = useCallback((fgId: string, scId: string, tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          const existing = sc.tags ?? [];
          if (existing.includes(normalized)) return sc;
          return { ...sc, tags: [...existing, normalized] };
        }),
      };
    }));
  }, [setFeatureGroups]);

  const removeTag = useCallback((fgId: string, scId: string, tag: string) => {
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          const filtered = (sc.tags ?? []).filter(t => t !== tag);
          return { ...sc, tags: filtered.length > 0 ? filtered : undefined };
        }),
      };
    }));
  }, [setFeatureGroups]);

  const bulkAddTag = useCallback((targets: Array<{ fgId: string; scId: string }>, tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    const targetSet = new Set(targets.map(t => `${t.fgId}:${t.scId}`));
    setFeatureGroups(prev => prev.map(fg => ({
      ...fg,
      scenarios: fg.scenarios.map(sc => {
        if (!targetSet.has(`${fg.id}:${sc.id}`)) return sc;
        const existing = sc.tags ?? [];
        if (existing.includes(normalized)) return sc;
        return { ...sc, tags: [...existing, normalized] };
      }),
    })));
  }, [setFeatureGroups]);

  const bulkRemoveTag = useCallback((targets: Array<{ fgId: string; scId: string }>, tag: string) => {
    const targetSet = new Set(targets.map(t => `${t.fgId}:${t.scId}`));
    setFeatureGroups(prev => prev.map(fg => ({
      ...fg,
      scenarios: fg.scenarios.map(sc => {
        if (!targetSet.has(`${fg.id}:${sc.id}`)) return sc;
        const filtered = (sc.tags ?? []).filter(t => t !== tag);
        return { ...sc, tags: filtered.length > 0 ? filtered : undefined };
      }),
    })));
  }, [setFeatureGroups]);

  const clearTags = useCallback((fgId: string, scId: string) => {
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          return { ...sc, tags: undefined };
        }),
      };
    }));
  }, [setFeatureGroups]);

  return { addTag, removeTag, bulkAddTag, bulkRemoveTag, clearTags, allTags, tagCounts, tagSuggestions };
}

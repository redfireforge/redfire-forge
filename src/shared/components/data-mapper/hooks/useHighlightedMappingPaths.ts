import { useMemo } from 'react';
import type { Mapping } from '../types';
import { normalizeMapperPath } from '../utils/pathNormalization';

export function useHighlightedMappingPaths(
  hoveredNodePath: string | null,
  hoveredNodeRegion: 'source' | 'target' | null,
  focusedPath: string | null,
  focusRegion: 'source' | 'target' | null,
  mappings: Mapping[],
  selectedMappingId: string | null,
) {
  return useMemo(() => {
    const ids = new Set<string>();
    const srcPaths = new Set<string>();
    const tgtPaths = new Set<string>();

    const addMatchesForNode = (nodePath: string, region: 'source' | 'target') => {
      const hp = normalizeMapperPath(nodePath);
      for (const m of mappings) {
        const matchPath =
          region === 'source' ? normalizeMapperPath(m.sourcePath) : normalizeMapperPath(m.targetPath);
        if (matchPath === hp || matchPath.startsWith(hp + '.') || matchPath.startsWith(hp + '[')) {
          ids.add(m.id);
          srcPaths.add(normalizeMapperPath(m.sourcePath));
          tgtPaths.add(normalizeMapperPath(m.targetPath));
        }
      }
    };

    // Priority: hover > focus > selection (only one active at a time)
    if (hoveredNodePath && hoveredNodeRegion) {
      addMatchesForNode(hoveredNodePath, hoveredNodeRegion);
    } else if (focusedPath != null && focusRegion) {
      addMatchesForNode(focusedPath, focusRegion);
    } else if (selectedMappingId) {
      const sel = mappings.find((m) => m.id === selectedMappingId);
      if (sel) {
        ids.add(sel.id);
        srcPaths.add(normalizeMapperPath(sel.sourcePath));
        tgtPaths.add(normalizeMapperPath(sel.targetPath));
      }
    }

    if (ids.size === 0) {
      return { highlightedMappingIds: null, highlightedSourcePaths: null, highlightedTargetPaths: null };
    }
    return { highlightedMappingIds: ids, highlightedSourcePaths: srcPaths, highlightedTargetPaths: tgtPaths };
  }, [hoveredNodePath, hoveredNodeRegion, focusedPath, focusRegion, mappings, selectedMappingId]);
}

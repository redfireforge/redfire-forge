import { useState, useCallback, useRef } from 'react';

/**
 * Shared hook for JSON tree expand/collapse state.
 * Encapsulates the repeated collapsedSet state + toggle + collapse-all / expand-all
 * pattern used across request, response, and workflow response body components.
 */
export function useJsonTreeCollapseState() {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  const handleTreeToggle = useCallback((path: string) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleCollapseAll = useCallback((paths: Set<string>) => {
    setCollapsedSet(paths);
  }, []);

  const handleExpandAll = useCallback(() => {
    setCollapsedSet(new Set());
  }, []);

  return { collapsedSet, handleTreeToggle, handleCollapseAll, handleExpandAll };
}

/**
 * Builds a ref-stable handleMatchCountChange callback that clamps the active
 * match index when the number of matches shrinks (e.g. on search term change).
 *
 * Returns a memoized handler that safely clamps via a ref, avoiding stale closure issues.
 */
export function useMatchCountChange(
  setMatchCount: (n: number) => void,
  setMatchIdx: (i: number) => void,
  currentMatchIdxRef: React.RefObject<number>,
): (count: number) => void {
  return useCallback((count: number) => {
    setMatchCount(count);
    if ((currentMatchIdxRef.current ?? 0) >= count) {
      setMatchIdx(Math.max(0, count - 1));
    }
  }, [setMatchCount, setMatchIdx, currentMatchIdxRef]);
}

export { useRef };

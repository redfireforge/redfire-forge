import { useCallback, useRef, useState } from 'react';

export type FocusRegion = 'source' | 'target';

export interface UseKeyboardNavigationOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}

export interface UseKeyboardNavigationReturn {
  focusRegion: FocusRegion;
  focusedPath: string | null;
  setFocusRegion: (region: FocusRegion) => void;
  setFocusedPath: (path: string | null) => void;
  handleTreeKeyDown: (
    e: React.KeyboardEvent,
    region: FocusRegion,
    expandedPaths: Set<string>,
    onToggle: (path: string) => void,
  ) => void;
}

function getVisibleNodes(container: HTMLElement, panelClass: string): HTMLElement[] {
  const panel = container.querySelector(`.dm-panel--${panelClass}`);
  if (!panel) return [];
  return Array.from(panel.querySelectorAll('.dm-tree-node[data-path]'));
}

/**
 * Keyboard navigation for the Data Mapper tree panels.
 * - Tab / Shift+Tab within tree containers cycles between source ↔ target
 * - Arrow Up/Down moves focus between visible tree nodes
 * - Arrow Right expands a collapsed parent node
 * - Arrow Left collapses an expanded parent node
 * - Home/End jump to first/last visible node
 */
export function useKeyboardNavigation({
  containerRef,
  disabled = false,
}: UseKeyboardNavigationOptions): UseKeyboardNavigationReturn {
  const [focusRegion, setFocusRegion] = useState<FocusRegion>('source');
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const focusedPathRef = useRef(focusedPath);
  focusedPathRef.current = focusedPath;
  const lastFocusedElRef = useRef<HTMLElement | null>(null);

  const focusNodeByPath = useCallback((path: string, region: FocusRegion) => {
    const container = containerRef.current;
    if (!container) return;
    const panelClass = region;
    const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape : (s: string) => s;
    const node = container.querySelector(
      `.dm-panel--${panelClass} .dm-tree-node[data-path="${esc(path)}"]`,
    ) as HTMLElement | null;
    if (node) {
      if (lastFocusedElRef.current && lastFocusedElRef.current !== node) {
        lastFocusedElRef.current.removeAttribute('tabindex');
      }
      node.setAttribute('tabindex', '0');
      node.focus();
      lastFocusedElRef.current = node;
      setFocusedPath(path);
    }
  }, [containerRef]);

  const handleTreeKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      region: FocusRegion,
      expandedPaths: Set<string>,
      onToggle: (path: string) => void,
    ) => {
      if (disabled) return;
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'Tab') {
        // Only intercept Tab within tree panels to avoid trapping keyboard focus
        const target = e.target as HTMLElement;
        const inTree = target?.closest('.dm-tree-container') || target?.closest('.dm-tree-node');
        if (!inTree) return;
        e.preventDefault();
        const nextRegion: FocusRegion = e.shiftKey
          ? (region === 'source' ? 'target' : 'source')
          : (region === 'source' ? 'target' : 'source');
        setFocusRegion(nextRegion);
        setFocusedPath(null);
        if (lastFocusedElRef.current) {
          lastFocusedElRef.current.removeAttribute('tabindex');
          lastFocusedElRef.current = null;
        }
        const treeContainer = container.querySelector(
          `.dm-panel--${nextRegion} .dm-tree-container`,
        ) as HTMLElement | null;
        treeContainer?.focus();
        return;
      }

      const panelClass = region;
      const nodes = getVisibleNodes(container, panelClass);
      if (nodes.length === 0) return;

      const currentIdx = focusedPathRef.current != null
        ? nodes.findIndex((n) => n.getAttribute('data-path') === focusedPathRef.current)
        : -1;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = Math.min(currentIdx + 1, nodes.length - 1);
          const path = nodes[next]?.getAttribute('data-path');
          if (path != null) focusNodeByPath(path, region);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = Math.max(currentIdx - 1, 0);
          const path = nodes[prev]?.getAttribute('data-path');
          if (path != null) focusNodeByPath(path, region);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusedPathRef.current != null) {
            const expandKey = focusedPathRef.current || '__root__';
            if (!expandedPaths.has(expandKey)) onToggle(expandKey);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedPathRef.current != null) {
            const expandKey = focusedPathRef.current || '__root__';
            if (expandedPaths.has(expandKey)) onToggle(expandKey);
          }
          break;
        }
        case 'Home': {
          e.preventDefault();
          const path = nodes[0]?.getAttribute('data-path');
          if (path != null) focusNodeByPath(path, region);
          break;
        }
        case 'End': {
          e.preventDefault();
          const path = nodes[nodes.length - 1]?.getAttribute('data-path');
          if (path != null) focusNodeByPath(path, region);
          break;
        }
      }
    },
    [containerRef, focusNodeByPath, disabled],
  );

  return {
    focusRegion,
    focusedPath,
    setFocusRegion,
    setFocusedPath,
    handleTreeKeyDown,
  };
}

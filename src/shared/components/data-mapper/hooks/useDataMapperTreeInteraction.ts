import { useCallback, useState } from 'react';

export type LineFocusNode = { region: 'source' | 'target'; path: string } | null;

export interface UseDataMapperTreeInteractionParams {
  setFocusRegion: (region: 'source' | 'target') => void;
  setFocusedPath: (path: string | null) => void;
  rawHandleTreeKeyDown: (
    e: React.KeyboardEvent,
    region: 'source' | 'target',
    expandedPaths: Set<string>,
    onToggle: (path: string) => void,
  ) => void;
  showMappingLines: boolean;
  nodeFocusMode: boolean;
  setLineFocusNode: React.Dispatch<React.SetStateAction<LineFocusNode>>;
}

export function useDataMapperTreeInteraction({
  setFocusRegion,
  setFocusedPath,
  rawHandleTreeKeyDown,
  showMappingLines,
  nodeFocusMode,
  setLineFocusNode,
}: UseDataMapperTreeInteractionParams) {
  const [hoveredNodeRegion, setHoveredNodeRegion] = useState<'source' | 'target' | null>(null);
  const [hoveredNodePath, setHoveredNodePath] = useState<string | null>(null);

  const clearHover = useCallback(() => {
    setHoveredNodePath(null);
    setHoveredNodeRegion(null);
  }, []);

  const handleTreeKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      region: 'source' | 'target',
      expandedPaths: Set<string>,
      onToggle: (path: string) => void,
    ) => {
      clearHover();
      rawHandleTreeKeyDown(e, region, expandedPaths, onToggle);
    },
    [clearHover, rawHandleTreeKeyDown],
  );

  const handleTreeNodeClickForLineFocus = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (showMappingLines || !nodeFocusMode) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
      const node = target.closest('.dm-tree-node[data-path]') as HTMLElement | null;
      if (!node) return;
      const path = node.getAttribute('data-path');
      if (!path) return;
      const region = node.closest('.dm-panel--source')
        ? 'source'
        : node.closest('.dm-panel--target')
          ? 'target'
          : null;
      if (!region) return;
      setLineFocusNode((prev) => {
        if (prev?.region === region && prev.path === path) return null;
        return { region, path };
      });
    },
    [showMappingLines, nodeFocusMode, setLineFocusNode],
  );

  const handleTreeNodeClickForKeyboard = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.target as HTMLElement;
      if (el.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
      const node = el.closest?.('.dm-tree-node[data-path]') as HTMLElement | null;
      if (!node) return;
      const path = node.getAttribute('data-path');
      if (path == null) return;
      const panel = node.closest('.dm-panel--source, .dm-panel--target') as HTMLElement | null;
      if (!panel) return;
      const region = panel.classList.contains('dm-panel--source') ? ('source' as const) : ('target' as const);
      clearHover();
      setFocusRegion(region);
      setFocusedPath(path);
      node.setAttribute('tabindex', '0');
      node.focus();
    },
    [clearHover, setFocusRegion, setFocusedPath],
  );

  const handleTreeNodeHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const node = el.closest?.('.dm-tree-node[data-path]') as HTMLElement | null;
    if (!node) {
      clearHover();
      return;
    }
    const path = node.getAttribute('data-path');
    if (path == null) return;
    const region = node.closest('.dm-panel--source')
      ? ('source' as const)
      : node.closest('.dm-panel--target')
        ? ('target' as const)
        : null;
    if (!region) return;
    setHoveredNodePath(path);
    setHoveredNodeRegion(region);
  }, [clearHover]);

  const handleBodyMouseLeave = useCallback(() => {
    clearHover();
  }, [clearHover]);

  return {
    hoveredNodePath,
    hoveredNodeRegion,
    handleTreeNodeHover,
    handleBodyMouseLeave,
    handleTreeNodeClickForKeyboard,
    handleTreeNodeClickForLineFocus,
    handleTreeKeyDown,
    clearHover,
  };
}

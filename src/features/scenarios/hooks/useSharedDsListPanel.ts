/**
 * useSharedDsListPanel — Manages list panel state for SharedDataSourceModal.
 * Handles selection, filtering, context menu, renaming, and resize.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SharedDataSource } from '../../../shared/types';

export interface UseSharedDsListPanelOptions {
  sharedDataSources: SharedDataSource[];
  initialSelectedId?: string;
  onUpdate: (sources: SharedDataSource[]) => void;
}

export interface UseSharedDsListPanelReturn {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selected: SharedDataSource | null;
  listSearch: string;
  setListSearch: (value: string) => void;
  filteredList: SharedDataSource[];
  contextMenuId: string | null;
  setContextMenuId: (id: string | null) => void;
  renamingId: string | null;
  renameValue: string;
  startRenaming: (id: string, currentName: string) => void;
  handleRename: (id: string, name: string) => void;
  cancelRenaming: () => void;
  setRenameValue: (value: string) => void;
  listPanelCollapsed: boolean;
  setListPanelCollapsed: (collapsed: boolean) => void;
  listPanelWidth: number;
  isResizing: boolean;
  handleResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  pendingNameFocusId: string | null;
  setPendingNameFocusId: (id: string | null) => void;
}

export function useSharedDsListPanel({
  sharedDataSources,
  initialSelectedId,
  onUpdate,
}: UseSharedDsListPanelOptions): UseSharedDsListPanelReturn {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? (sharedDataSources.length > 0 ? sharedDataSources[0].id : null),
  );
  const [listSearch, setListSearch] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingNameFocusId, setPendingNameFocusId] = useState<string | null>(null);
  const [listPanelCollapsed, setListPanelCollapsed] = useState(false);
  const [listPanelWidth, setListPanelWidth] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const selected = useMemo(
    () => sharedDataSources.find(ds => ds.id === selectedId) ?? null,
    [sharedDataSources, selectedId],
  );

  const filteredList = useMemo(() => {
    if (!listSearch.trim()) return sharedDataSources;
    const q = listSearch.toLowerCase();
    return sharedDataSources.filter(ds => ds.name.toLowerCase().includes(q));
  }, [sharedDataSources, listSearch]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizeStartRef.current = { startX: e.clientX, startWidth: listPanelWidth };
    setIsResizing(true);
  }, [listPanelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = e.clientX - resizeStartRef.current.startX;
      const newWidth = Math.max(180, Math.min(450, resizeStartRef.current.startWidth + delta));
      setListPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startRenaming = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setContextMenuId(null);
  }, []);

  const handleRename = useCallback((id: string, name: string) => {
    if (!name.trim()) {
      setRenamingId(null);
      return;
    }
    onUpdate(sharedDataSources.map(ds =>
      ds.id === id ? { ...ds, name: name.trim(), updatedAt: Date.now() } : ds,
    ));
    setRenamingId(null);
  }, [sharedDataSources, onUpdate]);

  const cancelRenaming = useCallback(() => {
    setRenamingId(null);
  }, []);

  return {
    selectedId,
    setSelectedId,
    selected,
    listSearch,
    setListSearch,
    filteredList,
    contextMenuId,
    setContextMenuId,
    renamingId,
    renameValue,
    startRenaming,
    handleRename,
    cancelRenaming,
    setRenameValue,
    listPanelCollapsed,
    setListPanelCollapsed,
    listPanelWidth,
    isResizing,
    handleResizeMouseDown,
    pendingNameFocusId,
    setPendingNameFocusId,
  };
}

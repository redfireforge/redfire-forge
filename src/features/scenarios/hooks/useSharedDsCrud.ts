/**
 * useSharedDsCrud — CRUD operations for shared data sources.
 */
import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SharedDataSource, DataSource, FeatureGroup, Scenario } from '@shared/types';
import { createEmptyRow, createEmptyColumn } from '../utils/dataSourceUtils';
import type { MoveToTrashFn } from './useTrash';

export interface UseSharedDsCrudOptions {
  sharedDataSources: SharedDataSource[];
  onUpdate: (sources: SharedDataSource[]) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setContextMenuId: (id: string | null) => void;
  setPendingNameFocusId: (id: string | null) => void;
  featureGroups: FeatureGroup[];
  currentEditingDraft?: { fgName: string; scenarioName: string; test: Scenario };
  moveToTrash?: MoveToTrashFn;
}

export interface UseSharedDsCrudReturn {
  handleCreate: () => void;
  handleDuplicate: (id: string) => void;
  handleDelete: (id: string) => void;
  confirmDelete: () => void;
  pendingDeleteId: string | null;
  setPendingDeleteId: (id: string | null) => void;
  handleNameChange: (name: string) => void;
  handleDataSourceChange: (newDs: DataSource) => void;
  usedByMap: Map<string, Array<{ testName: string; fullPath: string; isEditing?: boolean }>>;
  totalRows: number;
}

/** Create a blank data source with 1 column and 1 row */
function createBlankDataSource(): DataSource {
  const col = createEmptyColumn([]);
  const row = createEmptyRow([col]);
  return { id: uuidv4(), columns: [col], rows: [row], source: { type: 'inline' } };
}

export function useSharedDsCrud({
  sharedDataSources,
  onUpdate,
  selectedId,
  setSelectedId,
  setContextMenuId,
  setPendingNameFocusId,
  featureGroups,
  currentEditingDraft,
  moveToTrash,
}: UseSharedDsCrudOptions): UseSharedDsCrudReturn {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const selected = useMemo(
    () => sharedDataSources.find(ds => ds.id === selectedId) ?? null,
    [sharedDataSources, selectedId],
  );

  const usedByMap = useMemo(() => {
    const map = new Map<string, Array<{ testName: string; fullPath: string; isEditing?: boolean }>>();
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        for (const test of sc.tests) {
          if (test.sharedDataSourceId) {
            const arr = map.get(test.sharedDataSourceId) ?? [];
            arr.push({
              testName: test.name,
              fullPath: `${fg.name} / ${sc.name} / ${test.name}`,
            });
            map.set(test.sharedDataSourceId, arr);
          }
        }
      }
    }
    if (currentEditingDraft?.test.sharedDataSourceId) {
      const { fgName, scenarioName, test } = currentEditingDraft;
      const dsId = test.sharedDataSourceId!;
      const fullPath = `${fgName} / ${scenarioName} / ${test.name}`;
      const arr = map.get(dsId) ?? [];
      if (!arr.some(r => r.fullPath === fullPath)) {
        arr.push({ testName: test.name, fullPath, isEditing: true });
        map.set(dsId, arr);
      }
    }
    return map;
  }, [featureGroups, currentEditingDraft]);

  const totalRows = useMemo(
    () => sharedDataSources.reduce((sum, ds) => sum + (ds.dataSource?.rows.length ?? 0), 0),
    [sharedDataSources],
  );

  const handleCreate = useCallback(() => {
    const newDs: SharedDataSource = {
      id: uuidv4(),
      name: `Data Source ${sharedDataSources.length + 1}`,
      dataSource: createBlankDataSource(),
      updatedAt: Date.now(),
    };
    onUpdate([...sharedDataSources, newDs]);
    setSelectedId(newDs.id);
    setPendingNameFocusId(newDs.id);
  }, [sharedDataSources, onUpdate, setSelectedId, setPendingNameFocusId]);

  const handleDuplicate = useCallback((id: string) => {
    const source = sharedDataSources.find(ds => ds.id === id);
    if (!source) return;
    const copy: SharedDataSource = {
      ...source,
      id: uuidv4(),
      name: `${source.name} (copy)`,
      updatedAt: Date.now(),
    };
    onUpdate([...sharedDataSources, copy]);
    setSelectedId(copy.id);
    setContextMenuId(null);
  }, [sharedDataSources, onUpdate, setSelectedId, setContextMenuId]);

  const performDelete = useCallback((id: string) => {
    const ds = sharedDataSources.find(d => d.id === id);
    if (moveToTrash && ds) {
      moveToTrash('sharedDataSource', ds, ds.name, '', {});
    }
    const updated = sharedDataSources.filter(d => d.id !== id);
    onUpdate(updated);
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
    setContextMenuId(null);
  }, [sharedDataSources, onUpdate, selectedId, moveToTrash, setSelectedId, setContextMenuId]);

  const handleDelete = useCallback((id: string) => {
    const usedBy = usedByMap.get(id) ?? [];
    if (usedBy.length > 0) {
      setPendingDeleteId(id);
      return;
    }
    performDelete(id);
  }, [usedByMap, performDelete]);

  const confirmDelete = useCallback(() => {
    if (!pendingDeleteId) return;
    performDelete(pendingDeleteId);
    setPendingDeleteId(null);
  }, [pendingDeleteId, performDelete]);

  const handleNameChange = useCallback((name: string) => {
    if (!selected) return;
    onUpdate(sharedDataSources.map(ds =>
      ds.id === selected.id ? { ...ds, name, updatedAt: Date.now() } : ds,
    ));
  }, [selected, sharedDataSources, onUpdate]);

  const handleDataSourceChange = useCallback((newDs: DataSource) => {
    if (!selected) return;
    onUpdate(sharedDataSources.map(ds =>
      ds.id === selected.id ? { ...ds, dataSource: newDs, updatedAt: Date.now() } : ds,
    ));
  }, [selected, sharedDataSources, onUpdate]);

  return {
    handleCreate,
    handleDuplicate,
    handleDelete,
    confirmDelete,
    pendingDeleteId,
    setPendingDeleteId,
    handleNameChange,
    handleDataSourceChange,
    usedByMap,
    totalRows,
  };
}

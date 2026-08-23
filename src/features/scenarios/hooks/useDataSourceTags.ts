/**
 * useDataSourceTags — Tag management for data source rows.
 *
 * Extracts tag-related state and callbacks from DataSourceEditor
 * to reduce component complexity and enable independent testing.
 */
import { useState, useCallback, useMemo } from 'react';
import type { Scenario, DataSource, DataSubset, DataSourceRow } from '@shared/types';
import { collectAllTags, countRowsByTag, BUILT_IN_TAGS } from '@engine/core/dataSourceExpander';

interface UseDataSourceTagsResult {
  // Tag edit state
  editingTagRowId: string | null;
  setEditingTagRowId: (id: string | null) => void;
  tagInput: string;
  setTagInput: (v: string) => void;

  // Computed values
  allTags: string[];
  tagCounts: Record<string, number>;
  untaggedCount: number;
  tagSuggestions: string[];

  // Row tag operations
  addTagToRow: (rowId: string, tag: string) => void;
  removeTagFromRow: (rowId: string, tag: string) => void;
  bulkAddTag: (tag: string) => void;
  bulkRemoveTag: (tag: string) => void;

  // Named subset operations
  addSubset: (subset: DataSubset) => void;
  removeSubset: (name: string) => void;
}

export function useDataSourceTags(
  draft: Scenario,
  dt: DataSource | undefined,
  onDraftChange: (d: Scenario) => void,
  selectedRows: Set<string>,
): UseDataSourceTagsResult {
  const [editingTagRowId, setEditingTagRowId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const allTags = useMemo(() => collectAllTags(dt?.rows ?? []), [dt]);
  const tagCounts = useMemo(() => countRowsByTag(dt?.rows ?? []), [dt]);
  const untaggedCount = useMemo(
    () => (dt?.rows ?? []).filter(r => !r.tags || r.tags.length === 0).length,
    [dt],
  );

  const tagSuggestions = useMemo(() => {
    const existing = new Set(allTags);
    const suggestions = [...allTags];
    for (const t of BUILT_IN_TAGS) {
      if (!existing.has(t)) suggestions.push(t);
    }
    return suggestions;
  }, [allTags]);

  const updateRows = useCallback((mapper: (r: DataSourceRow) => DataSourceRow) => {
    if (!dt) return;
    const rows = dt.rows.map(mapper);
    onDraftChange({ ...draft, dataSource: { ...dt, rows } });
  }, [draft, dt, onDraftChange]);

  const addTagToRow = useCallback((rowId: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    updateRows(r => {
      if (r.id !== rowId) return r;
      const existing = r.tags ?? [];
      if (existing.includes(trimmed)) return r;
      return { ...r, tags: [...existing, trimmed] };
    });
  }, [updateRows]);

  const removeTagFromRow = useCallback((rowId: string, tag: string) => {
    updateRows(r => {
      if (r.id !== rowId) return r;
      const tags = (r.tags ?? []).filter(t => t !== tag);
      return { ...r, tags: tags.length > 0 ? tags : undefined };
    });
  }, [updateRows]);

  const bulkAddTag = useCallback((tag: string) => {
    if (selectedRows.size === 0) return;
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    updateRows(r => {
      if (!selectedRows.has(r.id)) return r;
      const existing = r.tags ?? [];
      if (existing.includes(trimmed)) return r;
      return { ...r, tags: [...existing, trimmed] };
    });
  }, [updateRows, selectedRows]);

  const bulkRemoveTag = useCallback((tag: string) => {
    if (selectedRows.size === 0) return;
    updateRows(r => {
      if (!selectedRows.has(r.id)) return r;
      const tags = (r.tags ?? []).filter(t => t !== tag);
      return { ...r, tags: tags.length > 0 ? tags : undefined };
    });
  }, [updateRows, selectedRows]);

  const addSubset = useCallback((subset: DataSubset) => {
    if (!dt) return;
    const subsets = [...(dt.subsets ?? []), subset];
    onDraftChange({ ...draft, dataSource: { ...dt, subsets } });
  }, [draft, dt, onDraftChange]);

  const removeSubset = useCallback((name: string) => {
    if (!dt) return;
    const subsets = (dt.subsets ?? []).filter(s => s.name !== name);
    onDraftChange({ ...draft, dataSource: { ...dt, subsets: subsets.length > 0 ? subsets : undefined } });
  }, [draft, dt, onDraftChange]);

  return {
    editingTagRowId, setEditingTagRowId,
    tagInput, setTagInput,
    allTags, tagCounts, untaggedCount, tagSuggestions,
    addTagToRow, removeTagFromRow, bulkAddTag, bulkRemoveTag,
    addSubset, removeSubset,
  };
}

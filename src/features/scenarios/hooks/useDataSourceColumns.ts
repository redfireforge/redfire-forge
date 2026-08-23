/**
 * useDataSourceColumns — Column CRUD and type management.
 *
 * Extracted from DataSourceEditor to enable reuse in SharedDataSourceModal.
 */
import { useState, useCallback } from 'react';
import type { DataSource, DataSourceColumn } from '@shared/types';
import { createEmptyColumn } from '../utils/dataSourceUtils';

export interface UseDataSourceColumnsOptions {
  dataSource: DataSource | undefined;
  onChange: (ds: DataSource) => void;
  /** Current URL for path-column template sync */
  url?: string;
}

export interface UseDataSourceColumnsReturn {
  addColumn: () => void;
  removeColumn: (colId: string) => void;
  updateColumn: (colId: string, patch: Partial<DataSourceColumn>) => void;
  editingColId: string | null;
  setEditingColId: (id: string | null) => void;
}

export function useDataSourceColumns({ dataSource: dt, onChange, url }: UseDataSourceColumnsOptions): UseDataSourceColumnsReturn {
  const [editingColId, setEditingColId] = useState<string | null>(null);

  const updateColumn = useCallback(
    (colId: string, patch: Partial<DataSourceColumn>) => {
      if (!dt) return;
      const oldCol = dt.columns.find(c => c.id === colId);
      const columns = dt.columns.map(c =>
        c.id === colId ? { ...c, ...patch } : c,
      );
      // If name changed, also update mapping to match (unless user has customised mapping)
      if (patch.name !== undefined && oldCol) {
        const col = columns.find(c => c.id === colId);
        if (col && col.mapping === oldCol.name) {
          col.mapping = patch.name;
        }
      }
      // If a path column's mapping changed, update the {{placeholder}} in the urlTemplate
      let urlTemplate = dt.urlTemplate ?? url ?? '';
      const updatedCol = columns.find(c => c.id === colId);
      if (oldCol && updatedCol && updatedCol.type === 'path' && oldCol.mapping !== updatedCol.mapping) {
        urlTemplate = urlTemplate.replace(`{{${oldCol.mapping}}}`, `{{${updatedCol.mapping}}}`);
      }
      onChange({ ...dt, columns, urlTemplate });
    },
    [dt, onChange, url],
  );

  const addColumn = useCallback(() => {
    if (!dt) return;
    const col = createEmptyColumn(dt.columns);
    const columns = [...dt.columns, col];
    const rows = dt.rows.map(r => ({
      ...r,
      values: { ...r.values, [col.id]: '' },
    }));
    onChange({ ...dt, columns, rows });
  }, [dt, onChange]);

  const removeColumn = useCallback(
    (colId: string) => {
      if (!dt) return;
      const columns = dt.columns.filter(c => c.id !== colId);
      const rows = dt.rows.map(r => {
        const values = { ...r.values };
        delete values[colId];
        return { ...r, values };
      });
      onChange({ ...dt, columns, rows });
    },
    [dt, onChange],
  );

  return {
    addColumn,
    removeColumn,
    updateColumn,
    editingColId,
    setEditingColId,
  };
}

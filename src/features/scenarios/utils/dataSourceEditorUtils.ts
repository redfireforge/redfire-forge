import type { DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';

export const COLUMN_TYPES: { value: DataSourceColumn['type']; label: string }[] = [
  { value: 'path', label: 'Path' },
  { value: 'param', label: 'Param' },
  { value: 'body', label: 'Body' },
  { value: 'header', label: 'Header' },
  { value: 'validate', label: 'Validate' },
];

export function mergeRowDetailSave(
  dt: DataSource,
  updatedRow: DataSourceRow,
  newColumns?: DataSourceColumn[],
): DataSource {
  if (newColumns && newColumns.length > 0) {
    return {
      ...dt,
      columns: [...dt.columns, ...newColumns],
      rows: dt.rows.map((r) => {
        if (r.id === updatedRow.id) return updatedRow;
        const values = { ...r.values };
        for (const col of newColumns) {
          values[col.id] = '';
        }
        return { ...r, values };
      }),
    };
  }
  return {
    ...dt,
    rows: dt.rows.map((r) => (r.id === updatedRow.id ? updatedRow : r)),
  };
}

export function formatErrorBody(body: string | undefined): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/**
 * Utility functions for detecting changes between shared data source snapshots.
 */
import type { SharedDataSource, DataSource, DataSourceColumn, DataSourceRow } from '@shared/types';

export interface ChangeLogEntry {
  type: 'ds_added' | 'ds_removed' | 'ds_renamed' | 'row_added' | 'row_removed' | 'col_added' | 'col_removed' | 'col_renamed' | 'cell_modified';
  dsId: string;
  dsName: string;
  detail: string;
}

/**
 * Compare two SharedDataSource arrays and return a list of changes.
 */
export function detectChanges(
  before: SharedDataSource[],
  after: SharedDataSource[],
): ChangeLogEntry[] {
  const changes: ChangeLogEntry[] = [];
  
  const beforeMap = new Map(before.map(ds => [ds.id, ds]));
  const afterMap = new Map(after.map(ds => [ds.id, ds]));
  
  // Check for added data sources
  for (const ds of after) {
    if (!beforeMap.has(ds.id)) {
      changes.push({
        type: 'ds_added',
        dsId: ds.id,
        dsName: ds.name,
        detail: `Added "${ds.name}"`,
      });
    }
  }
  
  // Check for removed data sources
  for (const ds of before) {
    if (!afterMap.has(ds.id)) {
      changes.push({
        type: 'ds_removed',
        dsId: ds.id,
        dsName: ds.name,
        detail: `Removed "${ds.name}"`,
      });
    }
  }
  
  // Check for modifications within existing data sources
  for (const afterDs of after) {
    const beforeDs = beforeMap.get(afterDs.id);
    if (!beforeDs) continue; // Already handled as added
    
    // Check name change
    if (beforeDs.name !== afterDs.name) {
      changes.push({
        type: 'ds_renamed',
        dsId: afterDs.id,
        dsName: afterDs.name,
        detail: `Renamed "${beforeDs.name}" → "${afterDs.name}"`,
      });
    }
    
    // Check data source changes
    const dsChanges = detectDataSourceChanges(
      beforeDs.dataSource,
      afterDs.dataSource,
      afterDs.id,
      afterDs.name,
    );
    changes.push(...dsChanges);
  }
  
  return changes;
}

/**
 * Compare two DataSource objects and return changes.
 */
function detectDataSourceChanges(
  before: DataSource,
  after: DataSource,
  dsId: string,
  dsName: string,
): ChangeLogEntry[] {
  const changes: ChangeLogEntry[] = [];
  
  const beforeColMap = new Map(before.columns.map(c => [c.id, c]));
  const afterColMap = new Map(after.columns.map(c => [c.id, c]));
  
  // Check for added columns
  for (const col of after.columns) {
    if (!beforeColMap.has(col.id)) {
      changes.push({
        type: 'col_added',
        dsId,
        dsName,
        detail: `Added column "${col.name}"`,
      });
    }
  }
  
  // Check for removed columns
  for (const col of before.columns) {
    if (!afterColMap.has(col.id)) {
      changes.push({
        type: 'col_removed',
        dsId,
        dsName,
        detail: `Removed column "${col.name}"`,
      });
    }
  }
  
  // Check for renamed columns
  for (const afterCol of after.columns) {
    const beforeCol = beforeColMap.get(afterCol.id);
    if (beforeCol && beforeCol.name !== afterCol.name) {
      changes.push({
        type: 'col_renamed',
        dsId,
        dsName,
        detail: `Renamed column "${beforeCol.name}" → "${afterCol.name}"`,
      });
    }
  }
  
  const beforeRowMap = new Map(before.rows.map(r => [r.id, r]));
  const afterRowMap = new Map(after.rows.map(r => [r.id, r]));
  
  // Count added rows
  let addedRows = 0;
  for (const row of after.rows) {
    if (!beforeRowMap.has(row.id)) {
      addedRows++;
    }
  }
  if (addedRows > 0) {
    changes.push({
      type: 'row_added',
      dsId,
      dsName,
      detail: `${addedRows} row${addedRows !== 1 ? 's' : ''} added`,
    });
  }
  
  // Count removed rows
  let removedRows = 0;
  for (const row of before.rows) {
    if (!afterRowMap.has(row.id)) {
      removedRows++;
    }
  }
  if (removedRows > 0) {
    changes.push({
      type: 'row_removed',
      dsId,
      dsName,
      detail: `${removedRows} row${removedRows !== 1 ? 's' : ''} removed`,
    });
  }
  
  // Count modified cells (existing rows with changed values)
  let modifiedCells = 0;
  for (const afterRow of after.rows) {
    const beforeRow = beforeRowMap.get(afterRow.id);
    if (!beforeRow) continue; // Already handled as added
    
    modifiedCells += countModifiedCells(beforeRow, afterRow, afterColMap);
  }
  if (modifiedCells > 0) {
    changes.push({
      type: 'cell_modified',
      dsId,
      dsName,
      detail: `${modifiedCells} cell${modifiedCells !== 1 ? 's' : ''} modified`,
    });
  }
  
  return changes;
}

/**
 * Count cells that have changed between two rows.
 */
function countModifiedCells(
  before: DataSourceRow,
  after: DataSourceRow,
  colMap: Map<string, DataSourceColumn>,
): number {
  let count = 0;
  
  // Check all columns that exist in after
  for (const [colId] of colMap) {
    const beforeVal = before.values[colId] ?? '';
    const afterVal = after.values[colId] ?? '';
    if (beforeVal !== afterVal) {
      count++;
    }
  }
  
  return count;
}

/**
 * Summarize changes for display.
 */
export function summarizeChanges(changes: ChangeLogEntry[]): string[] {
  // Group by data source for cleaner display
  const byDs = new Map<string, ChangeLogEntry[]>();
  
  for (const change of changes) {
    const key = change.dsId;
    if (!byDs.has(key)) {
      byDs.set(key, []);
    }
    byDs.get(key)!.push(change);
  }
  
  const summary: string[] = [];
  
  for (const [, dsChanges] of byDs) {
    for (const change of dsChanges) {
      summary.push(change.detail);
    }
  }
  
  return summary;
}

/**
 * Get affected data source IDs (those with any changes).
 */
export function getAffectedDsIds(changes: ChangeLogEntry[]): string[] {
  const ids = new Set<string>();
  for (const change of changes) {
    ids.add(change.dsId);
  }
  return [...ids];
}

import { describe, it, expect } from 'vitest';
import {
  detectChanges,
  summarizeChanges,
  getAffectedDsIds,
  type ChangeLogEntry,
} from './sharedDsChangeDetection';
import type { SharedDataSource, DataSource, DataSourceColumn, DataSourceRow } from '@shared/types';

function makeCol(id: string, name: string): DataSourceColumn {
  return { id, name, parameterized: false };
}

function makeRow(id: string, values: Record<string, string>): DataSourceRow {
  return { id, values };
}

function makeDataSource(cols: DataSourceColumn[], rows: DataSourceRow[]): DataSource {
  return { id: 'ds-1', columns: cols, rows, source: { type: 'inline' } };
}

function makeSharedDs(
  id: string,
  name: string,
  dataSource: DataSource,
): SharedDataSource {
  return { id, name, dataSource, createdAt: Date.now(), updatedAt: Date.now() };
}

describe('sharedDsChangeDetection', () => {
  describe('detectChanges', () => {
    it('returns empty array when snapshots are identical', () => {
      const col = makeCol('c1', 'Col1');
      const row = makeRow('r1', { c1: 'val' });
      const ds = makeDataSource([col], [row]);
      const shared = makeSharedDs('sds1', 'TestDS', ds);
      
      const changes = detectChanges([shared], [shared]);
      expect(changes).toEqual([]);
    });

    it('detects added data source', () => {
      const col = makeCol('c1', 'Col1');
      const row = makeRow('r1', { c1: 'val' });
      const ds = makeDataSource([col], [row]);
      const shared = makeSharedDs('sds1', 'TestDS', ds);
      
      const changes = detectChanges([], [shared]);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('ds_added');
      expect(changes[0].dsName).toBe('TestDS');
    });

    it('detects removed data source', () => {
      const col = makeCol('c1', 'Col1');
      const row = makeRow('r1', { c1: 'val' });
      const ds = makeDataSource([col], [row]);
      const shared = makeSharedDs('sds1', 'TestDS', ds);
      
      const changes = detectChanges([shared], []);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('ds_removed');
      expect(changes[0].dsName).toBe('TestDS');
    });

    it('detects renamed data source', () => {
      const col = makeCol('c1', 'Col1');
      const row = makeRow('r1', { c1: 'val' });
      const ds = makeDataSource([col], [row]);
      const before = makeSharedDs('sds1', 'OldName', ds);
      const after = makeSharedDs('sds1', 'NewName', ds);
      
      const changes = detectChanges([before], [after]);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('ds_renamed');
      expect(changes[0].detail).toContain('OldName');
      expect(changes[0].detail).toContain('NewName');
    });

    it('detects added rows', () => {
      const col = makeCol('c1', 'Col1');
      const row1 = makeRow('r1', { c1: 'val1' });
      const row2 = makeRow('r2', { c1: 'val2' });
      const dsBefore = makeDataSource([col], [row1]);
      const dsAfter = makeDataSource([col], [row1, row2]);
      const before = makeSharedDs('sds1', 'DS', dsBefore);
      const after = makeSharedDs('sds1', 'DS', dsAfter);
      
      const changes = detectChanges([before], [after]);
      expect(changes.some(c => c.type === 'row_added')).toBe(true);
      const rowAdd = changes.find(c => c.type === 'row_added');
      expect(rowAdd?.detail).toContain('1 row');
    });

    it('detects removed rows', () => {
      const col = makeCol('c1', 'Col1');
      const row1 = makeRow('r1', { c1: 'val1' });
      const row2 = makeRow('r2', { c1: 'val2' });
      const dsBefore = makeDataSource([col], [row1, row2]);
      const dsAfter = makeDataSource([col], [row1]);
      const before = makeSharedDs('sds1', 'DS', dsBefore);
      const after = makeSharedDs('sds1', 'DS', dsAfter);
      
      const changes = detectChanges([before], [after]);
      expect(changes.some(c => c.type === 'row_removed')).toBe(true);
      const rowRemove = changes.find(c => c.type === 'row_removed');
      expect(rowRemove?.detail).toContain('1 row');
    });

    it('detects added columns', () => {
      const col1 = makeCol('c1', 'Col1');
      const col2 = makeCol('c2', 'Col2');
      const row = makeRow('r1', { c1: 'val1' });
      const rowAfter = makeRow('r1', { c1: 'val1', c2: '' });
      const dsBefore = makeDataSource([col1], [row]);
      const dsAfter = makeDataSource([col1, col2], [rowAfter]);
      const before = makeSharedDs('sds1', 'DS', dsBefore);
      const after = makeSharedDs('sds1', 'DS', dsAfter);
      
      const changes = detectChanges([before], [after]);
      expect(changes.some(c => c.type === 'col_added')).toBe(true);
      const colAdd = changes.find(c => c.type === 'col_added');
      expect(colAdd?.detail).toContain('Col2');
    });

    it('detects removed columns', () => {
      const col1 = makeCol('c1', 'Col1');
      const col2 = makeCol('c2', 'Col2');
      const row = makeRow('r1', { c1: 'val1', c2: 'val2' });
      const rowAfter = makeRow('r1', { c1: 'val1' });
      const dsBefore = makeDataSource([col1, col2], [row]);
      const dsAfter = makeDataSource([col1], [rowAfter]);
      const before = makeSharedDs('sds1', 'DS', dsBefore);
      const after = makeSharedDs('sds1', 'DS', dsAfter);
      
      const changes = detectChanges([before], [after]);
      expect(changes.some(c => c.type === 'col_removed')).toBe(true);
      const colRem = changes.find(c => c.type === 'col_removed');
      expect(colRem?.detail).toContain('Col2');
    });

    it('detects renamed columns', () => {
      const colBefore = makeCol('c1', 'OldCol');
      const colAfter = makeCol('c1', 'NewCol');
      const row = makeRow('r1', { c1: 'val' });
      const dsBefore = makeDataSource([colBefore], [row]);
      const dsAfter = makeDataSource([colAfter], [row]);
      const before = makeSharedDs('sds1', 'DS', dsBefore);
      const after = makeSharedDs('sds1', 'DS', dsAfter);
      
      const changes = detectChanges([before], [after]);
      expect(changes.some(c => c.type === 'col_renamed')).toBe(true);
      const colRename = changes.find(c => c.type === 'col_renamed');
      expect(colRename?.detail).toContain('OldCol');
      expect(colRename?.detail).toContain('NewCol');
    });

    it('detects modified cells', () => {
      const col = makeCol('c1', 'Col1');
      const rowBefore = makeRow('r1', { c1: 'oldValue' });
      const rowAfter = makeRow('r1', { c1: 'newValue' });
      const dsBefore = makeDataSource([col], [rowBefore]);
      const dsAfter = makeDataSource([col], [rowAfter]);
      const before = makeSharedDs('sds1', 'DS', dsBefore);
      const after = makeSharedDs('sds1', 'DS', dsAfter);
      
      const changes = detectChanges([before], [after]);
      expect(changes.some(c => c.type === 'cell_modified')).toBe(true);
      const cellMod = changes.find(c => c.type === 'cell_modified');
      expect(cellMod?.detail).toContain('1 cell');
    });

    it('detects multiple changes across data sources', () => {
      const col = makeCol('c1', 'Col');
      const row = makeRow('r1', { c1: 'val' });
      const ds1 = makeDataSource([col], [row]);
      const ds2 = makeDataSource([col], [row]);
      
      const shared1Before = makeSharedDs('sds1', 'DS1', ds1);
      const shared2Before = makeSharedDs('sds2', 'DS2', ds2);
      
      const shared1After = makeSharedDs('sds1', 'DS1-Renamed', ds1);
      const shared3After = makeSharedDs('sds3', 'DS3-New', ds2);
      
      const changes = detectChanges([shared1Before, shared2Before], [shared1After, shared3After]);
      
      expect(changes.some(c => c.type === 'ds_renamed' && c.dsId === 'sds1')).toBe(true);
      expect(changes.some(c => c.type === 'ds_removed' && c.dsId === 'sds2')).toBe(true);
      expect(changes.some(c => c.type === 'ds_added' && c.dsId === 'sds3')).toBe(true);
    });
  });

  describe('summarizeChanges', () => {
    it('returns array of detail strings', () => {
      const changes: ChangeLogEntry[] = [
        { type: 'ds_added', dsId: 'sds1', dsName: 'Test', detail: 'Added "Test"' },
        { type: 'row_added', dsId: 'sds1', dsName: 'Test', detail: '2 rows added' },
      ];
      
      const summary = summarizeChanges(changes);
      expect(summary).toHaveLength(2);
      expect(summary).toContain('Added "Test"');
      expect(summary).toContain('2 rows added');
    });

    it('returns empty array for no changes', () => {
      const summary = summarizeChanges([]);
      expect(summary).toEqual([]);
    });
  });

  describe('getAffectedDsIds', () => {
    it('returns unique data source IDs', () => {
      const changes: ChangeLogEntry[] = [
        { type: 'ds_renamed', dsId: 'sds1', dsName: 'DS1', detail: 'renamed' },
        { type: 'row_added', dsId: 'sds1', dsName: 'DS1', detail: '1 row added' },
        { type: 'col_added', dsId: 'sds2', dsName: 'DS2', detail: 'col added' },
      ];
      
      const ids = getAffectedDsIds(changes);
      expect(ids).toHaveLength(2);
      expect(ids).toContain('sds1');
      expect(ids).toContain('sds2');
    });

    it('returns empty array for no changes', () => {
      const ids = getAffectedDsIds([]);
      expect(ids).toEqual([]);
    });
  });
});

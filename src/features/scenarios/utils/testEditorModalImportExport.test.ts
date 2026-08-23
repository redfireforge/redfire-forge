import { describe, it, expect } from 'vitest';
import { parseImportedDataRows } from './testEditorModalImportExport';
import type { DataSource } from '@shared/types';

const dt: DataSource = {
  urlTemplate: 'https://api.example.com/{{id}}',
  columns: [
    { id: 'col-1', name: 'id', type: 'path', mapping: 'id' },
    { id: 'col-2', name: 'status', type: 'validate', mapping: 'status' },
  ],
  rows: [],
};

describe('parseImportedDataRows', () => {
  it('parses JSON rows by column name', () => {
    const json = JSON.stringify({
      rows: [{ values: { id: '42', status: 'ok' }, enabled: true }],
    });
    const rows = parseImportedDataRows(json, 'data.json', dt);
    expect(rows).toHaveLength(1);
    expect(rows![0].values['col-1']).toBe('42');
    expect(rows![0].values['col-2']).toBe('ok');
  });

  it('returns null for invalid JSON', () => {
    expect(parseImportedDataRows('{bad', 'data.json', dt)).toBeNull();
  });

  it('parses CSV with typed column headers', () => {
    const csv = 'path:id,expect:status\n42,ok\n';
    const rows = parseImportedDataRows(csv, 'data.csv', dt);
    expect(rows).toHaveLength(1);
    expect(rows![0].values['col-1']).toBe('42');
    expect(rows![0].values['col-2']).toBe('ok');
  });

  it('returns null for empty CSV', () => {
    expect(parseImportedDataRows('   \n  ', 'data.csv', dt)).toBeNull();
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSourceColumns } from './useDataSourceColumns';
import type { DataSource } from '@shared/types';

vi.mock('uuid', () => ({ v4: () => `uuid-${Math.random().toString(36).slice(2, 8)}` }));

function makeDataSource(): DataSource {
  return {
    id: 'ds1',
    columns: [
      { id: 'c1', name: 'vin', type: 'param', mapping: 'vin' },
      { id: 'c2', name: 'channel', type: 'param', mapping: 'channel' },
    ],
    rows: [
      { id: 'r1', values: { c1: 'AAA', c2: 'WEB' }, enabled: true },
    ],
    source: { type: 'inline' },
  };
}

describe('useDataSourceColumns', () => {
  it('addColumn appends a new column and adds empty values to rows', () => {
    const onChange = vi.fn();
    const ds = makeDataSource();
    const { result } = renderHook(() => useDataSourceColumns({ dataSource: ds, onChange }));
    act(() => result.current.addColumn());
    const updated = onChange.mock.calls[0][0] as DataSource;
    expect(updated.columns).toHaveLength(3);
    expect(Object.keys(updated.rows[0].values)).toHaveLength(3);
  });

  it('removeColumn removes column and its values from rows', () => {
    const onChange = vi.fn();
    const ds = makeDataSource();
    const { result } = renderHook(() => useDataSourceColumns({ dataSource: ds, onChange }));
    act(() => result.current.removeColumn('c1'));
    const updated = onChange.mock.calls[0][0] as DataSource;
    expect(updated.columns).toHaveLength(1);
    expect(updated.columns[0].id).toBe('c2');
    expect(updated.rows[0].values).not.toHaveProperty('c1');
  });

  it('updateColumn updates column properties', () => {
    const onChange = vi.fn();
    const ds = makeDataSource();
    const { result } = renderHook(() => useDataSourceColumns({ dataSource: ds, onChange }));
    act(() => result.current.updateColumn('c1', { name: 'vehicle_id', type: 'body' }));
    const updated = onChange.mock.calls[0][0] as DataSource;
    expect(updated.columns[0].name).toBe('vehicle_id');
    expect(updated.columns[0].type).toBe('body');
  });

  it('updateColumn syncs mapping when it matched old name', () => {
    const onChange = vi.fn();
    const ds = makeDataSource();
    const { result } = renderHook(() => useDataSourceColumns({ dataSource: ds, onChange }));
    act(() => result.current.updateColumn('c1', { name: 'vehicle' }));
    const updated = onChange.mock.calls[0][0] as DataSource;
    expect(updated.columns[0].mapping).toBe('vehicle');
  });

  it('updateColumn updates urlTemplate for path column mapping changes', () => {
    const onChange = vi.fn();
    const ds: DataSource = {
      ...makeDataSource(),
      columns: [{ id: 'c1', name: 'id', type: 'path', mapping: 'id' }],
      urlTemplate: 'https://api.example.com/{{id}}',
    };
    const { result } = renderHook(() => useDataSourceColumns({ dataSource: ds, onChange, url: 'https://api.example.com/123' }));
    act(() => result.current.updateColumn('c1', { name: 'vehicleId', mapping: 'vehicleId' }));
    const updated = onChange.mock.calls[0][0] as DataSource;
    expect(updated.urlTemplate).toBe('https://api.example.com/{{vehicleId}}');
  });

  it('editingColId state works', () => {
    const ds = makeDataSource();
    const { result } = renderHook(() => useDataSourceColumns({ dataSource: ds, onChange: vi.fn() }));
    expect(result.current.editingColId).toBeNull();
    act(() => result.current.setEditingColId('c1'));
    expect(result.current.editingColId).toBe('c1');
  });

  it('no-ops when dataSource is undefined', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDataSourceColumns({ dataSource: undefined, onChange }));
    act(() => result.current.addColumn());
    act(() => result.current.removeColumn('x'));
    act(() => result.current.updateColumn('x', { name: 'y' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

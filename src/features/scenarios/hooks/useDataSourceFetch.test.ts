/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSourceFetch } from './useDataSourceFetch';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';

// Mock dependencies
vi.mock('../../../engine/dataSourceExpander', () => ({
  resolveScenarioFromDataRow: vi.fn((_scenario, _cols, _row, _idx) => ({
    url: 'https://api.example.com/items/123',
    method: 'GET',
    headers: [],
    body: '',
  })),
}));

vi.mock('../../../engine/executor', () => ({
  proxyFetch: vi.fn(),
  buildHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
}));

vi.mock('../utils/dataSourceImport', () => ({
  extractJsonPath: vi.fn((obj: unknown, path: string) => {
    if (path === '$.name' && obj && typeof obj === 'object' && 'name' in obj) return String((obj as Record<string, unknown>).name);
    return '';
  }),
  expandPatternFromResponse: vi.fn(() => []),
  inferPatternsFromColumns: vi.fn(() => []),
}));

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }));

function makeScenario(overrides?: Partial<Scenario>): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'https://api.example.com/items/{{id}}',
    method: 'GET',
    headers: [],
    body: '',
    bodyType: 'none',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

function makeDataSource(overrides?: Partial<DataSource>): DataSource {
  const col: DataSourceColumn = { id: 'c1', name: 'id', type: 'path', mapping: 'id' };
  const valCol: DataSourceColumn = { id: 'vc1', name: 'name', type: 'validate', mapping: '$.name' };
  const row: DataSourceRow = { id: 'r1', values: { c1: '123', vc1: '' }, enabled: true };
  return {
    id: 'ds1',
    columns: [col, valCol],
    rows: [row],
    source: { type: 'inline' },
    distribution: 'sequential',
    ...overrides,
  };
}

function makeHttpResponse(overrides?: Partial<HttpResponse>): HttpResponse {
  return {
    status: 200,
    statusText: 'OK',
    body: JSON.stringify({ name: 'Widget' }),
    headers: {},
    duration: 100,
    error: '',
    ...overrides,
  };
}

describe('useDataSourceFetch', () => {
  let onChange: ReturnType<typeof vi.fn>;
  let onFetchRow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onChange = vi.fn();
    onFetchRow = vi.fn().mockResolvedValue(makeHttpResponse());
  });

  it('clearFetchError resets error state', async () => {
    onFetchRow.mockResolvedValue(makeHttpResponse({ status: 500, statusText: 'Err' }));

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    expect(result.current.fetchRowError).not.toBeNull();

    act(() => {
      result.current.clearFetchError();
    });

    expect(result.current.fetchRowError).toBeNull();
    expect(result.current.fetchRowErrorDetail).toBeNull();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
      }),
    );
    expect(result.current.fetchingRowId).toBeNull();
    expect(result.current.refetchingAll).toBe(false);
    expect(result.current.fetchRowError).toBeNull();
    expect(result.current.fetchRowErrorDetail).toBeNull();
  });

  it('fetchRowResponse calls onFetchRow and updates data source', async () => {
    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    expect(onFetchRow).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedDs = onChange.mock.calls[0][0];
    expect(updatedDs.rows[0].values.vc1).toBe('Widget');
  });

  it('fetchRowResponse sets error on HTTP error', async () => {
    onFetchRow.mockResolvedValue(makeHttpResponse({ status: 500, statusText: 'Internal Server Error' }));

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    expect(result.current.fetchRowError).toBe('HTTP 500: Internal Server Error');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fetchRowResponse sets error on network error', async () => {
    onFetchRow.mockResolvedValue(makeHttpResponse({ error: 'Network timeout', status: 0, statusText: '' }));

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    expect(result.current.fetchRowError).toBe('Network timeout');
  });

  it('fetchRowResponse no-ops for missing row', async () => {
    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('nonexistent');
    });

    expect(onFetchRow).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fetchRowResponse no-ops when dataSource is undefined', async () => {
    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: undefined,
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    expect(onFetchRow).not.toHaveBeenCalled();
  });

  it('fetchRowResponse handles non-JSON response', async () => {
    onFetchRow.mockResolvedValue(makeHttpResponse({ body: 'plain text' }));

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    // Should not call onChange since response is not JSON
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.fetchRowError).toBeNull();
  });

  it('fetchRowResponse handles thrown error', async () => {
    onFetchRow.mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    expect(result.current.fetchRowError).toBe('Connection refused');
    expect(result.current.fetchingRowId).toBeNull();
  });

  it('refetchAllRows processes enabled rows', async () => {
    const ds = makeDataSource({
      rows: [
        { id: 'r1', values: { c1: '123', vc1: '' }, enabled: true },
        { id: 'r2', values: { c1: '456', vc1: '' }, enabled: true },
        { id: 'r3', values: { c1: '789', vc1: '' }, enabled: false },
      ],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: ds,
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    // Should fetch 2 enabled rows, not the disabled one
    expect(onFetchRow).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('refetchAllRows no-ops when no enabled rows', async () => {
    const ds = makeDataSource({
      rows: [{ id: 'r1', values: { c1: '123' }, enabled: false }],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: ds,
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    expect(onFetchRow).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refetchAllRows collects errors from failing rows', async () => {
    onFetchRow
      .mockResolvedValueOnce(makeHttpResponse())
      .mockResolvedValueOnce(makeHttpResponse({ error: 'Timeout' }));

    const ds = makeDataSource({
      rows: [
        { id: 'r1', values: { c1: '123', vc1: '' }, enabled: true },
        { id: 'r2', values: { c1: '456', vc1: '' }, enabled: true },
      ],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: ds,
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    expect(result.current.fetchRowError).toContain('Timeout');
    expect(result.current.refetchingAll).toBe(false);
  });

  it('refetchAllRows no-ops when dataSource is undefined', async () => {
    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: undefined,
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    expect(onFetchRow).not.toHaveBeenCalled();
  });

  it('marks row as sample when validate data is populated', async () => {
    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: makeDataSource(),
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    const updatedDs = onChange.mock.calls[0][0];
    expect(updatedDs.rows[0].isSample).toBe(true);
  });

  it('refetchAllRows handles HTTP 4xx errors', async () => {
    onFetchRow.mockResolvedValue(makeHttpResponse({ status: 404, statusText: 'Not Found' }));

    const ds = makeDataSource({
      rows: [{ id: 'r1', values: { c1: '123', vc1: '' }, enabled: true }],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    expect(result.current.fetchRowError).toContain('HTTP 404');
    expect(onChange).toHaveBeenCalled();
  });

  it('refetchAllRows handles thrown exceptions per row', async () => {
    onFetchRow.mockRejectedValue(new Error('DNS failure'));

    const ds = makeDataSource({
      rows: [{ id: 'r1', values: { c1: '123', vc1: '' }, enabled: true }],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    expect(result.current.fetchRowError).toContain('DNS failure');
  });

  it('refetchAllRows skips non-JSON responses', async () => {
    onFetchRow.mockResolvedValue(makeHttpResponse({ body: 'not json' }));

    const ds = makeDataSource({
      rows: [{ id: 'r1', values: { c1: '123', vc1: '' }, enabled: true }],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    // Should still call onChange but row values unchanged
    expect(onChange).toHaveBeenCalled();
    expect(result.current.fetchRowError).toBeNull();
  });

  it('refetchAllRows populates validate columns from JSON response', async () => {
    const ds = makeDataSource({
      rows: [
        { id: 'r1', values: { c1: '123', vc1: '' }, enabled: true },
      ],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    const updatedDs = onChange.mock.calls[0][0];
    expect(updatedDs.rows[0].values.vc1).toBe('Widget');
  });

  it('refetchAllRows with dynamic patterns expands new columns', async () => {
    const { expandPatternFromResponse } = await import('../utils/dataSourceImport');
    (expandPatternFromResponse as ReturnType<typeof vi.fn>).mockReturnValue(['$.items[0].name', '$.items[1].name']);

    const ds = makeDataSource({
      validationContract: ['$.items[*].name'],
      rows: [{ id: 'r1', values: { c1: '123', vc1: '' }, enabled: true }],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    expect(onChange).toHaveBeenCalled();
    const updatedDs = onChange.mock.calls[0][0];
    // Should have added new columns from pattern expansion
    expect(updatedDs.columns.length).toBeGreaterThan(2);
  });

  it('fetchRowResponse with dynamic patterns expands new columns', async () => {
    const { expandPatternFromResponse } = await import('../utils/dataSourceImport');
    (expandPatternFromResponse as ReturnType<typeof vi.fn>).mockReturnValue(['$.items[0].name']);

    const ds = makeDataSource({
      validationContract: ['$.items[*].name'],
      rows: [
        { id: 'r1', values: { c1: '123', vc1: '' }, enabled: true },
        { id: 'r2', values: { c1: '456', vc1: '' }, enabled: true },
      ],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    const updatedDs = onChange.mock.calls[0][0];
    expect(updatedDs.columns.length).toBeGreaterThan(2);
    // Other rows should have empty values for new columns
    expect(updatedDs.rows[1].values['test-uuid']).toBe('');
  });

  it('fetchRowResponse with non-Error thrown value', async () => {
    onFetchRow.mockRejectedValue('string error');

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: makeDataSource(), onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    expect(result.current.fetchRowError).toBe('string error');
  });

  it('refetchAllRows with non-Error thrown value', async () => {
    onFetchRow.mockRejectedValue(42);

    const ds = makeDataSource({
      rows: [{ id: 'r1', values: { c1: '123', vc1: '' }, enabled: true }],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.refetchAllRows();
    });

    expect(result.current.fetchRowError).toContain('42');
  });

  it('clears dynamic validate cells when JSON path extraction is empty', async () => {
    const { extractJsonPath, inferPatternsFromColumns } = await import('../utils/dataSourceImport');
    vi.mocked(extractJsonPath).mockReturnValue('');
    vi.mocked(inferPatternsFromColumns).mockReturnValue([]);

    const ds = makeDataSource({
      validationContract: ['items[*].name'],
      columns: [
        { id: 'c1', name: 'id', type: 'path', mapping: 'id' },
        { id: 'vcDyn', name: 'itemName', type: 'validate', mapping: 'items[0].name' },
      ],
      rows: [{ id: 'r1', values: { c1: '123', vcDyn: 'stale' }, enabled: true }],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({ scenario: makeScenario(), dataSource: ds, onChange, onFetchRow }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    const updated = onChange.mock.calls[0][0];
    expect(updated.rows[0].values.vcDyn).toBe('');
  });

  it('backfill skips new-column cells when a row already has a value', async () => {
    const { expandPatternFromResponse, extractJsonPath } = await import('../utils/dataSourceImport');
    vi.mocked(expandPatternFromResponse).mockReturnValue(['$.items[0].id']);
    vi.mocked(extractJsonPath).mockImplementation((_obj: unknown, path: string) => {
      if (path === '$.items[0].id') return 'from-api';
      return '';
    });

    const presetColId = 'test-uuid';
    const ds = makeDataSource({
      validationContract: ['$.items[*].id'],
      rows: [
        { id: 'r1', values: { c1: '123', vc1: '' }, enabled: true },
        { id: 'r2', values: { c1: '456', vc1: '', [presetColId]: 'preserve-me' }, enabled: true },
      ],
    });

    const { result } = renderHook(() =>
      useDataSourceFetch({
        scenario: makeScenario(),
        dataSource: ds,
        onChange,
        onFetchRow,
      }),
    );

    await act(async () => {
      await result.current.fetchRowResponse('r1');
    });

    const updatedDs = onChange.mock.calls[0][0];
    const dynCol = updatedDs.columns.find((c: DataSourceColumn) => c.mapping === '$.items[0].id');
    expect(dynCol?.id).toBe(presetColId);
    expect(updatedDs.rows[1].values[presetColId]).toBe('preserve-me');
  });
});

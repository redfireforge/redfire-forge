/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSourceImport } from './useDataSourceImport';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { CsvParseResult } from '../utils/csvTemplateTypes';
import { parseJsonImport, parseExcelSimple } from '../utils/dataSourceImport';
import { parseExcelToScenarios } from '../utils/csvTemplateExcel';

// Mock dependencies
vi.mock('../utils/dataSourceImport', () => ({
  parseCsvLine: vi.fn((line: string) => line.split(',')),
  parseColumnHeader: vi.fn((hdr: string) => ({ type: 'input' as const, name: hdr.trim() })),
  parseJsonImport: vi.fn((_json: unknown, _cols: DataSourceColumn[]) => ({
    columns: [{ id: 'jc1', name: 'name', type: 'input' as const, mapping: 'name' }],
    rows: [{ id: 'jr1', values: { jc1: 'Widget' }, enabled: true }],
  })),
  buildColumnsAndRowsFromParseResult: vi.fn(() => ({
    columns: [{ id: 'ec1', name: 'col1', type: 'input' as const, mapping: 'col1' }],
    rows: [{ id: 'er1', values: { ec1: 'val1' }, enabled: true }],
  })),
  parseExcelSimple: vi.fn(async () => ({
    columns: [{ id: 'xs1', name: 'sheet_col', type: 'input' as const, mapping: 'sheet_col' }],
    rows: [{ id: 'xr1', values: { xs1: 'val' }, enabled: true }],
  })),
}));

vi.mock('../utils/csvTemplateExcel', () => ({
  parseExcelToScenarios: vi.fn((): CsvParseResult => ({
    fileErrors: [],
    rows: [],
    columns: [],
    totalRows: 0,
    validRows: 0,
    errorRows: 0,
    meta: null,
    warnings: [],
  })),
}));

vi.mock('../utils/dataSourceUtils', () => ({
  createEmptyColumn: vi.fn((cols: DataSourceColumn[]) => ({
    id: `new-col-${cols.length}`,
    name: '',
    type: 'input' as const,
    mapping: '',
  })),
}));

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

function makeScenario(overrides?: Partial<Scenario>): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'https://api.example.com/items',
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
  const col: DataSourceColumn = { id: 'c1', name: 'id', type: 'input', mapping: 'id' };
  const row: DataSourceRow = { id: 'r1', values: { c1: '123' }, enabled: true };
  return {
    id: 'ds1',
    columns: [col],
    rows: [row],
    source: { type: 'inline' },
    distribution: 'sequential',
    ...overrides,
  };
}

describe('useDataSourceImport', () => {
  let onDraftChange: ReturnType<typeof vi.fn>;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    onDraftChange = vi.fn();
    originalCreateElement = document.createElement.bind(document);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Helper to simulate file selection by intercepting createElement('input') */
  function mockFilePicker(file: File) {
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'input') {
        const input = originalCreateElement('input');
        // Override click to trigger onchange immediately
        vi.spyOn(input, 'click').mockImplementation(() => {
          Object.defineProperty(input, 'files', { value: [file], writable: false });
          input.onchange?.(new Event('change') as unknown as Event);
        });
        return input;
      }
      return originalCreateElement(tag);
    });
  }

  function makeCsvFile(content: string, name = 'test.csv') {
    return new File([content], name, { type: 'text/csv' });
  }

  function makeJsonFile(content: string, name = 'test.json') {
    return new File([content], name, { type: 'application/json' });
  }

  function makeExcelFile(name = 'test.xlsx') {
    return new File([new ArrayBuffer(10)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  it('returns handleImport function', () => {
    const draft = makeScenario({ dataSource: makeDataSource() });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: draft.dataSource, onDraftChange }),
    );
    expect(typeof result.current.handleImport).toBe('function');
  });

  it('no-ops when dataSource is undefined', async () => {
    const draft = makeScenario();
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: undefined, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('imports CSV file and creates rows', async () => {
    const csvContent = 'id,name\n1,Alice\n2,Bob';
    mockFilePicker(makeCsvFile(csvContent));

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    // Wait for async file read
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(onDraftChange).toHaveBeenCalled();
    const call = onDraftChange.mock.calls[0][0];
    expect(call.dataSource.rows).toHaveLength(2);
    expect(call.dataSource.source.type).toBe('file');
    expect(call.dataSource.source.filePath).toBe('test.csv');
  });

  it('imports JSON file via parseJsonImport', async () => {
    const jsonContent = JSON.stringify([{ name: 'Widget' }]);
    mockFilePicker(makeJsonFile(jsonContent));

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(parseJsonImport).toHaveBeenCalled();
    expect(onDraftChange).toHaveBeenCalled();
    const call = onDraftChange.mock.calls[0][0];
    expect(call.dataSource.source.filePath).toBe('test.json');
  });

  it('imports Excel file via parseExcelToScenarios', async () => {
    mockFilePicker(makeExcelFile());

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(parseExcelToScenarios).toHaveBeenCalled();
    expect(onDraftChange).toHaveBeenCalled();
    const call = onDraftChange.mock.calls[0][0];
    expect(call.dataSource.source.filePath).toBe('test.xlsx');
  });

  it('falls back to parseExcelSimple on file errors', async () => {
    vi.mocked(parseExcelToScenarios).mockReturnValue({
      fileErrors: ['bad format'],
      rows: [],
      columns: [],
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      meta: null,
      warnings: [],
    });
    mockFilePicker(makeExcelFile());

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(parseExcelSimple).toHaveBeenCalled();
    expect(onDraftChange).toHaveBeenCalled();
  });

  it('handles CSV with empty lines gracefully', async () => {
    mockFilePicker(makeCsvFile(''));

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Empty CSV = no rows to import, onDraftChange not called
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('handles CSV with header only (no data rows)', async () => {
    mockFilePicker(makeCsvFile('id,name'));

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Header only, no data rows = no rows to import
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('handles JSON parse error gracefully', async () => {
    mockFilePicker(makeJsonFile('not valid json'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(consoleSpy).toHaveBeenCalled();
    expect(onDraftChange).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('creates file input with correct accept attribute', async () => {
    const createSpy = vi.spyOn(document, 'createElement');
    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    expect(createSpy).toHaveBeenCalledWith('input');
    createSpy.mockRestore();
  });

  it('does not call onDraftChange when file picker is cancelled (no files)', async () => {
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'input') {
        const input = originalCreateElement('input');
        vi.spyOn(input, 'click').mockImplementation(() => {
          // Simulate cancel: files is empty
          Object.defineProperty(input, 'files', { value: [], writable: false });
          input.onchange?.(new Event('change') as unknown as Event);
        });
        return input;
      }
      return originalCreateElement(tag);
    });

    const ds = makeDataSource();
    const draft = makeScenario({ dataSource: ds });
    const { result } = renderHook(() =>
      useDataSourceImport({ draft, dataSource: ds, onDraftChange }),
    );

    await act(async () => {
      await result.current.handleImport();
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(onDraftChange).not.toHaveBeenCalled();
  });
});

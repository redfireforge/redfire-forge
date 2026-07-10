/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseImportedDataRows,
  createTestEditorImportHandler,
  createTestEditorExportHandler,
} from './testEditorModalImportExport';
import type { Scenario, DataSource } from '../../../shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

vi.mock('../utils/testEditorUtils', () => ({
  pickJsonFile: vi.fn(),
  unwrapImport: (x: unknown) => x,
}));

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn(),
}));

import { pickJsonFile } from '../utils/testEditorUtils';
import { saveFile } from '../../../shared/utils/fileSaver';

const dataSource: DataSource = {
  urlTemplate: 'https://api.example.com/{{id}}',
  columns: [
    { id: 'c1', name: 'id', type: 'path', mapping: 'id' },
    { id: 'c2', name: 'qty', type: 'body', mapping: 'qty' },
    { id: 'c3', name: 'hdr', type: 'header', mapping: 'X-Trace' },
    { id: 'c4', name: 'flag', type: 'param', mapping: 'flag' },
    { id: 'c5', name: 'score', type: 'validate', mapping: 'score' },
  ],
  rows: [{ id: 'r1', values: { c1: '1', c2: '2', c3: '3', c4: '4', c5: '5' }, enabled: true }],
};

function makeDraft(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    name: 'My Test',
    method: 'GET',
    url: 'https://api.example.com/1',
    dataSource,
    ...overrides,
  }) as Scenario;
}

describe('parseImportedDataRows coverage gaps', () => {
  it('returns null for JSON without rows array', () => {
    expect(parseImportedDataRows('{"version":1}', 'x.json', dataSource)).toBeNull();
  });

  it('marks disabled JSON rows when enabled is false', () => {
    const rows = parseImportedDataRows(
      JSON.stringify({ rows: [{ values: { id: '9' }, enabled: false }] }),
      'rows.json',
      dataSource,
    );
    expect(rows![0].enabled).toBe(false);
  });

  it('maps CSV headers via mapping name fallback', () => {
    const csv = 'id,qty\n7,8\n';
    const rows = parseImportedDataRows(csv, 'plain.csv', dataSource);
    expect(rows![0].values.c1).toBe('7');
    expect(rows![0].values.c2).toBe('8');
  });

  it('returns null when CSV has headers only', () => {
    expect(parseImportedDataRows('path:id\n', 'only-header.csv', dataSource)).toBeNull();
  });

  it('ignores CSV cells for unmapped headers', () => {
    const csv = 'path:id,unknown\n1,x\n';
    const rows = parseImportedDataRows(csv, 'partial.csv', dataSource);
    expect(rows![0].values.c1).toBe('1');
    expect(rows![0].values.c2).toBe('');
  });

  it('leaves values empty when CSV row has fewer cells than headers', () => {
    const csv = 'path:id,qty\nonly-id\n';
    const rows = parseImportedDataRows(csv, 'short.csv', dataSource);
    expect(rows![0].values.c1).toBe('only-id');
    expect(rows![0].values.c2).toBe('');
  });
});

describe('createTestEditorImportHandler', () => {
  let draft: Scenario;
  let draftRef: { current: Scenario };
  let onDraftChange: ReturnType<typeof vi.fn>;
  let toast: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    draft = makeDraft();
    draftRef = { current: draft };
    onDraftChange = vi.fn((next: Scenario) => {
      draft = next;
      draftRef.current = next;
    });
    toast = { show: vi.fn() };
    vi.mocked(pickJsonFile).mockReset();
  });

  function handler() {
    return createTestEditorImportHandler({
      draftRef,
      onDraftChange,
      syncParamsFromUrl: vi.fn(),
      inputMode: 'curlImport',
      onInputModeChange: vi.fn(),
      onActiveTabChange: vi.fn(),
      toast,
    });
  }

  it('imports test definition via pickJsonFile', () => {
    const onInputModeChange = vi.fn();
    const syncParamsFromUrl = vi.fn();
    const h = createTestEditorImportHandler({
      draftRef,
      onDraftChange,
      syncParamsFromUrl,
      inputMode: 'curlImport',
      onInputModeChange,
      onActiveTabChange: vi.fn(),
      toast,
    });
    vi.mocked(pickJsonFile).mockImplementation((cb) => {
      cb(makeDraft({ name: 'Imported', method: 'POST', url: 'https://x.com' }));
    });
    h('test-definition');
    expect(onDraftChange).toHaveBeenCalled();
    expect(syncParamsFromUrl).toHaveBeenCalledWith('https://x.com');
    expect(onInputModeChange).toHaveBeenCalledWith('builder');
  });

  it('rejects invalid test definition imports', () => {
    vi.mocked(pickJsonFile).mockImplementation((cb) => {
      cb({ method: 'GET' });
    });
    handler()('test-definition');
    expect(toast.show).toHaveBeenCalledWith('error', 'Invalid file', expect.any(String));
  });

  it('rejects HTTP import without url', () => {
    vi.mocked(pickJsonFile).mockImplementation((cb) => {
      cb({ name: 'X', method: 'GET', url: '  ' });
    });
    handler()('test-definition');
    expect(toast.show).toHaveBeenCalledWith('error', 'Invalid file', 'HTTP tests require a url.');
  });

  it('shows transport warnings and switches validation tab for websocket tests', () => {
    const onActiveTabChange = vi.fn();
    const onInputModeChange = vi.fn();
    vi.mocked(pickJsonFile).mockImplementation((cb) => {
      cb(makeDraft({
        name: 'WS',
        method: 'GET',
        actionType: 'wsConnect',
      }));
    });
    const h = createTestEditorImportHandler({
      draftRef,
      onDraftChange,
      syncParamsFromUrl: vi.fn(),
      inputMode: 'builder',
      onInputModeChange,
      onActiveTabChange,
      toast,
    });
    h('test-definition');
    expect(toast.show).toHaveBeenCalledWith('warning', 'Transport Config Issues', expect.any(String));
    expect(onActiveTabChange).toHaveBeenCalledWith('validation');
    expect(onInputModeChange).not.toHaveBeenCalled();
  });

  it('imports data rows from JSON file input', async () => {
    const h = handler();
    const json = JSON.stringify({ rows: [{ values: { id: '99' } }] });
    const file = { name: 'rows.json', text: async () => json } as File;
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [file], configurable: true });
      void this.onchange?.(new Event('change'));
    });
    h('data-rows');
    await Promise.resolve();
    expect(onDraftChange).toHaveBeenCalled();
    click.mockRestore();
  });

  it('no-ops data import when dataSource missing', () => {
    draftRef.current = makeDraft({ dataSource: undefined });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    handler()('data-rows');
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('ignores file input when no file selected', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [], configurable: true });
      void this.onchange?.(new Event('change'));
    });
    handler()('data-rows');
    await Promise.resolve();
    expect(onDraftChange).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('aborts row import when dataSource disappears before file read', async () => {
    const file = { name: 'rows.json', text: async () => JSON.stringify({ rows: [{ values: { id: '1' } }] }) } as File;
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [file], configurable: true });
      draftRef.current = makeDraft({ dataSource: undefined });
      void this.onchange?.(new Event('change'));
    });
    handler()('data-rows');
    await Promise.resolve();
    expect(onDraftChange).not.toHaveBeenCalled();
    click.mockRestore();
  });
});

describe('createTestEditorExportHandler', () => {
  let draftRef: { current: Scenario };

  beforeEach(() => {
    draftRef = { current: makeDraft() };
    vi.mocked(saveFile).mockReset();
  });

  it('exports test definition', () => {
    const onExportTest = vi.fn();
    createTestEditorExportHandler({ draftRef, onExportTest, setCsvExportOpen: vi.fn() })('test-definition');
    expect(onExportTest).toHaveBeenCalledWith(draftRef.current);
  });

  it('opens excel template export', () => {
    const setCsvExportOpen = vi.fn();
    createTestEditorExportHandler({ draftRef, onExportTest: vi.fn(), setCsvExportOpen })('excel-template');
    expect(setCsvExportOpen).toHaveBeenCalledWith(true);
  });

  it('exports data as CSV with typed headers', () => {
    draftRef.current = makeDraft({
      name: '',
      dataSource: {
        ...dataSource,
        columns: [
          ...dataSource.columns,
          { id: 'c6', name: 'misc', type: 'unknown' as DataSource['columns'][number]['type'], mapping: 'misc' },
        ],
      },
    });
    createTestEditorExportHandler({
      draftRef,
      onExportTest: vi.fn(),
      setCsvExportOpen: vi.fn(),
    })('data-csv');
    expect(saveFile).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ filename: 'data-source.csv', mimeType: 'text/csv' }),
    );
  });

  it('exports data as JSON metadata bundle', () => {
    draftRef.current = makeDraft({
      name: '',
      dataSource: {
        ...dataSource,
        urlTemplate: '',
        rows: [{ id: 'r1', values: dataSource.rows[0].values, enabled: true, tags: ['t1'], note: 'n1' }],
      },
    });
    createTestEditorExportHandler({
      draftRef,
      onExportTest: vi.fn(),
      setCsvExportOpen: vi.fn(),
    })('data-json');
    expect(saveFile).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ filename: 'data-source.json', mimeType: 'application/json' }),
    );
  });

  it('skips data export when dataSource missing', () => {
    draftRef.current = makeDraft({ dataSource: undefined });
    createTestEditorExportHandler({
      draftRef,
      onExportTest: vi.fn(),
      setCsvExportOpen: vi.fn(),
    })('data-csv');
    createTestEditorExportHandler({
      draftRef,
      onExportTest: vi.fn(),
      setCsvExportOpen: vi.fn(),
    })('data-json');
    expect(saveFile).not.toHaveBeenCalled();
  });
});

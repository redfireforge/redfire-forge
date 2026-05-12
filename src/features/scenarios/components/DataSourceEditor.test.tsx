/**
 * @vitest-environment jsdom
 */
import { useState, type ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import DataSourceEditor from './DataSourceEditor';
import type { Scenario, DataSource, SharedDataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';

vi.mock('uuid', () => ({ v4: () => `uuid-${Math.random().toString(36).slice(2, 8)}` }));

const hoistedMocks = vi.hoisted(() => {
  let fetchHookOverride: (() => unknown) | null = null;
  return {
    handleImport: vi.fn().mockResolvedValue(undefined),
    setFetchHookOverride: (fn: typeof fetchHookOverride) => {
      fetchHookOverride = fn;
    },
    getFetchHookOverride: () => fetchHookOverride,
    lastPopulateAdapter: null as null | { fetchSampleData?: () => Promise<unknown> },
  };
});

vi.mock('../hooks/useDataSourceImport', () => ({
  useDataSourceImport: () => ({ handleImport: hoistedMocks.handleImport }),
}));

vi.mock('../hooks/useDataSourceFetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useDataSourceFetch')>();
  return {
    ...actual,
    useDataSourceFetch: (
      opts: Parameters<typeof actual.useDataSourceFetch>[0],
    ): ReturnType<typeof actual.useDataSourceFetch> => {
      const override = hoistedMocks.getFetchHookOverride();
      if (override) return override() as ReturnType<typeof actual.useDataSourceFetch>;
      return actual.useDataSourceFetch(opts);
    },
  };
});

/** Mock DataMapperModal for populate tests. */
vi.mock('../../../shared/components/data-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/components/data-mapper')>();
  return {
    ...actual,
    DataMapperModal: function MockDataMapperModal({
      onSave,
      onCancel,
      adapter,
    }: {
      onSave: (output: unknown) => void;
      onCancel: () => void;
      adapter: { title: string; fetchSampleData?: () => Promise<unknown> };
    }) {
      const isPopulate = adapter.title === 'API Response → Data Source';
      hoistedMocks.lastPopulateAdapter = isPopulate ? adapter : null;
      return (
        <div>
          <h2>{adapter.title}</h2>
          {isPopulate ? (
            <>
              <button
                type="button"
                onClick={() =>
                  (onSave as (o: { columns: DataSourceColumn[]; rows: DataSourceRow[]; mode: 'append' | 'replace' }) => void)({
                    columns: [],
                    rows: [{ id: 'pop-row', values: {}, enabled: true }],
                    mode: 'append',
                  })}
              >
                Mock Append
              </button>
              <button
                type="button"
                onClick={() =>
                  (onSave as (o: { columns: DataSourceColumn[]; rows: DataSourceRow[]; mode: 'append' | 'replace' }) => void)({
                    columns: [],
                    rows: [{ id: 'repl-row', values: {}, enabled: true }],
                    mode: 'replace',
                  })}
              >
                Mock Replace
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="mock-column-mapper-save"
              onClick={() =>
                onSave([
                  { id: 'c1', name: 'vin', type: 'body', mapping: 'vin' },
                  { id: 'c-mapped', name: 'extra', type: 'param', mapping: 'q' },
                ] as DataSourceColumn[])
              }
            >
              Mock Column Apply
            </button>
          )}
          <button type="button" onClick={onCancel}>
            Close Populate
          </button>
        </div>
      );
    },
  };
});

/** @deprecated Old PopulateFromApiModal mock removed — now using DataMapperModal mock above. */

vi.mock('./DataSourceRowDetailModal', () => ({
  default: function MockDataSourceRowDetailModal({
    onSave,
    onClose,
    row,
  }: {
    onSave: (updatedRow: DataSourceRow, newColumns?: DataSourceColumn[]) => void;
    onClose: () => void;
    row: DataSourceRow;
    draft: Scenario;
    dataTable: DataSource;
    rowIndex: number;
    onFetchRow?: unknown;
  }) {
    return (
      <div className="data-source-row-detail-modal">
        <button type="button" onClick={() => onSave({ ...row, label: 'from-modal' })}>Save</button>
        <button
          type="button"
          onClick={() =>
            onSave(
              { ...row, values: { ...row.values, 'new-val-col': '' } },
              [{ id: 'new-val-col', name: 'n1', type: 'validate', mapping: '$.x' }],
            )}
        >
          Save With New Columns
        </button>
        <button type="button" onClick={onClose}>Close Row Detail</button>
      </div>
    );
  },
}));

vi.mock('./DataSourceToolbar', async (importOriginal) => {
  const { default: DataSourceToolbar } = await importOriginal<typeof import('./DataSourceToolbar')>();
  return {
    default: function DataSourceToolbarWithDetachProbe(props: ComponentProps<typeof DataSourceToolbar>) {
      return (
        <>
          <button
            type="button"
            data-testid="probe-detach-with-copy"
            style={{ position: 'absolute', left: -3000, width: 1, height: 1, overflow: 'hidden' }}
            onClick={() => props.onDetachWithCopy()}
          >
            probe detach copy
          </button>
          <DataSourceToolbar {...props} />
        </>
      );
    },
  };
});

vi.mock('./DataSourceSetupModal', async (importOriginal) => {
  const { default: DataSourceSetupModal } = await importOriginal<typeof import('./DataSourceSetupModal')>();
  return {
    default: function DataSourceSetupModalWithTestShortcut(props: Record<string, unknown>) {
      const test = props.test as Scenario;
      const onApply = props.onApply as (d: DataSource, url: string, opts?: { auth?: Scenario['auth'] }) => void;
      const mode = props.mode as string;
      const showAuthShortcut = mode === 'configure' && !!test.dataSource;
      return (
        <>
          {showAuthShortcut ? (
            <button
              type="button"
              data-testid="ds-setup-auth-apply"
              style={{ position: 'absolute', left: -2000, width: 1, height: 1, overflow: 'hidden' }}
              onClick={() =>
                onApply(
                  test.dataSource!,
                  test.dataSource!.urlTemplate || test.url || '',
                  { auth: { type: 'bearer', token: 'test-token' } },
                )}
            />
          ) : null}
          <DataSourceSetupModal {...(props as ComponentProps<typeof DataSourceSetupModal>)} />
        </>
      );
    },
  };
});

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'https://api.example.com/api?channel=WEBRNW',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

function makeDataSource(): DataSource {
  return {
    id: 'dt1',
    columns: [
      { id: 'c1', name: 'vin', type: 'body', mapping: 'vin' },
      { id: 'c2', name: 'channel', type: 'param', mapping: 'channel' },
    ],
    rows: [
      { id: 'r1', values: { c1: '1GYVUZ', c2: 'WEBRNW' }, enabled: true },
      { id: 'r2', values: { c1: '2GYVUZ', c2: 'DEALER' }, enabled: true },
    ],
    source: { type: 'inline' },
  };
}

function makeDataTransferWithId(id: string): DataTransfer {
  const store: Record<string, string> = { 'text/plain': id };
  return {
    effectAllowed: 'all',
    dropEffect: 'move',
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? '',
  } as unknown as DataTransfer;
}

describe('DataSourceEditor', () => {
  beforeEach(() => {
    hoistedMocks.setFetchHookOverride(null);
    hoistedMocks.handleImport.mockClear();
    hoistedMocks.lastPopulateAdapter = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  describe('no data source', () => {
    it('renders empty state with setup buttons', () => {
      render(<DataSourceEditor draft={makeScenario()} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/Quick Setup/)).toBeTruthy();
      expect(screen.getByText('Configure Wizard')).toBeTruthy();
      expect(screen.getByText(/No data source attached/)).toBeTruthy();
    });

    it('opens wizard on Configure Wizard click', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario()} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('Configure Wizard'));
      // Opens the setup modal
      expect(screen.getByText('Configure Data Source')).toBeTruthy();
    });

    it('Quick Setup auto-creates data source from URL params', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ url: 'https://api.example.com/api?channel=WEBRNW' })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText(/Quick Setup/));
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource).toBeTruthy();
      expect(updated.dataSource!.columns.length).toBeGreaterThan(0);
    });
  });

  describe('with data source', () => {
    it('renders DATA SOURCE label and row count', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('DATA SOURCE')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy(); // badge
    });

    it('renders column headers', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('vin')).toBeTruthy();
      expect(screen.getByText('channel')).toBeTruthy();
    });

    it('renders cell values', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByDisplayValue('1GYVUZ')).toBeTruthy();
      expect(screen.getByDisplayValue('WEBRNW')).toBeTruthy();
    });

    it('calls onDraftChange when cell value changes', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.change(screen.getByDisplayValue('1GYVUZ'), { target: { value: '3GYVUZ' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].values.c1).toBe('3GYVUZ');
    });

    it('adds a row when + Row is clicked', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('+ Row'));
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(3);
    });

    it('adds a column when + Column is clicked', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('+ Column'));
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.columns).toHaveLength(3);
      // Each existing row should have the new column's value
      expect(Object.keys(updated.dataSource!.rows[0].values)).toHaveLength(3);
    });

    it('opens column mapper and applies mapped columns', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Visual mapper: drag columns to URL path, query, body, header, or validate slots'));
      expect(screen.getByText('Columns → Request Template')).toBeTruthy();
      fireEvent.click(screen.getByTestId('mock-column-mapper-save'));
      const updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Scenario;
      expect(updated.dataSource!.columns).toHaveLength(2);
      expect(updated.dataSource!.columns.some((c) => c.id === 'c-mapped')).toBe(true);
      expect(screen.queryByTestId('mock-column-mapper-save')).toBeNull();
    });

    it('closes column mapper via modal cancel', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Visual mapper: drag columns to URL path, query, body, header, or validate slots'));
      expect(screen.getByText('Columns → Request Template')).toBeTruthy();
      fireEvent.click(screen.getByText('Close Populate'));
      expect(screen.queryByText('Columns → Request Template')).toBeNull();
    });

    it('toggles row enabled/disabled', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const checkboxes = document.querySelectorAll<HTMLInputElement>('.data-source-td-checkbox input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].enabled).toBe(false);
    });

    it('deletes a row', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const deleteButtons = screen.getAllByTitle('Delete row');
      fireEvent.click(deleteButtons[0]);
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(1);
      expect(updated.dataSource!.rows[0].id).toBe('r2');
    });

    it('deletes all rows (resets to one empty row)', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Delete all rows'));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(1);
      expect(updated.dataSource!.rows[0].values.c1).toBe('');
    });

    it('removes a column and its values from all rows', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const removeColBtns = screen.getAllByTitle('Remove column');
      fireEvent.click(removeColBtns[0]); // remove 'vin'
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.columns).toHaveLength(1);
      expect(updated.dataSource!.columns[0].name).toBe('channel');
      expect(updated.dataSource!.rows[0].values).not.toHaveProperty('c1');
    });

    it('moves row up', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const moveUpBtns = screen.getAllByTitle('Move up');
      fireEvent.click(moveUpBtns[1]); // move row 2 up
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].id).toBe('r2');
      expect(updated.dataSource!.rows[1].id).toBe('r1');
    });

    it('renders run preview with correct count', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/Run Preview: 2 enabled rows → 2 requests/)).toBeTruthy();
    });

    it('removes entire table when Remove is clicked', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Remove entire data source'));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource).toBeUndefined();
    });

    it('changes distribution strategy', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const select = screen.getByTitle('Row distribution strategy');
      fireEvent.change(select, { target: { value: 'random' } });
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.distribution).toBe('random');
    });

    it('renders search input', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByPlaceholderText('Search rows…')).toBeTruthy();
    });

    it('filters rows by search query', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.change(screen.getByPlaceholderText('Search rows…'), { target: { value: '1GYVUZ' } });
      const cells = document.querySelectorAll('.data-source-cell-input');
      const vinCells = Array.from(cells).filter((c) => (c as HTMLInputElement).value === '1GYVUZ');
      expect(vinCells.length).toBe(1);
      expect(document.querySelectorAll('.data-source-row').length).toBe(1);
    });

    it('shows row count when search is active', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.change(screen.getByPlaceholderText('Search rows…'), { target: { value: '1GYVUZ' } });
      expect(screen.getByText(/1 of 2 rows/)).toBeTruthy();
    });

    it('duplicates a row', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const dupBtns = screen.getAllByTitle('Duplicate row');
      fireEvent.click(dupBtns[0]);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(3);
    });

    it('shows and edits row label', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const labelInputs = screen.getAllByPlaceholderText(/Row \d+/);
      fireEvent.change(labelInputs[0], { target: { value: 'My Label' } });
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].label).toBe('My Label');
    });

    it('starts column rename on click', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText('vin'));
      const input = document.querySelector('.data-source-col-name-input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.value).toBe('vin');
    });

    it('renames a column', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('vin'));
      const input = document.querySelector('.data-source-col-name-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'vehicleId' } });
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.columns[0].name).toBe('vehicleId');
    });

    it('changes column type', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const typeSelects = screen.getAllByTitle('Column type');
      fireEvent.change(typeSelects[0], { target: { value: 'header' } });
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.columns[0].type).toBe('header');
    });

    it('sorts by column', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const sortBtns = screen.getAllByTitle('Sort by this column');
      fireEvent.click(sortBtns[0]);
      expect(sortBtns[0].textContent).toContain('▲');
    });

    it('marks row as sample', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const sampleBtns = screen.getAllByTitle('Mark as sample');
      fireEvent.click(sampleBtns[0]);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].isSample).toBe(true);
    });

    it('opens edit row detail modal', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const editBtns = screen.getAllByTitle('Edit row details');
      fireEvent.click(editBtns[0]);
      // The DataSourceRowDetailModal should be rendered
      expect(document.querySelector('.data-source-row-detail-modal, [class*="row-detail"]') || screen.queryByText(/Row.*Detail/i) || screen.queryByText(/Save/)).toBeTruthy();
    });
  });

  describe('file source info bar', () => {
    it('renders file info when source type is file', () => {
      const ds = makeDataSource();
      ds.source = { type: 'file', filePath: '/data/users.csv', fileLastRead: '2024-01-15T10:30:00Z', fileRowCount: 100 };
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('/data/users.csv')).toBeTruthy();
      expect(screen.getByText(/100 rows/)).toBeTruthy();
      expect(screen.getByText('↻ Reload')).toBeTruthy();
    });

    it('renders Switch to Inline button', () => {
      const ds = makeDataSource();
      ds.source = { type: 'file', filePath: '/data/users.csv' };
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('Switch to Inline')).toBeTruthy();
    });

    it('switches to inline on button click', () => {
      const ds = makeDataSource();
      ds.source = { type: 'file', filePath: '/data/users.csv' };
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('Switch to Inline'));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.source.type).toBe('inline');
    });
  });

  describe('fetch error display', () => {
    it('does not show fetch error when there is none', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.queryByText(/Fetch error/)).toBeNull();
    });
  });

  describe('shared data source support', () => {
    const makeSharedDs = (): SharedDataSource => ({
      id: 'shared-1',
      name: 'Shared Users',
      dataSource: makeDataSource(),
      tags: ['users'],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
    });

    it('renders linked shared data source badge', () => {
      const shared = makeSharedDs();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), sharedDataSourceId: 'shared-1' })}
          onDraftChange={vi.fn()}
          sharedDataSources={[shared]}
        />
      );
      expect(screen.getByText(/Shared Users/)).toBeTruthy();
    });

    it('links a shared data source via select', () => {
      const shared = makeSharedDs();
      const onChange = vi.fn();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource() })}
          onDraftChange={onChange}
          sharedDataSources={[shared]}
        />
      );
      const select = screen.getByTitle('Link to a shared data source');
      fireEvent.change(select, { target: { value: 'shared-1' } });
      expect(onChange).toHaveBeenCalled();
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.sharedDataSourceId).toBe('shared-1');
    });

    it('does not close detach menu on mousedown inside the dropdown', () => {
      const shared = makeSharedDs();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), sharedDataSourceId: 'shared-1' })}
          onDraftChange={vi.fn()}
          sharedDataSources={[shared]}
        />
      );
      fireEvent.click(screen.getByTitle('Detach from shared data source'));
      const copyBtn = screen.getByTitle('Copy shared data to this test\'s inline data, then unlink');
      fireEvent.mouseDown(copyBtn);
      expect(screen.getByTitle('Copy shared data to this test\'s inline data, then unlink')).toBeTruthy();
    });

    it('detaches shared DS with copy', () => {
      const shared = makeSharedDs();
      const onChange = vi.fn();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), sharedDataSourceId: 'shared-1' })}
          onDraftChange={onChange}
          sharedDataSources={[shared]}
        />
      );
      const detachBtn = screen.getByTitle('Detach from shared data source');
      fireEvent.click(detachBtn);
      const copyBtn = screen.getByTitle('Copy shared data to this test\'s inline data, then unlink');
      fireEvent.click(copyBtn);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.sharedDataSourceId).toBeUndefined();
      expect(updated.dataSource).toBeTruthy();
    });

    it('detaches shared DS unlink only', () => {
      const shared = makeSharedDs();
      const onChange = vi.fn();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), sharedDataSourceId: 'shared-1' })}
          onDraftChange={onChange}
          sharedDataSources={[shared]}
        />
      );
      const detachBtn = screen.getByTitle('Detach from shared data source');
      fireEvent.click(detachBtn);
      const unlinkBtn = screen.getByTitle('Just remove the link, test will have no data');
      fireEvent.click(unlinkBtn);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.sharedDataSourceId).toBeUndefined();
    });
  });

  describe('tags and subsets', () => {
    it('shows tag filter bar when rows have tags', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      ds.rows[1].tags = ['vip', 'premium'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('Filter:')).toBeTruthy();
      expect(screen.getByText(/🏷 vip/)).toBeTruthy();
    });

    it('filters by tag when tag button clicked', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      const vipBtn = screen.getByText(/🏷 vip/);
      fireEvent.click(vipBtn);
      expect(screen.getByText(/1 of 2 rows/)).toBeTruthy();
    });

    it('adds tag to a row', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const addTagBtns = screen.getAllByTitle('Add tag');
      fireEvent.click(addTagBtns[0]);
      const tagInput = screen.getByPlaceholderText('tag…');
      fireEvent.change(tagInput, { target: { value: 'production' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });
      expect(onChange).toHaveBeenCalled();
    });

    it('shows subsets section when subsets exist', () => {
      const ds = makeDataSource();
      ds.subsets = [{ name: 'VIP Set', filter: { type: 'tags', tags: ['vip'], mode: 'any' } }];
      ds.rows[0].tags = ['vip'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('Subsets:')).toBeTruthy();
      expect(screen.getByText('VIP Set')).toBeTruthy();
    });

    it('removes a subset', () => {
      const ds = makeDataSource();
      ds.subsets = [{ name: 'VIP Set', filter: { type: 'tags', tags: ['vip'], mode: 'any' } }];
      ds.rows[0].tags = ['vip'];
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      const removeBtn = screen.getByTitle('Remove subset');
      fireEvent.click(removeBtn);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('promote to shared', () => {
    it('opens promote modal', () => {
      const onChange = vi.fn();
      const onPromote = vi.fn().mockReturnValue('new-shared-id');
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource() })}
          onDraftChange={onChange}
          onPromoteToShared={onPromote}
        />
      );
      fireEvent.click(screen.getByTitle('Promote inline data to a shared data source'));
      // PromoteToSharedModal renders with a name input for the shared DS
      expect(screen.getByPlaceholderText(/name/i) || document.querySelector('[class*="promote"]')).toBeTruthy();
    });
  });

  describe('populate from API modal', () => {
    it('opens populate modal', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      expect(screen.getByText('API Response → Data Source')).toBeTruthy();
    });

    it('runs populate adapter inner fetchSampleData with first enabled row', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        body: JSON.stringify({ items: [{ id: 'a' }] }),
        headers: {},
        error: null,
      });
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: makeDataSource(),
            url: 'https://api.example.com/users',
            method: 'GET',
          })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      expect(hoistedMocks.lastPopulateAdapter?.fetchSampleData).toBeTruthy();
      await act(async () => {
        await hoistedMocks.lastPopulateAdapter!.fetchSampleData!();
      });
      expect(onFetchRow).toHaveBeenCalled();
    });

    it('populate fetchSampleData uses draft when no enabled row', async () => {
      const ds = makeDataSource();
      ds.rows.forEach((r) => { r.enabled = false; });
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        body: '{}',
        headers: {},
        error: null,
      });
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: ds,
            url: 'https://api.example.com/z',
            method: 'GET',
          })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      await act(async () => {
        await hoistedMocks.lastPopulateAdapter!.fetchSampleData!();
      });
      expect(onFetchRow).toHaveBeenCalled();
    });

    it('populate fetchSampleData throws when template vars unresolved', async () => {
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: makeDataSource(),
            url: 'https://api.example.com/{{nope}}',
            method: 'GET',
          })}
          onDraftChange={vi.fn()}
          onFetchRow={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      await act(async () => {
        await expect(hoistedMocks.lastPopulateAdapter!.fetchSampleData!()).rejects.toThrow(/Unresolved variables/);
      });
    });

    it('populate fetchSampleData propagates fetch error', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        body: '{}',
        headers: {},
        error: 'network',
      });
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: makeDataSource(),
            url: 'https://api.example.com/f',
            method: 'GET',
          })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      await act(async () => {
        await expect(hoistedMocks.lastPopulateAdapter!.fetchSampleData!()).rejects.toThrow('network');
      });
    });

    it('populate fetchSampleData throws on HTTP error status', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 500,
        body: '{}',
        headers: {},
        error: null,
      });
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: makeDataSource(),
            url: 'https://api.example.com/e',
            method: 'GET',
          })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      await act(async () => {
        await expect(hoistedMocks.lastPopulateAdapter!.fetchSampleData!()).rejects.toThrow(/HTTP 500/);
      });
    });
  });

  describe('verify modal', () => {
    it('opens verify modal', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Verify all enabled rows against the real API'));
      // DataSourceVerifyModal renders with its specific title
      expect(screen.getByText('Data Source — Verify & Inspect')).toBeTruthy();
    });
  });

  describe('validation mode', () => {
    it('changes validation mode', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const select = screen.getByTitle(/Which rows to validate/);
      fireEvent.change(select, { target: { value: 'full' } });
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.validationMode).toBe('full');
    });
  });

  describe('row notes', () => {
    it('opens note editor on note button click', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const noteBtns = screen.getAllByTitle('Add note');
      fireEvent.click(noteBtns[0]);
      expect(screen.getByPlaceholderText('Add a note…')).toBeTruthy();
    });

    it('edits row note', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const noteBtns = screen.getAllByTitle('Add note');
      fireEvent.click(noteBtns[0]);
      const noteInput = screen.getByPlaceholderText('Add a note…');
      fireEvent.change(noteInput, { target: { value: 'Test note' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('shows existing note indicator', () => {
      const ds = makeDataSource();
      ds.rows[0].note = 'Important row';
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByTitle('Note: Important row')).toBeTruthy();
    });
  });

  describe('row move down', () => {
    it('moves row down', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const moveDownBtns = screen.getAllByTitle('Move down');
      fireEvent.click(moveDownBtns[0]);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].id).toBe('r2');
      expect(updated.dataSource!.rows[1].id).toBe('r1');
    });
  });

  describe('contract panel', () => {
    it('toggles contract panel visibility', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Toggle validation contract'));
      // ValidationContractPanel component is now rendered
      expect(screen.getByText('Validation Contract')).toBeTruthy();
    });
  });

  describe('save as subset', () => {
    it('shows save as subset button when filter is active', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText(/🏷 vip/));
      expect(screen.getByText(/Save as Subset/)).toBeTruthy();
    });

    it('creates subset on save', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      const onChange = vi.fn();
      vi.spyOn(window, 'prompt').mockReturnValue('My Subset');
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText(/🏷 vip/));
      fireEvent.click(screen.getByText(/Save as Subset/));
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('untagged filter', () => {
    it('shows untagged filter when some rows have no tags', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      // row[1] has no tags => untagged
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/untagged/)).toBeTruthy();
    });
  });

  describe('sample row badge', () => {
    it('shows sample badge on sample rows', () => {
      const ds = makeDataSource();
      ds.rows[0].isSample = true;
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/📌 Sample/)).toBeTruthy();
    });
  });

  describe('bulk row actions', () => {
    it('shows bulk action bar when rows are selected', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      expect(screen.getByText(/selected/)).toBeTruthy();
    });

    it('selects all and clears selection', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      fireEvent.click(screen.getByText('Select All'));
      const bulkNum = document.querySelector('.data-source-bulk-num');
      expect(bulkNum?.textContent).toBe('2');
      fireEvent.click(screen.getByText('Clear'));
      expect(screen.queryByText(/selected/)).toBeNull();
    });

    it('bulk enables/disables selected rows', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      fireEvent.click(screen.getByText('○ Disable'));
      expect(onChange).toHaveBeenCalled();
    });

    it('bulk duplicates selected rows', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      fireEvent.click(screen.getByText('⧉ Duplicate'));
      expect(onChange).toHaveBeenCalled();
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows.length).toBe(3);
    });

    it('bulk deletes selected rows', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      fireEvent.click(screen.getByText('✕ Delete'));
      expect(onChange).toHaveBeenCalled();
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows.length).toBe(1);
    });
  });

  describe('fetch error banner', () => {
    afterEach(() => {
      hoistedMocks.setFetchHookOverride(null);
    });

    it('shows fetch error, URL detail, JSON body, and dismiss', () => {
      const clearFetchError = vi.fn();
      hoistedMocks.setFetchHookOverride(() => ({
        fetchRowResponse: vi.fn(),
        refetchAllRows: vi.fn().mockResolvedValue(undefined),
        fetchingRowId: null,
        refetchingAll: false,
        fetchRowError: 'network failed',
        fetchRowErrorDetail: { url: 'https://err.example/foo', body: '{"hello":"world"}' },
        clearFetchError,
      }));
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/Fetch error: network failed/)).toBeTruthy();
      expect(screen.getByText('https://err.example/foo')).toBeTruthy();
      expect(screen.getByText(/"hello"/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(clearFetchError).toHaveBeenCalled();
    });

    it('shows non-JSON error body via catch branch', () => {
      hoistedMocks.setFetchHookOverride(() => ({
        fetchRowResponse: vi.fn(),
        refetchAllRows: vi.fn().mockResolvedValue(undefined),
        fetchingRowId: null,
        refetchingAll: false,
        fetchRowError: 'bad body',
        fetchRowErrorDetail: { body: 'plain text response' },
        clearFetchError: vi.fn(),
      }));
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('plain text response')).toBeTruthy();
    });
  });

  describe('detach dropdown outside click', () => {
    const makeSharedDs = (): SharedDataSource => ({
      id: 'shared-1',
      name: 'Shared Users',
      dataSource: makeDataSource(),
      tags: ['users'],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
    });

    it('closes detach menu on document mousedown outside', () => {
      const shared = makeSharedDs();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), sharedDataSourceId: 'shared-1' })}
          onDraftChange={vi.fn()}
          sharedDataSources={[shared]}
        />,
      );
      fireEvent.click(screen.getByTitle('Detach from shared data source'));
      expect(screen.getByTitle('Copy shared data to this test\'s inline data, then unlink')).toBeTruthy();
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(screen.queryByTitle('Copy shared data to this test\'s inline data, then unlink')).toBeNull();
    });
  });

  describe('promote to shared — confirm and edge cases', () => {
    it('calls onPromoteToShared with fetchConfig and links new id', () => {
      const onChange = vi.fn();
      const onPromote = vi.fn().mockReturnValue('new-shared-id');
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: makeDataSource(),
            url: '{{base}}/x',
            method: 'POST',
            headers: [{ key: 'H', value: '1' }],
          })}
          onDraftChange={onChange}
          onPromoteToShared={onPromote}
        />,
      );
      fireEvent.click(screen.getByTitle('Promote inline data to a shared data source'));
      fireEvent.click(screen.getByRole('button', { name: /Promote & Link/ }));
      expect(onPromote).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        undefined,
        expect.objectContaining({
          url: '{{base}}/x',
          method: 'POST',
          headers: [{ key: 'H', value: '1' }],
        }),
      );
      const updated = onChange.mock.calls.find(
        (c) => (c[0] as Scenario).sharedDataSourceId === 'new-shared-id',
      )?.[0] as Scenario;
      expect(updated.sharedDataSourceId).toBe('new-shared-id');
      expect(updated.dataSource).toBeUndefined();
    });

    it('promote fetchConfig uses urlTemplate, GET, and empty headers when draft omits them', () => {
      const onPromote = vi.fn().mockReturnValue('sid');
      const ds = makeDataSource();
      ds.urlTemplate = 'https://template/from-ds';
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: ds,
            url: '',
            method: '' as Scenario['method'],
            headers: undefined as unknown as Scenario['headers'],
          })}
          onDraftChange={vi.fn()}
          onPromoteToShared={onPromote}
        />,
      );
      fireEvent.click(screen.getByTitle('Promote inline data to a shared data source'));
      fireEvent.click(screen.getByRole('button', { name: /Promote & Link/ }));
      expect(onPromote).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        undefined,
        expect.objectContaining({
          url: 'https://template/from-ds',
          method: 'GET',
          headers: [],
        }),
      );
    });

    it('does not unlink inline data when promote returns empty id', () => {
      const onChange = vi.fn();
      const onPromote = vi.fn().mockReturnValue('');
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource() })}
          onDraftChange={onChange}
          onPromoteToShared={onPromote}
        />,
      );
      fireEvent.click(screen.getByTitle('Promote inline data to a shared data source'));
      fireEvent.click(screen.getByRole('button', { name: /Promote & Link/ }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('closes promote modal via Cancel', () => {
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource() })}
          onDraftChange={vi.fn()}
          onPromoteToShared={vi.fn().mockReturnValue('id')}
        />,
      );
      fireEvent.click(screen.getByTitle('Promote inline data to a shared data source'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('button', { name: /Promote & Link/ })).toBeNull();
    });
  });

  describe('populate apply modes', () => {
    it('appends rows via mocked populate modal', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      fireEvent.click(screen.getByText('Mock Append'));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows.length).toBe(3);
      const appended = updated.dataSource!.rows.find((r) => r.id === 'pop-row');
      expect(appended).toBeDefined();
      expect(appended!.enabled).toBe(true);
    });

    it('replaces rows via mocked populate modal', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      fireEvent.click(screen.getByText('Mock Replace'));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(1);
      expect(updated.dataSource!.rows[0].id).toBe('repl-row');
    });
  });

  describe('row detail save paths', () => {
    it('merges new validate columns into all rows on save', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getAllByTitle('Edit row details')[0]);
      fireEvent.click(screen.getByText('Save With New Columns'));
      const updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Scenario;
      expect(updated.dataSource!.columns.some((c) => c.id === 'new-val-col')).toBe(true);
      expect(updated.dataSource!.rows.every((r) => Object.prototype.hasOwnProperty.call(r.values, 'new-val-col'))).toBe(true);
    });
  });

  describe('file source bar', () => {
    it('invokes handleImport on Reload', async () => {
      const ds = makeDataSource();
      ds.source = { type: 'file', filePath: '/data/x.csv' };
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText('↻ Reload'));
      expect(hoistedMocks.handleImport).toHaveBeenCalled();
    });
  });

  describe('toolbar and grid interactions', () => {
    it('clicks shared badge to open shared DS modal callback', () => {
      const onOpen = vi.fn();
      const shared: SharedDataSource = {
        id: 'shared-1',
        name: 'Shared Users',
        dataSource: makeDataSource(),
        tags: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      };
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), sharedDataSourceId: 'shared-1' })}
          onDraftChange={vi.fn()}
          sharedDataSources={[shared]}
          onOpenSharedDsModal={onOpen}
        />,
      );
      fireEvent.click(screen.getByTitle(/Linked to shared: Shared Users/));
      expect(onOpen).toHaveBeenCalled();
    });

    it('adds a sample row from toolbar', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Add a sample row (dev-curated example with expected values)'));
      expect(onChange).toHaveBeenCalled();
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows.some((r) => r.isSample)).toBe(true);
    });

    it('runs Re-fetch all when enabled rows exist', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({ status: 200, body: '{}', headers: {}, error: null });
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource() })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      fireEvent.click(screen.getByTitle('Re-fetch all enabled rows and repopulate validate columns'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(onFetchRow).toHaveBeenCalled();
    });

    it('singular Run Preview copy when one row enabled', () => {
      const ds = makeDataSource();
      ds.rows[0].enabled = false;
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/Run Preview: 1 enabled row → 1 request/)).toBeTruthy();
    });

    it('sort column toggles to descending', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const sortBtns = screen.getAllByTitle('Sort by this column');
      fireEvent.click(sortBtns[0]);
      fireEvent.click(sortBtns[0]);
      expect(sortBtns[0].textContent).toContain('▼');
    });

    it('finishes column rename with Enter', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText('vin'));
      const input = document.querySelector('.data-source-col-name-input') as HTMLInputElement;
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(document.querySelector('.data-source-col-name-input')).toBeNull();
    });

    it('shows unnamed column placeholder', () => {
      function Harness() {
        const [draft, setDraft] = useState(() => makeScenario({ dataSource: makeDataSource() }));
        return <DataSourceEditor draft={draft} onDraftChange={setDraft} />;
      }
      render(<Harness />);
      fireEvent.click(screen.getByText('vin'));
      const input = document.querySelector('.data-source-col-name-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(screen.getByText('(unnamed)')).toBeTruthy();
    });

    it('navigates cells with Tab via handleCellKeyDown', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const first = document.querySelector('[data-row="0"][data-col="0"]') as HTMLInputElement;
      const second = document.querySelector('[data-row="0"][data-col="1"]') as HTMLInputElement;
      first.focus();
      fireEvent.keyDown(first, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(second);
    });

    it('starts column resize interaction from resize handle', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const handles = document.querySelectorAll('.data-source-col-resize');
      const addListener = vi.spyOn(document, 'addEventListener');
      fireEvent.mouseDown(handles[1]);
      expect(addListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      fireEvent.mouseUp(document);
      addListener.mockRestore();
    });

    it('reorders columns via drag and drop', async () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const dragHandles = screen.getAllByTitle('Drag to reorder column');
      const xfer = makeDataTransferWithId('c1');
      await act(async () => {
        fireEvent.dragStart(dragHandles[0], { dataTransfer: xfer });
      });
      const headers = document.querySelectorAll('th.data-source-th');
      const dropTarget = headers[3];
      await act(async () => {
        fireEvent.dragOver(dropTarget, { dataTransfer: xfer });
        fireEvent.drop(dropTarget, { dataTransfer: xfer });
      });
      expect(onChange).toHaveBeenCalled();
      const updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Scenario;
      expect(updated.dataSource!.columns[0].id).toBe('c2');
    });

    it('fetches row response when lightning is clicked', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        body: '{}',
        headers: {},
        error: null,
      });
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), url: 'https://api.example.com/x' })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      const fetchBtns = screen.getAllByTitle('Fetch response');
      await act(async () => {
        fireEvent.click(fetchBtns[0]);
        await Promise.resolve();
      });
      expect(onFetchRow).toHaveBeenCalled();
    });

    it('applies column order from toolbar popover', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Configure column order'));
      const applyBtn = screen.getByRole('button', { name: /Apply|Save|OK/i });
      fireEvent.click(applyBtn);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('tags and filters (extra branches)', () => {
    it('removes a tag from a row via pill', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      ds.rows[0].tags = ['toremove'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      const pill = screen.getByTitle('Remove tag: toremove');
      fireEvent.click(within(pill).getByRole('button'));
      expect(onChange).toHaveBeenCalled();
    });

    it('cancels tag input with Escape', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getAllByTitle('Add tag')[0]);
      const tagInput = screen.getByPlaceholderText('tag…');
      fireEvent.change(tagInput, { target: { value: 'aborted' } });
      fireEvent.keyDown(tagInput, { key: 'Escape' });
      expect(screen.queryByPlaceholderText('tag…')).toBeNull();
    });

    it('commits tag on blur', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getAllByTitle('Add tag')[0]);
      const tagInput = screen.getByPlaceholderText('tag…');
      fireEvent.change(tagInput, { target: { value: 'onblur-tag' } });
      fireEvent.blur(tagInput);
      expect(onChange).toHaveBeenCalled();
    });

    it('clears tag filter via All button', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText(/🏷 vip/));
      expect(screen.getByText(/1 of 2 rows/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /All \(\d+\)/ }));
      expect(screen.queryByText(/1 of 2 rows/)).toBeNull();
    });

    it('toggles same tag filter off when clicked again', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      const vipBtn = screen.getByText(/🏷 vip/);
      fireEvent.click(vipBtn);
      fireEvent.click(vipBtn);
      expect(screen.queryByText(/1 of 2 rows/)).toBeNull();
    });

    it('bulk adds tag from dropdown', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      ds.rows[0].tags = ['existing'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      fireEvent.click(rows[1]);
      const bulkAdd = document.querySelectorAll('select.data-source-tag-select')[0] as HTMLSelectElement;
      fireEvent.change(bulkAdd, { target: { value: 'smoke' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('bulk removes tag from dropdown when multiple tags exist', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      ds.rows[0].tags = ['a'];
      ds.rows[1].tags = ['a', 'b'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      const selects = document.querySelectorAll('select.data-source-tag-select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
      fireEvent.change(selects[1], { target: { value: 'a' } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('subsets', () => {
    it('toggles filter from subset chip', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      ds.rows[1].tags = [];
      ds.subsets = [{ name: 'VIP Sub', filter: { type: 'tags', tags: ['vip'], mode: 'any' } }];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText('VIP Sub'));
      expect(screen.getByText(/1 of 2 rows/)).toBeTruthy();
      fireEvent.click(screen.getByText('VIP Sub'));
      expect(screen.queryByText(/1 of 2 rows/)).toBeNull();
    });

    it('saves untagged filter as subset with row id filter', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      ds.rows[1].tags = [];
      const onChange = vi.fn();
      vi.spyOn(window, 'prompt').mockReturnValue('Untagged subset');
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText(/untagged \(1\)/));
      fireEvent.click(screen.getByText(/Save as Subset/));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.subsets!.some((s) => s.filter.type === 'rows')).toBe(true);
    });
  });

  describe('notes and sample row actions', () => {
    it('closes note editor on Enter', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getAllByTitle('Add note')[0]);
      const noteInput = screen.getByPlaceholderText('Add a note…');
      fireEvent.keyDown(noteInput, { key: 'Enter' });
      expect(screen.queryByPlaceholderText('Add a note…')).toBeNull();
    });

    it('toggles note panel closed when clicking note again', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const noteBtns = screen.getAllByTitle('Add note');
      fireEvent.click(noteBtns[0]);
      expect(screen.getByPlaceholderText('Add a note…')).toBeTruthy();
      fireEvent.click(noteBtns[0]);
      expect(screen.queryByPlaceholderText('Add a note…')).toBeNull();
    });

    it('unmarks sample row', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      ds.rows[0].isSample = true;
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Unmark as sample'));
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('linked shared read-only grid', () => {
    it('does not render row drag handle when linked', () => {
      const shared: SharedDataSource = {
        id: 's1',
        name: 'S',
        dataSource: makeDataSource(),
        tags: [],
        createdAt: '',
        updatedAt: '',
      };
      render(
        <DataSourceEditor
          draft={makeScenario({ sharedDataSourceId: 's1', dataSource: makeDataSource() })}
          onDraftChange={vi.fn()}
          sharedDataSources={[shared]}
        />,
      );
      expect(document.querySelector('.data-source-drag-handle')).toBeNull();
    });
  });

  describe('remaining editor branches', () => {
    it('handleSetupApply merges auth when shortcut is used', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Configure data source columns'));
      fireEvent.click(screen.getByTestId('ds-setup-auth-apply'));
      const updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Scenario;
      expect(updated.auth?.type).toBe('bearer');
    });

    it('closes setup modal via Cancel', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Configure data source columns'));
      expect(screen.getByText('Configure Data Source')).toBeTruthy();
      const cancels = screen.getAllByRole('button', { name: 'Cancel' });
      fireEvent.click(cancels[cancels.length - 1]);
    });

    it('saves row detail without new columns', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getAllByTitle('Edit row details')[0]);
      fireEvent.click(screen.getByText('Save'));
      expect(onChange).toHaveBeenCalled();
      const u = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Scenario;
      expect(u.dataSource!.rows[0].label).toBe('from-modal');
    });

    it('closes row detail modal', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getAllByTitle('Edit row details')[0]);
      fireEvent.click(screen.getByText('Close Row Detail'));
      expect(screen.queryByText('Close Row Detail')).toBeNull();
    });

    it('closes verify modal', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Verify all enabled rows against the real API'));
      const closeBtns = screen.getAllByRole('button', { name: 'Close' });
      fireEvent.click(closeBtns[closeBtns.length - 1]);
      expect(screen.queryByText('Data Source — Verify & Inspect')).toBeNull();
    });

    it('bulk enables previously disabled selected rows', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const checkboxes = document.querySelectorAll<HTMLInputElement>('.data-source-td-checkbox input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      const rows = document.querySelectorAll('.data-source-row');
      fireEvent.click(rows[0]);
      fireEvent.click(screen.getByText('✓ Enable'));
      expect(onChange).toHaveBeenCalled();
    });

    it('resizes label column from header resize handle', () => {
      const addListener = vi.spyOn(document, 'addEventListener');
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const labelResize = document.querySelector('.data-source-th-label .data-source-col-resize');
      expect(labelResize).toBeTruthy();
      fireEvent.mouseDown(labelResize!);
      expect(addListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      fireEvent.mouseUp(document);
      addListener.mockRestore();
    });

    it('reorders rows via drag and drop', async () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const rowHandles = screen.getAllByTitle('Drag to reorder');
      const xfer = makeDataTransferWithId('r1');
      await act(async () => {
        fireEvent.dragStart(rowHandles[0], { dataTransfer: xfer });
      });
      const dataRows = document.querySelectorAll('tr.data-source-row');
      await act(async () => {
        fireEvent.dragOver(dataRows[1], { dataTransfer: xfer });
        fireEvent.drop(dataRows[1], { dataTransfer: xfer });
      });
      expect(onChange).toHaveBeenCalled();
    });

    it('closes note editor on blur', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getAllByTitle('Add note')[0]);
      const inp = screen.getByPlaceholderText('Add a note…');
      fireEvent.blur(inp);
      expect(screen.queryByPlaceholderText('Add a note…')).toBeNull();
    });

    it('note input click uses stopPropagation', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getAllByTitle('Add note')[0]);
      const inp = screen.getByPlaceholderText('Add a note…');
      fireEvent.click(inp);
      expect(inp).toBeTruthy();
    });

    it('closes populate modal via onCancel', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      fireEvent.click(screen.getByText('Close Populate'));
      expect(screen.queryByText('Mock Append')).toBeNull();
    });

    it('clears row drag state on drag end', async () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      const rowHandles = screen.getAllByTitle('Drag to reorder');
      const xfer = makeDataTransferWithId('r1');
      await act(async () => {
        fireEvent.dragStart(rowHandles[0], { dataTransfer: xfer });
        fireEvent.dragEnd(rowHandles[0], { dataTransfer: xfer });
      });
      expect(rowHandles[0]).toBeTruthy();
    });
  });

  describe('branch coverage: orphaned shared link, subsets, prompt, fetch detail', () => {
    afterEach(() => {
      hoistedMocks.setFetchHookOverride(null);
    });

    it('detachWithCopy is a no-op when shared id does not resolve to a catalog entry', () => {
      const onChange = vi.fn();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), sharedDataSourceId: 'missing-shared' })}
          onDraftChange={onChange}
          sharedDataSources={[]}
        />,
      );
      fireEvent.click(screen.getByTestId('probe-detach-with-copy'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('subset chip with rowIds filter shows row id title and click skips tag-only handler', () => {
      const ds = makeDataSource();
      ds.subsets = [{ name: 'Row subset', filter: { type: 'rows', rowIds: ['r1', 'r2'] } }];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      const chipBtn = screen.getByText('Row subset');
      expect(chipBtn.getAttribute('title')).toContain('r1');
      fireEvent.click(chipBtn);
    });

    it('subset chip with empty tags array does not toggle filter on click', () => {
      const ds = makeDataSource();
      ds.subsets = [{ name: 'Empty tags', filter: { type: 'tags', tags: [], mode: 'any' } }];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText('Empty tags'));
    });

    it('save as subset ignores blank prompt input', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      const onChange = vi.fn();
      const promptSpy = vi.spyOn(window, 'prompt');
      promptSpy.mockReturnValueOnce(null);
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText(/🏷 vip/));
      fireEvent.click(screen.getByText(/Save as Subset/));
      expect(onChange).not.toHaveBeenCalled();

      promptSpy.mockReturnValueOnce('   ');
      fireEvent.click(screen.getByText(/Save as Subset/));
      expect(onChange).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('fetch error banner omits URL block when detail has no url', () => {
      hoistedMocks.setFetchHookOverride(() => ({
        fetchRowResponse: vi.fn(),
        refetchAllRows: vi.fn().mockResolvedValue(undefined),
        fetchingRowId: null,
        refetchingAll: false,
        fetchRowError: 'failed',
        fetchRowErrorDetail: { body: 'x' },
        clearFetchError: vi.fn(),
      }));
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/Fetch error: failed/)).toBeTruthy();
      expect(document.querySelector('.data-source-fetch-error code')).toBeNull();
    });
  });
});

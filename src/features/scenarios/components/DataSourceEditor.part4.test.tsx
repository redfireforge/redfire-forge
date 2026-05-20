/**
 * @vitest-environment jsdom
 */
import { type ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DataSourceEditor from './DataSourceEditor';
import { Scenario, DataSource, SharedDataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import { MapperFetchError } from '../../../shared/components/data-mapper/types';

vi.mock('uuid', () => ({ v4: () => `uuid-${Math.random().toString(36).slice(2, 8)}` }));

const useDataSourceTagsHarness = vi.hoisted(() => ({
  mismatchTagCounts: false,
}));

vi.mock('../hooks/useDataSourceTags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useDataSourceTags')>();
  return {
    useDataSourceTags: (...args: Parameters<typeof actual.useDataSourceTags>) => {
      const result = actual.useDataSourceTags(...args);
      if (!useDataSourceTagsHarness.mismatchTagCounts) return result;
      return { ...result, allTags: ['ghost-tag'], tagCounts: {} };
    },
  };
});

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

vi.mock('./DataSourceGridTable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./DataSourceGridTable')>();
  const Grid = actual.default;
  return {
    default: function DataSourceGridTableWithGhostRowProbe(props: ComponentProps<typeof Grid>) {
      return (
        <>
          <button
            type="button"
            data-testid="probe-open-row-detail-ghost"
            style={{ position: 'absolute', left: -3200, width: 1, height: 1, overflow: 'hidden' }}
            onClick={() => props.setEditingRowId('no-such-row-id')}
          >
            probe ghost row detail
          </button>
          <Grid {...props} />
        </>
      );
    },
  };
});

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
          <button
            type="button"
            data-testid="probe-show-promote-modal"
            style={{ position: 'absolute', left: -3100, width: 1, height: 1, overflow: 'hidden' }}
            onClick={() => props.onShowPromoteModal()}
          >
            probe promote modal
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
            <>
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
              <button
                type="button"
                data-testid="ds-setup-no-auth-apply"
                style={{ position: 'absolute', left: -2100, width: 1, height: 1, overflow: 'hidden' }}
                onClick={() =>
                  onApply(
                    test.dataSource!,
                    test.dataSource!.urlTemplate || test.url || '',
                    undefined,
                  )}
              />
            </>
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

function _makeDataTransferWithId(id: string): DataTransfer {
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
    useDataSourceTagsHarness.mismatchTagCounts = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  describe('tag filter and subset UI branches', () => {
    it('clears untagged filter when untagged chip is toggled off', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText(/untagged \(1\)/));
      expect(screen.getByText(/1 of 2 rows/)).toBeTruthy();
      fireEvent.click(screen.getByText(/untagged \(1\)/));
      expect(screen.queryByText(/1 of 2 rows/)).toBeNull();
    });

    it('marks subset chip active when single-tag subset matches active tag filter', () => {
      const ds = makeDataSource();
      ds.rows[0].tags = ['vip'];
      ds.subsets = [{ name: 'VIP Sub', filter: { type: 'tags', tags: ['vip'], mode: 'any' } }];
      render(<DataSourceEditor draft={makeScenario({ dataSource: ds })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByText(/🏷 vip/));
      const chipBtn = screen.getByText('VIP Sub');
      expect(chipBtn.className).toContain('active');
    });

    it('renders grid from linked shared data when draft omits inline dataSource', () => {
      const shared: SharedDataSource = {
        id: 'shared-1',
        name: 'Catalog DS',
        dataSource: makeDataSource(),
        tags: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      };
      render(
        <DataSourceEditor
          draft={makeScenario({ sharedDataSourceId: 'shared-1', dataSource: undefined })}
          onDraftChange={vi.fn()}
          sharedDataSources={[shared]}
        />,
      );
      expect(screen.getByText('DATA SOURCE')).toBeTruthy();
      expect(screen.getByDisplayValue('1GYVUZ')).toBeTruthy();
    });

    it('forwards tags from promote modal to onPromoteToShared', () => {
      const onPromote = vi.fn().mockReturnValue('new-shared-id');
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource() })}
          onDraftChange={vi.fn()}
          onPromoteToShared={onPromote}
        />,
      );
      fireEvent.click(screen.getByTitle('Promote inline data to a shared data source'));
      const tagField = screen.getByPlaceholderText('Add tag...');
      fireEvent.change(tagField, { target: { value: 'prod' } });
      fireEvent.keyDown(tagField, { key: 'Enter', preventDefault: vi.fn() });
      fireEvent.click(screen.getByRole('button', { name: /Promote & Link/ }));
      expect(onPromote).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        ['prod'],
        expect.objectContaining({ url: expect.any(String), method: expect.any(String) }),
      );
    });
  });

  describe('branch coverage: editor guards and MapperFetchError paths', () => {
    it('handlePromote returns early when onPromoteToShared is omitted (probe modal)', () => {
      const onChange = vi.fn();
      render(
        <DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />,
      );
      fireEvent.click(screen.getByTestId('probe-show-promote-modal'));
      fireEvent.click(screen.getByRole('button', { name: /Promote & Link/ }));
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /Promote & Link/ })).toBeTruthy();
    });

    it('handleSetupApply does not replace auth when options omit auth', () => {
      const auth = { type: 'bearer' as const, token: 'keep-token' };
      const onChange = vi.fn();
      render(
        <DataSourceEditor
          draft={makeScenario({ dataSource: makeDataSource(), auth })}
          onDraftChange={onChange}
        />,
      );
      fireEvent.click(screen.getByTitle('Configure data source columns'));
      fireEvent.click(screen.getByTestId('ds-setup-no-auth-apply'));
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.auth).toEqual(auth);
    });

    it('populate fetchSampleData wraps transport errors with MapperFetchError optional detail fallbacks', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        error: 'transport failed',
        status: 0,
        statusText: '',
        body: '',
        headers: undefined,
        timing: undefined,
      });
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: makeDataSource(),
            url: 'https://api.example.com/ctx',
            method: 'GET',
          })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      await act(async () => {
        await expect(hoistedMocks.lastPopulateAdapter!.fetchSampleData!()).rejects.toMatchObject({
          name: 'MapperFetchError',
          detail: {
            message: 'transport failed',
            status: undefined,
            statusText: undefined,
            body: undefined,
            timing: undefined,
          },
        });
      });
      expect(onFetchRow).toHaveBeenCalled();
    });

    it('populate fetchSampleData HTTP MapperFetchError omits body/timing when response omits them', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 418,
        statusText: '',
        body: '',
        headers: {},
        error: null,
        timing: undefined,
      });
      render(
        <DataSourceEditor
          draft={makeScenario({
            dataSource: makeDataSource(),
            url: 'https://api.example.com/teapot',
            method: 'GET',
          })}
          onDraftChange={vi.fn()}
          onFetchRow={onFetchRow}
        />,
      );
      fireEvent.click(screen.getByTitle('Send a request and populate rows from an array in the response'));
      await act(async () => {
        try {
          await hoistedMocks.lastPopulateAdapter!.fetchSampleData!();
          expect.fail('expected MapperFetchError');
        } catch (e) {
          expect(e).toBeInstanceOf(MapperFetchError);
          const err = e as MapperFetchError;
          expect(err.message).toMatch(/HTTP 418/);
          expect(err.detail.body).toBeUndefined();
          expect(err.detail.timing).toBeUndefined();
        }
      });
    });

    it('renders tag filter count fallback when tagCounts lacks an allTags entry', () => {
      useDataSourceTagsHarness.mismatchTagCounts = true;
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/🏷 ghost-tag \(0\)/)).toBeTruthy();
    });

    it('does not mount row detail modal when editingRowId does not match any row', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('probe-open-row-detail-ghost'));
      expect(document.querySelector('.data-source-row-detail-modal')).toBeNull();
    });
  });
});

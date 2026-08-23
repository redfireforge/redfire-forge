/**
 * @vitest-environment jsdom
 */
import { type ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { selectOptionByIndex } from '@test-utils/customSelectHelper';
import DataSourceEditor from './DataSourceEditor';
import {
  makeScenario,
  makeDataSource,
  makeDataTransferWithId as _makeDataTransferWithId,
} from './__test-utils__/dataSourceEditorTestHelpers';
import { Scenario, DataSource, SharedDataSource, DataSourceColumn, DataSourceRow } from '@shared/types';
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

vi.mock('./DataSourceRowDetailModal', async () => {
  const h = await import('./__test-utils__/dataSourceEditorTestHelpers');
  return { default: h.MockDataSourceRowDetailModal };
});

vi.mock('./DataSourceGridTable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./DataSourceGridTable')>();
  const h = await import('./__test-utils__/dataSourceEditorTestHelpers');
  return { default: h.buildDataSourceGridTableWrapper(actual.default) };
});

vi.mock('./DataSourceToolbar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./DataSourceToolbar')>();
  const h = await import('./__test-utils__/dataSourceEditorTestHelpers');
  return { default: h.buildDataSourceToolbarWrapper(actual.default) };
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


describe('DataSourceEditor', () => {
  beforeEach(() => {
    hoistedMocks.setFetchHookOverride(null);
    hoistedMocks.handleImport.mockClear();
    hoistedMocks.lastPopulateAdapter = null;
    useDataSourceTagsHarness.mismatchTagCounts = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  describe('populate from API modal', () => {
    it('opens populate modal', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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
      const { container } = render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      selectOptionByIndex(container, 1, 'Validate: All Rows');
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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

});

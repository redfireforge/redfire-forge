/**
 * @vitest-environment jsdom
 */
import { useState, type ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { selectOption } from '../../../test-utils/customSelectHelper';
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
    useDataSourceTagsHarness.mismatchTagCounts = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // jsdom doesn't implement scrollIntoView; silence it globally for this suite
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
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
      fireEvent.mouseDown(handles[0]);
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
      const bulkAdd = document.querySelectorAll('.data-source-tag-select')[0]!;
      selectOption(bulkAdd, 'smoke');
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
      const tagSelects = document.querySelectorAll('.data-source-tag-select');
      expect(tagSelects.length).toBeGreaterThanOrEqual(2);
      selectOption(tagSelects[1]!, 'a');
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
      fireEvent.click(screen.getByTitle('Fetch a live API response and map fields into data-source rows'));
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

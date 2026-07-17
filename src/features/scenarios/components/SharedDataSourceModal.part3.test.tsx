/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SharedDataSourceModal from './SharedDataSourceModal';
import { SharedDataSource, FeatureGroup, DataSource, GlobalAuthProfile } from '../../../shared/types';
import { proxyFetch } from '../../../engine/executor';
// Mock uuid to return predictable IDs
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2, 8)),
}));

// Mock proxyFetch
vi.mock('../../../engine/executor', () => ({
  proxyFetch: vi.fn(),
  buildHeaders: vi.fn(() => ({})),
}));

/** Minimal frame so `onClose` (dirty gate) can be exercised — production uses closeButtonKind none + closeOnOverlayClick false */
vi.mock('../../../shared/components/AppModalFrame', async () => {
  const { MockAppModalFrame } = await import('./__test-utils__/sharedDataSourceModalMocks');
  return { default: MockAppModalFrame };
});

vi.mock('./DataSourceEditor', () => ({
  default: () => <div data-testid="data-source-editor-stub" />,
}));

vi.mock('./DataSourceSetupModal', () => ({
  default: ({
    onApply,
    onClose,
    sourceName,
  }: {
    onApply: (dataTable: DataSource, urlTemplate: string, opts?: { auth?: unknown }) => void;
    onClose: () => void;
    sourceName?: string;
  }) => (
    <div data-testid="setup-wizard-mock" data-source-name={sourceName ?? ''}>
      <button
        type="button"
        onClick={() =>
          onApply(
            {
              id: 'tbl-wizard',
              columns: [
                { id: 'c1', name: 'A', type: 'path' as const, mapping: 'a' },
              ],
              rows: [{ id: 'r1', values: { c1: 'v' }, enabled: true }],
              source: { type: 'inline' as const },
            },
            'https://api.example.com/{{a}}/items',
            { auth: { type: 'bearer' as const, prefix: 'Bearer', token: 't' } },
          )}
      >
        Wizard Apply
      </button>
      <button
        type="button"
        onClick={() =>
          onApply(
            {
              id: 'tbl-flat',
              columns: [{ id: 'c1', name: 'A', type: 'path' as const, mapping: 'a' }],
              rows: [{ id: 'r1', values: { c1: 'v' }, enabled: true }],
              source: { type: 'inline' as const },
            },
            '',
          )}
      >
        Wizard Apply Flat URL
      </button>
      <button type="button" onClick={onClose}>
        Wizard Close
      </button>
    </div>
  ),
}));

vi.mock('../../../shared/components/data-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/components/data-mapper')>();
  const createSharedDsFetchAdapterMock = vi.fn(actual.createSharedDsFetchAdapter);
  return {
    ...actual,
    createSharedDsFetchAdapter: createSharedDsFetchAdapterMock,
    DataMapperModal: ({
      onSave,
      onCancel,
    }: {
      onSave: (output: { columns: DataSource['columns']; rows: DataSource['rows']; mode: 'append' | 'replace' }) => void;
      onCancel: () => void;
    }) => (
      <div data-testid="populate-from-api-mock">
        <button type="button" onClick={() => onSave({ columns: [], rows: [{ id: 'nr', values: {}, enabled: true }], mode: 'append' })}>
          Populate Append
        </button>
        <button type="button" onClick={() => onSave({ columns: [], rows: [], mode: 'replace' })}>
          Populate Replace
        </button>
        <button type="button" onClick={onCancel}>
          Populate Close
        </button>
      </div>
    ),
  };
});

vi.mock('./SharedDsSaveConfirmModal', () => ({
  default: ({
    onSave,
    onDiscard,
    onCancel,
  }: {
    onSave: () => void;
    onDiscard: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="shared-ds-save-confirm-mock">
      <button type="button" onClick={onSave}>
        Save Changes
      </button>
      <button type="button" onClick={onDiscard}>
        Discard Changes
      </button>
      <button type="button" onClick={onCancel}>
        Cancel Save Confirm
      </button>
    </div>
  ),
}));

vi.mock('../../../shared/components/ConfirmModal', () => ({
  default: ({
    onConfirm,
    onCancel,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="confirm-delete-mock">
      <button type="button" onClick={onConfirm}>
        Confirm Delete
      </button>
      <button type="button" onClick={onCancel}>
        Cancel Delete
      </button>
    </div>
  ),
}));

// ─── Test Helpers ─────────────────────────────────────────────

function makeDataSource(id: string, columnCount = 1, rowCount = 1): DataSource {
  const columns = Array.from({ length: columnCount }, (_, i) => ({
    id: `col-${i}`,
    name: `Column ${i + 1}`,
    type: 'path' as const,
    mapping: `var${i + 1}`,
  }));
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    id: `row-${i}`,
    values: Object.fromEntries(columns.map(c => [c.id, `value-${i}`])),
    enabled: true,
  }));
  return { id, columns, rows, source: { type: 'inline' } };
}

function makeSharedDs(id: string, name: string, opts: Partial<SharedDataSource> = {}): SharedDataSource {
  return {
    id,
    name,
    dataSource: makeDataSource(`ds-${id}`),
    updatedAt: Date.now(),
    ...opts,
  };
}

function makeFeatureGroup(id: string, name: string, scenarioCount = 1): FeatureGroup {
  const scenarios = Array.from({ length: scenarioCount }, (_, i) => ({
    id: `sc-${id}-${i}`,
    name: `Scenario ${i + 1}`,
    tests: [],
    auth: { type: 'none' as const },
    enabled: true,
  }));
  return { id, name, scenarios };
}

const defaultProps = {
  sharedDataSources: [] as SharedDataSource[],
  onUpdate: vi.fn(),
  featureGroups: [] as FeatureGroup[],
  globalAuthProfiles: [] as GlobalAuthProfile[],
  onClose: vi.fn(),
};

/** Controlled wrapper so `onUpdate` flows back into `sharedDataSources` like the real app */
function ModalHarness(
  props: Omit<ComponentProps<typeof SharedDataSourceModal>, 'sharedDataSources' | 'onUpdate'> & {
    initialSources?: SharedDataSource[];
  },
) {
  const { initialSources = [], ...rest } = props;
  const [sharedDataSources, setSharedDataSources] = useState<SharedDataSource[]>(initialSources);
  return <SharedDataSourceModal {...rest} sharedDataSources={sharedDataSources} onUpdate={setSharedDataSources} />;
}

/** Drops fetchConfig on all sources so wizard apply exercises `ds.fetchConfig ?? defaultFetchConfig()` merges */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WizardStripHarness({ initial }: { initial: SharedDataSource[] }) {
  const [sources, setSources] = useState<SharedDataSource[]>(initial);
  return (
    <>
      <button
        type="button"
        data-testid="strip-shared-fetch-config"
        onClick={() =>
          setSources(prev =>
            prev.map(ds => {
              const next: SharedDataSource = { ...ds };
              delete (next as Partial<SharedDataSource>).fetchConfig;
              return next;
            }),
          )
        }
      >
        Strip Fetch Config
      </button>
      <SharedDataSourceModal
        sharedDataSources={sources}
        onUpdate={setSources}
        featureGroups={[]}
        globalAuthProfiles={[]}
        onClose={vi.fn()}
      />
    </>
  );
}


// ─── Tests ────────────────────────────────────────────────────

describe('SharedDataSourceModal', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.mocked(proxyFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
  });

  describe('List panel edge cases', () => {
    it('shows singular mapping issue label for one warning', () => {
      const ds = makeDataSource('tbl1', 1, 0);
      ds.columns[0] = { id: 'p1', name: 'orphPath', type: 'path', mapping: 'ghost' };
      const sources = [
        {
          id: 's1',
          name: 'Warn1',
          dataSource: ds,
          updatedAt: Date.now(),
          fetchConfig: { url: 'https://plain.test/x', method: 'GET', headers: [], auth: { type: 'none' } },
        },
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      expect(screen.getByRole('button', { name: /^1 issue$/ })).toBeInTheDocument();
    });

    it('used-by expanded list omits pencil for catalog-linked tests only', async () => {
      const sources = [makeSharedDs('s1', 'Shared')];
      const fg: FeatureGroup = {
        id: 'fg1',
        name: 'FG',
        scenarios: [{
          id: 'sc1',
          name: 'Sc',
          tests: [{
            id: 't1',
            name: 'CatalogLinked',
            url: 'http://x',
            method: 'GET',
            headers: [],
            body: '',
            validation: { mode: 'none' },
            sharedDataSourceId: 's1',
          }],
          auth: { type: 'none' },
          enabled: true,
        }],
      };
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[fg]} />);
      await userEvent.click(screen.getByRole('button', { name: /used by 1 test/i }));
      expect(screen.getByText('CatalogLinked')).toBeInTheDocument();
      expect(screen.queryByText(/CatalogLinked ✎/)).toBeNull();
    });

    it('shows plural label when multiple mapping warnings exist', () => {
      const ds = makeDataSource('tbl1', 1, 0);
      ds.columns = [
        { id: 'p1', name: 'orphPath', type: 'path', mapping: 'notInUrl' },
        { id: 'p2', name: 'orphQ', type: 'param', mapping: 'missingQ' },
      ];
      const sources = [
        {
          id: 's1',
          name: 'Warn2',
          dataSource: ds,
          updatedAt: Date.now(),
          fetchConfig: { url: 'https://plain.test/no', method: 'GET', headers: [], auth: { type: 'none' } },
        },
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      expect(screen.getByRole('button', { name: /2 issues/i })).toBeInTheDocument();
    });

    it('footer Cancel after first create from empty list restores empty snapshot', async () => {
      render(<ModalHarness initialSources={[]} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /\+ create first shared data source/i }));
      await waitFor(() => expect(screen.getByPlaceholderText('Data source name')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      await waitFor(() => {
        expect(screen.getByText(/no shared data sources yet/i)).toBeInTheDocument();
      });
    });

    it('shows No matches when search filters everything out', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'Only')]} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.type(screen.getByPlaceholderText('Search…'), 'nomatch');
      expect(screen.getByText('No matches')).toBeInTheDocument();
    });

    it('uses singular footer label for one shared data source', () => {
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={[makeSharedDs('s1', 'Solo')]}
          featureGroups={[]}
        />,
      );
      expect(screen.getByText(/1 shared data source ·/)).toBeInTheDocument();
    });

    it('closes context menu when opening the same menu button again', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={vi.fn()} featureGroups={[]} />);
      const menuBtn = screen.getByTitle('More');
      await userEvent.click(menuBtn);
      expect(screen.getByText('Rename')).toBeInTheDocument();
      await userEvent.click(menuBtn);
      expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    });

    it('resizes list panel width via drag handle', () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={vi.fn()} featureGroups={[]} />);
      const panel = document.querySelector('.shared-ds-list-panel') as HTMLElement;
      const before = panel.style.width;
      const handle = document.querySelector('.shared-ds-resize-handle') as HTMLElement;
      fireEvent.mouseDown(handle, { clientX: 100, preventDefault() {} });
      fireEvent.mouseMove(document, { clientX: 250 });
      fireEvent.mouseUp(document);
      expect(panel.style.width).not.toBe(before);
    });

    it('commits rename via Enter and cancels via Escape', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'Orig')]} onClose={vi.fn()} featureGroups={[]} />);
      const rowMore = within(screen.getByText('Orig').closest('.shared-ds-list-item')!).getByTitle('More');
      await userEvent.click(rowMore);
      await userEvent.click(screen.getByText('Rename'));
      const inp = document.querySelector('.shared-ds-rename-input') as HTMLInputElement;
      await userEvent.clear(inp);
      await userEvent.type(inp, 'NewName{enter}');
      await waitFor(() => expect(screen.getByText('NewName')).toBeInTheDocument());

      const rowMore2 = within(screen.getByText('NewName').closest('.shared-ds-list-item')!).getByTitle('More');
      await userEvent.click(rowMore2);
      await userEvent.click(screen.getByText('Rename'));
      const inp2 = document.querySelector('.shared-ds-rename-input') as HTMLInputElement;
      fireEvent.keyDown(inp2, { key: 'Escape', code: 'Escape' });
      expect(document.querySelector('.shared-ds-rename-input')).not.toBeInTheDocument();
      expect(screen.getByText('NewName')).toBeInTheDocument();
    });

    it('aborts rename when name is empty on blur', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'Keep')]} onClose={vi.fn()} featureGroups={[]} />);
      const rowMore = within(screen.getByText('Keep').closest('.shared-ds-list-item')!).getByTitle('More');
      await userEvent.click(rowMore);
      await userEvent.click(screen.getByText('Rename'));
      const inp = document.querySelector('.shared-ds-rename-input') as HTMLInputElement;
      await userEvent.clear(inp);
      fireEvent.blur(inp);
      expect(screen.getByText('Keep')).toBeInTheDocument();
    });

    it('Rename from the list context menu switches to inline edit', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'MenuRename')]} onClose={vi.fn()} featureGroups={[]} />);
      const rowMore = within(screen.getByText('MenuRename').closest('.shared-ds-list-item')!).getByTitle('More');
      await userEvent.click(rowMore);
      await userEvent.click(screen.getByText('Rename'));
      expect(document.querySelector('.shared-ds-rename-input')).toHaveValue('MenuRename');
    });
  });

  describe('Delete flows', () => {
    it('deletes immediately when the data source is not referenced', async () => {
      render(
        <ModalHarness
          initialSources={[makeSharedDs('a', 'A'), makeSharedDs('b', 'B')]}
          onClose={vi.fn()}
          featureGroups={[]}
        />
      );
      await userEvent.click(screen.getByText('B').closest('.shared-ds-list-item')!);
      const bRowMenu = within(screen.getByText('B').closest('.shared-ds-list-item')!).getByTitle('More');
      await userEvent.click(bRowMenu);
      await userEvent.click(screen.getByText('Delete'));
      expect(screen.queryByTestId('confirm-delete-mock')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText('B')).not.toBeInTheDocument());
    });

    it('asks for confirmation when deleting a referenced data source', async () => {
      const fg = makeFeatureGroup('fg1', 'FG');
      fg.scenarios[0].tests = [{
        id: 't1',
        name: 'Linked',
        url: 'http://x',
        method: 'GET',
        headers: [],
        body: '',
        validation: { mode: 'none' },
        sharedDataSourceId: 's1',
      }];
      render(
        <ModalHarness
          initialSources={[makeSharedDs('s1', 'Shared')]}
          onClose={vi.fn()}
          featureGroups={[fg]}
        />
      );
      await userEvent.click(screen.getByTitle('More'));
      await userEvent.click(screen.getByText('Delete'));
      expect(screen.getByTestId('confirm-delete-mock')).toBeInTheDocument();
      await userEvent.click(screen.getByText('Confirm Delete'));
      await waitFor(() => expect(screen.queryByText('Shared')).not.toBeInTheDocument());
    });

    it('cancels pending delete from confirm modal', async () => {
      const fg = makeFeatureGroup('fg1', 'FG');
      fg.scenarios[0].tests = [{
        id: 't1',
        name: 'Linked',
        url: 'http://x',
        method: 'GET',
        headers: [],
        body: '',
        validation: { mode: 'none' },
        sharedDataSourceId: 's1',
      }];
      render(
        <ModalHarness
          initialSources={[makeSharedDs('s1', 'Shared')]}
          onClose={vi.fn()}
          featureGroups={[fg]}
        />,
      );
      await userEvent.click(screen.getByTitle('More'));
      await userEvent.click(screen.getByText('Delete'));
      await userEvent.click(screen.getByText('Cancel Delete'));
      expect(screen.getByText('Shared')).toBeInTheDocument();
    });
  });

});

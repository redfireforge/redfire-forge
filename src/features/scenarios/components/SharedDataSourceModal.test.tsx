/**
 * @vitest-environment jsdom
 */
import { useState, type ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
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
    vi.clearAllMocks();
    vi.mocked(proxyFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
  });

  describe('Initial Render', () => {
    it('renders modal with title and footer Close control', () => {
      render(<SharedDataSourceModal {...defaultProps} />);
      expect(screen.getByText('Shared Data Sources')).toBeInTheDocument();
      const footer = document.querySelector('.shared-ds-footer');
      expect(footer).toBeTruthy();
      expect(within(footer as HTMLElement).getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    });

    it('shows empty state when no data sources exist', () => {
      render(<SharedDataSourceModal {...defaultProps} />);
      expect(screen.getByText(/no shared data sources/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ create/i })).toBeInTheDocument();
    });

    it('renders list of data sources when they exist', () => {
      const sources = [
        makeSharedDs('s1', 'Vehicles'),
        makeSharedDs('s2', 'Users'),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      expect(screen.getByText('Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    it('selects first data source by default', () => {
      const sources = [
        makeSharedDs('s1', 'First'),
        makeSharedDs('s2', 'Second'),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const firstItem = screen.getByText('First').closest('.shared-ds-list-item');
      expect(firstItem).toHaveClass('active');
    });

    it('shows empty editor until list selection resolves a valid shared source id', async () => {
      const sources = [makeSharedDs('s1', 'PickMe')];
      render(
        <SharedDataSourceModal {...defaultProps} sharedDataSources={sources} initialSelectedId="orphan-id" />,
      );
      expect(screen.getByText(/Create a shared data source to get started/i)).toBeInTheDocument();
      await userEvent.click(screen.getByText('PickMe'));
      expect(screen.getByDisplayValue('PickMe')).toBeInTheDocument();
    });

    it('pre-selects data source when initialSelectedId is provided', () => {
      const sources = [
        makeSharedDs('s1', 'First'),
        makeSharedDs('s2', 'Second'),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} initialSelectedId="s2" />);
      const secondItem = screen.getByText('Second').closest('.shared-ds-list-item');
      expect(secondItem).toHaveClass('active');
    });

    it('shows 0 rows in list meta when a source omits dataSource', () => {
      const malformed = { id: 'bad', name: 'Broken', updatedAt: 1 } as SharedDataSource;
      const sources = [makeSharedDs('ok', 'Healthy'), malformed];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const brokenItem = screen.getByText('Broken').closest('.shared-ds-list-item') as HTMLElement;
      expect(within(brokenItem).getByText(/0 rows/)).toBeInTheDocument();
    });
  });

  describe('Create Data Source', () => {
    it('creates new data source from empty state button', async () => {
      const onUpdate = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} onUpdate={onUpdate} />);
      
      const createBtn = screen.getByRole('button', { name: /\+ create/i });
      await userEvent.click(createBtn);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const newSources = onUpdate.mock.calls[0][0];
      expect(newSources).toHaveLength(1);
      expect(newSources[0].name).toMatch(/^Data Source \d+$/);
    });

    it('creates new data source from "+ New" button in list panel', async () => {
      const sources = [makeSharedDs('s1', 'Existing')];
      const onUpdate = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} onUpdate={onUpdate} />);
      
      const newBtn = screen.getByRole('button', { name: /\+ new/i });
      await userEvent.click(newBtn);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const newSources = onUpdate.mock.calls[0][0];
      expect(newSources).toHaveLength(2);
      expect(newSources[1].name).toMatch(/^Data Source \d+$/);
    });
  });

  describe('Select Data Source', () => {
    it('selects data source when clicking on list item', async () => {
      const sources = [
        makeSharedDs('s1', 'First'),
        makeSharedDs('s2', 'Second'),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const secondItem = screen.getByText('Second').closest('.shared-ds-list-item');
      await userEvent.click(secondItem!);

      expect(secondItem).toHaveClass('active');
    });
  });

  describe('Rename Data Source', () => {
    it('opens rename input on double-click', async () => {
      const sources = [makeSharedDs('s1', 'Original Name')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const nameElement = screen.getByText('Original Name');
      await userEvent.dblClick(nameElement);

      const input = screen.getByDisplayValue('Original Name');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('context menu has Rename option', async () => {
      const sources = [makeSharedDs('s1', 'TestDS')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const menuBtn = screen.getByTitle('More');
      await userEvent.click(menuBtn);
      
      expect(screen.getByText('Rename')).toBeInTheDocument();
    });
  });

  describe('Delete Data Source', () => {
    it('opens context menu with delete option on menu button click', async () => {
      const sources = [makeSharedDs('s1', 'To Delete')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const menuBtn = screen.getByTitle('More');
      await userEvent.click(menuBtn);

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('context menu shows rename and duplicate options', async () => {
      const sources = [makeSharedDs('s1', 'Test')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const menuBtn = screen.getByTitle('More');
      await userEvent.click(menuBtn);

      expect(screen.getByText('Rename')).toBeInTheDocument();
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  describe('List Search', () => {
    it('filters data sources by search term', async () => {
      const sources = [
        makeSharedDs('s1', 'Vehicles'),
        makeSharedDs('s2', 'Users'),
        makeSharedDs('s3', 'Products'),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      // Find the list search input (in the list panel)
      const listPanel = document.querySelector('.shared-ds-list-panel');
      const searchInput = listPanel?.querySelector('input[placeholder]') as HTMLInputElement;
      if (!searchInput) throw new Error('Search input not found');
      
      await userEvent.type(searchInput, 'User');

      expect(screen.getByText('Users')).toBeInTheDocument();
      // Other items should be filtered out
      const listItems = document.querySelectorAll('.shared-ds-list-item');
      expect(listItems.length).toBe(1);
    });

    it('shows all data sources when search is cleared', async () => {
      const sources = [
        makeSharedDs('s1', 'Vehicles'),
        makeSharedDs('s2', 'Users'),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const listPanel = document.querySelector('.shared-ds-list-panel');
      const searchInput = listPanel?.querySelector('input[placeholder]') as HTMLInputElement;
      if (!searchInput) throw new Error('Search input not found');
      
      await userEvent.type(searchInput, 'Vehicles');
      await userEvent.clear(searchInput);

      expect(screen.getByText('Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
    });
  });

  describe('Used By Section', () => {
    it('shows tests using the selected data source', () => {
      const sources = [makeSharedDs('s1', 'Shared')];
      const fg: FeatureGroup = {
        id: 'fg1',
        name: 'Feature Group',
        scenarios: [{
          id: 'sc1',
          name: 'Scenario',
          tests: [{
            id: 't1',
            name: 'Test Using Shared',
            url: 'http://api',
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
      
      expect(screen.getByText(/used by 1 test/i)).toBeInTheDocument();
    });

    it('includes current editing draft in used by count when linked', () => {
      const sources = [makeSharedDs('s1', 'Shared')];
      const currentEditingDraft = {
        fgName: 'Feature',
        scenarioName: 'Scenario',
        test: {
          id: 't1',
          name: 'Editing Test',
          url: 'http://api',
          method: 'GET' as const,
          headers: [],
          body: '',
          validation: { mode: 'none' as const },
          sharedDataSourceId: 's1',
        },
      };
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          currentEditingDraft={currentEditingDraft}
        />
      );
      
      expect(screen.getByText(/used by 1 test/i)).toBeInTheDocument();
    });

    it('lists every referencing catalog test in expanded used-by section', async () => {
      const sources = [makeSharedDs('s1', 'Shared')];
      const fg: FeatureGroup = {
        id: 'fg1',
        name: 'FG',
        scenarios: [{
          id: 'sc1',
          name: 'Scenario',
          tests: [
            {
              id: 't1',
              name: 'Alpha Test',
              url: 'http://a',
              method: 'GET',
              headers: [],
              body: '',
              validation: { mode: 'none' },
              sharedDataSourceId: 's1',
            },
            {
              id: 't2',
              name: 'Beta Test',
              url: 'http://b',
              method: 'GET',
              headers: [],
              body: '',
              validation: { mode: 'none' },
              sharedDataSourceId: 's1',
            },
          ],
          auth: { type: 'none' },
          enabled: true,
        }],
      };
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[fg]} />);
      expect(screen.getByText(/used by 2 test\(s\)/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /used by 2 test\(s\)/i }));
      expect(screen.getByTitle(/FG \/ Scenario \/ Alpha Test/)).toBeInTheDocument();
      expect(screen.getByTitle(/FG \/ Scenario \/ Beta Test/)).toBeInTheDocument();
    });

    it('shows plural delete warning copy when two tests reference the shared source', async () => {
      const sources = [makeSharedDs('s1', 'Shared')];
      const fg = makeFeatureGroup('fg1', 'FG');
      fg.scenarios[0].tests = [
        {
          id: 't1',
          name: 'One',
          url: 'http://x',
          method: 'GET',
          headers: [],
          body: '',
          validation: { mode: 'none' },
          sharedDataSourceId: 's1',
        },
        {
          id: 't2',
          name: 'Two',
          url: 'http://y',
          method: 'GET',
          headers: [],
          body: '',
          validation: { mode: 'none' },
          sharedDataSourceId: 's1',
        },
      ];
      render(
        <ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[fg]} />,
      );
      await userEvent.click(screen.getByTitle('More'));
      await userEvent.click(screen.getByText('Delete'));
      expect(screen.getByText(/used by 2 test\(s\)/i)).toBeInTheDocument();
    });

    it('keeps used-by references collapsed until the toggle is expanded', () => {
      const sources = [makeSharedDs('s1', 'Shared')];
      const fg: FeatureGroup = {
        id: 'fg1',
        name: 'FG',
        scenarios: [{
          id: 'sc1',
          name: 'Scenario',
          tests: [{
            id: 't1',
            name: 'Linked Test',
            url: 'http://api',
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
      expect(screen.getByText('▶')).toBeInTheDocument();
      expect(screen.queryByTitle(/FG \/ Scenario \/ Linked Test/)).toBeNull();
    });
  });

  describe('Close Modal', () => {
    it('calls onClose when Close button is clicked', async () => {
      const onClose = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} onClose={onClose} />);
      const footer = document.querySelector('.shared-ds-footer');
      await userEvent.click(within(footer as HTMLElement).getByRole('button', { name: /^close$/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('List Panel Collapse', () => {
    it('has a toggle button to collapse/expand list panel', () => {
      const sources = [makeSharedDs('s1', 'Test')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const toggleBtn = screen.getByTitle(/hide list panel|show list panel/i);
      expect(toggleBtn).toBeInTheDocument();
    });

    it('collapses list panel when toggle is clicked', async () => {
      const sources = [makeSharedDs('s1', 'Test')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      const toggleBtn = screen.getByTitle(/hide list panel/i);
      await userEvent.click(toggleBtn);

      expect(screen.queryByText('Test')).not.toBeInTheDocument();
      expect(screen.getByTitle(/show list panel/i)).toBeInTheDocument();
    });

    it('expands list panel when toggle is clicked again', async () => {
      const sources = [makeSharedDs('s1', 'Test')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      // Collapse
      const collapseBtn = screen.getByTitle(/hide list panel/i);
      await userEvent.click(collapseBtn);

      // Expand
      const expandBtn = screen.getByTitle(/show list panel/i);
      await userEvent.click(expandBtn);

      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('Editor Panel', () => {
    it('shows row count in list item', () => {
      const ds = makeDataSource('ds1', 3, 5);
      const sources = [{ id: 's1', name: 'Test', dataSource: ds, updatedAt: Date.now() }];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      expect(screen.getByText('5 rows')).toBeInTheDocument();
    });

    it('shows total rows in footer', () => {
      const ds1 = makeDataSource('ds1', 2, 3);
      const ds2 = makeDataSource('ds2', 2, 7);
      const sources = [
        { id: 's1', name: 'Test 1', dataSource: ds1, updatedAt: Date.now() },
        { id: 's2', name: 'Test 2', dataSource: ds2, updatedAt: Date.now() },
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      
      expect(screen.getByText(/10 total rows/i)).toBeInTheDocument();
    });
  });

});

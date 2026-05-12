/**
 * @vitest-environment jsdom
 */
import { useState, type ReactNode } from 'react';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SharedDataSourceModal from './SharedDataSourceModal';
import type { SharedDataSource, FeatureGroup, DataSource, GlobalAuthProfile } from '../../../shared/types';
import { proxyFetch } from '../../../engine/executor';
import { createSharedDsFetchAdapter } from '../../../shared/components/data-mapper';

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
vi.mock('../../../shared/components/AppModalFrame', () => ({
  default: function MockAppModalFrame({
    title,
    children,
    onClose,
    footerContent,
    footer,
  }: {
    title: ReactNode;
    children: ReactNode;
    onClose: () => void;
    footerContent?: (state: unknown) => ReactNode;
    footer?: ReactNode;
  }) {
    return (
      <div data-testid="app-modal-frame">
        <div>{title}</div>
        <button type="button" data-testid="app-modal-frame-onclose" onClick={onClose}>
          Outer
        </button>
        {footerContent?.({})}
        {children}
        {footer ? <div data-testid="app-modal-footer-slot">{footer}</div> : null}
      </div>
    );
  },
}));

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

    it('pre-selects data source when initialSelectedId is provided', () => {
      const sources = [
        makeSharedDs('s1', 'First'),
        makeSharedDs('s2', 'Second'),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} initialSelectedId="s2" />);
      const secondItem = screen.getByText('Second').closest('.shared-ds-list-item');
      expect(secondItem).toHaveClass('active');
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

    it('marks editing draft in expanded used-by list', async () => {
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
          featureGroups={[]}
          currentEditingDraft={currentEditingDraft}
        />,
      );
      await userEvent.click(document.querySelector('.shared-ds-used-by-toggle') as HTMLElement);
      expect(screen.getByText('Editing Test ✎')).toBeInTheDocument();
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

  describe('Create Test from Shared Data Source', () => {
    it('shows Create Test button when callback is provided and shared DS is selected', () => {
      const sources = [makeSharedDs('s1', 'Test')];
      const onCreateTest = vi.fn();
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[makeFeatureGroup('fg1', 'Feature')]}
          onCreateTestFromSharedDs={onCreateTest}
        />
      );
      
      expect(screen.getByRole('button', { name: /\+ create test/i })).toBeInTheDocument();
    });

    it('does not show Create Test button when no callback provided', () => {
      const sources = [makeSharedDs('s1', 'Test')];
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[makeFeatureGroup('fg1', 'Feature')]}
        />
      );
      
      expect(screen.queryByRole('button', { name: /\+ create test/i })).not.toBeInTheDocument();
    });

    it('opens create test modal and submits', async () => {
      const sources = [makeSharedDs('s1', 'Shared DS', { fetchConfig: { url: 'https://api.test.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const onCreateTest = vi.fn();
      const onClose = vi.fn();
      const fgs = [makeFeatureGroup('fg1', 'Feature Group 1')];
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={fgs}
          onCreateTestFromSharedDs={onCreateTest}
          onClose={onClose}
        />
      );
      
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      expect(screen.getByText('Create Test from Shared Data Source')).toBeInTheDocument();
      
      const nameInput = screen.getByPlaceholderText('Enter test name');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'My New Test');
      
      await userEvent.click(within(screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!).getByRole('button', { name: /^create test$/i }));
      expect(onCreateTest).toHaveBeenCalledWith(sources[0], 'fg1', expect.any(String), 'My New Test');
      expect(onClose).toHaveBeenCalled();
    });

    it('resets target scenario when changing feature group in create flow', async () => {
      const sources = [makeSharedDs('s1', 'Shared', { fetchConfig: { url: 'https://a.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const fgA = makeFeatureGroup('fgA', 'Group A', 2);
      const fgB = makeFeatureGroup('fgB', 'Group B', 2);
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[fgA, fgB]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      const fgSelect = within(popup).getAllByRole('combobox')[0];
      await userEvent.selectOptions(fgSelect, 'fgB');
      const scSelect = within(popup).getAllByRole('combobox')[1] as HTMLSelectElement;
      expect(scSelect.value).toBe('sc-fgB-0');
    });

    it('shows not set for URL preview when fetch config is absent', async () => {
      const sources = [makeSharedDs('s1', 'No URL')];
      const s0 = sources[0] as SharedDataSource & { fetchConfig?: unknown };
      delete s0.fetchConfig;
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[makeFeatureGroup('fg1', 'F')]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      expect(screen.getByText('(not set)')).toBeInTheDocument();
    });

    it('clears scenario selection when target feature group has zero scenarios', async () => {
      const sources = [makeSharedDs('s1', 'Shared', { fetchConfig: { url: 'https://a.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const emptyFg = makeFeatureGroup('fgEmpty', 'No Scenarios', 0);
      const normalFg = makeFeatureGroup('fg1', 'Has Scenarios', 2);
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[normalFg, emptyFg]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      const fgSelect = within(popup).getAllByRole('combobox')[0];
      await userEvent.selectOptions(fgSelect, 'fgEmpty');
      const scSelect = within(popup).getAllByRole('combobox')[1] as HTMLSelectElement;
      expect(scSelect.value).toBe('');
    });
  });

  describe('Fetch Config Editor', () => {
    it('renders method and URL inputs', () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.example.com/items', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      expect(document.querySelector('.shared-ds-fetch-method')).toBeInTheDocument();
      expect(document.querySelector('.shared-ds-fetch-url')).toBeInTheDocument();
    });

    it('changes HTTP method', async () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const onUpdate = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} onUpdate={onUpdate} />);
      const methodSelect = document.querySelector('.shared-ds-fetch-method') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'POST' } });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('changes URL', async () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: '', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const onUpdate = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} onUpdate={onUpdate} />);
      const urlInput = document.querySelector('.shared-ds-fetch-url') as HTMLInputElement;
      fireEvent.change(urlInput, { target: { value: 'https://new-api.com' } });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('shows cURL import section when clicked', async () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: '', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      await userEvent.click(screen.getByText('cURL Import'));
      expect(document.querySelector('.shared-ds-curl-import')).toBeInTheDocument();
    });

    it('renders mapping badges', () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com/{{id}}', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      expect(screen.getByText(/path:/)).toBeInTheDocument();
      expect(screen.getByText(/param:/)).toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('renders Params, Auth, and Headers tabs', () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      expect(screen.getByText('Params')).toBeInTheDocument();
      expect(screen.getByText('Auth')).toBeInTheDocument();
      expect(screen.getByText('Headers')).toBeInTheDocument();
    });

    it('opens Params tab content', async () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      await userEvent.click(screen.getByText('Params'));
      expect(document.querySelector('.shared-ds-params-tab')).toBeInTheDocument();
    });

    it('opens Auth tab content', async () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      await userEvent.click(screen.getByText('Auth'));
      expect(document.querySelector('.shared-ds-auth-tab')).toBeInTheDocument();
    });

    it('opens Headers tab content', async () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com', method: 'GET', headers: [{ key: 'X-Api', value: 'test' }], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      await userEvent.click(screen.getByText('Headers'));
      expect(document.querySelector('.shared-ds-headers-tab')).toBeInTheDocument();
    });

    it('shows Body tab for POST method', () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com', method: 'POST', headers: [], body: '{}', auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const bodyTab = document.querySelector('.builder-tab:last-child');
      expect(bodyTab?.textContent).toContain('Body');
    });

    it('shows Body tab badge dot when request body is non-empty on PUT', () => {
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: {
            url: 'https://api.test.com',
            method: 'PUT',
            headers: [],
            body: '{"a":1}',
            auth: { type: 'none' },
          },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      const bodyBtn = within(tabs).getByRole('button', { name: /^Body\b/ });
      expect(bodyBtn.querySelector('.tab-badge-dot')).toBeTruthy();
    });

    it('omits Body tab badge dot when body is blank after trim', () => {
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: {
            url: 'https://api.test.com',
            method: 'PUT',
            headers: [],
            body: '   ',
            auth: { type: 'none' },
          },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      const bodyBtn = within(tabs).getByRole('button', { name: /^Body\b/ });
      expect(bodyBtn.querySelector('.tab-badge-dot')).toBeNull();
    });

    it('shows Auth tab badge when fetch auth type is inherit', () => {
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: {
            url: 'https://api.test.com',
            method: 'GET',
            headers: [],
            auth: { type: 'inherit' },
          },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      const authBtn = within(tabs).getByRole('button', { name: /^auth\b/i });
      expect(authBtn.querySelector('.tab-badge-dot')).toBeTruthy();
    });

    it('does not show Body tab for GET method', () => {
      const sources = [makeSharedDs('s1', 'Test', { fetchConfig: { url: 'https://api.test.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const tabs = document.querySelectorAll('.builder-tab');
      const tabTexts = Array.from(tabs).map(t => t.textContent);
      expect(tabTexts.join('')).not.toContain('Body');
    });
  });

  describe('Dirty state', () => {
    it('Save button is disabled when no changes', () => {
      const sources = [makeSharedDs('s1', 'Test')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      const saveBtn = screen.getByRole('button', { name: /^save$/i });
      expect(saveBtn).toBeDisabled();
    });

    it('shows name input in editor header', () => {
      const sources = [makeSharedDs('s1', 'My Data Source')];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      expect(screen.getByDisplayValue('My Data Source')).toBeInTheDocument();
    });

    it('edits name in editor header', async () => {
      const sources = [makeSharedDs('s1', 'Original')];
      const onUpdate = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} onUpdate={onUpdate} />);
      const nameInput = screen.getByDisplayValue('Original');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Renamed');
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('Tags display', () => {
    it('shows tags when present', () => {
      const sources = [makeSharedDs('s1', 'Test', { tags: ['production', 'critical'] })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      expect(screen.getByText('production')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
    });

    it('hides tags section when tags array is empty', () => {
      const sources = [makeSharedDs('s1', 'Test', { tags: [] })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} />);
      expect(document.querySelector('.shared-ds-tags')).toBeNull();
    });
  });

  describe('Duplicate', () => {
    it('duplicates a data source', async () => {
      const sources = [makeSharedDs('s1', 'Original')];
      const onUpdate = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} onUpdate={onUpdate} />);
      
      const menuBtn = screen.getByTitle('More');
      await userEvent.click(menuBtn);
      await userEvent.click(screen.getByText('Duplicate'));
      
      expect(onUpdate).toHaveBeenCalled();
      const newSources = onUpdate.mock.calls[0][0];
      expect(newSources.length).toBe(2);
    });
  });

  describe('Dirty tracking, save confirm, and frame onClose', () => {
    it('focuses the header name field after creating the first shared data source', async () => {
      const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
      render(<ModalHarness initialSources={[]} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /\+ create first shared data source/i }));
      await waitFor(() => expect(focusSpy).toHaveBeenCalled());
      focusSpy.mockRestore();
    });

    it('enables Save on edits and clears dirty state after Save', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={vi.fn()} featureGroups={[]} />);
      const saveBtn = screen.getByRole('button', { name: /^save$/i });
      expect(saveBtn).toBeDisabled();
      const nameInput = screen.getByPlaceholderText('Data source name');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Renamed');
      expect(saveBtn).not.toBeDisabled();
      await userEvent.click(saveBtn);
      expect(saveBtn).toBeDisabled();
    });

    it('Cancel restores the saved snapshot after adding a data source', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('a', 'Alpha')]} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /\+ new/i }));
      await waitFor(() => expect(screen.getByText(/^Data Source/i)).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      await waitFor(() => {
        expect(screen.queryByText(/^Data Source \d/)).not.toBeInTheDocument();
      });
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    it('footer Cancel selects first snapshot source when current selection is gone after revert', async () => {
      render(
        <ModalHarness
          initialSources={[makeSharedDs('a', 'Alpha'), makeSharedDs('b', 'Beta')]}
          onClose={vi.fn()}
          featureGroups={[]}
        />,
      );
      await userEvent.click(screen.getByText('Beta').closest('.shared-ds-list-item')!);
      await userEvent.click(screen.getByRole('button', { name: /\+ new/i }));
      await waitFor(() => expect(screen.getByText(/^Data Source/i)).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      await waitFor(() => {
        expect(screen.getByText('Alpha').closest('.shared-ds-list-item')).toHaveClass('active');
      });
    });

    it('footer Close opens save confirm when dirty', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.clear(screen.getByPlaceholderText('Data source name'));
      await userEvent.type(screen.getByPlaceholderText('Data source name'), 'Changed');
      const footer = document.querySelector('.shared-ds-footer') as HTMLElement;
      await userEvent.click(within(footer).getByRole('button', { name: /^close$/i }));
      expect(screen.getByTestId('shared-ds-save-confirm-mock')).toBeInTheDocument();
    });

    it('save confirm Save persists, dismisses gate, and calls onClose', async () => {
      const onClose = vi.fn();
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={onClose} featureGroups={[]} />);
      await userEvent.clear(screen.getByPlaceholderText('Data source name'));
      await userEvent.type(screen.getByPlaceholderText('Data source name'), 'Changed');
      const footer = document.querySelector('.shared-ds-footer') as HTMLElement;
      await userEvent.click(within(footer).getByRole('button', { name: /^close$/i }));
      await userEvent.click(screen.getByRole('button', { name: /^save changes$/i }));
      expect(onClose).toHaveBeenCalled();
    });

    it('save confirm Discard reverts and calls onClose', async () => {
      const onClose = vi.fn();
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={onClose} featureGroups={[]} />);
      await userEvent.clear(screen.getByPlaceholderText('Data source name'));
      await userEvent.type(screen.getByPlaceholderText('Data source name'), 'Changed');
      const footer = document.querySelector('.shared-ds-footer') as HTMLElement;
      await userEvent.click(within(footer).getByRole('button', { name: /^close$/i }));
      await userEvent.click(screen.getByRole('button', { name: /^discard changes$/i }));
      await waitFor(() => expect(screen.getByDisplayValue('One')).toBeInTheDocument());
      expect(onClose).toHaveBeenCalled();
    });

    it('save confirm Cancel leaves the modal open', async () => {
      const onClose = vi.fn();
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={onClose} featureGroups={[]} />);
      await userEvent.clear(screen.getByPlaceholderText('Data source name'));
      await userEvent.type(screen.getByPlaceholderText('Data source name'), 'Changed');
      const footer = document.querySelector('.shared-ds-footer') as HTMLElement;
      await userEvent.click(within(footer).getByRole('button', { name: /^close$/i }));
      await userEvent.click(screen.getByRole('button', { name: /^cancel save confirm$/i }));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByTestId('shared-ds-save-confirm-mock')).not.toBeInTheDocument();
    });

    it('AppModalFrame onClose opens save confirm when dirty', async () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.clear(screen.getByPlaceholderText('Data source name'));
      await userEvent.type(screen.getByPlaceholderText('Data source name'), 'Z');
      const main = screen.getAllByTestId('app-modal-frame')[0];
      await userEvent.click(within(main).getByTestId('app-modal-frame-onclose'));
      expect(screen.getByTestId('shared-ds-save-confirm-mock')).toBeInTheDocument();
    });

    it('AppModalFrame onClose calls through when not dirty', async () => {
      const onClose = vi.fn();
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={onClose} featureGroups={[]} />);
      const main = screen.getAllByTestId('app-modal-frame')[0];
      await userEvent.click(within(main).getByTestId('app-modal-frame-onclose'));
      expect(onClose).toHaveBeenCalledTimes(1);
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

  describe('Fetch UI, modals, and tabs', () => {
    const baseFetch = {
      url: 'https://api.test.com/items/{{id}}?q=s',
      method: 'GET' as const,
      headers: [{ key: 'X-A', value: '1' }],
      auth: { type: 'none' as const },
    };

    it('shows cURL template badge when rawCurl is set', () => {
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: {
            ...baseFetch,
            rawCurl: "curl https://x.com",
          },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      expect(screen.getByText('cURL template')).toBeInTheDocument();
    });

    it('toggles cURL import section and cancels it', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { ...baseFetch } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByText('cURL Import'));
      const ta = document.querySelector('.shared-ds-curl-input') as HTMLTextAreaElement;
      fireEvent.change(ta, { target: { value: ' curl https://example.com ' } });
      const curlBox = document.querySelector('.shared-ds-curl-import') as HTMLElement;
      await userEvent.click(within(curlBox).getByRole('button', { name: /^cancel$/i }));
      expect(document.querySelector('.shared-ds-curl-import')).not.toBeInTheDocument();
    });

    it('runs cURL import and opens setup wizard mock', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { ...baseFetch } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByText('cURL Import'));
      const ta = document.querySelector('.shared-ds-curl-input') as HTMLTextAreaElement;
      fireEvent.change(ta, { target: { value: 'curl -X GET https://httpbingo.org/get' } });
      await userEvent.click(screen.getByRole('button', { name: /import & apply/i }));
      expect(screen.getByTestId('setup-wizard-mock')).toBeInTheDocument();
    });

    it('applies setup wizard and closes it', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com/u', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /configure variables \+ auth/i }));
      expect(screen.getByTestId('setup-wizard-mock')).toHaveAttribute('data-source-name', 'T');
      await userEvent.click(screen.getByText('Wizard Apply'));
      expect(screen.queryByTestId('setup-wizard-mock')).not.toBeInTheDocument();
    });

    it('wizard apply with empty url template preserves existing fetch URL', async () => {
      const onUpdate = vi.fn();
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: { url: 'https://keep.me/here', method: 'GET', headers: [], auth: { type: 'none' } },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} onUpdate={onUpdate} />);
      await userEvent.click(screen.getByRole('button', { name: /configure variables \+ auth/i }));
      await userEvent.click(screen.getByText('Wizard Apply Flat URL'));
      const next = onUpdate.mock.calls.at(-1)![0][0] as SharedDataSource;
      expect(next.fetchConfig?.url).toBe('https://keep.me/here');
      expect(next.fetchConfig?.pathVariables).toBeUndefined();
    });

    it('closes setup wizard without applying', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com/u', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /configure variables \+ auth/i }));
      await userEvent.click(screen.getByText('Wizard Close'));
      expect(screen.queryByTestId('setup-wizard-mock')).not.toBeInTheDocument();
    });

    it('opens populate-from-API mock and applies append and replace', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com/u', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      await userEvent.click(screen.getByText('Populate Append'));
      expect(screen.queryByTestId('populate-from-api-mock')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      await userEvent.click(screen.getByText('Populate Replace'));
    });

    it('closes populate-from-API without applying', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com/u', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      await userEvent.click(screen.getByText('Populate Close'));
      expect(screen.queryByTestId('populate-from-api-mock')).not.toBeInTheDocument();
    });

    it('populate adapter fetchSampleData throws for unresolved variables', async () => {
      const createAdapterMock = vi.mocked(createSharedDsFetchAdapter);
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: { url: 'https://api.com/{{missing}}', method: 'GET', headers: [], auth: { type: 'none' } },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      const adapterOptions = createAdapterMock.mock.calls.at(-1)?.[0] as { fetchSampleData?: () => Promise<unknown> } | undefined;
      expect(adapterOptions?.fetchSampleData).toBeDefined();
      await expect(adapterOptions!.fetchSampleData!()).rejects.toThrow(/Unresolved variables/i);
    });

    it('populate adapter fetchSampleData throws for fetch error and HTTP error', async () => {
      const createAdapterMock = vi.mocked(createSharedDsFetchAdapter);
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: { url: 'https://api.com/items', method: 'GET', headers: [], auth: { type: 'none' } },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      const adapterOptions = createAdapterMock.mock.calls.at(-1)?.[0] as { fetchSampleData?: () => Promise<unknown> } | undefined;
      expect(adapterOptions?.fetchSampleData).toBeDefined();

      vi.mocked(proxyFetch).mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        error: 'network fail',
      });
      await expect(adapterOptions!.fetchSampleData!()).rejects.toThrow('network fail');

      vi.mocked(proxyFetch).mockResolvedValueOnce({
        status: 503,
        statusText: 'Service Unavailable',
        headers: {},
        body: '{}',
      });
      await expect(adapterOptions!.fetchSampleData!()).rejects.toThrow('HTTP 503: Service Unavailable');
    });

    it('populate adapter fetchSampleData parses body and uses draft scenario when all rows disabled', async () => {
      const createAdapterMock = vi.mocked(createSharedDsFetchAdapter);
      const ds = makeDataSource('ds1', 1, 2);
      ds.rows = ds.rows.map(row => ({ ...row, enabled: false }));
      const sources = [
        makeSharedDs('s1', 'T', {
          dataSource: ds,
          fetchConfig: { url: 'https://api.com/items', method: 'GET', headers: [], auth: { type: 'none' } },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      const adapterOptions = createAdapterMock.mock.calls.at(-1)?.[0] as { fetchSampleData?: () => Promise<unknown> } | undefined;
      expect(adapterOptions?.fetchSampleData).toBeDefined();

      vi.mocked(proxyFetch).mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{"hello":"world"}',
      });
      await expect(adapterOptions!.fetchSampleData!()).resolves.toEqual({ hello: 'world' });
      expect(proxyFetch).toHaveBeenCalledWith('https://api.com/items', 'GET', {}, undefined);
    });

    it('mapping chips and warning affordances toggle fetch sections', async () => {
      const ds = makeDataSource('d1', 1, 1);
      ds.columns[0] = { id: 'col-0', name: 'C', type: 'path', mapping: 'var1' };
      const sources = [{
        id: 's1',
        name: 'T',
        dataSource: ds,
        updatedAt: Date.now(),
        fetchConfig: { url: 'https://plain.test/no-vars', method: 'GET', headers: [], auth: { type: 'none' } },
      }];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /^path:/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /issue/i }));
      await userEvent.click(screen.getByRole('button', { name: /^param:/i }));
      await userEvent.click(screen.getByRole('button', { name: /^header:/i }));
      await userEvent.click(screen.getByRole('button', { name: /^validate:/i }));
      await userEvent.click(screen.getByRole('button', { name: /^validate:/i }));
    });

    it('collapses a tab when clicking the active tab again', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { ...baseFetch } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      const paramsBtn = screen.getByRole('button', { name: /^params\b/i });
      await userEvent.click(paramsBtn);
      expect(document.querySelector('.shared-ds-tab-content')).toBeInTheDocument();
      await userEvent.click(paramsBtn);
      expect(document.querySelector('.shared-ds-tab-content')).not.toBeInTheDocument();
    });

    it('param tab shows empty state without template variables', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://fixed.test', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /^params\b/i }));
      expect(screen.getByText(/no template variables detected/i)).toBeInTheDocument();
    });

    it('renders auth field groups for bearer, basic, api key, and oauth2', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      await userEvent.click(within(tabs).getByRole('button', { name: /^auth\b/i }));
      await waitFor(() => {
        expect(document.querySelector('.shared-ds-auth-tab')).toBeTruthy();
      });
      const authPanel = document.querySelector('.shared-ds-auth-tab') as HTMLElement;
      const authType = authPanel.querySelector('.shared-ds-fetch-auth-type') as HTMLSelectElement;

      await userEvent.selectOptions(authType, 'bearer');
      await waitFor(() => {
        expect(authPanel.querySelector('input[placeholder="Token"]')).toBeTruthy();
      });

      await userEvent.selectOptions(authType, 'basic');
      await waitFor(() => {
        expect(authPanel.querySelector('input[placeholder="Password"]')).toBeTruthy();
      });

      await userEvent.selectOptions(authType, 'apikey');
      await waitFor(() => {
        expect(authPanel.querySelector('input[placeholder="Key Name"]')).toBeTruthy();
      });

      const typeSelects = authPanel.querySelectorAll('.shared-ds-fetch-auth-type');
      await userEvent.selectOptions(typeSelects[0] as HTMLSelectElement, 'oauth2');
      await waitFor(() => {
        expect(authPanel.querySelector('input[placeholder="Token URL"]')).toBeTruthy();
      });
    });

    it('allows editing headers: change fields, add row, remove row', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com', method: 'GET', headers: [{ key: 'H', value: '1' }], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /^headers\b/i }));
      const keyInp = document.querySelector('.shared-ds-fetch-header-key') as HTMLInputElement;
      fireEvent.change(keyInp, { target: { value: 'X' } });
      await userEvent.click(screen.getByRole('button', { name: /\+ header/i }));
      const removeBtns = document.querySelectorAll('.shared-ds-fetch-header-row .btn-icon');
      fireEvent.click(removeBtns[removeBtns.length - 1]);
    });

    it('shows body textarea for non-GET requests', async () => {
      const sources = [makeSharedDs('s1', 'T', {
        fetchConfig: { url: 'https://api.com', method: 'POST', headers: [], body: '{"a":1}', auth: { type: 'none' } },
      })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /^Body\b/ }));
      const bodyTa = document.querySelector('.shared-ds-fetch-body-input') as HTMLTextAreaElement;
      await act(async () => {
        fireEvent.change(bodyTa, { target: { value: '{"x":true}' } });
      });
      await waitFor(() => expect(bodyTa).toHaveValue('{"x":true}'));
    });

    it('mapping body chip opens body tab even when method is GET', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /^body:/i }));
      expect(document.querySelector('.shared-ds-body-tab')).toBeTruthy();
    });

    it('validate mapping chip toggles fetch expanded', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      const v = screen.getByRole('button', { name: /^validate:/i });
      await userEvent.click(v);
      expect(document.querySelector('.shared-ds-tab-content')).toBeTruthy();
      await userEvent.click(v);
      expect(document.querySelector('.shared-ds-tab-content')).not.toBeInTheDocument();
    });

    it('collapses Auth and Headers tabs when re-clicked while active', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com', method: 'GET', headers: [{ key: 'H', value: 'v' }], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      const authBtn = within(tabs).getByRole('button', { name: /^auth\b/i });
      await userEvent.click(authBtn);
      await userEvent.click(authBtn);
      expect(document.querySelector('.shared-ds-auth-tab')).not.toBeInTheDocument();
      const hdrBtn = within(tabs).getByRole('button', { name: /^headers\b/i });
      await userEvent.click(hdrBtn);
      await userEvent.click(hdrBtn);
      expect(document.querySelector('.shared-ds-headers-tab')).not.toBeInTheDocument();
    });

    it('collapses Body tab when re-clicked while active', async () => {
      const sources = [makeSharedDs('s1', 'T', {
        fetchConfig: { url: 'https://api.com', method: 'POST', headers: [], body: '{}', auth: { type: 'none' } },
      })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      const bodyBtn = within(tabs).getByRole('button', { name: /^Body\b/ });
      await userEvent.click(bodyBtn);
      expect(document.querySelector('.shared-ds-body-tab')).toBeTruthy();
      await userEvent.click(bodyBtn);
      expect(document.querySelector('.shared-ds-body-tab')).not.toBeInTheDocument();
    });

    it('fires onChange handlers for bearer, basic, api key, and oauth2 credential fields', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      await userEvent.click(within(tabs).getByRole('button', { name: /^auth\b/i }));
      await waitFor(() => {
        expect(document.querySelector('.shared-ds-auth-tab')).toBeTruthy();
      });
      const panel = document.querySelector('.shared-ds-auth-tab') as HTMLElement;
      const typeSel = panel.querySelector('.shared-ds-fetch-auth-type') as HTMLSelectElement;

      await userEvent.selectOptions(typeSel, 'bearer');
      const [prefixInp, tokenInp] = panel.querySelectorAll('.shared-ds-fetch-auth-input');
      fireEvent.change(prefixInp, { target: { value: 'Custom' } });
      fireEvent.change(tokenInp, { target: { value: 'tok' } });

      await userEvent.selectOptions(typeSel, 'basic');
      const basicInputs = panel.querySelectorAll('.shared-ds-fetch-auth-input');
      fireEvent.change(basicInputs[0], { target: { value: 'u' } });
      fireEvent.change(basicInputs[1], { target: { value: 'p' } });

      await userEvent.selectOptions(typeSel, 'apikey');
      const apiInputs = panel.querySelectorAll('.shared-ds-fetch-auth-input');
      fireEvent.change(apiInputs[0], { target: { value: 'kname' } });
      fireEvent.change(apiInputs[1], { target: { value: 'kval' } });
      const inLoc = panel.querySelectorAll('.shared-ds-fetch-auth-type')[1] as HTMLSelectElement;
      fireEvent.change(inLoc, { target: { value: 'query' } });

      const typeSelOauth = panel.querySelectorAll('.shared-ds-fetch-auth-type')[0] as HTMLSelectElement;
      await userEvent.selectOptions(typeSelOauth, 'oauth2');
      const oa = panel.querySelectorAll('.shared-ds-fetch-auth-input');
      fireEvent.change(oa[0], { target: { value: 'https://tok' } });
      fireEvent.change(oa[1], { target: { value: 'cid' } });
      fireEvent.change(oa[2], { target: { value: 'sec' } });
    });

    it('updates header value field in headers tab', async () => {
      const sources = [makeSharedDs('s1', 'T', { fetchConfig: { url: 'https://api.com', method: 'GET', headers: [{ key: 'A', value: '1' }], auth: { type: 'none' } } })];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      const tabs = document.querySelector('.builder-tabs') as HTMLElement;
      await userEvent.click(within(tabs).getByRole('button', { name: /^headers\b/i }));
      const valInp = document.querySelector('.shared-ds-fetch-header-value') as HTMLInputElement;
      fireEvent.change(valInp, { target: { value: 'updated' } });
      expect(valInp).toHaveValue('updated');
    });
  });

  describe('Used-by section and create-test popup', () => {
    it('expands and collapses the used-by list', async () => {
      const sources = [makeSharedDs('s1', 'S')];
      const fg: FeatureGroup = {
        id: 'fg1',
        name: 'FG',
        scenarios: [{
          id: 'sc1',
          name: 'Sc',
          tests: [{
            id: 't1',
            name: 'T',
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
      const toggle = screen.getByRole('button', { name: /used by 1 test/i });
      await userEvent.click(toggle);
      expect(screen.getByTitle(/FG \/ Sc \/ T/)).toBeInTheDocument();
      await userEvent.click(toggle);
    });

    it('create-test popup: cancel footer and disabled submit when name blank', async () => {
      const sources = [makeSharedDs('s1', 'D', { fetchConfig: { url: 'https://x.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const onCreate = vi.fn();
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[makeFeatureGroup('fg1', 'G')]}
          onCreateTestFromSharedDs={onCreate}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      const dl = within(popup).getByPlaceholderText('Enter test name');
      await userEvent.clear(dl);
      expect(within(popup).getByRole('button', { name: /^create test$/i })).toBeDisabled();
      await userEvent.click(within(popup).getByRole('button', { name: /^cancel$/i }));
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('create-test: changing feature group resets scenario selection', async () => {
      const sources = [makeSharedDs('s1', 'D', { fetchConfig: { url: 'https://x.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const fg1 = makeFeatureGroup('fg1', 'Alpha');
      const fg2 = makeFeatureGroup('fg2', 'Beta');
      fg2.scenarios.push({ id: 'sc-extra', name: 'Extra', tests: [], auth: { type: 'none' }, enabled: true });
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[fg1, fg2]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      const fgSelect = within(popup).getAllByRole('combobox')[0];
      fireEvent.change(fgSelect, { target: { value: 'fg2' } });
      const scSelect = within(popup).getAllByRole('combobox')[1];
      expect((scSelect as HTMLSelectElement).value).toBe(fg2.scenarios[0].id);
    });

    it('create-test: scenario dropdown onChange updates target scenario', async () => {
      const sources = [makeSharedDs('s1', 'D', { fetchConfig: { url: 'https://x.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const fg = makeFeatureGroup('fg1', 'G', 2);
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[fg]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      const scSelect = within(popup).getAllByRole('combobox')[1];
      const secondSc = fg.scenarios[1];
      fireEvent.change(scSelect, { target: { value: secondSc.id } });
      expect((scSelect as HTMLSelectElement).value).toBe(secondSc.id);
    });

    it('create-test: invalid feature group id yields empty scenario options list', async () => {
      const sources = [makeSharedDs('s1', 'D', { fetchConfig: { url: 'https://x.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[makeFeatureGroup('fg1', 'G')]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      const fgSelect = within(popup).getAllByRole('combobox')[0];
      fireEvent.change(fgSelect, { target: { value: 'not-a-real-fg' } });
      const scSelect = within(popup).getAllByRole('combobox')[1] as HTMLSelectElement;
      expect(scSelect.querySelectorAll('option')).toHaveLength(0);
    });

    it('create-test popup: frame onClose dismisses modal', async () => {
      const sources = [makeSharedDs('s1', 'D', { fetchConfig: { url: 'https://x.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[makeFeatureGroup('fg1', 'G')]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      await userEvent.click(within(popup).getByTestId('app-modal-frame-onclose'));
      expect(screen.queryByText('Create Test from Shared Data Source')).not.toBeInTheDocument();
    });
  });
});


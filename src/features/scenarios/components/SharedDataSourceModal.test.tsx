/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SharedDataSourceModal from './SharedDataSourceModal';
import type { SharedDataSource, FeatureGroup, DataSource, GlobalAuthProfile } from '../../../shared/types';

// Mock uuid to return predictable IDs
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2, 8)),
}));

// Mock proxyFetch
vi.mock('../../../engine/executor', () => ({
  proxyFetch: vi.fn(),
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

// ─── Tests ────────────────────────────────────────────────────

describe('SharedDataSourceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders modal with title and close button', () => {
      render(<SharedDataSourceModal {...defaultProps} />);
      expect(screen.getByText('Shared Data Sources')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
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
  });

  describe('Close Modal', () => {
    it('calls onClose when Close button is clicked', async () => {
      const onClose = vi.fn();
      render(<SharedDataSourceModal {...defaultProps} onClose={onClose} />);
      
      const closeBtn = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeBtn);

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
  });
});

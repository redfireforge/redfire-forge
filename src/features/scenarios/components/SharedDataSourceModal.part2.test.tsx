/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOption, selectOptionByIndex, getCustomSelectValue } from '@test-utils/customSelectHelper';
import SharedDataSourceModal from './SharedDataSourceModal';
import { SharedDataSource, FeatureGroup, DataSource, GlobalAuthProfile } from '@shared/types';
import { proxyFetch } from '@engine/core/executor';
// Mock uuid to return predictable IDs
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2, 8)),
}));

// Mock proxyFetch
vi.mock('@engine/core/executor', () => ({
  proxyFetch: vi.fn(),
  buildHeaders: vi.fn(() => ({})),
}));

/** Minimal frame so `onClose` (dirty gate) can be exercised — production uses closeButtonKind none + closeOnOverlayClick false */
vi.mock('@shared/components/AppModalFrame', async () => {
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

vi.mock('@shared/components/data-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/components/data-mapper')>();
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

vi.mock('@shared/components/ConfirmModal', () => ({
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
      selectOptionByIndex(popup, 0, 'Group B');
      const scenarioWrapper = popup.querySelectorAll('.cs-wrapper')[1]!;
      expect(getCustomSelectValue(scenarioWrapper)).toBe('Scenario 1');
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
      selectOptionByIndex(popup, 0, 'No Scenarios');
      const scenarioWrapper = popup.querySelectorAll('.cs-wrapper')[1]!;
      expect(getCustomSelectValue(scenarioWrapper)).toBe('');
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
      selectOption(document.querySelector('.shared-ds-fetch-method')!, 'POST');
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

    it('shows Auth tab badge when fetch auth type is bearer', () => {
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: {
            url: 'https://api.test.com',
            method: 'GET',
            headers: [],
            auth: { type: 'bearer', token: 'secret' },
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

    it('focuses and selects header name after "+ New" when pending name focus matches selection', async () => {
      const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
      const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select').mockImplementation(() => {});
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'Existing')]} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /\+ new/i }));
      await waitFor(() => {
        expect(focusSpy).toHaveBeenCalled();
        expect(selectSpy).toHaveBeenCalled();
      });
      focusSpy.mockRestore();
      selectSpy.mockRestore();
    });

    it('footer Cancel and Save stay disabled while snapshot is clean', () => {
      render(<ModalHarness initialSources={[makeSharedDs('s1', 'One')]} onClose={vi.fn()} featureGroups={[]} />);
      const footer = document.querySelector('.shared-ds-footer') as HTMLElement;
      expect(within(footer).getByRole('button', { name: /^cancel$/i })).toBeDisabled();
      expect(within(footer).getByRole('button', { name: /^save$/i })).toBeDisabled();
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

});

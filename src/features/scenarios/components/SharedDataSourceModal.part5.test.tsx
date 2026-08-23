/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOption, selectOptionByIndex, getCustomSelectValue, getCustomSelectOptionLabels } from '../../../test-utils/customSelectHelper';
import SharedDataSourceModal from './SharedDataSourceModal';
import { SharedDataSource, FeatureGroup, DataSource, GlobalAuthProfile } from '@shared/types';
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      selectOptionByIndex(popup, 0, 'Beta');
      const scenarioWrapper = popup.querySelectorAll('.cs-wrapper')[1]!;
      expect(getCustomSelectValue(scenarioWrapper)).toBe(fg2.scenarios[0].name);
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
      const scenarioWrapper = popup.querySelectorAll('.cs-wrapper')[1]!;
      const secondSc = fg.scenarios[1];
      selectOption(scenarioWrapper, secondSc.name);
      expect(getCustomSelectValue(scenarioWrapper)).toBe(secondSc.name);
    });

    it('create-test: feature group with zero scenarios yields empty scenario options list', async () => {
      const sources = [makeSharedDs('s1', 'D', { fetchConfig: { url: 'https://x.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      const emptyFg = makeFeatureGroup('fgEmpty', 'Empty Group', 0);
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[makeFeatureGroup('fg1', 'G'), emptyFg]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      selectOptionByIndex(popup, 0, 'Empty Group');
      const scenarioWrapper = popup.querySelectorAll('.cs-wrapper')[1]!;
      expect(getCustomSelectOptionLabels(scenarioWrapper)).toHaveLength(0);
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

    it('create-test: empty featureGroups yields blank target ids from fallback', async () => {
      const sources = [makeSharedDs('s1', 'D', { fetchConfig: { url: 'https://x.com', method: 'GET', headers: [], auth: { type: 'none' } } })];
      render(
        <SharedDataSourceModal
          {...defaultProps}
          sharedDataSources={sources}
          featureGroups={[]}
          onCreateTestFromSharedDs={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /\+ create test/i }));
      const popup = screen.getByText('Create Test from Shared Data Source').closest('[data-testid="app-modal-frame"]')!;
      const wrappers = popup.querySelectorAll('.cs-wrapper');
      expect(getCustomSelectValue(wrappers[0]!)).toBe('');
      expect(getCustomSelectValue(wrappers[1]!)).toBe('');
      expect(within(popup).getByRole('button', { name: /^create test$/i })).toBeDisabled();
    });

    it('used-by expanded list shows editing marker for current draft reference', async () => {
      const sources = [makeSharedDs('s1', 'Shared')];
      const currentEditingDraft = {
        fgName: 'FG',
        scenarioName: 'Scenario',
        test: {
          id: 'tx',
          name: 'Draft Linked',
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
      await userEvent.click(screen.getByRole('button', { name: /used by 1 test/i }));
      expect(screen.getByText(/Draft Linked/)).toBeInTheDocument();
      expect(screen.getByText(/✎/)).toBeInTheDocument();
    });
  });
});

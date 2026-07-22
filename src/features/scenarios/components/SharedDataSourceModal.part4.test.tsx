/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOption } from '../../../test-utils/customSelectHelper';
import SharedDataSourceModal from './SharedDataSourceModal';
import { SharedDataSource, FeatureGroup, DataSource, GlobalAuthProfile } from '../../../shared/types';
import { proxyFetch } from '../../../engine/executor';
import { createSharedDsFetchAdapter } from '../../../shared/components/data-mapper';
import { MapperFetchError } from '../../../shared/components/data-mapper/types';

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

function _makeFeatureGroup(id: string, name: string, scenarioCount = 1): FeatureGroup {
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

    it('wizard apply after stripping fetchConfig merges defaults and keeps flat URL empty', async () => {
      render(
        <WizardStripHarness
          initial={[
            makeSharedDs('s1', 'T', {
              fetchConfig: { url: 'https://before-strip.example/', method: 'GET', headers: [], auth: { type: 'none' } },
            }),
          ]}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /configure variables \+ auth/i }));
      await userEvent.click(screen.getByTestId('strip-shared-fetch-config'));
      await userEvent.click(screen.getByText('Wizard Apply Flat URL'));
      const urlInput = document.querySelector('.shared-ds-fetch-url') as HTMLInputElement;
      await waitFor(() => expect(urlInput.value).toBe(''));
      expect(screen.queryByTestId('setup-wizard-mock')).not.toBeInTheDocument();
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

    it('populate replace mode replaces rows instead of appending', async () => {
      const tbl = makeDataSource('ds-pop', 1, 3);
      const sources = [
        makeSharedDs('s1', 'T', {
          dataSource: tbl,
          fetchConfig: { url: 'https://api.com/u', method: 'GET', headers: [], auth: { type: 'none' } },
        }),
      ];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      expect(screen.getByTestId('data-source-editor-stub')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      await userEvent.click(screen.getByText('Populate Replace'));
      await waitFor(() => {
        const footer = document.querySelector('.shared-ds-footer') as HTMLElement;
        expect(within(footer).getByText(/total rows/i).textContent).toMatch(/0 total rows/);
      });
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

    it('populate adapter fetchSampleData throws when draft scenario becomes unavailable', async () => {
      const createAdapterMock = vi.mocked(createSharedDsFetchAdapter);
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: { url: 'https://api.com/items', method: 'GET', headers: [], auth: { type: 'none' } },
        }),
      ];
      render(<ModalHarness initialSources={sources} onClose={vi.fn()} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      const adapterOptions = createAdapterMock.mock.calls.at(-1)?.[0] as { fetchSampleData?: () => Promise<unknown> } | undefined;
      expect(adapterOptions?.fetchSampleData).toBeDefined();
      const fetchSampleData = adapterOptions!.fetchSampleData!;

      const urlInput = document.querySelector('.shared-ds-fetch-url') as HTMLInputElement;
      fireEvent.change(urlInput, { target: { value: '' } });
      await waitFor(() => expect(screen.queryByTestId('populate-from-api-mock')).not.toBeInTheDocument());

      await expect(fetchSampleData()).rejects.toThrow(/Fetch configuration unavailable/i);
    });

    it('populate adapter fetchSampleData wraps proxy errors in MapperFetchError with timing detail', async () => {
      const createAdapterMock = vi.mocked(createSharedDsFetchAdapter);
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: { url: 'https://api.com/items', method: 'GET', headers: [], auth: { type: 'none' } },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /populate rows from api/i }));
      const adapterOptions = createAdapterMock.mock.calls.at(-1)?.[0] as { fetchSampleData?: () => Promise<unknown> } | undefined;

      vi.mocked(proxyFetch).mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '',
        error: 'boom',
        timing: { ttfb: 11, total: 22 },
      });
      try {
        await adapterOptions!.fetchSampleData!();
        expect.fail('expected rejection');
      } catch (e) {
        expect(e).toBeInstanceOf(MapperFetchError);
        expect((e as MapperFetchError).detail.timing).toEqual({ ttfb: 11, total: 22 });
      }

      vi.mocked(proxyFetch).mockResolvedValueOnce({
        status: 422,
        statusText: 'Nope',
        headers: {},
        body: '',
        timing: { ttfb: 3, total: 9 },
      });
      try {
        await adapterOptions!.fetchSampleData!();
        expect.fail('expected rejection');
      } catch (e) {
        expect(e).toBeInstanceOf(MapperFetchError);
        expect((e as MapperFetchError).detail.status).toBe(422);
        expect((e as MapperFetchError).detail.timing).toEqual({ ttfb: 3, total: 9 });
      }
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

    it('param tab shows literal query parameter values when URL includes plain query pairs', async () => {
      const sources = [
        makeSharedDs('s1', 'T', {
          fetchConfig: {
            url: 'https://api.example.com/items?tag=prod&sort=name',
            method: 'GET',
            headers: [],
            auth: { type: 'none' },
          },
        }),
      ];
      render(<SharedDataSourceModal {...defaultProps} sharedDataSources={sources} featureGroups={[]} />);
      await userEvent.click(screen.getByRole('button', { name: /^params\b/i }));
      expect(screen.getByText('prod')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
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
      const authType = authPanel.querySelector('.shared-ds-fetch-auth-type')!;

      selectOption(authType, 'Bearer Token');
      await waitFor(() => {
        expect(authPanel.querySelector('input[placeholder="Token"]')).toBeTruthy();
      });

      selectOption(authType, 'Basic Auth');
      await waitFor(() => {
        expect(authPanel.querySelector('input[placeholder="Password"]')).toBeTruthy();
      });

      selectOption(authType, 'API Key');
      await waitFor(() => {
        expect(authPanel.querySelector('input[placeholder="Key Name"]')).toBeTruthy();
      });

      const typeSelects = authPanel.querySelectorAll('.shared-ds-fetch-auth-type');
      selectOption(typeSelects[0]!, 'OAuth2 Client Credentials');
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
      const typeSel = panel.querySelector('.shared-ds-fetch-auth-type')!;

      selectOption(typeSel, 'Bearer Token');
      const [prefixInp, tokenInp] = panel.querySelectorAll('.shared-ds-fetch-auth-input');
      fireEvent.change(prefixInp, { target: { value: 'Custom' } });
      fireEvent.change(tokenInp, { target: { value: 'tok' } });

      selectOption(typeSel, 'Basic Auth');
      const basicInputs = panel.querySelectorAll('.shared-ds-fetch-auth-input');
      fireEvent.change(basicInputs[0], { target: { value: 'u' } });
      fireEvent.change(basicInputs[1], { target: { value: 'p' } });

      selectOption(typeSel, 'API Key');
      const apiInputs = panel.querySelectorAll('.shared-ds-fetch-auth-input');
      fireEvent.change(apiInputs[0], { target: { value: 'kname' } });
      fireEvent.change(apiInputs[1], { target: { value: 'kval' } });
      const inLoc = panel.querySelectorAll('.shared-ds-fetch-auth-type')[1]!;
      selectOption(inLoc, 'Query String');

      const typeSelOauth = panel.querySelectorAll('.shared-ds-fetch-auth-type')[0]!;
      selectOption(typeSelOauth, 'OAuth2 Client Credentials');
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

});

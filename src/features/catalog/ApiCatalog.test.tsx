/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApiCatalog from './ApiCatalog';
import type { UseCatalogReturn } from './hooks/useCatalog';
import { makeEntry, makeScheme, makeHostConfig } from './components/catalogTestFactories';
import type { GlobalAuthProfile, Microservice } from '../../shared/types';
import type { CatalogEndpoint, CatalogEntry } from './types/catalog';

const buildCoverageMap = vi.fn();
const scanWorkflowsForCatalogRef = vi.fn();
const removeCatalogNodesFromWorkflows = vi.fn();
const loadCatalogRawSpec = vi.fn();
const loadWorkflowPreviews = vi.fn();
const addWorkflowPreview = vi.fn();
const removeWorkflowPreview = vi.fn();
const getPreviewedEndpointIds = vi.fn();
let latestBrowserProps: Record<string, unknown> | null = null;
let latestPublishedPanelProps: Record<string, unknown> | null = null;
let latestPublishRequest: Record<string, unknown> | null = null;
let latestUnpublishDialogProps: Record<string, unknown> | null = null;
const previewStore: Record<string, {
  entryId: string;
  endpointId: string;
  method: string;
  path: string;
  summary: string;
  entryName: string;
  addedAt: number;
  values?: { paramValues: Record<string, string>; headerValues: Record<string, string>; body?: string };
}> = {};
vi.mock('./utils/coverageChecker', () => ({
  buildCoverageMap: (...args: unknown[]) => buildCoverageMap(...args),
}));
vi.mock('./utils/workflowExposureScanner', () => ({
  scanWorkflowsForCatalogRef: (...args: unknown[]) => scanWorkflowsForCatalogRef(...args),
  removeCatalogNodesFromWorkflows: (...args: unknown[]) => removeCatalogNodesFromWorkflows(...args),
}));
vi.mock('../../shared/utils/workflowPreviewStorage', () => ({
  loadWorkflowPreviews: (...args: unknown[]) => loadWorkflowPreviews(...args),
  addWorkflowPreview: (...args: unknown[]) => addWorkflowPreview(...args),
  removeWorkflowPreview: (...args: unknown[]) => removeWorkflowPreview(...args),
  getPreviewedEndpointIds: (...args: unknown[]) => getPreviewedEndpointIds(...args),
}));

vi.mock('./components/CatalogWelcome', () => ({
  default: ({ onImport }: { onImport: () => void }) => (
    <div data-testid="welcome">
      <button onClick={onImport}>import</button>
    </div>
  ),
}));

vi.mock('./components/CatalogOverview', () => ({
  default: ({ onReimport, onVersionHistory, onExportSpec, onConvertToOpenApi, onViewYaml }: {
    onReimport: () => void;
    onVersionHistory: () => void;
    onExportSpec: () => void;
    onConvertToOpenApi?: () => void;
    onViewYaml?: () => void;
  }) => (
    <div data-testid="overview">
      <button onClick={onReimport}>reimport</button>
      <button onClick={onVersionHistory}>history</button>
      <button onClick={onExportSpec}>export-spec</button>
      <button onClick={() => onConvertToOpenApi?.()}>convert-openapi</button>
      <button onClick={() => onViewYaml?.()}>view-yaml</button>
    </div>
  ),
}));

const fakeEndpoint = { id: 'ep1' } as unknown as CatalogEndpoint;

vi.mock('./components/CatalogEndpointBrowser', () => ({
  default: ({ onAuthChange, onHostChange, onEditEntry, onExportSingle, onSendToHarness, onSetWorkflowExposure }: {
    onAuthChange: (a: unknown) => void;
    onHostChange: (p: unknown) => void;
    onEditEntry?: () => void;
    onExportSingle?: (ep: unknown, vals?: unknown) => void;
    onSendToHarness?: (ep: unknown, t?: boolean) => void;
    onSetWorkflowExposure?: (ep: unknown, mode: string | undefined, vals: unknown) => void;
  }) => {
    latestBrowserProps = { onAuthChange, onHostChange, onEditEntry, onExportSingle, onSendToHarness, onSetWorkflowExposure };
    return (
    <div data-testid="browser">
      <button onClick={() => onAuthChange({ type: 'bearer', token: 't' })}>auth-change</button>
      <button onClick={() => onHostChange({ strategy: 'hardcoded', hardcodedUrl: 'x' })}>host-change</button>
      <button onClick={() => onEditEntry?.()}>edit-entry</button>
      <button onClick={() => onExportSingle?.({ id: 'ep1' }, { params: {}, headers: {}, body: '' })}>export-single</button>
      <button onClick={() => onSendToHarness?.({ id: 'ep1' }, true)}>send-harness</button>
      <button onClick={() => onSetWorkflowExposure?.({ id: 'ep1' }, 'preview', { params: { a: '1' }, headers: { h: '2' }, body: '{}' })}>toggle-expose</button>
      <button onClick={() => onSetWorkflowExposure?.({ id: 'ep1', summary: 'Endpoint 1', path: '/ep1', method: 'POST' }, 'published', { params: { a: '1' }, headers: { h: '2' }, body: '{}' })}>toggle-publish</button>
      <button onClick={() => onSetWorkflowExposure?.({ id: 'ep1' }, undefined, { params: {}, headers: {}, body: '' })}>toggle-hide</button>
      <button
        onClick={() => onSetWorkflowExposure?.(
          { id: 'ep1', summary: 'Endpoint 1', path: '/ep1', method: 'POST', workflowExposure: 'published', exposedToWorkflow: true },
          undefined,
          { params: {}, headers: {}, body: '' },
        )}
      >
        toggle-hide-published
      </button>
    </div>
    );
  },
}));

vi.mock('./components/CatalogSendToRequestsModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="send-modal">
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}));

vi.mock('./components/CatalogYamlViewerModal', () => ({
  default: ({ yaml, onClose }: { yaml: string; onClose: () => void }) => (
    <div data-testid="yaml-modal">
      <div>{yaml}</div>
      <button onClick={onClose}>close-yaml</button>
    </div>
  ),
}));

vi.mock('./components/UnpublishConfirmDialog', () => ({
  default: ({
    onPaletteOnly,
    onPaletteAndWorkflows,
    onCancel,
  }: {
    onPaletteOnly: () => void;
    onPaletteAndWorkflows: () => void;
    onCancel: () => void;
  }) => {
    latestUnpublishDialogProps = { onPaletteOnly, onPaletteAndWorkflows, onCancel };
    return (
    <div data-testid="unpublish-dialog">
      <button onClick={onPaletteOnly}>palette-only</button>
      <button onClick={onPaletteAndWorkflows}>palette-and-workflows</button>
      <button onClick={onCancel}>cancel-unpublish</button>
    </div>
    );
  },
}));

vi.mock('./components/PublishedEndpointsPanel', () => ({
  default: ({
    onUnpublish,
    onBulkUnpublish,
    onRepublish,
    onBulkRepublish,
    onPromotePreview,
    onRemovePreview,
    onViewInCatalog,
  }: {
    onUnpublish?: (entryId: string, endpointId: string) => void;
    onBulkUnpublish?: (ids: Array<{ entryId: string; endpointId: string }>) => void;
    onRepublish?: (entryId: string, endpointId: string) => void;
    onBulkRepublish?: (ids: Array<{ entryId: string; endpointId: string }>) => void;
    onPromotePreview?: (entryId: string, endpointId: string) => void;
    onRemovePreview?: (entryId: string, endpointId: string) => void;
    onViewInCatalog?: (entryId: string, endpointId: string) => void;
  }) => {
    latestPublishedPanelProps = {
      onUnpublish,
      onBulkUnpublish,
      onRepublish,
      onBulkRepublish,
      onPromotePreview,
      onRemovePreview,
      onViewInCatalog,
    };
    return (
    <div data-testid="published-panel">
      <button onClick={() => onUnpublish?.('entry1', 'ep1')}>panel-unpublish</button>
      <button onClick={() => onBulkUnpublish?.([{ entryId: 'entry1', endpointId: 'ep1' }])}>panel-bulk-unpublish</button>
      <button onClick={() => onRepublish?.('entry1', 'ep1')}>panel-republish</button>
      <button onClick={() => onBulkRepublish?.([{ entryId: 'entry1', endpointId: 'ep1' }])}>panel-bulk-republish</button>
      <button onClick={() => onPromotePreview?.('entry1', 'ep1')}>panel-promote-preview</button>
      <button onClick={() => onRemovePreview?.('entry1', 'ep1')}>panel-remove-preview</button>
      <button onClick={() => onViewInCatalog?.('entry1', 'ep1')}>panel-view-in-catalog</button>
    </div>
    );
  },
}));

vi.mock('./components/PublishEndpointModal', () => ({
  default: ({
    request,
    onConfirm,
    onCancel,
  }: {
    request: Record<string, unknown>;
    onConfirm: (result: { includeValues: boolean; note: string }) => void;
    onCancel: () => void;
  }) => {
    latestPublishRequest = request;
    return (
    <div data-testid="publish-modal">
      <button onClick={() => onConfirm({ includeValues: true, note: 'publish-note' })}>confirm-publish</button>
      <button onClick={() => onConfirm({ includeValues: false, note: '' })}>confirm-publish-no-values</button>
      <button onClick={onCancel}>cancel-publish</button>
    </div>
    );
  },
}));

const loadCatalogView = vi.fn();
const saveCatalogView = vi.fn();
vi.mock('../../shared/utils/storageCatalog', () => ({
  loadCatalogView: (...args: unknown[]) => loadCatalogView(...args),
  saveCatalogView: (...args: unknown[]) => saveCatalogView(...args),
  loadCatalogRawSpec: (...args: unknown[]) => loadCatalogRawSpec(...args),
}));

function makeCatalog(entry: CatalogEntry | null, loaded = true): UseCatalogReturn {
  return {
    entries: entry ? [entry] : [],
    loaded,
    selectedEntry: entry,
    selectedEntryId: entry?.id,
    selectedEndpointId: undefined,
    updateEntry: vi.fn(),
    addEntry: vi.fn(),
    addVersionToEntry: vi.fn(),
    findByTitle: vi.fn(),
    switchVersion: vi.fn(),
    removeEntry: vi.fn(),
    selectEntry: vi.fn(),
    selectEndpoint: vi.fn(),
    loadRawSpec: vi.fn(),
    removeVersion: vi.fn(),
  } as unknown as UseCatalogReturn;
}

beforeEach(() => {
  vi.clearAllMocks();
  latestBrowserProps = null;
  latestPublishedPanelProps = null;
  latestPublishRequest = null;
  latestUnpublishDialogProps = null;
  for (const key of Object.keys(previewStore)) delete previewStore[key];
  buildCoverageMap.mockReturnValue(new Map());
  loadCatalogView.mockResolvedValue(null);
  saveCatalogView.mockResolvedValue(undefined);
  loadCatalogRawSpec.mockResolvedValue('openapi: 3.0.4');
  scanWorkflowsForCatalogRef.mockResolvedValue([]);
  removeCatalogNodesFromWorkflows.mockResolvedValue(undefined);
  loadWorkflowPreviews.mockResolvedValue({ ...previewStore });
  addWorkflowPreview.mockImplementation(async (preview: {
    entryId: string;
    endpointId: string;
    method: string;
    path: string;
    summary: string;
    entryName: string;
    addedAt: number;
    values?: { paramValues: Record<string, string>; headerValues: Record<string, string>; body?: string };
  }) => {
    previewStore[`${preview.entryId}::${preview.endpointId}`] = preview;
  });
  removeWorkflowPreview.mockImplementation(async (entryId: string, endpointId: string) => {
    delete previewStore[`${entryId}::${endpointId}`];
  });
  getPreviewedEndpointIds.mockImplementation((map: Record<string, { endpointId: string }>, entryId: string) => {
    const ids = Object.keys(map)
      .filter(key => key.startsWith(`${entryId}::`))
      .map(key => map[key].endpointId);
    return new Set(ids);
  });
});

describe('ApiCatalog', () => {
  it('renders a loading state when not loaded', () => {
    render(<ApiCatalog catalog={makeCatalog(null, false)} onImport={vi.fn()} />);
    expect(screen.getByText('Loading API Catalog...')).toBeInTheDocument();
  });

  it('renders the welcome screen when no entry is selected', async () => {
    const onImport = vi.fn();
    render(<ApiCatalog catalog={makeCatalog(null)} onImport={onImport} />);
    await userEvent.click(screen.getByRole('button', { name: 'import' }));
    expect(onImport).toHaveBeenCalled();
  });

  it('switches between Overview and Endpoints tabs', async () => {
    const entry = makeEntry();
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Overview'));
    await userEvent.click(screen.getByText('Endpoints'));
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('restores the saved view for the selected entry on mount', async () => {
    const entry = makeEntry();
    loadCatalogView.mockResolvedValue('overview');
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);

    await waitFor(() => expect(loadCatalogView).toHaveBeenCalledWith('entry1'));
    await waitFor(() => {
      const overviewTab = screen.getByRole('button', { name: 'Overview' });
      expect(overviewTab.className.includes('active')).toBe(true);
    });
  });

  it('persists view changes for the selected entry', async () => {
    const entry = makeEntry();
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);

    await userEvent.click(screen.getByText('Overview'));

    await waitFor(() => expect(saveCatalogView).toHaveBeenCalledWith('entry1', 'overview'));
  });

  it('ignores invalid saved view values from storage', async () => {
    const entry = makeEntry();
    loadCatalogView.mockResolvedValue('invalid-tab-name');
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);
    await waitFor(() => expect(loadCatalogView).toHaveBeenCalledWith('entry1'));
    const endpointsTab = screen.getByRole('button', { name: 'Endpoints' });
    expect(endpointsTab.className.includes('active')).toBe(true);
  });

  it('forwards Overview actions', async () => {
    const entry = makeEntry();
    const onReimport = vi.fn();
    const onVersionHistory = vi.fn();
    const onExportSpec = vi.fn();
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        onReimport={onReimport}
        onVersionHistory={onVersionHistory}
        onExportSpec={onExportSpec}
      />,
    );
    await userEvent.click(screen.getByText('Overview'));
    await userEvent.click(screen.getByRole('button', { name: 'reimport' }));
    await userEvent.click(screen.getByRole('button', { name: 'history' }));
    await userEvent.click(screen.getByRole('button', { name: 'export-spec' }));
    expect(onReimport).toHaveBeenCalledWith('entry1');
    expect(onVersionHistory).toHaveBeenCalledWith('entry1');
    expect(onExportSpec).toHaveBeenCalledWith('entry1');
  });

  it('shows the export tab and renders the send modal inline', async () => {
    const entry = makeEntry();
    const onExportConfirm = vi.fn();
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        onExportConfirm={onExportConfirm}
        collections={[]}
      />,
    );
    await userEvent.click(screen.getByText('Export to Requests'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'close-modal' }));
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('renders export modal with fallback empty arrays/objects when optional props are omitted', async () => {
    const entry = makeEntry();
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        onExportConfirm={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('Export to Requests'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();
  });

  it('forwards endpoint browser callbacks to the catalog', async () => {
    const entry = makeEntry();
    const catalog = makeCatalog(entry);
    const onExportSingleEndpoint = vi.fn();
    const onSendEndpointToHarness = vi.fn();
    const onEditEntry = vi.fn();
    render(
      <ApiCatalog
        catalog={catalog}
        onImport={vi.fn()}
        onExportSingleEndpoint={onExportSingleEndpoint}
        onSendEndpointToHarness={onSendEndpointToHarness}
        onEditEntry={onEditEntry}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'auth-change' }));
    await userEvent.click(screen.getByRole('button', { name: 'host-change' }));
    await userEvent.click(screen.getByRole('button', { name: 'edit-entry' }));
    await userEvent.click(screen.getByRole('button', { name: 'export-single' }));
    await userEvent.click(screen.getByRole('button', { name: 'send-harness' }));
    await userEvent.click(screen.getByRole('button', { name: 'toggle-expose' }));
    expect(catalog.updateEntry).toHaveBeenCalled();
    expect(onExportSingleEndpoint).toHaveBeenCalledWith(entry, { id: 'ep1' }, expect.any(Object));
    expect(onSendEndpointToHarness).toHaveBeenCalledWith(entry, { id: 'ep1' }, true);
    expect(onEditEntry).toHaveBeenCalledWith('entry1');
    void fakeEndpoint;
  });

  it('initializes auth from inherited apiKey scheme', () => {
    const entry = makeEntry({ securitySchemes: { apiKeyAuth: makeScheme({ type: 'apiKey', name: 'X-Key', in: 'query' }) } });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('initializes auth from inherited http basic scheme', () => {
    const entry = makeEntry({ securitySchemes: { basicAuth: makeScheme({ type: 'http', scheme: 'basic' }) } });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('initializes auth from saved global profile', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Prod Key', auth: { type: 'bearer', token: 'abc' } },
    ];
    const entry = makeEntry({ savedAuth: { type: 'bearer', token: 'abc', __globalProfileId: 'p1' } });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} globalAuthProfiles={profiles} />);
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('initializes auth from a plain saved auth', () => {
    const entry = makeEntry({ savedAuth: { type: 'bearer', token: 'plain' } });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('initializes auth from a linked microservice profile', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Svc Profile', auth: { type: 'bearer', token: 'svc' } },
    ];
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://svc.com' },
      authProfileIds: { e1: 'p1' },
    };
    const entry = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e1' }),
    });
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        globalAuthProfiles={profiles}
        appMicroservices={[svc]}
      />,
    );
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('resets auth to none when environment changes to one without a profile', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'A', auth: { type: 'bearer', token: 'a' } },
    ];
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://a.com', e2: 'https://b.com' },
      authProfileIds: { e1: 'p1' },
    };
    const entry1 = makeEntry({
      microserviceId: 'svc1',
      savedAuth: { type: 'bearer', token: 'a' },
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e1' }),
    });
    const catalog = makeCatalog(entry1);
    const { rerender } = render(
      <ApiCatalog catalog={catalog} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />,
    );
    const entry2 = makeEntry({
      microserviceId: 'svc1',
      savedAuth: { type: 'bearer', token: 'a' },
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e2' }),
    });
    const catalog2 = { ...catalog, selectedEntry: entry2, entries: [entry2] } as unknown as UseCatalogReturn;
    rerender(<ApiCatalog catalog={catalog2} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />);
    expect(catalog2.updateEntry).toHaveBeenCalledWith('entry1', { savedAuth: { type: 'none' } });
  });

  it('initializes apiKey auth in header when scheme uses header location', () => {
    const entry = makeEntry({
      securitySchemes: { keyAuth: makeScheme({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }) },
    });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('falls back to plain savedAuth when global profile id is stale', () => {
    const entry = makeEntry({
      savedAuth: { type: 'bearer', token: 'saved-token', __globalProfileId: 'missing-profile' },
    });
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        globalAuthProfiles={[{ id: 'p1', name: 'Live', auth: { type: 'bearer', token: 'live' } }]}
      />,
    );
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('resolves microservice auth via first available profile when environment is unset', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Default', auth: { type: 'bearer', token: 'fallback' } },
    ];
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://svc.com' },
      authProfileIds: { e1: 'p1' },
    };
    const entry = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'environment' }),
    });
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        globalAuthProfiles={profiles}
        appMicroservices={[svc]}
      />,
    );
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('shows export tab when only onSendToRequests is provided', () => {
    const entry = makeEntry();
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        onSendToRequests={vi.fn()}
      />,
    );
    expect(screen.getByText('Export to Requests')).toBeInTheDocument();
  });

  it('builds coverage map when collections are provided', () => {
    const entry = makeEntry();
    const collections = [{ id: 'c1', name: 'Col', requests: [] }] as unknown as import('../../shared/types').RequestCollection[];
    buildCoverageMap.mockReturnValue(new Map([['ep1', true]]));
    render(
      <ApiCatalog
        catalog={makeCatalog(entry)}
        onImport={vi.fn()}
        collections={collections}
      />,
    );
    expect(buildCoverageMap).toHaveBeenCalledWith('entry1', 'My API', collections);
  });

  it('clears workflow exposure when toggle is turned off', async () => {
    const entry = makeEntry();
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'toggle-hide' }));
    expect(catalog.updateEntry).toHaveBeenCalledWith(
      'entry1',
      expect.objectContaining({
        endpoints: expect.any(Array),
        folders: expect.any(Array),
      }),
    );
  });

  it('skips env auth sync when host strategy is not environment', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'A', auth: { type: 'bearer', token: 'a' } },
    ];
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://a.com', e2: 'https://b.com' },
      authProfileIds: { e1: 'p1' },
    };
    const entry1 = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e1' }),
    });
    const catalog = makeCatalog(entry1);
    const { rerender } = render(
      <ApiCatalog catalog={catalog} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />,
    );
    vi.mocked(catalog.updateEntry).mockClear();
    const entry2 = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'hardcoded', hardcodedUrl: 'https://x.com', environmentId: 'e2' }),
    });
    const catalog2 = { ...catalog, selectedEntry: entry2, entries: [entry2] } as unknown as UseCatalogReturn;
    rerender(<ApiCatalog catalog={catalog2} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />);
    expect(catalog2.updateEntry).not.toHaveBeenCalled();
  });

  it('resets auth when env profile id is missing from global profiles', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'A', auth: { type: 'bearer', token: 'a' } },
    ];
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://a.com', e2: 'https://b.com' },
      authProfileIds: { e1: 'p1', e2: 'missing' },
    };
    const entry1 = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e1' }),
    });
    const catalog = makeCatalog(entry1);
    const { rerender } = render(
      <ApiCatalog catalog={catalog} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />,
    );
    const entry2 = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e2' }),
    });
    const catalog2 = { ...catalog, selectedEntry: entry2, entries: [entry2] } as unknown as UseCatalogReturn;
    rerender(<ApiCatalog catalog={catalog2} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />);
    expect(catalog2.updateEntry).toHaveBeenCalledWith('entry1', { savedAuth: { type: 'none' } });
  });

  it('initializes inherited bearer scheme when security scheme is http bearer', () => {
    const entry = makeEntry({ securitySchemes: { bearerAuth: makeScheme({ type: 'http', scheme: 'bearer' }) } });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);
    expect(screen.getByTestId('browser')).toBeInTheDocument();
  });

  it('updates auth when the environment changes for a linked microservice', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'A', auth: { type: 'bearer', token: 'a' } },
      { id: 'p2', name: 'B', auth: { type: 'bearer', token: 'b' } },
    ];
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://a.com', e2: 'https://b.com' },
      authProfileIds: { e1: 'p1', e2: 'p2' },
    };
    const entry1 = makeEntry({
      microserviceId: 'svc1',
      savedAuth: { type: 'bearer', token: 'a' },
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e1' }),
    });
    const catalog = makeCatalog(entry1);
    const { rerender } = render(
      <ApiCatalog catalog={catalog} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />,
    );
    const entry2 = makeEntry({
      microserviceId: 'svc1',
      savedAuth: { type: 'bearer', token: 'a' },
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e2' }),
    });
    const catalog2 = { ...catalog, selectedEntry: entry2, entries: [entry2] } as unknown as UseCatalogReturn;
    rerender(<ApiCatalog catalog={catalog2} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svc]} />);
    expect(catalog2.updateEntry).toHaveBeenCalledWith('entry1', expect.objectContaining({ savedAuth: expect.any(Object) }));
  });

  it('forwards convert action from overview when callback is provided', async () => {
    const onConvertToOpenApi = vi.fn();
    render(
      <ApiCatalog
        catalog={makeCatalog(makeEntry())}
        onImport={vi.fn()}
        onConvertToOpenApi={onConvertToOpenApi}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'convert-openapi' }));
    expect(onConvertToOpenApi).toHaveBeenCalledWith('entry1');
  });

  it('loads and opens YAML modal from overview then closes it', async () => {
    render(<ApiCatalog catalog={makeCatalog(makeEntry())} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'view-yaml' }));
    await waitFor(() => expect(loadCatalogRawSpec).toHaveBeenCalledWith('entry1', 'v1'));
    expect(await screen.findByTestId('yaml-modal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'close-yaml' }));
    expect(screen.queryByTestId('yaml-modal')).not.toBeInTheDocument();
  });

  it('downgrades published workflow exposure directly when no workflows are affected', async () => {
    const entry = makeEntry({
      endpoints: [{ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [], workflowExposure: 'published', exposedToWorkflow: true }],
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([]);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'toggle-hide-published' }));
    await waitFor(() => expect(scanWorkflowsForCatalogRef).toHaveBeenCalledWith('entry1', 'ep1'));
    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
    expect(screen.queryByTestId('unpublish-dialog')).not.toBeInTheDocument();
  });

  it('shows unpublish dialog when downgrading published exposure with affected workflows', async () => {
    const entry = makeEntry({
      endpoints: [{ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [], workflowExposure: 'published', exposedToWorkflow: true }],
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([{ workflowId: 'wf1', workflowName: 'W1', nodeCount: 1 }]);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'toggle-hide-published' }));
    expect(await screen.findByTestId('unpublish-dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'palette-only' }));
    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
  });

  it('removes nodes from workflows when confirmed in unpublish dialog', async () => {
    const entry = makeEntry({
      endpoints: [{ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [], workflowExposure: 'published', exposedToWorkflow: true }],
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([{ workflowId: 'wf1', workflowName: 'W1', nodeCount: 1 }]);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'toggle-hide-published' }));
    expect(await screen.findByTestId('unpublish-dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'palette-and-workflows' }));
    await waitFor(() => expect(removeCatalogNodesFromWorkflows).toHaveBeenCalledWith('entry1', 'ep1'));
    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
  });

  it('cancels unpublish flow without applying exposure changes', async () => {
    const entry = makeEntry({
      endpoints: [{ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [], workflowExposure: 'published', exposedToWorkflow: true }],
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([{ workflowId: 'wf1', workflowName: 'W1', nodeCount: 1 }]);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'toggle-hide-published' }));
    expect(await screen.findByTestId('unpublish-dialog')).toBeInTheDocument();
    vi.mocked(catalog.updateEntry).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'cancel-unpublish' }));
    expect(catalog.updateEntry).not.toHaveBeenCalled();
  });

  it('opens publish modal when promoting from preview and applies publication on confirm', async () => {
    const onPreviewsChanged = vi.fn();
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        summary: 'Endpoint 1',
        parameters: [],
        responses: [],
        tags: [],
      }],
    });
    const catalog = makeCatalog(entry);

    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} onPreviewsChanged={onPreviewsChanged} />);

    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-promote-preview' }));

    expect(await screen.findByTestId('publish-modal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'confirm-publish' }));

    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
  });

  it('confirms publish without values and supports cancel path', async () => {
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        summary: 'Endpoint 1',
        parameters: [],
        responses: [],
        tags: [],
      }],
    });
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} onPreviewsChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-promote-preview' }));
    expect(await screen.findByTestId('publish-modal')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'confirm-publish-no-values' }));
    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: 'panel-promote-preview' }));
    expect(await screen.findByTestId('publish-modal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'cancel-publish' }));
    expect(screen.queryByTestId('publish-modal')).not.toBeInTheDocument();
  });

  it('handles published panel unpublish, republish, bulk, remove and view-in-catalog actions', async () => {
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        summary: 'Endpoint 1',
        parameters: [],
        responses: [],
        tags: [],
        workflowPublication: {
          publishedAt: Date.now(),
          publishedFromVersionId: 'v1',
        },
      }],
      versions: [
        { id: 'v1', version: '1.0.0', importedAt: 1700000000000, specHash: 'h1', specSize: 1000 },
        { id: 'v2', version: '2.0.0', importedAt: 1700000001000, specHash: 'h2', specSize: 2000 },
      ],
      currentVersionId: 'v2',
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([]);

    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} onPreviewsChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));
    expect(screen.getByTestId('published-panel')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'panel-unpublish' }));
    await waitFor(() => expect(scanWorkflowsForCatalogRef).toHaveBeenCalledWith('entry1', 'ep1'));

    await userEvent.click(screen.getByRole('button', { name: 'panel-republish' }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-bulk-republish' }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-bulk-unpublish' }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-remove-preview' }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-view-in-catalog' }));

    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
    expect(catalog.selectEntry).toHaveBeenCalledWith('entry1');
    expect(catalog.selectEndpoint).toHaveBeenCalledWith('ep1');
  });

  it('shows preview promote alert for already previewed endpoint and handles alert actions', async () => {
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        summary: 'Endpoint 1',
        parameters: [],
        responses: [],
        tags: [],
      }],
    });
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'toggle-expose' }));
    await userEvent.click(screen.getByRole('button', { name: 'toggle-publish' }));

    expect(await screen.findByTestId('preview-promote-alert')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('preview-promote-go-btn'));

    await userEvent.click(screen.getByRole('button', { name: 'Endpoints' }));
    await userEvent.click(screen.getByRole('button', { name: 'toggle-publish' }));

    expect(await screen.findByTestId('preview-promote-alert')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('preview-promote-dismiss-btn'));
    expect(screen.queryByTestId('preview-promote-alert')).not.toBeInTheDocument();
  });

  it('shows unpublish dialog from panel when workflows are affected and confirms palette/workflow removal', async () => {
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        summary: 'Endpoint 1',
        parameters: [],
        responses: [],
        tags: [],
        workflowPublication: {
          publishedAt: Date.now(),
          publishedFromVersionId: 'v1',
        },
      }],
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([{ workflowId: 'wf1', workflowName: 'W1', nodeCount: 1 }]);

    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} onPreviewsChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-unpublish' }));
    expect(await screen.findByTestId('unpublish-dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'palette-and-workflows' }));
    await waitFor(() => expect(removeCatalogNodesFromWorkflows).toHaveBeenCalledWith('entry1', 'ep1'));
  });

  it('keeps preview mode when downgrading published endpoint via unpublish dialog palette-only', async () => {
    const entry = makeEntry({
      endpoints: [{ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [], workflowExposure: 'published', exposedToWorkflow: true }],
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([{ workflowId: 'wf1', workflowName: 'W1', nodeCount: 1 }]);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);

    const onSetWorkflowExposure = latestBrowserProps?.onSetWorkflowExposure as
      | ((ep: CatalogEndpoint, mode: 'preview' | 'published' | undefined, vals: { params: Record<string, string>; headers: Record<string, string>; body: string }) => void)
      | undefined;

    onSetWorkflowExposure?.(
      { id: 'ep1', summary: 'Endpoint 1', path: '/ep1', method: 'POST', workflowExposure: 'published', exposedToWorkflow: true, parameters: [], responses: [], tags: [] },
      'preview',
      { params: { a: '1' }, headers: { h: '2' }, body: '{}' },
    );

    expect(await screen.findByTestId('unpublish-dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'palette-only' }));
    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
  });

  it('handles panel callbacks when one grouped entry is missing', async () => {
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        summary: 'Endpoint 1',
        parameters: [],
        responses: [],
        tags: [],
        workflowPublication: {
          publishedAt: Date.now(),
          publishedFromVersionId: 'v1',
        },
      }],
      versions: [
        { id: 'v1', version: '1.0.0', importedAt: 1700000000000, specHash: 'h1', specSize: 1000 },
        { id: 'v2', version: '2.0.0', importedAt: 1700000001000, specHash: 'h2', specSize: 2000 },
      ],
      currentVersionId: 'v2',
    });
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));

    const onBulkUnpublish = latestPublishedPanelProps?.onBulkUnpublish as
      | ((ids: Array<{ entryId: string; endpointId: string }>) => void)
      | undefined;
    const onBulkRepublish = latestPublishedPanelProps?.onBulkRepublish as
      | ((ids: Array<{ entryId: string; endpointId: string }>) => void)
      | undefined;

    onBulkUnpublish?.([
      { entryId: 'missing-entry', endpointId: 'ep1' },
      { entryId: 'entry1', endpointId: 'ep1' },
    ]);
    onBulkRepublish?.([
      { entryId: 'missing-entry', endpointId: 'ep1' },
      { entryId: 'entry1', endpointId: 'ep1' },
    ]);

    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
  });

  it('no-ops published callbacks when entry or endpoint is missing', async () => {
    const entry = makeEntry({
      endpoints: [],
      folders: [],
    });
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-unpublish' }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-republish' }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-promote-preview' }));

    expect(catalog.updateEntry).not.toHaveBeenCalled();
  });

  it('guards browser callbacks when selected entry is missing', async () => {
    const catalog = makeCatalog(makeEntry());
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} onExportSingleEndpoint={vi.fn()} onSendEndpointToHarness={vi.fn()} />);

    const noSelectionCatalog = {
      ...catalog,
      selectedEntry: null,
      selectedEntryId: undefined,
      entries: [],
    } as unknown as UseCatalogReturn;

    const onSetWorkflowExposure = latestBrowserProps?.onSetWorkflowExposure as
      | ((ep: CatalogEndpoint, mode: 'preview' | 'published' | undefined, vals: { params: Record<string, string>; headers: Record<string, string>; body: string }) => void)
      | undefined;
    const onExportSingle = latestBrowserProps?.onExportSingle as
      | ((ep: CatalogEndpoint, vals?: { params: Record<string, string>; headers: Record<string, string>; body: string }) => void)
      | undefined;
    const onSendToHarness = latestBrowserProps?.onSendToHarness as
      | ((ep: CatalogEndpoint, fromTryItOut?: boolean) => void)
      | undefined;

    const originalSelectedEntry = (catalog as unknown as { selectedEntry: CatalogEntry | null }).selectedEntry;
    (catalog as unknown as { selectedEntry: CatalogEntry | null }).selectedEntry = noSelectionCatalog.selectedEntry;

    onSetWorkflowExposure?.({ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [] }, 'preview', { params: {}, headers: {}, body: '' });
    onExportSingle?.({ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [] });
    onSendToHarness?.({ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [] }, true);

    (catalog as unknown as { selectedEntry: CatalogEntry | null }).selectedEntry = originalSelectedEntry;

    expect(catalog.updateEntry).not.toHaveBeenCalled();
  });

  it('skips view yaml load when selected entry has no current version', async () => {
    const entry = makeEntry({ currentVersionId: '' });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'view-yaml' }));

    expect(loadCatalogRawSpec).not.toHaveBeenCalled();
  });

  it('uses YAML fallback text when raw spec is empty', async () => {
    loadCatalogRawSpec.mockResolvedValue('');
    render(<ApiCatalog catalog={makeCatalog(makeEntry())} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'view-yaml' }));

    expect(await screen.findByText('# No raw spec available for this entry.')).toBeInTheDocument();
  });

  it('guards auth and host callbacks when selected entry is missing', () => {
    const catalog = makeCatalog(makeEntry());
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);

    const onAuthChange = latestBrowserProps?.onAuthChange as ((a: unknown) => void) | undefined;
    const onHostChange = latestBrowserProps?.onHostChange as ((p: unknown) => void) | undefined;

    const originalSelectedEntry = (catalog as unknown as { selectedEntry: CatalogEntry | null }).selectedEntry;
    (catalog as unknown as { selectedEntry: CatalogEntry | null }).selectedEntry = null;

    onAuthChange?.({ type: 'bearer', token: 'x' });
    onHostChange?.({ strategy: 'hardcoded', hardcodedUrl: 'https://x.test' });

    (catalog as unknown as { selectedEntry: CatalogEntry | null }).selectedEntry = originalSelectedEntry;

    expect(catalog.updateEntry).not.toHaveBeenCalled();
  });

  it('covers bulk panel grouping branches for duplicate, missing and unmatched endpoints', async () => {
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        summary: 'Endpoint 1',
        parameters: [],
        responses: [],
        tags: [],
        workflowPublication: {
          publishedAt: Date.now(),
          publishedFromVersionId: 'v1',
        },
      }],
      versions: [
        { id: 'v1', version: '1.0.0', importedAt: 1700000000000, specHash: 'h1', specSize: 1000 },
        { id: 'v2', version: '2.0.0', importedAt: 1700000001000, specHash: 'h2', specSize: 2000 },
      ],
      currentVersionId: 'v2',
    });
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));

    const onBulkUnpublish = latestPublishedPanelProps?.onBulkUnpublish as
      | ((ids: Array<{ entryId: string; endpointId: string }>) => void)
      | undefined;
    const onBulkRepublish = latestPublishedPanelProps?.onBulkRepublish as
      | ((ids: Array<{ entryId: string; endpointId: string }>) => void)
      | undefined;
    const onRepublish = latestPublishedPanelProps?.onRepublish as
      | ((entryId: string, endpointId: string) => void)
      | undefined;

    onBulkUnpublish?.([
      { entryId: 'entry1', endpointId: 'ep1' },
      { entryId: 'entry1', endpointId: 'missing-ep' },
      { entryId: 'missing-entry', endpointId: 'ep1' },
    ]);
    onBulkRepublish?.([
      { entryId: 'entry1', endpointId: 'ep1' },
      { entryId: 'entry1', endpointId: 'missing-ep' },
      { entryId: 'missing-entry', endpointId: 'ep1' },
    ]);
    onRepublish?.('missing-entry', 'ep1');

    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
  });

  it('covers promote-preview fallback fields when summary/version are missing', async () => {
    const entry = makeEntry({
      endpoints: [{
        id: 'ep1',
        method: 'POST',
        path: '/ep1',
        parameters: [],
        responses: [],
        tags: [],
      }],
      currentVersionId: 'missing-version',
      versions: [{ id: 'v1', version: '1.0.0', importedAt: 1700000000000, specHash: 'h1', specSize: 1000 }],
    });
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-promote-preview' }));

    expect(await screen.findByTestId('publish-modal')).toBeInTheDocument();
    expect(latestPublishRequest).toBeTruthy();
    expect(latestPublishRequest?.summary).toBe('/ep1');
    expect(latestPublishRequest?.versionLabel).toBe('missing-version');
  });

  it('covers nested folder endpoint lookup and false arms in bulk handlers', async () => {
    const entry = makeEntry({
      endpoints: [
        {
          id: 'ep2',
          method: 'GET',
          path: '/ep2',
          summary: 'Endpoint 2',
          parameters: [],
          responses: [],
          tags: [],
        },
      ],
      folders: [
        {
          id: 'f1',
          name: 'root',
          endpoints: [],
          folders: [
            {
              id: 'f2',
              name: 'nested',
              endpoints: [
                {
                  id: 'ep1',
                  method: 'POST',
                  path: '/ep1',
                  summary: 'Endpoint 1',
                  parameters: [],
                  responses: [],
                  tags: [],
                  workflowPublication: { publishedAt: Date.now(), publishedFromVersionId: 'v1' },
                },
              ],
              folders: [],
            },
          ],
        },
      ],
      versions: [
        { id: 'v1', version: '1.0.0', importedAt: 1700000000000, specHash: 'h1', specSize: 1000 },
        { id: 'v2', version: '2.0.0', importedAt: 1700000001000, specHash: 'h2', specSize: 2000 },
      ],
      currentVersionId: 'v2',
    });
    const catalog = makeCatalog(entry);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));

    const onUnpublish = latestPublishedPanelProps?.onUnpublish as
      | ((entryId: string, endpointId: string) => void)
      | undefined;
    const onBulkUnpublish = latestPublishedPanelProps?.onBulkUnpublish as
      | ((ids: Array<{ entryId: string; endpointId: string }>) => void)
      | undefined;
    const onBulkRepublish = latestPublishedPanelProps?.onBulkRepublish as
      | ((ids: Array<{ entryId: string; endpointId: string }>) => void)
      | undefined;

    onUnpublish?.('entry1', 'ep1');
    onBulkUnpublish?.([{ entryId: 'entry1', endpointId: 'ep1' }]);
    onBulkRepublish?.([{ entryId: 'entry1', endpointId: 'ep1' }]);

    await waitFor(() => expect(catalog.updateEntry).toHaveBeenCalled());
  });

  it('covers microservice auth branch combinations and loadWorkflowPreviews unmount guard', async () => {
    let resolvePreviews: ((v: Record<string, unknown>) => void) | null = null;
    loadWorkflowPreviews.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreviews = resolve;
        }),
    );

    const profiles: GlobalAuthProfile[] = [{ id: 'p1', name: 'A', auth: { type: 'bearer', token: 'a' } }];
    const svcNoAuthIds: Microservice = { id: 'svc1', name: 'Svc', baseUrls: { e1: 'https://a.com' } };
    const svcMissingProfile: Microservice = { id: 'svc1', name: 'Svc', baseUrls: { e1: 'https://a.com' }, authProfileIds: { e1: 'missing' } };
    const svcWithProfile: Microservice = { id: 'svc1', name: 'Svc', baseUrls: { e1: 'https://a.com' }, authProfileIds: { e1: 'p1' } };

    const entry = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e1' }),
      securitySchemes: {},
      savedAuth: undefined,
    });
    const catalog = makeCatalog(entry);
    const { rerender, unmount } = render(
      <ApiCatalog catalog={catalog} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svcNoAuthIds]} />,
    );

    rerender(<ApiCatalog catalog={catalog} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svcMissingProfile]} />);
    rerender(<ApiCatalog catalog={catalog} onImport={vi.fn()} globalAuthProfiles={profiles} appMicroservices={[svcWithProfile]} />);

    unmount();
    resolvePreviews?.({});
  });

  it('covers unpublish request fallback labels and no-op dialog callbacks after clear', async () => {
    const entry = makeEntry({
      endpoints: [{ id: 'ep1', method: 'POST', path: '/ep1', parameters: [], responses: [], tags: [], workflowExposure: 'published', exposedToWorkflow: true }],
    });
    const catalog = makeCatalog(entry);
    scanWorkflowsForCatalogRef.mockResolvedValue([{ workflowId: 'wf1', workflowName: 'W1', nodeCount: 1 }]);
    render(<ApiCatalog catalog={catalog} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'toggle-hide-published' }));
    expect(await screen.findByTestId('unpublish-dialog')).toBeInTheDocument();

    const onCancel = latestUnpublishDialogProps?.onCancel as (() => void) | undefined;
    const onPaletteOnly = latestUnpublishDialogProps?.onPaletteOnly as (() => void) | undefined;
    const onPaletteAndWorkflows = latestUnpublishDialogProps?.onPaletteAndWorkflows as (() => Promise<void> | void) | undefined;
    onCancel?.();
    onPaletteOnly?.();
    await onPaletteAndWorkflows?.();
  });

  it('covers preview values branch and alert escape handler', async () => {
    previewStore['entry1::ep1'] = {
      entryId: 'entry1',
      endpointId: 'ep1',
      method: 'POST',
      path: '/ep1',
      summary: 'Endpoint 1',
      entryName: 'My API',
      addedAt: Date.now(),
      values: { paramValues: { a: '1' }, headerValues: { h: '2' }, body: undefined },
    };
    loadWorkflowPreviews.mockResolvedValue({ ...previewStore });

    const entry = makeEntry({
      endpoints: [{ id: 'ep1', method: 'POST', path: '/ep1', summary: 'Endpoint 1', parameters: [], responses: [], tags: [] }],
    });
    render(<ApiCatalog catalog={makeCatalog(entry)} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /^Workflow Exposure/ }));
    await userEvent.click(screen.getByRole('button', { name: 'panel-promote-preview' }));
    expect(await screen.findByTestId('publish-modal')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Endpoints' }));
    await userEvent.click(screen.getByRole('button', { name: 'toggle-publish' }));
    const alert = await screen.findByTestId('preview-promote-alert');
    await userEvent.type(alert, '{Escape}');
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApiCatalog from './ApiCatalog';
import type { UseCatalogReturn } from './hooks/useCatalog';
import { makeEntry, makeScheme, makeHostConfig } from './components/catalogTestFactories';
import type { GlobalAuthProfile, Microservice } from '../../shared/types';
import type { CatalogEndpoint, CatalogEntry } from './types/catalog';

const buildCoverageMap = vi.fn();
vi.mock('./utils/coverageChecker', () => ({
  buildCoverageMap: (...args: unknown[]) => buildCoverageMap(...args),
}));

vi.mock('./components/CatalogWelcome', () => ({
  default: ({ onImport }: { onImport: () => void }) => (
    <div data-testid="welcome">
      <button onClick={onImport}>import</button>
    </div>
  ),
}));

vi.mock('./components/CatalogOverview', () => ({
  default: ({ onReimport, onVersionHistory, onExportSpec }: { onReimport: () => void; onVersionHistory: () => void; onExportSpec: () => void }) => (
    <div data-testid="overview">
      <button onClick={onReimport}>reimport</button>
      <button onClick={onVersionHistory}>history</button>
      <button onClick={onExportSpec}>export-spec</button>
    </div>
  ),
}));

const fakeEndpoint = { id: 'ep1' } as unknown as CatalogEndpoint;

vi.mock('./components/CatalogEndpointBrowser', () => ({
  default: ({ onAuthChange, onHostChange, onEditEntry, onExportSingle, onSendToHarness, onToggleWorkflowExpose }: {
    onAuthChange: (a: unknown) => void;
    onHostChange: (p: unknown) => void;
    onEditEntry?: () => void;
    onExportSingle?: (ep: unknown, vals?: unknown) => void;
    onSendToHarness?: (ep: unknown, t?: boolean) => void;
    onToggleWorkflowExpose?: (ep: unknown, exposed: boolean, vals: unknown) => void;
  }) => (
    <div data-testid="browser">
      <button onClick={() => onAuthChange({ type: 'bearer', token: 't' })}>auth-change</button>
      <button onClick={() => onHostChange({ strategy: 'hardcoded', hardcodedUrl: 'x' })}>host-change</button>
      <button onClick={() => onEditEntry?.()}>edit-entry</button>
      <button onClick={() => onExportSingle?.({ id: 'ep1' }, { params: {}, headers: {}, body: '' })}>export-single</button>
      <button onClick={() => onSendToHarness?.({ id: 'ep1' }, true)}>send-harness</button>
      <button onClick={() => onToggleWorkflowExpose?.({ id: 'ep1' }, true, { params: { a: '1' }, headers: { h: '2' }, body: '{}' })}>toggle-expose</button>
      <button onClick={() => onToggleWorkflowExpose?.({ id: 'ep1' }, false, { params: {}, headers: {}, body: '' })}>toggle-hide</button>
    </div>
  ),
}));

vi.mock('./components/CatalogSendToRequestsModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="send-modal">
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
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
  buildCoverageMap.mockReturnValue(new Map());
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
});

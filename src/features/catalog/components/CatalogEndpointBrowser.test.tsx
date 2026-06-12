/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogEndpointBrowser from './CatalogEndpointBrowser';
import { makeEntry, makeEndpoint, makeFolder, makeServer, makeHostConfig, makeVersion } from './catalogTestFactories';
import type { AuthConfig, Microservice } from '../../../shared/types';

vi.mock('./CatalogEndpointCard', () => ({
  default: ({ endpoint, onValuesChange }: { endpoint: { id: string; path: string }; onValuesChange?: (v: unknown) => void }) => (
    <div data-testid="endpoint-card">
      <span>{endpoint.path}</span>
      <button onClick={() => onValuesChange?.({ pathParams: {} })}>vals-{endpoint.id}</button>
    </div>
  ),
}));

vi.mock('./CatalogAuthPanel', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="auth-panel">
      <button onClick={onClose}>close-auth</button>
    </div>
  ),
}));

const resolveBaseUrl = vi.fn();
vi.mock('../utils/catalogCurlGenerator', () => ({
  resolveBaseUrl: (...args: unknown[]) => resolveBaseUrl(...args),
}));

const loadCatalogEndpointValues = vi.fn();
const saveCatalogEndpointValues = vi.fn();
vi.mock('../../../shared/utils/storage', () => ({
  loadCatalogEndpointValues: (id: string) => loadCatalogEndpointValues(id),
  saveCatalogEndpointValues: (...args: unknown[]) => saveCatalogEndpointValues(...args),
}));

vi.mock('../utils/coverageChecker', () => ({
  getEndpointCoverage: vi.fn().mockReturnValue({ tested: true }),
}));

const baseEntry = makeEntry({
  servers: [makeServer({ url: 'https://api.example.com', description: 'Prod' })],
  versions: [makeVersion({ id: 'v1', version: '1.0.0' })],
  folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users' })] })],
  endpoints: [makeEndpoint({ id: 'ep2', path: '/root-thing', summary: 'Root', tags: [] })],
});

const noAuth: AuthConfig = { type: 'none' };

function renderBrowser(over: {
  entry?: typeof baseEntry;
  auth?: AuthConfig;
} = {}) {
  const onAuthChange = vi.fn();
  const onHostChange = vi.fn();
  const onEditEntry = vi.fn();
  render(
    <CatalogEndpointBrowser
      entry={over.entry ?? baseEntry}
      auth={over.auth ?? noAuth}
      onAuthChange={onAuthChange}
      onHostChange={onHostChange}
      onEditEntry={onEditEntry}
    />,
  );
  return { onAuthChange, onHostChange, onEditEntry };
}

beforeEach(() => {
  resolveBaseUrl.mockReturnValue('https://api.example.com');
  loadCatalogEndpointValues.mockResolvedValue({});
  saveCatalogEndpointValues.mockReset();
});

describe('CatalogEndpointBrowser', () => {
  it('renders the header, version, base URL and endpoint cards', async () => {
    renderBrowser();
    expect(screen.getByText('My API')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
    await waitFor(() => expect(loadCatalogEndpointValues).toHaveBeenCalledWith('entry1'));
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('/root-thing')).toBeInTheDocument();
  });

  it('toggles the auth panel open and closed', async () => {
    renderBrowser();
    await userEvent.click(screen.getByRole('button', { name: /Authorize/ }));
    expect(screen.getByTestId('auth-panel')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'close-auth' }));
    expect(screen.queryByTestId('auth-panel')).not.toBeInTheDocument();
  });

  it('switches host strategy to From Spec and shows the server select', async () => {
    const { onHostChange } = renderBrowser();
    await userEvent.click(screen.getByRole('button', { name: 'From Spec' }));
    expect(onHostChange).toHaveBeenCalledWith(expect.objectContaining({ strategy: 'inherited' }));
  });

  it('renders the server select and changes server index when inherited', async () => {
    const entry = makeEntry({
      hostConfig: makeHostConfig({ strategy: 'inherited', selectedServerIndex: 0 }),
      servers: [makeServer({ url: 'https://a.com' }), makeServer({ url: 'https://b.com', description: 'B' })],
      folders: [],
      endpoints: [],
    });
    const { onHostChange } = renderBrowser({ entry });
    const select = document.querySelector('.ceb-server-select') as HTMLSelectElement;
    await userEvent.selectOptions(select, '1');
    expect(onHostChange).toHaveBeenCalledWith(expect.objectContaining({ selectedServerIndex: 1 }));
  });

  it('switches host strategy to Custom URL and edits the hardcoded URL', async () => {
    const entry = makeEntry({
      hostConfig: makeHostConfig({ strategy: 'hardcoded', hardcodedUrl: '' }),
      folders: [],
      endpoints: [],
    });
    const { onHostChange } = renderBrowser({ entry });
    const input = screen.getByPlaceholderText('https://api.example.com/v1');
    await userEvent.type(input, 'x');
    expect(onHostChange).toHaveBeenCalledWith(expect.objectContaining({ strategy: 'hardcoded' }));
  });

  it('filters endpoints and shows the no-results message', async () => {
    renderBrowser();
    const filter = screen.getByPlaceholderText('Filter endpoints...');
    await userEvent.type(filter, 'zzznotfound');
    await waitFor(() =>
      expect(screen.getByText(/No endpoints match/)).toBeInTheDocument(),
    );
  });

  it('hides deprecated endpoints when toggled', async () => {
    const entry = makeEntry({
      folders: [],
      endpoints: [
        makeEndpoint({ id: 'live', path: '/live', deprecated: false }),
        makeEndpoint({ id: 'old', path: '/old', deprecated: true }),
      ],
    });
    renderBrowser({ entry });
    expect(screen.getByText('/old')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Hide deprecated/));
    await waitFor(() => expect(screen.queryByText('/old')).not.toBeInTheDocument());
    expect(screen.getByText('/live')).toBeInTheDocument();
  });

  it('collapses and expands a folder group', async () => {
    renderBrowser();
    await waitFor(() => expect(loadCatalogEndpointValues).toHaveBeenCalled());
    const headers = document.querySelectorAll('.ceb-tag-header');
    await userEvent.click(headers[0]);
    await waitFor(() => expect(screen.queryByText('/users')).not.toBeInTheDocument());
    await userEvent.click(headers[0]);
    expect(screen.getByText('/users')).toBeInTheDocument();
  });

  it('collapses and expands the untagged Other group', async () => {
    renderBrowser();
    await waitFor(() => expect(loadCatalogEndpointValues).toHaveBeenCalled());
    const otherHeader = [...document.querySelectorAll('.ceb-tag-header')].find(h =>
      h.textContent?.includes('Other'),
    )!;
    await userEvent.click(otherHeader);
    await waitFor(() => expect(screen.queryByText('/root-thing')).not.toBeInTheDocument());
  });

  it('saves endpoint values with a debounce on change', async () => {
    vi.useFakeTimers();
    try {
      renderBrowser();
      await vi.waitFor(() => expect(loadCatalogEndpointValues).toHaveBeenCalled());
      const valsBtn = [...document.querySelectorAll('button')].find(b =>
        b.textContent?.startsWith('vals-'),
      )!;
      fireEvent.click(valsBtn);
      fireEvent.click(valsBtn);
      vi.advanceTimersByTime(700);
      expect(saveCatalogEndpointValues).toHaveBeenCalledWith('entry1', expect.any(Object));
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the Environment button and microservice env options when linked', async () => {
    const svc: Microservice = {
      id: 'svc1',
      name: 'My Service',
      baseUrls: { e1: 'https://svc.example.com' },
      customEnvs: [{ id: 'e1', name: 'Env One' }],
    };
    const entry = makeEntry({
      microserviceId: 'svc1',
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'e1' }),
      folders: [],
      endpoints: [],
    });
    const onHostChange = vi.fn();
    render(
      <CatalogEndpointBrowser
        entry={entry}
        auth={noAuth}
        onAuthChange={vi.fn()}
        onHostChange={onHostChange}
        appMicroservices={[svc]}
        appEnvironments={[]}
      />,
    );
    expect(screen.getByText('Env One — https://svc.example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'From Spec' }));
    await userEvent.click(screen.getByRole('button', { name: 'Environment' }));
    expect(onHostChange).toHaveBeenCalledWith(expect.objectContaining({ strategy: 'environment' }));
  });

  it('calls onEditEntry when Environment is clicked with no env options', async () => {
    const svc: Microservice = { id: 'svc1', name: 'Svc', baseUrls: {} };
    const entry = makeEntry({ folders: [], endpoints: [] });
    const onEditEntry = vi.fn();
    render(
      <CatalogEndpointBrowser
        entry={entry}
        auth={noAuth}
        onAuthChange={vi.fn()}
        onHostChange={vi.fn()}
        appMicroservices={[svc]}
        onEditEntry={onEditEntry}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Environment' }));
    expect(onEditEntry).toHaveBeenCalled();
  });

  it('renders the legacy entry.environments select', async () => {
    const entry = makeEntry({
      environments: [{ id: 'env1', name: 'Staging', baseUrl: 'https://staging.example.com' }],
      hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'env1' }),
      folders: [],
      endpoints: [],
    });
    const onHostChange = vi.fn();
    render(
      <CatalogEndpointBrowser
        entry={entry}
        auth={noAuth}
        onAuthChange={vi.fn()}
        onHostChange={onHostChange}
      />,
    );
    expect(screen.getByText('Staging — https://staging.example.com')).toBeInTheDocument();
    const select = document.querySelector('.ceb-server-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'env1' } });
    expect(onHostChange).toHaveBeenCalledWith(expect.objectContaining({ strategy: 'environment', environmentId: 'env1' }));
  });

  it('resets endpoint values when the entry id changes', async () => {
    const { rerender } = render(
      <CatalogEndpointBrowser entry={baseEntry} auth={noAuth} onAuthChange={vi.fn()} onHostChange={vi.fn()} />,
    );
    await waitFor(() => expect(loadCatalogEndpointValues).toHaveBeenCalledWith('entry1'));
    const entry2 = makeEntry({ id: 'entry2', name: 'Other API', folders: [], endpoints: [] });
    rerender(
      <CatalogEndpointBrowser entry={entry2} auth={noAuth} onAuthChange={vi.fn()} onHostChange={vi.fn()} />,
    );
    await waitFor(() => expect(loadCatalogEndpointValues).toHaveBeenCalledWith('entry2'));
    expect(screen.getByText('Other API')).toBeInTheDocument();
  });
});

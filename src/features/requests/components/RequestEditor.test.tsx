/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { installClipboardMock } from '../../../test-utils/clipboardMock';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestEditor from './RequestEditor';
import { ConsoleLine } from '../hooks/useResponseCache';
import { RequestCollection, RequestItem, RequestEnv } from '../../../shared/types';
import { httpFetch } from '../../../shared/utils/httpClient';
import { serializeWithContentType } from '../../../shared/utils/bodySerializer';
import { parseCurl } from '../../../shared/utils/curlParser';
import { buildCurlCommand } from '../../../shared/utils/curlGenerator';
import { pickJsonFile, unwrapImport } from '../../scenarios/utils/testEditorUtils';
import { saveFile } from '../../../shared/utils/fileSaver';
import { HttpResponse } from '../../../shared/utils/httpClient';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

const responseCacheHarness = vi.hoisted(() => {
  type SendAllRow = { envName: string; response: HttpResponse; time: number };
  type HistPayload = Omit<import('../hooks/useResponseCache').ResponseHistoryEntry, 'id'>;

  const subscribers = new Set<() => void>();
  const notify = () => subscribers.forEach((cb) => cb());

  let histSeq = 0;

  const layer = {
    response: null as HttpResponse | null,
    responseTime: 0,
    sendAllResults: null as null | SendAllRow[],
    consoleLines: [] as ConsoleLine[],
    history: [] as Array<HistPayload & { id: string }>,
    pushHistory(entry: HistPayload) {
      const id = `h-${++histSeq}`;
      const full = { ...entry, id };
      layer.history = [full, ...layer.history];
      notify();
      return id;
    },
    setResponse(next: HttpResponse | null) {
      layer.response = next;
      notify();
    },
    setResponseTime(next: number) {
      layer.responseTime = next;
      notify();
    },
    setSendAllResults(next: null | SendAllRow[]) {
      layer.sendAllResults = next;
      notify();
    },
    setConsoleLines(next: ConsoleLine[]) {
      layer.consoleLines = next;
      notify();
    },
    restoreFromHistory: vi.fn(function restoreFromHistory(this: void, id: string) {
      const hit = layer.history.find(h => h.id === id);
      if (!hit) return;
      layer.response = hit.response;
      layer.responseTime = hit.responseTime;
      layer.consoleLines = hit.consoleLines;
      notify();
    }),
    deleteHistoryEntry: vi.fn((id: string) => {
      layer.history = layer.history.filter(h => h.id !== id);
      notify();
    }),
    clearHistory: vi.fn(() => {
      layer.history = [];
      layer.response = null;
      notify();
    }),
    reset() {
      histSeq = 0;
      layer.response = null;
      layer.responseTime = 0;
      layer.sendAllResults = null;
      layer.consoleLines = [];
      layer.history = [];
      vi.mocked(layer.deleteHistoryEntry).mockClear();
      vi.mocked(layer.clearHistory).mockClear();
      vi.mocked(layer.restoreFromHistory).mockClear();
      notify();
    },
    subscribe(fn: () => void) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
  return layer;
});

const responseCacheLayer = responseCacheHarness;

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn(),
}));

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../shared/utils/bodySerializer', () => ({
  serializeWithContentType: vi.fn(() => ({ body: '', contentType: null })),
}));

vi.mock('../../../shared/utils/curlParser', () => ({
  parseCurl: vi.fn(),
}));

vi.mock('../../../shared/utils/curlGenerator', () => ({
  buildCurlCommand: vi.fn(),
}));

vi.mock('../../../shared/utils/applyAuthHeaders', () => ({
  applyAuthHeaders: vi.fn(),
}));

vi.mock('../../scenarios/utils/testEditorUtils', () => ({
  pickJsonFile: vi.fn(),
  unwrapImport: vi.fn(),
}));

vi.mock('../hooks/useResponseCache', async () => {
  const React = await import('react');

  function useBridgedLayer() {
    const [, bump] = React.useState(0);
    React.useEffect(
      () =>
        responseCacheHarness.subscribe(() => {
          bump((v) => v + 1);
        }),
      [],
    );
    return responseCacheHarness;
  }

  return {
    useResponseCache: (_id?: string) => useBridgedLayer(),
  };
});

const toastLayer = vi.hoisted(() => ({
  show: vi.fn(),
}));

vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => toastLayer,
}));

function makeCollection(overrides?: Partial<RequestCollection>): RequestCollection {
  return {
    id: 'col-1',
    name: 'Test Collection',
    mode: 'direct',
    requests: [],
    auth: { type: 'none' },
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<RequestItem>): RequestItem {
  return {
    id: 'req-1',
    name: 'Test Request',
    method: 'GET',
    url: '/api/users',
    headers: [{ key: '', value: '' }],
    body: '',
    auth: { type: 'none' },
    ...overrides,
  };
}

function makeEnvs(): RequestEnv[] {
  return [
    { id: 'env-1', name: 'Development' },
    { id: 'env-2', name: 'Production' },
  ];
}

const defaultProps = {
  collection: makeCollection(),
  request: makeRequest(),
  environments: makeEnvs(),
  onEnvChange: vi.fn(),
  onUpdateRequest: vi.fn(),
  appGlobalAuthProfiles: [],
};

describe('RequestEditor - API Info', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides API Info button when request has no catalogMeta', () => {
    render(<RequestEditor {...defaultProps} request={makeRequest()} />);
    
    expect(screen.queryByText('ⓘ API Info')).toBeNull();
  });

  it('shows API Info button when request has catalogMeta', () => {
    const requestWithCatalogMeta = makeRequest({
      catalogMeta: {
        operationId: 'getUsers',
        description: 'Get all users',
        originalPath: '/api/users',
        tags: ['Users'],
        parameters: [],
        expectedResponses: [],
      },
    });

    render(<RequestEditor {...defaultProps} request={requestWithCatalogMeta} />);
    
    expect(screen.getByTitle('Show API Info')).toBeInTheDocument();
  });

  it('opens API Reference panel when API Info button is clicked', () => {
    const requestWithCatalogMeta = makeRequest({
      catalogMeta: {
        operationId: 'getUsers',
        description: 'Get all users',
        originalPath: '/api/users',
        tags: ['Users'],
        parameters: [
          { name: 'limit', in: 'query', type: 'integer', required: false, description: 'Max results' },
        ],
        expectedResponses: [
          { statusCode: '200', description: 'Success' },
        ],
      },
    });

    render(<RequestEditor {...defaultProps} request={requestWithCatalogMeta} />);
    
    fireEvent.click(screen.getByTitle('Show API Info'));
    
    expect(screen.getByText('ⓘ API Reference')).toBeInTheDocument();
    expect(screen.getByText('getUsers')).toBeInTheDocument();
  });

  it('displays correct endpoint info in API Reference panel', () => {
    const requestWithCatalogMeta = makeRequest({
      catalogMeta: {
        operationId: 'getUserById',
        description: 'Retrieve a user by their unique ID',
        originalPath: '/api/users/{id}',
        tags: ['Users', 'Admin'],
        sourceSpec: 'User Service v2.0',
        deprecated: true,
        parameters: [
          { name: 'id', in: 'path', type: 'string', required: true, description: 'User ID' },
          { name: 'include', in: 'query', type: 'string', required: false, description: 'Related data' },
        ],
        expectedResponses: [
          { statusCode: '200', description: 'User found' },
          { statusCode: '404', description: 'User not found' },
        ],
        security: ['bearerAuth'],
      },
    });

    render(<RequestEditor {...defaultProps} request={requestWithCatalogMeta} />);
    
    fireEvent.click(screen.getByTitle('Show API Info'));
    
    expect(screen.getByText('getUserById')).toBeInTheDocument();
    expect(screen.getByText('Retrieve a user by their unique ID')).toBeInTheDocument();
    expect(screen.getByText('User Service v2.0')).toBeInTheDocument();
    expect(screen.getByText('⚠ Deprecated')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('include')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('User found')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('User not found')).toBeInTheDocument();
    expect(screen.getByText(/bearerAuth/)).toBeInTheDocument();
  });

  it('closes API Reference panel when close button is clicked', () => {
    const requestWithCatalogMeta = makeRequest({
      catalogMeta: {
        operationId: 'getUsers',
        description: 'Get all users',
        originalPath: '/api/users',
        tags: [],
        parameters: [],
        expectedResponses: [],
      },
    });

    render(<RequestEditor {...defaultProps} request={requestWithCatalogMeta} />);
    
    fireEvent.click(screen.getByTitle('Show API Info'));
    expect(screen.getByText('ⓘ API Reference')).toBeInTheDocument();
    
    fireEvent.click(screen.getByTitle('Close'));
    expect(screen.queryByText('ⓘ API Reference')).toBeNull();
  });

  it('toggles API Info button active state when panel is open', () => {
    const requestWithCatalogMeta = makeRequest({
      catalogMeta: {
        operationId: 'getUsers',
        description: 'Get all users',
        originalPath: '/api/users',
        tags: [],
        parameters: [],
        expectedResponses: [],
      },
    });

    render(<RequestEditor {...defaultProps} request={requestWithCatalogMeta} />);
    
    const button = screen.getByTitle('Show API Info');
    expect(button).not.toHaveClass('active');
    
    fireEvent.click(button);
    expect(screen.getByTitle('Hide API Info')).toHaveClass('active');
  });
});

describe('RequestEditor chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches method change through onUpdateRequest', () => {
    const onUpdateRequest = vi.fn();
    render(<RequestEditor {...defaultProps} onUpdateRequest={onUpdateRequest} />);
    fireEvent.change(screen.getByDisplayValue('GET'), { target: { value: 'DELETE' } });
    expect(onUpdateRequest).toHaveBeenCalledWith({ method: 'DELETE' });
  });

  it('accepts PATCH when the outbound editor already exposes PUT styling', () => {
    const onUpdateRequest = vi.fn();
    render(<RequestEditor {...defaultProps} onUpdateRequest={onUpdateRequest} request={makeRequest({ method: 'PUT' })} />);
    fireEvent.change(screen.getByDisplayValue('PUT'), { target: { value: 'PATCH' } });
    expect(onUpdateRequest).toHaveBeenCalledWith({ method: 'PATCH' });
  });

  it('invokes onSendToHarness callback', () => {
    const onSendToHarness = vi.fn();
    render(<RequestEditor {...defaultProps} onSendToHarness={onSendToHarness} />);
    fireEvent.click(screen.getByTitle('Send to Harness as a test'));
    expect(onSendToHarness).toHaveBeenCalledTimes(1);
  });

  it('shows definition history toolbar from History tab', () => {
    const snapshot = {
      name: 'Test Request',
      url: '/api/users',
      method: 'GET' as const,
      headers: [],
      body: '',
      auth: { type: 'none' as const },
    };
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          definitionVersions: [{
            id: 'ver1',
            timestamp: 999,
            snapshot,
          }],
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^History\b/ }));
    expect(screen.getByText('Request Definition History')).toBeInTheDocument();
    expect(screen.getByText(/^1 version$/)).toBeInTheDocument();
  });

  it('shows IN HARNESS badge when requested', () => {
    render(<RequestEditor {...defaultProps} request={makeRequest()} isInHarness />);
    expect(screen.getByTitle('Promoted to Harness')).toBeInTheDocument();
  });
});

describe('RequestEditor request/response workflows', () => {
  beforeEach(() => {
    responseCacheLayer.reset();
    toastLayer.show.mockClear();
    vi.mocked(httpFetch).mockReset();
    vi.mocked(parseCurl).mockReset();
    vi.mocked(buildCurlCommand).mockReset();
    vi.mocked(pickJsonFile).mockReset();
    vi.mocked(unwrapImport).mockReset();
    vi.mocked(saveFile).mockReset();
    vi.mocked(serializeWithContentType).mockReturnValue({ body: '', contentType: null });
    installClipboardMock();
  });

  it('surfaces URL resolution errors for relative paths without a base URL', async () => {
    vi.mocked(httpFetch).mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' });
    const view = render(<RequestEditor {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => {
      const err = view.container.querySelector('.jt-error');
      expect(err?.textContent ?? '').toContain('Cannot send');
    });
    expect(vi.mocked(httpFetch)).not.toHaveBeenCalled();
  });

  it('sends absolute URLs, records responses, and navigates response tabs', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'x-trace': '1' },
      body: '{"ok":true}',
    });
    const view = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://api.example.com/v1/users' })}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => {
      const pill = view.container.querySelector('.req-status-pill');
      expect(pill?.textContent ?? '').toContain('200');
    });

    const respPane = view.container.querySelector('.req-pane-right')!;
    fireEvent.click(within(respPane).getByRole('button', { name: /^Headers\b/ }));
    expect(within(respPane).getByText('x-trace')).toBeInTheDocument();

    fireEvent.click(within(respPane).getByRole('button', { name: /^Console\b/ }));
    expect(screen.getByText(/Preparing request to/)).toBeInTheDocument();
  });

  it('logs OAuth2 acquisition details and large bodies to the console output', async () => {
    vi.mocked(serializeWithContentType).mockReturnValue({
      body: `${'Z'.repeat(501)}`,
      contentType: 'application/json',
    });
    vi.mocked(httpFetch).mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' });
    const view = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          url: 'https://secure.example.com/token',
          auth: {
            type: 'oauth2',
            tokenUrl: 'https://auth.example.com/oauth/token',
            clientId: 'cid',
            clientSecret: 'sec',
          },
        })}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => {
      const pill = view.container.querySelector('.req-status-pill');
      expect(pill?.textContent ?? '').toContain('200');
    });
    fireEvent.click(screen.getByRole('button', { name: /^Console\b/ }));
    await waitFor(() => {
      expect(screen.getByText(/Acquiring OAuth2 token/)).toBeInTheDocument();
      expect(screen.getByText(/OAuth2 token acquired successfully/)).toBeInTheDocument();
      expect(screen.getByText(/more bytes/)).toBeInTheDocument();
    });
  });

  it('imports cURL data, switches tabs when body arrives, and can export generated cURL', async () => {
    vi.mocked(parseCurl).mockReturnValue({
      id: 'sc',
      name: 'Imported',
      url: 'https://hooks.example.com/hook',
      method: 'POST',
      headers: [],
      body: '{"a":1}',
      bodyType: 'json',
      auth: { type: 'none' },
      validation: { mode: 'none', expectedFields: [] },
    } as unknown as ReturnType<typeof parseCurl>);
    vi.mocked(buildCurlCommand).mockResolvedValue('curl https://example.com');

    const onUpdateRequest = vi.fn();
    render(<RequestEditor {...defaultProps} onUpdateRequest={onUpdateRequest} />);

    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'cURL Import' }));
    fireEvent.change(screen.getByPlaceholderText(/curl -X POST/), { target: { value: 'curl https://x' } });
    fireEvent.click(screen.getByRole('button', { name: /Import & Apply/ }));
    expect(onUpdateRequest).toHaveBeenCalled();
    expect(parseCurl).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'cURL Export' }));
    await screen.findByDisplayValue('curl https://example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('rejects malformed JSON imports then applies well-formed payloads', () => {
    const onUpdateRequest = vi.fn();
    vi.mocked(pickJsonFile)
      .mockImplementationOnce((cb: (raw: string) => void) => { cb('raw-bad'); })
      .mockImplementationOnce((cb: (raw: string) => void) => { cb('raw-good'); });
    vi.mocked(unwrapImport)
      .mockReturnValueOnce({ url: 'https://missing-name', method: 'GET' } as Record<string, unknown>)
      .mockReturnValueOnce({ name: 'OK', url: 'https://good', method: 'GET' } as Record<string, unknown>);

    render(<RequestEditor {...defaultProps} onUpdateRequest={onUpdateRequest} />);
    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));
    expect(toastLayer.show).toHaveBeenCalledWith('error', 'Invalid file', expect.any(String));

    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));
    expect(onUpdateRequest).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://good' }));
  });

  it('shows cURL exporter empty-state when URL missing', async () => {
    vi.mocked(buildCurlCommand).mockResolvedValue('curl noop');
    render(<RequestEditor {...defaultProps} request={makeRequest({ url: '' })} />);

    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'cURL Export' }));

    await screen.findByText('Set a URL first.');
  });

  it('propagates network failures through the preview panel', async () => {
    vi.mocked(httpFetch).mockRejectedValue(new Error('boom'));
    const view = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://api.example.com/fail' })}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => {
      const err = view.container.querySelector('.jt-error');
      expect(err?.textContent ?? '').toContain('boom');
    });
  });

  it('writes JSON exports through saveFile helper', async () => {
    render(<RequestEditor {...defaultProps} request={makeRequest({ name: 'Alpha' })} />);
    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

    await waitFor(() => expect(saveFile).toHaveBeenCalled());
  });

  it('renders multi-env pills and supports response preview search chrome', async () => {
    const onEnvChange = vi.fn();
    const view = render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({
          mode: 'multi-env',
          baseUrls: { 'env-1': 'https://multi.example.com/', 'env-2': 'https://prod.example.org' },
        })}
        environments={makeEnvs()}
        selectedEnvId="env-1"
        onEnvChange={onEnvChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Production\b/ }));
    expect(onEnvChange).toHaveBeenCalledWith('env-2');

    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"nested":{"value":"needle"}}',
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => {
      const pill = view.container.querySelector('.req-status-pill');
      expect(pill?.textContent ?? '').toContain('200');
    });

    fireEvent.change(screen.getByPlaceholderText('Search response...'), { target: { value: 'needle' } });
    expect(screen.getByPlaceholderText('Search response...')).toHaveValue('needle');
  });

  it('shows stacked multi-environment rows when hooks surface batch results', () => {
    responseCacheLayer.sendAllResults = [
      {
        envName: 'DEV',
        response: { status: 200, statusText: 'OK', headers: {}, body: '{}' },
        time: 5,
      },
      {
        envName: 'QA',
        response: { status: 500, statusText: 'Error', headers: {}, body: 'err' },
        time: 8,
      },
    ];
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://api.example.com/go' })}
      />,
    );
    expect(screen.getByText('DEV')).toBeInTheDocument();
    expect(screen.getByText('QA')).toBeInTheDocument();
  });

  it('opens spec compare plus definition diff overlays', async () => {
    const snapshotA = {
      name: 'R',
      url: '/one',
      method: 'GET' as const,
      headers: [],
      body: '',
      auth: { type: 'none' as const },
    };
    const snapshotB = { ...snapshotA, url: '/two' };

    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          specVersions: [
            {
              id: 'sv-1',
              url: '/v1',
              method: 'GET',
              headers: [],
              body: '',
              bodyType: 'none',
              bodyForm: [],
              catalogVersion: '1',
              catalogEntryId: 'ce',
              catalogEndpointId: 'ep',
              savedQueryParams: [],
              savedPathParams: [],
              importedAt: 1,
            },
            {
              id: 'sv-2',
              url: '/v2',
              method: 'GET',
              headers: [],
              body: '',
              bodyType: 'none',
              bodyForm: [],
              catalogVersion: '2',
              catalogEntryId: 'ce',
              catalogEndpointId: 'ep',
              savedQueryParams: [],
              savedPathParams: [],
              importedAt: 2,
            },
          ],
          activeSpecVersionId: 'sv-2',
          definitionVersions: [
            { id: 'va', timestamp: 10, snapshot: snapshotA },
            { id: 'vb', timestamp: 20, snapshot: snapshotB },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByTitle('Compare versions'));
    expect(await screen.findByRole('heading', { name: 'Compare Spec Versions' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: /^History\b/ }));
    const panel = screen.getByText('Request Definition History').closest('.test-def-version-panel');
    expect(panel).toBeTruthy();
    const versionPanel = panel as HTMLElement;
    const checkboxes = within(versionPanel).getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    const historyCompare = within(versionPanel).getByRole('button', { name: 'Compare' });
    fireEvent.click(historyCompare);

    expect(await screen.findByRole('heading', { name: 'Request Definition Comparison' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('heading', { name: 'Request Definition Comparison' }).parentElement!.querySelector('button')!);

    fireEvent.click(screen.getByRole('button', { name: /^Body\b/ }));
  });
});

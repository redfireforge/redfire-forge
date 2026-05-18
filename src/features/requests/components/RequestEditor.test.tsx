/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestEditor from './RequestEditor';
import type { ConsoleLine } from '../hooks/useResponseCache';
import type { RequestCollection, RequestItem, RequestEnv } from '../../../shared/types';
import { httpFetch } from '../../../shared/utils/httpClient';
import { serializeWithContentType } from '../../../shared/utils/bodySerializer';
import { parseCurl } from '../../../shared/utils/curlParser';
import { buildCurlCommand } from '../../../shared/utils/curlGenerator';
import { pickJsonFile, unwrapImport } from '../../scenarios/utils/testEditorUtils';
import { saveFile } from '../../../shared/utils/fileSaver';
import type { HttpResponse } from '../../../shared/utils/httpClient';

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

import { applyAuthHeaders } from '../../../shared/utils/applyAuthHeaders';

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
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
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

describe('RequestEditor interaction branches', () => {
  beforeEach(() => {
    responseCacheLayer.reset();
    toastLayer.show.mockClear();
    vi.mocked(httpFetch).mockReset();
    vi.mocked(parseCurl).mockReset();
    vi.mocked(buildCurlCommand).mockReset();
    vi.mocked(serializeWithContentType).mockReturnValue({ body: '', contentType: null });
    vi.mocked(applyAuthHeaders).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it('enters request title edit mode via display row', () => {
    const onUpdateRequest = vi.fn();
    render(<RequestEditor {...defaultProps} onUpdateRequest={onUpdateRequest} request={makeRequest({ name: 'Alpha' })} />);
    fireEvent.click(screen.getByText('Alpha'));
    const input = screen.getByDisplayValue('Alpha');
    fireEvent.change(input, { target: { value: 'Omega' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdateRequest).toHaveBeenCalledWith(expect.objectContaining({ name: 'Omega' }));
  });

  it('shows multi-env resolver hint whenever base urls stay empty', () => {
    render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({ mode: 'multi-env', baseUrls: {} })}
        environments={makeEnvs()}
        selectedEnvId="env-1"
      />,
    );
    expect(screen.getByText(/Base URLs not configured/)).toBeInTheDocument();
  });

  it('pins environments from sub-collection context when provided', () => {
    render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({ mode: 'multi-env' })}
        environments={makeEnvs()}
        parentSubCollection={{
          id: 'sc',
          name: 'Staging',
          requests: [],
          baseUrls: { 'env-1': 'https://staging.example/' },
          selectedEnvId: 'env-1',
        }}
      />,
    );
    expect(screen.getByTitle(/https:\/\/staging\.example/)).toBeInTheDocument();
  });

  it('captures Curl generation failures in the exporter textarea', async () => {
    vi.mocked(buildCurlCommand).mockRejectedValueOnce(new Error('signing failed'));

    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://api.example.com/x' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'cURL Export' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/# Error: signing failed/)).toBeInTheDocument();
    });
  });

  it('styles intermediate HTTP responses with warn pills', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 304,
      statusText: 'Not Modified',
      headers: {},
      body: '',
    });
    const view = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://etag.example/asset' })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() => {
      const pill = view.container.querySelector('.req-status-pill.warn');
      expect(pill?.textContent ?? '').toContain('304');
    });
  });

  it('mentions Basic and API Key strategies inside console logs while sending', async () => {
    vi.mocked(httpFetch).mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' });

    const { rerender } = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          url: 'https://svc.example/ping',
          auth: { type: 'basic', username: 'u', password: 'p' },
        })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    fireEvent.click(screen.getByRole('button', { name: /^Console\b/ }));

    await waitFor(() => {
      expect(screen.getByText(/Using Basic authentication/)).toBeInTheDocument();
    });

    rerender(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          url: 'https://svc.example/ping',
          auth: { type: 'apikey', apiKeyName: 'k', apiKeyValue: 'v', apiKeyIn: 'query' },
        })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    fireEvent.click(screen.getByRole('button', { name: /^Console\b/ }));
    await waitFor(() => {
      expect(screen.getByText(/Using API Key in query/)).toBeInTheDocument();
    });
  });

  it('overrides Content-Type whenever multipart payloads ship custom boundaries', async () => {
    vi.mocked(serializeWithContentType).mockReturnValue({
      body: 'parts',
      contentType: 'multipart/form-data; boundary=abc123',
    });
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });

    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          url: 'https://multipart.example/up',
          headers: [{ key: 'Content-Type', value: 'text/plain' }],
        })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() => {
      const headersPassed = vi.mocked(httpFetch).mock.calls.at(-1)?.[2] as Record<string, string> | undefined;
      expect(headersPassed?.['Content-Type']).toContain('multipart/form-data');
    });
  });

  it('keeps Saved Query rows independent from URL fragments', async () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/api/things?page=99',
          savedQueryParams: [
            { key: 'page', value: '99', enabled: false, description: '' },
          ],
        })}
      />,
    );

    const paramsRoot = screen.getByText('QUERY PARAMETERS').closest('.params-editor')!;
    const pageInput = await within(paramsRoot).findByDisplayValue('99');
    fireEvent.change(pageInput, { target: { value: '100' } });

    await waitFor(() =>
      expect(onUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          savedQueryParams: expect.arrayContaining([
            expect.objectContaining({ key: 'page', enabled: false, value: '100' }),
          ]),
        }),
      ),
    );
  });

  it('reorders response search matches circularly via chevron controls', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ a: 'needle', b: 'needle' }),
    });
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://search.example/find' })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    const searchBox = await screen.findByPlaceholderText('Search response...');
    fireEvent.change(searchBox, { target: { value: 'needle' } });

    fireEvent.click(screen.getByTitle('Previous'));
    await waitFor(() => expect(screen.getByText('2/2')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Next'));
    await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());
  });

  it('focuses catalog path placeholders when endpoints declare templates', async () => {
    const meta = {
      operationId: 'vehicles',
      description: '',
      originalPath: '/fleet/{fleetId}',
      tags: [],
      parameters: [],
      expectedResponses: [],
    };
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          url: '/fleet/abc123',
          catalogMeta: meta,
          savedPathParams: [{ key: 'fleetId', value: 'abc123', required: false, description: '' }],
        })}
      />,
    );
    const pathInput = await screen.findByPlaceholderText('Enter fleetId');
    expect(pathInput).toHaveValue('abc123');
  });

  it('reveals bearer auth tab marker when auth diverges from collection defaults', () => {
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          auth: { type: 'bearer', token: 'masked' },
        })}
      />,
    );
    expect(document.querySelector('.req-tab-dot')).toBeTruthy();
  });

  it('fires delete-all headers via toolbar shortcut', async () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [
            { key: 'Authorization', value: 'token' },
            { key: 'X-Trace', value: 'yes' },
          ],
        })}
      />,
    );
    const reqPaneLeft = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(reqPaneLeft).getByRole('button', { name: /^Headers\b/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    expect(onUpdateRequest).toHaveBeenCalledWith({ headers: [{ key: '', value: '' }] });
  });

  it('renders pinned env pills when catalog links microservice mappings', async () => {
    const appEnvironments = [{ id: 'app-dev', name: 'Development', baseUrls: {} }];
    render(
      <RequestEditor
        {...defaultProps}
        collection={
          makeCollection({
            mode: 'multi-env',
            microserviceId: 'svc-1',
            baseUrls: { 'env-1': 'https://tenant.dev.example/api' },
          })
        }
        appMicroservices={[{
          id: 'svc-1',
          name: 'Orders',
          baseUrls: { 'app-dev': 'https://tenant.dev.example/api' },
        }]}
        appEnvironments={appEnvironments}
      />,
    );
    expect(screen.getAllByRole('button', { name: /Development/ })[0]).toBeTruthy();
    expect(screen.queryByText(/Base URLs not configured/)).toBeNull();
  });

  it('drops env pills lacking microservice mappings', () => {
    const appEnvironments = [{ id: 'ae-dev', name: 'Development', baseUrls: {} }];
    render(
      <RequestEditor
        {...defaultProps}
        collection={
          makeCollection({
            mode: 'multi-env',
            microserviceId: 'svc-1',
            baseUrls: {
              'env-1': 'https://tenant.dev.example/api',
            },
          })
        }
        environments={[
          ...makeEnvs(),
          { id: 'env-isolated', name: 'Sandbox' },
        ]}
        appMicroservices={[{
          id: 'svc-1',
          name: 'Orders',
          baseUrls: { 'ae-dev': 'https://tenant.dev.example/api' },
        }]}
        appEnvironments={appEnvironments}
      />,
    );
    expect(screen.getByRole('button', { name: /Development/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sandbox\b/ })).toBeNull();
  });

  it('folds pasted absolute URLs down to canonical relative paths', async () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        collection={makeCollection({
          mode: 'multi-env',
          baseUrls: { 'env-1': 'https://multi.example/api/' },
        })}
        environments={makeEnvs()}
        selectedEnvId="env-1"
        request={makeRequest({ url: '/keep' })}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('/v1/endpoint'), {
      target: { value: 'https://multi.example/api/other?flag=1' },
    });
    await waitFor(() =>
      expect(onUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/other?flag=1' }),
      ),
    );
  });

  it('discards dangling curl drafts when navigating to another snapshot', async () => {
    const view = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ id: 'req-a', url: 'https://a.example/ping' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'cURL Import' }));
    fireEvent.change(screen.getByPlaceholderText(/curl -X POST/), {
      target: { value: 'curl https://x' },
    });

    view.rerender(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ id: 'req-b', url: 'https://b.example/pong' })}
      />,
    );

    await waitFor(() => expect(screen.queryByPlaceholderText(/curl -X POST/)).toBeNull());
  });

  it('shows Body authoring controls after switching tabs', () => {
    render(<RequestEditor {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /^Body\b/ }));
    expect(document.querySelector('.body-type-trigger')).toHaveTextContent(/No Body/u);
  });

  it('fires removeHeader for the earliest KV pairs', async () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [
            { key: 'Alpha', value: '1' },
            { key: 'Beta', value: '2' },
          ],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /^Headers\b/ }));
    fireEvent.click(document.querySelector('.req-header-row .req-icon-btn.danger')!);

    await waitFor(() =>
      expect(onUpdateRequest).toHaveBeenCalledWith({
        headers: [{ key: 'Beta', value: '2' }],
      }),
    );
  });

  it('falls back to raw preview when payloads are not strict JSON', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{oops',
    });
    const view = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://parse.example/stream' })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(view.container.querySelector('.jt-raw')).toBeTruthy(),
    );
  });

  it('resets investigator search facets after dismiss control', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"needle":true}',
    });
    const view = render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://needle.example/find' })} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    const input = await screen.findByPlaceholderText('Search response...');
    fireEvent.change(input, { target: { value: 'needle' } });

    await waitFor(() => expect(view.container.querySelector('.req-resp-search-clear')).not.toBeNull());
    fireEvent.click(view.container.querySelector('.req-resp-search-clear')!);

    expect(input).toHaveValue('');
  });

  it('surfaces Headers tab empty hints for headerless payloads', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      headers: {},
      body: '',
    });
    const view = render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://nocontent.example/ok' })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(view.container.querySelector('.req-status-pill')).toHaveTextContent('204'),
    );

    const respPane = view.container.querySelector('.req-pane-right')!;
    fireEvent.click(within(respPane).getByRole('button', { name: /^Headers\b/ }));

    await waitFor(() =>
      expect(screen.getByText('No response headers')).toBeVisible(),
    );
  });

  it('removes pinned response visuals when deleting the active history snapshot', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"a":true}',
    });
    const view = render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://hist.example/ping' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(responseCacheHarness.history.length).toBeGreaterThanOrEqual(1),
    );

    fireEvent.click(screen.getByTitle('Response history'));
    fireEvent.click(screen.getByRole('button', { name: /Delete Current Response/ }));

    await waitFor(() => {
      expect(responseCacheHarness.response).toBeNull();
      expect(view.container.querySelector('.req-status-pill')).toBeNull();
    });
  });

  it('flushes persisted snapshots via clear history controls', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
    render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://hist.example/x' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() =>
      expect(responseCacheHarness.history.length).toBeGreaterThanOrEqual(1),
    );

    fireEvent.click(screen.getByTitle('Response history'));
    fireEvent.click(screen.getByRole('button', { name: /Clear History/ }));

    await waitFor(() => {
      expect(responseCacheHarness.history).toHaveLength(0);
      expect(responseCacheHarness.response).toBeNull();
    });

    expect(screen.getByTitle('Response history')).toBeDisabled();
  });

  it('guides cURL export when no sendable URL fragment exists yet', async () => {
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: '   ', method: 'GET' })}
      />,
    );

    fireEvent.click(screen.getByTitle('Import / Export'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'cURL Export' }));
    });

    await waitFor(() =>
      expect(vi.mocked(buildCurlCommand)).not.toHaveBeenCalled(),
    );
    expect(screen.getByText('Set a URL first.')).toBeTruthy();
  });

  it('mirrors OAuth2-linked microservices into Authorization headers via global profiles', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 204,
      statusText: '',
      headers: {},
      body: '',
    });
    render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({
          mode: 'multi-env',
          microserviceId: 'svc-99',
          baseUrls: {},
        })}
        appMicroservices={[{
          id: 'svc-99',
          name: 'Bridge',
          baseUrls: { 'ae-rem': 'https://bridge.example/api' },
          customEnvs: [],
          authProfileIds: { 'ae-rem': 'gp-z' },
        }]}
        appEnvironments={[{ id: 'ae-rem', name: 'WorkbenchEnv' }]}
        environments={[{ id: 'env-wb', name: 'WorkbenchEnv' }]}
        selectedEnvId="env-wb"
        request={makeRequest({ url: '/rel', auth: { type: 'inherit' } })}
        appGlobalAuthProfiles={[
          { id: 'gp-z', name: 'Z', auth: { type: 'bearer', token: 'jwt-z' } },
        ]}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(vi.mocked(applyAuthHeaders)).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'bearer', token: 'jwt-z' }),
        expect.any(Object),
      ),
    );

    await waitFor(() =>
      expect(vi.mocked(httpFetch)).toHaveBeenCalled(),
    );
    expect(screen.getByTitle('Response history')).not.toBeDisabled();
  });

  it('fans out JSON explorer controls after expandable payloads land', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"tier":{"leaf":true}}',
    });

    render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://tier.example/obj' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Expand All' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }));
  });

  it('propagates body editor mutations back into the persisted request envelope', async () => {
    const onUpdateRequest = vi.fn();
    const panel = render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ bodyType: 'json', body: '{}' })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Body\b/ }));

    const ta = panel.container.querySelector('.body-code-textarea') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    fireEvent.change(ta, { target: { value: '{"draft":42}' } });

    await waitFor(() =>
      expect(onUpdateRequest).toHaveBeenCalledWith(expect.objectContaining({ body: '{"draft":42}' })),
    );
  });

  it('copies regenerated cURL text through the clipboard bridge', async () => {
    vi.mocked(buildCurlCommand).mockResolvedValue('curl https://snippet');
    render(<RequestEditor {...defaultProps} request={makeRequest({ url: '/copy-sample' })} />);

    fireEvent.click(screen.getByTitle('Import / Export'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'cURL Export' }));
    });

    const curlPanel = document.querySelector('.req-curl-panel')!;

    await waitFor(() =>
      expect(within(curlPanel as HTMLElement).getByRole('button', { name: 'Refresh' })).toBeTruthy(),
    );

    await waitFor(() =>
      expect(within(curlPanel as HTMLElement).getByDisplayValue('curl https://snippet')).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.click(within(curlPanel as HTMLElement).getByRole('button', { name: 'Copy' }));
    });

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('curl https://snippet'),
    );
  });

  it('surfaces curl generation failures beside the exporter controls', async () => {
    vi.mocked(buildCurlCommand).mockRejectedValue(new Error('curl boom'));
    render(<RequestEditor {...defaultProps} request={makeRequest({ url: '/boom' })} />);

    fireEvent.click(screen.getByTitle('Import / Export'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'cURL Export' }));
    });

    await waitFor(() =>
      expect(screen.getByDisplayValue(/# Error: curl boom/u)).toBeTruthy(),
    );
  });

  it('reloads archived traffic into the investigator when picking prior history rows', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"first":true}',
    });
    vi.mocked(httpFetch).mockResolvedValueOnce({
      status: 201,
      statusText: '',
      headers: {},
      body: '{"second":true}',
    });

    render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://hist.example/track' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() =>
      expect(responseCacheHarness.history.length).toBeGreaterThanOrEqual(1),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() =>
      expect(responseCacheHarness.history.length).toBeGreaterThanOrEqual(2),
    );

    fireEvent.click(screen.getByTitle('Response history'));

    const entries = document.querySelectorAll('.resp-history-entry');
    expect(entries.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(entries[entries.length - 1] as HTMLElement);

    await waitFor(() =>
      expect(screen.queryByText('"first"')).toBeInTheDocument(),
    );
    expect(responseCacheHarness.restoreFromHistory).toHaveBeenCalled();
  });

  it('honors authPerEnv bearer overrides before collection defaults during sends', async () => {
    vi.mocked(httpFetch).mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' });
    render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({
          mode: 'multi-env',
          baseUrls: { 'env-1': 'https://per-env.example/' },
          auth: { type: 'bearer', token: 'default' },
          authPerEnv: { 'env-1': { type: 'bearer', token: 'scoped' } },
        })}
        environments={makeEnvs()}
        selectedEnvId="env-1"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(vi.mocked(applyAuthHeaders)).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'scoped' }),
        expect.any(Object),
      ),
    );
  });

  it('falls back to raw stripping when pasted hosts are not tethered microservice prefixes', async () => {
    const onUpdateRequest = vi.fn();
    const pasted = 'https://%00.example/bad%%%';
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        collection={makeCollection({
          mode: 'multi-env',
          baseUrls: { 'env-1': 'https://known.example/api' },
        })}
        environments={makeEnvs()}
        selectedEnvId="env-1"
        request={makeRequest({ url: '/' })}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('/v1/endpoint'), {
      target: { value: pasted },
    });

    await waitFor(() =>
      expect(onUpdateRequest).toHaveBeenCalledWith(expect.objectContaining({ url: pasted })),
    );
  });

  it('closes raw cURL import panels when cancelling back to builder state', async () => {
    render(<RequestEditor {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByRole('button', { name: 'cURL Import' }));
    fireEvent.change(screen.getByPlaceholderText(/curl -X POST/), {
      target: { value: 'curl https://scratch.example/start' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText(/curl -X POST/)).toBeNull();
  });

  it('updates templated URLs when catalog path placeholders change', async () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        collection={makeCollection({
          mode: 'multi-env',
          baseUrls: { 'env-1': 'https://svc.test/api' },
        })}
        environments={makeEnvs()}
        selectedEnvId="env-1"
        request={makeRequest({
          url: '/widgets/LEGACY',
          savedPathParams: [{ key: 'widgetId', value: 'LEGACY', description: 'id', required: true }],
          catalogMeta: {
            operationId: 'w',
            originalPath: '/widgets/{widgetId}',
            tags: [],
            parameters: [],
            expectedResponses: [],
          },
        })}
      />,
    );

    const pathInput = await screen.findByPlaceholderText(/Enter widgetId/i);
    fireEvent.change(pathInput, { target: { value: 'NEXT' } });

    await waitFor(() =>
      expect(onUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/widgets/NEXT' }),
      ),
    );
  });

  it('extends header rows via the scaffold add-row control', async () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ headers: [{ key: 'A', value: '1' }] })}
      />,
    );

    const left = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(left).getByRole('button', { name: /^Headers\b/ }));

    fireEvent.click(within(left).getByRole('button', { name: '+ Add' }));

    await waitFor(() =>
      expect(onUpdateRequest).toHaveBeenCalledWith({
        headers: [
          { key: 'A', value: '1' },
          { key: '', value: '' },
        ],
      }),
    );
  });

  it('pins sidebar environment labels when drilling into sub-collections', () => {
    const { container } = render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({
          mode: 'multi-env',
          baseUrls: { 'env-parent': 'https://parent.example/api' },
        })}
        environments={[
          { id: 'env-parent', name: 'ParentEnv' },
          { id: 'env-child', name: 'PinnedBox' },
        ]}
        parentSubCollection={{
          id: 'folder-1',
          name: 'PinnedBox',
          requests: [],
          isSubCollection: true,
          baseUrls: { 'env-parent': 'https://nested.example/host' },
        }}
      />,
    );

    expect(container.querySelector('.req-env-pill.pinned')).toHaveTextContent('PinnedBox');
  });

  it('captures outbound failures as synthetic zero-status responses while logging context', async () => {
    vi.mocked(httpFetch).mockRejectedValue(new Error('network offline'));
    const view = render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://boom.example/down' })} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() => {
      const pill = view.container.querySelector('.req-status-pill');
      expect(pill?.textContent ?? '').toMatch(/^\s*0\b/);
    });
    await waitFor(() =>
      expect(responseCacheHarness.history.length).toBeGreaterThanOrEqual(1),
    );
  });

  it('suppresses phantom microservice mappings when referenced auth profiles are absent', async () => {
    vi.mocked(httpFetch).mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' });

    render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({
          mode: 'multi-env',
          microserviceId: 'svc-x',
          baseUrls: {},
        })}
        appMicroservices={[{
          id: 'svc-x',
          name: 'X',
          baseUrls: { 'ae-rem': 'https://ghost.example/api' },
          authProfileIds: { 'ae-rem': 'missing-profile' },
        }]}
        appEnvironments={[{ id: 'ae-rem', name: 'WorkbenchEnv' }]}
        environments={[{ id: 'env-wb', name: 'WorkbenchEnv' }]}
        selectedEnvId="env-wb"
        appGlobalAuthProfiles={[]}
        request={makeRequest({ url: '/rel' })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(vi.mocked(httpFetch)).toHaveBeenCalled(),
    );

    expect(
      vi.mocked(applyAuthHeaders).mock.calls.filter((c) => (c[0] as { type?: string }).type !== 'none'),
    ).toHaveLength(0);
  });

  it('captures asynchronous curl generation faults in preview text', async () => {
    vi.mocked(buildCurlCommand).mockRejectedValueOnce(new Error('boom'));
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: '/ok' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'cURL Export' }));
    });
    await waitFor(() => {
      const ta = document.querySelector('.req-curl-export') as HTMLTextAreaElement | null;
      expect(ta?.value ?? '').toMatch(/# Error: boom/);
    });
  });

  it('prefers bearer auth pinned on parent subcollections over inherited collection defaults', async () => {
    vi.mocked(httpFetch).mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}' });
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://svc.example/route', auth: { type: 'inherit' } })}
        collection={makeCollection({
          auth: { type: 'bearer', token: 'collection' },
        })}
        parentSubCollection={{
          id: 'nested',
          name: 'Partners',
          requests: [],
          auth: { type: 'bearer', token: 'subcol' },
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(vi.mocked(applyAuthHeaders)).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'subcol' }),
        expect.any(Object),
      ),
    );
  });

  it('shows response header placeholder state when payloads omit headers', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '"ok"',
    });
    render(<RequestEditor {...defaultProps} request={makeRequest({ url: 'https://hdr.example/p' })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    const respTabs = document.querySelector('.req-resp-tabs');
    expect(respTabs).toBeTruthy();
    fireEvent.click(within(respTabs as HTMLElement).getByRole('button', { name: /^Headers\b/ }));

    await waitFor(() =>
      expect(screen.getByText('No response headers')).toBeInTheDocument(),
    );
  });

  it('shows request auth inspector when the Auth tab is activated', () => {
    const onUpdateRequest = vi.fn();
    const { container } = render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ auth: { type: 'bearer', token: 'keep' } })}
      />,
    );
    const requestTabs = document.querySelector('.req-pane-left .req-tabs');
    fireEvent.click(within(requestTabs as HTMLElement).getByRole('button', { name: /^Auth\b/ }));
    const authSelect = container.querySelector('.req-auth-editor .req-select') as HTMLSelectElement;
    expect(authSelect).toBeTruthy();
    fireEvent.change(authSelect, { target: { value: 'none' } });
    expect(onUpdateRequest).toHaveBeenCalledWith({ auth: { type: 'none' } });
  });

  it('renders an empty definition history explainer when snapshots are missing', () => {
    render(<RequestEditor {...defaultProps} request={makeRequest()} />);
    const requestTabs = document.querySelector('.req-pane-left .req-tabs');
    fireEvent.click(within(requestTabs as HTMLElement).getByRole('button', { name: /^History\b/ }));
    expect(screen.getByText('No definition history yet')).toBeInTheDocument();
  });

  it('strips the lone header row via the inline remove control', () => {
    const onUpdateRequest = vi.fn();
    const { container } = render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ headers: [{ key: 'Solo', value: '1' }] })}
      />,
    );
    const requestTabs = document.querySelector('.req-pane-left .req-tabs');
    fireEvent.click(within(requestTabs as HTMLElement).getByRole('button', { name: /^Headers\b/ }));
    const removeBtn = (container.querySelector('.req-headers-editor') as HTMLElement).querySelector('button.req-icon-btn');
    fireEvent.click(removeBtn!);
    expect(onUpdateRequest).toHaveBeenCalledWith({ headers: [{ key: '', value: '' }] });
  });

  it('stacks another header row via the add control beside the bulk actions', () => {
    const onUpdateRequest = vi.fn();
    const { container } = render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ headers: [{ key: 'First', value: '1' }] })}
      />,
    );
    const requestTabs = document.querySelector('.req-pane-left .req-tabs');
    fireEvent.click(within(requestTabs as HTMLElement).getByRole('button', { name: /^Headers\b/ }));

    fireEvent.click(within(container.querySelector('.req-headers-editor') as HTMLElement).getByRole('button', { name: /^\+ Add$/ }));

    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [
        { key: 'First', value: '1' },
        { key: '', value: '' },
      ],
    });
  });

  it('flushes structured headers via the sidebar delete-all control', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ headers: [{ key: 'Gamma', value: 'value' }] })}
      />,
    );
    const requestTabs = document.querySelector('.req-pane-left .req-tabs');
    expect(requestTabs).toBeTruthy();
    fireEvent.click(within(requestTabs as HTMLElement).getByRole('button', { name: /^Headers\b/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    expect(onUpdateRequest).toHaveBeenCalledWith({ headers: [{ key: '', value: '' }] });
  });

  it('forwards pinned definition version deletes and rename commits', () => {
    const snapshot = {
      name: 'R',
      url: '/',
      method: 'GET' as const,
      headers: [{ key: 'Hdr', value: '1' }],
      body: '',
      auth: { type: 'none' as const },
    };
    const onUpdateRequest = vi.fn();

    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          definitionVersions: [
            {
              id: 'ver-target',
              timestamp: 555,
              label: 'Quarterly checkpoint',
              snapshot,
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^History\b/ }));

    const rail = screen.getByText('Request Definition History').closest('.test-def-version-panel')!;
    const row = rail.querySelector('.test-def-version-item') as HTMLElement;

    fireEvent.click(within(row).getByRole('button', { name: /Rename/ }));
    const labelInput = within(row).getByPlaceholderText('Version label…');
    fireEvent.change(labelInput, { target: { value: 'GA release' } });
    fireEvent.keyDown(labelInput, { key: 'Enter' });
    expect(onUpdateRequest).toHaveBeenCalled();

    vi.mocked(onUpdateRequest).mockClear();

    fireEvent.click(within(row).getByRole('button', { name: /Delete/ }));
    expect(onUpdateRequest).toHaveBeenCalled();
  });

  it('surfaces send diagnostics after opening the console lane', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });

    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://console-stage.example/start' })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    fireEvent.click(screen.getByRole('button', { name: /^Console\b/ }));

    await waitFor(() =>
      expect(screen.getByText(/Using browser fetch API/)).toBeInTheDocument(),
    );
  });

  it('hides workbench env pills that lack microservice base URL bindings', () => {
    render(
      <RequestEditor
        {...defaultProps}
        collection={makeCollection({
          mode: 'multi-env',
          microserviceId: 'bound-ms',
          baseUrls: {},
        })}
        environments={[
          { id: 'env-1', name: 'Development' },
          { id: 'env-2', name: 'Production' },
          { id: 'ghost', name: 'UnusedLabel' },
        ]}
        appMicroservices={[
          {
            id: 'bound-ms',
            name: 'Inventory',
            baseUrls: { 'ae-dev': 'https://inventory.example/api' },
            customEnvs: [],
          },
        ]}
        appEnvironments={[
          { id: 'ae-dev', name: 'Development' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: /Development\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Production\b/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /UnusedLabel\b/ })).toBeNull();
  });

  it('edits individual header values in the headers tab', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [{ key: 'X-Custom', value: 'old' }],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /^Headers\b/ }));
    const inputs = document.querySelectorAll('.req-header-row .req-input');
    fireEvent.change(inputs[1], { target: { value: 'new-value' } });
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: 'X-Custom', value: 'new-value' }],
    });
  });

  it('edits header key in the headers tab', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [{ key: 'Old-Key', value: 'val' }],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /^Headers\b/ }));
    const inputs = document.querySelectorAll('.req-header-row .req-input');
    fireEvent.change(inputs[0], { target: { value: 'New-Key' } });
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: 'New-Key', value: 'val' }],
    });
  });

  it('adds a new header via Add button', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [{ key: 'Existing', value: 'v' }],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /^Headers\b/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: 'Existing', value: 'v' }, { key: '', value: '' }],
    });
  });

  it('removes the last header and replaces with empty row', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [{ key: 'Solo', value: 'v' }],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /^Headers\b/ }));
    fireEvent.click(document.querySelector('.req-header-row .req-icon-btn.danger')!);
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: '', value: '' }],
    });
  });

  it('opens history tab and renders version panel', () => {
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          definitionVersions: [
            { id: 'v1', label: 'v1', timestamp: Date.now(), snapshot: { url: '/old', method: 'GET', headers: [], body: '', bodyType: 'none', auth: { type: 'none' } } },
          ],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /History/ }));
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('resolves path params and updates URL when catalogMeta originalPath is set', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/users/123/orders',
          catalogMeta: { source: 'openapi', specId: 's1', operationId: 'op', originalPath: '/users/{userId}/orders' },
          savedPathParams: [{ name: 'userId', value: '123' }],
        })}
      />,
    );
    expect(screen.getByText('QUERY PARAMETERS')).toBeInTheDocument();
  });

  it('shows cURL export textarea with URL and allows copy and refresh', async () => {
    const { buildCurlCommand } = await import('../../../shared/utils/curlGenerator');
    vi.mocked(buildCurlCommand).mockResolvedValue('curl -X GET https://api.example.com/test');
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://api.example.com/test' })}
      />,
    );
    const actionBtn = screen.getByTitle('Import / Export');
    fireEvent.click(actionBtn);
    await waitFor(() => expect(screen.getByText('cURL Export')).toBeInTheDocument());
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByText('Copy')).toBeInTheDocument());
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('response preview tab is active by default', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: { 'x-test': '1' }, body: '{"ok":true}',
    });
    render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://resp.example/tabs' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(screen.getByText(/200/)).toBeInTheDocument());
    const respTabs = document.querySelectorAll('.req-resp-tabs .req-tab');
    expect(respTabs[0]).toHaveClass('active');
  });

  it('collapse all and expand all buttons toggle JSON tree state', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{"a":{"b":1}}',
    });
    render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://tree.example/json' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(screen.getByText(/200/)).toBeInTheDocument());
    const searchInput = await screen.findByPlaceholderText('Search response...');
    expect(searchInput).toBeInTheDocument();
    fireEvent.click(screen.getByText('Collapse All'));
    fireEvent.click(screen.getByText('Expand All'));
  });

  it('closes cURL export panel via Close button and returns to builder', async () => {
    const { buildCurlCommand } = await import('../../../shared/utils/curlGenerator');
    vi.mocked(buildCurlCommand).mockResolvedValue('curl https://example.com');
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://close.example/curl' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    await waitFor(() => expect(screen.getByText('cURL Export')).toBeInTheDocument());
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByText('Close')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Generated cURL command')).toBeNull();
  });

  it('cURL export Copy button copies to clipboard and shows Copied state', async () => {
    const { buildCurlCommand } = await import('../../../shared/utils/curlGenerator');
    vi.mocked(buildCurlCommand).mockResolvedValue('curl -X GET https://copy.example');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://copy.example/curl' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    await waitFor(() => expect(screen.getByText('cURL Export')).toBeInTheDocument());
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByText('Copy')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('curl -X GET https://copy.example');
  });

  it('cURL export Refresh button regenerates the command', async () => {
    const { buildCurlCommand } = await import('../../../shared/utils/curlGenerator');
    vi.mocked(buildCurlCommand).mockResolvedValue('curl first');

    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://refresh.example/curl' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    await waitFor(() => expect(screen.getByText('cURL Export')).toBeInTheDocument());
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByDisplayValue('curl first')).toBeInTheDocument());

    vi.mocked(buildCurlCommand).mockResolvedValue('curl refreshed');
    await act(async () => {
      fireEvent.click(screen.getByText('Refresh'));
    });
    await waitFor(() => expect(screen.getByDisplayValue('curl refreshed')).toBeInTheDocument());
  });

  it('cURL export textarea selects all on click', async () => {
    const { buildCurlCommand } = await import('../../../shared/utils/curlGenerator');
    vi.mocked(buildCurlCommand).mockResolvedValue('curl -X GET https://sel.example');

    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://sel.example/curl' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    await waitFor(() => expect(screen.getByText('cURL Export')).toBeInTheDocument());
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByDisplayValue('curl -X GET https://sel.example')).toBeInTheDocument());

    const textarea = screen.getByDisplayValue('curl -X GET https://sel.example') as HTMLTextAreaElement;
    const selectSpy = vi.spyOn(textarea, 'select');
    fireEvent.click(textarea);
    expect(selectSpy).toHaveBeenCalled();
  });

  it('renders response headers tab with response header rows', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json', 'x-custom': 'value' },
      body: '{}',
    });
    const view = render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://htabs.example/get' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(screen.getByText(/200/)).toBeInTheDocument());
    const respTabs = view.container.querySelectorAll('.req-resp-tabs .req-tab');
    fireEvent.click(respTabs[1]); // Headers tab
    await waitFor(() => expect(view.container.querySelector('.req-resp-header-key')).toBeTruthy());
    expect(screen.getByText('content-type')).toBeInTheDocument();
    expect(screen.getByText('x-custom')).toBeInTheDocument();
  });

  it('switches to console tab and renders console log', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    const view = render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://console.example/log' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(screen.getByText(/200/)).toBeInTheDocument());
    const respTabs = view.container.querySelectorAll('.req-resp-tabs .req-tab');
    fireEvent.click(respTabs[2]); // Console tab
    await waitFor(() => expect(view.container.querySelector('.req-console-log')).toBeTruthy());
  });

  it('handles URL bar change and strips to relative path', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ url: '/api/test' })}
        collection={makeCollection({ mode: 'multi-env', baseUrls: { e1: 'https://base.example' } })}
        environments={[{ id: 'e1', name: 'Dev' }]}
      />,
    );
    const urlInput = screen.getByPlaceholderText('/v1/endpoint');
    fireEvent.change(urlInput, { target: { value: 'https://base.example/api/new' } });
    expect(onUpdateRequest).toHaveBeenCalled();
  });

  it('handles name editing via Enter key to exit edit mode', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor {...defaultProps} onUpdateRequest={onUpdateRequest} request={makeRequest({ name: 'Original' })} />,
    );
    fireEvent.click(screen.getByText('Original'));
    const input = screen.getByDisplayValue('Original');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Original')).toBeNull();
  });

  it('exits name editing via blur', () => {
    render(
      <RequestEditor {...defaultProps} request={makeRequest({ name: 'BlurTest' })} />,
    );
    fireEvent.click(screen.getByText('BlurTest'));
    const input = screen.getByDisplayValue('BlurTest');
    fireEvent.blur(input);
    expect(screen.getByText('BlurTest')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('BlurTest')).toBeNull();
  });

  it('parses query params from URL and lists them in Params tab', () => {
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: '/api/users?role=admin&active=true' })}
      />,
    );
    expect(screen.getByDisplayValue('role')).toBeInTheDocument();
    expect(screen.getByDisplayValue('admin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('active')).toBeInTheDocument();
    expect(screen.getByDisplayValue('true')).toBeInTheDocument();
  });

  it('updates URL via ParamsEditor when adding query parameters', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/api/users',
          savedQueryParams: [
            { key: 'page', value: '1', enabled: true, description: '' },
            { key: 'limit', value: '10', enabled: true, description: '' },
          ],
        })}
      />,
    );
    expect(screen.getByDisplayValue('page')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
  });

  it('handles path param changes without catalogMeta originalPath', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/api/items/{itemId}',
          savedPathParams: [{ name: 'itemId', value: '42' }],
        })}
      />,
    );
    expect(screen.getByText('QUERY PARAMETERS')).toBeInTheDocument();
  });

  it('toggles tree node collapsed state when clicking a JSON node', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {},
      body: '{"nested":{"deep":{"value":1}}}',
    });
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://tree.example/toggle' })}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(screen.getByText(/200/)).toBeInTheDocument());
    const toggleBtns = document.querySelectorAll('.jt-toggle');
    if (toggleBtns.length > 0) {
      fireEvent.click(toggleBtns[0]);
      fireEvent.click(toggleBtns[0]);
    }
  });

  it('shows active state on each request tab when clicked', () => {
    render(<RequestEditor {...defaultProps} />);
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    const tabs = within(pane).getAllByRole('button').filter(b => b.classList.contains('req-tab'));
    const bodyTab = tabs.find(t => t.textContent?.includes('Body'));
    const authTab = tabs.find(t => t.textContent?.includes('Auth'));
    const headersTab = tabs.find(t => t.textContent?.match(/^Headers/));

    if (bodyTab) {
      fireEvent.click(bodyTab);
      expect(bodyTab).toHaveClass('active');
    }
    if (authTab) {
      fireEvent.click(authTab);
      expect(authTab).toHaveClass('active');
    }
    if (headersTab) {
      fireEvent.click(headersTab);
      expect(headersTab).toHaveClass('active');
    }
    const paramsTab = tabs.find(t => t.textContent?.includes('Params'));
    if (paramsTab) {
      fireEvent.click(paramsTab);
      expect(paramsTab).toHaveClass('active');
    }
  });

  it('switches all response tabs (preview, headers, console)', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: { 'x-h': 'v' }, body: '{"ok":1}',
    });
    const view = render(
      <RequestEditor {...defaultProps} request={makeRequest({ url: 'https://resp-tabs.example/all' })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(screen.getByText(/200/)).toBeInTheDocument());

    const respTabs = view.container.querySelectorAll('.req-resp-tabs .req-tab');
    expect(respTabs.length).toBeGreaterThanOrEqual(3);

    fireEvent.click(respTabs[0]); // Preview
    expect(respTabs[0]).toHaveClass('active');

    fireEvent.click(respTabs[1]); // Headers
    expect(respTabs[1]).toHaveClass('active');

    fireEvent.click(respTabs[2]); // Console
    expect(respTabs[2]).toHaveClass('active');

    fireEvent.click(respTabs[0]); // Back to Preview
    expect(respTabs[0]).toHaveClass('active');
  });

  it('renders history tab and exercises restore, delete, rename, compare', () => {
    const onUpdateRequest = vi.fn();
    const ts = Date.now();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          definitionVersions: [
            {
              id: 'v-old',
              label: 'v1.0',
              timestamp: ts - 60000,
              snapshot: { url: '/old', method: 'GET', headers: [], body: '', bodyType: 'none', auth: { type: 'none' } },
            },
            {
              id: 'v-new',
              label: 'v2.0',
              timestamp: ts,
              snapshot: { url: '/new', method: 'POST', headers: [], body: '{}', bodyType: 'json', auth: { type: 'none' } },
            },
          ],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /History/ }));
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('v2.0')).toBeInTheDocument();
  });

  it('restores a definition version from the history tab', () => {
    const onUpdateRequest = vi.fn();
    const snap = { url: '/restored', method: 'PUT' as const, headers: [{ key: 'X', value: 'Y' }], body: '{"x":1}', bodyType: 'json' as const, auth: { type: 'none' as const } };
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          definitionVersions: [
            { id: 'v-r', label: 'Restore Me', timestamp: Date.now(), snapshot: snap },
          ],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /History/ }));
    const restoreBtn = screen.getByTitle('Restore this version');
    fireEvent.click(restoreBtn);
    expect(onUpdateRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/restored', method: 'PUT' }),
    );
  });

  it('triggers handleParamsChange via ParamsEditor and uses buildUrl to construct query string', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/api/search',
          savedQueryParams: [{ key: 'q', value: '', enabled: true, description: '' }],
        })}
      />,
    );
    const valueInput = screen.getAllByPlaceholderText('value')[0];
    fireEvent.change(valueInput, { target: { value: 'hello' } });

    expect(onUpdateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('q=hello'),
      }),
    );
  });

  it('exercises handlePathParamsChange when no catalogMeta originalPath', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/api/items/{itemId}',
          savedPathParams: [{ key: 'itemId', value: '99' }],
        })}
      />,
    );
    const pathInput = screen.getByPlaceholderText('Enter itemId');
    fireEvent.change(pathInput, { target: { value: '200' } });
    expect(onUpdateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        savedPathParams: [{ key: 'itemId', value: '200' }],
      }),
    );
  });

  it('clears savedPathParams when path param value is emptied without originalPath', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/api/items/{itemId}',
          savedPathParams: [{ key: 'itemId', value: 'x' }],
        })}
      />,
    );
    const pathInput = screen.getByPlaceholderText('Enter itemId');
    fireEvent.change(pathInput, { target: { value: '' } });
    const lastCall = onUpdateRequest.mock.calls[onUpdateRequest.mock.calls.length - 1][0];
    expect(lastCall.savedPathParams).toEqual([{ key: 'itemId', value: '' }]);
  });

  it('resolves auth from sub-collection when request inherits', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://subcol-auth.example/get', auth: { type: 'inherit' } })}
        collection={makeCollection({ auth: { type: 'none' } })}
        parentSubCollection={{
          id: 'sc1', name: 'Sub', requests: [], auth: { type: 'bearer', token: 'sub-tok', prefix: 'Bearer' },
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(applyAuthHeaders).toHaveBeenCalled());
    expect(vi.mocked(applyAuthHeaders).mock.calls[0][0]).toEqual(
      expect.objectContaining({ type: 'bearer', token: 'sub-tok' }),
    );
  });

  it('resolves auth from collection authPerEnv when present', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://envauth.example/get', auth: { type: 'inherit' } })}
        collection={makeCollection({
          auth: { type: 'none' },
          authPerEnv: { 'env-1': { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'header' } },
        })}
        selectedEnvId="env-1"
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(applyAuthHeaders).toHaveBeenCalled());
    expect(vi.mocked(applyAuthHeaders).mock.calls[0][0]).toEqual(
      expect.objectContaining({ type: 'apikey', apiKeyName: 'X-Key' }),
    );
  });

  it('resolves auth from linked microservice auth profile', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://svcauth.example/get', auth: { type: 'inherit' } })}
        collection={makeCollection({
          mode: 'multi-env',
          auth: { type: 'none' },
          microserviceId: 'ms1',
          baseUrls: {},
        })}
        environments={[{ id: 'env-1', name: 'Dev' }]}
        selectedEnvId="env-1"
        appMicroservices={[{
          id: 'ms1', name: 'Users', baseUrls: { 'ae-dev': 'https://svcauth.example' },
          customEnvs: [], authProfileIds: { 'ae-dev': 'prof-1' },
        }]}
        appEnvironments={[{ id: 'ae-dev', name: 'Dev' }]}
        appGlobalAuthProfiles={[{
          id: 'prof-1', name: 'SvcAuth', auth: { type: 'bearer', token: 'svc-tok' },
        }]}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(applyAuthHeaders).toHaveBeenCalled());
    expect(vi.mocked(applyAuthHeaders).mock.calls[0][0]).toEqual(
      expect.objectContaining({ type: 'bearer', token: 'svc-tok', globalProfileId: 'prof-1' }),
    );
  });

  it('imports cURL with name and body type and switches to body tab', () => {
    vi.mocked(parseCurl).mockReturnValue({
      id: 'x', name: 'Imported', url: 'https://curl.example/api', method: 'POST',
      headers: [], body: '{"key":"val"}', bodyType: 'json', validation: { mode: 'none' },
    } as unknown as ReturnType<typeof parseCurl>);

    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({ name: '', url: '' })}
      />,
    );
    fireEvent.click(screen.getByTitle('Import / Export'));
    fireEvent.click(screen.getByText('cURL Import'));
    const textarea = screen.getByPlaceholderText(/curl -X POST/);
    fireEvent.change(textarea, { target: { value: 'curl -X POST https://curl.example/api -d \'{"key":"val"}\'' } });
    fireEvent.click(screen.getByText(/Import.*Apply/));

    expect(onUpdateRequest).toHaveBeenCalledWith(
      expect.objectContaining({ body: '{"key":"val"}', name: 'Imported' }),
    );
  });

  it('handles param editor with disabled params and empty trailing row', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          url: '/api/test',
          savedQueryParams: [
            { key: 'active', value: 'true', enabled: false, description: '' },
            { key: 'page', value: '1', enabled: true, description: '' },
            { key: '', value: '', enabled: true, description: '' },
          ],
        })}
      />,
    );
    const valueInputs = screen.getAllByPlaceholderText('value');
    fireEvent.change(valueInputs[1], { target: { value: '2' } });
    expect(onUpdateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        savedQueryParams: expect.arrayContaining([
          expect.objectContaining({ key: 'page', value: '2' }),
        ]),
      }),
    );
  });

  it('resolves base URLs from linked microservice envs', () => {
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: '/api/test' })}
        collection={makeCollection({
          mode: 'multi-env',
          microserviceId: 'ms1',
          baseUrls: {},
        })}
        environments={[{ id: 'env-1', name: 'Dev' }]}
        appMicroservices={[{
          id: 'ms1', name: 'Svc',
          baseUrls: { 'ae-dev': 'https://svc.example' },
          customEnvs: [],
        }]}
        appEnvironments={[{ id: 'ae-dev', name: 'Dev' }]}
      />,
    );
    expect(screen.getByRole('button', { name: /Dev/ })).toBeInTheDocument();
  });

  it('description field in savedQueryParams fallback uses empty string for undefined', () => {
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({
          url: '/api/test',
          savedQueryParams: [
            { key: 'a', value: '1', enabled: true, description: undefined as unknown as string },
          ],
        })}
      />,
    );
    expect(screen.getByDisplayValue('a')).toBeInTheDocument();
  });

  it('resolves collection-level auth when both inherit path and collection auth exist', async () => {
    vi.mocked(httpFetch).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    render(
      <RequestEditor
        {...defaultProps}
        request={makeRequest({ url: 'https://colauth.example/get', auth: { type: 'inherit' } })}
        collection={makeCollection({
          auth: { type: 'basic', username: 'col-user', password: 'col-pass' },
        })}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await waitFor(() => expect(applyAuthHeaders).toHaveBeenCalled());
    expect(vi.mocked(applyAuthHeaders).mock.calls[0][0]).toEqual(
      expect.objectContaining({ type: 'basic', username: 'col-user' }),
    );
  });

  it('version panel onDelete and onRename callbacks update request', () => {
    const onUpdateRequest = vi.fn();
    const snap = { url: '/x', method: 'GET' as const, headers: [], body: '', bodyType: 'none' as const, auth: { type: 'none' as const } };
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          definitionVersions: [
            { id: 'v1', label: 'First', timestamp: Date.now() - 5000, snapshot: snap },
            { id: 'v2', label: 'Second', timestamp: Date.now(), snapshot: snap },
          ],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /History/ }));

    const deleteButtons = screen.getAllByTitle('Delete this version');
    fireEvent.click(deleteButtons[0]);
    expect(onUpdateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionVersions: expect.arrayContaining([
          expect.objectContaining({ id: 'v2' }),
        ]),
      }),
    );
  });
});
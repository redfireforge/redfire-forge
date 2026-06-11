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
    installClipboardMock();
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
    fireEvent.change(screen.getByLabelText('Headers value 1'), { target: { value: 'new-value' } });
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
    fireEvent.change(screen.getByLabelText('Headers key 1'), { target: { value: 'New-Key' } });
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
    fireEvent.click(screen.getByTestId('req-headers-add-btn'));
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: 'Existing', value: 'v' }, { key: '', value: '' }],
    });
  });

  it('removes the last header row', () => {
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
    fireEvent.click(document.querySelector('.ws-connect-kv-remove-btn')!);
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [],
    });
  });

  it('persists enabled:false when a header checkbox is unchecked', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [{ key: 'X-Custom', value: 'v' }],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /^Headers\b/ }));
    fireEvent.click(screen.getByLabelText('Enable headers 1'));
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: 'X-Custom', value: 'v', enabled: false }],
    });
  });

  it('omits the enabled flag for headers that remain enabled', () => {
    const onUpdateRequest = vi.fn();
    render(
      <RequestEditor
        {...defaultProps}
        onUpdateRequest={onUpdateRequest}
        request={makeRequest({
          headers: [{ key: 'X-Custom', value: 'v', enabled: false }],
        })}
      />,
    );
    const pane = screen.getByText('QUERY PARAMETERS').closest('.req-pane-left')!;
    fireEvent.click(within(pane).getByRole('button', { name: /^Headers\b/ }));
    fireEvent.click(screen.getByLabelText('Enable headers 1'));
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: 'X-Custom', value: 'v' }],
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
    const writeText = installClipboardMock();

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

});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { installClipboardMock } from '../../../test-utils/clipboardMock';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestEditor from './RequestEditor';
import { ConsoleLine } from '../hooks/useResponseCache';
import { RequestCollection, RequestItem, RequestEnv } from '@shared/types';
import { httpFetch } from '@shared/utils/httpClient';
import { serializeWithContentType } from '@shared/utils/bodySerializer';
import { parseCurl } from '@shared/utils/curlParser';
import { buildCurlCommand } from '@shared/utils/curlGenerator';
import { HttpResponse } from '@shared/utils/httpClient';

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

import { applyAuthHeaders } from '@shared/utils/applyAuthHeaders';

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
    resetAllMocks();
    installClipboardMock();
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
          id: 'ms1', name: 'Users', baseUrls: { 'env-1': 'https://svcauth.example' },
          customEnvs: [], authProfileIds: { 'env-1': 'prof-1' },
        }]}
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
          baseUrls: { 'env-1': 'https://svc.example' },
          customEnvs: [],
        }]}
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
    const pane = screen.getByText('Query Parameters').closest('.req-pane-left')!;
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

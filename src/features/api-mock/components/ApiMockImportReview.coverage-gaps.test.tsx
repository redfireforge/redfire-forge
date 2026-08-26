/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { loadCatalogEntries, loadRequests } from '@shared/utils/storage';

vi.mock('../../../shared/utils/storage', () => ({
  loadCatalogEntries: vi.fn(),
  loadRequests: vi.fn(),
}));

const mockLoadCatalog = vi.mocked(loadCatalogEntries);
const mockLoadRequests = vi.mocked(loadRequests);

const sampleFolders = [
  { id: 'folder-a', name: 'Alpha', parentId: null as string | null, sortOrder: 0 },
  { id: 'folder-b', name: 'Beta', parentId: null as string | null, sortOrder: 1 },
];

const wireMockPaste = JSON.stringify({
  mappings: [{
    request: { method: 'GET', url: '/widgets' },
    response: { status: 200, jsonBody: { ok: true } },
  }],
});

const harPaste = JSON.stringify({
  log: {
    version: '1.2',
    entries: [{
      request: {
        method: 'GET',
        url: 'https://api.example.com/items',
        headers: [{ name: 'Accept', value: 'application/json' }],
      },
      response: {
        status: 200,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: { text: '[]', mimeType: 'application/json' },
      },
    }],
  },
});

// HAR with a 4xx entry — used for B-1 outcome=unmatched test
const harPaste404 = JSON.stringify({
  log: {
    version: '1.2',
    entries: [{
      request: { method: 'GET', url: 'https://api.example.com/missing', headers: [] },
      response: {
        status: 404,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: { text: '{"error":"not found"}', mimeType: 'application/json' },
      },
    }],
  },
});

// HAR with two distinct entries — used for partial deselection test
const harPasteTwo = JSON.stringify({
  log: {
    version: '1.2',
    entries: [
      {
        request: { method: 'GET', url: 'https://api.example.com/items', headers: [] },
        response: {
          status: 200,
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: { text: '[]', mimeType: 'application/json' },
        },
      },
      {
        request: { method: 'POST', url: 'https://api.example.com/orders', headers: [] },
        response: {
          status: 404,
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: { text: '{"error":"not found"}', mimeType: 'application/json' },
        },
      },
    ],
  },
});

const nativePaste = JSON.stringify({
  schemaVersion: 1,
  data: {
    scope: 'routes',
    routes: [{
      id: 'r1', name: 'Users', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/users' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{
        id: 'v1', name: 'ok', enabled: true, isDefault: true, status: 200,
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        cookies: [], body: { kind: 'json', content: '{"ok":true}', contentType: 'application/json' },
        behavior: { delayMs: 0, jitterMs: 0 },
      }],
      tags: [], createdAt: 't', updatedAt: 't',
    }],
  },
});

const multiOpenApiPaste = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {
    '/a': { get: { summary: 'A' } },
    '/b': { post: { summary: 'B' } },
  },
});

afterEach(() => {
  vi.doUnmock('../../../shared/api-mock/sourceToRule');
  vi.doUnmock('../../../shared/api-mock/importParsers');
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ApiMockImportReview coverage gaps', () => {
  beforeEach(() => {
    mockLoadCatalog.mockResolvedValue([]);
    mockLoadRequests.mockResolvedValue({ collections: [] });
  });

  it('renders error diagnostics from conversion results', async () => {
    vi.doMock('../../../shared/api-mock/sourceToRule', () => ({
      convertSourceToRule: () => ({
        route: {
          id: 'route-1',
          name: 'Imported',
          enabled: false,
          method: 'GET',
          path: { kind: 'exact', value: '/users' },
          priority: 10,
          predicates: { id: 'pg', combinator: 'all', children: [] },
          responseMode: 'rules',
          responses: [],
          tags: [],
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        },
        diagnostics: [{ code: 'AMS-IMPORT-FAIL', severity: 'error', path: '/', message: 'broken import' }],
      }),
    }));

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), { target: { value: 'curl /users' } });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));

    const notice = screen.getByText(/broken import/i).closest('.am-notice');
    expect(notice).toHaveClass('danger');
  });

  it('shows info and warning diagnostics, loss report, and multi-route preview', async () => {
    vi.doMock('../../../shared/api-mock/importParsers', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../../shared/api-mock/importParsers')>();
      return {
        ...actual,
        batchToRoutes: () => ({
          routes: [
            {
              id: 'r1', name: 'One', enabled: false, method: 'GET',
              path: { kind: 'exact', value: '/items/42' }, priority: 10,
              predicates: { id: 'pg1', combinator: 'all', children: [] },
              responseMode: 'rules' as const,
              responses: [{
                id: 'v1', name: 'ok', enabled: true, isDefault: true, status: 200,
                headers: [], cookies: [],
                body: { kind: 'json' as const, content: '{"id":42}', contentType: 'application/json' },
                behavior: { delayMs: 0, jitterMs: 0 },
              }],
              tags: [], createdAt: 't', updatedAt: 't',
            },
            {
              id: 'r2', name: 'Two', enabled: false, method: 'POST',
              path: { kind: 'exact', value: '/items' }, priority: 10,
              predicates: { id: 'pg2', combinator: 'all', children: [] },
              responseMode: 'rules' as const,
              responses: [{
                id: 'v2', name: 'ok', enabled: true, isDefault: true, status: 201,
                headers: [], cookies: [],
                body: { kind: 'json' as const, content: '{}', contentType: 'application/json' },
                behavior: { delayMs: 0, jitterMs: 0 },
              }],
              tags: [], createdAt: 't', updatedAt: 't',
            },
          ],
          diagnostics: [
            { code: 'I', severity: 'info', path: '/', message: 'info note' },
            { code: 'W', severity: 'warning', path: '/', message: 'warn note' },
          ],
          lossReport: ['lost field X'],
        }),
      };
    });

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: multiOpenApiPaste } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));

    expect(screen.getByText('info note')).toBeTruthy();
    expect(screen.getByText('warn note')).toBeTruthy();
    expect(screen.getByText('Loss report')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-loss')).toHaveTextContent('lost field X');
    expect(screen.getByTestId('api-mock-import-route-list')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-preview-request-0')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-preview-request-1')).toBeTruthy();
  });

  it('generalizes numeric path segments for a single route', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: { value: 'curl https://api.example.com/items/99/details' },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    expect(screen.getByTestId('api-mock-import-generalize')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-import-generalize'));

    const preview = screen.getByTestId('api-mock-import-preview-block');
    expect(screen.getByTestId('api-mock-import-preview-path').textContent).toBe('/items/:id/details');
    expect(preview.querySelector('[data-testid="api-mock-import-preview-path"]')?.textContent).toBe('/items/:id/details');
  });

  it('pretty-format rejects non-Error throws and clears errors on edit', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    vi.spyOn(JSON, 'parse').mockImplementation(() => { throw 'bad'; });
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: '{"x":1}' } });
    fireEvent.click(screen.getByTestId('api-mock-import-pretty'));
    expect(screen.getByTestId('api-mock-import-pretty-error')).toHaveTextContent('Not valid JSON.');

    vi.mocked(JSON.parse).mockRestore();
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: '{"y":2}' } });
    expect(screen.queryByTestId('api-mock-import-pretty-error')).toBeNull();
  });

  it('ignores empty paste parse, file cancel, and invalid priority fallback', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    expect(screen.queryByTestId('api-mock-import-preview-block')).toBeNull();

    const fileInput = screen.getByTestId('api-mock-import-file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });

    fireEvent.click(screen.getByTestId('api-mock-import-source-curl'));
    fireEvent.change(screen.getByTestId('api-mock-import-priority'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('api-mock-curl-input'), { target: { value: 'curl /ping' } });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    expect(screen.getByText('P10')).toBeTruthy();
  });

  it('imports without newFolderName when create-folder name is blank', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), { target: { value: 'curl /ping' } });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport.mock.calls[0][1]).toEqual({ mode: 'merge' });
  });

  it('loads file text into paste input', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    const input = screen.getByTestId('api-mock-import-file') as HTMLInputElement;
    const file = new File([harPaste], 'capture.har', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('api-mock-import-paste')).toHaveValue(harPaste);
    });
  });

  it('parses WireMock, HAR, and native exports as disabled drafts', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    for (const [source, paste] of [
      ['wiremock', wireMockPaste],
      ['har', harPaste],
      ['native', nativePaste],
    ] as const) {
      fireEvent.click(screen.getByTestId(`api-mock-import-source-${source}`));
      fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: paste } });
      fireEvent.click(screen.getByTestId('api-mock-import-parse'));
      expect(screen.getByTestId('api-mock-import-confirm')).toBeTruthy();
      fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
      expect(onImport.mock.calls.at(-1)?.[0][0].enabled).toBe(false);
    }
  });

  it('manages folder dropdown, priority, and import options', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(
      <ApiMockImportReview
        folders={sampleFolders}
        onImport={onImport}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-import-folder'));
    expect(screen.getByTestId('api-mock-import-folder-menu')).toBeTruthy();
    const menu = screen.getByTestId('api-mock-import-folder-menu');
    fireEvent.click(menu.querySelectorAll('.am-folder-option')[1]);
    expect(screen.getByTestId('api-mock-import-folder')).toHaveTextContent('Beta');

    fireEvent.click(screen.getByTestId('api-mock-import-folder'));
    fireEvent.click(screen.getByTestId('api-mock-import-folder-new'));
    fireEvent.change(screen.getByTestId('api-mock-import-new-folder-name'), {
      target: { value: 'Imported folder' },
    });

    fireEvent.change(screen.getByTestId('api-mock-import-priority'), { target: { value: '25' } });
    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: { value: 'curl https://api.example.com/ping' },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    expect(onImport.mock.calls[0][0][0].priority).toBe(25);
    expect(onImport.mock.calls[0][1]).toEqual({
      mode: 'merge',
      newFolderName: 'Imported folder',
    });
    expect(screen.getByText('Imported folder')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-import-folder'));
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByTestId('api-mock-import-folder-menu')).toBeNull();
    });
  });

  it('shows existing folder name in import notice when a folder is selected', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(
      <ApiMockImportReview folders={sampleFolders} onImport={vi.fn()} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId('api-mock-import-folder'));
    fireEvent.click(screen.getByTestId('api-mock-import-folder-menu').querySelectorAll('.am-folder-option')[0]);
    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: { value: 'curl /health' },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    expect(screen.getByTestId('api-mock-import-preview-block')).toHaveTextContent('Folder: Alpha');
  });

  it('loads catalog endpoints from nested folders with select-all, filter, and deselect', async () => {
    mockLoadCatalog.mockResolvedValue([{
      id: 'cat-1',
      name: 'Shop',
      endpoints: [{ id: 'ep-root', method: 'GET', path: '/root', summary: '', parameters: [], responses: [], tags: [] }],
      folders: [{
        name: 'Nested',
        endpoints: [{ id: 'ep-nested', method: 'POST', path: '/nested', summary: '', parameters: [], responses: [], tags: [] }],
        folders: [],
      }],
    }]);

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} initialSource="catalog" />);

    await waitFor(() => expect(screen.getByTestId('api-mock-import-load-msg')).toHaveTextContent('2 endpoint(s)'));
    fireEvent.click(screen.getByText('Select all'));
    expect(screen.getByText('2 selected')).toBeTruthy();

    fireEvent.change(screen.getByTestId('api-mock-import-catalog-filter'), { target: { value: 'nested' } });
    expect(screen.getByTestId('api-mock-import-catalog-cat-1:ep-nested')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-import-catalog-cat-1:ep-root')).toBeNull();

    fireEvent.click(screen.getByText('None'));
    fireEvent.click(screen.getByTestId('api-mock-import-catalog-cat-1:ep-nested'));
    fireEvent.click(screen.getByTestId('api-mock-import-catalog-cat-1:ep-nested'));
    fireEvent.click(screen.getByTestId('api-mock-import-catalog-cat-1:ep-nested'));
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport).toHaveBeenCalled();
  });

  it('shows catalog empty and load failure messages', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');

    mockLoadCatalog.mockResolvedValueOnce([{
      id: 'empty', name: 'Empty', endpoints: [], folders: [],
    }]);
    const { unmount } = render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} initialSource="catalog" />);
    await waitFor(() => expect(screen.getByTestId('api-mock-import-load-msg')).toHaveTextContent('No catalog endpoints'));
    unmount();

    mockLoadCatalog.mockRejectedValueOnce(new Error('fail'));
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} initialSource="catalog" />);
    await waitFor(() => expect(screen.getByTestId('api-mock-import-load-msg')).toHaveTextContent('Failed to load catalog'));
  });

  it('loads requests with nested folders, filters, select-all, and imports', async () => {
    mockLoadRequests.mockResolvedValue({
      collections: [{
        id: 'col-1',
        name: 'Main',
        mode: 'direct',
        requests: [{
          id: 'req-root',
          name: 'Root req',
          method: 'GET',
          url: 'https://api.example.com/root',
          headers: [{ key: 'X-A', value: '1' }],
          body: '',
          auth: { type: 'none' },
        }],
        folders: [{
          name: 'Sub',
          requests: [{
            id: 'req-nested',
            name: 'Nested req',
            method: 'POST',
            url: 'https://api.example.com/nested',
            headers: [],
            body: '{"a":1}',
            auth: { type: 'none' },
          }],
          folders: [],
        }],
      }],
    });

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} initialSource="requests" />);

    await waitFor(() => expect(screen.getByTestId('api-mock-import-load-msg')).toHaveTextContent('request(s)'));
    fireEvent.click(screen.getByText('Select all'));
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByText('None'));
    fireEvent.change(screen.getByTestId('api-mock-import-requests-filter'), { target: { value: 'nested' } });
    fireEvent.click(screen.getByTestId('api-mock-import-request-req-nested'));
    expect(screen.getByText('1 selected')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport.mock.calls[0][0]).toHaveLength(1);
    expect(onImport.mock.calls[0][0][0].path.value).toBe('/nested');
  });

  it('shows requests empty and load failure messages', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');

    mockLoadRequests.mockResolvedValueOnce({ collections: [] });
    const { unmount } = render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} initialSource="requests" />);
    await waitFor(() => expect(screen.getByTestId('api-mock-import-load-msg')).toHaveTextContent('No requests found'));
    unmount();

    mockLoadRequests.mockRejectedValueOnce(new Error('fail'));
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} initialSource="requests" />);
    await waitFor(() => expect(screen.getByTestId('api-mock-import-load-msg')).toHaveTextContent('Failed to load requests'));
  });

  it('clears preview when catalog selection changes and skips empty paste parse', async () => {
    mockLoadCatalog.mockResolvedValue([{
      id: 'cat-1',
      name: 'Demo',
      endpoints: [{ id: 'ep-1', method: 'GET', path: '/demo', summary: '', parameters: [], responses: [], tags: [] }],
      folders: [],
    }]);

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} initialSource="catalog" />);

    await waitFor(() => screen.getByTestId('api-mock-import-catalog-cat-1:ep-1'));
    fireEvent.click(screen.getByTestId('api-mock-import-catalog-cat-1:ep-1'));
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    expect(screen.getByTestId('api-mock-import-preview-block')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-import-catalog-cat-1:ep-1'));
    expect(screen.queryByTestId('api-mock-import-preview-block')).toBeNull();

    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    expect(screen.queryByTestId('api-mock-import-preview-block')).toBeNull();
  });

  it('defaults folder selection to first folder when folders prop is provided', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(
      <ApiMockImportReview folders={sampleFolders} onImport={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByTestId('api-mock-import-folder')).toHaveTextContent('Alpha');
  });

  it('does not confirm import when preview has zero routes', async () => {
    vi.doMock('../../../shared/api-mock/sourceToRule', () => ({
      convertSourceToRule: () => ({
        route: {
          id: 'route-1',
          name: 'Imported',
          enabled: false,
          method: 'GET',
          path: { kind: 'exact', value: '/users' },
          priority: 10,
          predicates: { id: 'pg', combinator: 'all', children: [] },
          responseMode: 'rules',
          responses: [],
          tags: [],
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        },
        diagnostics: [],
      }),
    }));
    vi.doMock('../../../shared/api-mock/importParsers', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../../shared/api-mock/importParsers')>();
      return {
        ...actual,
        batchToRoutes: () => ({ routes: [], diagnostics: [], lossReport: [] }),
      };
    });

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: multiOpenApiPaste } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport).not.toHaveBeenCalled();
  });

  it('disables pretty format when paste is empty', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: '   ' } });
    expect(screen.getByTestId('api-mock-import-pretty')).toBeDisabled();
    expect(screen.queryByTestId('api-mock-import-pretty-error')).toBeNull();
  });

  it('parses curl without URL and skips empty header keys', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: { value: "curl -X POST -H ': bad' --data-raw '{\"a\":1}'" },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));

    expect(screen.getByTestId('api-mock-import-preview-path')).toHaveTextContent('/');
    expect(screen.getAllByText('POST').length).toBeGreaterThan(0);
  });

  it('keeps folder menu open on inside click and closes on outside click', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview folders={sampleFolders} onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-folder'));
    expect(screen.getByTestId('api-mock-import-folder-menu')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('api-mock-import-folder'));
    expect(screen.getByTestId('api-mock-import-folder-menu')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByTestId('api-mock-import-folder-menu')).toBeNull();
    });
  });

  it('renders redirect, client, and server status variants with parameterized path markup', async () => {
    vi.doMock('../../../shared/api-mock/importParsers', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../../shared/api-mock/importParsers')>();
      return {
        ...actual,
        batchToRoutes: () => ({
          routes: [
            {
              id: 'r-302', name: 'r302', enabled: false, method: 'GET',
              path: { kind: 'exact', value: '/items/{id}' }, priority: 10,
              predicates: { id: 'pg302', combinator: 'all', children: [] },
              responseMode: 'rules' as const,
              responses: [{
                id: 'v302', name: 'r302', enabled: true, isDefault: true, status: 302,
                headers: [], cookies: [],
                body: { kind: 'json' as const, content: '{}', contentType: 'application/json' },
                behavior: { delayMs: 0, jitterMs: 0 },
              }],
              tags: [], createdAt: 't', updatedAt: 't',
            },
            {
              id: 'r-404', name: 'r404', enabled: false, method: 'GET',
              path: { kind: 'exact', value: '/items/{id}' }, priority: 10,
              predicates: { id: 'pg404', combinator: 'all', children: [] },
              responseMode: 'rules' as const,
              responses: [{
                id: 'v404', name: 'r404', enabled: true, isDefault: true, status: 404,
                headers: [], cookies: [],
                body: { kind: 'json' as const, content: '{}', contentType: 'application/json' },
                behavior: { delayMs: 0, jitterMs: 0 },
              }],
              tags: [], createdAt: 't', updatedAt: 't',
            },
            {
              id: 'r-503', name: 'r503', enabled: false, method: 'GET',
              path: { kind: 'exact', value: '/items/{id}' }, priority: 10,
              predicates: { id: 'pg503', combinator: 'all', children: [] },
              responseMode: 'rules' as const,
              responses: [{
                id: 'v503', name: 'r503', enabled: true, isDefault: true, status: 503,
                headers: [], cookies: [],
                body: { kind: 'json' as const, content: '{}', contentType: 'application/json' },
                behavior: { delayMs: 0, jitterMs: 0 },
              }],
              tags: [], createdAt: 't', updatedAt: 't',
            },
          ],
          diagnostics: [],
          lossReport: [],
        }),
      };
    });

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: multiOpenApiPaste } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));

    expect(screen.getAllByText('Redirect').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Client Error').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Server Error').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{id}').length).toBeGreaterThan(0);
    expect(screen.getByTestId('api-mock-import-preview-request-1')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-preview-response-2')).toBeTruthy();
  });

  // ─── B-1: HAR import → Simulate saved samples ────────────────────────────

  it('HAR confirm passes samples with fixed status and routeId to onImport (B-1)', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: harPaste } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    // "Also create Simulate samples" toggle is visible and checked by default
    expect(screen.getByTestId('api-mock-import-har-samples-toggle')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-har-samples-checkbox')).toBeChecked();
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    expect(onImport).toHaveBeenCalledTimes(1);
    const [routes, opts, samples] = onImport.mock.calls[0];
    // Route created and is inactive
    expect(routes).toHaveLength(1);
    expect(routes[0].enabled).toBe(false);
    expect(opts).toMatchObject({ mode: 'merge' });
    // B-1: samples are the 3rd argument with fixed status from HAR response
    expect(samples).toHaveLength(1);
    expect(samples[0].expected?.status).toBe(200);
    expect(samples[0].expected?.outcome).toBe('matched');
    // routeId links the sample to the newly created route
    expect(samples[0].routeId).toBe(routes[0].id);
  });

  it('HAR confirm for 4xx entry produces outcome=unmatched (B-1)', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: harPaste404 } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    const [, , samples] = onImport.mock.calls[0];
    expect(samples).toHaveLength(1);
    expect(samples[0].expected?.status).toBe(404);
    expect(samples[0].expected?.outcome).toBe('unmatched');
  });

  it('HAR confirm passes undefined samples when createSamples toggle is unchecked (B-1)', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: harPaste } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    // Uncheck the toggle
    fireEvent.click(screen.getByTestId('api-mock-import-har-samples-checkbox'));
    expect(screen.getByTestId('api-mock-import-har-samples-checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    expect(onImport).toHaveBeenCalledTimes(1);
    const [routes, , samples] = onImport.mock.calls[0];
    expect(routes).toHaveLength(1);
    // No samples passed when toggle is off
    expect(samples).toBeUndefined();
  });

  it('HAR partial deselection imports only selected entries and their samples (B-1)', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: harPasteTwo } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    // Both entries accepted (GET /items + POST /orders), both pre-selected
    expect(screen.getByTestId('am-har-entry-cb-0')).toBeChecked();
    expect(screen.getByTestId('am-har-entry-cb-1')).toBeChecked();
    // Deselect second entry (POST /orders, 404)
    fireEvent.click(screen.getByTestId('am-har-entry-cb-1'));
    expect(screen.getByTestId('am-har-entry-cb-1')).not.toBeChecked();
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    expect(onImport).toHaveBeenCalledTimes(1);
    const [routes, , samples] = onImport.mock.calls[0];
    // Only the first entry should be imported
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe('GET');
    expect(routes[0].path.value).toBe('/items');
    // Only one sample (for the selected entry)
    expect(samples).toHaveLength(1);
    expect(samples[0].expected?.status).toBe(200);
    expect(samples[0].expected?.outcome).toBe('matched');
  });

  it('HAR select-all re-selects deselected entries (covers handleHarSelectAll lines 332-333)', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: harPasteTwo } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    // Deselect one entry
    fireEvent.click(screen.getByTestId('am-har-entry-cb-0'));
    expect(screen.getByTestId('am-har-entry-cb-0')).not.toBeChecked();
    // Click Select All to re-select all (exercises handleHarSelectAll)
    fireEvent.click(screen.getByTestId('am-har-select-all'));
    expect(screen.getByTestId('am-har-entry-cb-0')).toBeChecked();
    expect(screen.getByTestId('am-har-entry-cb-1')).toBeChecked();
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    const [routes] = onImport.mock.calls[0];
    expect(routes).toHaveLength(2);
  });

  it('HAR toggle re-adds a deselected entry (covers handleHarToggle add case line 341)', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: harPasteTwo } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    // Deselect entry 0, then click None to clear all
    fireEvent.click(screen.getByTestId('am-har-select-none'));
    expect(screen.getByTestId('am-har-entry-cb-0')).not.toBeChecked();
    expect(screen.getByTestId('am-har-entry-cb-1')).not.toBeChecked();
    // Re-add entry 0 (exercises the add/else branch of handleHarToggle)
    fireEvent.click(screen.getByTestId('am-har-entry-cb-0'));
    expect(screen.getByTestId('am-har-entry-cb-0')).toBeChecked();
    expect(screen.getByTestId('am-har-entry-cb-1')).not.toBeChecked();
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    const [routes] = onImport.mock.calls[0];
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe('GET');
  });

  // ─── B-2: HAR preview/filtering modal ────────────────────────────────────

  it('HAR parse error displays error notice and aside fix-message (B-2)', async () => {
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: 'not valid json' } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));

    // The error notice should be visible
    expect(screen.getByTestId('api-mock-import-har-error')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-har-error')).toHaveTextContent('Invalid JSON');

    // The aside panel shows the "Fix the HAR JSON error" message (not "Select entries")
    expect(screen.getByText(/Fix the HAR JSON error/i)).toBeTruthy();
    expect(screen.queryByText(/Select entries/i)).toBeNull();

    // The confirm button should NOT be rendered (it's inside the else branch)
    expect(screen.queryByTestId('api-mock-import-confirm')).toBeNull();
  });

  it('HAR with all entries filtered hides samples toggle (harHasEntries=false, B-2)', async () => {
    // A HAR where all entries are OPTIONS (auto-filtered) — accepted.length === 0
    const allOptionsHar = JSON.stringify({
      log: {
        version: '1.2',
        entries: [
          {
            request: {
              method: 'OPTIONS',
              url: 'https://api.example.com/items',
              headers: [],
            },
            response: { status: 204, headers: [], content: { text: '', mimeType: '' } },
          },
        ],
      },
    });

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: allOptionsHar } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));

    // Preview is shown (no error)
    expect(screen.getByTestId('api-mock-import-har-preview')).toBeTruthy();
    // HarEntryPreviewList shows empty accepted message
    expect(screen.getByTestId('am-har-empty')).toBeTruthy();
    // Samples toggle is NOT shown because harHasEntries is false
    expect(screen.queryByTestId('api-mock-import-har-samples-toggle')).toBeNull();
    // The aside shows "Select entries" message (no error)
    expect(screen.getByText(/Select entries/i)).toBeTruthy();
  });

  it('HAR import with existing folder shows folder name in notice and applies folderId to routes (B-2 line 683)', async () => {
    // Covers the `folderId ? <> Folder: ... </> : null` branch in the HAR confirmation notice.
    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(
      <ApiMockImportReview
        folders={sampleFolders}
        onImport={onImport}
        onCancel={vi.fn()}
      />,
    );

    // Select an existing folder (Alpha = folder-a)
    fireEvent.click(screen.getByTestId('api-mock-import-folder'));
    fireEvent.click(screen.getByTestId('api-mock-import-folder-menu').querySelectorAll('.am-folder-option')[0]);
    expect(screen.getByTestId('api-mock-import-folder')).toHaveTextContent('Alpha');

    // Parse a HAR
    fireEvent.click(screen.getByTestId('api-mock-import-source-har'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: harPaste } });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));

    // HAR preview shows — and the notice now shows "Folder: Alpha" (covers line 683)
    expect(screen.getByTestId('api-mock-import-har-preview')).toBeTruthy();
    // The notice within the HAR preview contains the folder label
    const previewBlock = screen.getByTestId('api-mock-import-har-preview');
    expect(previewBlock).toHaveTextContent(/Folder:/i);
    expect(previewBlock).toHaveTextContent(/Alpha/i);

    // Confirm — route should have folderId
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport).toHaveBeenCalledTimes(1);
    const [routes] = onImport.mock.calls[0];
    expect(routes[0].folderId).toBe('folder-a');
  });

  it('maps request imports with empty headers and missing body values', async () => {
    mockLoadRequests.mockResolvedValue({
      collections: [{
        id: 'col-edge',
        name: 'Edge',
        mode: 'direct',
        requests: [{
          id: 'req-edge',
          name: 'Edge req',
          method: 'PUT',
          url: 'https://api.example.com/edge',
          headers: [{ key: '', value: 'drop-me' }, { key: 'X-Keep', value: 'ok' }],
          body: undefined as unknown as string,
          auth: { type: 'none' },
        }],
        folders: [],
      }],
    });

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} initialSource="requests" />);

    await waitFor(() => expect(screen.getByTestId('api-mock-import-load-msg')).toHaveTextContent('1 request(s)'));
    fireEvent.click(screen.getByTestId('api-mock-import-request-req-edge'));
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    expect(onImport).toHaveBeenCalled();
    expect(onImport.mock.calls[0][0][0].method).toBe('PUT');
  });
});

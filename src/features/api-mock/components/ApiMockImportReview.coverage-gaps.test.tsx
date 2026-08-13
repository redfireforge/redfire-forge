/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { loadCatalogEntries, loadRequests } from '../../../shared/utils/storage';

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
    expect(screen.getByText('lost field X')).toBeTruthy();
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
    expect(preview.querySelector('.am-mono')?.textContent).toBe('/items/:id/details');
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
    fireEvent.click(screen.getByText('+ Create new folder'));
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
});

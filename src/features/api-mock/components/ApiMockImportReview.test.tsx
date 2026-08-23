/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockImportReview } from './ApiMockImportReview';
import { loadCatalogEntries, loadRequests } from '@shared/utils/storage';

vi.mock('../../../shared/utils/storage', () => ({
  loadCatalogEntries: vi.fn(),
  loadRequests: vi.fn(),
}));

const mockLoadCatalog = vi.mocked(loadCatalogEntries);
const mockLoadRequests = vi.mocked(loadRequests);

describe('ApiMockImportReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCatalog.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Demo API',
        endpoints: [{ id: 'ep-1', method: 'GET', path: '/demo', summary: 'Demo', parameters: [], responses: [], tags: [] }],
        folders: [],
      },
    ]);
    mockLoadRequests.mockResolvedValue({
      collections: [{
        id: 'col-1',
        name: 'Col',
        mode: 'direct',
        requests: [{
          id: 'req-1',
          name: 'List users',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: [],
          body: '',
          auth: { type: 'none' },
        }],
        folders: [],
      }],
    });
  });

  it('switches import modes and non-curl sources', () => {
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-mode-replace'));
    expect(screen.getByTestId('api-mock-import-mode-replace')).toHaveClass('active');
    expect(screen.getByTestId('api-mock-import-replace-warning')).toHaveTextContent('Replace deletes every existing rule');
    fireEvent.click(screen.getByTestId('api-mock-import-mode-copy'));
    expect(screen.getByTestId('api-mock-import-mode-copy')).toHaveClass('active');
    expect(screen.queryByTestId('api-mock-import-replace-warning')).toBeNull();

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    expect(screen.getByTestId('api-mock-import-paste')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-import-source-native'));
    expect(screen.getByTestId('api-mock-import-paste')).toBeTruthy();
  });

  it('fills native paste from the last export', () => {
    render(
      <ApiMockImportReview
        initialSource="native"
        lastNativeExport='{"_exportMeta":{"kind":"redfireforge-api-mock"},"data":{"scope":"routes","routes":[]}}'
        onImport={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-import-last-export'));
    expect(screen.getByTestId('api-mock-import-paste')).toHaveValue(
      '{"_exportMeta":{"kind":"redfireforge-api-mock"},"data":{"scope":"routes","routes":[]}}',
    );
  });

  it('honors initialSource from the title-bar Import menu', () => {
    render(<ApiMockImportReview initialSource="catalog" onImport={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('api-mock-import-source-catalog')).toHaveClass('active');
  });

  it('parses OpenAPI paste into draft routes', () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), {
      target: {
        value: JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'T', version: '1' },
          paths: { '/widgets': { get: { summary: 'List' } } },
        }),
      },
    });
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    expect(screen.getByTestId('api-mock-import-confirm')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport).toHaveBeenCalled();
    expect(onImport.mock.calls[0][0][0].path.value).toBe('/widgets');
    expect(onImport.mock.calls[0][1]).toEqual({ mode: 'merge' });
  });

  it('loads catalog endpoints and imports selected ones', async () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-import-source-catalog'));
    await waitFor(() => expect(screen.getByTestId('api-mock-import-catalog-list')).toBeTruthy());
    fireEvent.click(screen.getByTestId('api-mock-import-catalog-cat-1:ep-1'));
    fireEvent.click(screen.getByTestId('api-mock-import-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport.mock.calls[0][0][0].path.value).toBe('/demo');
  });

  it('Select all only ticks endpoints that match the catalog filter', async () => {
    mockLoadCatalog.mockResolvedValueOnce([
      {
        id: 'cat-1',
        name: 'Demo API',
        endpoints: [
          { id: 'ep-1', method: 'GET', path: '/demo', summary: 'Demo', parameters: [], responses: [], tags: [] },
          { id: 'ep-2', method: 'POST', path: '/other', summary: 'Other', parameters: [], responses: [], tags: [] },
        ],
        folders: [],
      },
    ]);
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-import-source-catalog'));
    await waitFor(() => expect(screen.getByTestId('api-mock-import-catalog-select-all')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-import-catalog-filter'), { target: { value: '/demo' } });
    fireEvent.click(screen.getByTestId('api-mock-import-catalog-select-all'));
    expect(screen.getByTestId('api-mock-import-catalog-cat-1:ep-1')).toBeChecked();
    expect(screen.queryByTestId('api-mock-import-catalog-cat-1:ep-2')).toBeNull();
  });

  it('Select all only ticks requests that match the collection filter', async () => {
    mockLoadRequests.mockResolvedValueOnce({
      collections: [{
        id: 'col-1',
        name: 'Col',
        mode: 'direct',
        requests: [
          { id: 'req-1', name: 'List users', method: 'GET', url: 'https://api.example.com/users', headers: [], body: '', auth: { type: 'none' } },
          { id: 'req-2', name: 'Ping', method: 'GET', url: 'https://api.example.com/ping', headers: [], body: '', auth: { type: 'none' } },
        ],
        folders: [],
      }],
    });
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-import-source-requests'));
    await waitFor(() => expect(screen.getByTestId('api-mock-import-requests-select-all')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-import-requests-filter'), { target: { value: 'users' } });
    fireEvent.click(screen.getByTestId('api-mock-import-requests-select-all'));
    expect(screen.getByTestId('api-mock-import-request-req-1')).toBeChecked();
    expect(screen.queryByTestId('api-mock-import-request-req-2')).toBeNull();
  });

  it('ignores parse when curl input is blank', () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    expect(screen.queryByTestId('api-mock-import-confirm')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('parses a curl command, shows a preview, and imports the generated route', () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: {
        value: "curl -X POST https://api.example.com/users?active=true -H 'Content-Type: application/json' -H 'X-Tenant: acme' -d '{\"name\":\"Alice\"}'",
      },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));

    expect(screen.getByText('Generated route')).toBeTruthy();
    expect(screen.getAllByText('POST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/users').length).toBeGreaterThan(0);
    expect(screen.getByTestId('api-mock-import-confirm')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport).toHaveBeenCalledTimes(1);
    const imported = onImport.mock.calls[0][0][0];
    expect(imported.method).toBe('POST');
    expect(imported.path.value).toBe('/users');
  });

  it('reapplies destination priority onto an already-parsed preview', async () => {
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-curl-input'), { target: { value: 'curl /users/42' } });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    expect(screen.getByText('P10')).toBeTruthy();
    fireEvent.change(screen.getByTestId('api-mock-import-priority'), { target: { value: '20' } });
    await waitFor(() => expect(screen.getByText('P20')).toBeTruthy());
  });

  it('cancels from the preview state', () => {
    const onCancel = vi.fn();
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), { target: { value: 'curl /users' } });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders diagnostics for unknown methods and invalid json bodies', () => {
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: {
        value: "curl -X FOO https://api.example.com/users -H 'Content-Type: application/json' -d 'not-json'",
      },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));

    expect(screen.getByText('Issues')).toBeTruthy();
    expect(screen.getByText(/Unknown HTTP method/i)).toBeTruthy();
    expect(screen.getByText(/not valid JSON/i)).toBeTruthy();
  });

  it('parses relative paths, data-raw bodies, and header values containing colons', () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: {
        value: "curl /orders?x=1 -H 'X-Trace: a:b:c' --data-raw 'raw-body'",
      },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    const imported = onImport.mock.calls[0][0][0];
    expect(imported.path.value).toBe('/orders');
    expect(imported.responses).toHaveLength(1);
  });

  it('pretty-formats JSON paste on WireMock, native, and HAR sources', () => {
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);
    for (const source of ['wiremock', 'native', 'har'] as const) {
      fireEvent.click(screen.getByTestId(`api-mock-import-source-${source}`));
      fireEvent.change(screen.getByTestId('api-mock-import-paste'), {
        target: { value: '{"mappings":[{"request":{"method":"GET","url":"/x"}}]}' },
      });
      fireEvent.click(screen.getByTestId('api-mock-import-pretty'));
      expect(screen.getByTestId('api-mock-import-paste')).toHaveValue(
        '{\n  "mappings": [\n    {\n      "request": {\n        "method": "GET",\n        "url": "/x"\n      }\n    }\n  ]\n}',
      );
    }
  });

  it('shows an error when pretty-format is clicked on invalid JSON', () => {
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    fireEvent.change(screen.getByTestId('api-mock-import-paste'), { target: { value: 'not-json' } });
    fireEvent.click(screen.getByTestId('api-mock-import-pretty'));
    expect(screen.getByTestId('api-mock-import-pretty-error')).toBeTruthy();
  });
});

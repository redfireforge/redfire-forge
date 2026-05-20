/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CatalogImportModal from './CatalogImportModal';

const platformMocks = vi.hoisted(() => ({ isTauri: false }));

const tauriMocks = vi.hoisted(() => {
  let dragHandler: ((event: { payload: unknown }) => Promise<void>) | null = null;
  const readTextFile = vi.fn();
  const open = vi.fn();
  const getCurrentWebview = vi.fn(() => ({
    onDragDropEvent: vi.fn(async (handler: (event: { payload: unknown }) => Promise<void>) => {
      dragHandler = handler;
      return vi.fn();
    }),
  }));
  return {
    readTextFile,
    open,
    getCurrentWebview,
    async emitDrag(payload: unknown) {
      await dragHandler?.({ payload });
    },
    reset() {
      dragHandler = null;
      readTextFile.mockReset();
      open.mockReset();
      getCurrentWebview.mockClear();
    },
  };
});

vi.mock('../../../shared/components/FullPanelModal', () => ({
  default: ({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) => (
    <div data-testid="full-panel-modal">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      <div data-testid="modal-footer">{footer}</div>
    </div>
  ),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => platformMocks.isTauri,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => tauriMocks.getCurrentWebview(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: (...args: unknown[]) => tauriMocks.readTextFile(...args),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => tauriMocks.open(...args),
}));

vi.mock('../utils/openApiParser', () => ({
  parseOpenApiSpec: vi.fn(async (text: string) => {
    if (text.includes('invalid')) throw new Error('Parse error');
    return {
      entry: {
        id: 'spec-1',
        name: 'Test API',
        description: 'A test API',
        versions: [{ specHash: 'hash-123', version: '1.0.0', endpoints: [], importedAt: Date.now() }],
        endpoints: [
          { id: 'e1', path: '/users', method: 'GET', summary: 'List users' },
          { id: 'e2', path: '/users/{id}', method: 'GET', summary: 'Get user' },
        ],
        folders: [{ id: 'f1', name: 'Users', endpoints: [{ id: 'e1' }, { id: 'e2' }] }],
        servers: [{ url: 'https://api.example.com', description: 'Production' }],
        securitySchemes: {},
      },
      rawSpec: text,
      warnings: [],
    };
  }),
  getSpecFormatLabel: vi.fn(() => 'OpenAPI 3.0'),
  countEndpoints: vi.fn(() => 2),
}));

vi.mock('../../../data/galleries/catalog-specs', () => ({
  catalogSpecCatalog: [
    { id: 'sample-1', name: 'PetStore', description: 'Pet API', icon: '🐕', category: 'rest', specYaml: 'openapi: 3.0\ninfo:\n  title: PetStore', endpointCount: 5 },
    { id: 'sample-2', name: 'JSONPlaceholder', description: 'Fake REST', icon: '📦', category: 'mock', specYaml: 'openapi: 3.0\ninfo:\n  title: JSONPlaceholder', endpointCount: 3 },
  ],
  CATALOG_SPEC_CATEGORIES: [
    { key: 'all', label: 'All' },
    { key: 'rest', label: 'REST' },
    { key: 'mock', label: 'Mock' },
  ],
}));

const httpClientMocks = vi.hoisted(() => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: (...args: unknown[]) => httpClientMocks.httpFetch(...args),
}));

describe('CatalogImportModal', () => {
  const defaultProps = {
    existingEntries: [],
    onImport: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    platformMocks.isTauri = false;
    tauriMocks.reset();
    tauriMocks.readTextFile.mockResolvedValue('openapi: 3.0\ninfo:\n  title: TauriSpec');
    httpClientMocks.httpFetch.mockReset();
  });

  afterEach(() => {
    platformMocks.isTauri = false;
  });

  describe('URL import', () => {
    it('switches to URL tab and shows input field', () => {
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      expect(screen.getByPlaceholderText(/https:\/\/api\.example\.com/)).toBeInTheDocument();
      expect(screen.getByText('Fetch')).toBeInTheDocument();
    });

    it('shows Fetch button disabled when URL input is empty', () => {
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      expect(screen.getByText('Fetch')).toBeDisabled();
    });

    it('enables Fetch button when URL is entered', () => {
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/spec.yaml' } });
      expect(screen.getByText('Fetch')).not.toBeDisabled();
    });

    it('fetches and parses spec from URL successfully', async () => {
      httpClientMocks.httpFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'openapi: 3.0\ninfo:\n  title: UrlAPI',
      });
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/openapi.yaml' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText('Import')).toBeInTheDocument();
      });
      expect(httpClientMocks.httpFetch).toHaveBeenCalledWith(
        'https://example.com/openapi.yaml',
        'GET',
        expect.objectContaining({ 'Accept': expect.stringContaining('application/json') }),
      );
    });

    it('shows error when HTTP fetch returns error', async () => {
      httpClientMocks.httpFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '',
        error: 'Network error',
      });
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/spec.yaml' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('shows error when HTTP response is 404', async () => {
      httpClientMocks.httpFetch.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        headers: {},
        body: '',
      });
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/missing.yaml' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
      });
    });

    it('shows error when fetch throws exception', async () => {
      httpClientMocks.httpFetch.mockRejectedValue(new Error('Connection refused'));
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/spec.yaml' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
      });
    });

    it('shows Fetching... text while loading', async () => {
      let resolvePromise: (value: unknown) => void;
      httpClientMocks.httpFetch.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/spec.yaml' } });
      fireEvent.click(screen.getByText('Fetch'));
      expect(screen.getByText('Fetching...')).toBeInTheDocument();
      expect(urlInput).toBeDisabled();
      resolvePromise!({ status: 200, statusText: 'OK', headers: {}, body: 'openapi: 3.0' });
      await waitFor(() => {
        expect(screen.queryByText('Fetching...')).not.toBeInTheDocument();
      });
    });

    it('handles Enter key to trigger fetch', async () => {
      httpClientMocks.httpFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'openapi: 3.0\ninfo:\n  title: EnterAPI',
      });
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/spec.yaml' } });
      fireEvent.keyDown(urlInput, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByText('Import')).toBeInTheDocument();
      });
    });

    it('does not trigger fetch on Enter with empty URL', () => {
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.keyDown(urlInput, { key: 'Enter' });
      expect(httpClientMocks.httpFetch).not.toHaveBeenCalled();
    });

    it('shows example buttons that populate URL input', () => {
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      fireEvent.click(screen.getByText('Petstore v3'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/) as HTMLInputElement;
      expect(urlInput.value).toBe('https://petstore3.swagger.io/api/v3/openapi.json');
    });

    it('extracts filename from URL for display', async () => {
      httpClientMocks.httpFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'openapi: 3.0\ninfo:\n  title: MyAPI',
      });
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/path/to/openapi.json' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText(/openapi\.json/)).toBeInTheDocument();
      });
    });

    it('uses fallback filename when URL has no filename', async () => {
      httpClientMocks.httpFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'openapi: 3.0\ninfo:\n  title: NoFileAPI',
      });
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText(/spec-from-url\.yaml/)).toBeInTheDocument();
      });
    });

    it('strips query params from filename', async () => {
      httpClientMocks.httpFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'openapi: 3.0\ninfo:\n  title: QueryAPI',
      });
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/spec.yaml?token=abc' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText(/spec\.yaml/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/token=abc/)).not.toBeInTheDocument();
    });

    it('handles non-Error throws from fetch', async () => {
      httpClientMocks.httpFetch.mockRejectedValue('plain string error');
      render(<CatalogImportModal {...defaultProps} />);
      fireEvent.click(screen.getByText('From URL'));
      const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com/);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/spec.yaml' } });
      fireEvent.click(screen.getByText('Fetch'));
      await waitFor(() => {
        expect(screen.getByText('plain string error')).toBeInTheDocument();
      });
    });
  });
});

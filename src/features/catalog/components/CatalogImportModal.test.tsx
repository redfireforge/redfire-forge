/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
  });

  afterEach(() => {
    platformMocks.isTauri = false;
  });

  it('renders import title', () => {
    render(<CatalogImportModal {...defaultProps} />);
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Import OpenAPI Specification');
  });

  it('renders reimport title when reimportEntryId provided', () => {
    render(<CatalogImportModal {...defaultProps} reimportEntryId="existing-1" />);
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Re-import / Update Specification');
  });

  it('shows tab buttons', () => {
    render(<CatalogImportModal {...defaultProps} />);
    expect(screen.getByText('Upload File')).toBeInTheDocument();
    expect(screen.getByText('Paste YAML / JSON')).toBeInTheDocument();
    expect(screen.getByText('Sample Gallery')).toBeInTheDocument();
  });

  it('shows file drop zone by default', () => {
    render(<CatalogImportModal {...defaultProps} />);
    expect(screen.getByText(/Drag & drop/)).toBeInTheDocument();
  });

  it('switches to paste tab', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    expect(screen.getByPlaceholderText(/Paste your OpenAPI/)).toBeInTheDocument();
  });

  it('shows Parse button disabled when empty', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    expect(screen.getByText('Parse')).toBeDisabled();
  });

  it('enables Parse button when text pasted', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    const textarea = screen.getByPlaceholderText(/Paste your OpenAPI/);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0' } });
    expect(screen.getByText('Parse')).not.toBeDisabled();
  });

  it('parses pasted spec and shows preview', async () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    const textarea = screen.getByPlaceholderText(/Paste your OpenAPI/);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0\ninfo:\n  title: TestAPI' } });
    fireEvent.click(screen.getByText('Parse'));

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  it('shows error step when parsing fails', async () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    const textarea = screen.getByPlaceholderText(/Paste your OpenAPI/);
    fireEvent.change(textarea, { target: { value: 'invalid spec content' } });
    fireEvent.click(screen.getByText('Parse'));

    await waitFor(() => {
      expect(screen.getByText(/Parse error/)).toBeInTheDocument();
    });
  });

  it('switches to gallery tab and shows specs', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    expect(screen.getByText('PetStore')).toBeInTheDocument();
    expect(screen.getByText('JSONPlaceholder')).toBeInTheDocument();
  });

  it('filters gallery by search', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const searchInput = screen.getByPlaceholderText('Search sample APIs...');
    fireEvent.change(searchInput, { target: { value: 'pet' } });
    expect(screen.getByText('PetStore')).toBeInTheDocument();
    expect(screen.queryByText('JSONPlaceholder')).not.toBeInTheDocument();
  });

  it('calls onClose when Close button clicked on pick step', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('auto-parses initialSpec', async () => {
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  it('calls onImport when Import clicked', async () => {
    const onImport = vi.fn();
    render(<CatalogImportModal {...defaultProps} onImport={onImport} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Import'));
    expect(onImport).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows Browse Files button in web mode', () => {
    render(<CatalogImportModal {...defaultProps} />);
    expect(screen.getByText('Browse Files')).toBeInTheDocument();
  });

  it('handles drag and drop of a file', async () => {
    const onImport = vi.fn();
    render(<CatalogImportModal {...defaultProps} onImport={onImport} />);
    const dropzone = screen.getByText(/Drag & drop/).closest('.cat-import-dropzone')!;
    const file = new File(['openapi: 3.0\ninfo:\n  title: DropAPI'], 'drop.yaml', { type: 'text/yaml' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('openapi: 3.0\ninfo:\n  title: DropAPI') });
    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  it('handles file input change', async () => {
    render(<CatalogImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['openapi: 3.0\ninfo:\n  title: InputAPI'], 'input.yaml', { type: 'text/yaml' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('openapi: 3.0\ninfo:\n  title: InputAPI') });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  it('shows Back button on preview step and returns to pick', async () => {
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('shows Back button on error step and returns to pick', async () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    const textarea = screen.getByPlaceholderText(/Paste your OpenAPI/);
    fireEvent.change(textarea, { target: { value: 'invalid spec content' } });
    fireEvent.click(screen.getByText('Parse'));
    await waitFor(() => {
      expect(screen.getByText(/Parse error/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('shows preview details (title, version, description, servers, endpoints)', async () => {
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Test API')).toBeInTheDocument();
    });
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('A test API')).toBeInTheDocument();
    expect(screen.getByText(/api\.example\.com/)).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('shows "Update" button when existing entry has different hash', async () => {
    const existingEntries = [{
      id: 'spec-1',
      name: 'Test API',
      description: '',
      versions: [{ specHash: 'different-hash', version: '0.9.0', endpoints: [], importedAt: Date.now() }],
      endpoints: [],
      folders: [],
      servers: [],
      securitySchemes: {},
    }];
    render(<CatalogImportModal {...defaultProps} existingEntries={existingEntries} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
  });

  it('shows "Import Anyway" button when existing entry has same hash', async () => {
    const existingEntries = [{
      id: 'spec-1',
      name: 'Test API',
      description: '',
      versions: [{ specHash: 'hash-123', version: '1.0.0', endpoints: [], importedAt: Date.now() }],
      endpoints: [],
      folders: [],
      servers: [],
      securitySchemes: {},
    }];
    render(<CatalogImportModal {...defaultProps} existingEntries={existingEntries} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Import Anyway')).toBeInTheDocument();
    });
    expect(screen.getByText(/No changes detected/)).toBeInTheDocument();
  });

  it('calls onReimport when reimportEntryId matches', async () => {
    const onReimport = vi.fn();
    const existingEntries = [{
      id: 'existing-1',
      name: 'Test API',
      description: '',
      versions: [{ specHash: 'different-hash', version: '0.9.0', endpoints: [], importedAt: Date.now() }],
      endpoints: [],
      folders: [],
      servers: [],
      securitySchemes: {},
    }];
    render(<CatalogImportModal {...defaultProps} existingEntries={existingEntries} onReimport={onReimport} reimportEntryId="existing-1" initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Update'));
    expect(onReimport).toHaveBeenCalledWith('existing-1', expect.objectContaining({ entry: expect.any(Object) }));
  });

  it('gallery card triggers parse', async () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    fireEvent.click(screen.getByText('PetStore'));
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  it('gallery category filter works', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    fireEvent.click(screen.getByText('REST'));
    expect(screen.getByText('PetStore')).toBeInTheDocument();
    expect(screen.queryByText('JSONPlaceholder')).not.toBeInTheDocument();
  });

  it('gallery shows empty message when no match', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const searchInput = screen.getByPlaceholderText('Search sample APIs...');
    fireEvent.change(searchInput, { target: { value: 'nonexistentxyz' } });
    expect(screen.getByText(/No samples match/)).toBeInTheDocument();
  });

  it('shows security schemes in preview', async () => {
    const { parseOpenApiSpec } = await import('../utils/openApiParser');
    (parseOpenApiSpec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entry: {
        id: 'spec-sec',
        name: 'Secure API',
        description: '',
        versions: [{ specHash: 'hash-sec', version: '2.0.0', endpoints: [], importedAt: Date.now() }],
        endpoints: [],
        folders: [{ id: 'f1', name: 'Auth', endpoints: [{ id: 'e1' }] }],
        servers: [],
        securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer' } },
      },
      rawSpec: 'openapi: 3.0',
      warnings: [],
    });
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'secure.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText(/BearerAuth/)).toBeInTheDocument();
    });
    expect(screen.getByText(/http.*bearer/)).toBeInTheDocument();
  });

  it('shows warnings in preview', async () => {
    const { parseOpenApiSpec } = await import('../utils/openApiParser');
    (parseOpenApiSpec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entry: {
        id: 'spec-warn',
        name: 'Warn API',
        description: '',
        versions: [{ specHash: 'hash-w', version: '1.0.0', endpoints: [], importedAt: Date.now() }],
        endpoints: [],
        folders: [],
        servers: [],
        securitySchemes: {},
      },
      rawSpec: 'openapi: 3.0',
      warnings: ['Missing description for /users', 'Unused schema Foo'],
    });
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'warn.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText(/2 warnings/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Missing description/)).toBeInTheDocument();
  });

  it('shows error step with filename', async () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    const textarea = screen.getByPlaceholderText(/Paste your OpenAPI/);
    fireEvent.change(textarea, { target: { value: 'invalid spec' } });
    fireEvent.click(screen.getByText('Parse'));
    await waitFor(() => {
      expect(screen.getByText(/Invalid specification/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Please fix the specification/)).toBeInTheDocument();
  });

  it('shows untagged endpoints count in preview', async () => {
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
    expect(screen.getByText('(untagged)')).toBeInTheDocument();
  });

  it('does not parse paste when text is empty', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    // Parse button is disabled for empty — verify no crash
    const btn = screen.getByText('Parse');
    expect(btn).toBeDisabled();
  });

  it('handles file input with no files selected', () => {
    render(<CatalogImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: null } });
    // Should stay on pick step
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('handles drop with no file', () => {
    render(<CatalogImportModal {...defaultProps} />);
    const dropzone = screen.getByText(/Drag & drop/).closest('.cat-import-dropzone')!;
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });
    // Should stay on pick step
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('calls onImport by name match when no reimportEntryId', async () => {
    const onImport = vi.fn();
    const onReimport = vi.fn();
    const existingEntries = [{
      id: 'spec-existing',
      name: 'Test API',
      description: '',
      versions: [{ specHash: 'old-hash', version: '0.8.0', endpoints: [], importedAt: Date.now() }],
      endpoints: [],
      folders: [],
      servers: [],
      securitySchemes: {},
    }];
    render(<CatalogImportModal {...defaultProps} existingEntries={existingEntries} onImport={onImport} onReimport={onReimport} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Update'));
    expect(onReimport).toHaveBeenCalledWith('spec-existing', expect.any(Object));
  });

  it('shows OpenAPI format label in preview', async () => {
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText(/Valid.*OpenAPI 3\.0.*specification/)).toBeInTheDocument();
    });
  });

  it('shows filename in preview step', async () => {
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'my-api.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText(/my-api\.yaml/)).toBeInTheDocument();
    });
  });

  it('Tauri: Browse Files opens dialog and imports selected path', async () => {
    platformMocks.isTauri = true;
    tauriMocks.open.mockResolvedValue('/Users/test/spec.yaml');
    render(<CatalogImportModal {...defaultProps} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText('Browse Files'));
    await waitFor(() => {
      expect(tauriMocks.open).toHaveBeenCalled();
    });
    expect(tauriMocks.readTextFile).toHaveBeenCalledWith('/Users/test/spec.yaml');
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  it('Tauri: Browse Files no-op when dialog returns no path', async () => {
    platformMocks.isTauri = true;
    tauriMocks.open.mockResolvedValue(null);
    render(<CatalogImportModal {...defaultProps} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText('Browse Files'));
    await waitFor(() => {
      expect(tauriMocks.open).toHaveBeenCalled();
    });
    expect(tauriMocks.readTextFile).not.toHaveBeenCalled();
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('Tauri: Browse Files swallows dialog errors', async () => {
    platformMocks.isTauri = true;
    tauriMocks.open.mockRejectedValue(new Error('cancelled'));
    render(<CatalogImportModal {...defaultProps} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Browse Files'));
    });
    await waitFor(() => {
      expect(tauriMocks.open).toHaveBeenCalled();
    });
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  async function flushTauriDragRegistration() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('Tauri: drag enter/over/leave toggles dropzone hint', async () => {
    platformMocks.isTauri = true;
    render(<CatalogImportModal {...defaultProps} />);
    await flushTauriDragRegistration();
    await act(async () => {
      await tauriMocks.emitDrag({ type: 'enter' });
    });
    expect(screen.getByText('Drop file here')).toBeInTheDocument();
    await act(async () => {
      await tauriMocks.emitDrag({ type: 'over' });
    });
    expect(screen.getByText('Drop file here')).toBeInTheDocument();
    await act(async () => {
      await tauriMocks.emitDrag({ type: 'leave' });
    });
    expect(screen.getByText(/Drag & drop/)).toBeInTheDocument();
  });

  it('Tauri: drop ignores empty path and wrong extension', async () => {
    platformMocks.isTauri = true;
    render(<CatalogImportModal {...defaultProps} />);
    await flushTauriDragRegistration();
    await act(async () => {
      await tauriMocks.emitDrag({ type: 'drop', paths: [] });
    });
    expect(tauriMocks.readTextFile).not.toHaveBeenCalled();
    await act(async () => {
      await tauriMocks.emitDrag({ type: 'drop', paths: ['/file.txt'] });
    });
    expect(tauriMocks.readTextFile).not.toHaveBeenCalled();
  });

  it('Tauri: drop reads yaml and shows preview (unix path)', async () => {
    platformMocks.isTauri = true;
    render(<CatalogImportModal {...defaultProps} />);
    await flushTauriDragRegistration();
    await act(async () => {
      await tauriMocks.emitDrag({ type: 'drop', paths: ['/path/to/api.yaml'] });
    });
    expect(tauriMocks.readTextFile).toHaveBeenCalledWith('/path/to/api.yaml');
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
    expect(screen.getByText(/api\.yaml/)).toBeInTheDocument();
  });

  it('Tauri: drop accepts json extension and windows-style path', async () => {
    platformMocks.isTauri = true;
    render(<CatalogImportModal {...defaultProps} />);
    await flushTauriDragRegistration();
    await act(async () => {
      await tauriMocks.emitDrag({ type: 'drop', paths: ['C:\\docs\\spec.json'] });
    });
    expect(tauriMocks.readTextFile).toHaveBeenCalledWith('C:\\docs\\spec.json');
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  it('web: Browse Files triggers hidden file input click', () => {
    const spy = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Browse Files'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns to Upload File tab from gallery', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    expect(screen.getByText('PetStore')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Upload File'));
    expect(screen.getByText(/Drag & drop/)).toBeInTheDocument();
  });

  it('filters gallery by description text', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const searchInput = screen.getByPlaceholderText('Search sample APIs...');
    fireEvent.change(searchInput, { target: { value: 'Fake REST' } });
    expect(screen.getByText('JSONPlaceholder')).toBeInTheDocument();
    expect(screen.queryByText('PetStore')).not.toBeInTheDocument();
  });

  it('parse error uses String(err) for non-Error throws', async () => {
    const { parseOpenApiSpec } = await import('../utils/openApiParser');
    (parseOpenApiSpec as ReturnType<typeof vi.fn>).mockRejectedValueOnce('plain string failure');
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Paste YAML / JSON'));
    fireEvent.change(screen.getByPlaceholderText(/Paste your OpenAPI/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Parse'));
    await waitFor(() => {
      expect(screen.getByText('plain string failure')).toBeInTheDocument();
    });
  });

  it('preview: server row without description omits desc span', async () => {
    const { parseOpenApiSpec } = await import('../utils/openApiParser');
    (parseOpenApiSpec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entry: {
        id: 'spec-srv',
        name: 'Srv API',
        description: '',
        versions: [{ specHash: 'h-srv', version: '1.0.0', endpoints: [], importedAt: Date.now() }],
        endpoints: [],
        folders: [],
        servers: [{ url: 'https://nodesc.example.com' }],
        securitySchemes: {},
      },
      rawSpec: 'openapi: 3.0',
      warnings: [],
    });
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'x.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText(/nodesc\.example\.com/)).toBeInTheDocument();
    });
  });

  it('preview: single warning uses singular label', async () => {
    const { parseOpenApiSpec } = await import('../utils/openApiParser');
    (parseOpenApiSpec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entry: {
        id: 'spec-1w',
        name: 'One Warn',
        description: '',
        versions: [{ specHash: 'h1', version: '1.0.0', endpoints: [], importedAt: Date.now() }],
        endpoints: [],
        folders: [],
        servers: [],
        securitySchemes: {},
      },
      rawSpec: 'openapi: 3.0',
      warnings: ['Only one'],
    });
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'w.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText(/1 warning:/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/2 warnings/)).not.toBeInTheDocument();
  });

  it('preview: security scheme without scheme field omits slash segment', async () => {
    const { parseOpenApiSpec } = await import('../utils/openApiParser');
    (parseOpenApiSpec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entry: {
        id: 'spec-key',
        name: 'Key API',
        description: '',
        versions: [{ specHash: 'hk', version: '1.0.0', endpoints: [], importedAt: Date.now() }],
        endpoints: [],
        folders: [],
        servers: [],
        securitySchemes: { ApiKeyAuth: { type: 'apiKey' } },
      },
      rawSpec: 'openapi: 3.0',
      warnings: [],
    });
    render(<CatalogImportModal {...defaultProps} initialSpec={{ yaml: 'openapi: 3.0', name: 'k.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText(/ApiKeyAuth \(apiKey\)/)).toBeInTheDocument();
    });
  });

  it('calls onImport when duplicate exists but onReimport is omitted', async () => {
    const onImport = vi.fn();
    const existingEntries = [{
      id: 'spec-existing',
      name: 'Test API',
      description: '',
      versions: [{ specHash: 'old-hash', version: '0.8.0', endpoints: [], importedAt: Date.now() }],
      endpoints: [],
      folders: [],
      servers: [],
      securitySchemes: {},
    }];
    render(<CatalogImportModal {...defaultProps} existingEntries={existingEntries} onImport={onImport} initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }} />);
    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Update'));
    expect(onImport).toHaveBeenCalled();
  });

  it('uses onImport when reimportEntryId does not match any entry', async () => {
    const onImport = vi.fn();
    const onReimport = vi.fn();
    render(
      <CatalogImportModal
        {...defaultProps}
        onImport={onImport}
        onReimport={onReimport}
        reimportEntryId="missing-id"
        initialSpec={{ yaml: 'openapi: 3.0', name: 'test.yaml' }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Import'));
    expect(onImport).toHaveBeenCalled();
    expect(onReimport).not.toHaveBeenCalled();
  });

  it('Tauri: drag-drop registration failure is swallowed', async () => {
    platformMocks.isTauri = true;
    tauriMocks.getCurrentWebview.mockImplementationOnce(() => {
      throw new Error('webview unavailable');
    });
    render(<CatalogImportModal {...defaultProps} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('unmount cleans up Tauri drag listener', async () => {
    platformMocks.isTauri = true;
    const unlisten = vi.fn();
    tauriMocks.getCurrentWebview.mockReturnValueOnce({
      onDragDropEvent: vi.fn(async () => unlisten),
    });
    const { unmount } = render(<CatalogImportModal {...defaultProps} />);
    await flushTauriDragRegistration();
    unmount();
    expect(unlisten).toHaveBeenCalled();
  });
});

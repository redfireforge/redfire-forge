/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import type { CatalogEntry } from '../../features/catalog/types/catalog';
import { useCatalogState } from './useCatalogState';

vi.mock('../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../features/catalog/utils/swaggerToOpenApi', () => ({
  detectSpecFormat: vi.fn(),
  availableTargets: vi.fn(),
  convertSwaggerToOpenApiYaml: vi.fn(),
}));

vi.mock('../../features/catalog/utils/openApiParser', () => ({
  parseOpenApiSpec: vi.fn(),
}));

import { saveFile } from '@shared/utils/fileSaver';
import {
  detectSpecFormat,
  availableTargets,
  convertSwaggerToOpenApiYaml,
  type SpecFormat,
  type ConvertTarget,
} from '../../features/catalog/utils/swaggerToOpenApi';
import { parseOpenApiSpec } from '../../features/catalog/utils/openApiParser';
import type { ParsedSpec } from '../../features/catalog/types/catalog';

/** Point the mocked format detector + target lister at a given source shape. */
function mockFormat(format: SpecFormat, targets: ConvertTarget[]) {
  vi.mocked(detectSpecFormat).mockReturnValue(format);
  vi.mocked(availableTargets).mockReturnValue(targets);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeCatalog(entry?: CatalogEntry): UseCatalogReturn {
  const e = entry ?? {
    id: 'e1',
    name: 'My Service / Prod',
    currentVersionId: 'vcur',
    microserviceId: 'ms',
    servers: [{ url: 'https://api.example.com' }],
    serversByVersion: {},
    versions: [{ id: 'vcur', version: '1.2.3', importedAt: 0 }],
  };
  return {
    entries: [e],
    selectedEntry: e,
    setSelectedEntryId: vi.fn(),
    loading: false,
    error: null,
    reload: vi.fn(),
    addEntry: vi.fn(),
    addVersionToEntry: vi.fn(),
    updateEntry: vi.fn(),
    removeEntry: vi.fn(),
    switchVersion: vi.fn(),
    loadRawSpec: vi.fn(),
  } as unknown as UseCatalogReturn;
}

describe('useCatalogState', () => {
  it('starts with falsy modal and editor flags', () => {
    const { result } = renderHook(() => useCatalogState(makeCatalog()));

    expect(result.current.showCatalogImport).toBe(false);
    expect(result.current.catalogReimportId).toBeUndefined();
    expect(result.current.catalogInitialSpec).toBeUndefined();
    expect(result.current.catalogVersionHistoryId).toBeUndefined();
    expect(result.current.catalogEditId).toBeUndefined();
  });

  it('calls loadRawSpec and saveFile with sanitized filename when exporting', async () => {
    const loadRawSpec = vi.fn().mockResolvedValue('openapi: 3.0\n');
    const catalog = makeCatalog();
    catalog.loadRawSpec = loadRawSpec;

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('e1');
    });

    expect(loadRawSpec).toHaveBeenCalledWith('e1', 'vcur');
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [, opts] = vi.mocked(saveFile).mock.calls[0];
    expect(opts.filename).toBe('My_Service___Prod-v1.2.3.yaml');
    expect(opts.mimeType).toBe('text/yaml');
  });

  it('does nothing on export when entry is missing', async () => {
    const catalog = makeCatalog();
    catalog.entries = [];
    const loadRawSpec = vi.fn();
    catalog.loadRawSpec = loadRawSpec;

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('missing');
    });

    expect(loadRawSpec).not.toHaveBeenCalled();
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('does not save when loadRawSpec returns empty', async () => {
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('e1');
    });

    expect(saveFile).not.toHaveBeenCalled();
  });

  it('uses unknown in filename when versions array is empty', async () => {
    const catalog = makeCatalog();
    const entry = catalog.entries[0] as CatalogEntry;
    entry.versions = [];
    catalog.loadRawSpec = vi.fn().mockResolvedValue('x');

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('e1');
    });

    expect(vi.mocked(saveFile).mock.calls[0]?.[1]?.filename).toMatch(/unknown\.yaml$/);
  });
});

describe('useCatalogState.handleConvertToOpenApi (opens modal)', () => {
  it('opens the convert modal with the loaded raw spec for a Swagger 2 entry', async () => {
    mockFormat('swagger2', ['3.0', '3.1']);
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue("swagger: '2.0'");

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    expect(result.current.catalogConvert).toBeUndefined();

    await act(async () => {
      await result.current.handleConvertToOpenApi('e1');
    });

    expect(catalog.loadRawSpec).toHaveBeenCalledWith('e1', 'vcur');
    expect(result.current.catalogConvert).toEqual({
      entryId: 'e1',
      specName: 'My Service / Prod',
      rawSpec: "swagger: '2.0'",
    });
    expect(saveFile).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('opens the upgrade modal for an OpenAPI 3.0 entry (has forward targets)', async () => {
    mockFormat('oas30', ['3.1', '3.2']);
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue('openapi: 3.0.4');

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleConvertToOpenApi('e1');
    });

    expect(result.current.catalogConvert).toEqual({
      entryId: 'e1',
      specName: 'My Service / Prod',
      rawSpec: 'openapi: 3.0.4',
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('no-ops with an OpenAPI-3.2 info toast when the spec is already the latest target', async () => {
    mockFormat('oas32', []);
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue('openapi: 3.2.0');

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleConvertToOpenApi('e1');
    });

    expect(result.current.catalogConvert).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith('info', 'Nothing to convert', expect.stringContaining('already OpenAPI 3.2'));
  });

  it('no-ops with a generic info toast for an unsupported/unknown spec', async () => {
    mockFormat('unknown', []);
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue('not a spec');

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleConvertToOpenApi('e1');
    });

    expect(result.current.catalogConvert).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith('info', 'Nothing to convert', expect.stringContaining('cannot be converted'));
  });

  it('toasts an error (and no modal) when the raw spec cannot be loaded', async () => {
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleConvertToOpenApi('e1');
    });

    expect(result.current.catalogConvert).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith('error', 'Convert failed', expect.any(String));
  });

  it('does nothing when the entry is missing', async () => {
    const catalog = makeCatalog();
    catalog.entries = [];
    const loadRawSpec = vi.fn();
    catalog.loadRawSpec = loadRawSpec;

    const { result } = renderHook(() => useCatalogState(catalog));
    await act(async () => {
      await result.current.handleConvertToOpenApi('missing');
    });

    expect(loadRawSpec).not.toHaveBeenCalled();
    expect(result.current.catalogConvert).toBeUndefined();
  });

  it('setCatalogConvert clears the open modal target', async () => {
    mockFormat('swagger2', ['3.0', '3.1']);
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue("swagger: '2.0'");

    const { result } = renderHook(() => useCatalogState(catalog, { showToast: vi.fn() }));
    await act(async () => {
      await result.current.handleConvertToOpenApi('e1');
    });
    expect(result.current.catalogConvert).toBeDefined();

    act(() => { result.current.setCatalogConvert(undefined); });
    expect(result.current.catalogConvert).toBeUndefined();
  });
});

function makeParsedSpec(): ParsedSpec {
  return {
    entry: {
      versions: [{ id: 'nv', version: '1.2.3', importedAt: 1, specHash: 'h', specSize: 42 }],
      endpoints: [],
      folders: [],
      servers: [],
      securitySchemes: {},
    },
    rawSpec: 'openapi: 3.0.4\n',
    warnings: [],
  } as unknown as ParsedSpec;
}

const SAVE_ARGS = { yaml: 'openapi: 3.0.4\n', openapiVersion: '3.0.4', engineUsed: 'swagger2openapi' as const, mode: 'convert' as const };

describe('useCatalogState.handleSaveConvertedVersion (save as new version)', () => {
  it('parses, tags a changelog, adds the version, clears the modal, and toasts success', async () => {
    mockFormat('swagger2', ['3.0', '3.1']);
    const parsed = makeParsedSpec();
    vi.mocked(parseOpenApiSpec).mockResolvedValue(parsed);
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue("swagger: '2.0'");

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    // Open the modal first so we can assert it gets cleared on save.
    await act(async () => { await result.current.handleConvertToOpenApi('e1'); });
    expect(result.current.catalogConvert).toBeDefined();

    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', SAVE_ARGS);
    });

    expect(parseOpenApiSpec).toHaveBeenCalledWith('openapi: 3.0.4\n');
    expect(parsed.entry.versions[0].changelog).toBe('Converted Swagger 2.0 → OpenAPI 3.0.4 (swagger2openapi)');
    expect(catalog.addVersionToEntry).toHaveBeenCalledWith('e1', parsed);
    expect(result.current.catalogConvert).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith(
      'success',
      'Saved OpenAPI 3.0.4 as new version',
      'My Service / Prod',
    );
  });

  it('appends a prune note when the entry is already at MAX_VERSIONS', async () => {
    const parsed = makeParsedSpec();
    vi.mocked(parseOpenApiSpec).mockResolvedValue(parsed);
    const showToast = vi.fn();
    const catalog = makeCatalog();
    const entry = catalog.entries[0] as CatalogEntry;
    entry.versions = Array.from({ length: 10 }, (_, i) => ({
      id: `v${i}`, version: `1.0.${i}`, importedAt: i, specHash: 'h', specSize: 1,
    }));

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', SAVE_ARGS);
    });

    expect(catalog.addVersionToEntry).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      'success',
      'Saved OpenAPI 3.0.4 as new version',
      expect.stringContaining('oldest version pruned (max 10)'),
    );
  });

  it('toasts a Save failed error and does not add a version when parsing throws', async () => {
    vi.mocked(parseOpenApiSpec).mockRejectedValue(new Error('bad yaml'));
    const showToast = vi.fn();
    const catalog = makeCatalog();

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', SAVE_ARGS);
    });

    expect(showToast).toHaveBeenCalledWith('error', 'Save failed', 'bad yaml');
    expect(catalog.addVersionToEntry).not.toHaveBeenCalled();
  });

  it('stringifies a non-Error parse rejection', async () => {
    vi.mocked(parseOpenApiSpec).mockRejectedValue('boom');
    const showToast = vi.fn();
    const catalog = makeCatalog();

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', SAVE_ARGS);
    });

    expect(showToast).toHaveBeenCalledWith('error', 'Save failed', 'boom');
    expect(catalog.addVersionToEntry).not.toHaveBeenCalled();
  });

  it('toasts when the parsed spec produces no version metadata', async () => {
    vi.mocked(parseOpenApiSpec).mockResolvedValue({
      entry: { versions: [] },
      rawSpec: '',
      warnings: [],
    } as unknown as ParsedSpec);
    const showToast = vi.fn();
    const catalog = makeCatalog();

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', SAVE_ARGS);
    });

    expect(showToast).toHaveBeenCalledWith('error', 'Save failed', 'Converted spec produced no version metadata');
    expect(catalog.addVersionToEntry).not.toHaveBeenCalled();
  });

  it('does nothing when the entry is missing', async () => {
    vi.mocked(parseOpenApiSpec).mockResolvedValue(makeParsedSpec());
    const catalog = makeCatalog();
    catalog.entries = [];

    const { result } = renderHook(() => useCatalogState(catalog, { showToast: vi.fn() }));
    await act(async () => {
      await result.current.handleSaveConvertedVersion('missing', SAVE_ARGS);
    });

    expect(parseOpenApiSpec).not.toHaveBeenCalled();
    expect(catalog.addVersionToEntry).not.toHaveBeenCalled();
  });

  it('tags an upgrade changelog when mode is "upgrade"', async () => {
    mockFormat('oas30', ['3.1', '3.2']);
    const parsed = makeParsedSpec();
    vi.mocked(parseOpenApiSpec).mockResolvedValue(parsed);
    const showToast = vi.fn();
    const catalog = makeCatalog();

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', {
        yaml: 'openapi: 3.1.1\n', openapiVersion: '3.1.1', engineUsed: 'scalar', mode: 'upgrade',
      });
    });

    expect(parsed.entry.versions[0].changelog).toBe('Upgraded to OpenAPI 3.1.1 (scalar)');
    expect(showToast).toHaveBeenCalledWith('success', 'Saved OpenAPI 3.1.1 as new version', 'My Service / Prod');
  });

  it('toasts and keeps the modal open when addVersionToEntry fails', async () => {
    mockFormat('swagger2', ['3.0', '3.1']);
    vi.mocked(parseOpenApiSpec).mockResolvedValue(makeParsedSpec());
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue("swagger: '2.0'");
    catalog.addVersionToEntry = vi.fn().mockRejectedValue(new Error('disk full'));

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => { await result.current.handleConvertToOpenApi('e1'); });
    expect(result.current.catalogConvert).toBeDefined();

    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', SAVE_ARGS);
    });

    expect(showToast).toHaveBeenLastCalledWith('error', 'Save failed', 'disk full');
    // Modal stays open so the user can retry.
    expect(result.current.catalogConvert).toBeDefined();
  });

  it('stringifies a non-Error addVersionToEntry rejection', async () => {
    vi.mocked(parseOpenApiSpec).mockResolvedValue(makeParsedSpec());
    const showToast = vi.fn();
    const catalog = makeCatalog();
    catalog.addVersionToEntry = vi.fn().mockRejectedValue('kaput');

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      await result.current.handleSaveConvertedVersion('e1', SAVE_ARGS);
    });

    expect(showToast).toHaveBeenCalledWith('error', 'Save failed', 'kaput');
  });
});

describe('useCatalogState.handleBatchConvertToOpenApi (P4-C)', () => {
  it('converts only Swagger 2.0 entries and saves each as a new version', async () => {
    const showToast = vi.fn();
    const e1 = makeCatalog().entries[0] as CatalogEntry;
    const e2 = { ...e1, id: 'e2', name: 'Already OAS', currentVersionId: 'v2' };
    const catalog = makeCatalog(e1);
    catalog.entries = [e1, e2];
    catalog.loadRawSpec = vi
      .fn()
      .mockResolvedValueOnce("swagger: '2.0'")
      .mockResolvedValueOnce('openapi: 3.1.0');
    vi.mocked(detectSpecFormat)
      .mockReturnValueOnce('swagger2')
      .mockReturnValueOnce('oas31');
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue({
      yaml: 'openapi: 3.0.3\ninfo:\n  title: x\n  version: 1\npaths: {}\n',
      openapiVersion: '3.0.3',
      engineUsed: 'swagger2openapi',
      fellBack: false,
      valid: true,
      validationErrors: [],
      warnings: [],
      openapi: { openapi: '3.0.3', info: { title: 'x', version: '1' }, paths: {} },
    });
    const parsed = makeParsedSpec();
    vi.mocked(parseOpenApiSpec).mockResolvedValue(parsed);

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      const out = await result.current.handleBatchConvertToOpenApi();
      expect(out).toEqual({ converted: 1, failed: 0, skipped: 1 });
    });

    expect(convertSwaggerToOpenApiYaml).toHaveBeenCalledWith("swagger: '2.0'", {
      engine: 'swagger2openapi',
      target: '3.0',
      fallbackOnInvalid: true,
    });
    expect(parsed.entry.versions[0].changelog).toContain('Converted Swagger 2.0 → OpenAPI 3.0.3');
    expect(catalog.addVersionToEntry).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('success', 'Batch conversion complete', 'Converted 1 entry · skipped 1.');
  });

  it('reports failures for invalid conversion output and conversion throws', async () => {
    const showToast = vi.fn();
    const e1 = makeCatalog().entries[0] as CatalogEntry;
    const e2 = { ...e1, id: 'e2', name: 'Bad One', currentVersionId: 'v2' };
    const catalog = makeCatalog(e1);
    catalog.entries = [e1, e2];
    catalog.loadRawSpec = vi
      .fn()
      .mockResolvedValueOnce("swagger: '2.0'")
      .mockResolvedValueOnce("swagger: '2.0'");
    vi.mocked(detectSpecFormat)
      .mockReturnValueOnce('swagger2')
      .mockReturnValueOnce('swagger2');
    vi.mocked(convertSwaggerToOpenApiYaml)
      .mockResolvedValueOnce({
        yaml: '',
        openapiVersion: '3.0.3',
        engineUsed: 'swagger2openapi',
        fellBack: false,
        valid: false,
        validationErrors: ['invalid'],
        warnings: [],
        openapi: { openapi: '3.0.3' },
      })
      .mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useCatalogState(catalog, { showToast }));
    await act(async () => {
      const out = await result.current.handleBatchConvertToOpenApi();
      expect(out).toEqual({ converted: 0, failed: 2, skipped: 0 });
    });

    expect(catalog.addVersionToEntry).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'warning',
      'Batch conversion finished with failures',
      'Converted 0, failed 2, skipped 0.',
    );
  });
});

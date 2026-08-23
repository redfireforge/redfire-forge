import { useState, useCallback } from 'react';
import { saveFile } from '@shared/utils/fileSaver';
import { MAX_VERSIONS, type UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import {
  detectSpecFormat,
  availableTargets,
  convertSwaggerToOpenApiYaml,
  type ConvertEngine,
} from '../../features/catalog/utils/swaggerToOpenApi';
import { parseOpenApiSpec } from '../../features/catalog/utils/openApiParser';
import type { ToastType } from '@workflow/components/WorkflowToastProvider';

interface CatalogStateDeps {
  showToast?: (type: ToastType, title: string, subtitle?: string) => void;
}

/** Source spec passed to the Convert-to-OpenAPI modal (loaded once by the opener). */
export interface CatalogConvertTarget {
  entryId: string;
  specName: string;
  rawSpec: string;
}

/** Payload the Convert modal hands back when the user saves the result as a version. */
export interface SaveConvertedVersionArgs {
  yaml: string;
  openapiVersion: string;
  engineUsed: ConvertEngine;
  /** `'convert'` for Swagger 2.0 → OpenAPI 3; `'upgrade'` for OpenAPI 3.0/3.1 → higher. */
  mode: 'convert' | 'upgrade';
}

export interface BatchConvertResult {
  converted: number;
  failed: number;
  skipped: number;
}

export function useCatalogState(catalog: UseCatalogReturn, deps: CatalogStateDeps = {}) {
  const { showToast } = deps;
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [catalogReimportId, setCatalogReimportId] = useState<string | undefined>();
  const [catalogInitialSpec, setCatalogInitialSpec] = useState<{ yaml: string; name: string } | undefined>();
  const [catalogVersionHistoryId, setCatalogVersionHistoryId] = useState<string | undefined>();
  const [catalogEditId, setCatalogEditId] = useState<string | undefined>();
  const [catalogConvert, setCatalogConvert] = useState<CatalogConvertTarget | undefined>();

  const handleExportSpec = useCallback(async (entryId: string) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;
    const raw = await catalog.loadRawSpec(entryId, entry.currentVersionId);
    if (!raw) return;
    const filename = `${entry.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-v${entry.versions[0]?.version ?? 'unknown'}.yaml`;
    const blob = new Blob([raw], { type: 'text/yaml' });
    await saveFile(blob, { filename, mimeType: 'text/yaml', description: 'YAML spec' });
  }, [catalog]);

  /**
   * Opens the Convert/Upgrade-to-OpenAPI modal for a Swagger 2.0 OR OpenAPI 3.0/3.1
   * entry. Loads the raw spec once and pre-checks here that at least one forward target
   * exists (Swagger 2 → 3.0/3.1; 3.0 → 3.1/3.2; 3.1 → 3.2), so we never open the modal
   * for an already-latest (3.2) or unsupported spec. The modal performs the conversion.
   */
  const handleConvertToOpenApi = useCallback(async (entryId: string) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;

    const raw = await catalog.loadRawSpec(entryId, entry.currentVersionId);
    if (!raw) {
      showToast?.('error', 'Convert failed', 'Could not load the spec for this API');
      return;
    }

    const format = detectSpecFormat(raw);
    if (availableTargets(format).length === 0) {
      const subtitle = format === 'oas32'
        ? 'This spec is already OpenAPI 3.2 (the latest supported target).'
        : 'This spec format cannot be converted or upgraded.';
      showToast?.('info', 'Nothing to convert', subtitle);
      return;
    }

    setCatalogConvert({ entryId, specName: entry.name, rawSpec: raw });
  }, [catalog, showToast]);

  /**
   * Saves the modal's converted OpenAPI YAML as a new Catalog version (P2). Re-parses
   * the converted text through the normal pipeline, tags it with a changelog so Version
   * History distinguishes it from the Swagger original, and reuses `addVersionToEntry`
   * (which prunes to MAX_VERSIONS, persists the raw blob, and switches to it).
   */
  const handleSaveConvertedVersion = useCallback(async (entryId: string, args: SaveConvertedVersionArgs) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;

    let parsed;
    try {
      parsed = await parseOpenApiSpec(args.yaml);
    } catch (err) {
      showToast?.('error', 'Save failed', err instanceof Error ? err.message : String(err));
      return;
    }

    const newVersion = parsed.entry.versions[0];
    if (!newVersion) {
      showToast?.('error', 'Save failed', 'Converted spec produced no version metadata');
      return;
    }
    newVersion.changelog = args.mode === 'upgrade'
      ? `Upgraded to OpenAPI ${args.openapiVersion} (${args.engineUsed})`
      : `Converted Swagger 2.0 → OpenAPI ${args.openapiVersion} (${args.engineUsed})`;

    const willPrune = entry.versions.length >= MAX_VERSIONS;
    try {
      await catalog.addVersionToEntry(entryId, parsed);
    } catch (err) {
      showToast?.('error', 'Save failed', err instanceof Error ? err.message : String(err));
      return;
    }
    setCatalogConvert(undefined);

    const pruneNote = willPrune ? ` · oldest version pruned (max ${MAX_VERSIONS})` : '';
    showToast?.('success', `Saved OpenAPI ${args.openapiVersion} as new version`, `${entry.name}${pruneNote}`);
  }, [catalog, showToast]);

  /**
   * Batch-convert all current Swagger 2.0 entries to OpenAPI 3.0 and store each result
   * as a new Catalog version (P4-C). This intentionally uses the proven default engine
   * (`swagger2openapi`) with validation-gated saves.
   */
  const handleBatchConvertToOpenApi = useCallback(async (): Promise<BatchConvertResult> => {
    let converted = 0;
    let failed = 0;
    let skipped = 0;

    for (const entry of catalog.entries) {
      const raw = await catalog.loadRawSpec(entry.id, entry.currentVersionId);
      if (!raw) {
        failed++;
        continue;
      }
      if (detectSpecFormat(raw) !== 'swagger2') {
        skipped++;
        continue;
      }

      try {
        const result = await convertSwaggerToOpenApiYaml(raw, {
          engine: 'swagger2openapi',
          target: '3.0',
          fallbackOnInvalid: true,
        });
        if (!result.valid) {
          failed++;
          continue;
        }

        const parsed = await parseOpenApiSpec(result.yaml);
        const newVersion = parsed.entry.versions[0];
        if (!newVersion) {
          failed++;
          continue;
        }
        newVersion.changelog = `Converted Swagger 2.0 → OpenAPI ${result.openapiVersion} (${result.engineUsed})`;
        await catalog.addVersionToEntry(entry.id, parsed);
        converted++;
      } catch {
        failed++;
      }
    }

    if (converted === 0 && failed === 0) {
      showToast?.('info', 'No Swagger entries found', 'Every entry is already OpenAPI 3.x or unsupported.');
    } else if (failed === 0) {
      showToast?.('success', 'Batch conversion complete', `Converted ${converted} entr${converted === 1 ? 'y' : 'ies'} · skipped ${skipped}.`);
    } else {
      showToast?.('warning', 'Batch conversion finished with failures', `Converted ${converted}, failed ${failed}, skipped ${skipped}.`);
    }

    return { converted, failed, skipped };
  }, [catalog, showToast]);

  return {
    showCatalogImport,
    setShowCatalogImport,
    catalogReimportId,
    setCatalogReimportId,
    catalogInitialSpec,
    setCatalogInitialSpec,
    catalogVersionHistoryId,
    setCatalogVersionHistoryId,
    catalogEditId,
    setCatalogEditId,
    catalogConvert,
    setCatalogConvert,
    handleExportSpec,
    handleConvertToOpenApi,
    handleSaveConvertedVersion,
    handleBatchConvertToOpenApi,
  };
}

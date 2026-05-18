import { useState, useCallback } from 'react';
import { saveFile } from '../../shared/utils/fileSaver';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';

export function useCatalogState(catalog: UseCatalogReturn) {
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [catalogReimportId, setCatalogReimportId] = useState<string | undefined>();
  const [catalogInitialSpec, setCatalogInitialSpec] = useState<{ yaml: string; name: string } | undefined>();
  const [catalogVersionHistoryId, setCatalogVersionHistoryId] = useState<string | undefined>();
  const [catalogEditId, setCatalogEditId] = useState<string | undefined>();

  const handleExportSpec = useCallback(async (entryId: string) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;
    const raw = await catalog.loadRawSpec(entryId, entry.currentVersionId);
    if (!raw) return;
    const filename = `${entry.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-v${entry.versions[0]?.version ?? 'unknown'}.yaml`;
    const blob = new Blob([raw], { type: 'text/yaml' });
    await saveFile(blob, { filename, mimeType: 'text/yaml', description: 'YAML spec' });
  }, [catalog]);

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
    handleExportSpec,
  };
}

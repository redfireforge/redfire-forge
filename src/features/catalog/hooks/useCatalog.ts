import { useState, useEffect, useCallback } from 'react';
import type { CatalogEntry, ParsedSpec } from '../types/catalog';
import {
  loadCatalogEntries, saveCatalogEntries,
  saveCatalogRawSpec, removeCatalogRawSpec, removeAllCatalogRawSpecs,
  loadCatalogRawSpec, removeCatalogEndpointValues,
} from '../../../shared/utils/storage';
import { parseOpenApiSpec } from '../utils/openApiParser';

const MAX_VERSIONS = 10;

export type UseCatalogReturn = ReturnType<typeof useCatalog>;

export function useCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | undefined>();

  useEffect(() => {
    loadCatalogEntries().then((e) => {
      setEntries(e);
      setLoaded(true);
      if (e.length === 1) setSelectedEntryId(e[0].id);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveCatalogEntries(entries);
  }, [entries, loaded]);

  const selectedEntry = entries.find(e => e.id === selectedEntryId) ?? null;

  const addEntry = useCallback(async (entry: CatalogEntry, rawSpec: string) => {
    setEntries(prev => [...prev, entry]);
    setSelectedEntryId(entry.id);
    setSelectedEndpointId(undefined);
    await saveCatalogRawSpec(entry.id, entry.currentVersionId, rawSpec);
  }, []);

  const findByTitle = useCallback((title: string): CatalogEntry | undefined => {
    return entries.find(e => e.name.toLowerCase() === title.toLowerCase());
  }, [entries]);

  const addVersionToEntry = useCallback(async (
    entryId: string,
    parsed: ParsedSpec,
  ) => {
    const newVersion = parsed.entry.versions[0];
    if (!newVersion) return;

    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const updatedVersions = [newVersion, ...e.versions];
      const pruned = updatedVersions.slice(0, MAX_VERSIONS);
      return {
        ...e,
        currentVersionId: newVersion.id,
        versions: pruned,
        description: parsed.entry.description,
        servers: parsed.entry.servers,
        securitySchemes: parsed.entry.securitySchemes,
        folders: parsed.entry.folders,
        endpoints: parsed.entry.endpoints,
      };
    }));

    await saveCatalogRawSpec(entryId, newVersion.id, parsed.rawSpec);
    setSelectedEntryId(entryId);
    setSelectedEndpointId(undefined);

    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      const allVersions = [newVersion, ...entry.versions];
      const toPrune = allVersions.slice(MAX_VERSIONS);
      for (const v of toPrune) {
        await removeCatalogRawSpec(entryId, v.id);
      }
    }
  }, [entries]);

  const switchVersion = useCallback(async (entryId: string, versionId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const version = entry.versions.find(v => v.id === versionId);
    if (!version) return;

    const rawSpec = await loadCatalogRawSpec(entryId, versionId);
    if (!rawSpec) return;

    try {
      const parsed = await parseOpenApiSpec(rawSpec);
      setEntries(prev => prev.map(e => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          currentVersionId: versionId,
          description: parsed.entry.description,
          servers: parsed.entry.servers,
          securitySchemes: parsed.entry.securitySchemes,
          folders: parsed.entry.folders,
          endpoints: parsed.entry.endpoints,
        };
      }));
    } catch {
      // Raw spec is corrupted — can't switch
    }
  }, [entries]);

  const removeEntry = useCallback(async (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      await removeAllCatalogRawSpecs(entryId, entry.versions.map(v => v.id));
      await removeCatalogEndpointValues(entryId);
    }
    setEntries(prev => prev.filter(e => e.id !== entryId));
    if (selectedEntryId === entryId) {
      setSelectedEntryId(undefined);
      setSelectedEndpointId(undefined);
    }
  }, [entries, selectedEntryId]);

  const updateEntry = useCallback((entryId: string, patch: Partial<CatalogEntry>) => {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...patch } : e));
  }, []);

  const selectEntry = useCallback((entryId: string | undefined) => {
    setSelectedEntryId(entryId);
    setSelectedEndpointId(undefined);
  }, []);

  const selectEndpoint = useCallback((endpointId: string | undefined) => {
    setSelectedEndpointId(endpointId);
  }, []);

  const loadRawSpec = useCallback(async (entryId: string, versionId: string): Promise<string | null> => {
    return loadCatalogRawSpec(entryId, versionId);
  }, []);

  const removeVersion = useCallback(async (entryId: string, versionId: string) => {
    await removeCatalogRawSpec(entryId, versionId);
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const newVersions = e.versions.filter(v => v.id !== versionId);
      const currentStale = e.currentVersionId === versionId;
      return {
        ...e,
        versions: newVersions,
        currentVersionId: currentStale ? (newVersions[0]?.id ?? '') : e.currentVersionId,
      };
    }));
  }, []);

  return {
    entries,
    loaded,
    selectedEntry,
    selectedEntryId,
    selectedEndpointId,
    addEntry,
    addVersionToEntry,
    findByTitle,
    switchVersion,
    removeEntry,
    updateEntry,
    selectEntry,
    selectEndpoint,
    loadRawSpec,
    removeVersion,
  };
}

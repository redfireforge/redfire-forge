import { useState, useEffect, useCallback } from 'react';
import type { CatalogEntry } from '../types/catalog';
import {
  loadCatalogEntries, saveCatalogEntries,
  saveCatalogRawSpec, removeCatalogRawSpec, removeAllCatalogRawSpecs,
  loadCatalogRawSpec,
} from '../utils/storage';

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

  const removeEntry = useCallback(async (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      await removeAllCatalogRawSpecs(entryId, entry.versions.map(v => v.id));
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
      return { ...e, versions: newVersions };
    }));
  }, []);

  return {
    entries,
    loaded,
    selectedEntry,
    selectedEntryId,
    selectedEndpointId,
    addEntry,
    removeEntry,
    updateEntry,
    selectEntry,
    selectEndpoint,
    loadRawSpec,
    removeVersion,
  };
}

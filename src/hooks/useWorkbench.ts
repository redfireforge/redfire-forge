import { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkbenchData, WorkbenchCollection, WorkbenchRequest, WorkbenchEnv, AuthConfig, KeyValue, HttpMethod, BodyType } from '../types';
import { loadWorkbench, saveWorkbench } from '../utils/storage';

const EMPTY_REQUEST: () => WorkbenchRequest = () => ({
  id: uuidv4(),
  name: 'New Request',
  method: 'GET' as HttpMethod,
  url: '',
  headers: [{ key: '', value: '' }],
  body: '',
  bodyType: 'none' as BodyType,
  bodyForm: [{ key: '', value: '' }],
  auth: { type: 'inherit' },
});

export function useWorkbench() {
  const [data, setData] = useState<WorkbenchData>({
    environments: [],
    collections: [],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadWorkbench().then((d) => { setData(d); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (loaded) saveWorkbench(data);
  }, [data, loaded]);

  const selectedCollection = useMemo(
    () => data.collections.find((c) => c.id === data.selectedCollectionId) ?? null,
    [data.collections, data.selectedCollectionId],
  );

  const selectedRequest = useMemo(
    () => selectedCollection?.requests.find((r) => r.id === data.selectedRequestId) ?? null,
    [selectedCollection, data.selectedRequestId],
  );

  // ─── Environments ──────────────────────────────────────

  const addEnv = useCallback((name: string) => {
    setData((prev) => ({
      ...prev,
      environments: [...prev.environments, { id: uuidv4(), name }],
    }));
  }, []);

  const removeEnv = useCallback((envId: string) => {
    setData((prev) => ({
      ...prev,
      environments: prev.environments.filter((e) => e.id !== envId),
      selectedEnvId: prev.selectedEnvId === envId ? undefined : prev.selectedEnvId,
    }));
  }, []);

  const setSelectedEnvId = useCallback((envId: string | undefined) => {
    setData((prev) => ({ ...prev, selectedEnvId: envId }));
  }, []);

  // ─── Collections ───────────────────────────────────────

  const addCollection = useCallback((col: Omit<WorkbenchCollection, 'id' | 'requests'>) => {
    const newCol: WorkbenchCollection = { ...col, id: uuidv4(), requests: [] };
    setData((prev) => ({
      ...prev,
      collections: [...prev.collections, newCol],
      selectedCollectionId: newCol.id,
      selectedRequestId: undefined,
    }));
    return newCol.id;
  }, []);

  const updateCollection = useCallback((colId: string, patch: Partial<Omit<WorkbenchCollection, 'id' | 'requests'>>) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => c.id === colId ? { ...c, ...patch } : c),
    }));
  }, []);

  const removeCollection = useCallback((colId: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.filter((c) => c.id !== colId),
      selectedCollectionId: prev.selectedCollectionId === colId ? undefined : prev.selectedCollectionId,
      selectedRequestId: prev.selectedCollectionId === colId ? undefined : prev.selectedRequestId,
    }));
  }, []);

  const selectCollection = useCallback((colId: string) => {
    setData((prev) => ({
      ...prev,
      selectedCollectionId: colId,
      selectedRequestId: undefined,
    }));
  }, []);

  // ─── Requests ──────────────────────────────────────────

  const addRequest = useCallback((colId: string) => {
    const req = EMPTY_REQUEST();
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) =>
        c.id === colId ? { ...c, requests: [...c.requests, req] } : c,
      ),
      selectedCollectionId: colId,
      selectedRequestId: req.id,
    }));
    return req.id;
  }, []);

  const updateRequest = useCallback((colId: string, reqId: string, patch: Partial<WorkbenchRequest>) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) =>
        c.id === colId
          ? { ...c, requests: c.requests.map((r) => r.id === reqId ? { ...r, ...patch } : r) }
          : c,
      ),
    }));
  }, []);

  const removeRequest = useCallback((colId: string, reqId: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) =>
        c.id === colId ? { ...c, requests: c.requests.filter((r) => r.id !== reqId) } : c,
      ),
      selectedRequestId: prev.selectedRequestId === reqId ? undefined : prev.selectedRequestId,
    }));
  }, []);

  const selectRequest = useCallback((colId: string, reqId: string) => {
    setData((prev) => ({
      ...prev,
      selectedCollectionId: colId,
      selectedRequestId: reqId,
    }));
  }, []);

  // ─── Bulk environment import from project ──────────────

  const importEnvsFromProject = useCallback((envs: { name: string }[]) => {
    setData((prev) => {
      const existingNames = new Set(prev.environments.map((e) => e.name));
      const newEnvs: WorkbenchEnv[] = envs
        .filter((e) => !existingNames.has(e.name))
        .map((e) => ({ id: uuidv4(), name: e.name }));
      return { ...prev, environments: [...prev.environments, ...newEnvs] };
    });
  }, []);

  return {
    data,
    loaded,
    selectedCollection,
    selectedRequest,
    environments: data.environments,
    collections: data.collections,
    selectedEnvId: data.selectedEnvId,

    addEnv,
    removeEnv,
    setSelectedEnvId,

    addCollection,
    updateCollection,
    removeCollection,
    selectCollection,

    addRequest,
    updateRequest,
    removeRequest,
    selectRequest,

    importEnvsFromProject,
  };
}

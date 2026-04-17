import { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkbenchData, WorkbenchCollection, WorkbenchRequest, WorkbenchFolder, WorkbenchEnv, HttpMethod, BodyType } from '../types';
import { loadWorkbench, saveWorkbench } from '../utils/storage';
import {
  findFolderDeep, findRequestInCollection,
  countAllRequests, mapRequests, removeRequestFrom,
  mapFolderDeep, addToFolderDeep, removeFolderDeep,
  cloneRequest, cloneFolder, extractFolderDeep,
  isDescendantOf, addReqToFolderDeep, findReqParentFolder,
  reorderInFolders, swapInFolders,
} from '../utils/workbenchTree';

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

export type UseWorkbenchReturn = ReturnType<typeof useWorkbench>;

export function useWorkbench() {
  const [data, setData] = useState<WorkbenchData>({ environments: [], collections: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { loadWorkbench().then((d) => { setData(d); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) saveWorkbench(data); }, [data, loaded]);

  const selectedCollection = useMemo(
    () => data.collections.find((c) => c.id === data.selectedCollectionId) ?? null,
    [data.collections, data.selectedCollectionId],
  );

  const selectedRequest = useMemo(
    () => selectedCollection && data.selectedRequestId ? findRequestInCollection(selectedCollection, data.selectedRequestId) : null,
    [selectedCollection, data.selectedRequestId],
  );

  // ─── Environments ──────────────────────────────────────

  const addEnv = useCallback((name: string) => {
    setData((prev) => ({ ...prev, environments: [...prev.environments, { id: uuidv4(), name }] }));
  }, []);

  const removeEnv = useCallback((envId: string) => {
    setData((prev) => ({
      ...prev, environments: prev.environments.filter((e) => e.id !== envId),
      selectedEnvId: prev.selectedEnvId === envId ? undefined : prev.selectedEnvId,
    }));
  }, []);

  const setSelectedEnvId = useCallback((envId: string | undefined) => {
    setData((prev) => ({ ...prev, selectedEnvId: envId }));
  }, []);

  // ─── Collections ───────────────────────────────────────

  const addCollection = useCallback((col: Omit<WorkbenchCollection, 'id' | 'requests'>) => {
    const newCol: WorkbenchCollection = { ...col, id: uuidv4(), requests: [], folders: [] };
    setData((prev) => ({ ...prev, collections: [...prev.collections, newCol], selectedCollectionId: newCol.id, selectedRequestId: undefined }));
    return newCol.id;
  }, []);

  const updateCollection = useCallback((colId: string, patch: Partial<Omit<WorkbenchCollection, 'id' | 'requests' | 'folders'>>) => {
    setData((prev) => ({ ...prev, collections: prev.collections.map((c) => c.id === colId ? { ...c, ...patch } : c) }));
  }, []);

  const removeCollection = useCallback((colId: string) => {
    setData((prev) => ({
      ...prev, collections: prev.collections.filter((c) => c.id !== colId),
      selectedCollectionId: prev.selectedCollectionId === colId ? undefined : prev.selectedCollectionId,
      selectedRequestId: prev.selectedCollectionId === colId ? undefined : prev.selectedRequestId,
    }));
  }, []);

  const duplicateCollection = useCallback((colId: string) => {
    setData((prev) => {
      const col = prev.collections.find(c => c.id === colId);
      if (!col) return prev;
      const dup: WorkbenchCollection = {
        ...col, id: uuidv4(), name: `${col.name} (copy)`,
        requests: col.requests.map(cloneRequest),
        folders: (col.folders ?? []).map(cloneFolder),
      };
      return { ...prev, collections: [...prev.collections, dup], selectedCollectionId: dup.id, selectedRequestId: undefined };
    });
  }, []);

  const selectCollection = useCallback((colId: string) => {
    setData((prev) => ({ ...prev, selectedCollectionId: colId, selectedRequestId: undefined }));
  }, []);

  // ─── Folders ───────────────────────────────────────────

  const addFolder = useCallback((colId: string, name: string, parentFolderId?: string) => {
    const folder: WorkbenchFolder = { id: uuidv4(), name, requests: [], folders: [] };
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        if (parentFolderId) {
          return { ...c, folders: addToFolderDeep(c.folders ?? [], parentFolderId, folder) };
        }
        return { ...c, folders: [...(c.folders ?? []), folder] };
      }),
    }));
    return folder.id;
  }, []);

  const addSubCollection = useCallback((colId: string, name: string, parentFolderId?: string) => {
    setData((prev) => {
      const matchedEnv = prev.environments.find(e => e.name.toLowerCase() === name.toLowerCase());
      const sub: WorkbenchFolder = {
        id: uuidv4(), name, requests: [], folders: [], isSubCollection: true,
        selectedEnvId: matchedEnv?.id,
      };
      return {
        ...prev,
        collections: prev.collections.map((c) => {
          if (c.id !== colId) return c;
          if (parentFolderId) return { ...c, folders: addToFolderDeep(c.folders ?? [], parentFolderId, sub) };
          return { ...c, folders: [...(c.folders ?? []), sub] };
        }),
      };
    });
  }, []);

  const updateSubCollection = useCallback((colId: string, folderId: string, patch: Partial<Pick<WorkbenchFolder, 'name' | 'auth' | 'baseUrls' | 'selectedEnvId'>>) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) =>
        c.id === colId
          ? { ...c, folders: mapFolderDeep(c.folders ?? [], folderId, (f) => ({ ...f, ...patch })) }
          : c,
      ),
    }));
  }, []);

  const renameFolder = useCallback((colId: string, folderId: string, name: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) =>
        c.id === colId
          ? { ...c, folders: mapFolderDeep(c.folders ?? [], folderId, (f) => ({ ...f, name })) }
          : c,
      ),
    }));
  }, []);

  const removeFolder = useCallback((colId: string, folderId: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        const target = findFolderDeep(c.folders ?? [], folderId);
        const { folders, orphaned } = removeFolderDeep(c.folders ?? [], folderId);
        if (target?.isSubCollection) {
          return { ...c, folders };
        }
        return { ...c, requests: [...c.requests, ...orphaned], folders };
      }),
    }));
  }, []);

  const duplicateFolder = useCallback((colId: string, folderId: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        const orig = findFolderDeep(c.folders ?? [], folderId);
        if (!orig) return c;
        const dup = cloneFolder({ ...orig, name: `${orig.name} (copy)` });
        const parentId = (() => {
          function findParent(folders: WorkbenchFolder[], targetId: string): string | null {
            for (const f of folders) {
              if ((f.folders ?? []).some(sf => sf.id === targetId)) return f.id;
              const deep = findParent(f.folders ?? [], targetId);
              if (deep) return deep;
            }
            return null;
          }
          return findParent(c.folders ?? [], folderId);
        })();
        if (parentId) {
          return { ...c, folders: addToFolderDeep(c.folders ?? [], parentId, dup) };
        }
        return { ...c, folders: [...(c.folders ?? []), dup] };
      }),
    }));
  }, []);

  const moveFolder = useCallback((colId: string, folderId: string, direction: 'up' | 'down') => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        return { ...c, folders: swapInFolders(c.folders ?? [], folderId, direction) };
      }),
    }));
  }, []);

  const reorderFolder = useCallback((colId: string, folderId: string, beforeFolderId: string | null) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        return { ...c, folders: reorderInFolders(c.folders ?? [], folderId, beforeFolderId) };
      }),
    }));
  }, []);

  const moveFolderTo = useCallback((colId: string, folderId: string, targetParentFolderId: string | null) => {
    if (folderId === targetParentFolderId) return;
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        if (targetParentFolderId && isDescendantOf(c.folders ?? [], folderId, targetParentFolderId)) return c;
        const { remaining, extracted } = extractFolderDeep(c.folders ?? [], folderId);
        if (!extracted) return c;
        if (targetParentFolderId === null) {
          return { ...c, folders: [...remaining, extracted] };
        }
        return { ...c, folders: addToFolderDeep(remaining, targetParentFolderId, extracted) };
      }),
    }));
  }, []);

  // ─── Requests ──────────────────────────────────────────

  const addRequest = useCallback((colId: string, folderId?: string) => {
    const req = EMPTY_REQUEST();
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        if (folderId) {
          return { ...c, folders: addReqToFolderDeep(c.folders ?? [], folderId, req) };
        }
        return { ...c, requests: [...c.requests, req] };
      }),
      selectedCollectionId: colId,
      selectedRequestId: req.id,
    }));
    return req.id;
  }, []);

  const updateRequest = useCallback((colId: string, reqId: string, patch: Partial<WorkbenchRequest>) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) =>
        c.id === colId ? mapRequests(c, reqId, (r) => ({ ...r, ...patch })) : c,
      ),
    }));
  }, []);

  const removeRequest = useCallback((colId: string, reqId: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => c.id === colId ? removeRequestFrom(c, reqId) : c),
      selectedRequestId: prev.selectedRequestId === reqId ? undefined : prev.selectedRequestId,
    }));
  }, []);

  const duplicateRequest = useCallback((colId: string, reqId: string) => {
    setData((prev) => {
      const col = prev.collections.find((c) => c.id === colId);
      if (!col) return prev;
      const orig = findRequestInCollection(col, reqId);
      if (!orig) return prev;
      const dup: WorkbenchRequest = { ...orig, id: uuidv4(), name: `${orig.name || 'Request'} (copy)` };
      const parentFolder = findReqParentFolder(col.folders ?? [], reqId);
      return {
        ...prev,
        collections: prev.collections.map((c) => {
          if (c.id !== colId) return c;
          if (parentFolder) {
            return { ...c, folders: addReqToFolderDeep(c.folders ?? [], parentFolder.id, dup) };
          }
          return { ...c, requests: [...c.requests, dup] };
        }),
        selectedCollectionId: colId,
        selectedRequestId: dup.id,
      };
    });
  }, []);

  const moveRequest = useCallback((colId: string, reqId: string, targetFolderId: string | null) => {
    setData((prev) => {
      const col = prev.collections.find((c) => c.id === colId);
      if (!col) return prev;
      const req = findRequestInCollection(col, reqId);
      if (!req) return prev;
      const cleaned = removeRequestFrom(col, reqId);
      let updated: WorkbenchCollection;
      if (targetFolderId === null) {
        updated = { ...cleaned, requests: [...cleaned.requests, req] };
      } else {
        updated = { ...cleaned, folders: addReqToFolderDeep(cleaned.folders ?? [], targetFolderId, req) };
      }
      return { ...prev, collections: prev.collections.map((c) => c.id === colId ? updated : c) };
    });
  }, []);

  const selectRequest = useCallback((colId: string, reqId: string) => {
    setData((prev) => ({ ...prev, selectedCollectionId: colId, selectedRequestId: reqId }));
  }, []);

  const moveRequestToCollection = useCallback((srcColId: string, reqId: string, destColId: string, destFolderId: string | null) => {
    setData((prev) => {
      const srcCol = prev.collections.find((c) => c.id === srcColId);
      if (!srcCol) return prev;
      const req = findRequestInCollection(srcCol, reqId);
      if (!req) return prev;
      const cleanedSrc = removeRequestFrom(srcCol, reqId);
      if (srcColId === destColId) {
        let updated: WorkbenchCollection;
        if (destFolderId) {
          updated = { ...cleanedSrc, folders: addReqToFolderDeep(cleanedSrc.folders ?? [], destFolderId, req) };
        } else {
          updated = { ...cleanedSrc, requests: [...cleanedSrc.requests, req] };
        }
        return { ...prev, collections: prev.collections.map((c) => c.id === srcColId ? updated : c), selectedCollectionId: destColId, selectedRequestId: reqId };
      }
      return {
        ...prev,
        collections: prev.collections.map((c) => {
          if (c.id === srcColId) return cleanedSrc;
          if (c.id === destColId) {
            if (destFolderId) return { ...c, folders: addReqToFolderDeep(c.folders ?? [], destFolderId, req) };
            return { ...c, requests: [...c.requests, req] };
          }
          return c;
        }),
        selectedCollectionId: destColId,
        selectedRequestId: reqId,
      };
    });
  }, []);

  const moveFolderToCollection = useCallback((srcColId: string, folderId: string, destColId: string, destParentFolderId: string | null) => {
    setData((prev) => {
      const srcCol = prev.collections.find((c) => c.id === srcColId);
      if (!srcCol) return prev;
      const { remaining, extracted } = extractFolderDeep(srcCol.folders ?? [], folderId);
      if (!extracted) return prev;
      if (srcColId === destColId) {
        let newFolders = remaining;
        if (destParentFolderId) {
          newFolders = addToFolderDeep(remaining, destParentFolderId, extracted);
        } else {
          newFolders = [...remaining, extracted];
        }
        return { ...prev, collections: prev.collections.map((c) => c.id === srcColId ? { ...c, folders: newFolders } : c) };
      }
      return {
        ...prev,
        collections: prev.collections.map((c) => {
          if (c.id === srcColId) return { ...c, folders: remaining };
          if (c.id === destColId) {
            if (destParentFolderId) return { ...c, folders: addToFolderDeep(c.folders ?? [], destParentFolderId, extracted) };
            return { ...c, folders: [...(c.folders ?? []), extracted] };
          }
          return c;
        }),
      };
    });
  }, []);

  const moveCollectionAsSubCollection = useCallback((srcColId: string, destColId: string) => {
    setData((prev) => {
      const srcCol = prev.collections.find(c => c.id === srcColId);
      const destCol = prev.collections.find(c => c.id === destColId);
      if (!srcCol || !destCol || srcColId === destColId) return prev;
      const subCol: WorkbenchFolder = {
        id: uuidv4(),
        name: srcCol.name,
        requests: srcCol.requests,
        folders: srcCol.folders,
        isSubCollection: true,
        auth: srcCol.auth,
        baseUrls: srcCol.baseUrls,
      };
      return {
        ...prev,
        collections: prev.collections
          .filter(c => c.id !== srcColId)
          .map(c => c.id === destColId ? { ...c, folders: [...(c.folders ?? []), subCol] } : c),
        selectedCollectionId: destColId,
        selectedRequestId: prev.selectedCollectionId === srcColId ? undefined : prev.selectedRequestId,
      };
    });
  }, []);

  // ─── Bulk environment import from project ──────────────

  const importEnvsFromProject = useCallback((envs: { name: string }[]) => {
    setData((prev) => {
      const existingNames = new Set(prev.environments.map((e) => e.name));
      const newEnvs: WorkbenchEnv[] = envs.filter((e) => !existingNames.has(e.name)).map((e) => ({ id: uuidv4(), name: e.name }));
      return { ...prev, environments: [...prev.environments, ...newEnvs] };
    });
  }, []);

  const importCollection = useCallback((col: WorkbenchCollection) => {
    setData((prev) => ({
      ...prev,
      collections: [...prev.collections, col],
      selectedCollectionId: col.id,
      selectedRequestId: undefined,
    }));
  }, []);

  const importFolder = useCallback((colId: string, folder: WorkbenchFolder, parentFolderId?: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        if (!parentFolderId) {
          return { ...c, folders: [...(c.folders ?? []), folder] };
        }
        return {
          ...c,
          folders: mapFolderDeep(c.folders ?? [], parentFolderId, (f) => ({
            ...f,
            folders: [...(f.folders ?? []), folder],
          })),
        };
      }),
    }));
  }, []);

  return {
    data, loaded, selectedCollection, selectedRequest,
    environments: data.environments, collections: data.collections, selectedEnvId: data.selectedEnvId,
    addEnv, removeEnv, setSelectedEnvId,
    addCollection, updateCollection, removeCollection, duplicateCollection, selectCollection,
    addFolder, addSubCollection, updateSubCollection, renameFolder, removeFolder, duplicateFolder, moveFolder, reorderFolder, moveFolderTo,
    addRequest, updateRequest, removeRequest, duplicateRequest, moveRequest, selectRequest,
    moveRequestToCollection, moveFolderToCollection, moveCollectionAsSubCollection,
    importEnvsFromProject, countAllRequests, importCollection, importFolder,
  };
}

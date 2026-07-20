import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { RequestsData, RequestCollection, RequestItem, RequestFolder, HttpMethod, BodyType } from '../../../shared/types';
import { loadRequests, saveRequests } from '../../../shared/utils/storage';
import {
  findFolderDeep, findRequestInCollection,
  countAllRequests, collectGroupIds, collectGroupChildren,
  collectAllRequests,
  mapRequests, removeRequestFrom,
  mapFolderDeep, addToFolderDeep, removeFolderDeep,
  cloneRequest, cloneFolder, extractFolderDeep,
  isDescendantOf, addReqToFolderDeep, addReqToFolderSafe,
  addFolderToParentSafe, findReqParentFolder,
  reorderInFolders, swapInFolders,
} from '../utils/requestTree';
import { autoSaveVersion } from '../utils/requestDefinitionVersioning';
import { reconcileRequestsEnvKeys } from '../utils/reconcileEnvKeys';

const EMPTY_REQUEST: () => RequestItem = () => ({
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

export type UseRequestsReturn = ReturnType<typeof useRequests>;

export function useRequests() {
  const [data, setData] = useState<RequestsData>({ collections: [] });
  const [loaded, setLoaded] = useState(false);

  // Always-current snapshot so imperative actions (e.g. env-key reconcile) read fresh state.
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => { loadRequests().then((d) => { setData(d); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) saveRequests(data); }, [data, loaded]);

  const selectedCollection = useMemo(
    () => data.collections.find((c) => c.id === data.selectedCollectionId) ?? null,
    [data.collections, data.selectedCollectionId],
  );

  const selectedRequest = useMemo(
    () => selectedCollection && data.selectedRequestId ? findRequestInCollection(selectedCollection, data.selectedRequestId) : null,
    [selectedCollection, data.selectedRequestId],
  );

  // ─── Environments ──────────────────────────────────────
  // Environments are the single source of truth in Settings. The Requests workbench no longer
  // maintains its own env registry; it only tracks the active selection (`selectedEnvId`) and
  // reconciles any legacy per-env keys onto Settings env IDs once at load.

  const setSelectedEnvId = useCallback((envId: string | undefined) => {
    setData((prev) => ({ ...prev, selectedEnvId: envId }));
  }, []);

  /**
   * One-time migration of legacy Requests-local env IDs → Settings env IDs (by name).
   * Returns the names of any envs that were dropped (no matching Settings env). Idempotent:
   * empties `data.environments` so a second call is a no-op.
   */
  const reconcileEnvironmentKeys = useCallback((appEnvironments: { id: string; name: string }[]): string[] => {
    const res = reconcileRequestsEnvKeys(dataRef.current, appEnvironments);
    if (res.changed) setData(res.data);
    return res.droppedNames;
  }, []);

  // ─── Collections ───────────────────────────────────────

  const addCollection = useCallback((col: Omit<RequestCollection, 'id' | 'requests'>) => {
    const newCol: RequestCollection = { ...col, id: uuidv4(), requests: [], folders: [] };
    setData((prev) => ({ ...prev, collections: [...prev.collections, newCol], selectedCollectionId: newCol.id, selectedRequestId: undefined }));
    return newCol.id;
  }, []);

  const updateCollection = useCallback((colId: string, patch: Partial<Omit<RequestCollection, 'id' | 'requests' | 'folders'>>) => {
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
      const dup: RequestCollection = {
        ...col, id: uuidv4(), name: `${col.name} (copy)`,
        requests: col.requests.map(cloneRequest),
        folders: (col.folders ?? []).map(cloneFolder),
      };
      return { ...prev, collections: [...prev.collections, dup], selectedCollectionId: dup.id, selectedRequestId: undefined };
    });
  }, []);

  const selectCollection = useCallback((colId: string) => {
    setData((prev) => {
      let collections = prev.collections;
      // Auto-save version for the request we're leaving
      if (prev.selectedCollectionId && prev.selectedRequestId) {
        const prevCol = collections.find(c => c.id === prev.selectedCollectionId);
        const prevReq = prevCol ? findRequestInCollection(prevCol, prev.selectedRequestId) : null;
        if (prevReq) {
          const newVersions = autoSaveVersion(prevReq);
          if (newVersions) {
            collections = collections.map(c =>
              c.id === prev.selectedCollectionId
                ? mapRequests(c, prev.selectedRequestId!, r => ({ ...r, definitionVersions: newVersions }))
                : c,
            );
          }
        }
      }
      // Auto-select first request in the collection so the editor isn't empty
      const col = collections.find(c => c.id === colId);
      const firstReq = col?.requests?.[0];
      return { ...prev, collections, selectedCollectionId: colId, selectedRequestId: firstReq?.id };
    });
  }, []);

  // ─── Folders ───────────────────────────────────────────

  const addFolder = useCallback((colId: string, name: string, parentFolderId?: string) => {
    const folder: RequestFolder = { id: uuidv4(), name, requests: [], folders: [] };
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        if (parentFolderId) {
          return { ...c, folders: addFolderToParentSafe(c.folders ?? [], parentFolderId, folder) };
        }
        return { ...c, folders: [...(c.folders ?? []), folder] };
      }),
    }));
    return folder.id;
  }, []);

  const addSubCollection = useCallback((colId: string, name: string, parentFolderId?: string, selectedEnvId?: string) => {
    setData((prev) => {
      const sub: RequestFolder = {
        id: uuidv4(), name, requests: [], folders: [], isSubCollection: true,
        selectedEnvId,
      };
      return {
        ...prev,
        collections: prev.collections.map((c) => {
          if (c.id !== colId) return c;
          if (parentFolderId) return { ...c, folders: addFolderToParentSafe(c.folders ?? [], parentFolderId, sub) };
          return { ...c, folders: [...(c.folders ?? []), sub] };
        }),
      };
    });
  }, []);

  const updateSubCollection = useCallback((colId: string, folderId: string, patch: Partial<Pick<RequestFolder, 'name' | 'auth' | 'baseUrls' | 'selectedEnvId'>>) => {
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
    setData((prev) => {
      const col = prev.collections.find(c => c.id === colId);
      if (!col) return prev;
      const target = findFolderDeep(col.folders ?? [], folderId);
      const { folders, orphaned } = removeFolderDeep(col.folders ?? [], folderId);

      let selectedRequestId = prev.selectedRequestId;
      if (target?.isSubCollection && selectedRequestId) {
        const deletedReqIds = new Set(collectAllRequests(target).map(r => r.id));
        if (deletedReqIds.has(selectedRequestId)) {
          selectedRequestId = undefined;
        }
      }

      return {
        ...prev,
        selectedRequestId,
        collections: prev.collections.map((c) => {
          if (c.id !== colId) return c;
          if (target?.isSubCollection) {
            return { ...c, folders };
          }
          return { ...c, requests: [...c.requests, ...orphaned], folders };
        }),
      };
    });
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
          function findParent(folders: RequestFolder[], targetId: string): string | null {
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
        return { ...c, folders: addFolderToParentSafe(remaining, targetParentFolderId, extracted) };
      }),
    }));
  }, []);

  // ─── Requests ──────────────────────────────────────────

  const addRequest = useCallback((colId: string, folderId?: string, name?: string) => {
    const req = { ...EMPTY_REQUEST(), ...(name ? { name } : {}) };
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        if (folderId) {
          return addReqToFolderSafe(c, folderId, req);
        }
        return { ...c, requests: [...c.requests, req] };
      }),
      selectedCollectionId: colId,
      selectedRequestId: req.id,
    }));
    return req.id;
  }, []);

  const updateRequest = useCallback((colId: string, reqId: string, patch: Partial<RequestItem>) => {
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

  const duplicateRequest = useCallback((colId: string, reqId: string, name?: string) => {
    setData((prev) => {
      const col = prev.collections.find((c) => c.id === colId);
      if (!col) return prev;
      const orig = findRequestInCollection(col, reqId);
      if (!orig) return prev;
      const dup: RequestItem = { ...orig, id: uuidv4(), name: name ?? `${orig.name || 'Request'} (copy)` };
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

  const moveRequest = useCallback((colId: string, reqId: string, targetFolderId: string | null, beforeReqId?: string) => {
    setData((prev) => {
      const col = prev.collections.find((c) => c.id === colId);
      if (!col) return prev;
      const req = findRequestInCollection(col, reqId);
      if (!req) return prev;
      const cleaned = removeRequestFrom(col, reqId);
      let updated: RequestCollection;
      if (targetFolderId === null) {
        if (beforeReqId) {
          const idx = cleaned.requests.findIndex(r => r.id === beforeReqId);
          if (idx >= 0) {
            const reqs = [...cleaned.requests];
            reqs.splice(idx, 0, req);
            updated = { ...cleaned, requests: reqs };
          } else {
            updated = { ...cleaned, requests: [...cleaned.requests, req] };
          }
        } else {
          updated = { ...cleaned, requests: [...cleaned.requests, req] };
        }
      } else {
        updated = addReqToFolderSafe(cleaned, targetFolderId, req, beforeReqId);
      }
      return { ...prev, collections: prev.collections.map((c) => c.id === colId ? updated : c) };
    });
  }, []);

  const selectRequest = useCallback((colId: string, reqId: string) => {
    // Auto-save definition version for the request we're leaving
    setData((prev) => {
      let collections = prev.collections;
      if (prev.selectedCollectionId && prev.selectedRequestId && prev.selectedRequestId !== reqId) {
        const prevCol = collections.find(c => c.id === prev.selectedCollectionId);
        const prevReq = prevCol ? findRequestInCollection(prevCol, prev.selectedRequestId) : null;
        if (prevReq) {
          const newVersions = autoSaveVersion(prevReq);
          if (newVersions) {
            collections = collections.map(c =>
              c.id === prev.selectedCollectionId
                ? mapRequests(c, prev.selectedRequestId!, r => ({ ...r, definitionVersions: newVersions }))
                : c,
            );
          }
        }
      }
      return { ...prev, collections, selectedCollectionId: colId, selectedRequestId: reqId };
    });
  }, []);

  const moveRequestToCollection = useCallback((srcColId: string, reqId: string, destColId: string, destFolderId: string | null) => {
    setData((prev) => {
      const srcCol = prev.collections.find((c) => c.id === srcColId);
      if (!srcCol) return prev;
      const req = findRequestInCollection(srcCol, reqId);
      if (!req) return prev;
      const cleanedSrc = removeRequestFrom(srcCol, reqId);
      if (srcColId === destColId) {
        let updated: RequestCollection;
        if (destFolderId) {
          updated = addReqToFolderSafe(cleanedSrc, destFolderId, req);
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
            if (destFolderId) return addReqToFolderSafe(c, destFolderId, req);
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
          newFolders = addFolderToParentSafe(remaining, destParentFolderId, extracted);
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
            if (destParentFolderId) return { ...c, folders: addFolderToParentSafe(c.folders ?? [], destParentFolderId, extracted) };
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
      const subCol: RequestFolder = {
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


  // ─── Groups ──────────────────────────────────────────

  const addGroup = useCallback((name: string, parentGroupId?: string) => {
    const id = uuidv4();
    const group: RequestCollection = { id, name, mode: 'group', groupId: parentGroupId, requests: [], folders: [] };
    setData((prev) => ({ ...prev, collections: [...prev.collections, group] }));
    return id;
  }, []);

  const renameGroup = useCallback((groupId: string, name: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => c.id === groupId ? { ...c, name } : c),
    }));
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    setData((prev) => {
      const group = prev.collections.find(c => c.id === groupId);
      if (!group || group.mode !== 'group') return prev;
      const parentGroupId = group.groupId;
      const clearSelection = prev.selectedCollectionId === groupId;
      return {
        ...prev,
        collections: prev.collections
          .filter(c => c.id !== groupId)
          .map(c => c.groupId === groupId ? { ...c, groupId: parentGroupId } : c),
        selectedCollectionId: clearSelection ? undefined : prev.selectedCollectionId,
        selectedRequestId: clearSelection ? undefined : prev.selectedRequestId,
      };
    });
  }, []);

  const moveToGroup = useCallback((colId: string, targetGroupId: string | undefined) => {
    setData((prev) => {
      const col = prev.collections.find(c => c.id === colId);
      if (!col) return prev;
      if (col.mode === 'group' && targetGroupId) {
        const allDescendants = collectGroupIds(colId, prev.collections);
        if (allDescendants.includes(targetGroupId)) return prev;
      }
      return {
        ...prev,
        collections: prev.collections.map(c => c.id === colId ? { ...c, groupId: targetGroupId } : c),
      };
    });
  }, []);

  const duplicateGroup = useCallback((groupId: string) => {
    setData((prev) => {
      const group = prev.collections.find(c => c.id === groupId);
      if (!group || group.mode !== 'group') return prev;
      const idMap = new Map<string, string>();
      const allIds = collectGroupChildren(groupId, prev.collections);
      for (const oldId of allIds) {
        idMap.set(oldId, uuidv4());
      }
      const newCollections: RequestCollection[] = [];
      for (const oldId of allIds) {
        const orig = prev.collections.find(c => c.id === oldId);
        if (!orig) continue;
        const newId = idMap.get(oldId)!;
        const newGroupId = orig.groupId ? idMap.get(orig.groupId) ?? orig.groupId : orig.groupId;
        if (orig.mode === 'group') {
          newCollections.push({ ...orig, id: newId, groupId: newGroupId, name: orig.id === groupId ? `${orig.name} (copy)` : orig.name });
        } else {
          newCollections.push({
            ...orig, id: newId, groupId: newGroupId,
            requests: orig.requests.map(cloneRequest),
            folders: (orig.folders ?? []).map(cloneFolder),
          });
        }
      }
      return { ...prev, collections: [...prev.collections, ...newCollections] };
    });
  }, []);

  const importCollection = useCallback((col: RequestCollection) => {
    setData((prev) => ({
      ...prev,
      collections: [...prev.collections, col],
      selectedCollectionId: col.id,
      selectedRequestId: undefined,
    }));
  }, []);

  const importFolder = useCallback((colId: string, folder: RequestFolder, parentFolderId?: string) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        if (!parentFolderId) {
          return { ...c, folders: [...(c.folders ?? []), folder] };
        }
        return { ...c, folders: addFolderToParentSafe(c.folders ?? [], parentFolderId, folder) };
      }),
    }));
  }, []);

  const importRequests = useCallback((colId: string, folderId: string, requests: RequestItem[]) => {
    setData((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => {
        if (c.id !== colId) return c;
        let updated = c;
        for (const req of requests) {
          updated = addReqToFolderSafe(updated, folderId, req);
        }
        return updated;
      }),
    }));
  }, []);

  return {
    data, loaded, selectedCollection, selectedRequest,
    collections: data.collections, selectedEnvId: data.selectedEnvId,
    setSelectedEnvId, reconcileEnvironmentKeys,
    addCollection, updateCollection, removeCollection, duplicateCollection, selectCollection,
    addFolder, addSubCollection, updateSubCollection, renameFolder, removeFolder, duplicateFolder, moveFolder, reorderFolder, moveFolderTo,
    addRequest, updateRequest, removeRequest, duplicateRequest, moveRequest, selectRequest,
    moveRequestToCollection, moveFolderToCollection, moveCollectionAsSubCollection,
    addGroup, renameGroup, deleteGroup, moveToGroup, duplicateGroup,
    countAllRequests, importCollection, importFolder, importRequests,
  };
}

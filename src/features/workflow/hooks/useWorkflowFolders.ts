import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowFolder } from '../types/workflow';
import {
  loadWorkflowFolders,
  saveWorkflowFolders,
} from '@shared/utils/storage';
import {
  isDescendant,
  moveFolder as moveFolderUtil,
} from '../utils/workflowFolderTree';

export function useWorkflowFolders() {
  const [folders, setFolders] = useState<WorkflowFolder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadWorkflowFolders();
      if (cancelled) return;
      setFolders(stored);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((next: WorkflowFolder[]) => {
    void saveWorkflowFolders(next);
  }, []);

  const create = useCallback((name: string, parentId?: string): WorkflowFolder => {
    const folder: WorkflowFolder = {
      id: uuidv4(),
      name,
      parentId,
      order: Date.now(),
      collapsed: false,
    };
    setFolders((prev) => {
      const next = [...prev, folder];
      persist(next);
      return next;
    });
    return folder;
  }, [persist]);

  const rename = useCallback((id: string, name: string) => {
    setFolders((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, name } : f));
      persist(next);
      return next;
    });
  }, [persist]);

  const remove = useCallback((id: string, folders_: WorkflowFolder[]) => {
    const idsToRemove = new Set<string>([id]);
    const collectDescendants = (parentId: string) => {
      for (const f of folders_) {
        if (f.parentId === parentId && !idsToRemove.has(f.id)) {
          idsToRemove.add(f.id);
          collectDescendants(f.id);
        }
      }
    };
    collectDescendants(id);

    setFolders((prev) => {
      const next = prev.filter((f) => !idsToRemove.has(f.id));
      persist(next);
      return next;
    });

    return idsToRemove;
  }, [persist]);

  const move = useCallback((
    folderId: string,
    newParentId: string | null,
    newOrder: number,
  ) => {
    setFolders((prev) => {
      if (newParentId && isDescendant(folderId, newParentId, prev)) {
        return prev;
      }
      const next = moveFolderUtil(folderId, newParentId, newOrder, prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const toggleCollapse = useCallback((id: string) => {
    setFolders((prev) => {
      const next = prev.map((f) =>
        f.id === id ? { ...f, collapsed: !f.collapsed } : f,
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const setCollapsed = useCallback((id: string, collapsed: boolean) => {
    setFolders((prev) => {
      const next = prev.map((f) =>
        f.id === id ? { ...f, collapsed } : f,
      );
      persist(next);
      return next;
    });
  }, [persist]);

  return {
    folders,
    loaded,
    create,
    rename,
    remove,
    move,
    toggleCollapse,
    setCollapsed,
  };
}

export type WorkflowFoldersHook = ReturnType<typeof useWorkflowFolders>;

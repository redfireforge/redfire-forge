import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Workflow } from '../types/workflow';
import {
  loadWorkflows,
  saveWorkflows,
  loadSelectedWorkflowId,
  saveSelectedWorkflowId,
  compactWorkflowStorage,
} from '@shared/utils/storage';
import { migrateWorkflowSchema } from '../utils/workflowMigrations';
import { WORKFLOW_SCHEMA_VERSION } from './useWorkflowPersistence';
import { moveWorkflow } from '../utils/workflowFolderTree';

function mergeStoredWithPending(stored: Workflow[], pending: Workflow[]): Workflow[] {
  if (pending.length === 0) return stored;
  const merged = [...stored];
  for (const wf of pending) {
    if (!merged.some((w) => w.id === wf.id)) merged.push(wf);
  }
  return merged;
}

function resolveSelectionAfterLoad(
  currentSelectedId: string | null,
  merged: Workflow[],
  storedSelectedId: string | null,
): string | null {
  if (currentSelectedId && merged.some((w) => w.id === currentSelectedId)) {
    return currentSelectedId;
  }
  if (storedSelectedId && merged.some((w) => w.id === storedSelectedId)) {
    return storedSelectedId;
  }
  return null;
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const workflowsRef = useRef(workflows);
  workflowsRef.current = workflows;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [wfs, storedSelectedId] = await Promise.all([
        loadWorkflows(),
        loadSelectedWorkflowId(),
      ]);
      if (cancelled) return;
      // Repair any legacy/seeded workflow persisted without an id (renders with a
      // duplicate/undefined React key otherwise). Runs before migrate comparison so
      // the healed ids get written back to storage.
      const next = wfs
        .map(migrateWorkflowSchema)
        .map((wf) => (wf.id ? wf : { ...wf, id: uuidv4() }));
      const migrated = JSON.stringify(next) !== JSON.stringify(wfs);
      if (migrated) {
        await saveWorkflows(next);
      }
      if (cancelled) return;

      // Auto-compact when workflows exceed 2 MB to prevent QuotaExceededError
      const approxSizeKB = JSON.stringify(next).length * 2 / 1024;
      if (approxSizeKB > 2048) {
        const result = await compactWorkflowStorage(5);
        if (result.beforeKB !== result.afterKB) {
          console.info(`[Workflows] Auto-compacted versions: ${result.beforeKB} KB → ${result.afterKB} KB`);
        }
      }
      if (cancelled) return;

      let initialSelected: string | null = null;
      if (storedSelectedId && next.some((w) => w.id === storedSelectedId)) {
        initialSelected = storedSelectedId;
      } else if (storedSelectedId) {
        void saveSelectedWorkflowId(null);
      }

      const pending = workflowsRef.current;
      const merged = mergeStoredWithPending(next, pending);
      if (merged.length !== next.length) {
        void saveWorkflows(merged);
      }

      const resolvedSelected = resolveSelectionAfterLoad(
        selectedIdRef.current,
        merged,
        initialSelected,
      );

      setWorkflows(merged);
      setSelectedId(resolvedSelected);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSelectedWorkflowId(selectedId);
  }, [loaded, selectedId]);

  /** Ensure a workflow is selected when the list is non-empty (invalid id, missing storage, or after delete). */
  useEffect(() => {
    if (!loaded) return;
    const missing = selectedId === null && workflows.length > 0;
    const invalid = selectedId != null && !workflows.some((w) => w.id === selectedId);
    if (!missing && !invalid) return;
    const sorted = [...workflows].sort((a, b) => b.updatedAt - a.updatedAt);
    const pick = sorted[0]?.id ?? null;
    setSelectedId(pick);  
    void saveSelectedWorkflowId(pick);
  }, [loaded, workflows, selectedId]);

  const create = useCallback((name: string): Workflow => {
    const startNodeId = uuidv4();
    const wf: Workflow = {
      id: uuidv4(),
      name,
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      variables: {},
      hostProfiles: [],
      authProfiles: [],
      services: [],
      nodes: [
        {
          id: startNodeId,
          type: 'start',
          position: { x: 250, y: 50 },
          data: { label: 'Start', inputVariables: {} },
        },
      ],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setWorkflows((prev) => {
      const next = [...prev, wf];
      void saveWorkflows(next);
      return next;
    });
    setSelectedId(wf.id);
    return wf;
  }, []);

  /** Always merges into the latest workflows (avoids stale closure if multiple updates batch). */
  const update = useCallback((id: string, patch: Partial<Omit<Workflow, 'id' | 'createdAt'>>) => {
    setWorkflows((prev) => {
      const next = prev.map((wf) => (wf.id === id ? { ...wf, ...patch, updatedAt: Date.now() } : wf));
      void saveWorkflows(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setWorkflows((prev) => {
      const next = prev.filter((wf) => wf.id !== id);
      void saveWorkflows(next);
      return next;
    });
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const insert = useCallback((wf: Workflow) => {
    // Seeded/imported workflows (e.g. demo lessons via the bridge) can arrive
    // without an `id`. Guarantee one so React list keys stay unique — a missing
    // id renders as key={undefined} and triggers the "unique key prop" warning.
    const wfWithId: Workflow = wf.id ? wf : { ...wf, id: uuidv4() };
    setWorkflows((prev) => {
      if (prev.some((w) => w.id === wfWithId.id)) {
        return prev;
      }
      const next = [...prev, wfWithId];
      void saveWorkflows(next);
      return next;
    });
    setSelectedId(wfWithId.id);
  }, []);

  const reorder = useCallback((workflowId: string, newFolderId: string | null, newOrder: number) => {
    setWorkflows((prev) => {
      const next = moveWorkflow(workflowId, newFolderId, newOrder, prev);
      void saveWorkflows(next);
      return next;
    });
  }, []);

  const duplicate = useCallback((id: string) => {
    let copyId: string | null = null;
    setWorkflows((prev) => {
      const src = prev.find((wf) => wf.id === id);
      if (!src) return prev;
      copyId = uuidv4();
      const copy: Workflow = {
        ...structuredClone(src),
        id: copyId,
        name: `${src.name} (copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const next = [...prev, copy];
      void saveWorkflows(next);
      return next;
    });
    if (copyId) setSelectedId(copyId);
  }, []);

  const selected = workflows.find((wf) => wf.id === selectedId) ?? null;

  return {
    workflows,
    selected,
    selectedId,
    loaded,
    select: setSelectedId,
    create,
    insert,
    update,
    reorder,
    remove,
    duplicate,
  };
}

export type WorkflowHook = ReturnType<typeof useWorkflows>;

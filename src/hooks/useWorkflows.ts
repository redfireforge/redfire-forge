import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Workflow } from '../types/workflow';
import { createSampleWorkflow } from '../data/sampleWorkflow';
import {
  loadWorkflows,
  saveWorkflows,
  loadWorkflowSampleDismissed,
  saveWorkflowSampleDismissed,
  loadSelectedWorkflowId,
  saveSelectedWorkflowId,
} from '../utils/storage';
import { migrateWorkflowSchema } from '../utils/workflowMigrations';

const WORKFLOW_SCHEMA_VERSION = 3;

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [wfs, dismissed, storedSelectedId] = await Promise.all([
        loadWorkflows(),
        loadWorkflowSampleDismissed(),
        loadSelectedWorkflowId(),
      ]);
      if (cancelled) return;
      let next = wfs.map(migrateWorkflowSchema);
      const migrated = JSON.stringify(next) !== JSON.stringify(wfs);
      if (!dismissed && !next.some((w) => w.id === 'sample-workflow-001')) {
        next = [migrateWorkflowSchema(createSampleWorkflow()), ...next];
        await saveWorkflows(next);
      } else if (migrated) {
        await saveWorkflows(next);
      }
      if (cancelled) return;

      let initialSelected: string | null = null;
      if (storedSelectedId && next.some((w) => w.id === storedSelectedId)) {
        initialSelected = storedSelectedId;
      } else if (storedSelectedId) {
        void saveSelectedWorkflowId(null);
      }

      setWorkflows(next);
      setSelectedId(initialSelected);
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
    const wf: Workflow = {
      id: uuidv4(),
      name,
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      variables: {},
      hostProfiles: [],
      authProfiles: [],
      services: [],
      nodes: [],
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
    if (id === 'sample-workflow-001') {
      void saveWorkflowSampleDismissed(true);
    }
    setWorkflows((prev) => {
      const next = prev.filter((wf) => wf.id !== id);
      void saveWorkflows(next);
      return next;
    });
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const insert = useCallback((wf: Workflow) => {
    setWorkflows((prev) => {
      if (prev.some((w) => w.id === wf.id)) {
        return prev;
      }
      if (wf.id === 'sample-workflow-001') {
        void saveWorkflowSampleDismissed(false);
      }
      const next = [...prev, wf];
      void saveWorkflows(next);
      return next;
    });
    setSelectedId(wf.id);
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
    remove,
    duplicate,
  };
}

export type WorkflowHook = ReturnType<typeof useWorkflows>;

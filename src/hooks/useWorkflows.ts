import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Workflow } from '../types/workflow';
import { loadWorkflows, saveWorkflows } from '../utils/storage';

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadWorkflows().then((wfs) => {
      setWorkflows(wfs);
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((next: Workflow[]) => {
    setWorkflows(next);
    saveWorkflows(next);
  }, []);

  const create = useCallback((name: string): Workflow => {
    const wf: Workflow = {
      id: uuidv4(),
      name,
      variables: {},
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([...workflows, wf]);
    setSelectedId(wf.id);
    return wf;
  }, [workflows, persist]);

  const update = useCallback((id: string, patch: Partial<Omit<Workflow, 'id' | 'createdAt'>>) => {
    persist(workflows.map(wf => wf.id === id ? { ...wf, ...patch, updatedAt: Date.now() } : wf));
  }, [workflows, persist]);

  const remove = useCallback((id: string) => {
    persist(workflows.filter(wf => wf.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [workflows, selectedId, persist]);

  const duplicate = useCallback((id: string) => {
    const src = workflows.find(wf => wf.id === id);
    if (!src) return;
    const copy: Workflow = {
      ...structuredClone(src),
      id: uuidv4(),
      name: `${src.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([...workflows, copy]);
    setSelectedId(copy.id);
  }, [workflows, persist]);

  const selected = workflows.find(wf => wf.id === selectedId) ?? null;

  return {
    workflows,
    selected,
    selectedId,
    loaded,
    select: setSelectedId,
    create,
    update,
    remove,
    duplicate,
  };
}

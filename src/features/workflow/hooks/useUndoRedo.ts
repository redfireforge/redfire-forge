import { useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  label: string;
}

const MAX_UNDO = 50;
const STORAGE_PREFIX = 'perf-test-wf-undo-';

/** Build localStorage key for a workflow's undo stack. */
function storageKey(workflowId: string): string {
  return `${STORAGE_PREFIX}${workflowId}`;
}

/** Save undo stack to localStorage (debounced externally). */
function persistStack(workflowId: string | null, stack: Snapshot[]): void {
  if (!workflowId) return;
  try {
    // Only persist last 10 snapshots to keep localStorage usage reasonable
    const toSave = stack.slice(-10);
    localStorage.setItem(storageKey(workflowId), JSON.stringify(toSave));
  } catch {
    // localStorage may be full — silently drop
  }
}

/** Load undo stack from localStorage. */
function loadStack(workflowId: string | null): Snapshot[] {
  if (!workflowId) return [];
  try {
    const raw = localStorage.getItem(storageKey(workflowId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useUndoRedo(
  getNodes: () => Node[],
  getEdges: () => Edge[],
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void,
  workflowId?: string | null,
) {
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const currentWorkflowId = useRef<string | null>(null);
  // Track whether we have items (for re-render triggers)
  const canUndoRef = useRef(false);
  const canRedoRef = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistStack(currentWorkflowId.current, undoStack.current);
    }, 500);
  }, []);

  // Load persisted stack when workflow changes
  useEffect(() => {
    const wfId = workflowId ?? null;
    currentWorkflowId.current = wfId;
    const loaded = loadStack(wfId);
    undoStack.current = loaded;
    redoStack.current = [];
    canUndoRef.current = loaded.length > 0;
    canRedoRef.current = false;
  }, [workflowId]);

  const takeSnapshot = useCallback((label: string) => {
    const snap: Snapshot = {
      nodes: structuredClone(getNodes()),
      edges: structuredClone(getEdges()),
      label,
    };
    undoStack.current.push(snap);
    if (undoStack.current.length > MAX_UNDO) {
      undoStack.current.shift();
    }
    // Clear redo stack on new action
    redoStack.current = [];
    canUndoRef.current = true;
    canRedoRef.current = false;
    schedulePersist();
  }, [getNodes, getEdges, schedulePersist]);

  const undo = useCallback((): string | null => {
    const snap = undoStack.current.pop();
    if (!snap) return null;
    // Push current state to redo
    redoStack.current.push({
      nodes: structuredClone(getNodes()),
      edges: structuredClone(getEdges()),
      label: snap.label,
    });
    setNodes(snap.nodes);
    setEdges(snap.edges);
    canUndoRef.current = undoStack.current.length > 0;
    canRedoRef.current = true;
    schedulePersist();
    return snap.label;
  }, [getNodes, getEdges, setNodes, setEdges, schedulePersist]);

  const redo = useCallback((): string | null => {
    const snap = redoStack.current.pop();
    if (!snap) return null;
    undoStack.current.push({
      nodes: structuredClone(getNodes()),
      edges: structuredClone(getEdges()),
      label: snap.label,
    });
    setNodes(snap.nodes);
    setEdges(snap.edges);
    canUndoRef.current = true;
    canRedoRef.current = redoStack.current.length > 0;
    schedulePersist();
    return snap.label;
  }, [getNodes, getEdges, setNodes, setEdges, schedulePersist]);

  const canUndo = useCallback(() => undoStack.current.length > 0, []);
  const canRedo = useCallback(() => redoStack.current.length > 0, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    canUndoRef.current = false;
    canRedoRef.current = false;
    if (currentWorkflowId.current) {
      try { localStorage.removeItem(storageKey(currentWorkflowId.current)); } catch { /* ignore */ }
    }
  }, []);

  return { takeSnapshot, undo, redo, canUndo, canRedo, clear };
}

import { useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  label: string;
}

const MAX_UNDO = 50;

export function useUndoRedo(
  getNodes: () => Node[],
  getEdges: () => Edge[],
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void,
) {
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  // Track whether we have items (for re-render triggers)
  const canUndoRef = useRef(false);
  const canRedoRef = useRef(false);

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
  }, [getNodes, getEdges]);

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
    return snap.label;
  }, [getNodes, getEdges, setNodes, setEdges]);

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
    return snap.label;
  }, [getNodes, getEdges, setNodes, setEdges]);

  const canUndo = useCallback(() => undoStack.current.length > 0, []);
  const canRedo = useCallback(() => redoStack.current.length > 0, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    canUndoRef.current = false;
    canRedoRef.current = false;
  }, []);

  return { takeSnapshot, undo, redo, canUndo, canRedo, clear };
}

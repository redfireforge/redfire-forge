import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useReactFlow } from '@xyflow/react';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { defaultNodeData } from '../utils/workflowNodeFactory';
import type { WorkflowNodeType, WorkflowNode } from '../types/workflow';
import { findClosestEdge } from '../utils/workflowEdgeGeometry';

interface UseWorkflowDragDropOptions {
  nodesRef: React.RefObject<WorkflowRFNode[]>;
  edgesRef: React.RefObject<WorkflowRFEdge[]>;
  selected: { id: string } | null;
  addNodeToCanvas: (type: WorkflowNodeType) => void;
  insertNodeAndPersist: (newNode: WorkflowRFNode, snapshotLabel: string) => void;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowRFNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkflowRFEdge[]>>;
  serializeNodes: (rfNodes: WorkflowRFNode[]) => WorkflowNode[];
  serializeEdges: (rfEdges: WorkflowRFEdge[]) => { id: string; source: string; target: string; sourceHandle?: string; label?: string }[];
  update: (id: string, data: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string; sourceHandle?: string; label?: string }[] }) => void;
  undoRedo: { takeSnapshot: (label: string) => void };
}

export function useWorkflowDragDrop({
  nodesRef,
  edgesRef,
  selected,
  addNodeToCanvas,
  insertNodeAndPersist,
  setNodes,
  setEdges,
  serializeNodes,
  serializeEdges,
  update,
  undoRedo,
}: UseWorkflowDragDropOptions) {
  const rfInstance = useReactFlow();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropTargetEdgeId, setDropTargetEdgeId] = useState<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  /** Find the closest edge to a flow-space point, within a threshold distance. */
  const findClosest = useCallback((flowPos: { x: number; y: number }, threshold = 60): WorkflowRFEdge | null => {
    return findClosestEdge(flowPos, nodesRef.current, edgesRef.current, threshold);
  }, [nodesRef, edgesRef]);

  const lastEdgeCheckTime = useRef(0);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/reactflow-type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);

      const now = performance.now();
      if (now - lastEdgeCheckTime.current > 16) {
        lastEdgeCheckTime.current = now;
        const flowPos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const closest = findClosest(flowPos);
        setDropTargetEdgeId(prev => {
          const next = closest?.id ?? null;
          return prev === next ? prev : next;
        });
      }
    }
  }, [rfInstance, findClosest]);

  const handleCanvasDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDropTargetEdgeId(null);
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropTargetEdgeId(null);
    const type = e.dataTransfer.getData('application/reactflow-type') as WorkflowNodeType;
    if (!type || !selected) return;

    const bounds = canvasAreaRef.current?.querySelector('.react-flow')?.getBoundingClientRect();
    if (!bounds) { addNodeToCanvas(type); return; }

    const position = rfInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    const newNode: WorkflowRFNode = {
      id: uuidv4(),
      type,
      position,
      data: defaultNodeData(type),
    };

    // Check if dropping on an edge → split it
    const closestEdge = findClosest(position);
    if (closestEdge) {
      undoRedo.takeSnapshot('Insert node on edge');
      const newEdge1: WorkflowRFEdge = {
        id: uuidv4(),
        source: closestEdge.source,
        target: newNode.id,
        sourceHandle: closestEdge.sourceHandle,
        label: closestEdge.label,
      };
      const newEdge2: WorkflowRFEdge = {
        id: uuidv4(),
        source: newNode.id,
        target: closestEdge.target,
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => {
        const updated = eds.filter(e2 => e2.id !== closestEdge.id).concat(newEdge1, newEdge2);
        const wfNodes = serializeNodes([...rfInstance.getNodes() as WorkflowRFNode[], newNode]);
        const wfEdges = serializeEdges(updated);
        queueMicrotask(() => update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges }));
        return updated;
      });
      return;
    }

    insertNodeAndPersist(newNode, 'Add node');
  }, [selected, addNodeToCanvas, insertNodeAndPersist, rfInstance, findClosest, setNodes, setEdges, serializeNodes, serializeEdges, update, undoRedo]);

  return {
    isDragOver,
    dropTargetEdgeId,
    canvasAreaRef,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
  };
}

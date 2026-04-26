import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useReactFlow } from '@xyflow/react';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { defaultNodeData } from '../utils/workflowNodeFactory';
import type { WorkflowNodeType, WorkflowNode } from '../types/workflow';

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
  const findClosestEdge = useCallback((flowPos: { x: number; y: number }, threshold = 60): WorkflowRFEdge | null => {
    const rfNodes = nodesRef.current;
    const rfEdges = edgesRef.current;
    const nodeMap = new Map(rfNodes.map(n => [n.id, n]));

    // Special handles that indicate branching edges (should not be split)
    const branchHandles = new Set(['true', 'false', 'body', 'catch', 'done']);

    let bestEdge: WorkflowRFEdge | null = null;
    let bestDist = threshold;

    for (const edge of rfEdges) {
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);
      if (!srcNode || !tgtNode) continue;
      if (edge.sourceHandle && branchHandles.has(edge.sourceHandle)) continue;
      if (edge.sourceHandle && edge.sourceHandle.startsWith('case-')) continue;

      const sw = (srcNode.measured?.width ?? (srcNode as unknown as { width?: number }).width ?? 160);
      const sh = (srcNode.measured?.height ?? (srcNode as unknown as { height?: number }).height ?? 60);
      const tw = (tgtNode.measured?.width ?? (tgtNode as unknown as { width?: number }).width ?? 160);
      const sx = srcNode.position.x + sw / 2;
      const sy = srcNode.position.y + sh;
      const tx = tgtNode.position.x + tw / 2;
      const ty = tgtNode.position.y;

      const dx = tx - sx, dy = ty - sy;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0, Math.min(1, ((flowPos.x - sx) * dx + (flowPos.y - sy) * dy) / lenSq));
      const px = sx + t * dx, py = sy + t * dy;
      const dist = Math.sqrt((flowPos.x - px) ** 2 + (flowPos.y - py) ** 2);

      if (dist < bestDist) {
        bestDist = dist;
        bestEdge = edge;
      }
    }
    return bestEdge;
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
        const closest = findClosestEdge(flowPos);
        setDropTargetEdgeId(prev => {
          const next = closest?.id ?? null;
          return prev === next ? prev : next;
        });
      }
    }
  }, [rfInstance, findClosestEdge]);

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
    const closestEdge = findClosestEdge(position);
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
        const wfNodes = serializeNodes([...rfInstance.getNodes(), newNode]);
        const wfEdges = serializeEdges(updated);
        queueMicrotask(() => update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges }));
        return updated;
      });
      return;
    }

    insertNodeAndPersist(newNode, 'Add node');
  }, [selected, addNodeToCanvas, insertNodeAndPersist, rfInstance, findClosestEdge, setNodes, setEdges, serializeNodes, serializeEdges, update, undoRedo]);

  return {
    isDragOver,
    dropTargetEdgeId,
    canvasAreaRef,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
  };
}

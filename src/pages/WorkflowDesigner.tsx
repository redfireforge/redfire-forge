import { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

import type { RequestCollection, Scenario } from '../types';
import type { CatalogEntry } from '../types/catalog';
import type { Workflow, WorkflowNode, WorkflowNodeType, WorkflowNodeData, HttpNodeData, ConditionNodeData, DelayNodeData, NodeRunStatus } from '../types/workflow';
import { useWorkflows } from '../hooks/useWorkflows';
import { runGraph, type GraphRunCallbacks } from '../engine/workflow/graphRunner';

import WorkflowToolbar from '../components/workflow/WorkflowToolbar';
import WorkflowPalette from '../components/workflow/WorkflowPalette';
import WorkflowConfigPanel from '../components/workflow/WorkflowConfigPanel';
import WorkflowStatusBar from '../components/workflow/WorkflowStatusBar';
import VariableContextBar from '../components/workflow/VariableContextBar';
import HttpStepNode from '../components/workflow/nodes/HttpStepNode';
import ConditionNode from '../components/workflow/nodes/ConditionNode';
import DelayNode from '../components/workflow/nodes/DelayNode';

interface Props {
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
}

const nodeTypes = {
  http: HttpStepNode,
  condition: ConditionNode,
  delay: DelayNode,
};

function makeEmptyScenario(): Scenario {
  return {
    id: uuidv4(), name: 'New Request', url: '', method: 'GET',
    headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
  };
}

function defaultNodeData(type: WorkflowNodeType): WorkflowNodeData {
  switch (type) {
    case 'http': return { label: 'HTTP Request', scenario: makeEmptyScenario() } as HttpNodeData;
    case 'condition': return { label: 'If/Else', left: '{{status}}', operator: '==', right: '200' } as ConditionNodeData;
    case 'delay': return { label: 'Delay', delayMs: 1000, mode: 'fixed' } as DelayNodeData;
  }
}

export default function WorkflowDesigner({ collections, catalogEntries }: Props) {
  const wfHook = useWorkflows();
  const { workflows, selected, create, update, remove, duplicate, select } = wfHook;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeRunStatus>>({});
  const [liveVariables, setLiveVariables] = useState<Record<string, string>>({});
  const [lastRunStatus, setLastRunStatus] = useState<'idle' | 'running' | 'pass' | 'fail'>('idle');
  const [lastRunTime, setLastRunTime] = useState<number | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const nextNodeY = useRef(100);

  // Sync React Flow state when a workflow is selected
  const loadWorkflow = useCallback((wf: Workflow) => {
    const rfNodes: Node[] = wf.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data },
      selected: false,
    }));
    const rfEdges: Edge[] = wf.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      label: e.label,
      animated: false,
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
    setSelectedNodeId(null);
    setNodeStatuses({});
    setLiveVariables(wf.variables);
    setLastRunStatus('idle');
    nextNodeY.current = Math.max(100, ...wf.nodes.map(n => n.position.y + 120));
  }, [setNodes, setEdges]);

  const handleSelect = useCallback((id: string) => {
    select(id);
    const wf = workflows.find(w => w.id === id);
    if (wf) loadWorkflow(wf);
  }, [workflows, select, loadWorkflow]);

  const handleNew = useCallback(() => {
    const name = prompt('Workflow name:');
    if (!name?.trim()) return;
    const wf = create(name.trim());
    loadWorkflow(wf);
  }, [create, loadWorkflow]);

  const handleRename = useCallback(() => {
    if (!selected) return;
    const name = prompt('Rename workflow:', selected.name);
    if (!name?.trim()) return;
    update(selected.id, { name: name.trim() });
  }, [selected, update]);

  const handleDelete = useCallback(() => {
    if (!selected) return;
    if (!confirm(`Delete "${selected.name}"?`)) return;
    remove(selected.id);
    setNodes([]);
    setEdges([]);
  }, [selected, remove, setNodes, setEdges]);

  const handleDuplicate = useCallback(() => {
    if (!selected) return;
    handleSave();
    duplicate(selected.id);
  }, [selected, duplicate]);

  // Save current canvas state to the workflow
  const handleSave = useCallback(() => {
    if (!selected) return;
    const wfNodes: WorkflowNode[] = nodes.map(n => ({
      id: n.id,
      type: n.type as WorkflowNodeType,
      position: n.position,
      data: n.data as WorkflowNodeData,
    }));
    const wfEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));
    update(selected.id, { nodes: wfNodes, edges: wfEdges, variables: liveVariables });
  }, [selected, nodes, edges, liveVariables, update]);

  const onConnect: OnConnect = useCallback((params) => {
    const newEdge: Edge = {
      ...params,
      id: uuidv4(),
      animated: false,
      label: params.sourceHandle === 'true' ? 'Yes' : params.sourceHandle === 'false' ? 'No' : undefined,
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const addNodeToCanvas = useCallback((type: WorkflowNodeType, data?: WorkflowNodeData) => {
    if (!selected) return;
    const y = nextNodeY.current;
    nextNodeY.current += 120;
    const newNode: Node = {
      id: uuidv4(),
      type,
      position: { x: 300, y },
      data: data ?? defaultNodeData(type),
    };
    setNodes((nds) => [...nds, newNode]);
  }, [selected, setNodes]);

  const handleAddNode = useCallback((type: WorkflowNodeType) => {
    addNodeToCanvas(type);
  }, [addNodeToCanvas]);

  const handleAddFromRequest = useCallback((collectionId: string, requestId: string) => {
    const col = collections.find(c => c.id === collectionId);
    if (!col) return;

    let req = col.requests.find(r => r.id === requestId);
    if (!req) {
      const searchFolders = (folders?: import('../types').RequestFolder[]): import('../types').RequestItem | undefined => {
        if (!folders) return undefined;
        for (const f of folders) {
          const found = f.requests.find(r => r.id === requestId);
          if (found) return found;
          const deeper = searchFolders(f.folders);
          if (deeper) return deeper;
        }
        return undefined;
      };
      req = searchFolders(col.folders);
    }
    if (!req) return;

    const scenario: Scenario = {
      id: uuidv4(), name: req.name, url: req.url, method: req.method as Scenario['method'],
      headers: req.headers ?? [], body: req.body ?? '', bodyType: req.bodyType,
      bodyForm: req.bodyForm, auth: req.auth ?? { type: 'none' }, validation: { mode: 'none' },
    };
    const data: HttpNodeData = { label: req.name, scenario, sourceType: 'requests', sourceId: req.id };
    addNodeToCanvas('http', data);
  }, [collections, addNodeToCanvas]);

  const handleAddFromCatalog = useCallback((entryId: string, endpointId: string) => {
    const entry = catalogEntries.find(e => e.id === entryId);
    const ep = entry?.endpoints.find(e => e.id === endpointId);
    if (!ep || !entry) return;

    const baseUrl = entry.servers[0]?.url ?? '';
    const scenario: Scenario = {
      id: uuidv4(), name: ep.summary || ep.path, url: `${baseUrl}${ep.path}`,
      method: ep.method.toUpperCase() as Scenario['method'],
      headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
    };
    const data: HttpNodeData = { label: ep.summary || ep.path, scenario, sourceType: 'catalog', sourceId: ep.id };
    addNodeToCanvas('http', data);
  }, [catalogEntries, addNodeToCanvas]);

  const handleUpdateNode = useCallback((id: string, data: WorkflowNodeData) => {
    setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...data } } : n));
  }, [setNodes]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter(n => n.id !== id));
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [setNodes, setEdges, selectedNodeId]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleUpdateVariables = useCallback((vars: Record<string, string>) => {
    setLiveVariables(vars);
  }, []);

  // ── Quick Test ───────────────────────────────────────

  const handleQuickTest = useCallback(() => {
    if (isRunning) {
      abortRef.current?.abort();
      return;
    }

    if (!selected || nodes.length === 0) return;

    setIsRunning(true);
    setLastRunStatus('running');
    setNodeStatuses({});

    abortRef.current = new AbortController();

    const wfNodes: WorkflowNode[] = nodes.map(n => ({
      id: n.id,
      type: n.type as WorkflowNodeType,
      position: n.position,
      data: n.data as WorkflowNodeData,
    }));
    const wfEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));

    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (nodeId, status) => {
        setNodeStatuses(prev => ({ ...prev, [nodeId]: status }));
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, runStatus: status } } : n));
      },
      onVariablesChange: (vars) => {
        setLiveVariables(vars);
      },
      onComplete: (_results, passed, durationMs) => {
        setIsRunning(false);
        setLastRunStatus(passed ? 'pass' : 'fail');
        setLastRunTime(durationMs);
      },
    };

    runGraph(wfNodes, wfEdges, liveVariables, callbacks, abortRef.current.signal).catch(() => {
      setIsRunning(false);
      setLastRunStatus('fail');
    });
  }, [isRunning, selected, nodes, edges, liveVariables, setNodes]);

  // Compute selected node from React Flow nodes for config panel
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find(n => n.id === selectedNodeId);
    if (!n) return null;
    return { id: n.id, type: n.type as WorkflowNodeType, position: n.position, data: n.data as WorkflowNodeData } as WorkflowNode;
  }, [selectedNodeId, nodes]);

  const variableCount = Object.keys(liveVariables).length;

  // ── Render ───────────────────────────────────────────

  if (!selected) {
    return (
      <div className="wf-designer">
        <WorkflowToolbar
          workflows={workflows} selected={null} isRunning={false}
          onNew={handleNew} onSelect={handleSelect} onSave={() => {}} onRename={() => {}}
          onDelete={() => {}} onDuplicate={() => {}} onQuickTest={() => {}}
        />
        <div className="wf-empty-state">
          <div className="wf-empty-icon">⚡</div>
          <h2>Workflow Designer</h2>
          <p>Design multi-step API workflows with variable chaining, conditions, and delays.</p>
          <p style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={handleNew}>+ Create New Workflow</button>
            {workflows.length > 0 && <span style={{ margin: '0 12px', color: 'var(--text-muted)' }}>or select an existing one above</span>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wf-designer">
      <WorkflowToolbar
        workflows={workflows} selected={selected} isRunning={isRunning}
        onNew={handleNew} onSelect={handleSelect} onSave={handleSave} onRename={handleRename}
        onDelete={handleDelete} onDuplicate={handleDuplicate} onQuickTest={handleQuickTest}
      />

      <div className="wf-body">
        <WorkflowPalette
          collections={collections}
          catalogEntries={catalogEntries}
          onAddNode={handleAddNode}
          onAddFromRequest={handleAddFromRequest}
          onAddFromCatalog={handleAddFromCatalog}
        />

        <div className="wf-canvas-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{ animated: false, style: { stroke: 'var(--border)', strokeWidth: 2 } }}
          >
            <Controls />
            <MiniMap style={{ background: 'var(--surface)' }} />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          </ReactFlow>

          {Object.keys(liveVariables).length > 0 && (
            <VariableContextBar variables={liveVariables} />
          )}
        </div>

        <WorkflowConfigPanel
          node={selectedNode}
          variables={liveVariables}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onUpdateVariables={handleUpdateVariables}
        />
      </div>

      <WorkflowStatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        variableCount={variableCount}
        lastRunStatus={lastRunStatus}
        lastRunTime={lastRunTime}
      />
    </div>
  );
}

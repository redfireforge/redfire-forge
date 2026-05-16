import { useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';

import type { SubWorkflowNodeData, Workflow } from '../types/workflow';
import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';
import { nodeTypes, type WorkflowRFNode, type WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { WorkflowNodeRunContext, WorkflowDebugStepContext } from './panels/WorkflowNodeRunContext';
import { getNodeMiniMapColor } from '../utils/workflowDesignerUtils';
import WorkflowExecSummary from './panels/WorkflowExecSummary';
import VariableContextBadge from './panels/VariableContextBar';
import WorkflowNodeContextMenu from './canvas/WorkflowNodeContextMenu';
import WorkflowCanvasControls from './canvas/WorkflowCanvasControls';

/** Drop overlay, preview banner, React Flow instance, variable badge, and node context menu. */
export function WorkflowDesignerFlowCanvas({
  vm,
  selected,
}: {
  vm: WorkflowDesignerViewModel;
  selected: Workflow;
}) {
  const {
    isDragOver,
    dropTargetEdgeId,
    canvasAreaRef,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    previewWorkflow,
    runProgress,
    failedStepLabel,
    handleToggleConsole,
    serializeNodes,
    nodes,
    onUseAsTemplate,
    onClearPreview,
    nodeStatuses,
    isDebugMode,
    handleDebugStep,
    layoutVersion,
    laidOutId,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    handleNodeClick,
    openNodeConfig,
    handleNodeContextMenu,
    handlePaneClick,
    handleReactFlowInit,
    showMinimap,
    setShowMinimap,
    undoRedo: _undoRedo,
    handleUndoAction: _handleUndoAction,
    handleRedoAction: _handleRedoAction,
    handleAutoLayout: _handleAutoLayout,
    setNodes: _setNodes,
    runVariableSnapshot,
    workflowVariables,
    nodeCtxMenu,
    setSelectedNodeId,
    handleCopyNode,
    handleDuplicateNode,
    handleExtractToSubWorkflow,
    handleDeleteNode,
    navigateToWorkflow,
    setNodeCtxMenu,
    isRunning,
    handleQuickTest,
    persistWorkflow,
    update,
  } = vm;

  const { getViewport, setViewport, fitView } = useReactFlow();

  // Restore saved viewport when switching to a workflow that has one saved,
  // or fit view for workflows without a saved viewport.
  // onInit handles the initial mount; this handles subsequent workflow switches.
  // Uses setTimeout to let ReactFlow finish measuring node dimensions first.
  const prevWorkflowIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (previewWorkflow) return;
    if (!selected) return;
    if (prevWorkflowIdRef.current === selected.id) return;
    prevWorkflowIdRef.current = selected.id;
    if (selected.savedViewport) {
      setTimeout(() => {
        requestAnimationFrame(() => {
          setViewport(selected.savedViewport!, { duration: 0 });
        });
      }, 120);
    } else {
      setTimeout(() => {
        requestAnimationFrame(() => {
          fitView({ padding: 0.1, maxZoom: 1, duration: 200 });
        });
      }, 120);
    }
  }, [selected, previewWorkflow, setViewport, fitView]);

  return (
    <div
      className={`wf-canvas-area ${isDragOver ? 'wf-canvas-drag-over' : ''}`}
      ref={canvasAreaRef}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
    >
      {isDragOver && !dropTargetEdgeId && (
        <div className="wf-drop-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Drop here to add node
        </div>
      )}
      {isDragOver && dropTargetEdgeId && (
        <div className="wf-drop-indicator wf-drop-indicator-edge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="3"/></svg>
          Insert between nodes
        </div>
      )}
      {nodes.length === 0 && !previewWorkflow && !isDragOver && (
        <div className="wf-empty-canvas">
          <svg className="wf-empty-canvas-icon" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="12" width="26" height="16" rx="4" />
            <rect x="46" y="12" width="26" height="16" rx="4" />
            <rect x="27" y="52" width="26" height="16" rx="4" />
            <line x1="21" y1="28" x2="21" y2="40" />
            <line x1="21" y1="40" x2="40" y2="40" />
            <line x1="40" y1="40" x2="40" y2="52" />
            <line x1="59" y1="28" x2="59" y2="40" />
            <line x1="59" y1="40" x2="40" y2="40" />
            <circle cx="40" cy="40" r="2.5" fill="currentColor" stroke="none" />
          </svg>
          <p className="wf-empty-canvas-title">Drop your first node here</p>
          <p className="wf-empty-canvas-hint">Drag a block from the palette on the left, or press <kbd>⌘K</kbd> for commands</p>
        </div>
      )}
      {!previewWorkflow && (
        <WorkflowExecSummary
          runProgress={runProgress}
          failedStepLabel={failedStepLabel}
          onOpenConsole={handleToggleConsole}
        />
      )}
      {previewWorkflow && (
        <div className="wf-preview-banner">
          <span>📚 Sample Preview: <strong>{previewWorkflow.name}</strong></span>
          <span className="wf-preview-desc">{previewWorkflow.description}</span>
          <div className="wf-preview-actions">
            {isRunning && (
              <button className="btn btn-sm btn-danger" onClick={handleQuickTest} title="Stop running workflow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                {' '}Stop
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => {
              const currentNodes = serializeNodes(nodes);
              onUseAsTemplate({ ...previewWorkflow, nodes: currentNodes });
            }}>Use as Template</button>
            <button className="btn btn-sm" onClick={onClearPreview}>Close Preview</button>
          </div>
        </div>
      )}
      <WorkflowNodeRunContext.Provider value={nodeStatuses}>
      <WorkflowDebugStepContext.Provider value={isDebugMode ? handleDebugStep : null}>
        <ReactFlow<WorkflowRFNode, WorkflowRFEdge>
          key={layoutVersion}
          style={previewWorkflow && laidOutId !== selected?.id ? { visibility: 'hidden' as const } : undefined}
          nodes={nodes}
          edges={dropTargetEdgeId ? edges.map(e => e.id === dropTargetEdgeId ? { ...e, className: (e.className ? e.className + ' ' : '') + 'wf-edge-drop-target' } : e) : edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={(_event, node) => openNodeConfig(node.id)}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          onInit={handleReactFlowInit}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={40}
          deleteKeyCode={['Backspace', 'Delete']}
          edgesReconnectable
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: 'var(--border)', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 12, color: 'var(--border)' },
          }}
        >
          <WorkflowCanvasControls
            showMinimap={showMinimap}
            onToggleMinimap={() => setShowMinimap(v => !v)}
            disableLayout={!!previewWorkflow}
            savedViewport={selected.savedViewport}
            onSaveLayout={() => {
              if (selected) {
                persistWorkflow();
                const vp = getViewport();
                update(selected.id, { savedViewport: { x: vp.x, y: vp.y, zoom: vp.zoom } });
              }
            }}
          />
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              style={{ background: 'var(--surface)' }}
              nodeColor={(node) => getNodeMiniMapColor(node, nodeStatuses)}
            />
          )}
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              <marker id="wf-arrow-pass" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
              </marker>
              <marker id="wf-arrow-fail" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
              <marker id="wf-arrow-animated" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
              </marker>
            </defs>
          </svg>
        </ReactFlow>
      </WorkflowDebugStepContext.Provider>
      </WorkflowNodeRunContext.Provider>

      {Object.keys(runVariableSnapshot ?? workflowVariables).length > 0 && (
        <VariableContextBadge variables={runVariableSnapshot ?? workflowVariables} />
      )}

      <WorkflowNodeContextMenu
        open={!!nodeCtxMenu}
        x={nodeCtxMenu?.x ?? 0}
        y={nodeCtxMenu?.y ?? 0}
        onCopy={() => {
          if (!nodeCtxMenu) return;
          setSelectedNodeId(nodeCtxMenu.nodeId);
          handleCopyNode(nodeCtxMenu.nodeId);
        }}
        onDuplicate={() => {
          if (!nodeCtxMenu) return;
          setSelectedNodeId(nodeCtxMenu.nodeId);
          handleDuplicateNode(nodeCtxMenu.nodeId);
        }}
        onExtract={nodeCtxMenu ? (() => {
          handleExtractToSubWorkflow(nodeCtxMenu.nodeId);
        }) : undefined}
        onOpenChild={(() => {
          if (!nodeCtxMenu) return undefined;
          const n = nodes.find((x) => x.id === nodeCtxMenu.nodeId);
          if (n?.type !== 'subWorkflow') return undefined;
          const data = n.data as SubWorkflowNodeData;
          if (!data.workflowId) return undefined;
          return () => navigateToWorkflow(data.workflowId);
        })()}
        onDelete={() => {
          if (!nodeCtxMenu) return;
          handleDeleteNode(nodeCtxMenu.nodeId);
        }}
        onClose={() => setNodeCtxMenu(null)}
      />
    </div>
  );
}

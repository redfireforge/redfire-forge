import type { SubWorkflowNodeData } from '../types/workflow';
import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';
import WorkflowServiceRegistryModal from './modals/WorkflowServiceRegistryModal';
import WorkflowDebugBar from './WorkflowDebugBar';
import WorkflowConsolePanel from './panels/WorkflowConsolePanel';
import WorkflowShortcutsOverlay from './canvas/WorkflowShortcutsOverlay';
import WorkflowVersionDiff from './modals/WorkflowVersionDiff';
import WorkflowCommandPalette from './canvas/WorkflowCommandPalette';

/** Fullscreen / floating overlays outside WorkflowInspectProvider. */
export function WorkflowDesignerGlobalOverlays({ vm }: { vm: WorkflowDesignerViewModel }) {
  const {
    serviceRegistryMode,
    setServiceRegistryMode,
    workflowServices,
    environments,
    microservices,
    globalAuthProfiles,
    selectedEnvId,
    selected,
    handleServiceRegistryApply,
    isDebugMode,
    debugControllerRef,
    handleDebugStop,
    runVariableSnapshot,
    workflowVariables,
    nodes,
    navigateToWorkflow,
    consoleOpen,
    consoleLines,
    clearConsole,
    handleCloseConsole,
    latestStepSummaries,
    consoleRunBehavior,
    setConsoleRunBehavior,
    showShortcuts,
    setShowShortcuts,
    versioning,
    showCommandPalette,
    setShowCommandPalette,
    handleSave,
    handleQuickTest,
    handleDebugQuickTest,
    handleToggleConsole,
    handleAutoLayout,
    rfInstance,
    setShowMinimap,
    handleAddNode,
    setShowDefaultsModal,
    setSelectedNodeId,
  } = vm;

  return (
    <>
      <WorkflowServiceRegistryModal
        open={serviceRegistryMode === 'fullscreen'}
        services={workflowServices}
        environments={environments}
        microservices={microservices}
        globalAuthProfiles={globalAuthProfiles}
        selectedEnvId={selectedEnvId}
        workflowName={selected?.name}
        onApply={handleServiceRegistryApply}
        onClose={() => setServiceRegistryMode('closed')}
      />

      {isDebugMode && debugControllerRef.current && (
        <WorkflowDebugBar
          debugController={debugControllerRef.current}
          onStop={handleDebugStop}
          variableCount={Object.keys(runVariableSnapshot ?? workflowVariables).length}
          pausedSubWorkflowNodeId={(() => {
            if (!debugControllerRef.current) return null;
            const pausedIds = debugControllerRef.current.getPausedNodeIds();
            return pausedIds.find((nid) => nodes.find((n) => n.id === nid && n.type === 'subWorkflow')) ?? null;
          })()}
          onStepInto={(nodeId) => {
            const n = nodes.find((x) => x.id === nodeId);
            if (n?.type === 'subWorkflow') {
              const data = n.data as SubWorkflowNodeData;
              if (data.workflowId) navigateToWorkflow(data.workflowId);
            }
          }}
        />
      )}

      {consoleOpen && (
        <WorkflowConsolePanel
          lines={consoleLines}
          onClear={clearConsole}
          onClose={handleCloseConsole}
          stepSummaries={latestStepSummaries}
          runBehavior={consoleRunBehavior}
          onRunBehaviorChange={setConsoleRunBehavior}
        />
      )}

      <WorkflowShortcutsOverlay
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {versioning.versionDiffState && (
        <WorkflowVersionDiff
          open
          older={versioning.versionDiffState.older}
          newer={versioning.versionDiffState.newer}
          onClose={versioning.closeVersionDiff}
        />
      )}

      <WorkflowCommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={{
          onSave: handleSave,
          onQuickTest: handleQuickTest,
          onDebugTest: handleDebugQuickTest,
          onToggleConsole: handleToggleConsole,
          onAutoLayout: handleAutoLayout,
          onFitView: () => rfInstance.fitView({ padding: 0.2, duration: 300 }),
          onToggleMinimap: () => setShowMinimap((v) => !v),
          onOpenServices: () => {
            setServiceRegistryMode((m) => m === 'closed' ? 'panel' : 'closed');
            setSelectedNodeId(null);
          },
          onOpenDefaults: () => setShowDefaultsModal(true),
          onAddNode: handleAddNode,
          onOpenShortcuts: () => setShowShortcuts(true),
        }}
      />
    </>
  );
}

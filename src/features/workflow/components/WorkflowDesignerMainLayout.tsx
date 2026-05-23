import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';
import { WorkflowInspectProvider } from './panels/WorkflowInspectContext';
import WorkflowToolbar from './canvas/WorkflowToolbar';
import WorkflowBreadcrumb from './WorkflowBreadcrumb';
import WorkflowStatusBar from './canvas/WorkflowStatusBar';
import { WorkflowDesignerBody } from './WorkflowDesignerBody';
import { WorkflowDesignerInspectModals } from './WorkflowDesignerInspectModals';
import { WorkflowDesignerGlobalOverlays } from './WorkflowDesignerGlobalOverlays';

/** Main workflow designer shell when a workflow is selected (canvas, modals, status). */
export default function WorkflowDesignerMainLayout(vm: WorkflowDesignerViewModel) {
  const { selected } = vm;
  const onRunInHarness = vm.onRunInHarness;
  if (!selected) return null;

  return (
    <div className="wf-designer">
      <WorkflowToolbar
        workflows={vm.workflows}
        folders={vm.wfFolders}
        selected={selected}
        isRunning={vm.isRunning}
        saveAcknowledged={vm.saveAcknowledged}
        serviceCount={vm.workflowServices.length}
        variableCount={vm.variableCount}
        versionCount={vm.versioning.versionCount}
        environments={vm.environments}
        selectedEnvId={vm.selectedEnvId}
        onEnvSelect={vm.handleEnvSelect}
        workflowServices={vm.workflowServices}
        isPreview={!!vm.previewWorkflow}
        onSelect={vm.handleSelect}
        onSave={vm.handleSave}
        onQuickTest={vm.handleQuickTest}
        onDebugTest={vm.handleDebugQuickTest}
        isDebugMode={vm.isDebugMode}
        onOpenServices={() => {
          vm.setServiceRegistryMode((m) => m === 'closed' ? 'panel' : 'closed');
          vm.versioning.closeVersionPanel();
          vm.setSelectedNodeId(null);
        }}
        onOpenDefaults={() => vm.setShowDefaultsModal(true)}
        onOpenVersions={vm.versioning.openVersionPanel}
        runProgress={vm.runProgress}
        onReset={vm.handleResetRunStatus}
        onRunInHarness={onRunInHarness ? () => onRunInHarness(selected.id) : undefined}
      />

      <WorkflowInspectProvider value={vm.inspectActions}>

        {vm.navStack.length > 0 && selected && (
          <WorkflowBreadcrumb
            stack={vm.navStack}
            currentName={selected.name}
            onNavigate={vm.handleBreadcrumbNavigate}
          />
        )}

        <WorkflowDesignerBody vm={vm} selected={selected} />
        <WorkflowDesignerInspectModals vm={vm} />

      </WorkflowInspectProvider>

      <WorkflowDesignerGlobalOverlays vm={vm} />

      <WorkflowStatusBar
        nodeCount={vm.nodes.length}
        edgeCount={vm.edges.length}
        variableCount={vm.variableCount}
        lastRunStatus={vm.lastRunStatus}
        lastRunTime={vm.lastRunTime}
        lastRunError={vm.lastRunError}
        onOpenRunError={vm.openRunErrorDetail}
        runHistory={vm.runHistory}
        activeRunHistoryId={vm.activeRunHistoryId}
        onRestoreRunHistory={(id) => { vm.restoreRunFromHistory(id); vm.setActiveRunHistoryId(id); }}
        onDeleteRunHistoryEntry={(id) => {
          vm.deleteRunHistoryEntry(id);
          if (id === vm.activeRunHistoryId) vm.setActiveRunHistoryId(null);
        }}
        onClearRunHistory={() => { vm.clearRunHistory(); vm.setActiveRunHistoryId(null); }}
        consoleLineCount={vm.consoleLines.length}
        consoleOpen={vm.consoleOpen}
        onToggleConsole={vm.handleToggleConsole}
        runProgress={vm.runProgress}
      />
    </div>
  );
}

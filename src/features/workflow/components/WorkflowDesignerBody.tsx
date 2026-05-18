import type { Workflow } from '../types/workflow';
import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';

import WorkflowPalette from './canvas/WorkflowPalette';
import WorkflowServicesPanelInline from './panels/WorkflowServicesPanelInline';
import WorkflowVersionPanel from './panels/WorkflowVersionPanel';
import { WorkflowDesignerFlowCanvas } from './WorkflowDesignerFlowCanvas';

/** Palette, central canvas, and inline side panels (services + versions). */
export function WorkflowDesignerBody({
  vm,
  selected,
}: {
  vm: WorkflowDesignerViewModel;
  selected: Workflow;
}) {
  const {
    paletteWidth,
    startDrag,
    collections,
    catalogEntries,
    handleAddNode,
    handleAddFromRequest,
    handleAddFromCatalog,
    serviceRegistryMode,
    setServiceRegistryMode,
    versioning,
    workflowServices,
    environments,
    microservices,
    globalAuthProfiles,
    selectedEnvId,
  } = vm;

  return (
    <div className="wf-body">
      <div style={{ width: paletteWidth, flexShrink: 0 }}>
        <WorkflowPalette
          collections={collections}
          catalogEntries={catalogEntries}
          onAddNode={handleAddNode}
          onAddFromRequest={handleAddFromRequest}
          onAddFromCatalog={handleAddFromCatalog}
        />
      </div>

      <div
        className="wf-resize-handle"
        onMouseDown={(e) => startDrag('left', e)}
      />

      <WorkflowDesignerFlowCanvas vm={vm} selected={selected} />

      {serviceRegistryMode === 'panel' && (<>
        <div className="wf-resize-handle" onMouseDown={(e) => startDrag('right', e)} />
        <div style={{ width: 320, flexShrink: 0 }}>
          <WorkflowServicesPanelInline
            services={workflowServices}
            environments={environments}
            microservices={microservices}
            globalAuthProfiles={globalAuthProfiles}
            selectedEnvId={selectedEnvId}
            onExpand={() => setServiceRegistryMode('fullscreen')}
            onClose={() => setServiceRegistryMode('closed')}
          />
        </div>
      </>)}

      {versioning.versionPanelOpen && (<>
        <div className="wf-resize-handle" onMouseDown={(e) => startDrag('right', e)} />
        <div style={{ width: 320, flexShrink: 0 }}>
          <WorkflowVersionPanel
            versions={selected?.versions ?? []}
            onRestore={versioning.handleVersionRestore}
            onDelete={versioning.handleVersionDelete}
            onRename={versioning.handleVersionRename}
            onCompare={versioning.handleVersionCompare}
            onClose={versioning.closeVersionPanel}
          />
        </div>
      </>)}
    </div>
  );
}

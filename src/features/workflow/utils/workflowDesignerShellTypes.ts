import type { RequestCollection, Environment, Microservice, GlobalAuthProfile } from '../../../shared/types';
import type { CatalogEntry } from '../../catalog/types/catalog';
import type { Workflow, WorkflowFolder } from '../types/workflow';
import type { WorkflowHook } from '../hooks/useWorkflows';
import type { WorkflowPreviewEntry } from '../../../shared/utils/workflowPreviewStorage';

export interface WorkflowDesignerProps {
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
  /** User-local preview endpoints for the palette Catalog tab. */
  previewEndpoints?: WorkflowPreviewEntry[];
  wfHook: WorkflowHook;
  /**
   * Same Environment + Microservice selection as Harness; Quick Test injects `{{baseUrl}}`.
   * Initial variables override if you set `baseUrl` there explicitly.
   */
  environments: Environment[];
  microservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  selectedSvcId: string;
  onEnvSelect: (id: string) => void;
  onSvcSelect: (id: string) => void;
  resolvedBaseUrl: string;
  /** Workflow folder hierarchy for grouped display. */
  folders: WorkflowFolder[];
  /** Read-only sample workflow preview (not persisted). */
  previewWorkflow: Workflow | null;
  onClearPreview: () => void;
  onUseAsTemplate: (wf: Workflow) => void;
  /** Navigate to Workflow Runner with current workflow pre-selected for load testing. */
  onRunInHarness?: (workflowId: string) => void;
  /** Load a template workflow from gallery by sample ID. */
  onLoadTemplate?: (gallerySampleId: string) => void;
  /** Navigate to the gallery tab. */
  onBrowseGallery?: () => void;
}

export interface WorkflowNodeContextMenuData {
  x: number;
  y: number;
  nodeId: string;
}

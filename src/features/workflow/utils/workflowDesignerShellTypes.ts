import type { RequestCollection, Environment, Microservice, GlobalAuthProfile } from '../../../shared/types';
import type { CatalogEntry } from '../../catalog/types/catalog';
import type { Workflow } from '../types/workflow';
import type { WorkflowHook } from '../hooks/useWorkflows';

export interface WorkflowDesignerProps {
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
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
  /** Read-only sample workflow preview (not persisted). */
  previewWorkflow: Workflow | null;
  onClearPreview: () => void;
  onUseAsTemplate: (wf: Workflow) => void;
  /** Navigate to Workflow Runner with current workflow pre-selected for load testing. */
  onRunInHarness?: (workflowId: string) => void;
}

export interface WorkflowNodeContextMenuData {
  x: number;
  y: number;
  nodeId: string;
}

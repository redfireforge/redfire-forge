// ── Workflow graph ───────────────────────────────────

import type { RequestResult, SlaTarget } from '@shared/types';
import type { WorkflowAuthProfile, WorkflowHostProfile, WorkflowService } from './profiles-service';
import type { WorkflowNodeData, WorkflowNodeType } from './node-websocket';
import type { GrpcNodeStatusMeta } from './node-grpc';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

// ── Workflow Version History ─────────────────────────

export interface WorkflowVersion {
  id: string;
  timestamp: number;
  label?: string;
  fingerprint: string;
  nodeCount: number;
  edgeCount: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, string>;
  services?: WorkflowService[];
}

// ── Workflow folders ─────────────────────────────────

export interface WorkflowFolder {
  id: string;
  name: string;
  /** null / undefined = root-level folder. */
  parentId?: string;
  /** Position among siblings within the same parent. */
  order: number;
  /** Whether the folder is collapsed in the sidebar. */
  collapsed?: boolean;
}

// ── Saved workflow ───────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** Optional schema version used by one-time migrations. */
  schemaVersion?: number;
  /** Centralized service definitions with host + auth (replaces per-node config). */
  services?: WorkflowService[];
  /** @deprecated Use services instead. */
  hostProfiles?: WorkflowHostProfile[];
  /** @deprecated Use services instead. */
  authProfiles?: WorkflowAuthProfile[];
  /** Workflow-level error handling configuration. */
  errorConfig?: WorkflowErrorConfig;
  /** Saved version history snapshots. */
  versions?: WorkflowVersion[];
  /** Last environment selected when this workflow was active. */
  lastSelectedEnvId?: string;
  /** Gallery catalog entry ID this workflow was imported from (via "Use as Template"). */
  gallerySampleId?: string;
  /** Folder this workflow belongs to (undefined = unfiled / root). */
  folderId?: string;
  /** Position within the folder for drag-and-drop reordering. */
  folderOrder?: number;
  /** Saved canvas viewport (zoom + pan) from "Save layout". */
  savedViewport?: { x: number; y: number; zoom: number };
  /**
   * SLA targets defined as part of this workflow's definition.
   * Embedded into `TestConfig.slaTargets` at run time by WorkflowRunner.
   * Results view shows them as read-only ("📋 Workflow" badge).
   */
  slaTargets?: SlaTarget[];
  createdAt: number;
  updatedAt: number;
}

// ── Paused workflow state (correlation wait) ─────────

export interface WorkflowPausedState {
  /** Unique execution ID. */
  executionId: string;
  /** Workflow definition ID. */
  workflowId: string;
  /** Variable context snapshot (all layers merged). */
  variables: Record<string, string>;
  /** Set of visited node IDs. */
  visitedNodes: string[];
  /** ID of the node where execution paused. */
  pausedNodeId: string;
  /** Thread ID for parallel execution tracking. */
  threadId: string;
  /** Join barrier arrival counts. */
  joinArrived: Record<string, number>;
  /** Results collected so far. */
  results: RequestResult[];
  /** Execution start timestamp (ms). */
  startTime: number;
  /** Initial variables (from workflow definition). */
  initialVariables: Record<string, string>;
  /** Environment layer snapshot. */
  environmentLayer?: Record<string, string>;
}

// ── Workflow-level error handling ────────────────────

export type WorkflowErrorMode = 'stop' | 'continue' | 'run-handler';

export interface WorkflowErrorConfig {
  /** What to do when an unhandled node error occurs (no node-level Error Handler caught it). */
  mode: WorkflowErrorMode;
  /** Entry node ID of the error-handling subgraph (only when mode='run-handler'). */
  handlerEntryNodeId?: string;
  /** Variable name where the error message is stored (default: 'error.message'). */
  errorVariable?: string;
}

// ── Execution state (for canvas animation) ──────────

export type NodeRunState = 'idle' | 'pending' | 'running' | 'pass' | 'fail' | 'skipped' | 'paused';

export interface NodeRunStatus {
  state: NodeRunState;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
  extracted?: Record<string, string>;
  /** Full formatted detail for the step result modal (response + errors). */
  responseDetail?: string;
  /** Phase 6G — gRPC-specific diagnostics; present for grpcUnary/grpcServerStream/grpcAssert nodes. */
  grpcMeta?: GrpcNodeStatusMeta;
}


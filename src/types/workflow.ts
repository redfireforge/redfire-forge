import type { Scenario } from './index';

// ── Node data types ──────────────────────────────────

export interface HttpNodeData {
  label: string;
  scenario: Scenario;
  sourceType?: 'requests' | 'catalog';
  sourceId?: string;
  /**
   * When both are set, Quick Test uses this environment + microservice to resolve `{{baseUrl}}`
   * and path-only URLs for this step only. When omitted or incomplete, the harness bar selection applies.
   */
  hostEnvironmentId?: string;
  hostMicroserviceId?: string;
  /**
   * When set (e.g. request from a URL subcollection), used as `baseUrl` for this step if it cannot be
   * expressed as env + microservice alone.
   */
  hostBaseUrl?: string;
  /**
   * `{{name}}` values for this HTTP step only. Merged with workflow-level defaults and upstream
   * extractions when the step runs; highest priority for this step’s request resolution.
   */
  initialVariables?: Record<string, string>;
}

export interface ConditionNodeData {
  label: string;
  left: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not-contains' | 'regex';
  right: string;
}

export interface DelayNodeData {
  label: string;
  delayMs: number;
  mode: 'fixed' | 'random';
  minMs?: number;
  maxMs?: number;
}

export type WorkflowNodeType = 'http' | 'condition' | 'delay';

export type WorkflowNodeData = HttpNodeData | ConditionNodeData | DelayNodeData;

// ── Workflow graph ───────────────────────────────────

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

// ── Saved workflow ───────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: number;
  updatedAt: number;
}

// ── Execution state (for canvas animation) ──────────

export type NodeRunState = 'idle' | 'pending' | 'running' | 'pass' | 'fail' | 'skipped';

export interface NodeRunStatus {
  state: NodeRunState;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
  extracted?: Record<string, string>;
  /** Full formatted detail for the step result modal (response + errors). */
  responseDetail?: string;
}

import type { AuthConfig, Scenario } from './index';

export interface WorkflowHostProfile {
  id: string;
  name: string;
  hostEnvironmentId?: string;
  hostMicroserviceId?: string;
  hostBaseUrl?: string;
}

export interface WorkflowAuthProfile {
  id: string;
  name: string;
  auth: AuthConfig;
}

// ── Service Registry ─────────────────────────────────

/** @deprecated Kept for migration compatibility only. */
export type WorkflowServiceUrlMode = 'direct' | 'multi-env' | 'adhoc';

/** One row in the endpoint matrix: a service's config for a single environment. */
export interface ServiceEndpoint {
  envId: string;           // environment ID, or '__adhoc__' for adhoc testing
  url: string;             // base URL for this env
  enabled: boolean;        // service available in this env?
  authMode: 'inherit' | 'custom'; // inherit from service.defaultAuth or use custom
  auth?: AuthConfig;       // only when authMode === 'custom'
  source: 'manual' | 'microservice'; // how URL was populated
}

export interface WorkflowService {
  id: string;
  name: string;
  /** Endpoint matrix — one entry per environment (+adhoc). */
  endpoints: ServiceEndpoint[];
  /** Fallback auth for endpoints with authMode='inherit'. */
  defaultAuth?: AuthConfig;
  /** Linked microservice — auto-populates URLs from environment config. */
  microserviceId?: string;
  /** UI hint: when true, single URL input fills all env rows. */
  sameUrlForAll?: boolean;
  /** Optional description. */
  notes?: string;

  // ── Legacy fields (kept for migration, not used by new UI) ──
  /** @deprecated Use endpoints instead. */
  urlMode?: WorkflowServiceUrlMode;
  /** @deprecated Use endpoints instead. */
  directUrl?: string;
  /** @deprecated Use endpoints instead. */
  baseUrls?: Record<string, string>;
  /** @deprecated Use endpoints instead. */
  adhocUrl?: string;
  /** @deprecated Use defaultAuth instead. */
  auth?: AuthConfig;
  /** @deprecated Use endpoints[].auth instead. */
  authPerEnv?: Record<string, AuthConfig>;
}

// ── Node data types ──────────────────────────────────

export interface HttpNodeData {
  [key: string]: unknown;
  label: string;
  scenario: Scenario;
  sourceType?: 'requests' | 'catalog';
  sourceId?: string;
  /** Binding to a workflow-level service from the Service Registry. */
  serviceId?: string;
  /** @deprecated Use serviceId instead. */
  hostProfileId?: string;
  /** @deprecated Use serviceId instead. */
  authProfileId?: string;
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
  [key: string]: unknown;
  label: string;
  left: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not-contains' | 'regex';
  right: string;
}

export interface DelayNodeData {
  [key: string]: unknown;
  label: string;
  delayMs: number;
  mode: 'fixed' | 'random';
  minMs?: number;
  maxMs?: number;
}

export interface StartNodeData {
  [key: string]: unknown;
  label: string;
  /** Variables provided by this trigger when the workflow starts. */
  inputVariables: Record<string, string>;
}

export interface ForkNodeData {
  [key: string]: unknown;
  label: string;
}

export interface JoinNodeData {
  [key: string]: unknown;
  label: string;
}

export interface EndNodeData {
  [key: string]: unknown;
  label: string;
}

export interface WebhookTriggerNodeData {
  [key: string]: unknown;
  label: string;
  /** HTTP method expected for webhook (POST, PUT, PATCH). */
  method: 'POST' | 'PUT' | 'PATCH';
  /** Endpoint path (e.g., '/api/vehicle-created'). */
  path: string;
  /** Sample JSON payload for testing and schema documentation. */
  samplePayload: string;
  /** Variables to extract from webhook body via JSONPath. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /** Optional description/notes. */
  notes?: string;
}

export interface ScheduleTriggerNodeData {
  [key: string]: unknown;
  label: string;
  /** Cron expression (e.g., '0 9 * * MON-FRI' for 9am weekdays). */
  cronExpression: string;
  /** Timezone for cron execution (e.g., 'America/New_York'). */
  timezone: string;
  /** Human-readable description of schedule (e.g., 'Every weekday at 9am EST'). */
  scheduleDescription?: string;
  /** Optional initial variables for scheduled execution. */
  inputVariables?: Record<string, string>;
  /** Optional notes. */
  notes?: string;
}

// ── Switch node ──────────────────────────────────────

export interface SwitchCase {
  id: string;
  value: string;
  label?: string;
}

export interface SwitchNodeData {
  [key: string]: unknown;
  label: string;
  /** Expression to evaluate (e.g. "{{status}}"). Resolved via VariableContext at runtime. */
  expression: string;
  /** Ordered list of cases. Each maps to a source handle `case-<id>`. */
  cases: SwitchCase[];
}

// ── Loop node ────────────────────────────────────────

export type LoopMode = 'count' | 'forEach' | 'while';

export type ConditionOperator = ConditionNodeData['operator'];

export interface LoopNodeData {
  [key: string]: unknown;
  label: string;
  mode: LoopMode;
  /** Number of iterations (count mode). */
  count?: number;
  /** Expression resolving to an iteration count (count mode). e.g. "{{itemCount}}" */
  countExpression?: string;
  /** Expression resolving to a JSON array (forEach mode). e.g. "{{items}}" */
  sourceExpression?: string;
  /** Variable name for current element (forEach mode). Default "item". */
  itemVariable?: string;
  /** Variable name for 0-based index (forEach & count modes). Default "i". */
  indexVariable?: string;
  /** Left operand for while condition. */
  whileLeft?: string;
  /** Operator for while condition. */
  whileOperator?: ConditionOperator;
  /** Right operand for while condition. */
  whileRight?: string;
  /** Safety cap to prevent infinite loops. Default 100. */
  maxIterations?: number;
}

// ── Set Variable node ────────────────────────────────

export interface SetVariableAssignment {
  id: string;
  name: string;
  /** Expression that resolves to the value. Supports {{var}} templates. */
  expression: string;
}

export interface SetVariableNodeData {
  [key: string]: unknown;
  label: string;
  /** Ordered list of variable assignments. */
  assignments: SetVariableAssignment[];
}

// ── Aggregate node ───────────────────────────────────

export type AggregateStrategy = 'concat' | 'first' | 'last' | 'count' | 'sum' | 'custom';

export interface AggregateMapping {
  id: string;
  /** Source expression — the variable/path to aggregate. */
  sourceExpression: string;
  /** Target variable name to store the result. */
  targetVariable: string;
  /** Aggregation strategy. */
  strategy: AggregateStrategy;
  /** Custom JSONPath or expression (used when strategy is 'custom'). */
  customExpression?: string;
}

export interface AggregateNodeData {
  [key: string]: unknown;
  label: string;
  /** Ordered list of aggregation mappings. */
  mappings: AggregateMapping[];
}

export type WorkflowNodeType = 'http' | 'condition' | 'delay' | 'start' | 'fork' | 'join' | 'end' | 'webhook' | 'schedule' | 'switch' | 'loop' | 'setVariable' | 'aggregate';

export type WorkflowNodeData = HttpNodeData | ConditionNodeData | DelayNodeData | StartNodeData | ForkNodeData | JoinNodeData | EndNodeData | WebhookTriggerNodeData | ScheduleTriggerNodeData | SwitchNodeData | LoopNodeData | SetVariableNodeData | AggregateNodeData;

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
  /** Optional schema version used by one-time migrations. */
  schemaVersion?: number;
  /** Centralized service definitions with host + auth (replaces per-node config). */
  services?: WorkflowService[];
  /** @deprecated Use services instead. */
  hostProfiles?: WorkflowHostProfile[];
  /** @deprecated Use services instead. */
  authProfiles?: WorkflowAuthProfile[];
  createdAt: number;
  updatedAt: number;
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
}

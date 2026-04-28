import type { AuthConfig, Scenario } from '../engine/index';
import type { RequestResult } from '../../../shared/types';

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

// ── Error Handler node ───────────────────────────────

export type ErrorFilter = 'all' | 'http-error' | 'assertion-failure' | 'network-error';
export type RetryBackoffStrategy = 'fixed' | 'exponential';

export interface ErrorHandlerNodeData {
  [key: string]: unknown;
  label: string;
  /** What counts as an error: HTTP failures, assertion failures, network errors, or all. */
  errorFilter: ErrorFilter;
  /** How many times to retry the body before falling through to catch path. */
  retryCount: number;
  /** Delay between retries in ms. */
  retryDelayMs: number;
  /** Backoff strategy for retries. */
  retryBackoff: RetryBackoffStrategy;
  /** Max total timeout for all retries combined (0 = unlimited). */
  retryTimeoutMs: number;
  /** Continue workflow after catch path (true) or mark as failed (false). */
  continueOnError: boolean;
}

// ── Log/Debug node ───────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogDebugNodeData {
  [key: string]: unknown;
  label: string;
  /** Message template — supports {{variable}} syntax. */
  message: string;
  /** Log level for the message. */
  logLevel: LogLevel;
  /** Whether to snapshot all current variables at this point. */
  snapshotVariables: boolean;
}

// ── Wait for Condition node ──────────────────────────

export interface WaitForConditionNodeData {
  [key: string]: unknown;
  label: string;
  /** The HTTP node to poll (body subgraph edge). Polling re-executes body until condition is met. */
  /** Condition expression evaluated against variables (e.g. "{{status}} == done"). */
  conditionExpression: string;
  /** Polling interval in ms between each check. */
  pollIntervalMs: number;
  /** Maximum time to wait before timing out (ms). 0 = unlimited. */
  timeoutMs: number;
  /** Maximum number of polling attempts. 0 = unlimited (bounded by timeoutMs). */
  maxAttempts: number;
}

// ── Sub-Workflow node ─────────────────────────────

export interface SubWorkflowNodeData {
  [key: string]: unknown;
  label: string;
  /** UUID of the referenced child workflow. */
  workflowId: string;
  /** Cached display name (for rendering when child isn't loaded). */
  workflowName?: string;
  /** Map parent expressions → child input variables. */
  inputMappings: Array<{ sourceExpression: string; targetVariable: string }>;
  /** Map child output variables → parent variables. */
  outputMappings: Array<{ sourceVariable: string; targetVariable: string }>;
  /** Pass all child final variables to parent (fallback when outputMappings is empty). */
  propagateAllOutputs?: boolean;
  /** Recursion depth limit (default 10). */
  maxDepth?: number;
  /** Abort child if it takes longer than this (0 = unlimited). */
  timeoutMs?: number;
  /** Number of retry attempts on child failure (default 0 = no retry). */
  retryCount?: number;
  /** Delay between retries in milliseconds (default 1000). */
  retryDelayMs?: number;
  /** Behaviour when child workflow fails: 'fail' (default) or 'continue'. */
  onChildFailure?: 'fail' | 'continue';
  /** Run child workflow once per item in a collection variable. */
  multiInstance?: {
    /** Expression resolving to a JSON array (e.g. "{{users}}"). */
    collection: string;
    /** Variable name injected into each child run with the current element. */
    elementVariable: string;
    /** Sequential runs items one-by-one; parallel runs all concurrently. */
    mode: 'sequential' | 'parallel';
  };
}

// ── Script/Transform Node ────────────────────────────

export type ScriptMode = 'transform' | 'validate' | 'generate';

export interface ScriptNodeData {
  [key: string]: unknown;
  label: string;
  /** JavaScript source code */
  code: string;
  /** Execution mode */
  mode: ScriptMode;
  /** Variables explicitly passed into the script sandbox */
  inputVariables: string[];
  /** Variables the script exports back to the workflow context */
  outputVariables: string[];
  /** Timeout in milliseconds (default 5000, max 30000) */
  timeoutMs: number;
  /** Whether to log console.log output to workflow console */
  captureConsole: boolean;
  /** Optional script library IDs to include before execution */
  libraryIds?: string[];
}

// ── Correlation Wait node ────────────────────────────

export interface CorrelationWaitNodeData {
  [key: string]: unknown;
  label: string;
  /** Expression resolving to correlation ID (e.g. "{{paymentId}}"). */
  correlationIdExpression: string;
  /** Webhook path pattern to match (e.g. "/webhooks/payment-callback"). */
  webhookPath: string;
  /** How to extract correlationId from webhook payload. */
  correlationSource: 'body' | 'header' | 'query';
  /** JSONPath to extract correlation ID from webhook body (e.g. "$.paymentId"). */
  correlationJsonPath?: string;
  /** Header name if correlationSource is 'header'. */
  correlationHeader?: string;
  /** Query param name if correlationSource is 'query'. */
  correlationQueryParam?: string;
  /** Variables to extract from webhook payload into workflow context. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /** Timeout in ms (workflow fails if no callback received). 0 = unlimited. */
  timeoutMs: number;
  /** Optional webhook validation expression (e.g. "{{webhook.type}} == payment"). */
  webhookFilter?: string;
  /** Optional notes. */
  notes?: string;
}

export type WorkflowNodeType = 'http' | 'condition' | 'delay' | 'start' | 'fork' | 'join' | 'end' | 'webhook' | 'schedule' | 'switch' | 'loop' | 'setVariable' | 'aggregate' | 'errorHandler' | 'logDebug' | 'waitForCondition' | 'subWorkflow' | 'script' | 'correlationWait';

export type WorkflowNodeData = HttpNodeData | ConditionNodeData | DelayNodeData | StartNodeData | ForkNodeData | JoinNodeData | EndNodeData | WebhookTriggerNodeData | ScheduleTriggerNodeData | SwitchNodeData | LoopNodeData | SetVariableNodeData | AggregateNodeData | ErrorHandlerNodeData | LogDebugNodeData | WaitForConditionNodeData | SubWorkflowNodeData | ScriptNodeData | CorrelationWaitNodeData;

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
  /** Workflow-level error handling configuration. */
  errorConfig?: WorkflowErrorConfig;
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
}

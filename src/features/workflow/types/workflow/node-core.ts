// ── Node data types ──────────────────────────────────

import type { DataSource, Scenario } from '../../../../shared/types';

export interface HttpNodeData {
  [key: string]: unknown;
  label: string;
  scenario: Scenario;
  sourceType?: 'requests' | 'catalog';
  sourceId?: string;
  /** Tracks the catalog origin so un-publishing can locate nodes that reference a catalog endpoint. */
  catalogRef?: {
    entryId: string;
    endpointId: string;
    method: string;
    path: string;
  };
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
  /** Optional data source for parameterized execution of this HTTP node. */
  dataSource?: DataSource;
  /** When sourced from a versioned request: the pinned spec version ID */
  sourceSpecVersionId?: string;
  /** Human label for the pinned spec version (e.g. "1.0.7") */
  sourceSpecVersionLabel?: string;
  /** 'latest' (default) tracks the request's active version; 'pinned' freezes to sourceSpecVersionId */
  specVersionMode?: 'pinned' | 'latest';
  /** Per-node HTTP request timeout in seconds; overrides the workflow-level default when set. */
  timeoutSec?: number;
  /** Per-node environment override; when set, this step resolves its service URL and auth
   *  from this environment instead of the global toolbar selection. */
  envOverride?: string;
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
  /** Inline data source for forEach mode. When set, the loop iterates over its enabled rows. */
  dataSource?: DataSource;
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

/** Behavior modes for CorrelationWait nodes during load/performance tests. */
export type CorrelationWaitLoadTestMode = 'wait-for-real' | 'auto-resume' | 'synthetic-inject';

/** Configuration for CorrelationWait behavior during load tests. */
export interface CorrelationWaitLoadTestBehavior {
  /**
   * How to handle the correlation wait during load tests:
   * - 'wait-for-real': Wait for actual external webhook (default, same as normal execution)
   * - 'auto-resume': Immediately resume with mock payload (skip the wait, for CI/smoke tests)
   * - 'synthetic-inject': Wait for synthetic event injector to fire callback with configurable delay
   */
  mode: CorrelationWaitLoadTestMode;
  /** Mock payload to inject when mode is 'auto-resume' or 'synthetic-inject'. */
  mockPayload?: Record<string, unknown>;
  /** Delay before synthetic injection (ms). Only used when mode is 'synthetic-inject'. */
  syntheticDelayMs?: number;
  /** Random jitter range (±ms) added to syntheticDelayMs. */
  syntheticJitterMs?: number;
}

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
  /** How this node behaves during load/performance tests. When omitted, defaults to 'wait-for-real'. */
  loadTestBehavior?: CorrelationWaitLoadTestBehavior;
}


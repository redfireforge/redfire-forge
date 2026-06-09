import type { AuthConfig, Scenario, RequestResult, DataSource, SlaTarget } from '../../../shared/types';
import type { KafkaSchemaConfig } from '../../../shared/kafka/kafkaClient';

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

// ── Kafka nodes ─────────────────────────────────────

export type KafkaAckMode = 'all' | 'leader' | 'none';
export type KafkaConsumeStartPosition = 'latest' | 'earliest' | 'committed';
export type KafkaConsumeLoadTestMode = 'wait-for-real' | 'auto-resume' | 'synthetic-inject';

export interface KafkaNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface KafkaNodeMetadataBinding {
  id: string;
  source: 'topic' | 'partition' | 'offset' | 'timestamp' | 'key';
  targetVariable: string;
  enabled: boolean;
}

export interface KafkaConsumeHeaderFilterRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface KafkaConsumeJsonPathFilterRow {
  id: string;
  jsonPath: string;
  expectedValue?: string;
  enabled: boolean;
}

export interface KafkaConsumeLoadTestBehavior {
  mode: KafkaConsumeLoadTestMode;
  mockPayload?: Record<string, unknown>;
  syntheticDelayMs?: number;
  syntheticJitterMs?: number;
}

export interface KafkaProduceNodeData {
  [key: string]: unknown;
  label: string;
  clusterId: string;
  topic: string;
  keyTemplate?: string;
  partition?: number;
  headers?: KafkaNodeHeaderRow[];
  bodyTemplate?: string;
  ackMode?: KafkaAckMode;
  timeoutMs?: number;
  outputBindings?: KafkaNodeMetadataBinding[];
  /** Optional Avro/Protobuf/JSON-Schema registry config for message encoding. */
  schemaConfig?: KafkaSchemaConfig;
}

export interface KafkaConsumeNodeData {
  [key: string]: unknown;
  label: string;
  clusterId: string;
  topic: string;
  keyRegex?: string;
  headerFilters?: KafkaConsumeHeaderFilterRow[];
  jsonPathFilters?: KafkaConsumeJsonPathFilterRow[];
  timeoutMs?: number;
  maxMessages?: number;
  startPosition?: KafkaConsumeStartPosition;
  loadTestBehavior?: KafkaConsumeLoadTestBehavior;
  outputBindings?: KafkaNodeMetadataBinding[];
  /** Optional Avro/Protobuf/JSON-Schema registry config for message decoding. */
  schemaConfig?: KafkaSchemaConfig;
}

// ── Kafka Trigger node ──────────────────────────────

/** Offset policy for KafkaTrigger — default is latest (no replay). */
export type KafkaTriggerOffsetPolicy = 'latest' | 'earliest';

export interface KafkaTriggerNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster to subscribe to. */
  clusterId: string;
  /** Topic to consume from. */
  topic: string;
  /**
   * Consumer group ID override for this trigger.
   * When omitted, derived as `rf-trigger-<workflowId>-<nodeId>` for deterministic rejoin semantics
   * (re-subscriptions on reconnect rejoin the same group and do not replay already-processed offsets).
   */
  consumerGroupId?: string;
  /**
   * Offset policy. Default: `latest` (do not replay messages delivered before trigger registered).
   * `earliest` is opt-in and replays from the beginning of the topic.
   */
  startPosition?: KafkaTriggerOffsetPolicy;
  /** Optional regex filter on the message key — messages not matching are discarded before dispatch. */
  keyRegex?: string;
  /** Optional header match filters — all enabled filters must pass before workflow dispatch. */
  headerFilters?: KafkaConsumeHeaderFilterRow[];
  /** Optional JSON path filters on the message body — all enabled filters must pass. */
  jsonPathFilters?: KafkaConsumeJsonPathFilterRow[];
  /**
   * Max concurrent workflow runs this trigger may start simultaneously.
   * When the limit is reached, the Kafka consumer is paused until active count drops below threshold.
   * Default: 10.
   */
  maxConcurrentRuns?: number;
  /** Additional variables to extract from the message body into workflow context via JSONPath. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /**
   * Sample Kafka message body for Quick Test.
   * When set, Quick Test uses this as the trigger message instead of dry-running with empty variables.
   * JSON string — same semantics as WebhookTriggerNodeData.samplePayload.
   */
  samplePayload?: string;
  /** Optional sample message key for Quick Test. */
  sampleKey?: string;
  /** Optional sample message headers for Quick Test (JSON object string). */
  sampleHeaders?: string;
  /** Optional description/notes. */
  notes?: string;
}

// ── Kafka Wait node ─────────────────────────────────

/** Source field in a Kafka message from which the correlation ID is extracted. */
export type KafkaWaitCorrelationSource = 'body' | 'header' | 'key';

export interface KafkaWaitNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster to subscribe to for the wait. */
  clusterId: string;
  /** Topic to consume from while waiting. */
  topic: string;
  /** Expression resolving to correlation ID to match (e.g. "{{orderId}}"). */
  correlationIdExpression: string;
  /**
   * Where in the Kafka message to extract the correlation ID for matching.
   * - `body`: extract via JSON path from message value (use `correlationJsonPath`)
   * - `header`: extract from a message header (use `correlationHeader`)
   * - `key`: use the message key directly as the correlation ID
   */
  correlationSource: KafkaWaitCorrelationSource;
  /** JSONPath to extract correlation ID from message body. Used when `correlationSource` is `'body'`. */
  correlationJsonPath?: string;
  /** Header name to extract correlation ID from. Used when `correlationSource` is `'header'`. */
  correlationHeader?: string;
  /** Additional variables to extract from the matching message body into workflow context via JSONPath. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /** Timeout in ms (workflow fails if no matching message received before timeout). 0 = unlimited. */
  timeoutMs: number;
  /** Optional regex filter on the message key — only messages matching are considered for correlation. */
  keyRegex?: string;
  /** Optional header match filters applied before correlation matching. */
  headerFilters?: KafkaConsumeHeaderFilterRow[];
  /**
   * Sample Kafka message body for Quick Test.
   * When set, Quick Test uses this as the correlated response message instead of waiting forever.
   * JSON string — same semantics as KafkaTriggerNodeData.samplePayload.
   */
  samplePayload?: string;
  /** Optional sample message key for Quick Test. */
  sampleKey?: string;
  /** Optional sample message headers for Quick Test (JSON object string). */
  sampleHeaders?: string;
  /** Optional description/notes. */
  notes?: string;
  /** How this node behaves during load/performance tests. When omitted, defaults to 'wait-for-real'. */
  loadTestBehavior?: KafkaConsumeLoadTestBehavior;
}

// ── WebSocket Workflow Nodes ──────────────────────────────────────────

export interface WsConnectOutputBinding {
  field: 'protocol' | 'extensions' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsConnectNodeData {
  [key: string]: unknown;
  label: string;
  url: string;
  headers: WsNodeHeaderRow[];
  queryParams: WsNodeHeaderRow[];
  subprotocols: string[];
  connectionId: string;
  timeoutMs: number;
  outputBindings: WsConnectOutputBinding[];
}

export interface WsNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface WsSendOutputBinding {
  field: 'responseBody' | 'responseType' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsSendNodeData {
  [key: string]: unknown;
  label: string;
  connectionId: string;
  message: string;
  messageType: 'text' | 'binary';
  waitForResponse: boolean;
  responseTimeoutMs: number;
  outputBindings: WsSendOutputBinding[];
}

export interface WsMatchCriteria {
  contentContains?: string;
  contentRegex?: string;
  jsonPathMatch?: string;
  jsonPathValue?: string;
  messageType?: 'text' | 'binary' | 'any';
}

export interface WsExtractionRule {
  variableName: string;
  jsonPath: string;
}

export interface WsReceiveOutputBinding {
  field: 'messageBody' | 'messageType' | 'matchedAt' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsReceiveNodeData {
  [key: string]: unknown;
  label: string;
  connectionId: string;
  timeoutMs: number;
  matchCriteria: WsMatchCriteria;
  extractionRules: WsExtractionRule[];
  outputBindings: WsReceiveOutputBinding[];
}

export interface WsTriggerNodeData {
  [key: string]: unknown;
  label: string;
  url: string;
  connectionId: string;
  matchCriteria: WsMatchCriteria;
  extractionRules: WsExtractionRule[];
  samplePayload?: string;
}

export type WorkflowNodeType = 'http' | 'condition' | 'delay' | 'start' | 'fork' | 'join' | 'end' | 'webhook' | 'schedule' | 'switch' | 'loop' | 'setVariable' | 'aggregate' | 'errorHandler' | 'logDebug' | 'waitForCondition' | 'subWorkflow' | 'script' | 'correlationWait' | 'kafkaProduce' | 'kafkaConsume' | 'kafkaTrigger' | 'kafkaWait' | 'wsConnect' | 'wsSend' | 'wsReceive' | 'wsTrigger';

export type WorkflowNodeData = HttpNodeData | ConditionNodeData | DelayNodeData | StartNodeData | ForkNodeData | JoinNodeData | EndNodeData | WebhookTriggerNodeData | ScheduleTriggerNodeData | SwitchNodeData | LoopNodeData | SetVariableNodeData | AggregateNodeData | ErrorHandlerNodeData | LogDebugNodeData | WaitForConditionNodeData | SubWorkflowNodeData | ScriptNodeData | CorrelationWaitNodeData | KafkaProduceNodeData | KafkaConsumeNodeData | KafkaTriggerNodeData | KafkaWaitNodeData | WsConnectNodeData | WsSendNodeData | WsReceiveNodeData | WsTriggerNodeData;

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
}

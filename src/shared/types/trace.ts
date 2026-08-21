/**
 * Workflow execution trace & event types.
 * Extracted from `types/index.ts` for modularity.
 */

export type TraceCaptureLevel = 'minimal' | 'standard' | 'full' | 'debug';

/**
 * Options for controlling how much data is captured during workflow execution.
 * Used to enable full trace capture for debugging vs minimal capture for performance.
 */
export interface ExecutionTraceOptions {
  /** Capture full request/response bodies (increases memory usage) */
  captureFullTrace: boolean;
  /** Maximum response body size to store (bytes). Default: 102400 (100KB) */
  maxResponseBodySize?: number;
  /** Always capture full trace for failed iterations regardless of captureFullTrace setting */
  alwaysCaptureFailures?: boolean;
  /** Whether to sample iterations for large runs. Default: true */
  samplingEnabled?: boolean;
  /** Iteration count threshold above which sampling activates. Default: 50 */
  samplingThreshold?: number;
  /** Tiered trace level controlling capture depth. When set, takes precedence over captureFullTrace. */
  traceLevel?: TraceCaptureLevel;
}

/**
 * Full HTTP request details captured when captureFullTrace is enabled.
 */
export interface CapturedHttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  /** Original body template with {{variables}} */
  bodyTemplate?: string;
  /** Body after variable substitution */
  bodyResolved?: string;
}

/**
 * Full HTTP response details captured when captureFullTrace is enabled.
 */
export interface CapturedHttpResponse {
  statusCode: number;
  statusText?: string;
  headers?: Record<string, string>;
  /** Response body (may be truncated if too large) */
  body?: string;
  /** True if body was truncated due to size limits */
  bodyTruncated?: boolean;
}

/**
 * Assertion result for a single assertion.
 */
export interface AssertionResult {
  /** Assertion type (status, responseTime, header, regex, etc.) */
  type: string;
  /** Human-readable description of the assertion */
  description: string;
  /** Did the assertion pass? */
  passed: boolean;
  /** Expected value (for display) */
  expected?: string;
  /** Actual value (for display) */
  actual?: string;
}

/**
 * Details about a single node's execution during workflow run.
 * Captures execution state, timing, and type-specific details.
 */
export interface ExecutionEventDetails {
  // HTTP nodes (basic - always captured)
  statusCode?: number;
  responseTimeMs?: number;
  requestResultId?: string;  // Links to RequestResult for full data
  method?: string;
  url?: string;

  // HTTP nodes (full trace - when captureFullTrace enabled)
  request?: CapturedHttpRequest;
  response?: CapturedHttpResponse;
  assertions?: AssertionResult[];

  // Condition nodes
  conditionResult?: boolean;
  conditionExpression?: string;

  // Loop nodes
  loopIterationCount?: number;
  currentLoopIndex?: number;

  // Script nodes
  scriptOutput?: unknown;

  // Debug-level capture (Phase 2: populated at 'debug' trace level)
  /** Raw onLog lines captured during this node's execution */
  logLines?: { prefix: string; text: string; ts: number }[];

  // Sub-workflow nodes
  subWorkflowId?: string;
  subWorkflowPassed?: boolean;
  /** Full execution trace of the child workflow (for drill-down in Results Explorer). */
  subWorkflowTrace?: WorkflowExecutionTrace;

  // Variables
  inputVariables?: Record<string, string>;
  extractedVariables?: Record<string, string>;
  /** All variables at time of node execution (when captureFullTrace enabled) */
  variablesSnapshot?: Record<string, string>;

  // CorrelationWait nodes — split timing
  /** Wall-clock time spent waiting for the external webhook/event (ms) */
  waitDurationMs?: number;

  // Webhook trigger nodes
  /** The webhook payload that triggered this execution */
  webhookInput?: {
    payload: string;  // JSON string
    method?: string;
    path?: string;
  };

  // Mapping traces (Phase 9A — captured at 'full' or 'debug' level)
  /** Per-mapping data flow traces showing source→expression→target values */
  mappingTraces?: import('../components/data-mapper/utils/mappingTrace').MappingTrace[];

  // Kafka nodes
  /** Body of the first consumed Kafka message (JSON string) */
  kafkaConsumeBody?: string;
  /** Number of messages consumed in this node execution */
  kafkaConsumeCount?: number;
  /** Structured Kafka execution details (captured at standard+ trace level) */
  kafkaDetails?: CapturedKafkaNodeDetails;
  /** Metadata captured from a KafkaTrigger node fire (topic, partition, offset, key) */
  kafkaTriggerDetails?: {
    topic: string;
    partition?: number;
    offset?: string;
    key?: string;
  };
  /** Metadata captured from a KafkaWait node resume (topic, correlationId, wait duration) */
  kafkaWaitDetails?: {
    topic: string;
    correlationId: string;
    waitDurationMs?: number;
    partition?: number;
    offset?: string;
    key?: string;
    /** Terminal outcome of the wait: matched = successfully resumed, timed_out = timeout expired, cancelled = aborted */
    outcome?: 'matched' | 'timed_out' | 'cancelled';
  };

  // WebSocket nodes
  /** Structured WebSocket execution details (captured at standard+ trace level) */
  wsDetails?: CapturedWsNodeDetails;
  /** Metadata captured from a WsTrigger node fire */
  wsTriggerDetails?: {
    url: string;
    connectionId: string;
    messageType?: string;
  };

  /** Structured gRPC execution details (captured at standard+ trace level) */
  grpcDetails?: CapturedGrpcNodeDetails;

  /** Structured API Mock execution details (Phase 11) */
  apiMockDetails?: CapturedApiMockNodeDetails;

  // Errors
  error?: string;
  errorStack?: string;
}

/** Failure class for Kafka node errors — actionable categorization. */
export type KafkaFailureClass = 'validation' | 'auth' | 'tls' | 'timeout' | 'network' | 'extraction';

/** Failure class for WebSocket node errors — actionable categorization. */
export type WsFailureClass = 'validation' | 'connection' | 'timeout' | 'protocol' | 'network';

/** Structured capture of a Kafka node execution for trace/replay. */
export interface CapturedKafkaNodeDetails {
  topic: string;
  partition?: number;
  offset?: string;
  key?: string;
  durationMs: number;
  matchedMessages?: number;
  failureClass?: KafkaFailureClass;
  /** Truncated preview of the message body (max 512 chars). */
  bodyPreview?: string;
}

/** Structured capture of a WebSocket node execution for trace/replay. */
export interface CapturedWsNodeDetails {
  url?: string;
  connectionId: string;
  durationMs: number;
  /** Message type: text or binary */
  messageType?: 'text' | 'binary';
  /** Negotiated subprotocol (connect only). */
  protocol?: string;
  /** Negotiated extensions (connect only). */
  extensions?: string;
  failureClass?: WsFailureClass;
  /** Truncated preview of the message body (max 512 chars). */
  bodyPreview?: string;
}

/** Structured capture of a gRPC workflow node execution for trace/replay. */
export interface CapturedGrpcNodeDetails {
  target: string;
  service: string;
  method: string;
  callType: 'unary' | 'server_streaming';
  durationMs: number;
  grpcStatus?: number;
  grpcStatusMessage?: string;
  messageCount?: number;
  streamStopReason?: string;
  attempts?: number;
  /** Truncated preview of response body or last stream message (max 512 chars). */
  bodyPreview?: string;
}

/** Structured capture of an API Mock workflow node for Results Explorer (Phase 11). */
export interface CapturedApiMockNodeDetails {
  transport: 'apiMockStart' | 'apiMockApply' | 'apiMockResetState' | 'apiMockStop' | 'apiMockAssertCalls';
  serverId?: string;
  port?: number;
  generation?: number;
  durationMs: number;
  /** Journal transaction IDs for assert / deep-link */
  transactionIds?: string[];
  nearMisses?: string[];
  expected?: string;
  actual?: string;
}

/**
 * Single node execution event within a workflow iteration.
 * Ordered list of these events represents the execution path.
 */
export interface ExecutionEvent {
  /** React Flow node ID (e.g., "n1", "n2") */
  nodeId: string;

  /** Node type */
  nodeType: 'http' | 'condition' | 'delay' | 'fork' | 'join' |
           'loop' | 'setVariable' | 'script' | 'aggregate' |
           'correlationWait' | 'waitForCondition' | 'subWorkflow' |
           'webhook' | 'schedule' | 'start' | 'errorHandler' |
           'kafkaProduce' | 'kafkaConsume' | 'kafkaTrigger' | 'kafkaWait' |
           'wsConnect' | 'wsSend' | 'wsReceive' | 'wsTrigger' |
           'grpcUnary' | 'grpcServerStream' | 'grpcAssert' |
           'apiMockStart' | 'apiMockApply' | 'apiMockResetState' | 'apiMockStop' | 'apiMockAssertCalls';

  /** User-visible node label */
  nodeLabel: string;

  /** When this node started executing (epoch ms) */
  timestamp: number;

  /** Execution state */
  state: 'pass' | 'fail' | 'skipped';

  /** How long this node took (ms) */
  durationMs?: number;

  /** Type-specific execution details */
  details?: ExecutionEventDetails;
}

/**
 * Execution trace for a single iteration of a workflow run.
 * Contains ordered events and final variable state.
 */
export interface WorkflowIterationTrace {
  /** Iteration number (0-based) */
  index: number;

  /** Did all nodes pass? */
  passed: boolean;

  /** Total time for this iteration */
  durationMs: number;

  /** Ordered list of node execution events */
  events: ExecutionEvent[];

  /** Variable state before iteration starts (for sampling re-execution) */
  initialVariables?: Record<string, string>;

  /** Variable state after iteration completes */
  finalVariables: Record<string, string>;

  /** Edges traversed in this specific iteration */
  traversedEdges: string[];

  /** False if this iteration was stripped during trace sampling (events/variables unavailable) */
  sampled?: boolean;
}

/**
 * Complete execution trace for a workflow run.
 * Includes per-iteration traces and workflow snapshot.
 */
export interface WorkflowExecutionTrace {
  /** Per-iteration execution traces */
  iterations: WorkflowIterationTrace[];

  /** Edge IDs that were traversed (union across all iterations) */
  traversedEdges: string[];

  /** Workflow definition snapshot (nodes + edges) at time of execution */
  workflowSnapshot: {
    nodes: unknown[];  // WorkflowNode[] (avoid circular import)
    edges: unknown[];  // WorkflowEdge[]
  };

  /** Metadata */
  workflowId: string;
  workflowName: string;
  totalIterations: number;
  totalDurationMs: number;

  /** Whether full trace was captured (request/response bodies) */
  fullTraceCaptured?: boolean;

  /** Trace capture level used for this run. Absent on pre-existing traces (infer from content). */
  captureLevel?: TraceCaptureLevel;
}

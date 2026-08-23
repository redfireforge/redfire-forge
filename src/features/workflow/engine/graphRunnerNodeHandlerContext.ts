/**
 * Shared context interfaces for workflow node handlers.
 * Extracted here to avoid circular dependencies between the handler barrel
 * and individual handler modules.
 */
import type { WorkflowNode, WorkflowEdge, HttpNodeData, Workflow } from '../types/workflow';
import type { ICorrelationStore } from './correlationStore';
import type { RequestResult, Scenario } from '@shared/types';
import type { VariableContext } from './variableContext';
import type { TokenManager } from '../../../engine/tokenManager';
import type { DebugController } from './debugController';
import type { GraphRunCallbacks } from './graphRunnerInterfaces';
import type { CorrelationWaitRunnerConfig, ExecutionTraceOptions, CapturedHttpRequest, CapturedHttpResponse, AssertionResult } from '@shared/types';
import type { Semaphore } from '@shared/utils/semaphore';
import type { KafkaSchemaConfig } from '@shared/kafka/kafkaClient';
import type { GrpcCallRequest, GrpcDescriptor, GrpcStreamStartRequest } from '@shared/grpc/contracts';
import type { GrpcLoadTestConfig } from '@shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcServerStreamCollectConfig } from '../types/workflow/node-grpc';
import type { GrpcUnaryInvokeResult } from '../utils/grpcWorkflowUnaryExecutor';
import type { GrpcWorkflowStreamCollectionResult } from '../utils/grpcWorkflowStreamCollector';

// ────────────────────────────────────────────────────────
// Kafka node operations (dependency-injected for testability)
// ────────────────────────────────────────────────────────

/** Result envelope returned by a Kafka produce operation. */
export interface KafkaProduceResult {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key?: string;
}

/** A single consumed Kafka message. */
export interface KafkaConsumedMessage {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

/** Dependency-injected operations for Kafka node handlers. */
export interface KafkaNodeOperations {
  /** Produce a message to a Kafka topic. */
  produce(params: {
    clusterId: string;
    topic: string;
    key?: string;
    value: string;
    partition?: number;
    headers?: Record<string, string>;
    ackMode?: string;
    timeoutMs?: number;
    schemaConfig?: KafkaSchemaConfig;
  }): Promise<KafkaProduceResult>;

  /** Consume messages from a Kafka topic with bounded defaults. */
  consume(params: {
    clusterId: string;
    topic: string;
    maxMessages: number;
    timeoutMs: number;
    startPosition?: string;
    keyRegex?: string;
    headerFilters?: Array<{ key: string; value: string }>;
    jsonPathFilters?: Array<{ jsonPath: string; expectedValue?: string }>;
    schemaConfig?: KafkaSchemaConfig;
  }): Promise<KafkaConsumedMessage[]>;
}

// ────────────────────────────────────────────────────────
// WebSocket node operations (dependency-injected for testability)
// ────────────────────────────────────────────────────────

/** Result envelope returned by a WS connect operation. */
export interface WsConnectResult {
  connectionId: string;
  protocol?: string;
  extensions?: string;
  latencyMs: number;
}

/** Result envelope returned by a WS send operation. */
export interface WsSendResult {
  latencyMs: number;
}

/** A single received WebSocket message. */
export interface WsReceivedMessage {
  data: string;
  type: 'text' | 'binary';
  timestamp: number;
}

/** Match criteria for filtering received WebSocket messages. */
export interface WsMessageMatchCriteria {
  contentContains?: string;
  contentRegex?: string;
  jsonPathMatch?: string;
  jsonPathValue?: string;
  messageType?: 'text' | 'binary' | 'any';
}

/** Dependency-injected operations for WebSocket node handlers. */
export interface WsNodeOperations {
  /** Open a WebSocket connection through the proxy. */
  connect(params: {
    url: string;
    /** User-defined connection label (e.g. "ws1") — used as registry key for Send/Receive lookups. */
    connectionId?: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    subprotocols?: string[];
    timeoutMs?: number;
  }): Promise<WsConnectResult>;

  /** Send a message on an existing connection. */
  send(params: {
    connectionId: string;
    data: string;
    type?: 'text' | 'binary';
  }): Promise<WsSendResult>;

  /** Get the current message cursor for a connection (used to skip buffered messages). */
  snapshotCursor(params: { connectionId: string }): Promise<string | undefined>;

  /** Poll for a matching message on an existing connection. */
  waitForMessage(params: {
    connectionId: string;
    timeoutMs: number;
    matchCriteria?: WsMessageMatchCriteria;
    /** Start polling from this cursor (skip earlier buffered messages). */
    sinceCursor?: string;
    /** Abort signal for early cancellation (e.g. user stop). */
    abortSignal?: AbortSignal;
  }): Promise<WsReceivedMessage>;

  /** Close a specific WebSocket connection. */
  disconnect(params: {
    connectionId: string;
    code?: number;
    reason?: string;
  }): Promise<void>;

  /** Close all open connections (cleanup at workflow end). */
  disconnectAll(): Promise<void>;
}

// ────────────────────────────────────────────────────────
// gRPC node operations (dependency-injected for testability)
// ────────────────────────────────────────────────────────

/** Dependency-injected operations for gRPC workflow node handlers. */
export interface GrpcNodeOperations {
  invokeUnary(request: GrpcCallRequest, tabId: string): Promise<GrpcUnaryInvokeResult>;
  collectServerStream(
    request: GrpcStreamStartRequest,
    tabId: string,
    collect: GrpcServerStreamCollectConfig,
    options?: { abortSignal?: AbortSignal },
  ): Promise<GrpcWorkflowStreamCollectionResult>;
  /** Phase 11N — resolve descriptor snapshots for grpcSchemaDiff nodes. */
  resolveDescriptor?: (descriptorKey: string) => GrpcDescriptor | Promise<GrpcDescriptor>;
  /** Phase 11N — resolve saved load-test profile config when node uses profileId. */
  resolveLoadTestProfile?: (profileId: string) => GrpcLoadTestConfig | Promise<GrpcLoadTestConfig>;
}

// ────────────────────────────────────────────────────────
// Shared context passed to every handler
// ────────────────────────────────────────────────────────

export interface NodeHandlerContext {
  /** All nodes in the workflow */
  nodeMap: Map<string, WorkflowNode>;
  /** Outgoing edges per node */
  outgoing: Map<string, WorkflowEdge[]>;
  /** Variable context */
  ctx: VariableContext;
  /** Token manager for auth */
  tokenManager: TokenManager;
  /** Accumulated results */
  results: RequestResult[];
  /** Whether all nodes have passed so far */
  allPassed: boolean;
  /** Set of visited node IDs */
  visited: Set<string>;
  /** Join barrier arrival counts */
  joinArrived: Map<string, number>;
  /** Expected incoming edge counts per node */
  incomingCount: Map<string, number>;
  /** Callbacks for UI updates */
  callbacks: GraphRunCallbacks;
  /** Abort signal */
  abortSignal?: AbortSignal;
  /** Initial variables */
  initialVariables: Record<string, string>;
  /** Environment layer */
  environmentLayer?: Record<string, string>;
  /** Base URL resolver */
  resolveHttpBaseUrl?: (data: HttpNodeData) => string | undefined;
  /** Auth profile resolver */
  resolveHttpAuth?: (data: HttpNodeData) => Scenario['auth'] | undefined;
  /** Debug controller */
  debugController?: DebugController;
  /** Sub-workflow resolver */
  resolveSubWorkflow?: (workflowId: string) => Workflow | undefined;
  /** Log helper */
  log: (line: { prefix: string; text: string }) => void;
  /** Node label resolver */
  nodeLabel: (id: string) => string;
  /** Visit a node (recursive call back into visit) */
  visit: (nodeId: string, threadId?: string) => Promise<void>;
  /** Visit all outgoing edges from a node */
  visitOutgoing: (nodeId: string, threadId: string) => Promise<void>;
  /** Current thread ID */
  threadId: string;
  /** Correlation store for pause/resume (optional — only needed for correlationWait nodes). */
  correlationStore?: ICorrelationStore;
  /** Execution ID for current workflow run. */
  executionId?: string;
  /** Workflow ID. */
  workflowId?: string;
  /** Workflow start time (ms since epoch). */
  startTime?: number;
  /**
   * When true, the workflow is running under load test mode (N iterations × M concurrency).
   * Event-driven nodes (CorrelationWait, WaitForCondition) may behave differently in this mode.
   */
  loadTestMode?: boolean;
  /** Runner-level configuration for CorrelationWait behavior. Takes precedence over node-level settings. */
  correlationWaitConfig?: CorrelationWaitRunnerConfig;
  /**
   * Semaphore for throttling concurrent poll operations across all iterations.
   * Used by WaitForCondition nodes to prevent poll storms during load tests.
   */
  pollSemaphore?: Semaphore;
  /**
   * Trace collector for Phase 7e: Visual Execution Replay.
   * Captures execution events, timing, and edge traversals.
   */
  traceCollector?: import('./traceCollector').TraceCollector;
  /**
   * Options for trace capture (Results Explorer).
   * When captureFullTrace is true, full request/response bodies are stored.
   */
  traceOptions?: ExecutionTraceOptions;
  /**
   * Storage for captured HTTP execution details per node (for full trace capture).
   * Populated by handleHttpNode, consumed when onNodeComplete is called.
   */
  capturedHttpDetails?: Map<string, CapturedHttpNodeDetails>;
  /**
   * Storage for captured sub-workflow execution traces per node.
   * Populated by handleSubWorkflowNode, consumed when onNodeComplete builds eventDetails.
   */
  capturedSubWorkflowTraces?: Map<string, import('../../../shared/types').WorkflowExecutionTrace>;
  /**
   * Storage for captured script console output per node (debug trace level).
   * Populated by handleScriptNode, consumed when onNodeComplete builds eventDetails.
   */
  capturedScriptOutput?: Map<string, string[]>;
  /** Per-request timeout in milliseconds for HTTP nodes. */
  httpTimeoutMs?: number;
  /**
   * Kafka client operations for produce/consume node handlers.
   * Injected through context for testability — handlers never access a global client.
   */
  kafkaOperations?: KafkaNodeOperations;
  /**
   * Storage for captured Kafka execution details per node (for trace capture).
   * Populated by handleKafkaProduceNode/handleKafkaConsumeNode, consumed when building eventDetails.
   */
  capturedKafkaDetails?: Map<string, import('../../../shared/types').CapturedKafkaNodeDetails>;
  /**
   * WebSocket client operations for WS node handlers.
   * Injected through context for testability — handlers never access a global client.
   */
  wsOperations?: WsNodeOperations;
  /**
   * Storage for captured WebSocket execution details per node (for trace capture).
   * Populated by handleWsConnectNode/handleWsSendNode/handleWsReceiveNode, consumed when building eventDetails.
   */
  capturedWsDetails?: Map<string, import('../../../shared/types').CapturedWsNodeDetails>;
  /** gRPC client operations for grpcUnary/grpcServerStream node handlers. */
  grpcOperations?: GrpcNodeOperations;
  /**
   * Storage for captured gRPC execution details per node (for trace capture).
   * Populated by handleGrpcUnaryNode/handleGrpcServerStreamNode.
   */
  capturedGrpcDetails?: Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>;
  /** API Mock node capture for Results Explorer (Phase 11). */
  capturedApiMockDetails?: Map<string, import('../../../shared/types').CapturedApiMockNodeDetails>;
  /** Frozen per-run gRPC step results for grpcAssert evaluation (Phase 6E). */
  grpcStepResultStore?: import('../utils/grpcWorkflowStepResultStore').GrpcWorkflowStepResultStore;
  /** Collision-safe output namespace publisher (Phase 6F). */
  grpcOutputRegistry?: import('../utils/grpcWorkflowOutputRegistry').GrpcWorkflowOutputRegistry;
  /** Hydrated gRPC profiles + global auth for workflow Quick Test execution. */
  grpcWorkflowExecutionRuntime?: import('../utils/grpcWorkflowRuntimeContext').GrpcWorkflowExecutionRuntime;
}

/**
 * Captured details from HTTP node execution for full trace capture.
 */
export interface CapturedHttpNodeDetails {
  request: CapturedHttpRequest;
  response: CapturedHttpResponse;
  assertions?: AssertionResult[];
  variablesSnapshot?: Record<string, string>;
  extractedVariables?: Record<string, string>;
  mappingTraces?: import('../../../shared/components/data-mapper/utils/mappingTrace').MappingTrace[];
}

// Re-export so consumers of this file can still access it as one import
export type { CorrelationWaitRunnerConfig } from '@shared/types';

/** Mutable flag container so handlers can set allPassed = false */
export interface PassedFlag {
  value: boolean;
}

/**
 * Shared context interfaces for workflow node handlers.
 * Extracted here to avoid circular dependencies between the handler barrel
 * and individual handler modules.
 */
import type { WorkflowNode, WorkflowEdge, HttpNodeData, Workflow } from '../types/workflow';
import type { ICorrelationStore } from './correlationStore';
import type { RequestResult, Scenario } from '../../../shared/types';
import type { VariableContext } from './variableContext';
import type { TokenManager } from '../../../engine/tokenManager';
import type { DebugController } from './debugController';
import type { GraphRunCallbacks } from './graphRunnerInterfaces';
import type { CorrelationWaitRunnerConfig, ExecutionTraceOptions, CapturedHttpRequest, CapturedHttpResponse, AssertionResult } from '../../../shared/types';
import type { Semaphore } from '../../../shared/utils/semaphore';

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
}

// Re-export so consumers of this file can still access it as one import
export type { CorrelationWaitRunnerConfig } from '../../../shared/types';

/** Mutable flag container so handlers can set allPassed = false */
export interface PassedFlag {
  value: boolean;
}

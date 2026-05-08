import { vi } from 'vitest';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType, NodeRunStatus } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlers';
import { httpFetch } from '../../../shared/utils/httpClient';
import { executeScript } from './scriptSandbox';
import { VariableContext } from './variableContext';
import { TokenManager } from '../../../engine/tokenManager';

/** Typed mock for `httpFetch` — use after the same `vi.mock` for `httpClient` as in your test file. */
export function getMockFetch() {
  return vi.mocked(httpFetch);
}

/** Typed mock for `executeScript` — use after the same `vi.mock` for `scriptSandbox` as in your test file. */
export function getMockExecuteScript() {
  return vi.mocked(executeScript);
}

export function makeCtx(vars: Record<string, string> = {}) {
  return new VariableContext(vars);
}

export function makePassedFlag(value = true): PassedFlag {
  return { value };
}

export interface MockCallbackResult {
  states: Record<string, NodeRunStatus>;
  variables: Record<string, string>[];
  logLines: Array<{ prefix: string; text: string }>;
  callbacks: NodeHandlerContext['callbacks'];
}

export function makeCallbacks(): MockCallbackResult {
  const states: Record<string, NodeRunStatus> = {};
  const variables: Record<string, string>[] = [];
  const logLines: Array<{ prefix: string; text: string }> = [];
  return {
    states,
    variables,
    logLines,
    callbacks: {
      onNodeStateChange: vi.fn((id, status) => { states[id] = status; }),
      onVariablesChange: vi.fn((v) => variables.push({ ...v })),
      onComplete: vi.fn(),
      onLog: vi.fn((line) => logLines.push(line)),
    },
  };
}

export function makeNode(id: string, type: WorkflowNodeType, data: Record<string, unknown> = {}): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: type, ...data } };
}

export function makeEdge(id: string, source: string, target: string, sourceHandle?: string, label?: string): WorkflowEdge {
  return { id, source, target, sourceHandle, label } as WorkflowEdge;
}

export function makeHandlerContext(overrides: Partial<NodeHandlerContext> & { 
  initialVariables?: Record<string, string>;
  traceOptions?: { captureFullTrace?: boolean; alwaysCaptureFailures?: boolean; maxResponseBodySize?: number };
  capturedHttpDetails?: Map<string, unknown>;
} = {}): NodeHandlerContext {
  const initialVars = overrides.initialVariables ?? {};
  const ctx = overrides.ctx ?? makeCtx(initialVars);
  const { callbacks, logLines } = makeCallbacks();
  return {
    nodeMap: new Map(),
    outgoing: new Map(),
    ctx,
    tokenManager: new TokenManager(),
    results: [],
    allPassed: true,
    visited: new Set(),
    joinArrived: new Map(),
    incomingCount: new Map(),
    callbacks: overrides.callbacks ?? callbacks,
    log: overrides.log ?? ((line) => logLines.push(line)),
    nodeLabel: overrides.nodeLabel ?? ((id) => id),
    visit: overrides.visit ?? vi.fn(),
    visitOutgoing: overrides.visitOutgoing ?? vi.fn(),
    traceCollector: overrides.traceCollector ?? { onNodeStart: vi.fn(), onNodeComplete: vi.fn(), onEdgeTraversed: vi.fn(), getEvents: vi.fn(() => []), getTraversedEdges: vi.fn(() => []), reset: vi.fn() } as any,
    threadId: 'main',
    initialVariables: initialVars,
    traceOptions: overrides.traceOptions,
    capturedHttpDetails: overrides.capturedHttpDetails,
    ...overrides,
  };
}

// ── API Mock workflow node data types (Phase 11) ────

export type ApiMockWorkflowOnError = 'fail' | 'continue';

export interface ApiMockStartNodeData {
  [key: string]: unknown;
  label: string;
  /** Workspace server id to start (required). */
  serverId: string;
  definitionSource?: 'workspace';
  /** Optional port override — does not mutate the stored workspace definition. */
  portOverride?: number;
  /**
   * When true, uses a run-scoped server id (`${serverId}__run_${runId}`) so
   * parallel workflow/test runs do not collide.
   */
  isolateRun?: boolean;
  /** Variable names for outputs (defaults applied when empty). */
  savePortAs?: string;
  saveBaseUrlAs?: string;
  saveGenerationAs?: string;
  saveServerIdAs?: string;
  onError?: ApiMockWorkflowOnError;
}

export interface ApiMockApplyNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
  saveGenerationAs?: string;
  onError?: ApiMockWorkflowOnError;
}

export interface ApiMockResetStateNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
  onError?: ApiMockWorkflowOnError;
}

export interface ApiMockStopNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
  /** When true, missing/already-stopped servers are treated as success. */
  idempotent?: boolean;
  onError?: ApiMockWorkflowOnError;
}

export interface ApiMockAssertCallsNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
  routeId?: string;
  matchedResponseId?: string;
  expectedCount?: number;
  expectedMinCount?: number;
  expectedMaxCount?: number;
  expectedStatus?: number;
  expectedBodyContains?: string;
  /** How to compare `expectedBodyContains`. Default is substring contains. */
  expectedBodyMatch?: 'contains' | 'equals' | 'regex';
  /** Preferred header checks. Legacy `expectedHeaderKey` / `expectedHeaderValue` still apply when this is empty. */
  expectedHeaders?: Array<{ key: string; value?: string }>;
  expectedHeaderKey?: string;
  expectedHeaderValue?: string;
  /** Fail if the newest matching call is older than this many ms. */
  expectedLastCallWithinMs?: number;
  onError?: ApiMockWorkflowOnError;
}

export const API_MOCK_WORKFLOW_NODE_TYPES = [
  'apiMockStart',
  'apiMockApply',
  'apiMockResetState',
  'apiMockStop',
  'apiMockAssertCalls',
] as const;

export type ApiMockWorkflowNodeType = (typeof API_MOCK_WORKFLOW_NODE_TYPES)[number];

export function isApiMockWorkflowNodeType(type: string): type is ApiMockWorkflowNodeType {
  return (API_MOCK_WORKFLOW_NODE_TYPES as readonly string[]).includes(type);
}

export function defaultApiMockStartNodeData(): ApiMockStartNodeData {
  return {
    label: 'Start Mock Server',
    serverId: '',
    definitionSource: 'workspace',
    isolateRun: true,
    savePortAs: 'mockPort',
    saveBaseUrlAs: 'mockBaseUrl',
    saveGenerationAs: 'mockGeneration',
    saveServerIdAs: 'mockServerId',
    onError: 'fail',
  };
}

export function defaultApiMockApplyNodeData(): ApiMockApplyNodeData {
  return {
    label: 'Apply Definition',
    serverId: '',
    saveGenerationAs: 'mockGeneration',
    onError: 'fail',
  };
}

export function defaultApiMockResetStateNodeData(): ApiMockResetStateNodeData {
  return { label: 'Reset Mock State', serverId: '', onError: 'fail' };
}

export function defaultApiMockStopNodeData(): ApiMockStopNodeData {
  return { label: 'Stop Mock Server', serverId: '', idempotent: true, onError: 'fail' };
}

export function defaultApiMockAssertCallsNodeData(): ApiMockAssertCallsNodeData {
  return {
    label: 'Assert Mock Calls',
    serverId: '',
    expectedMinCount: 1,
    onError: 'fail',
  };
}

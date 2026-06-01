import type { NodeRunStatus, WorkflowNodeData } from '../types/workflow';

/**
 * Keys where `undefined` in a patch must still apply (clear host override on the HTTP node).
 */
const PATCH_UNDEFINED_ALLOWED = new Set(['hostEnvironmentId', 'hostMicroserviceId', 'hostBaseUrl']);

/**
 * Shallow-merge a node `data` patch. Call sites often build patches with `{ ...data, … }`; optional
 * fields become own properties with value `undefined`, which would wipe persisted keys on a plain
 * `{ ...base, ...patch }`. We omit those keys so the base object wins. To clear step variables,
 * pass `initialVariables: {}`. Host fields may still be set to `undefined` to clear overrides.
 */
export function mergeWorkflowNodeData(base: WorkflowNodeData, patch: Partial<WorkflowNodeData>): WorkflowNodeData {
  const p = { ...patch } as Record<string, unknown>;
  for (const k of Object.keys(p)) {
    if (p[k] === undefined && !PATCH_UNDEFINED_ALLOWED.has(k)) {
      delete p[k];
    }
  }
  return { ...base, ...p } as WorkflowNodeData;
}

/** Remove UI-only fields that must not live on persisted node `data` (e.g. after older builds stored run state on `data`). */
export function stripEphemeralNodeDataFields(data: WorkflowNodeData): WorkflowNodeData {
  if (data == null || typeof data !== 'object' || !('runStatus' in data)) return data;
  const { runStatus: _rs, ...rest } = data as WorkflowNodeData & { runStatus?: NodeRunStatus };
  return rest as WorkflowNodeData;
}

function stripDefaultKafkaNodeDataFields(data: WorkflowNodeData): WorkflowNodeData {
  if (data == null || typeof data !== 'object') return data;
  const raw = data as Record<string, unknown>;
  if (typeof raw.clusterId !== 'string' || typeof raw.topic !== 'string') return data;

  const looksLikeKafkaProduceNode =
    Object.prototype.hasOwnProperty.call(raw, 'keyTemplate')
    || Object.prototype.hasOwnProperty.call(raw, 'bodyTemplate')
    || Object.prototype.hasOwnProperty.call(raw, 'ackMode')
    || Object.prototype.hasOwnProperty.call(raw, 'headers')
    || Object.prototype.hasOwnProperty.call(raw, 'partition');
  const looksLikeKafkaConsumeNode =
    Object.prototype.hasOwnProperty.call(raw, 'keyRegex')
    || Object.prototype.hasOwnProperty.call(raw, 'headerFilters')
    || Object.prototype.hasOwnProperty.call(raw, 'jsonPathFilters')
    || Object.prototype.hasOwnProperty.call(raw, 'startPosition')
    || Object.prototype.hasOwnProperty.call(raw, 'loadTestBehavior')
    || Object.prototype.hasOwnProperty.call(raw, 'maxMessages');
  const looksLikeKafkaTriggerNode =
    Object.prototype.hasOwnProperty.call(raw, 'maxConcurrentRuns')
    && !Object.prototype.hasOwnProperty.call(raw, 'maxMessages')
    && !Object.prototype.hasOwnProperty.call(raw, 'correlationIdExpression');
  const looksLikeKafkaWaitNode =
    Object.prototype.hasOwnProperty.call(raw, 'correlationIdExpression')
    && Object.prototype.hasOwnProperty.call(raw, 'correlationSource')
    && !Object.prototype.hasOwnProperty.call(raw, 'webhookPath');

  const next = { ...raw };
  if (looksLikeKafkaProduceNode) {
    if (next.keyTemplate === '') delete next.keyTemplate;
    if (next.bodyTemplate === '') delete next.bodyTemplate;
    if (next.ackMode === 'all') delete next.ackMode;
    if (next.timeoutMs === 10000) delete next.timeoutMs;
  }
  if (looksLikeKafkaConsumeNode) {
    if (next.keyRegex === '') delete next.keyRegex;
    if (next.timeoutMs === 30000) delete next.timeoutMs;
    if (next.maxMessages === 1) delete next.maxMessages;
    if (next.startPosition === 'latest') delete next.startPosition;
  }
  if (looksLikeKafkaTriggerNode) {
    if (next.startPosition === 'latest') delete next.startPosition;
    if (next.maxConcurrentRuns === 10) delete next.maxConcurrentRuns;
    if (next.keyRegex === '') delete next.keyRegex;
    if (Array.isArray(next.extractVariables) && next.extractVariables.length === 0) delete next.extractVariables;
  }
  if (looksLikeKafkaWaitNode) {
    if (next.timeoutMs === 60000) delete next.timeoutMs;
    if (next.correlationJsonPath === '$.correlationId') delete next.correlationJsonPath;
    if (next.keyRegex === '') delete next.keyRegex;
    if (Array.isArray(next.extractVariables) && next.extractVariables.length === 0) delete next.extractVariables;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'partition') && next.partition == null) delete next.partition;
  if (Array.isArray(next.headers) && next.headers.length === 0) delete next.headers;
  if (Array.isArray(next.outputBindings) && next.outputBindings.length === 0) delete next.outputBindings;
  if (Array.isArray(next.headerFilters) && next.headerFilters.length === 0) delete next.headerFilters;
  if (Array.isArray(next.jsonPathFilters) && next.jsonPathFilters.length === 0) delete next.jsonPathFilters;

  const loadTestBehavior = next.loadTestBehavior as Record<string, unknown> | undefined;
  if (loadTestBehavior && loadTestBehavior.mode === 'wait-for-real' && Object.keys(loadTestBehavior).length === 1) {
    delete next.loadTestBehavior;
  }

  return next as WorkflowNodeData;
}

/**
 * Clone node `data` for persistence: strip UI-only fields, then JSON round-trip so only enumerable,
 * serializable values are stored (React Flow / proxies cannot drop nested keys like `initialVariables`).
 */
export function cloneWorkflowNodeDataForStorage(data: WorkflowNodeData): WorkflowNodeData {
  const cleaned = stripDefaultKafkaNodeDataFields(stripEphemeralNodeDataFields(data));
  try {
    return JSON.parse(JSON.stringify(cleaned)) as WorkflowNodeData;
  } catch {
    return cleaned;
  }
}

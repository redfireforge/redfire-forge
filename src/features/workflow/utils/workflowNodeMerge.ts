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

/**
 * Clone node `data` for persistence: strip UI-only fields, then JSON round-trip so only enumerable,
 * serializable values are stored (React Flow / proxies cannot drop nested keys like `initialVariables`).
 */
export function cloneWorkflowNodeDataForStorage(data: WorkflowNodeData): WorkflowNodeData {
  const cleaned = stripEphemeralNodeDataFields(data);
  try {
    return JSON.parse(JSON.stringify(cleaned)) as WorkflowNodeData;
  } catch {
    return cleaned;
  }
}

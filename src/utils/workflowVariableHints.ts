import type { HttpNodeData, WorkflowEdge, WorkflowNode } from '../types/workflow';

/** Dropdown entry: `ref` is the inner template key (no `{{ }}`), e.g. `channel` or `node:<id>.channel`. */
export interface WorkflowVariableHint {
  ref: string;
  label: string;
}

/** All nodes that can execute before `nodeId` (reverse walk along incoming edges). */
export function collectAncestorNodeIds(edges: WorkflowEdge[], nodeId: string): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e.source);
  }
  const seen = new Set<string>();
  const stack = [...(incoming.get(nodeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const p of incoming.get(id) ?? []) stack.push(p);
  }
  return seen;
}

/** Human-readable step title for hints, scoped refs, and label resolution. */
export function httpStepDisplayLabel(data: HttpNodeData): string {
  const d = data.label?.trim();
  if (d) return d;
  const n = data.scenario?.name?.trim();
  if (n) return n;
  return 'HTTP';
}

function stepLabel(data: HttpNodeData): string {
  return httpStepDisplayLabel(data);
}

/** True if this canvas node is an HTTP step (React Flow may omit `type` in edge cases). */
export function isHttpWorkflowNode(n: { type?: string; data?: unknown }): n is { type: string; data: HttpNodeData } {
  if (n.type === 'http') return true;
  return n.data != null && typeof n.data === 'object' && 'scenario' in (n.data as object);
}

/**
 * Scoped template inner ref: `node:"Step label".var` (readable) or `node:<uuid>.var` (legacy / fallback).
 */
export function formatNodeScopedRef(nodeId: string, stepLabel: string, varName: string): string {
  const safe = stepLabel.trim();
  if (!safe || safe.includes('"') || safe.includes('\n')) return `node:${nodeId}.${varName}`;
  return `node:"${safe}".${varName}`;
}

/**
 * Variable names safe to reference for conditions and HTTP config (insert picker):
 * this step's Initial variables (HTTP), workflow defaults, upstream HTTP extractions / initial vars (scoped),
 * and `status` / `node:"Step name".status`.
 */
export function collectConditionVariableHints(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  conditionNodeId: string,
  workflowVariables: Record<string, string>,
): WorkflowVariableHint[] {
  const ancestors = collectAncestorNodeIds(edges, conditionNodeId);
  const out: WorkflowVariableHint[] = [];
  const seen = new Set<string>();

  const push = (ref: string, label: string) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    out.push({ ref, label });
  };

  /** Must run before workflow keys so duplicate names prefer "(this step)" over "(workflow)". */
  const selfNode = nodes.find((n) => n.id === conditionNodeId);
  if (selfNode && isHttpWorkflowNode(selfNode)) {
    const data = selfNode.data as HttpNodeData;
    for (const k of Object.keys(data.initialVariables ?? {})) {
      if (!k.trim()) continue;
      const kt = k.trim();
      push(kt, `${kt} (this step)`);
    }
  }

  for (const k of Object.keys(workflowVariables)) {
    if (k.trim().length > 0) push(k.trim(), `${k.trim()} (workflow)`);
  }

  let hasHttpAncestor = false;
  for (const n of nodes) {
    if (!isHttpWorkflowNode(n) || !ancestors.has(n.id)) continue;
    hasHttpAncestor = true;
    const data = n.data as HttpNodeData;
    if (!data.scenario) continue;
    const label = stepLabel(data);

    for (const k of Object.keys(data.initialVariables ?? {})) {
      if (!k.trim()) continue;
      const kt = k.trim();
      push(kt, `${kt} (latest)`);
      push(formatNodeScopedRef(n.id, label, kt), `${kt} ← "${label}" (scoped)`);
    }
    for (const ex of data.scenario.extractions ?? []) {
      const nm = ex.name?.trim();
      if (nm) {
        push(nm, `${nm} (latest)`);
        push(formatNodeScopedRef(n.id, label, nm), `${nm} ← "${label}" (scoped)`);
      }
    }
  }

  if (hasHttpAncestor) {
    push('status', 'status (latest)');
    for (const n of nodes) {
      if (!isHttpWorkflowNode(n) || !ancestors.has(n.id)) continue;
      const data = n.data as HttpNodeData;
      const label = stepLabel(data);
      push(formatNodeScopedRef(n.id, label, 'status'), `status ← "${label}" (scoped)`);
    }
  }

  out.sort((a, b) => a.ref.localeCompare(b.ref));
  return out;
}

/**
 * Ensures names from the selected HTTP step’s `initialVariables` appear in the Insert picker even if
 * graph state used for {@link collectConditionVariableHints} is briefly out of sync with the panel.
 */
export function mergeHttpVariableHintsWithStepInitialVars(
  hints: WorkflowVariableHint[],
  httpData: HttpNodeData,
): WorkflowVariableHint[] {
  const byRef = new Map<string, WorkflowVariableHint>(hints.map((h) => [h.ref, h]));
  for (const k of Object.keys(httpData.initialVariables ?? {})) {
    const kt = k.trim();
    if (!kt) continue;
    if (!byRef.has(kt)) {
      byRef.set(kt, { ref: kt, label: `${kt} (this step)` });
    }
  }
  return Array.from(byRef.values()).sort((a, b) => a.ref.localeCompare(b.ref));
}

function hintRefSet(hints: WorkflowVariableHint[] | string[]): Set<string> {
  if (hints.length === 0) return new Set();
  if (typeof hints[0] === 'string') return new Set(hints as string[]);
  return new Set((hints as WorkflowVariableHint[]).map((h) => h.ref));
}

/** `{{name}}` placeholders excluding built-in generators (`{{$uuid}}`, …). */
export function parseNonGeneratorRefs(template: string): string[] {
  const refs: string[] = [];
  template.replace(/\{\{([^}]+)\}\}/g, (_m, inner: string) => {
    const t = inner.trim();
    if (t && !t.startsWith('$')) refs.push(t);
    return '';
  });
  return refs;
}

/**
 * If `left` is a single non-generator placeholder only, return its inner name; otherwise null.
 */
export function parseSingleVariableRef(left: string): string | null {
  const t = left.trim();
  const m = t.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (!m) return null;
  const inner = m[1].trim();
  if (inner.startsWith('$')) return null;
  return inner;
}

export function validateConditionLeftRefs(
  left: string,
  hints: WorkflowVariableHint[] | string[],
): { ok: boolean; unknown: string[] } {
  const refs = parseNonGeneratorRefs(left);
  const hintSet = hintRefSet(hints);
  const unknown = refs.filter((r) => !hintSet.has(r));
  return { ok: unknown.length === 0, unknown };
}

export function guessConditionLeftMode(left: string): 'pick' | 'expr' {
  return parseSingleVariableRef(left) !== null ? 'pick' : 'expr';
}

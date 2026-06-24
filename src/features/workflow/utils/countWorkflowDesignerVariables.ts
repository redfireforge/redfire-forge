import type { WorkflowRFNode } from './workflowNodeFactory';
import type { Workflow } from '../types/workflow';

/** Count unique workflow-level defaults plus per-HTTP-step initial variable keys. */
export function countWorkflowDesignerVariables(
  workflowVariables: Record<string, string>,
  nodes: WorkflowRFNode[],
  nodeInitialVars: Record<string, Record<string, string>>,
): number {
  const s = new Set<string>(Object.keys(workflowVariables));
  for (const n of nodes) {
    if (n.type === 'http') {
      const iv = nodeInitialVars[n.id];
      if (iv) for (const k of Object.keys(iv)) s.add(k);
    }
    // GraphQL nodes bind runtime outputs via outputBindings / extractionRules — those
    // names belong in workflow.variables when users need defaults; do not count internal
    // hint slots (__gql_*) here or the toolbar badge disagrees with the Variables modal.
  }
  return s.size;
}

// Regex for simple {{varName}} placeholders — matches word chars and dots only;
// skips $expressions and node:"Step".field scoped refs.
const TEMPLATE_VAR_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

/**
 * Scan all node data fields for `{{varName}}` references and return unique names,
 * excluding node-scoped (`node:"..."`) and expression (`$...`) syntax.
 */
export function collectWorkflowReferencedVariables(nodes: Workflow['nodes']): Set<string> {
  const found = new Set<string>();
  const scan = (val: unknown) => {
    if (typeof val === 'string') {
      for (const m of val.matchAll(TEMPLATE_VAR_RE)) {
        const name = m[1].trim();
        if (!name.includes(':') && !name.startsWith('$')) found.add(name);
      }
    } else if (Array.isArray(val)) {
      val.forEach(scan);
    } else if (val && typeof val === 'object') {
      Object.values(val as Record<string, unknown>).forEach(scan);
    }
  };
  for (const node of nodes) scan(node.data);
  return found;
}

/**
 * Build the initial variables map for the Workflow Runner from a saved workflow.
 *
 * Merges two sources (lowest → highest priority):
 *  1. Variables **referenced** in node configs via `{{varName}}` — added with empty value
 *     so users can see every placeholder the workflow needs.
 *  2. Variables **configured** in `workflow.variables` — override with their saved value.
 *
 * Result: every variable the workflow uses appears in the runner panel, pre-filled with
 * its configured default when one exists, or blank when it hasn't been set yet.
 */
export function buildInitialRunnerVariables(workflow: Pick<Workflow, 'variables' | 'nodes'>): Record<string, string> {
  const referenced = collectWorkflowReferencedVariables(workflow.nodes);
  const result: Record<string, string> = {};
  // Seed referenced vars with empty strings first
  for (const name of referenced) result[name] = '';
  // Apply configured defaults (higher priority — may have non-empty values)
  Object.assign(result, workflow.variables);
  return result;
}

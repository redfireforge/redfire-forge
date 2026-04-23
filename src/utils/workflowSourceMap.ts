import type { WorkflowVariableHint } from './workflowVariableHints';

/**
 * Build a Map<variableRef, sourceLabel> from variable hints.
 *
 * Used by ParamsEditor and VariablesSection to show the "source" column.
 *
 * @param hints         Variable hints for the current scope (HTTP step, condition, etc.)
 * @param workflowVars  Optional workflow-level default variables — when provided, refs
 *                      that exist as workflow defaults get labelled "Default" even if
 *                      the hint source says "this step".
 */
export function buildVariableSourceMap(
  hints: WorkflowVariableHint[],
  workflowVars?: Record<string, string>,
): Map<string, string> {
  const m = new Map<string, string>();

  // First pass: collect step names from scoped hints (e.g. `node:id.channel ← "Trial Offer" (scoped)`)
  const stepNames = new Map<string, string>(); // baseName → stepName
  for (const h of hints) {
    const arrowMatch = h.label.match(/← "([^"]+)"/);
    if (arrowMatch) {
      const dotIdx = h.ref.lastIndexOf('.');
      const baseName = dotIdx >= 0 ? h.ref.slice(dotIdx + 1) : h.ref;
      if (!stepNames.has(baseName)) stepNames.set(baseName, arrowMatch[1]);
    }
  }

  // Second pass: map each simple ref to its source
  for (const h of hints) {
    if (m.has(h.ref) || h.ref.includes(':')) continue; // skip already-mapped or scoped refs
    const parenMatch = h.label.match(/\(([^)]+)\)\s*$/);
    if (!parenMatch) continue;
    const source = parenMatch[1];
    if (source === 'workflow') {
      m.set(h.ref, 'Default');
    } else if (source === 'this step') {
      // If workflowVars provided and the ref also exists there, label as Default
      if (workflowVars && h.ref in workflowVars) {
        m.set(h.ref, 'Default');
      } else {
        m.set(h.ref, 'This step');
      }
    } else if (source === 'latest') {
      m.set(h.ref, stepNames.get(h.ref) ?? 'Upstream');
    }
  }

  // Also check workflow variables directly for any refs not yet mapped
  if (workflowVars) {
    for (const k of Object.keys(workflowVars)) {
      const kt = k.trim();
      if (kt && !m.has(kt)) m.set(kt, 'Default');
    }
  }

  return m;
}

/**
 * Extract the source label for a variable value reference.
 *
 * - `{{node:"Step Name".var}}` → source = "Step Name"
 * - `{{var}}` → looked up from sourceMap
 *
 * Returns `{ source, displayValue }` where displayValue has node-scoped refs simplified.
 */
export function resolveVariableSource(
  value: string,
  sourceMap: Map<string, string>,
): { source: string; displayValue: string } {
  const nodeMatch = value.match(/\{\{node:"([^"]+)"\./);
  if (nodeMatch) {
    return {
      source: nodeMatch[1],
      displayValue: value.replace(/\{\{node:"[^"]+"\.(.+?)\}\}/g, '{{$1}}'),
    };
  }
  const simpleMatch = value.match(/^\{\{(.+?)\}\}$/);
  const source = simpleMatch ? (sourceMap.get(simpleMatch[1]) ?? '') : '';
  return { source, displayValue: value };
}

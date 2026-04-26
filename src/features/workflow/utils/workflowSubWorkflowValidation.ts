import type { Workflow, WorkflowNode, SubWorkflowNodeData } from '../types/workflow';

export type ValidationSeverity = 'error' | 'warning';

export interface SubWorkflowValidationIssue {
  nodeId: string;
  nodeLabel: string;
  severity: ValidationSeverity;
  message: string;
}

/**
 * Validate all sub-workflow nodes in a workflow before execution.
 * Checks for dangling references, circular dependencies, missing input mappings,
 * and maxDepth sanity.
 *
 * @param workflow  The workflow being validated.
 * @param allWorkflows  All saved workflows (used to resolve references).
 * @returns Array of validation issues (empty = valid).
 */
export function validateSubWorkflowNodes(
  workflow: Workflow,
  allWorkflows: Workflow[],
): SubWorkflowValidationIssue[] {
  const issues: SubWorkflowValidationIssue[] = [];
  const workflowMap = new Map(allWorkflows.map((w) => [w.id, w]));

  const subNodes = workflow.nodes.filter(
    (n): n is WorkflowNode & { data: SubWorkflowNodeData } => n.type === 'subWorkflow',
  );

  for (const node of subNodes) {
    const data = node.data;
    const label = data.label || 'Sub-Workflow';

    // 1. Dangling reference — workflowId must be non-empty and resolve
    if (!data.workflowId) {
      issues.push({
        nodeId: node.id,
        nodeLabel: label,
        severity: 'error',
        message: 'No workflow selected.',
      });
      continue; // Skip further checks since there's no reference
    }

    // Dynamic expression — can't statically validate, warn and skip further checks
    const isDynamic = data.workflowId.includes('{{');
    if (isDynamic) {
      issues.push({
        nodeId: node.id,
        nodeLabel: label,
        severity: 'warning',
        message: `Dynamic workflow ID "${data.workflowId}" — cannot validate until runtime.`,
      });
      continue;
    }

    if (!workflowMap.has(data.workflowId)) {
      issues.push({
        nodeId: node.id,
        nodeLabel: label,
        severity: 'error',
        message: `Referenced workflow "${data.workflowName || data.workflowId}" not found.`,
      });
      continue;
    }

    // 2. Self-reference
    if (data.workflowId === workflow.id) {
      issues.push({
        nodeId: node.id,
        nodeLabel: label,
        severity: 'error',
        message: 'Workflow references itself (direct self-reference).',
      });
      continue;
    }

    // 3. Circular dependency — walk the reference chain
    const cycle = detectCycle(workflow.id, data.workflowId, workflowMap);
    if (cycle) {
      issues.push({
        nodeId: node.id,
        nodeLabel: label,
        severity: 'error',
        message: `Circular dependency detected: ${cycle}.`,
      });
    }

    // 4. Missing input mappings — warn if child's Start node has inputVariables not covered
    const childWorkflow = workflowMap.get(data.workflowId)!;
    const childStartNode = childWorkflow.nodes.find((n) => n.type === 'start');
    if (childStartNode) {
      const childInputVars = Object.keys(
        (childStartNode.data as { inputVariables?: Record<string, string> }).inputVariables ?? {},
      );
      const mappedTargets = new Set(data.inputMappings.map((m) => m.targetVariable));
      const unmapped = childInputVars.filter((v) => !mappedTargets.has(v));
      if (unmapped.length > 0) {
        issues.push({
          nodeId: node.id,
          nodeLabel: label,
          severity: 'warning',
          message: `Child workflow expects input variable(s) not mapped: ${unmapped.join(', ')}.`,
        });
      }
    }

    // 5. Max depth sanity
    const maxDepth = data.maxDepth ?? 10;
    if (maxDepth < 1 || maxDepth > 100) {
      issues.push({
        nodeId: node.id,
        nodeLabel: label,
        severity: 'error',
        message: `Max depth must be between 1 and 100 (got ${maxDepth}).`,
      });
    }

    // 6. Multi-instance validation
    if (data.multiInstance) {
      if (!data.multiInstance.collection.trim()) {
        issues.push({
          nodeId: node.id,
          nodeLabel: label,
          severity: 'error',
          message: 'Multi-instance collection expression is empty.',
        });
      }
      if (!data.multiInstance.elementVariable.trim()) {
        issues.push({
          nodeId: node.id,
          nodeLabel: label,
          severity: 'error',
          message: 'Multi-instance element variable name is empty.',
        });
      }
    }
  }

  return issues;
}

/**
 * Detect circular dependencies in sub-workflow references.
 * Walks from `childId` through all transitive sub-workflow references
 * checking if we ever reach `rootId`.
 *
 * @returns A human-readable cycle chain string, or null if no cycle.
 */
function detectCycle(
  rootId: string,
  childId: string,
  workflowMap: Map<string, Workflow>,
): string | null {
  const visited = new Set<string>();
  const path: string[] = [];

  function walk(currentId: string): string | null {
    if (currentId === rootId) {
      const rootName = workflowMap.get(rootId)?.name ?? rootId;
      return [...path, rootName].join(' → ');
    }
    if (visited.has(currentId)) return null;
    visited.add(currentId);

    const wf = workflowMap.get(currentId);
    if (!wf) return null;

    path.push(wf.name ?? currentId);

    const subNodes = wf.nodes.filter((n) => n.type === 'subWorkflow');
    for (const node of subNodes) {
      const data = node.data as SubWorkflowNodeData;
      if (data.workflowId) {
        const result = walk(data.workflowId);
        if (result) return result;
      }
    }

    path.pop();
    return null;
  }

  return walk(childId);
}

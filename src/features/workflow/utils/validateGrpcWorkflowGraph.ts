/**
 * Phase 6A — graph-time validation for gRPC workflow nodes.
 */
import type { WorkflowNode } from '../types/workflow';
import type {
  GrpcAssertNodeData,
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
} from '../types/workflow/node-grpc';
import {
  isGrpcWorkflowCallNodeType,
  isGrpcWorkflowNodeTypeIncludingAdvanced,
} from '../types/workflow/node-grpc';
import {
  GRPC_WORKFLOW_RESERVED_SAVE_AS,
  GRPC_WORKFLOW_VALIDATION_CODES,
  isValidGrpcWorkflowSaveAsAlias,
  type GrpcWorkflowValidationIssue,
  validateGrpcWorkflowNodeData,
} from './grpcWorkflowNodeValidation';

export interface GrpcWorkflowGraphValidationResult {
  valid: boolean;
  issues: GrpcWorkflowValidationIssue[];
}

/** Graph alias rules apply only to syntactically valid, non-reserved saveAs values. */
function isGraphTrackedSaveAsAlias(saveAs: string | undefined): saveAs is string {
  const trimmed = saveAs?.trim();
  if (!trimmed) return false;
  if (
    GRPC_WORKFLOW_RESERVED_SAVE_AS.includes(trimmed as typeof GRPC_WORKFLOW_RESERVED_SAVE_AS[number])
  ) {
    return false;
  }
  return isValidGrpcWorkflowSaveAsAlias(trimmed);
}

function readGrpcNodeSaveAs(node: WorkflowNode): string | undefined {
  if (!isGrpcWorkflowNodeTypeIncludingAdvanced(node.type)) return undefined;
  return (node.data as { saveAs?: string }).saveAs;
}

function collectSaveAsAliases(nodes: WorkflowNode[]): Map<string, string[]> {
  const aliasToNodeIds = new Map<string, string[]>();
  for (const node of nodes) {
    const saveAs = readGrpcNodeSaveAs(node);
    if (!isGraphTrackedSaveAsAlias(saveAs)) continue;
    const trimmed = saveAs.trim();
    const existing = aliasToNodeIds.get(trimmed) ?? [];
    existing.push(node.id);
    aliasToNodeIds.set(trimmed, existing);
  }
  return aliasToNodeIds;
}

function collectKnownAssertSources(nodes: WorkflowNode[]): Set<string> {
  const sources = new Set<string>();
  for (const node of nodes) {
    if (!isGrpcWorkflowCallNodeType(node.type)) continue;
    sources.add(node.id);
    const saveAs = (node.data as GrpcUnaryNodeData | GrpcServerStreamNodeData).saveAs;
    if (isGraphTrackedSaveAsAlias(saveAs)) sources.add(saveAs.trim());
  }
  return sources;
}

function validateSaveAsUniqueness(
  nodes: WorkflowNode[],
  issues: GrpcWorkflowValidationIssue[],
): void {
  const aliasToNodeIds = collectSaveAsAliases(nodes);
  for (const [alias, nodeIds] of aliasToNodeIds) {
    if (nodeIds.length <= 1) continue;
    for (const nodeId of nodeIds) {
      issues.push({
        nodeId,
        field: 'saveAs',
        code: GRPC_WORKFLOW_VALIDATION_CODES.DUPLICATE_SAVE_AS,
        message: `saveAs alias "${alias}" is used by multiple gRPC nodes`,
      });
    }
  }
}

function validateAssertSources(
  nodes: WorkflowNode[],
  issues: GrpcWorkflowValidationIssue[],
): void {
  const knownSources = collectKnownAssertSources(nodes);
  for (const node of nodes) {
    if (node.type !== 'grpcAssert') continue;
    const source = (node.data as GrpcAssertNodeData).source?.trim();
    if (!source || knownSources.has(source)) continue;
    issues.push({
      nodeId: node.id,
      field: 'source',
      code: GRPC_WORKFLOW_VALIDATION_CODES.UNKNOWN_ASSERT_SOURCE,
      message: `Assert source "${source}" does not match any gRPC call node id or saveAs alias in this workflow`,
    });
  }
}

function validateSaveAsDoesNotShadowNodeIds(
  nodes: WorkflowNode[],
  issues: GrpcWorkflowValidationIssue[],
): void {
  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    const saveAs = readGrpcNodeSaveAs(node);
    if (!isGraphTrackedSaveAsAlias(saveAs) || saveAs.trim() === node.id || !nodeIds.has(saveAs.trim())) continue;
    issues.push({
      nodeId: node.id,
      field: 'saveAs',
      code: GRPC_WORKFLOW_VALIDATION_CODES.SAVE_AS_SHADOWS_NODE_ID,
      message: `saveAs "${saveAs.trim()}" shadows an existing node id in this workflow`,
    });
  }
}

function buildGrpcCallSourceCallTypes(
  nodes: WorkflowNode[],
): Map<string, 'unary' | 'server_streaming'> {
  const callTypes = new Map<string, 'unary' | 'server_streaming'>();
  for (const node of nodes) {
    if (!isGrpcWorkflowCallNodeType(node.type)) continue;
    const data = node.data as GrpcUnaryNodeData | GrpcServerStreamNodeData;
    callTypes.set(node.id, data.callType);
    if (isGraphTrackedSaveAsAlias(data.saveAs)) callTypes.set(data.saveAs.trim(), data.callType);
  }
  return callTypes;
}

function validateAssertSourceCallTypes(
  nodes: WorkflowNode[],
  issues: GrpcWorkflowValidationIssue[],
): void {
  const callTypes = buildGrpcCallSourceCallTypes(nodes);
  for (const node of nodes) {
    if (node.type !== 'grpcAssert') continue;
    const data = node.data as GrpcAssertNodeData;
    const source = data.source?.trim();
    if (!source) continue;
    const sourceCallType = callTypes.get(source);
    if (!sourceCallType) continue;
    const usesStreamLength = (data.assertions ?? []).some(
      (assertion) => 'grpcStreamLength' in assertion && assertion.grpcStreamLength !== undefined,
    );
    if (usesStreamLength && sourceCallType !== 'server_streaming') {
      issues.push({
        nodeId: node.id,
        field: 'source',
        code: GRPC_WORKFLOW_VALIDATION_CODES.ASSERT_SOURCE_CALL_TYPE_MISMATCH,
        message: 'grpcStreamLength assertions require a grpcServerStream source',
      });
    }
  }
}

/** Validate all gRPC nodes in a workflow graph (per-node schema + graph rules). */
export function validateGrpcWorkflowGraph(nodes: WorkflowNode[]): GrpcWorkflowGraphValidationResult {
  const issues: GrpcWorkflowValidationIssue[] = [];

  for (const node of nodes) {
    if (!isGrpcWorkflowNodeTypeIncludingAdvanced(node.type)) continue;
    const nodeResult = validateGrpcWorkflowNodeData(node.type, node.data, node.id);
    if (!nodeResult.valid) {
      issues.push(...nodeResult.issues);
    }
  }

  validateSaveAsDoesNotShadowNodeIds(nodes, issues);
  validateSaveAsUniqueness(nodes, issues);
  validateAssertSources(nodes, issues);
  validateAssertSourceCallTypes(nodes, issues);

  return { valid: issues.length === 0, issues };
}

/** True when the workflow contains at least one gRPC node. */
export function workflowGraphHasGrpcNodes(nodes: WorkflowNode[]): boolean {
  return nodes.some((node) => isGrpcWorkflowNodeTypeIncludingAdvanced(node.type));
}

/** Workflow-level save/run guard — includes graph rules (saveAs, assert source, call-type). */
export function hasGrpcWorkflowGraphConfigErrors(nodes: WorkflowNode[]): boolean {
  if (!workflowGraphHasGrpcNodes(nodes)) return false;
  return !validateGrpcWorkflowGraph(nodes).valid;
}

/** First blocking validation message suitable for Quick Test toasts. */
export function summarizeGrpcWorkflowGraphValidation(
  result: GrpcWorkflowGraphValidationResult,
): string {
  if (result.valid) return '';
  const first = result.issues[0];
  if (!first) return 'gRPC workflow configuration is invalid';
  const prefix = first.nodeId ? `[${first.nodeId}] ` : '';
  return `${prefix}${first.message}`;
}

/**
 * Handlers for control-flow nodes: Condition, Delay, Fork, Join, Switch.
 */
import type {
  WorkflowNode, WorkflowEdge, ConditionNodeData, DelayNodeData, SwitchNodeData,
} from '../types/workflow';
import type { NodeHandlerContext } from './graphRunnerNodeHandlerContext';
import { evaluateCondition, markSubtreeSkipped } from './graphRunnerHelpers';

export async function handleConditionNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as ConditionNodeData;
  const resolvedLeft = hCtx.ctx.resolve(data.left);
  const resolvedRight = hCtx.ctx.resolve(data.right);
  const condResult = evaluateCondition(data, hCtx.ctx);
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] ${resolvedLeft} ${data.operator} ${resolvedRight} → ${condResult ? 'Yes' : 'No'}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });

  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const matchesTakenBranch = (e: WorkflowEdge) =>
    condResult ? (e.sourceHandle === 'true' || e.label === 'Yes') : (e.sourceHandle === 'false' || e.label === 'No');
  const matchesSkippedBranch = (e: WorkflowEdge) =>
    condResult ? (e.sourceHandle === 'false' || e.label === 'No') : (e.sourceHandle === 'true' || e.label === 'Yes');

  const matchEdges = nextEdges.filter(matchesTakenBranch);
  const skipEdges = nextEdges.filter(matchesSkippedBranch);

  for (const e of skipEdges) {
    markSubtreeSkipped(e.target, hCtx.outgoing, hCtx.nodeMap, hCtx.visited, hCtx.callbacks, hCtx.incomingCount);
  }
  for (const e of matchEdges) {
    hCtx.traceCollector?.onEdgeTraversed(e.id);
  }
  if (matchEdges.length > 1) {
    await Promise.all(matchEdges.map((e, i) =>
      hCtx.visit(e.target, `${hCtx.threadId}-cond-${i}`)
    ));
  } else {
    for (const e of matchEdges) {
      await hCtx.visit(e.target, hCtx.threadId);
    }
  }
}

export async function handleDelayNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as DelayNodeData;
  const ms = data.mode === 'random'
    ? (data.minMs ?? 0) + Math.random() * ((data.maxMs ?? data.delayMs) - (data.minMs ?? 0))
    : data.delayMs;

  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Delay ${Math.round(ms)}ms...` });
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (hCtx.abortSignal) {
      const onAbort = () => { clearTimeout(timer); resolve(); };
      hCtx.abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  });

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

export async function handleForkNode(
  nodeId: string,
  _node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Forking into ${nextEdges.length} branches` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  for (const edge of nextEdges) {
    hCtx.traceCollector?.onEdgeTraversed(edge.id);
  }
  await Promise.all(nextEdges.map((edge, i) =>
    hCtx.visit(edge.target, `${hCtx.threadId}-branch-${i}`)
  ));
}

export async function handleJoinNode(
  nodeId: string,
  _node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] All branches joined` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

export async function handleSwitchNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as SwitchNodeData;
  const resolvedExpr = hCtx.ctx.resolve(data.expression);
  const cases = data.cases ?? [];
  const matchedCase = cases.find(c => c.value === resolvedExpr);
  const matchHandle = matchedCase ? `case-${matchedCase.id}` : 'default';
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Switch "${resolvedExpr}" → ${matchedCase ? (matchedCase.label || matchedCase.value) : 'Default'}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });

  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const takenEdges = nextEdges.filter(e => e.sourceHandle === matchHandle);
  const skippedEdges = nextEdges.filter(e => e.sourceHandle !== matchHandle);

  for (const e of skippedEdges) {
    markSubtreeSkipped(e.target, hCtx.outgoing, hCtx.nodeMap, hCtx.visited, hCtx.callbacks, hCtx.incomingCount);
  }
  for (const e of takenEdges) {
    hCtx.traceCollector?.onEdgeTraversed(e.id);
    await hCtx.visit(e.target, hCtx.threadId);
  }
}

/**
 * Handler for Loop nodes in the workflow graph.
 */
import type { WorkflowNode, LoopNodeData } from '../types/workflow';
import type { NodeHandlerContext } from './graphRunnerNodeHandlerContext';
import { evaluateCondition, collectReachableFromEdges } from './graphRunnerHelpers';

export async function handleLoopNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as LoopNodeData;
  const maxIter = data.maxIterations ?? 100;
  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const bodyEdges = nextEdges.filter(e => e.sourceHandle === 'body');
  const doneEdges = nextEdges.filter(e => e.sourceHandle === 'done');

  const bodyNodeIds = collectReachableFromEdges(bodyEdges, hCtx.outgoing, hCtx.nodeMap, doneEdges.map(e => e.target));

  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Loop (${data.mode}) starting — body: ${bodyNodeIds.size} nodes` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  let iterations = 0;
  let items: unknown[] = [];

  if (data.mode === 'forEach') {
    // Check for inline data source first
    if (data.dataSource) {
      const enabledRows = data.dataSource.rows.filter(r => r.enabled);
      items = enabledRows.map(row => {
        const obj: Record<string, string> = {};
        for (const col of data.dataSource!.columns) {
          obj[col.name] = row.values[col.id] ?? '';
        }
        return obj;
      });
    }
    if (items.length === 0) {
      const raw = hCtx.ctx.resolve(data.sourceExpression ?? '');
      try { items = JSON.parse(raw); } catch { items = []; }
      if (!Array.isArray(items)) items = [];
    }
  }

  const idxVar = data.indexVariable || 'i';
  hCtx.ctx.set(idxVar, '0');
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  const shouldContinue = (): boolean => {
    if (hCtx.abortSignal?.aborted || hCtx.debugController?.isStopped) return false;
    if (iterations >= maxIter) return false;
    switch (data.mode) {
      case 'count': {
        const countExpr = data.countExpression ? hCtx.ctx.resolve(data.countExpression) : '';
        const total = countExpr ? parseInt(countExpr, 10) : (data.count ?? 1);
        return iterations < (isNaN(total) ? 1 : total);
      }
      case 'forEach':
        return iterations < items.length;
      case 'while':
        return evaluateCondition(
          { label: '', left: data.whileLeft ?? '', operator: data.whileOperator ?? '==', right: data.whileRight ?? '' },
          hCtx.ctx,
        );
      default:
        return false;
    }
  };

  while (shouldContinue()) {
    hCtx.ctx.set(idxVar, String(iterations));

    if (data.mode === 'forEach' && iterations < items.length) {
      const itemVar = data.itemVariable || 'item';
      const val = items[iterations];
      hCtx.ctx.set(itemVar, typeof val === 'string' ? val : JSON.stringify(val));
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    for (const bid of bodyNodeIds) {
      hCtx.visited.delete(bid);
    }
    for (const bid of bodyNodeIds) {
      hCtx.joinArrived.delete(bid);
    }

    hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Iteration ${iterations}` });

    for (const e of bodyEdges) {
      await hCtx.visit(e.target, `${hCtx.threadId}-loop-${iterations}`);
    }

    iterations++;
    hCtx.ctx.set(idxVar, String(iterations));
  }

  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Loop complete — ${iterations} iteration(s)` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });

  for (const e of doneEdges) {
    await hCtx.visit(e.target, hCtx.threadId);
  }
}


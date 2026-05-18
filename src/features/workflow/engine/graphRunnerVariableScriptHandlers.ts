/**
 * Handlers for data-manipulation nodes: SetVariable, Script, Aggregate.
 */
import type {
  WorkflowNode, SetVariableNodeData, ScriptNodeData, AggregateNodeData,
} from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import { executeScript } from './scriptSandbox';
import { loadScriptLibraries, buildLibraryPreamble } from './scriptLibraries';

export async function handleSetVariableNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as SetVariableNodeData;
  const assignments = data.assignments ?? [];
  for (const a of assignments) {
    if (a.name) {
      const resolved = hCtx.ctx.resolve(a.expression);
      hCtx.ctx.set(a.name, resolved);
    }
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Set ${assignments.filter(a => a.name).length} variable(s)` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

export async function handleScriptNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as ScriptNodeData;
  hCtx.log({ prefix: '#', text: `[${hCtx.nodeLabel(nodeId)}] Executing script (${data.mode})...` });

  const inputVars: Record<string, string> = {};
  for (const varName of data.inputVariables) {
    inputVars[varName] = hCtx.ctx.resolve(`{{${varName}}}`);
  }

  const result = executeScript(data, inputVars,
    data.libraryIds?.length ? buildLibraryPreamble(loadScriptLibraries(), data.libraryIds) : undefined,
  );

  if (data.captureConsole) {
    for (const line of result.consoleLogs) {
      hCtx.log({ prefix: '#', text: `[${hCtx.nodeLabel(nodeId)}] console: ${line}` });
    }
  }

  if (result.consoleLogs.length > 0) {
    hCtx.capturedScriptOutput?.set(nodeId, result.consoleLogs);
  }

  if (!result.success) {
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'fail',
      error: result.error,
      responseDetail: result.error,
    });
    passed.value = false;
  } else {
    for (const [k, v] of Object.entries(result.outputs)) {
      hCtx.ctx.set(k, v);
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'pass',
      responseDetail: JSON.stringify(result.outputs, null, 2),
    });
  }

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

export async function handleAggregateNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as AggregateNodeData;
  const mappings = data.mappings ?? [];
  for (const m of mappings) {
    if (!m.targetVariable) continue;
    const sourceVal = hCtx.ctx.resolve(m.sourceExpression);
    let result: string;
    switch (m.strategy) {
      case 'concat': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        let arr: unknown[];
        try { arr = JSON.parse(existing); } catch { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        try { arr.push(JSON.parse(sourceVal)); } catch { arr.push(sourceVal); }
        result = JSON.stringify(arr);
        break;
      }
      case 'first': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        result = existing !== `{{${m.targetVariable}}}` ? existing : sourceVal;
        break;
      }
      case 'last':
        result = sourceVal;
        break;
      case 'count': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        const prev = parseInt(existing, 10);
        result = String((isNaN(prev) ? 0 : prev) + 1);
        break;
      }
      case 'sum': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        const prev = parseFloat(existing);
        const add = parseFloat(sourceVal);
        result = String((isNaN(prev) ? 0 : prev) + (isNaN(add) ? 0 : add));
        break;
      }
      case 'custom':
        result = hCtx.ctx.resolve(m.customExpression ?? sourceVal);
        break;
      default:
        result = sourceVal;
    }
    hCtx.ctx.set(m.targetVariable, result);
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Aggregated ${mappings.filter(m => m.targetVariable).length} mapping(s)` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

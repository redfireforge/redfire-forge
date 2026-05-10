import type { WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';
import type { LogLine } from '../../../shared/utils/consoleLogUtils';
import { formatNodeTypeConsole as formatNodeType } from './nodeTypeLabels';

/**
 * Reconstruct console-style LogLines from structured ExecutionEvent data.
 * Builds a narrative log from the iteration's events — HTTP summaries,
 * variable extractions, assertions, errors, and edge traversals.
 * Recursively expands sub-workflow traces with increasing depth.
 */
export function reconstructLogLines(
  iteration: WorkflowIterationTrace,
  options?: {
    nodeFilter?: string;
    includeHttpBodies?: boolean;
    preferRawLogs?: boolean;
  },
): LogLine[] {
  const lines: LogLine[] = [];
  const nodeFilter = options?.nodeFilter;
  const includeHttpBodies = options?.includeHttpBodies ?? false;
  const preferRawLogs = options?.preferRawLogs ?? false;

  lines.push({
    prefix: '*',
    text: `Iteration #${iteration.index + 1} started`,
    ts: iteration.events[0]?.timestamp ?? 0,
  });

  emitEvents(lines, iteration.events, { nodeFilter, includeHttpBodies, preferRawLogs, depth: 0 });

  lines.push({
    prefix: iteration.passed ? '*' : '!',
    text: `Iteration #${iteration.index + 1} ${iteration.passed ? 'PASSED' : 'FAILED'} — ${iteration.durationMs}ms`,
    ts: (iteration.events[iteration.events.length - 1]?.timestamp ?? 0) + (iteration.events[iteration.events.length - 1]?.durationMs ?? 0),
  });

  return lines;
}

const MAX_SUB_WORKFLOW_DEPTH = 5;

function emitEvents(
  lines: LogLine[],
  events: ExecutionEvent[],
  ctx: { nodeFilter?: string; includeHttpBodies: boolean; preferRawLogs: boolean; depth: number },
): void {
  const { nodeFilter, includeHttpBodies, preferRawLogs, depth } = ctx;

  for (const event of events) {
    if (nodeFilter && depth === 0 && event.nodeId !== nodeFilter) continue;

    const label = event.nodeLabel || event.nodeId;
    const ts = event.timestamp;
    const d = event.details;

    // When raw logLines are available and preferred, emit them directly
    if (preferRawLogs && d?.logLines && d.logLines.length > 0) {
      for (const raw of d.logLines) {
        lines.push({
          prefix: raw.prefix,
          text: raw.text,
          ts: raw.ts,
          nodeId: event.nodeId,
          nodeLabel: label,
          depth,
        });
      }
    } else {
      lines.push({
        prefix: '*',
        text: `${formatNodeType(event.nodeType)} — started`,
        ts,
        nodeId: event.nodeId,
        nodeLabel: label,
        depth,
      });

      if (d) {
        emitDetails(lines, event, d, { includeHttpBodies, depth });
      }
    }

    if (d) {

      // Sub-workflow: recurse into child trace
      if (d.subWorkflowTrace && depth < MAX_SUB_WORKFLOW_DEPTH) {
        const childTrace = d.subWorkflowTrace;
        const childName = childTrace.workflowName ?? d.subWorkflowId ?? 'child';
        lines.push({
          prefix: '*',
          text: `▶ Sub-workflow "${childName}" — ${childTrace.totalIterations} iteration${childTrace.totalIterations !== 1 ? 's' : ''}, ${d.subWorkflowPassed ? 'passed' : 'FAILED'}`,
          ts,
          nodeId: event.nodeId,
          nodeLabel: label,
          depth,
        });

        for (const childIter of childTrace.iterations) {
          lines.push({
            prefix: '*',
            text: `Sub-workflow iteration #${childIter.index + 1}`,
            ts: childIter.events[0]?.timestamp ?? ts,
            depth: depth + 1,
          });

          emitEvents(lines, childIter.events, {
            nodeFilter: undefined,
            includeHttpBodies,
            preferRawLogs,
            depth: depth + 1,
          });

          lines.push({
            prefix: childIter.passed ? '*' : '!',
            text: `Sub-workflow iteration #${childIter.index + 1} ${childIter.passed ? 'passed' : 'FAILED'} — ${childIter.durationMs}ms`,
            ts: (childIter.events[childIter.events.length - 1]?.timestamp ?? ts) + (childIter.events[childIter.events.length - 1]?.durationMs ?? 0),
            depth: depth + 1,
          });
        }
      } else if (d.subWorkflowId && !d.subWorkflowTrace) {
        lines.push({
          prefix: '*',
          text: `Sub-workflow ${d.subWorkflowId} — ${d.subWorkflowPassed ? 'passed' : 'failed'} (trace not captured)`,
          ts,
          nodeId: event.nodeId,
          nodeLabel: label,
          depth,
        });
      }
    }

    const durationStr = event.durationMs !== undefined ? ` (${event.durationMs}ms)` : '';
    lines.push({
      prefix: event.state === 'fail' ? '!' : '*',
      text: `${event.state === 'pass' ? 'passed' : event.state === 'fail' ? 'FAILED' : 'skipped'}${durationStr}`,
      ts: ts + (event.durationMs ?? 0),
      nodeId: event.nodeId,
      nodeLabel: label,
      depth,
    });
  }
}

function emitDetails(
  lines: LogLine[],
  event: ExecutionEvent,
  d: NonNullable<ExecutionEvent['details']>,
  ctx: { includeHttpBodies: boolean; depth: number },
): void {
  const { includeHttpBodies, depth } = ctx;
  const label = event.nodeLabel || event.nodeId;
  const ts = event.timestamp;

  if (d.method && d.url) {
    lines.push({ prefix: '>', text: `${d.method} ${d.url}`, ts, nodeId: event.nodeId, nodeLabel: label, depth });
  }

  if (d.statusCode !== undefined) {
    const timeStr = d.responseTimeMs !== undefined ? ` (${d.responseTimeMs}ms)` : '';
    lines.push({ prefix: '<', text: `${d.statusCode}${timeStr}`, ts: ts + (event.durationMs ?? 0), nodeId: event.nodeId, nodeLabel: label, depth });
  }

  if (includeHttpBodies) {
    if (d.request?.bodyResolved) {
      lines.push({ prefix: '>', text: `Body: ${truncateBody(d.request.bodyResolved)}`, ts, nodeId: event.nodeId, nodeLabel: label, depth });
    }
    if (d.response?.body) {
      lines.push({ prefix: '<', text: `Body: ${truncateBody(d.response.body)}`, ts: ts + (event.durationMs ?? 0), nodeId: event.nodeId, nodeLabel: label, depth });
    }
  }

  if (d.extractedVariables && Object.keys(d.extractedVariables).length > 0) {
    for (const [key, value] of Object.entries(d.extractedVariables)) {
      if (key.startsWith('__')) continue;
      const display = typeof value === 'string' && value.length > 80 ? value.slice(0, 77) + '...' : value;
      lines.push({ prefix: '#', text: `${key} = ${display}`, ts: ts + (event.durationMs ?? 0), nodeId: event.nodeId, nodeLabel: label, depth });
    }
  }

  if (d.assertions && d.assertions.length > 0) {
    for (const a of d.assertions) {
      lines.push({
        prefix: a.passed ? '*' : '!',
        text: `${a.passed ? '✓' : '✗'} ${a.description || a.type}${!a.passed && a.expected ? ` (expected: ${a.expected}, got: ${a.actual})` : ''}`,
        ts: ts + (event.durationMs ?? 0), nodeId: event.nodeId, nodeLabel: label, depth,
      });
    }
  }

  if (d.webhookInput) {
    const method = d.webhookInput.method ?? 'POST';
    const path = d.webhookInput.path ?? '/webhook';
    lines.push({ prefix: '<', text: `Webhook received: ${method} ${path}`, ts, nodeId: event.nodeId, nodeLabel: label, depth });
  }

  if (d.waitDurationMs !== undefined) {
    lines.push({ prefix: '*', text: `Waited ${d.waitDurationMs}ms for event`, ts, nodeId: event.nodeId, nodeLabel: label, depth });
  }

  if (d.conditionResult !== undefined) {
    lines.push({ prefix: '*', text: `Condition: ${d.conditionResult ? 'TRUE' : 'FALSE'}${d.conditionExpression ? ` (${d.conditionExpression})` : ''}`, ts, nodeId: event.nodeId, nodeLabel: label, depth });
  }

  if (d.loopIterationCount !== undefined) {
    lines.push({ prefix: '*', text: `Loop iteration ${(d.currentLoopIndex ?? 0) + 1} of ${d.loopIterationCount}`, ts, nodeId: event.nodeId, nodeLabel: label, depth });
  }

  if (d.scriptOutput) {
    const scriptLines = Array.isArray(d.scriptOutput) ? d.scriptOutput as string[] : [String(d.scriptOutput)];
    for (const line of scriptLines) {
      lines.push({ prefix: '#', text: `script: ${line}`, ts: ts + (event.durationMs ?? 0), nodeId: event.nodeId, nodeLabel: label, depth });
    }
  }

  if (d.error) {
    lines.push({ prefix: '!', text: d.error, ts: ts + (event.durationMs ?? 0), nodeId: event.nodeId, nodeLabel: label, depth });
  }
}

function truncateBody(body: string, max = 200): string {
  if (body.length <= max) return body;
  return body.slice(0, max) + '...';
}

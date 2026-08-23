import type { WorkflowExecutionTrace, WorkflowIterationTrace } from '@shared/types';
import type { LogLine } from '@shared/utils/consoleLogUtils';
import { isSampledIteration } from './sampledIterations';

/**
 * Build a compact, professional summary for the aggregate console view.
 * Failed iterations are expanded with details; passed ones are shown as
 * a compact table. Sub-workflow stats are grouped in a dedicated section.
 */
export function buildAggregateSummary(trace: WorkflowExecutionTrace): LogLine[] {
  const lines: LogLine[] = [];
  const iters = trace.iterations.filter(isSampledIteration);
  if (iters.length === 0) return lines;

  const failedIters = iters.filter(it => !it.passed);
  const passedIters = iters.filter(it => it.passed);
  const passRate = Math.round((passedIters.length / iters.length) * 100);
  const durations = iters.map(it => it.durationMs);
  const avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const minMs = Math.min(...durations);
  const maxMs = Math.max(...durations);
  const httpCount = iters[0]?.events.filter(e => e.nodeType === 'http').length ?? 0;
  const nodeCount = new Set(iters[0]?.events.map(e => e.nodeId) ?? []).size;
  const subWorkflowEvents = iters[0]?.events.filter(e => e.details?.subWorkflowTrace) ?? [];

  // ── Run Overview ──
  const line = (prefix: string, text: string, extra?: Partial<LogLine>): LogLine =>
    ({ prefix, text, ts: 0, ...extra });

  lines.push(line('info', '── Run Overview ─────────────────────────────'));
  lines.push(line('info', ''));

  const statusColor = failedIters.length === 0 ? 'info' : 'error';
  lines.push(line(statusColor,
    `  ● ${passedIters.length}/${iters.length} passed (${passRate}%)` +
    (failedIters.length > 0 ? `   ${failedIters.length} failed` : '')
  ));
  lines.push(line('info', `  Duration    min ${minMs}ms  avg ${avgMs}ms  max ${maxMs}ms`));
  lines.push(line('info', `  Nodes       ${nodeCount} per iteration · ${httpCount} HTTP call${httpCount !== 1 ? 's' : ''}` +
    (subWorkflowEvents.length > 0 ? ` · ${subWorkflowEvents.length} sub-workflow${subWorkflowEvents.length !== 1 ? 's' : ''}` : '')));

  // ── Failures ──
  if (failedIters.length > 0) {
    lines.push(line('info', ''));
    lines.push(line('error', '── Failures ─────────────────────────────────'));
    lines.push(line('info', ''));

    for (const iter of failedIters) {
      const iterNum = (iter.index ?? 0) + 1;
      lines.push(line('error', `  #${iterNum}  ✗ FAIL  ${iter.durationMs}ms`, {
        ts: iter.events[0]?.timestamp ?? 0,
      }));

      const failedEvents = iter.events.filter(e => e.state === 'fail');
      for (const ev of failedEvents) {
        const reason = getFailureReason(ev);
        lines.push(line('error', `     └─ ${ev.nodeLabel || ev.nodeId}${reason ? `: ${reason}` : ''}`, {
          ts: ev.timestamp, nodeId: ev.nodeId, nodeLabel: ev.nodeLabel,
        }));
      }

      // Show sub-workflow failures within this iteration
      for (const ev of iter.events.filter(e => e.details?.subWorkflowTrace)) {
        const sub = ev.details!.subWorkflowTrace!;
        const subFailed = sub.iterations.filter(it => isSampledIteration(it) && !it.passed);
        if (subFailed.length > 0) {
          lines.push(line('warn', `     └─ ${sub.workflowName}: ${subFailed.length}/${sub.iterations.length} iteration${subFailed.length !== 1 ? 's' : ''} failed`));
          for (const childIter of subFailed.slice(0, 3)) {
            const childNum = (childIter.index ?? 0) + 1;
            const failedEv = childIter.events.find(e => e.state === 'fail');
            const reason = failedEv ? getFailureReason(failedEv) : '';
            lines.push(line('error',
              `        #${childNum} → ${failedEv?.nodeLabel || failedEv?.nodeId || 'unknown'}${reason ? `: ${reason}` : ''}`,
              { depth: 2 }
            ));
          }
          if (subFailed.length > 3) {
            lines.push(line('error', `        … and ${subFailed.length - 3} more`, { depth: 2 }));
          }
        }
      }
    }
  }

  // ── Iterations ──
  lines.push(line('info', ''));
  lines.push(line('info', '── Iterations ───────────────────────────────'));
  lines.push(line('info', ''));
  lines.push(line('info', '  #      Status   Duration'));
  lines.push(line('info', '  ─────  ───────  ────────'));

  for (const iter of iters) {
    const iterNum = (iter.index ?? 0) + 1;
    const num = String(iterNum).padStart(3, ' ');
    const status = iter.passed ? '  PASS ' : '  FAIL ';
    const prefix = iter.passed ? 'info' : 'error';
    const dur = `${iter.durationMs}ms`;
    const slow = isP95Slow(iter, iters) ? '  slow' : '';
    lines.push(line(prefix, `  ${num}    ${status}  ${dur.padStart(7, ' ')}${slow}`, {
      ts: iter.events[0]?.timestamp ?? 0,
    }));
  }

  // ── Sub-Workflows ──
  if (subWorkflowEvents.length > 0) {
    lines.push(line('info', ''));
    lines.push(line('info', '── Sub-Workflows ────────────────────────────'));
    lines.push(line('info', ''));

    for (const ev of subWorkflowEvents) {
      const sub = ev.details!.subWorkflowTrace!;
      const subIters = sub.iterations.filter(isSampledIteration);
      const subPassed = subIters.filter(it => it.passed).length;
      const subPassRate = subIters.length > 0 ? Math.round((subPassed / subIters.length) * 100) : 0;
      const subDurations = subIters.map(it => it.durationMs);
      const subAvg = subDurations.length > 0 ? Math.round(subDurations.reduce((a, b) => a + b, 0) / subDurations.length) : 0;
      const subFailed = subIters.filter(it => !it.passed);

      const statusPfx = subFailed.length > 0 ? 'warn' : 'info';
      lines.push(line(statusPfx,
        `  ${sub.workflowName}`));
      lines.push(line(statusPfx,
        `  ${subPassed}/${subIters.length} passed (${subPassRate}%)  ·  avg ${subAvg}ms`));

      if (subFailed.length > 0) {
        for (const childIter of subFailed.slice(0, 3)) {
          const childNum = (childIter.index ?? 0) + 1;
          const failedEv = childIter.events.find(e => e.state === 'fail');
          const reason = failedEv ? getFailureReason(failedEv) : '';
          lines.push(line('error',
            `    #${childNum} FAIL → ${failedEv?.nodeLabel || failedEv?.nodeId || 'unknown'}${reason ? `: ${reason}` : ''}`,
            { depth: 1 }
          ));
        }
        if (subFailed.length > 3) {
          lines.push(line('error', `    … and ${subFailed.length - 3} more failed`, { depth: 1 }));
        }
      }
      lines.push(line('info', ''));
    }
  }

  // Footer
  lines.push(line('info', '─────────────────────────────────────────────'));
  lines.push(line('info', 'Select an iteration to see full console output.'));

  return lines;
}

function isP95Slow(iter: WorkflowIterationTrace, all: WorkflowIterationTrace[]): boolean {
  if (all.length < 5) return false;
  const sorted = [...all].sort((a, b) => a.durationMs - b.durationMs);
  const threshold = sorted[Math.floor(sorted.length * 0.9)]?.durationMs ?? Infinity;
  return iter.durationMs >= threshold;
}

function getFailureReason(ev: { details?: { error?: string; statusCode?: number; conditionExpression?: string; conditionResult?: boolean } }): string {
  if (!ev.details) return '';
  if (ev.details.error) return ev.details.error;
  if (ev.details.statusCode && ev.details.statusCode >= 400) return `HTTP ${ev.details.statusCode}`;
  if (ev.details.conditionExpression && ev.details.conditionResult === false) return 'condition evaluated false';
  return '';
}

import type { RequestResult } from '@shared/types';
import { humanizeError, prettyJson } from '@shared/utils/helpers';
import type { WorkflowRunStepSummary } from '../hooks/useWorkflowRunCache';
export { formatGrpcNodeRunDetail, buildGrpcNodeStatusMeta, grpcStatusLabel } from './grpcWorkflowOutputAdapter';

/** Node types that never execute during Quick Test (structural / triggers only). */
export const WORKFLOW_STRUCTURAL_NODE_TYPES = new Set(['start', 'webhook', 'schedule', 'end']);

export function isExecutableWorkflowNodeType(type: string | undefined): boolean {
  return !!type && !WORKFLOW_STRUCTURAL_NODE_TYPES.has(type);
}

export interface QuickTestFailureReport {
  summary: string;
  failedSteps: WorkflowRunStepSummary[];
  passedSteps: WorkflowRunStepSummary[];
  variableSnapshot: Record<string, string> | null;
  durationMs?: number;
  hints: string[];
}

const tryPrettyResponseBody = prettyJson;

/**
 * Full detail text for the workflow HTTP step modal (request line, status, errors, validation rows, body).
 * @param opts.fullResponseBody - Optional full (non-truncated) body string to use instead of result.responseBody.
 */
export function formatHttpNodeRunDetail(result: RequestResult, opts?: { fullResponseBody?: string }): string {
  const lines: string[] = [];
  lines.push(`${result.method} ${result.url}`);
  lines.push(`HTTP ${result.httpStatus} · ${result.responseTimeMs}ms`);
  if (result.errorMessage?.trim()) {
    lines.push('');
    lines.push(result.errorMessage.trim());
  }
  if (result.failureDetails?.length) {
    lines.push('');
    lines.push('Validation / assertions:');
    for (const f of result.failureDetails) {
      const act = String(f.actual ?? '');
      const actShow = act.length > 1200 ? `${act.slice(0, 1200)}…` : act;
      lines.push(`  • ${f.path}`);
      lines.push(`    expected: ${f.expected}`);
      lines.push(`    actual: ${actShow}`);
    }
  }
  const body = opts?.fullResponseBody ?? result.responseBody;
  if (body) {
    lines.push('');
    lines.push('Response body:');
    lines.push(tryPrettyResponseBody(body));
  }
  return lines.join('\n');
}

/** One-line explanation for failed workflow steps (status bar + node tooltips). */
export function summarizeRequestFailure(r: RequestResult): string {
  if (r.errorMessage?.trim()) {
    const msg = humanizeError(r.errorMessage.trim());
    const firstLine = msg.split('\n')[0]?.trim() ?? msg;
    if (r.transportType === 'graphqlAssert' && !firstLine.includes('got ') && msg.includes('\n')) {
      return msg.split('\n').slice(1).join(' ').trim() || firstLine;
    }
    return firstLine;
  }
  const fd = r.failureDetails?.[0];
  if (fd) {
    const a = (fd.actual ?? '').slice(0, 240);
    const e = (fd.expected ?? '').slice(0, 120);
    return e ? `${fd.path}: ${a} (expected ${e})` : `${fd.path}: ${a}`;
  }
  if (r.httpStatus >= 400) return `HTTP ${r.httpStatus}`;
  if (r.httpStatus === 0) return 'Network error — could not reach the server. Check your connection, VPN, or the URL.';
  return 'Step failed';
}

function quickTestHintsForFailure(
  failedSteps: WorkflowRunStepSummary[],
  variableSnapshot: Record<string, string> | null,
): string[] {
  const hints: string[] = [];
  const assertFail = failedSteps.find((s) => s.error?.includes('Source variable') || s.error?.includes('not set'));
  if (assertFail) {
    hints.push('Open the GraphQL Query node → Output tab → bind latencyMs to gqlLatency, then Save the workflow.');
  }
  const missingLatency = failedSteps.some((s) => s.error?.includes('gqlLatency'));
  if (missingLatency || (variableSnapshot && !variableSnapshot.gqlLatency?.trim())) {
    hints.push('The assert node reads {{gqlLatency}} — that variable must be set by the Query node output binding before the assert runs.');
  }
  if (failedSteps.some((s) => s.error?.includes('Endpoint is required') || s.error?.includes('endpoint is blank'))) {
    hints.push('Open the failing GraphQL node → Operation tab → set Endpoint (e.g. http://localhost:4010/graphql), then Save.');
  }
  if (failedSteps.some((s) => s.error?.includes('Network error') || s.error?.includes('Proxy request failed'))) {
    hints.push('Confirm the GraphQL Docker stack is running and the app proxy can reach it (Demo Hub prerequisite).');
  }
  if (hints.length === 0) {
    hints.push('Open the Console panel for the full step-by-step log, or double-click the red node on the canvas for its error detail.');
  }
  return hints;
}

/** Harness-injected env vars for Quick Test when no service registry is configured. */
const QUICK_TEST_HARNESS_ENV_VARS = new Set(['baseUrl']);

/**
 * Trim the failure snapshot to variables relevant for triage.
 * Harness-injected keys (e.g. `baseUrl` from the env selector) are omitted unless
 * the workflow references them via `{{baseUrl}}`. Runtime bindings (e.g. gqlLatency)
 * are always kept.
 */
export function filterQuickTestVariableSnapshot(
  snapshot: Record<string, string> | null,
  referencedInWorkflow: Set<string>,
  _workflowVariables: Record<string, string>,
): Record<string, string> | null {
  if (!snapshot) return null;
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!value.trim()) continue;
    if (QUICK_TEST_HARNESS_ENV_VARS.has(key) && !referencedInWorkflow.has(key)) continue;
    filtered[key] = value;
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

/** Structured report for the Quick Test failure modal. */
export function buildQuickTestFailureReport(
  failedResult: RequestResult | undefined,
  stepSummaries: WorkflowRunStepSummary[],
  variableSnapshot: Record<string, string> | null,
  durationMs?: number,
  summaryOverride?: string | null,
): QuickTestFailureReport {
  const failedSteps = stepSummaries.filter((s) => s.state === 'fail');
  const passedSteps = stepSummaries.filter((s) => s.state === 'pass');
  const summary = summaryOverride?.trim()
    || (failedResult ? summarizeRequestFailure(failedResult) : '')
    || failedSteps[0]?.error?.split('\n').slice(-1)[0]?.trim()
    || failedSteps[0]?.error?.split('\n')[0]?.trim()
    || 'One or more workflow steps failed.';
  return {
    summary,
    failedSteps,
    passedSteps,
    variableSnapshot,
    durationMs,
    hints: quickTestHintsForFailure(failedSteps, variableSnapshot),
  };
}

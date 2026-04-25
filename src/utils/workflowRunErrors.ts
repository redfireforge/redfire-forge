import type { RequestResult } from '../types';
import { humanizeError } from './helpers';

function tryPrettyResponseBody(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

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

/** One-line explanation for failed workflow HTTP steps (toolbar + node tooltips). */
export function summarizeRequestFailure(r: RequestResult): string {
  if (r.errorMessage?.trim()) return humanizeError(r.errorMessage.trim());
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

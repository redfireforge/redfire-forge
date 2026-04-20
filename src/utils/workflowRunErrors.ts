import type { RequestResult } from '../types';

function tryPrettyResponseBody(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

/**
 * Full detail text for the workflow HTTP step modal (request line, status, errors, validation rows, body).
 */
export function formatHttpNodeRunDetail(result: RequestResult): string {
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
  if (result.responseBody) {
    lines.push('');
    lines.push('Response body:');
    lines.push(tryPrettyResponseBody(result.responseBody));
  }
  return lines.join('\n');
}

/** One-line explanation for failed workflow HTTP steps (toolbar + node tooltips). */
export function summarizeRequestFailure(r: RequestResult): string {
  if (r.errorMessage?.trim()) return r.errorMessage.trim();
  const fd = r.failureDetails?.[0];
  if (fd) {
    const a = (fd.actual ?? '').slice(0, 240);
    const e = (fd.expected ?? '').slice(0, 120);
    return e ? `${fd.path}: ${a} (expected ${e})` : `${fd.path}: ${a}`;
  }
  if (r.httpStatus >= 400) return `HTTP ${r.httpStatus}`;
  if (r.httpStatus === 0) return 'No response (network, CORS, invalid URL, or blocked)';
  return 'Step failed';
}

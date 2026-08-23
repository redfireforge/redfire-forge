import type {
  ApiMockCapturedRequestV1,
  ApiMockPredicateGroupV1,
  ApiMockPredicateResultV1,
  ApiMockRouteV1,
  ApiMockSimulationResultV1,
  ApiMockSimulationSampleV1,
} from '@shared/api-mock/contracts';
import { combinatorLabel } from '@shared/api-mock/predicateEvaluatorHelpers';
import { httpMethodSelectOptions } from '@shared/constants/httpMethodColors';
import { concreteMockPath } from '../apiMockPageHelpers';

/** Stable 5-digit seed for one Simulate session (weighted picks, templates, jitter). */
export function createSimulateReplaySeed(random: () => number = Math.random): string {
  return String(Math.floor(random() * 90_000) + 10_000);
}

/** Hint for the optional replay-seed field (kept exported so HMR can resolve older importers). */
export const SIMULATE_SEED_HELP =
  'Optional. Same number repeats random choices — weighted variants, {{randomInt}} / faker templates, and delay jitter. Change it only when you want a different random outcome.';

export const SIMULATE_METHOD_OPTIONS = httpMethodSelectOptions(
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
);

export function isAutoRouteSample(id: string): boolean {
  return id.startsWith('auto-');
}

export function parseSimulateHeaderLines(text: string): Record<string, string> {
  const headerMap: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return headerMap;
}

export function capturedHeadersFromText(text: string): Record<string, string[]> {
  return lowercaseHeaderMap(parseSimulateHeaderLines(text));
}

/** Matcher lookups are lower-case. Saved / From-rules samples must use the same keys. */
export function lowercaseHeaderMap(
  headers: Record<string, string | string[] | undefined> | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (v == null) continue;
    const key = k.toLowerCase();
    const values = Array.isArray(v) ? v : [v];
    out[key] = out[key] ? [...out[key], ...values] : [...values];
  }
  return out;
}

export function headersToText(headers: Record<string, string | string[]>): string {
  return Object.entries(headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
}

export function outcomeBadge(outcome: string): string {
  if (outcome === 'matched') return 'success';
  if (outcome === 'ambiguous') return 'warning';
  if (outcome === 'fault') return 'warning';
  return 'danger';
}

export function simulateSampleBadge(result?: ApiMockSimulationResultV1): 'PASS' | 'CONFLICT' | 'FAIL' | null {
  if (!result) return null;
  if (result.passed === true) return 'PASS';
  if (result.outcome === 'ambiguous') return 'CONFLICT';
  if (result.passed === false) return 'FAIL';
  return 'PASS';
}

export function suggestedSimulateSampleName(method: string, path: string): string {
  return `${method} ${path || '/'}`;
}

/** Local session copies overlay persisted samples so a rename is visible before the parent re-renders. */
export function mergeSimulateSamples(
  serverSamples: ApiMockSimulationSampleV1[] | undefined,
  localSaved: ApiMockSimulationSampleV1[],
): ApiMockSimulationSampleV1[] {
  const byId = new Map<string, ApiMockSimulationSampleV1>();
  for (const sample of serverSamples ?? []) byId.set(sample.id, sample);
  for (const sample of localSaved) byId.set(sample.id, sample);
  const seen = new Set<string>();
  const next: ApiMockSimulationSampleV1[] = [];
  for (const sample of [...(serverSamples ?? []), ...localSaved]) {
    if (seen.has(sample.id)) continue;
    seen.add(sample.id);
    next.push(byId.get(sample.id)!);
  }
  return next;
}

/** Exact header rows on an All-of group — enough for a From-rules probe to satisfy that rule. */
export function exactHeadersFromAllOf(
  group: ApiMockPredicateGroupV1 | undefined,
): Record<string, string[]> {
  if (!group || group.combinator !== 'all') return {};
  const headers: Record<string, string[]> = {};
  for (const child of group.children) {
    if ('combinator' in child) continue;
    if (child.source !== 'header' || child.operator !== 'exact') continue;
    const key = child.selector?.trim();
    if (!key || child.expected == null) continue;
    headers[key.toLowerCase()] = [String(child.expected)];
  }
  return headers;
}

export function buildAutoRouteSamples(routes: ApiMockRouteV1[]): ApiMockSimulationSampleV1[] {
  return routes.slice(0, 5).map((r) => ({
    id: `auto-${r.id}`,
    name: r.name || `${r.method} ${r.path.value}`,
    routeId: r.id,
    request: {
      method: r.method === 'ANY' ? 'GET' : r.method,
      path: concreteMockPath(r.path.value),
      rawPath: concreteMockPath(r.path.value),
      query: {},
      cookies: {},
      headers: exactHeadersFromAllOf(r.predicates),
      body: null,
      bodyTruncated: false,
      receivedAt: new Date().toISOString(),
    } satisfies ApiMockCapturedRequestV1,
    expected: { outcome: 'matched' as const, routeId: r.id },
  }));
}

export function createSavedSimulationSample(
  name: string,
  request: ApiMockCapturedRequestV1,
  result?: ApiMockSimulationResultV1,
): ApiMockSimulationSampleV1 {
  return {
    id: `sample-${crypto.randomUUID().slice(0, 8)}`,
    name,
    routeId: result?.trace.policyDecision.selectedRouteId,
    request,
    expected: result
      ? {
          outcome: result.outcome,
          routeId: result.trace.policyDecision.selectedRouteId,
          responseId: result.preview?.selectedResponseId,
          status: result.renderedResponse?.status,
        }
      : { outcome: 'matched' },
  };
}

export function reannotateSimulatePass(
  sample: ApiMockSimulationSampleV1,
  res: ApiMockSimulationResultV1,
): ApiMockSimulationResultV1 {
  const { passed: _ignored, ...rest } = res;
  return annotateSimulatePass(sample, rest as ApiMockSimulationResultV1);
}

export function annotateSimulatePass(
  sample: ApiMockSimulationSampleV1,
  res: ApiMockSimulationResultV1,
): ApiMockSimulationResultV1 {
  if (typeof res.passed === 'boolean') return res;
  if (sample.expected) {
    const body = res.renderedResponse?.body ?? '';
    const expectedOk =
      (!sample.expected.outcome || sample.expected.outcome === res.outcome)
      && (!sample.expected.routeId || sample.expected.routeId === res.trace.policyDecision.selectedRouteId)
      && (!sample.expected.responseId || sample.expected.responseId === res.preview?.selectedResponseId)
      && (sample.expected.status == null || sample.expected.status === res.renderedResponse?.status)
      && (sample.expected.bodyContains == null || body.includes(sample.expected.bodyContains))
      && (sample.expected.bodyExact == null || body === sample.expected.bodyExact);
    return { ...res, passed: expectedOk };
  }
  return {
    ...res,
    passed: res.outcome === 'matched' || res.outcome === 'unmatched' || res.outcome === 'fault'
      ? true
      : res.outcome !== 'ambiguous',
  };
}

/** Pretty and compact views of a simulated response body. Non-JSON is left unchanged. */
export function simulateRenderedBodyViews(body: string | undefined | null): {
  pretty: string;
  compact: string;
  canFormat: boolean;
} {
  const raw = body ?? '';
  const trimmed = raw.trim();
  if (!trimmed) return { pretty: raw, compact: raw, canFormat: false };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return {
      pretty: JSON.stringify(parsed, null, 2),
      compact: JSON.stringify(parsed),
      canFormat: true,
    };
  } catch {
    return { pretty: raw, compact: raw, canFormat: false };
  }
}

export function simulationTraceFilename(seed: string): string {
  return `api-mock-sim-trace-${seed}.json`;
}

export function simulationTraceNoticePreview(
  serverId: string,
  seed: string,
  resultCount: number,
): string {
  return JSON.stringify({ serverId, seed, generation: 'draft', resultCount }, null, 2);
}

/** Failed rows first when the candidate missed — None-of can fail while every leaf is green. */
export function orderTracePredicateResults(
  results: ApiMockPredicateResultV1[],
  overallMatch: boolean,
): ApiMockPredicateResultV1[] {
  if (overallMatch || results.length < 2) return results;
  return [...results].sort((a, b) => Number(a.passed) - Number(b.passed));
}

export function predicateTraceSource(pr: ApiMockPredicateResultV1): string {
  if (pr.combinator) return combinatorLabel(pr.combinator);
  return pr.source;
}

/** Direct child of a recorded None-of group — the leaf's raw pass is inverted for display. */
export function isNoneOfChild(
  pr: ApiMockPredicateResultV1,
  all: ApiMockPredicateResultV1[],
): boolean {
  if (!pr.groupId) return false;
  return all.some(row => row.combinator === 'not' && row.predicateId === `group:${pr.groupId}`);
}

/** Green/red for the trace: None of wants its children to miss. */
export function predicateTraceSatisfied(
  pr: ApiMockPredicateResultV1,
  all: ApiMockPredicateResultV1[] = [],
): boolean {
  if (!pr.evaluated) return false;
  if (isNoneOfChild(pr, all)) return !pr.passed;
  return pr.passed;
}

export function predicateTraceDetail(pr: ApiMockPredicateResultV1): string {
  if (pr.reason) {
    const prefix = `${pr.source} `;
    if (!pr.combinator && pr.reason.startsWith(prefix)) return pr.reason.slice(prefix.length);
    return pr.reason;
  }
  if (pr.selector) return `${pr.selector} · ${pr.operator}`;
  return pr.operator;
}

export function predicateTraceNote(
  pr: ApiMockPredicateResultV1,
  all: ApiMockPredicateResultV1[] = [],
): string {
  if (!pr.evaluated) return 'skipped';
  const ok = predicateTraceSatisfied(pr, all);
  if (pr.combinator || isNoneOfChild(pr, all)) return ok ? 'held' : 'rejected';
  return ok ? 'passed' : 'failed';
}

export function nearMissConditionSummary(
  nearMisses: Array<{ routeName?: string; failedPredicates?: Array<{ reason?: string }> }>,
): string {
  const names = nearMisses.map(nm => nm.routeName).filter(Boolean).join(', ');
  const reasons = [...new Set(
    nearMisses.flatMap(nm => (nm.failedPredicates ?? []).map(fp => fp.reason).filter((r): r is string => Boolean(r && r !== 'failed'))),
  )];
  const head = names
    ? `${names} matched method/path but failed conditions`
    : 'Matched method/path but failed conditions';
  return reasons.length ? `${head} — ${reasons.join('; ')}` : `${head}.`;
}

export function downloadSimulationTrace(
  serverId: string,
  seed: string,
  results: ApiMockSimulationResultV1[],
): void {
  const payload = { serverId, seed, generation: 'draft', results };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = simulationTraceFilename(seed);
  a.click();
  URL.revokeObjectURL(url);
}

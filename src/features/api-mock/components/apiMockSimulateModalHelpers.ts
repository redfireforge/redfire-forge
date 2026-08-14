import type {
  ApiMockCapturedRequestV1,
  ApiMockRouteV1,
  ApiMockSimulationResultV1,
  ApiMockSimulationSampleV1,
} from '../../../shared/api-mock/contracts';
import { concreteMockPath } from '../apiMockPageHelpers';

export const SIMULATE_SEED_HELP =
  'Optional. Same number repeats random choices — weighted variants, {{randomInt}} / faker templates, and delay jitter. Change it only when you want a different random outcome.';

export const SIMULATE_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  .map(m => ({ value: m, label: m }));

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
  return Object.fromEntries(
    Object.entries(parseSimulateHeaderLines(text)).map(([k, v]) => [k, [v]]),
  );
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
      headers: {},
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

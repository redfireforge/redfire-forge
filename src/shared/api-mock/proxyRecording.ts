/**
 * Phase 9C — proxied exchange → inactive route/sample drafts with redaction + dedup.
 */
import type {
  ApiMockCapturedRequestV1,
  ApiMockDiagnosticV1,
  ApiMockRouteV1,
  ApiMockServerSettingsV1,
  ApiMockSimulationSampleV1,
} from './contracts';
import { DEFAULT_SETTINGS } from './defaults';
import { convertSourceToRule, type ConversionResult } from './sourceToRule';

export interface ProxiedResponseCapture {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  contentType?: string;
}

export interface ApiMockRecordedDraftV1 {
  id: string;
  fingerprint: string;
  recordedAt: string;
  route: ApiMockRouteV1;
  sample: ApiMockSimulationSampleV1;
  diagnostics: ApiMockDiagnosticV1[];
}

const DEFAULT_SECRET_HEADERS = DEFAULT_SETTINGS.redaction.headerNames.map(h => h.toLowerCase());

export function draftFingerprint(method: string, path: string, status: number): string {
  return `${method.toUpperCase()} ${path} → ${status}`;
}

export function redactHeaderMap(
  headers: Record<string, string | string[]>,
  headerNames: string[] = DEFAULT_SECRET_HEADERS,
  preserveScheme = true,
): Record<string, string> {
  const names = new Set(headerNames.map(h => h.toLowerCase()));
  const out: Record<string, string> = {};
  for (const [k, raw] of Object.entries(headers)) {
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw);
    if (!names.has(k.toLowerCase())) {
      out[k] = value;
      continue;
    }
    if (preserveScheme) {
      const m = value.match(/^(\S+)\s+/);
      out[k] = m ? `${m[1]} [REDACTED]` : '[REDACTED]';
    } else {
      out[k] = '[REDACTED]';
    }
  }
  return out;
}

/** Build an inactive draft route + sample from a successful proxied exchange. */
export function proxiedExchangeToDraft(
  request: ApiMockCapturedRequestV1,
  response: ProxiedResponseCapture,
  settings?: ApiMockServerSettingsV1,
): ConversionResult {
  const redaction = settings?.redaction ?? DEFAULT_SETTINGS.redaction;
  const headers = redactHeaderMap(
    request.headers as Record<string, string | string[]>,
    redaction.headerNames,
    redaction.preserveScheme,
  );
  const query = Object.fromEntries(
    Object.entries(request.query ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? '' : String(v)]),
  );
  const contentType = response.contentType
    ?? (Array.isArray(response.headers['content-type'])
      ? response.headers['content-type'][0]
      : response.headers['content-type'] as string | undefined)
    ?? (Array.isArray(response.headers['Content-Type'])
      ? response.headers['Content-Type'][0]
      : response.headers['Content-Type'] as string | undefined);

  const result = convertSourceToRule(
    {
      method: request.method,
      path: request.path,
      headers,
      query,
      body: typeof request.body === 'string' ? request.body : undefined,
      contentType: headers['content-type'] ?? headers['Content-Type'],
      responseBody: response.body,
      responseContentType: contentType,
      status: response.status,
    },
    {
      sourceKind: 'journal',
      sourceLabel: `Proxy record ${draftFingerprint(request.method, request.path, response.status)}`,
    },
  );

  const diagnostics = [...result.diagnostics];
  const secretHits = Object.keys(request.headers).filter(k =>
    redaction.headerNames.map(h => h.toLowerCase()).includes(k.toLowerCase()),
  ).length;
  if (secretHits > 0) {
    diagnostics.push({
      code: 'AMS-REDACTION-SECRET-DETECTED',
      severity: 'warning',
      path: '/recording',
      message: `Redacted ${secretHits} secret header(s) from recorded draft. Review before enabling.`,
    });
  }

  return {
    ...result,
    route: { ...result.route, enabled: false, name: `Recorded ${request.method} ${request.path}` },
    diagnostics,
  };
}

export function toRecordedDraft(
  conversion: ConversionResult,
  fingerprint: string,
  recordedAt = new Date().toISOString(),
  id?: string,
): ApiMockRecordedDraftV1 {
  return {
    id: id ?? `rec-${crypto.randomUUID().slice(0, 10)}`,
    fingerprint,
    recordedAt,
    route: { ...conversion.route, enabled: false },
    sample: conversion.sample,
    diagnostics: conversion.diagnostics,
  };
}

/** Native listener capture — converted to a draft on poll, not in Rust. */
export interface NativeProxyCaptureV1 {
  id: string;
  fingerprint: string;
  recordedAt: string;
  request: ApiMockCapturedRequestV1;
  response: ProxiedResponseCapture;
  redaction?: {
    headerNames?: string[];
    jsonPaths?: string[];
    preserveScheme?: boolean;
  };
}

/** Convert a native proxied capture into a Studio draft, preserving native id/timestamp. */
export function nativeCaptureToDraft(capture: NativeProxyCaptureV1): ApiMockRecordedDraftV1 | null {
  try {
    const conversion = proxiedExchangeToDraft(
      capture.request,
      capture.response,
      {
        ...DEFAULT_SETTINGS,
        redaction: {
          headerNames: capture.redaction?.headerNames ?? DEFAULT_SETTINGS.redaction.headerNames,
          jsonPaths: capture.redaction?.jsonPaths ?? DEFAULT_SETTINGS.redaction.jsonPaths,
          preserveScheme: capture.redaction?.preserveScheme ?? DEFAULT_SETTINGS.redaction.preserveScheme,
        },
      },
    );
    return toRecordedDraft(conversion, capture.fingerprint, capture.recordedAt, capture.id);
  } catch {
    return null;
  }
}

/** Merge recorded drafts into workspace routes — skips fingerprints already present. */
export function mergeRecordedDraftsIntoRoutes(
  existing: ApiMockRouteV1[],
  drafts: ApiMockRecordedDraftV1[],
): { routes: ApiMockRouteV1[]; added: number; skipped: number } {
  const seen = new Set(existing.map(routeFingerprintFromRoute));
  const next = [...existing];
  let added = 0;
  let skipped = 0;
  for (const draft of drafts) {
    if (seen.has(draft.fingerprint)) {
      skipped += 1;
      continue;
    }
    seen.add(draft.fingerprint);
    next.push({ ...draft.route, enabled: false });
    added += 1;
  }
  return { routes: next, added, skipped };
}

export function routeFingerprintFromRoute(route: ApiMockRouteV1): string {
  const status = route.responses.find(r => r.enabled)?.status
    ?? route.responses[0]?.status
    ?? 200;
  return draftFingerprint(route.method, route.path.value, status);
}

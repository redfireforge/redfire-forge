/**
 * API Mock Studio — canonical source-to-rule converter (Phase 6A).
 * Converts any import source into ApiMockRouteV1 + ApiMockSimulationSampleV1.
 * Pure function: no storage, no network, no platform imports.
 */
import type {
  ApiMockRouteV1,
  ApiMockSimulationSampleV1,
  ApiMockCapturedRequestV1,
  ApiMockDiagnosticV1,
  ApiMockImportSourceV1,
  ApiMockPredicateGroupV1,
  ApiMockMethod,
} from './contracts';
import { createDefaultResponse, EMPTY_PREDICATE_GROUP } from './defaults';

export interface SourceRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: string;
  contentType?: string;
  authScheme?: string;
}

export interface ConversionOptions {
  sourceKind: ApiMockImportSourceV1['kind'];
  sourceLabel?: string;
  defaultPriority?: number;
  defaultStatus?: number;
  defaultResponseBody?: string;
  defaultResponseContentType?: string;
  folderId?: string;
}

export interface ConversionResult {
  route: ApiMockRouteV1;
  sample: ApiMockSimulationSampleV1;
  diagnostics: ApiMockDiagnosticV1[];
  source: ApiMockImportSourceV1;
}

const METHODS: ApiMockMethod[] = ['ANY', 'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'];

export function convertSourceToRule(input: SourceRequest, options: ConversionOptions): ConversionResult {
  const diagnostics: ApiMockDiagnosticV1[] = [];
  const routeId = `route-${crypto.randomUUID().slice(0, 8)}`;
  const sampleId = `sample-${crypto.randomUUID().slice(0, 8)}`;
  const respId = `resp-${crypto.randomUUID().slice(0, 8)}`;
  const ts = new Date().toISOString();

  const method = normalizeMethod(input.method, diagnostics);
  const predicates = buildPredicates(input, diagnostics);

  const route: ApiMockRouteV1 = {
    id: routeId,
    folderId: options.folderId,
    name: `${method} ${input.path}`,
    enabled: false,
    method,
    path: { kind: 'exact', value: input.path },
    priority: options.defaultPriority ?? 10,
    predicates,
    responseMode: 'rules',
    responses: [{
      ...createDefaultResponse(respId),
      status: options.defaultStatus ?? 200,
      body: {
        kind: options.defaultResponseContentType?.includes('json') ? 'json' : 'text',
        content: options.defaultResponseBody ?? '',
        contentType: options.defaultResponseContentType ?? 'application/json',
      },
    }],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
  };

  const captured: ApiMockCapturedRequestV1 = {
    method,
    path: input.path,
    rawPath: input.path + (input.query ? '?' + new URLSearchParams(input.query).toString() : ''),
    query: Object.fromEntries(Object.entries(input.query ?? {}).map(([k, v]) => [k, [v]])),
    headers: Object.fromEntries(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), [v]])),
    cookies: input.cookies ?? {},
    body: input.body ?? null,
    bodyTruncated: false,
    receivedAt: ts,
  };

  const sample: ApiMockSimulationSampleV1 = {
    id: sampleId,
    name: `${method} ${input.path}`,
    routeId,
    request: captured,
    expected: { outcome: 'matched', routeId, status: options.defaultStatus ?? 200 },
  };

  const source: ApiMockImportSourceV1 = {
    kind: options.sourceKind,
    label: options.sourceLabel,
    importedAt: ts,
    diagnostics,
  };

  return { route, sample, diagnostics, source };
}

function normalizeMethod(method: string, diagnostics: ApiMockDiagnosticV1[]): ApiMockMethod {
  const upper = method.toUpperCase();
  if (METHODS.includes(upper as ApiMockMethod)) return upper as ApiMockMethod;
  diagnostics.push({
    code: 'AMS-IMPORT-UNSUPPORTED-FIELD',
    severity: 'warning',
    path: '/method',
    message: `Unknown HTTP method "${method}", defaulting to GET`,
  });
  return 'GET';
}

function buildPredicates(input: SourceRequest, diagnostics: ApiMockDiagnosticV1[]): ApiMockPredicateGroupV1 {
  const children: ApiMockPredicateGroupV1['children'] = [];

  if (input.headers) {
    for (const [key, value] of Object.entries(input.headers)) {
      const lk = key.toLowerCase();
      if (lk === 'authorization' || lk === 'cookie' || lk === 'host' || lk === 'user-agent' || lk === 'content-length') {
        if (lk === 'authorization' && input.authScheme) {
          diagnostics.push({
            code: 'AMS-IMPORT-UNSUPPORTED-FIELD',
            severity: 'warning',
            path: `/headers/${key}`,
            message: `Authorization header contains a secret. Stored as variable reference, not raw value.`,
          });
        }
        continue;
      }
      children.push({
        id: `pred-${crypto.randomUUID().slice(0, 6)}`,
        source: 'header',
        selector: lk,
        operator: 'exact',
        expected: value,
      });
    }
  }

  if (input.body && input.contentType?.includes('json')) {
    try {
      const parsed = JSON.parse(input.body);
      children.push({
        id: `pred-${crypto.randomUUID().slice(0, 6)}`,
        source: 'body',
        operator: 'json_subset',
        expected: parsed,
        options: { matchStyle: 'subset' },
      });
    } catch {
      diagnostics.push({
        code: 'AMS-IMPORT-LOSS',
        severity: 'warning',
        path: '/body',
        message: 'Request body is not valid JSON; stored as exact text match',
      });
      children.push({
        id: `pred-${crypto.randomUUID().slice(0, 6)}`,
        source: 'body',
        operator: 'exact',
        expected: input.body,
      });
    }
  }

  return { ...EMPTY_PREDICATE_GROUP, id: `pg-${crypto.randomUUID().slice(0, 6)}`, children };
}

/** Batch convert multiple source requests into routes and samples. */
export function convertBatch(inputs: SourceRequest[], options: ConversionOptions): ConversionResult[] {
  return inputs.map(input => convertSourceToRule(input, options));
}

/**
 * Import parsers for API Mock Studio (mockup 06 / W15–W17).
 * Pure functions: paste text / JSON → SourceRequest[] + diagnostics.
 */
import { parse as parseYaml } from 'yaml';
import type { ApiMockDiagnosticV1, ApiMockRouteV1, ApiMockExportV1, ApiMockFaultKind, ApiMockPredicateV1 } from './contracts';
import { convertBatch, type SourceRequest, type ConversionResult } from './sourceToRule';

export interface ParsedImportBatch {
  sources: SourceRequest[];
  diagnostics: ApiMockDiagnosticV1[];
  lossReport: string[];
  label: string;
}

function diag(code: string, message: string, severity: ApiMockDiagnosticV1['severity'] = 'warning'): ApiMockDiagnosticV1 {
  return { code, severity, path: '', message };
}

function mapWireMockFault(fault: string): ApiMockFaultKind | undefined {
  const key = fault.toUpperCase();
  if (key.includes('CONNECTION_RESET_BY_PEER') || key === 'RESET') return 'reset';
  if (key.includes('EMPTY') || key.includes('CLOSE')) return 'close';
  if (key.includes('MALFORMED')) return 'malformed';
  if (key.includes('RANDOM_DATA') || key.includes('DRIBBLE')) return 'dribble';
  return 'timeout';
}

function bodyPredicate(
  operator: ApiMockPredicateV1['operator'],
  expected: ApiMockPredicateV1['expected'],
): ApiMockPredicateV1 {
  return { id: `pred-${crypto.randomUUID().slice(0, 6)}`, source: 'body', operator, expected };
}

/**
 * Translate WireMock `bodyPatterns` into predicates the engine can actually
 * evaluate. `xpath_*` operators exist in the contract but always return false,
 * so XPath matchers are approximated against the raw body rather than emitted
 * as rules that could never match.
 */
function mapBodyPatterns(patterns: unknown, lossReport: string[]): ApiMockPredicateV1[] {
  if (!Array.isArray(patterns)) return [];
  const out: ApiMockPredicateV1[] = [];

  for (const raw of patterns) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;

    if (typeof p.equalTo === 'string') { out.push(bodyPredicate('exact', p.equalTo)); continue; }
    if (typeof p.contains === 'string') { out.push(bodyPredicate('contains', p.contains)); continue; }
    if (typeof p.matches === 'string') { out.push(bodyPredicate('regex', p.matches)); continue; }

    if (p.equalToJson !== undefined) {
      const strict = p.ignoreExtraElements !== true;
      out.push(bodyPredicate(strict ? 'json_strict' : 'json_subset', p.equalToJson as ApiMockPredicateV1['expected']));
      continue;
    }

    if (typeof p.matchesJsonPath === 'string') { out.push(bodyPredicate('jsonPath_exists', p.matchesJsonPath)); continue; }
    if (p.matchesJsonPath && typeof p.matchesJsonPath === 'object') {
      const jp = p.matchesJsonPath as Record<string, unknown>;
      const expr = typeof jp.expression === 'string' ? jp.expression : undefined;
      if (expr && typeof jp.equalTo === 'string') out.push(bodyPredicate('jsonPath_equals', [expr, jp.equalTo]));
      else if (expr) out.push(bodyPredicate('jsonPath_exists', expr));
      continue;
    }

    if (p.matchesXPath !== undefined) {
      const xp = typeof p.matchesXPath === 'object' && p.matchesXPath
        ? p.matchesXPath as Record<string, unknown>
        : {};
      const expr = typeof xp.expression === 'string' ? xp.expression : String(p.matchesXPath);
      if (typeof xp.contains === 'string') {
        out.push({ ...bodyPredicate('xpath_equals', [expr, xp.contains]), options: { matchStyle: 'subset' } });
      } else if (typeof xp.equalTo === 'string') {
        out.push({ ...bodyPredicate('xpath_equals', [expr, xp.equalTo]), options: { matchStyle: 'exact' } });
      } else if (typeof xp.matches === 'string') {
        lossReport.push(`matchesXPath ${expr} uses a "matches" sub-matcher — imported as an existence check; add a body regex to narrow it.`);
        out.push(bodyPredicate('xpath_exists', expr));
      } else {
        out.push(bodyPredicate('xpath_exists', expr));
      }
      if (xp.xPathNamespaces) {
        lossReport.push('xPathNamespaces dropped — use local-name() in the expression instead of namespace prefixes.');
      }
      continue;
    }

    if (p.doesNotMatch !== undefined || p.absent !== undefined) {
      lossReport.push('Negated body matcher (doesNotMatch/absent) dropped — wrap conditions in a "None of" group manually.');
      continue;
    }

    lossReport.push(`Unsupported body matcher ${Object.keys(p).join(', ')} — dropped.`);
  }
  return out;
}

/** RedfireForge native export envelope or bare workspace/servers/routes payload. */
export function parseNativeExport(text: string): ParsedImportBatch {
  const diagnostics: ApiMockDiagnosticV1[] = [];
  const lossReport: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { sources: [], diagnostics: [diag('AMS-IMPORT-PARSE', 'Invalid JSON for RedfireForge export.', 'error')], lossReport, label: 'RedfireForge' };
  }

  const envelope = parsed as Partial<ApiMockExportV1> & { data?: unknown; servers?: unknown; routes?: unknown };
  const data = envelope.data ?? envelope;
  const routes: ApiMockRouteV1[] = [];

  if (data && typeof data === 'object') {
    const d = data as {
      scope?: string;
      workspace?: { servers?: Array<{ routes?: ApiMockRouteV1[] }> };
      servers?: Array<{ routes?: ApiMockRouteV1[] }>;
      routes?: ApiMockRouteV1[];
    };
    if (d.scope === 'workspace' && d.workspace?.servers) {
      for (const s of d.workspace.servers) routes.push(...(s.routes ?? []));
    } else if (d.scope === 'servers' && d.servers) {
      for (const s of d.servers) routes.push(...(s.routes ?? []));
    } else if (d.scope === 'routes' && d.routes) {
      routes.push(...d.routes);
    } else if (Array.isArray((d as { servers?: unknown }).servers)) {
      for (const s of (d as { servers: Array<{ routes?: ApiMockRouteV1[] }> }).servers) routes.push(...(s.routes ?? []));
    } else if (Array.isArray((d as { routes?: unknown }).routes)) {
      routes.push(...(d as { routes: ApiMockRouteV1[] }).routes);
    }
  }

  if (routes.length === 0) {
    diagnostics.push(diag('AMS-IMPORT-EMPTY', 'No routes found in RedfireForge export.', 'error'));
    return { sources: [], diagnostics, lossReport, label: 'RedfireForge' };
  }

  const sources: SourceRequest[] = routes.map(r => ({
    method: r.method === 'ANY' ? 'GET' : r.method,
    path: r.path.value || '/',
    headers: Object.fromEntries((r.responses[0]?.headers ?? []).filter(h => h.enabled).map(h => [h.key, h.value])),
    body: r.responses[0]?.body.content,
    contentType: r.responses[0]?.body.contentType,
    priority: r.priority,
    status: r.responses[0]?.status,
    delayMs: r.responses[0]?.behavior.delayMs,
    fault: r.responses[0]?.behavior.fault,
  }));

  diagnostics.push(diag('AMS-IMPORT-NATIVE', `Parsed ${routes.length} route(s) from native export.`, 'info'));
  return { sources, diagnostics, lossReport, label: 'RedfireForge' };
}

/** WireMock stub mappings — a single stub, an array, or `{ mappings: [] }`. */
export function parseWireMockMappings(text: string): ParsedImportBatch {
  const diagnostics: ApiMockDiagnosticV1[] = [];
  const lossReport: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // WireMock also accepts YAML stub files.
    try {
      parsed = parseYaml(text);
    } catch {
      return { sources: [], diagnostics: [diag('AMS-IMPORT-PARSE', 'Could not parse as JSON or YAML.', 'error')], lossReport, label: 'WireMock' };
    }
  }

  const isStub = (v: unknown): boolean =>
    !!v && typeof v === 'object' && !Array.isArray(v)
    && ('request' in (v as object) || 'response' in (v as object));

  const container = parsed as { mappings?: unknown } | undefined;
  const mappings = Array.isArray(parsed) ? parsed
    : Array.isArray(container?.mappings) ? container.mappings
      // One stub per file is WireMock's default `mappings/*.json` layout.
      : isStub(parsed) ? [parsed]
        : isStub(container?.mappings) ? [container!.mappings]
          : undefined;

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return { sources: [], diagnostics: [diag('AMS-IMPORT-EMPTY', 'No WireMock mappings found. Expected a stub object, an array of stubs, or { "mappings": [...] }.', 'error')], lossReport, label: 'WireMock' };
  }

  const sources: SourceRequest[] = [];
  for (const m of mappings) {
    const mapping = m as {
      priority?: number;
      scenarioName?: string;
      requiredScenarioState?: string;
      newScenarioState?: string;
      request?: Record<string, unknown>;
      response?: Record<string, unknown>;
    };
    const req = mapping.request ?? {};
    const res = mapping.response ?? {};
    const method = String(req.method ?? 'GET');
    const urlPath = String(req.urlPath ?? req.urlPathPattern ?? req.url ?? req.urlPattern ?? '/');
    const path = urlPath.replace(/^\^/, '').replace(/\$$/, '').replace(/\\/g, '') || '/';
    const headers: Record<string, string> = {};
    if (req.headers && typeof req.headers === 'object') {
      for (const [k, v] of Object.entries(req.headers as Record<string, unknown>)) {
        if (v && typeof v === 'object' && 'equalTo' in (v as object)) headers[k] = String((v as { equalTo: string }).equalTo);
        else if (typeof v === 'string') headers[k] = v;
        else lossReport.push(`Header matcher on ${k} is not equalTo — imported as absent.`);
      }
    }

    const query: Record<string, string> = {};
    if (req.queryParameters && typeof req.queryParameters === 'object') {
      for (const [k, v] of Object.entries(req.queryParameters as Record<string, unknown>)) {
        if (v && typeof v === 'object' && 'equalTo' in (v as object)) query[k] = String((v as { equalTo: string }).equalTo);
        else if (typeof v === 'string') query[k] = v;
        else lossReport.push(`Query matcher on ${k} is not equalTo — imported as absent.`);
      }
    }

    const bodyPredicates = mapBodyPatterns(req.bodyPatterns, lossReport);

    const scenario = (mapping.scenarioName || mapping.requiredScenarioState || mapping.newScenarioState)
      ? {
        name: mapping.scenarioName,
        requiredState: mapping.requiredScenarioState,
        newState: mapping.newScenarioState,
      }
      : undefined;

    let fault: ApiMockFaultKind | undefined;
    if (typeof res.fault === 'string') {
      fault = mapWireMockFault(res.fault);
      diagnostics.push(diag('AMS-IMPORT-WIREMOCK-FAULT', `Mapped WireMock fault "${res.fault}" → ${fault}.`, 'info'));
    }

    const delayMs = typeof res.fixedDelayMilliseconds === 'number'
      ? res.fixedDelayMilliseconds
      : undefined;
    if (res.delayDistribution) {
      lossReport.push('delayDistribution not fully supported — only fixedDelayMilliseconds imported.');
    }

    const status = typeof res.status === 'number' ? res.status : undefined;
    const headerContentType = (res.headers as Record<string, string> | undefined)?.['Content-Type'];
    let responseBody = typeof res.jsonBody === 'object'
      ? JSON.stringify(res.jsonBody)
      : typeof res.body === 'string' ? res.body : undefined;

    // `bodyFileName` points at a file in WireMock's `__files/`, which a pasted
    // stub never carries. Seed an obvious placeholder rather than an empty body.
    if (responseBody === undefined && typeof res.bodyFileName === 'string') {
      const file = res.bodyFileName;
      responseBody = `<!-- Paste the contents of ${file} here (WireMock __files/${file}) -->`;
      diagnostics.push(diag(
        'AMS-IMPORT-WIREMOCK-BODYFILE',
        `Response body came from "${file}", which is not part of the mapping. A placeholder was inserted — paste the file contents into the Response tab.`,
        'warning',
      ));
      lossReport.push(`bodyFileName "${file}" could not be resolved — placeholder body inserted.`);
    }

    const responseContentType = headerContentType
      ?? (res.jsonBody ? 'application/json' : undefined);

    sources.push({
      method,
      path: path.startsWith('/') ? path : `/${path}`,
      headers,
      query: Object.keys(query).length ? query : undefined,
      responseBody,
      responseContentType,
      priority: typeof mapping.priority === 'number' ? mapping.priority : undefined,
      status,
      delayMs,
      fault,
      scenario,
      predicates: bodyPredicates.length ? bodyPredicates : undefined,
    });
  }

  diagnostics.push(diag('AMS-IMPORT-WIREMOCK', `Parsed ${sources.length} mapping(s). Review the loss report before enabling.`, 'info'));
  return { sources, diagnostics, lossReport, label: 'WireMock' };
}

/** OpenAPI 3.x / Swagger 2 JSON or YAML — extract operations as SourceRequest[]. */
export function parseOpenApiOperations(text: string): ParsedImportBatch {
  const diagnostics: ApiMockDiagnosticV1[] = [];
  const lossReport: string[] = [];
  let doc: Record<string, unknown>;
  try {
    doc = (text.trim().startsWith('{') ? JSON.parse(text) : parseYaml(text)) as Record<string, unknown>;
  } catch {
    return { sources: [], diagnostics: [diag('AMS-IMPORT-PARSE', 'Could not parse OpenAPI/Swagger as JSON or YAML.', 'error')], lossReport, label: 'OpenAPI' };
  }

  const paths = doc.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths || typeof paths !== 'object') {
    return { sources: [], diagnostics: [diag('AMS-IMPORT-EMPTY', 'OpenAPI document has no paths.', 'error')], lossReport, label: 'OpenAPI' };
  }

  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
  const sources: SourceRequest[] = [];
  for (const [path, ops] of Object.entries(paths)) {
    if (!ops || typeof ops !== 'object') continue;
    for (const method of methods) {
      const op = ops[method];
      if (!op || typeof op !== 'object') continue;
      const operation = op as {
        operationId?: string;
        summary?: string;
        requestBody?: { content?: Record<string, { example?: unknown; schema?: unknown }> };
        parameters?: Array<{ in?: string; name?: string; example?: unknown }>;
      };
      const headers: Record<string, string> = {};
      const query: Record<string, string> = {};
      for (const p of operation.parameters ?? []) {
        if (p.in === 'header' && p.name) headers[p.name] = String(p.example ?? '');
        if (p.in === 'query' && p.name) query[p.name] = String(p.example ?? '');
      }
      let body: string | undefined;
      let contentType: string | undefined;
      const content = operation.requestBody?.content;
      if (content) {
        const ct = Object.keys(content)[0];
        contentType = ct;
        const example = content[ct]?.example;
        if (example !== undefined) body = typeof example === 'string' ? example : JSON.stringify(example);
        else lossReport.push(`${method.toUpperCase()} ${path}: no request example — empty body.`);
      }
      sources.push({
        method: method.toUpperCase(),
        path,
        headers,
        query: Object.keys(query).length ? query : undefined,
        body,
        contentType,
      });
    }
  }

  if (sources.length === 0) {
    diagnostics.push(diag('AMS-IMPORT-EMPTY', 'No operations found in OpenAPI document.', 'error'));
  } else {
    diagnostics.push(diag('AMS-IMPORT-OPENAPI', `Parsed ${sources.length} operation(s) from OpenAPI.`, 'info'));
  }
  return { sources, diagnostics, lossReport, label: 'OpenAPI' };
}

/** Convert a parsed batch into inactive draft routes. */
export function batchToRoutes(
  batch: ParsedImportBatch,
  options: { defaultPriority?: number; folderId?: string; sourceKind: 'openapi' | 'wiremock' | 'redfireforge' | 'catalog' | 'requests' | 'har' },
): { routes: ApiMockRouteV1[]; diagnostics: ApiMockDiagnosticV1[]; lossReport: string[] } {
  const results: ConversionResult[] = convertBatch(batch.sources, {
    sourceKind: options.sourceKind,
    sourceLabel: batch.label,
    defaultPriority: options.defaultPriority ?? 10,
    folderId: options.folderId,
  });
  const diagnostics = [
    ...batch.diagnostics,
    ...results.flatMap(r => r.diagnostics),
  ];
  return {
    routes: results.map(r => ({ ...r.route, enabled: false })),
    diagnostics,
    lossReport: batch.lossReport,
  };
}

export function catalogEndpointsToSources(
  endpoints: Array<{ method: string; path: string; summary?: string }>,
): SourceRequest[] {
  return endpoints.map(e => ({
    method: e.method,
    path: e.path,
  }));
}

export function requestItemsToSources(
  items: Array<{ method: string; url?: string; path?: string; headers?: Array<{ key: string; value: string }>; body?: string }>,
): SourceRequest[] {
  return items.map(item => {
    let path = item.path ?? '/';
    if (item.url) {
      try { path = new URL(item.url).pathname; } catch {
        path = item.url.startsWith('/') ? item.url.split('?')[0] : `/${item.url.split('?')[0]}`;
      }
    }
    const headers: Record<string, string> = {};
    for (const h of item.headers ?? []) {
      if (h.key) headers[h.key] = h.value;
    }
    return { method: item.method || 'GET', path, headers, body: item.body };
  });
}

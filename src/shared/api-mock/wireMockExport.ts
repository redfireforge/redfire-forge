/**
 * Phase 8D — WireMock subset export with exhaustive loss report.
 */
import type { ApiMockRouteV1, ApiMockResponseVariantV1 } from './contracts';

export interface WireMockExportResult {
  mappings: Record<string, unknown>[];
  lossReport: string[];
}

const FAULT_TO_WIREMOCK: Record<string, string> = {
  timeout: 'CONNECTION_TIMEOUT',
  reset: 'CONNECTION_RESET_BY_PEER',
  close: 'EMPTY_RESPONSE',
  malformed: 'MALFORMED_RESPONSE_CHUNK',
  dribble: 'RANDOM_DATA_THEN_CLOSE',
};

export function exportWireMockMappings(routes: ApiMockRouteV1[]): WireMockExportResult {
  const lossReport: string[] = [];
  const mappings: Record<string, unknown>[] = [];

  for (const route of routes) {
    if (route.responseMode === 'weighted') {
      lossReport.push(`${route.id}: weighted mode has no WireMock equivalent — exporting first enabled variant only.`);
    }
    if (route.responseMode === 'sequence') {
      lossReport.push(`${route.id}: sequence mode exported as separate stubs without shared state machine.`);
    }

    const enabled = route.responses.filter(r => r.enabled);
    const variants = route.responseMode === 'rules'
      ? enabled
      : enabled.slice(0, route.responseMode === 'sequence' ? enabled.length : 1);

    for (const variant of variants) {
      mappings.push(variantToMapping(route, variant, lossReport));
    }

    if (route.predicates.children.length > 0) {
      lossReport.push(`${route.id}: complex predicate groups may lose operators beyond equalTo/headers.`);
    }
    if (route.path.kind === 'regex' || route.path.kind === 'glob') {
      lossReport.push(`${route.id}: path kind ${route.path.kind} exported as urlPathPattern approximation.`);
    }
  }

  return { mappings, lossReport };
}

function variantToMapping(
  route: ApiMockRouteV1,
  variant: ApiMockResponseVariantV1,
  lossReport: string[],
): Record<string, unknown> {
  const request: Record<string, unknown> = {
    method: route.method === 'ANY' ? 'ANY' : route.method,
  };
  if (route.path.kind === 'exact' || route.path.kind === 'parameterized') {
    request.urlPath = route.path.value.startsWith('/') ? route.path.value : `/${route.path.value}`;
  } else {
    request.urlPathPattern = route.path.value;
  }

  const headers: Record<string, { equalTo: string }> = {};
  for (const child of route.predicates.children) {
    if (!('source' in child)) continue;
    if (child.source === 'header' && child.operator === 'exact' && child.selector) {
      headers[child.selector] = { equalTo: String(child.expected ?? '') };
    } else if ('source' in child) {
      lossReport.push(`${route.id}: predicate ${child.source}/${child.operator} omitted from WireMock export.`);
    }
  }
  if (Object.keys(headers).length) request.headers = headers;

  const response: Record<string, unknown> = {
    status: variant.status,
    headers: Object.fromEntries(
      variant.headers.filter(h => h.enabled).map(h => [h.key, h.value]),
    ),
  };
  if (variant.body.contentType) {
    response.headers = { ...(response.headers as object), 'Content-Type': variant.body.contentType };
  }
  if (variant.body.content) {
    if ((variant.body.contentType ?? '').includes('json')) {
      try {
        response.jsonBody = JSON.parse(variant.body.content);
      } catch {
        response.body = variant.body.content;
      }
    } else {
      response.body = variant.body.content;
    }
  }
  if (variant.behavior.delayMs > 0) {
    response.fixedDelayMilliseconds = variant.behavior.delayMs;
  }
  if (variant.behavior.fault && variant.behavior.fault !== 'none') {
    const mapped = FAULT_TO_WIREMOCK[variant.behavior.fault];
    if (mapped) response.fault = mapped;
    else lossReport.push(`${route.id}/${variant.id}: fault ${variant.behavior.fault} omitted.`);
  }
  if (variant.cookies.length > 0) {
    lossReport.push(`${route.id}/${variant.id}: Set-Cookie cookies not exported to WireMock (use response headers).`);
  }
  if (variant.body.content?.includes('{{')) {
    lossReport.push(`${route.id}/${variant.id}: template helpers exported as literal text.`);
  }

  const mapping: Record<string, unknown> = {
    priority: route.priority,
    request,
    response,
  };

  if (route.responseMode === 'state' && variant.transition) {
    mapping.scenarioName = route.name || route.id;
    if (variant.transition.currentState) mapping.requiredScenarioState = variant.transition.currentState;
    mapping.newScenarioState = variant.transition.targetState;
  }

  if (variant.weight != null) {
    lossReport.push(`${route.id}/${variant.id}: weight ${variant.weight} dropped (WireMock has no relative weights).`);
  }

  return mapping;
}

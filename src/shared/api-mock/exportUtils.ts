/**
 * API Mock Studio — export utilities (Phase 8A).
 * Deterministic JSON/YAML export with redaction and ordering.
 */
import { stringify as yamlStringify } from 'yaml';
import type {
  ApiMockWorkspaceV1,
  ApiMockServerDefinitionV1,
  ApiMockExportV1,
  ApiMockExportPayloadV1,
  ApiMockVariableV1,
  ApiMockRouteV1,
  ApiMockServerSettingsV1,
} from './contracts';
import { canonicalExportOrder, canonicalVariableOrder } from './fingerprint';
import { DEFAULT_SETTINGS } from './defaults';

export interface ExportOptions {
  redact?: boolean;
  scope: 'workspace' | 'servers' | 'routes';
  selectedServerIds?: string[];
  selectedRouteIds?: string[];
  sourceServerId?: string;
  format?: 'json' | 'yaml';
}

export function exportWorkspace(workspace: ApiMockWorkspaceV1, options: ExportOptions): ApiMockExportV1 {
  let data: ApiMockExportPayloadV1;

  switch (options.scope) {
    case 'workspace':
      data = { scope: 'workspace', workspace: orderWorkspace(workspace) };
      break;
    case 'servers': {
      const servers = options.selectedServerIds
        ? workspace.servers.filter(s => options.selectedServerIds!.includes(s.id))
        : workspace.servers;
      data = { scope: 'servers', servers: canonicalExportOrder(servers.map(orderServer)) };
      break;
    }
    case 'routes': {
      const srv = workspace.servers.find(s => s.id === options.sourceServerId);
      const routes = srv ? (options.selectedRouteIds
        ? srv.routes.filter(r => options.selectedRouteIds!.includes(r.id))
        : srv.routes) : [];
      const samples = srv
        ? (options.selectedRouteIds
          ? srv.samples.filter(s => options.selectedRouteIds!.includes(s.routeId ?? ''))
          : srv.samples)
        : [];
      data = {
        scope: 'routes',
        sourceServerId: options.sourceServerId ?? '',
        routes: canonicalExportOrder(routes),
        samples: canonicalExportOrder(samples),
      };
      break;
    }
  }

  const envelope: ApiMockExportV1 = {
    _exportMeta: {
      kind: 'redfireforge-api-mock',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      redacted: options.redact ?? false,
    },
    data,
  };

  if (options.redact) {
    return redactExport(envelope, workspace);
  }
  return envelope;
}

/** Serialize export envelope to JSON or YAML text. */
export function serializeExport(envelope: ApiMockExportV1, format: 'json' | 'yaml' = 'json'): string {
  if (format === 'yaml') {
    return yamlStringify(envelope, { sortMapEntries: true, lineWidth: 120 });
  }
  return JSON.stringify(envelope, null, 2);
}

/** Stable download basename for an export. */
export function exportFilename(
  scope: ExportOptions['scope'],
  format: 'json' | 'yaml',
  hint?: string,
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = (hint ?? 'export').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48);
  const ext = format === 'yaml' ? 'yaml' : 'json';
  if (scope === 'workspace') return `api-mock-workspace-${safe}-${stamp}.${ext}`;
  if (scope === 'servers') return `api-mock-server-${safe}-${stamp}.${ext}`;
  return `api-mock-routes-${safe}-${stamp}.${ext}`;
}

function orderWorkspace(ws: ApiMockWorkspaceV1): ApiMockWorkspaceV1 {
  return { ...ws, servers: canonicalExportOrder(ws.servers.map(orderServer)) };
}

function orderServer(srv: ApiMockServerDefinitionV1): ApiMockServerDefinitionV1 {
  return {
    ...srv,
    routes: canonicalExportOrder(srv.routes),
    folders: canonicalExportOrder(srv.folders),
    samples: canonicalExportOrder(srv.samples),
    variables: canonicalVariableOrder(srv.variables),
  };
}

function redactExport(envelope: ApiMockExportV1, workspace: ApiMockWorkspaceV1): ApiMockExportV1 {
  const json = JSON.stringify(envelope);
  const parsed = JSON.parse(json) as ApiMockExportV1;
  const headerNames = collectRedactionHeaders(workspace);

  function redactServers(servers: ApiMockServerDefinitionV1[]): void {
    for (const srv of servers) {
      srv.variables = srv.variables.map(redactVariable);
      // TLS private material must never leave the machine in an export.
      if (srv.settings.tls) {
        const tls = srv.settings.tls;
        srv.settings = {
          ...srv.settings,
          tls: {
            ...tls,
            keyPem: tls.keyPem ? '***REDACTED***' : '',
            passphrase: undefined,
            ...(tls.mtls
              ? { mtls: { ...tls.mtls, clientKeyPem: tls.mtls.clientKeyPem ? '***REDACTED***' : undefined } }
              : {}),
          },
        };
      }
      srv.routes = srv.routes.map(r => redactRoute(r, headerNames));
      const names = srv.settings.redaction.headerNames.map(h => h.toLowerCase());
      for (const sample of srv.samples) {
        sample.request.headers = redactHeaderMap(sample.request.headers, names);
        if (sample.request.cookies) {
          for (const key of Object.keys(sample.request.cookies)) {
            sample.request.cookies[key] = '[REDACTED]';
          }
        }
      }
    }
  }

  const data = parsed.data;
  if (data.scope === 'workspace') redactServers(data.workspace.servers);
  else if (data.scope === 'servers') redactServers(data.servers);
  else if (data.scope === 'routes') {
    data.routes = data.routes.map(r => redactRoute(r, headerNames));
  }

  return parsed;
}

function collectRedactionHeaders(workspace: ApiMockWorkspaceV1): string[] {
  const set = new Set(DEFAULT_SETTINGS.redaction.headerNames.map(h => h.toLowerCase()));
  for (const srv of workspace.servers) {
    for (const h of srv.settings.redaction.headerNames) set.add(h.toLowerCase());
  }
  return [...set];
}

function redactRoute(route: ApiMockRouteV1, headerNames: string[]): ApiMockRouteV1 {
  const redacted: ApiMockRouteV1 = {
    ...route,
    responses: route.responses.map(v => ({
      ...v,
      headers: v.headers.map(h => (
        headerNames.includes(h.key.toLowerCase()) ? { ...h, value: '[REDACTED]' } : h
      )),
      cookies: v.cookies.map(c => ({ ...c, value: '[REDACTED]' })),
    })),
  };
  // Response bodies captured from HAR imports may contain sensitive API data.
  // Strip originalBody on redacted exports; the non-sensitive fields (originalStatus,
  // originalContentType, requestFingerprint) are retained for round-trip matching.
  if (redacted.harSourceEntry?.originalBody !== undefined) {
    redacted.harSourceEntry = { ...redacted.harSourceEntry, originalBody: undefined };
  }
  return redacted;
}

function redactHeaderMap(
  headers: Record<string, string[]>,
  headerNames: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = headerNames.includes(k.toLowerCase()) ? ['[REDACTED]'] : v;
  }
  return out;
}

function redactVariable(v: ApiMockVariableV1): ApiMockVariableV1 {
  return v.sensitive ? { ...v, value: '[REDACTED]' } : v;
}

export function settingsForRedaction(settings?: ApiMockServerSettingsV1): string[] {
  return (settings?.redaction.headerNames ?? DEFAULT_SETTINGS.redaction.headerNames).map(h => h.toLowerCase());
}

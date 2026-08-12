/**
 * API Mock Studio — export utilities (Phase 8A).
 * Deterministic JSON export with redaction and ordering.
 */
import type {
  ApiMockWorkspaceV1,
  ApiMockServerDefinitionV1,
  ApiMockExportV1,
  ApiMockExportPayloadV1,
  ApiMockVariableV1,
} from './contracts';
import { canonicalExportOrder, canonicalVariableOrder } from './fingerprint';

export interface ExportOptions {
  redact?: boolean;
  scope: 'workspace' | 'servers' | 'routes';
  selectedServerIds?: string[];
  selectedRouteIds?: string[];
  sourceServerId?: string;
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
      const samples = srv ? srv.samples.filter(s => options.selectedRouteIds?.includes(s.routeId ?? '')) : [];
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
    return redactExport(envelope);
  }
  return envelope;
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

function redactExport(envelope: ApiMockExportV1): ApiMockExportV1 {
  const json = JSON.stringify(envelope);
  const parsed = JSON.parse(json) as ApiMockExportV1;

  function redactServers(servers: ApiMockServerDefinitionV1[]): void {
    for (const srv of servers) {
      srv.variables = srv.variables.map(redactVariable);
    }
  }

  const data = parsed.data;
  if (data.scope === 'workspace') redactServers(data.workspace.servers);
  else if (data.scope === 'servers') redactServers(data.servers);

  return parsed;
}

function redactVariable(v: ApiMockVariableV1): ApiMockVariableV1 {
  return v.sensitive ? { ...v, value: '[REDACTED]' } : v;
}

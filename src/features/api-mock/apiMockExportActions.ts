import type { ApiMockExportV1, ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { exportFilename, exportWorkspace, serializeExport } from '../../shared/api-mock/exportUtils';
import { exportHarForStudio } from '../../shared/api-mock/harExport';
import { exportWireMockMappings } from '../../shared/api-mock/wireMockExport';
import type { ApiMockExportFormat, ApiMockExportRequest, ApiMockExportScope } from './components/ApiMockWorkspaceNav';
import { apiMockControlClient } from './apiMockControlClient';
import { downloadJsonFile } from './apiMockPageHelpers';

export interface ApiMockExportResult {
  filename: string;
  format: ApiMockExportFormat;
  scope: ApiMockExportScope;
  text: string;
  /** JSON envelope for native round-trip import (even when the download was YAML). */
  nativeJson?: string;
  redacted: boolean;
  tlsKeyPem?: string;
  sensitiveValues: Array<{ key: string; value: string }>;
  lossNotes: string[];
  entryCount?: number;
  mappingCount?: number;
  cliCommand: string;
  liveMessage: string;
}

interface HandleApiMockExportArgs {
  request: ApiMockExportRequest;
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  transactions: ApiMockTransactionV1[];
  setLiveMessage: (message: string) => void;
}

function cliCommandFor(filename: string): string {
  return `cli mock simulate ${filename}`;
}

function serversFromEnvelope(envelope: ApiMockExportV1 | undefined): ApiMockServerDefinitionV1[] {
  if (!envelope?.data) return [];
  const data = envelope.data;
  if (data.scope === 'workspace') return data.workspace.servers;
  if (data.scope === 'servers') return data.servers;
  return [];
}

export function inspectExportSecrets(envelope: ApiMockExportV1 | undefined): {
  tlsKeyPem?: string;
  sensitiveValues: Array<{ key: string; value: string }>;
} {
  const servers = serversFromEnvelope(envelope);
  let tlsKeyPem: string | undefined;
  const sensitiveValues: Array<{ key: string; value: string }> = [];
  for (const srv of servers) {
    if (tlsKeyPem == null && srv.settings.tls) tlsKeyPem = srv.settings.tls.keyPem ?? '';
    for (const variable of srv.variables ?? []) {
      if (variable.sensitive) sensitiveValues.push({ key: variable.key, value: variable.value });
    }
  }
  return { tlsKeyPem, sensitiveValues };
}

function downloadTextFile(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function handleApiMockExport({
  request,
  servers,
  activeServerId,
  transactions,
  setLiveMessage,
}: HandleApiMockExportArgs): Promise<ApiMockExportResult> {
  const workspace = { schemaVersion: 1 as const, servers, activeServerId, tabOrder: servers.map(s => s.id) };
  const active = servers.find(s => s.id === activeServerId);
  const hint = active?.name ?? activeServerId ?? 'export';

  if (request.format === 'wiremock') {
    const routes = active?.routes ?? [];
    const { mappings, lossReport } = exportWireMockMappings(routes);
    const filename = exportFilename('routes', 'json', `wiremock-${hint}`).replace(/\.json$/, '-wiremock.json');
    const payload = { mappings, _lossReport: lossReport };
    downloadJsonFile(filename, payload);
    const liveMessage = `WireMock export: ${mappings.length} mapping(s), ${lossReport.length} loss note(s).`;
    setLiveMessage(liveMessage);
    return {
      filename,
      format: 'wiremock',
      scope: request.scope,
      text: JSON.stringify(payload, null, 2),
      redacted: true,
      sensitiveValues: [],
      lossNotes: lossReport,
      mappingCount: mappings.length,
      cliCommand: cliCommandFor(filename),
      liveMessage,
    };
  }

  if (request.format === 'har') {
    let rows = transactions;
    if (activeServerId) {
      try {
        const txRes = await apiMockControlClient.transactions(activeServerId);
        if (txRes.ok) rows = txRes.data.transactions;
      } catch {
        /* companion down — fall back to in-memory journal + saved samples */
      }
    }
    const exported = exportHarForStudio(rows, active?.samples ?? [], {
      host: active?.host,
      port: active?.port,
      tls: Boolean(active?.settings.tls?.enabled),
    });
    const filename = `api-mock-journal-${hint.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48)}.har`;
    downloadJsonFile(filename, exported.har);
    const liveMessage = `HAR export: ${exported.entryCount} entr${exported.entryCount === 1 ? 'y' : 'ies'}, ${exported.lossReport.length} loss note(s).`;
    setLiveMessage(liveMessage);
    return {
      filename,
      format: 'har',
      scope: request.scope,
      text: JSON.stringify(exported.har, null, 2),
      redacted: true,
      sensitiveValues: [],
      lossNotes: exported.lossReport,
      entryCount: exported.entryCount,
      cliCommand: cliCommandFor(filename),
      liveMessage,
    };
  }

  const options = request.scope === 'workspace'
    ? { scope: 'workspace' as const, redact: true, format: request.format }
    : request.scope === 'servers'
      ? { scope: 'servers' as const, redact: true, format: request.format, selectedServerIds: activeServerId ? [activeServerId] : [] }
      : { scope: 'routes' as const, redact: true, format: request.format, sourceServerId: activeServerId };
  const payload = exportWorkspace(workspace, options);
  const format: 'json' | 'yaml' = request.format === 'yaml' ? 'yaml' : 'json';
  const text = serializeExport(payload, format);
  const filename = exportFilename(request.scope, format, hint);
  downloadTextFile(filename, text, format === 'yaml' ? 'text/yaml' : 'application/json');
  const liveMessage = request.scope === 'workspace' ? 'Workspace exported.' : request.scope === 'servers' ? 'Server exported.' : 'Routes exported.';
  setLiveMessage(liveMessage);
  const secrets = inspectExportSecrets(payload);
  return {
    filename,
    format,
    scope: request.scope,
    text,
    nativeJson: serializeExport(payload, 'json'),
    redacted: Boolean(payload._exportMeta?.redacted),
    tlsKeyPem: secrets.tlsKeyPem,
    sensitiveValues: secrets.sensitiveValues,
    lossNotes: [],
    cliCommand: cliCommandFor(filename),
    liveMessage,
  };
}

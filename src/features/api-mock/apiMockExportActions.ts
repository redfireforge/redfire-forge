import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { exportFilename, exportWorkspace, serializeExport } from '../../shared/api-mock/exportUtils';
import { exportHarForStudio } from '../../shared/api-mock/harExport';
import { exportWireMockMappings } from '../../shared/api-mock/wireMockExport';
import type { ApiMockExportRequest } from './components/ApiMockWorkspaceNav';
import { apiMockControlClient } from './apiMockControlClient';
import { downloadJsonFile } from './apiMockPageHelpers';

interface HandleApiMockExportArgs {
  request: ApiMockExportRequest;
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  transactions: ApiMockTransactionV1[];
  setLiveMessage: (message: string) => void;
}

export async function handleApiMockExport({
  request,
  servers,
  activeServerId,
  transactions,
  setLiveMessage,
}: HandleApiMockExportArgs): Promise<void> {
  const workspace = { schemaVersion: 1 as const, servers, activeServerId, tabOrder: servers.map(s => s.id) };
  const active = servers.find(s => s.id === activeServerId);
  const hint = active?.name ?? activeServerId ?? 'export';

  if (request.format === 'wiremock') {
    const routes = active?.routes ?? [];
    const { mappings, lossReport } = exportWireMockMappings(routes);
    downloadJsonFile(
      exportFilename('routes', 'json', `wiremock-${hint}`).replace(/\.json$/, '-wiremock.json'),
      { mappings, _lossReport: lossReport },
    );
    setLiveMessage(`WireMock export: ${mappings.length} mapping(s), ${lossReport.length} loss note(s).`);
    return;
  }

  if (request.format === 'har') {
    let rows = transactions;
    if (activeServerId) {
      const txRes = await apiMockControlClient.transactions(activeServerId);
      if (txRes.ok) rows = txRes.data.transactions;
    }
    const exported = exportHarForStudio(rows, active?.samples ?? [], {
      host: active?.host,
      port: active?.port,
      tls: Boolean(active?.settings.tls?.enabled),
    });
    downloadJsonFile(
      `api-mock-journal-${hint.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48)}.har`,
      exported.har,
    );
    setLiveMessage(`HAR export: ${exported.entryCount} entr${exported.entryCount === 1 ? 'y' : 'ies'}, ${exported.lossReport.length} loss note(s).`);
    return;
  }

  const options = request.scope === 'workspace'
    ? { scope: 'workspace' as const, redact: true, format: request.format }
    : request.scope === 'servers'
      ? { scope: 'servers' as const, redact: true, format: request.format, selectedServerIds: activeServerId ? [activeServerId] : [] }
      : { scope: 'routes' as const, redact: true, format: request.format, sourceServerId: activeServerId };
  const payload = exportWorkspace(workspace, options);
  const format: 'json' | 'yaml' = request.format === 'yaml' ? 'yaml' : 'json';
  const text = serializeExport(payload, format);
  const blob = new Blob([text], { type: format === 'yaml' ? 'text/yaml' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename(request.scope, format, hint);
  a.click();
  URL.revokeObjectURL(url);
  setLiveMessage(request.scope === 'workspace' ? 'Workspace exported.' : request.scope === 'servers' ? 'Server exported.' : 'Routes exported.');
}

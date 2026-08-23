/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiMockExportCopyLabel,
  apiMockExportMime,
  handleApiMockExport,
  inspectExportSecrets,
  saveApiMockExportToDisk,
} from './apiMockExportActions';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '@shared/api-mock/contracts';
import type { ApiMockExportRequest } from './components/ApiMockWorkspaceNav';

const exportFilename = vi.fn();
const exportWorkspace = vi.fn();
const serializeExport = vi.fn();
const exportHarForStudio = vi.fn();
const exportWireMockMappings = vi.fn();
const transactionsMock = vi.fn();
const downloadJsonFile = vi.fn();
const isApiMockLiveDemoActive = vi.fn(() => false);
const saveTextFileToDisk = vi.fn();

vi.mock('../../shared/api-mock/exportUtils', () => ({
  exportFilename: (...args: unknown[]) => exportFilename(...args),
  exportWorkspace: (...args: unknown[]) => exportWorkspace(...args),
  serializeExport: (...args: unknown[]) => serializeExport(...args),
}));

vi.mock('../../shared/api-mock/harExport', () => ({
  exportHarForStudio: (...args: unknown[]) => exportHarForStudio(...args),
}));

vi.mock('../../shared/api-mock/wireMockExport', () => ({
  exportWireMockMappings: (...args: unknown[]) => exportWireMockMappings(...args),
}));

vi.mock('./apiMockControlClient', () => ({
  apiMockControlClient: {
    transactions: (...args: unknown[]) => transactionsMock(...args),
  },
}));

vi.mock('./apiMockPageHelpers', () => ({
  downloadJsonFile: (...args: unknown[]) => downloadJsonFile(...args),
  isApiMockLiveDemoActive: (...args: unknown[]) => isApiMockLiveDemoActive(...(args as [])),
  saveTextFileToDisk: (...args: unknown[]) => saveTextFileToDisk(...args),
}));

function request(format: ApiMockExportRequest['format'], scope: ApiMockExportRequest['scope']): ApiMockExportRequest {
  return { format, scope };
}

function baseArgs() {
  return {
    servers: [
      {
        id: 'srv-1',
        name: 'Main Srv',
        host: '127.0.0.1',
        port: 8080,
        routes: [{ id: 'r1' }],
        samples: [{ id: 's1' }],
        settings: { tls: { enabled: true } },
      },
    ] as unknown as ApiMockServerDefinitionV1[],
    activeServerId: 'srv-1',
    transactions: [{ id: 't1' }] as unknown as ApiMockTransactionV1[],
    setLiveMessage: vi.fn(),
  };
}

describe('handleApiMockExport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    exportFilename.mockReturnValue('export.json');
    exportWorkspace.mockReturnValue({ payload: true });
    serializeExport.mockReturnValue('{"ok":true}');
    exportHarForStudio.mockReturnValue({ entryCount: 2, lossReport: ['x'], har: { log: { entries: [] } } });
    exportWireMockMappings.mockReturnValue({ mappings: [{ id: 'm1' }], lossReport: ['w'] });
    transactionsMock.mockResolvedValue({ ok: true, data: { transactions: [{ id: 'from-server' }] } });
  });

  it('exports WireMock mappings and reports summary', async () => {
    const args = baseArgs();
    const result = await handleApiMockExport({ ...args, request: request('wiremock', 'routes') });

    expect(exportWireMockMappings).toHaveBeenCalledWith(args.servers[0].routes);
    expect(downloadJsonFile).toHaveBeenCalledTimes(1);
    expect(args.setLiveMessage).toHaveBeenCalledWith('WireMock export: 1 mapping(s), 1 loss note(s).');
    expect(result.mappingCount).toBe(1);
    expect(result.lossNotes).toEqual(['w']);
    expect(result.cliCommand).toContain('redfireforge mock simulate');
  });

  it('exports WireMock with empty route list when active server is missing', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, activeServerId: undefined, request: request('wiremock', 'routes') });

    expect(exportWireMockMappings).toHaveBeenCalledWith([]);
  });

  it('exports HAR and fetches server transactions when activeServerId exists', async () => {
    const args = baseArgs();
    const har = await handleApiMockExport({ ...args, request: request('har', 'routes') });

    expect(transactionsMock).toHaveBeenCalledWith('srv-1');
    expect(exportHarForStudio).toHaveBeenCalledWith([{ id: 'from-server' }], args.servers[0].samples, {
      host: '127.0.0.1',
      port: 8080,
      tls: true,
    });
    expect(downloadJsonFile).toHaveBeenCalledTimes(1);
    expect(args.setLiveMessage).toHaveBeenCalledWith('HAR export: 2 entries, 1 loss note(s).');
    expect(har.entryCount).toBe(2);
    expect(har.lossNotes).toEqual(['x']);
  });

  it('exports HAR with singular entry message when entry count is 1', async () => {
    exportHarForStudio.mockReturnValueOnce({ entryCount: 1, lossReport: [], har: { log: { entries: [{}] } } });
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('har', 'routes') });

    expect(args.setLiveMessage).toHaveBeenCalledWith('HAR export: 1 entry, 0 loss note(s).');
  });

  it('exports HAR using in-memory transactions when there is no activeServerId', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, activeServerId: undefined, request: request('har', 'routes') });

    expect(transactionsMock).not.toHaveBeenCalled();
    expect(exportHarForStudio).toHaveBeenCalledWith(args.transactions, [], {
      host: undefined,
      port: undefined,
      tls: false,
    });
  });

  it('exports HAR from in-memory journal when the companion fetch fails', async () => {
    transactionsMock.mockRejectedValueOnce(new Error('companion down'));
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('har', 'routes') });

    expect(exportHarForStudio).toHaveBeenCalledWith(args.transactions, args.servers[0].samples, {
      host: '127.0.0.1',
      port: 8080,
      tls: true,
    });
  });

  it('skips the OS download while the live demo panel is open', async () => {
    isApiMockLiveDemoActive.mockReturnValueOnce(true);
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('json', 'workspace') });
    expect(saveTextFileToDisk).not.toHaveBeenCalled();
    expect(args.setLiveMessage).toHaveBeenCalledWith('Workspace exported.');
  });

  it('exports workspace payload and writes JSON download link', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('json', 'workspace') });

    expect(exportWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ schemaVersion: 1, activeServerId: 'srv-1' }),
      { scope: 'workspace', redact: true, format: 'json' },
    );
    expect(serializeExport).toHaveBeenCalledWith({ payload: true }, 'json');
    expect(saveTextFileToDisk).toHaveBeenCalledWith('export.json', '{"ok":true}', 'application/json');
    expect(args.setLiveMessage).toHaveBeenCalledWith('Workspace exported.');
  });

  it('exports server scope with empty selected ids when active server is missing', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, activeServerId: undefined, request: request('yaml', 'servers') });

    expect(exportWorkspace).toHaveBeenCalledWith(
      expect.any(Object),
      { scope: 'servers', redact: true, format: 'yaml', selectedServerIds: [] },
    );
    expect(serializeExport).toHaveBeenCalledWith({ payload: true }, 'yaml');
    expect(saveTextFileToDisk).toHaveBeenCalledWith('export.json', '{"ok":true}', 'text/yaml');
    expect(args.setLiveMessage).toHaveBeenCalledWith('Server exported.');
  });

  it('exports server scope with selected active server id when available', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('json', 'servers') });

    expect(exportWorkspace).toHaveBeenCalledWith(
      expect.any(Object),
      { scope: 'servers', redact: true, format: 'json', selectedServerIds: ['srv-1'] },
    );
  });

  it('exports routes scope and reports routes exported message', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('json', 'routes') });

    expect(exportWorkspace).toHaveBeenCalledWith(
      expect.any(Object),
      { scope: 'routes', redact: true, format: 'json', sourceServerId: 'srv-1' },
    );
    expect(args.setLiveMessage).toHaveBeenCalledWith('Routes exported.');
  });
});

describe('inspectExportSecrets', () => {
  it('reads redacted TLS keys and sensitive variables from a workspace envelope', () => {
    const envelope = {
      _exportMeta: { kind: 'redfireforge-api-mock' as const, schemaVersion: 1 as const, exportedAt: 't', redacted: true },
      data: {
        scope: 'workspace' as const,
        workspace: {
          schemaVersion: 1 as const,
          servers: [{
            settings: { tls: { enabled: false, certPem: 'CERT', keyPem: '***REDACTED***' } },
            variables: [
              { id: 'v1', key: 'pub', value: 'ok', sensitive: false },
              { id: 'v2', key: 'apiToken', value: '[REDACTED]', sensitive: true },
            ],
          }],
          tabOrder: [],
        },
      },
    };
    const secrets = inspectExportSecrets(envelope as never);
    expect(secrets.tlsKeyPem).toBe('***REDACTED***');
    expect(secrets.sensitiveValues).toEqual([{ key: 'apiToken', value: '[REDACTED]' }]);
  });

  it('reads TLS keys from a servers-scope envelope', () => {
    const secrets = inspectExportSecrets({
      _exportMeta: { kind: 'redfireforge-api-mock', schemaVersion: 1, exportedAt: 't', redacted: true },
      data: {
        scope: 'servers',
        servers: [{ settings: { tls: { enabled: false, certPem: '', keyPem: '' } }, variables: [] }],
      },
    } as never);
    expect(secrets.tlsKeyPem).toBe('');
  });

  it('returns empty secrets when the envelope has no servers', () => {
    expect(inspectExportSecrets(undefined).sensitiveValues).toEqual([]);
    expect(inspectExportSecrets({
      _exportMeta: { kind: 'redfireforge-api-mock', schemaVersion: 1, exportedAt: 't', redacted: true },
      data: { scope: 'routes', sourceServerId: 'a', routes: [], samples: [] },
    } as never).tlsKeyPem).toBeUndefined();
  });
});

describe('saveApiMockExportToDisk', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('labels copy and mime by format', () => {
    expect(apiMockExportCopyLabel('json')).toBe('Copy JSON');
    expect(apiMockExportCopyLabel('yaml')).toBe('Copy YAML');
    expect(apiMockExportCopyLabel('har')).toBe('Copy HAR');
    expect(apiMockExportCopyLabel('wiremock')).toBe('Copy JSON');
    expect(apiMockExportMime('json')).toBe('application/json');
    expect(apiMockExportMime('yaml')).toBe('text/yaml');
    expect(apiMockExportMime('har')).toBe('application/json');
  });

  it('writes the confirmation payload even while a live demo is open', () => {
    saveApiMockExportToDisk({
      filename: 'workspace.yaml',
      text: 'servers: []',
      format: 'yaml',
    });
    expect(saveTextFileToDisk).toHaveBeenCalledWith('workspace.yaml', 'servers: []', 'text/yaml');
  });
});

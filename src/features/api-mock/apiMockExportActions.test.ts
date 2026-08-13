/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleApiMockExport } from './apiMockExportActions';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import type { ApiMockExportRequest } from './components/ApiMockWorkspaceNav';

const exportFilename = vi.fn();
const exportWorkspace = vi.fn();
const serializeExport = vi.fn();
const exportHarForStudio = vi.fn();
const exportWireMockMappings = vi.fn();
const transactionsMock = vi.fn();
const downloadJsonFile = vi.fn();

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
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    exportFilename.mockReturnValue('export.json');
    exportWorkspace.mockReturnValue({ payload: true });
    serializeExport.mockReturnValue('{"ok":true}');
    exportHarForStudio.mockReturnValue({ entryCount: 2, lossReport: ['x'], har: { log: { entries: [] } } });
    exportWireMockMappings.mockReturnValue({ mappings: [{ id: 'm1' }], lossReport: ['w'] });
    transactionsMock.mockResolvedValue({ ok: true, data: { transactions: [{ id: 'from-server' }] } });

    createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectUrlSpy?.mockRestore();
    revokeObjectUrlSpy?.mockRestore();
  });

  it('exports WireMock mappings and reports summary', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('wiremock', 'routes') });

    expect(exportWireMockMappings).toHaveBeenCalledWith(args.servers[0].routes);
    expect(downloadJsonFile).toHaveBeenCalledTimes(1);
    expect(args.setLiveMessage).toHaveBeenCalledWith('WireMock export: 1 mapping(s), 1 loss note(s).');
  });

  it('exports WireMock with empty route list when active server is missing', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, activeServerId: undefined, request: request('wiremock', 'routes') });

    expect(exportWireMockMappings).toHaveBeenCalledWith([]);
  });

  it('exports HAR and fetches server transactions when activeServerId exists', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('har', 'routes') });

    expect(transactionsMock).toHaveBeenCalledWith('srv-1');
    expect(exportHarForStudio).toHaveBeenCalledWith([{ id: 'from-server' }], args.servers[0].samples, {
      host: '127.0.0.1',
      port: 8080,
      tls: true,
    });
    expect(downloadJsonFile).toHaveBeenCalledTimes(1);
    expect(args.setLiveMessage).toHaveBeenCalledWith('HAR export: 2 entries, 1 loss note(s).');
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

  it('exports workspace payload and writes JSON download link', async () => {
    const args = baseArgs();
    await handleApiMockExport({ ...args, request: request('json', 'workspace') });

    expect(exportWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ schemaVersion: 1, activeServerId: 'srv-1' }),
      { scope: 'workspace', redact: true, format: 'json' },
    );
    expect(serializeExport).toHaveBeenCalledWith({ payload: true }, 'json');
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock');
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

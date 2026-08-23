import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isTauri } from '@shared/utils/platform';
import {
  commitGrpcMockNetworkListener,
  exportGrpcDescriptorProtoset,
  fetchGrpcMockNetworkListenerLogs,
  fetchGrpcMockNetworkListenerStatus,
  startGrpcMockNetworkListener,
  stopGrpcMockNetworkListener,
} from './grpcMockListenerClient';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

const httpFetchMock = vi.fn();

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: (...args: unknown[]) => httpFetchMock(...args),
}));

describe('grpcMockListenerClient coverage gaps', () => {
  beforeEach(() => {
    httpFetchMock.mockReset();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('throws when mock API returns non-JSON body', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      body: 'upstream html error',
    });

    await expect(startGrpcMockNetworkListener({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptorKey: 'desc-1',
      ruleSet: { rules: [] },
    })).rejects.toThrow(/non-JSON response/i);
  });

  it('throws when mock API envelope is not ok', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ ok: false, error: { message: 'start rejected' } }),
    });

    await expect(stopGrpcMockNetworkListener('tab-1')).rejects.toThrow(/start rejected/i);
  });

  it('throws default message when mock API error message is absent', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ ok: false }),
    });

    await expect(commitGrpcMockNetworkListener({
      tabId: 'tab-1',
      ruleSet: { rules: [] },
    })).rejects.toThrow(/Mock listener API request failed/i);
  });

  it('stopGrpcMockNetworkListener returns status from envelope', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({
        ok: true,
        data: {
          status: {
            running: false,
            tabId: 'tab-2',
            listenTarget: '127.0.0.1:50062',
            port: 50062,
            generation: 2,
            inFlightCount: 0,
          },
        },
      }),
    });

    const status = await stopGrpcMockNetworkListener('tab-2');
    expect(status.running).toBe(false);
    expect(httpFetchMock).toHaveBeenCalledWith(
      '/api/grpc/mock/stop',
      'POST',
      expect.objectContaining({ 'Content-Type': 'application/json' }),
      JSON.stringify({ tabId: 'tab-2' }),
    );
  });

  it('fetchGrpcMockNetworkListenerStatus uses GET without Content-Type', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({
        ok: true,
        data: {
          status: {
            running: true,
            tabId: 'tab-3',
            listenTarget: '127.0.0.1:50063',
            port: 50063,
            generation: 1,
            inFlightCount: 0,
          },
        },
      }),
    });

    const status = await fetchGrpcMockNetworkListenerStatus('tab-3');
    expect(status.running).toBe(true);
    expect(httpFetchMock.mock.calls[0]?.[1]).toBe('GET');
    expect(httpFetchMock.mock.calls[0]?.[2]).not.toHaveProperty('Content-Type');
  });

  it('fetchGrpcMockNetworkListenerLogs passes since cursor', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({
        ok: true,
        data: { entries: [{ id: 1, message: 'hit' }], nextCursor: 1 },
      }),
    });

    const logs = await fetchGrpcMockNetworkListenerLogs('tab-4', 5);
    expect(logs.entries).toHaveLength(1);
    expect(httpFetchMock.mock.calls[0]?.[0]).toContain('since=5');
  });

  it('exportGrpcDescriptorProtoset throws when route envelope fails', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({
        ok: false,
        error: { message: 'descriptor missing' },
      }),
    });

    await expect(exportGrpcDescriptorProtoset('missing-key')).rejects.toThrow(/descriptor missing/i);
  });

  it('exportGrpcDescriptorProtoset returns protosetBase64 on success', async () => {
    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({
        ok: true,
        data: { protosetBase64: 'YWJj' },
      }),
    });

    const result = await exportGrpcDescriptorProtoset('desc-1');
    expect(result.protosetBase64).toBe('YWJj');
  });

  it('routes start/stop/status/commit/log through native Tauri helpers', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const native = await import('../../../shared/grpc/grpcNativeTauriMockListener');
    const startSpy = vi.spyOn(native, 'invokeGrpcMockListenerStartNative').mockResolvedValue({
      running: true,
      tabId: 'tab-t',
      listenTarget: '127.0.0.1:50070',
      generation: 9,
    });
    const stopSpy = vi.spyOn(native, 'invokeGrpcMockListenerStopNative').mockResolvedValue({
      running: false,
      tabId: 'tab-t',
      listenTarget: '127.0.0.1:50070',
      generation: 9,
    });
    const statusSpy = vi.spyOn(native, 'invokeGrpcMockListenerStatusNative').mockResolvedValue({
      running: true,
      tabId: 'tab-t',
      listenTarget: '127.0.0.1:50070',
      generation: 9,
    });
    const commitSpy = vi.spyOn(native, 'invokeGrpcMockListenerCommitNative').mockResolvedValue({
      ruleCount: 1,
    } as never);
    const logSpy = vi.spyOn(native, 'invokeGrpcMockListenerLogNative').mockResolvedValue({
      entries: [],
      nextCursor: 4,
    });

    await expect(startGrpcMockNetworkListener({
      tabId: 'tab-t',
      connectionId: 'conn',
      descriptorKey: 'desc',
      ruleSet: { rules: [] },
    })).resolves.toMatchObject({ listenTarget: '127.0.0.1:50070' });
    await expect(stopGrpcMockNetworkListener('tab-t')).resolves.toMatchObject({ running: false });
    await expect(fetchGrpcMockNetworkListenerStatus('tab-t')).resolves.toMatchObject({ generation: 9 });
    await expect(commitGrpcMockNetworkListener({
      tabId: 'tab-t',
      ruleSet: { rules: [] },
    })).resolves.toMatchObject({ ruleCount: 1 });
    await expect(fetchGrpcMockNetworkListenerLogs('tab-t', 2)).resolves.toEqual({
      entries: [],
      nextCursor: 4,
    });

    expect(startSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalledWith('tab-t');
    expect(statusSpy).toHaveBeenCalledWith('tab-t');
    expect(commitSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('tab-t', 2);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { isTauri } from '@shared/utils/platform';
import {
  supportsGrpcMockNetworkListener,
  startGrpcMockNetworkListener,
} from './grpcMockListenerClient';
import { invokeGrpcMockListenerStartNative } from '@shared/grpc/grpcNativeTauriMockListener';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(async (url: string, method: string, _headers: Record<string, string>, body?: string) => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    body: (() => {
      if (url === '/api/grpc/mock/start') {
        return JSON.stringify({
          ok: true,
          data: {
            status: {
              running: true,
              tabId: JSON.parse(body ?? '{}').tabId,
              listenTarget: '127.0.0.1:50061',
              port: 50061,
              generation: 1,
              inFlightCount: 0,
            },
          },
        });
      }
      return JSON.stringify({ ok: false, error: { message: 'unexpected' } });
    })(),
  })),
}));

vi.mock('../../../shared/grpc/grpcNativeTauriMockListener', () => ({
  invokeGrpcMockListenerStartNative: vi.fn(async (request: { tabId: string }) => ({
    running: true,
    tabId: request.tabId,
    listenTarget: '127.0.0.1:50071',
    port: 50071,
    generation: 1,
    inFlightCount: 0,
  })),
  invokeGrpcMockListenerStopNative: vi.fn(),
  invokeGrpcMockListenerStatusNative: vi.fn(),
  invokeGrpcMockListenerCommitNative: vi.fn(),
  invokeGrpcMockListenerLogNative: vi.fn(),
}));

describe('grpcMockListenerClient', () => {
  it('supports network listener on both web and desktop', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(supportsGrpcMockNetworkListener()).toBe(true);
    vi.mocked(isTauri).mockReturnValue(true);
    expect(supportsGrpcMockNetworkListener()).toBe(true);
  });

  it('startGrpcMockNetworkListener returns status envelope', async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const status = await startGrpcMockNetworkListener({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptorKey: 'desc-1',
      ruleSet: { rules: [] },
    });
    expect(status.listenTarget).toBe('127.0.0.1:50061');
    expect(status.running).toBe(true);
  });

  it('startGrpcMockNetworkListener uses native invoke on desktop', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const status = await startGrpcMockNetworkListener({
      tabId: 'tab-tauri',
      connectionId: 'conn-1',
      descriptorKey: 'desc-1',
      ruleSet: { rules: [] },
    });

    expect(invokeGrpcMockListenerStartNative).toHaveBeenCalled();
    expect(status.listenTarget).toBe('127.0.0.1:50071');
    expect(status.running).toBe(true);
  });
});

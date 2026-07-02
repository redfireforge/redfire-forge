import { describe, expect, it, vi } from 'vitest';
import { isTauri } from '../../../shared/utils/platform';
import {
  supportsGrpcMockNetworkListener,
  startGrpcMockNetworkListener,
} from './grpcMockListenerClient';

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

describe('grpcMockListenerClient', () => {
  it('supports network listener on web only', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(supportsGrpcMockNetworkListener()).toBe(true);
    vi.mocked(isTauri).mockReturnValue(true);
    expect(supportsGrpcMockNetworkListener()).toBe(false);
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
});

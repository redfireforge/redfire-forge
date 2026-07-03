/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadMock = vi.fn();
const clearFilteredMock = vi.fn();

vi.mock('../data/grpcCallHistoryRecorder', () => ({
  loadGrpcCallHistoryEntries: (...args: unknown[]) => loadMock(...args),
  clearGrpcCallHistoryFiltered: (...args: unknown[]) => clearFilteredMock(...args),
}));

import {
  GRPC_CALL_HISTORY_UPDATED_EVENT,
} from './grpcStudioCallHistoryCapture';
import {
  GRPC_DEMO_CALL_HISTORY_TARGETS,
  dispatchGrpcCallHistoryReload,
  purgeGrpcDemoCallHistory,
} from './grpcDemoCallHistoryCleanup';

describe('dispatchGrpcCallHistoryReload', () => {
  it('dispatches the reload event in browser contexts', () => {
    const listener = vi.fn();
    window.addEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);
    dispatchGrpcCallHistoryReload();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);
  });

  it('no-ops outside browser contexts', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate non-browser runtime
    delete globalThis.window;
    expect(() => dispatchGrpcCallHistoryReload()).not.toThrow();
    globalThis.window = originalWindow;
  });
});

describe('purgeGrpcDemoCallHistory', () => {
  beforeEach(() => {
    loadMock.mockReset();
    clearFilteredMock.mockReset();
  });

  it('removes demo target rows and dispatches reload event', async () => {
    loadMock.mockResolvedValue([
      { id: 'a', target: 'localhost:50051', service: 'echo.EchoService', method: 'Echo' },
      { id: 'b', target: 'api.prod.example:443', service: 'other.Service', method: 'Ping' },
    ]);
    clearFilteredMock.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const listener = vi.fn();
    window.addEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);

    const removed = await purgeGrpcDemoCallHistory();

    expect(removed).toBe(1);
    expect(clearFilteredMock).toHaveBeenCalledWith({ text: 'localhost:50051' });
    expect(clearFilteredMock).toHaveBeenCalledWith({ text: '127.0.0.1:50051' });
    expect(listener).toHaveBeenCalled();

    window.removeEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);
  });

  it('exports both loopback demo targets', () => {
    expect(GRPC_DEMO_CALL_HISTORY_TARGETS).toEqual([
      'localhost:50051',
      '127.0.0.1:50051',
    ]);
  });

  it('dispatches reload without deleting when no demo rows exist', async () => {
    loadMock.mockResolvedValue([
      { id: 'b', target: 'api.prod.example:443', service: 'other.Service', method: 'Ping' },
    ]);

    const listener = vi.fn();
    window.addEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);

    const removed = await purgeGrpcDemoCallHistory();

    expect(removed).toBe(0);
    expect(clearFilteredMock).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();

    window.removeEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);
  });

  it('dispatches reload without deleting when history is empty', async () => {
    loadMock.mockResolvedValue([]);

    const listener = vi.fn();
    window.addEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);

    const removed = await purgeGrpcDemoCallHistory();

    expect(removed).toBe(0);
    expect(clearFilteredMock).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();

    window.removeEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);
  });

  it('sums removals across both demo target filters', async () => {
    loadMock.mockResolvedValue([
      { id: 'a', target: 'localhost:50051', service: 'echo.EchoService', method: 'Echo' },
      { id: 'c', target: '127.0.0.1:50051', service: 'echo.EchoService', method: 'Echo' },
    ]);
    clearFilteredMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const removed = await purgeGrpcDemoCallHistory();

    expect(removed).toBe(2);
    expect(clearFilteredMock).toHaveBeenCalledTimes(2);
  });
});

/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

const start = vi.fn();
const stopAllAsync = vi.fn();

vi.mock('../src-server/api-mock/ApiMockServerPool.js', () => ({
  ApiMockServerPool: class {
    start = start;
    stopAllAsync = stopAllAsync;
  },
}));

import { startStandaloneServers, standaloneBindHost } from './mockStandalone';

describe('startStandaloneServers', () => {
  it('starts each server and rolls back on partial failure', async () => {
    start.mockReset();
    stopAllAsync.mockReset();
    start.mockResolvedValueOnce({ serverId: 'a', port: 4600, state: 'running', generation: 1 });
    start.mockRejectedValueOnce(new Error('port in use'));
    const handle = await startStandaloneServers([
      { id: 'a', port: 4600 } as never,
      { id: 'b', port: 4601 } as never,
    ]);
    expect(handle.results[0]).toEqual({
      serverId: 'a',
      ok: false,
      error: 'Rolled back because another listener failed to start',
      mode: 'standalone',
    });
    expect(handle.results[1].ok).toBe(false);
    expect(handle.results[1].error).toBe('port in use');
    expect(stopAllAsync).toHaveBeenCalled();
    await handle.stopAll();
    expect(stopAllAsync).toHaveBeenCalledTimes(2);
  });

  it('keeps listeners running when every start succeeds', async () => {
    start.mockReset();
    stopAllAsync.mockReset();
    start.mockResolvedValue({ serverId: 'a', port: 4600, state: 'running', generation: 1 });
    const handle = await startStandaloneServers([{ id: 'a', port: 4600 } as never]);
    expect(handle.results).toEqual([{ serverId: 'a', ok: true, port: 4600, mode: 'standalone' }]);
    expect(stopAllAsync).not.toHaveBeenCalled();
  });

  it('stringifies non-Error start failures', async () => {
    start.mockReset();
    stopAllAsync.mockReset();
    start.mockRejectedValueOnce('fail');
    const handle = await startStandaloneServers([{ id: 'a', port: 4600 } as never]);
    expect(handle.results[0]).toEqual({ serverId: 'a', ok: false, error: 'fail', mode: 'standalone' });
    expect(stopAllAsync).toHaveBeenCalled();
  });
});

describe('standaloneBindHost', () => {
  it('rewrites loopback to 0.0.0.0 inside Docker and keeps configured hosts locally', () => {
    expect(standaloneBindHost('127.0.0.1', true)).toBe('0.0.0.0');
    expect(standaloneBindHost('localhost', true)).toBe('0.0.0.0');
    expect(standaloneBindHost('0.0.0.0', false)).toBe('0.0.0.0');
    expect(standaloneBindHost('localhost', false)).toBe('localhost');
    expect(standaloneBindHost(undefined, false)).toBe('127.0.0.1');
  });

  it('passes a container bind host through to the pool', async () => {
    start.mockReset();
    stopAllAsync.mockReset();
    start.mockResolvedValue({ serverId: 'a', port: 4600, state: 'running', generation: 1 });
    await startStandaloneServers(
      [{ id: 'a', port: 4600, host: '127.0.0.1' } as never],
      { inDocker: true },
    );
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ host: '0.0.0.0' }));
  });
});

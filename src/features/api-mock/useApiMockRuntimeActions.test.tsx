/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApiMockRuntimeActions } from './useApiMockRuntimeActions';
import { apiMockControlClient } from './apiMockControlClient';
import { createServer } from './apiMockStudioFactory';

vi.mock('./apiMockControlClient', () => ({ apiMockControlClient: { start: vi.fn(), stop: vi.fn(), commit: vi.fn(), restart: vi.fn() } }));

describe('useApiMockRuntimeActions', () => {
  it('does not retry a port error when its owner is still in the workspace', async () => {
    const server = createServer();
    const patchRuntime = vi.fn();
    vi.mocked(apiMockControlClient.start).mockResolvedValue({ ok: false, error: { code: 'MOCK_PORT_OWNED', title: 'Port busy', message: 'Owned by mock server ' + server.id } } as never);
    const { result } = renderHook(() => useApiMockRuntimeActions({ getServers: () => [server], patchRuntime, setLiveMessage: vi.fn() }));
    await act(() => result.current.handleStart(server));
    expect(apiMockControlClient.stop).not.toHaveBeenCalled();
    expect(apiMockControlClient.start).toHaveBeenCalledTimes(1);
  });

  it('uses the caller server when it is absent from the latest workspace', async () => {
    const server = createServer();
    vi.mocked(apiMockControlClient.commit).mockResolvedValue({ ok: true, data: { generation: 2 } } as never);
    const { result } = renderHook(() => useApiMockRuntimeActions({ getServers: () => [], patchRuntime: vi.fn(), setLiveMessage: vi.fn() }));
    await act(() => result.current.handleApply(server));
    expect(apiMockControlClient.commit).toHaveBeenCalledWith(server);
  });

  it('uses the caller server for restart when the workspace no longer has it', async () => {
    const server = createServer();
    vi.mocked(apiMockControlClient.restart).mockResolvedValue({ ok: true, data: { generation: 3 } } as never);
    const { result } = renderHook(() => useApiMockRuntimeActions({ getServers: () => [], patchRuntime: vi.fn(), setLiveMessage: vi.fn() }));
    await act(() => result.current.handleRestart(server));
    expect(apiMockControlClient.restart).toHaveBeenCalledWith(server);
  });
});
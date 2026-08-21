/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useApiMockServerLibrary } from './useApiMockServerLibrary';
import { DEFAULT_SETTINGS } from '../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';

function makeServer(id: string, port = 4600): ApiMockServerDefinitionV1 {
  return {
    id,
    name: id.toUpperCase(),
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
  };
}

/** Drives the hook with page-owned state held in refs so updates round-trip. */
function setup(options: {
  servers?: ApiMockServerDefinitionV1[];
  live?: string[];
  autoConfirm?: boolean;
} = {}) {
  const state = {
    servers: options.servers ?? [makeServer('srv-a'), makeServer('srv-b', 4601)],
    activeServerId: 'srv-a' as string | undefined,
  };
  const setServers = vi.fn((update: unknown) => {
    state.servers = typeof update === 'function'
      ? (update as (prev: ApiMockServerDefinitionV1[]) => ApiMockServerDefinitionV1[])(state.servers)
      : (update as ApiMockServerDefinitionV1[]);
  });
  const setActiveServerId = vi.fn((update: unknown) => {
    state.activeServerId = typeof update === 'function'
      ? (update as (prev: string | undefined) => string | undefined)(state.activeServerId)
      : (update as string | undefined);
  });
  const setSelectedRouteId = vi.fn();
  const setLiveMessage = vi.fn();
  const stopServer = vi.fn(async () => {});
  const forgetRuntime = vi.fn();
  const confirm = vi.fn((_message: string, onConfirm: () => void) => {
    if (options.autoConfirm !== false) onConfirm();
  });
  const live = new Set(options.live ?? []);

  const rendered = renderHook(() => useApiMockServerLibrary({
    servers: state.servers,
    setServers: setServers as never,
    activeServerId: state.activeServerId,
    setActiveServerId: setActiveServerId as never,
    setSelectedRouteId: setSelectedRouteId as never,
    setLiveMessage,
    confirm,
    isLive: (id: string) => live.has(id),
    stopServer,
    forgetRuntime,
  }));

  return { rendered, state, confirm, stopServer, forgetRuntime, setLiveMessage, setSelectedRouteId };
}

describe('useApiMockServerLibrary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with no open tabs until the page hydrates them', () => {
    const { rendered } = setup();
    expect(rendered.result.current.openTabIds).toEqual([]);
    expect(rendered.result.current.openServers).toEqual([]);
    expect(rendered.result.current.parkedCount).toBe(2);
  });

  it('parks a closed tab without touching the library', async () => {
    const { rendered, state, stopServer, forgetRuntime, setLiveMessage } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a', 'srv-b']));
    await act(async () => rendered.result.current.handleCloseServers(['srv-a']));

    expect(stopServer).toHaveBeenCalledWith('srv-a');
    expect(state.servers.map(s => s.id)).toEqual(['srv-a', 'srv-b']);
    expect(rendered.result.current.openTabIds).toEqual(['srv-b']);
    expect(forgetRuntime).toHaveBeenCalledWith(['srv-a']);
    expect(setLiveMessage).toHaveBeenCalledWith(expect.stringContaining('still saved in Saved servers'));
  });

  it('confirms before stopping a running listener and skips the work when cancelled', async () => {
    const { rendered, confirm, stopServer } = setup({ live: ['srv-a'], autoConfirm: false });
    act(() => rendered.result.current.setOpenTabIds(['srv-a']));
    await act(async () => rendered.result.current.handleCloseServers(['srv-a']));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('Stop and close'),
      expect.any(Function),
      undefined,
      expect.objectContaining({ confirmLabel: 'Stop & Close' }),
    );
    expect(stopServer).not.toHaveBeenCalled();
    expect(rendered.result.current.openTabIds).toEqual(['srv-a']);
  });

  it('ignores close and delete requests for unknown servers', async () => {
    const { rendered, stopServer, confirm } = setup();
    await act(async () => rendered.result.current.handleCloseServer('nope'));
    await act(async () => rendered.result.current.handleDeleteServer('nope'));
    expect(stopServer).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('opens a parked server and just switches when it is already open', () => {
    const { rendered, setLiveMessage, setSelectedRouteId } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a']));

    act(() => rendered.result.current.handleOpenFromLibrary('srv-b'));
    expect(rendered.result.current.openTabIds).toEqual(['srv-a', 'srv-b']);
    expect(setSelectedRouteId).toHaveBeenCalledWith(undefined);
    expect(setLiveMessage).toHaveBeenLastCalledWith('SRV-B opened from Saved servers.');

    setSelectedRouteId.mockClear();
    act(() => rendered.result.current.handleOpenFromLibrary('srv-a'));
    expect(rendered.result.current.openTabIds).toEqual(['srv-a', 'srv-b']);
    expect(setSelectedRouteId).not.toHaveBeenCalled();
    expect(setLiveMessage).toHaveBeenLastCalledWith('Switched to SRV-A.');
  });

  it('warns instead of opening a ninth tab', () => {
    const servers = Array.from({ length: 9 }, (_, i) => makeServer(`srv-${i}`, 4600 + i));
    const { rendered, confirm } = setup({ servers });
    act(() => rendered.result.current.setOpenTabIds(servers.slice(0, 8).map(s => s.id)));

    act(() => rendered.result.current.handleOpenFromLibrary('srv-8'));
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('at most 8 mock servers open'),
      expect.any(Function),
      undefined,
      expect.objectContaining({ title: 'Tab limit' }),
    );
    expect(rendered.result.current.openTabIds).toHaveLength(8);
  });

  it('opens a duplicate right after its source tab', () => {
    const { rendered } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a', 'srv-b']));
    act(() => rendered.result.current.trackOpenedServer('srv-copy', 'srv-a'));
    expect(rendered.result.current.openTabIds).toEqual(['srv-a', 'srv-copy', 'srv-b']);
    // Already tracked, and an unknown anchor appends.
    act(() => rendered.result.current.trackOpenedServer('srv-copy', 'srv-a'));
    act(() => rendered.result.current.trackOpenedServer('srv-new', 'missing'));
    expect(rendered.result.current.openTabIds).toEqual(['srv-a', 'srv-copy', 'srv-b', 'srv-new']);
  });

  it('deletes a confirmed server and restores it from the undo snapshot', async () => {
    const { rendered, state, confirm, setLiveMessage } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a', 'srv-b']));
    await act(async () => rendered.result.current.handleDeleteServers(['srv-a']));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('Delete "SRV-A"'),
      expect.any(Function),
      undefined,
      expect.objectContaining({ confirmLabel: 'Delete' }),
    );
    expect(state.servers.map(s => s.id)).toEqual(['srv-b']);
    expect(rendered.result.current.openTabIds).toEqual(['srv-b']);
    expect(rendered.result.current.serverUndoToast).toBeTruthy();

    rendered.rerender();
    expect(setLiveMessage).toHaveBeenCalledWith('SRV-A deleted.');
  });

  it('leaves the library untouched when a delete is cancelled', async () => {
    const { rendered, state } = setup({ autoConfirm: false });
    act(() => rendered.result.current.setOpenTabIds(['srv-a']));
    await act(async () => rendered.result.current.handleDeleteServer('srv-a'));
    expect(state.servers.map(s => s.id)).toEqual(['srv-a', 'srv-b']);
    expect(rendered.result.current.serverUndoToast).toBeNull();
  });

  it('stops the listener before parking a confirmed running tab', async () => {
    const { rendered, stopServer, setLiveMessage } = setup({ live: ['srv-a'] });
    act(() => rendered.result.current.setOpenTabIds(['srv-a', 'srv-b']));
    await act(async () => rendered.result.current.handleCloseServers(['srv-a']));

    expect(stopServer).toHaveBeenCalledWith('srv-a');
    expect(rendered.result.current.openTabIds).toEqual(['srv-b']);
    expect(setLiveMessage).toHaveBeenCalledWith(expect.stringContaining('still saved in Saved servers'));
  });

  it('restores servers and tabs from the undo toast, and forgets them on dismiss', async () => {
    const { rendered, state, setLiveMessage } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a', 'srv-b']));
    await act(async () => rendered.result.current.handleDeleteServers(['srv-a']));

    const { unmount } = render(rendered.result.current.serverUndoToast);
    await act(async () => {
      fireEvent.click(screen.getByTestId('api-mock-undo-restore'));
    });
    expect(state.servers.map(s => s.id)).toEqual(['srv-a', 'srv-b']);
    expect(rendered.result.current.openTabIds).toEqual(['srv-a', 'srv-b']);
    expect(setLiveMessage).toHaveBeenLastCalledWith('SRV-A restored.');
    // A second undo is a no-op once the snapshot is consumed.
    rendered.rerender();
    expect(rendered.result.current.serverUndoToast).toBeNull();
    unmount();

    await act(async () => rendered.result.current.handleDeleteServers(['srv-b']));
    render(rendered.result.current.serverUndoToast);
    await act(async () => {
      fireEvent.click(screen.getByTestId('api-mock-undo-dismiss'));
    });
    rendered.rerender();
    expect(rendered.result.current.serverUndoToast).toBeNull();
    expect(state.servers.map(s => s.id)).toEqual(['srv-a']);
  });

  it('labels a multi-server undo by count', async () => {
    const { rendered } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a', 'srv-b']));
    await act(async () => rendered.result.current.handleDeleteServers(['srv-a', 'srv-b']));
    render(rendered.result.current.serverUndoToast);
    expect(screen.getByTestId('api-mock-undo-toast').textContent).toContain('2 mock servers');
  });

  it('keeps the active tab when a background tab is closed', async () => {
    const { rendered, setSelectedRouteId } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a', 'srv-b']));
    await act(async () => rendered.result.current.handleCloseServer('srv-b'));
    expect(rendered.result.current.openTabIds).toEqual(['srv-a']);
    expect(setSelectedRouteId).not.toHaveBeenCalled();
  });

  it('appends an unanchored open and ignores servers missing from the library', () => {
    const { rendered, setLiveMessage } = setup();
    act(() => rendered.result.current.setOpenTabIds(['srv-a']));
    act(() => rendered.result.current.trackOpenedServer('srv-b'));
    expect(rendered.result.current.openTabIds).toEqual(['srv-a', 'srv-b']);

    setLiveMessage.mockClear();
    act(() => rendered.result.current.handleOpenFromLibrary('missing'));
    expect(rendered.result.current.openTabIds).toEqual(['srv-a', 'srv-b']);
    expect(setLiveMessage).not.toHaveBeenCalled();
  });
});

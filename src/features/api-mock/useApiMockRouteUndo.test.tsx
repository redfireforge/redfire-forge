/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act, screen, fireEvent } from '@testing-library/react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useApiMockRouteUndo } from './useApiMockRouteUndo';
import { DEFAULT_SETTINGS, createDefaultResponse } from '@shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';

const ts = '2026-08-13T00:00:00.000Z';

function makeServer(id = 'srv-a'): ApiMockServerDefinitionV1 {
  return {
    id,
    name: id,
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    variables: [],
    samples: [{
      id: 's1',
      name: 'ex',
      routeId: 'r1',
      request: { method: 'GET', path: '/users', rawPath: '/users', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
    }],
    routes: [{
      id: 'r1', name: 'Users', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/users' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{ ...createDefaultResponse('resp-1') }],
      tags: [], createdAt: ts, updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts, updatedAt: ts,
  };
}

describe('useApiMockRouteUndo', () => {
  it('snapshots a delete, restores once, and ignores a second undo', () => {
    const server = makeServer();
    const handleUpdateServer = vi.fn();
    const setSelectedRouteId = vi.fn();
    const setLiveMessage = vi.fn();
    const setActiveServerId = vi.fn();

    const { result, rerender } = renderHook((props: { servers: ApiMockServerDefinitionV1[] }) => useApiMockRouteUndo({
      servers: props.servers,
      activeServerId: 'srv-a',
      activeServer: props.servers[0],
      selectedRouteId: 'r1',
      handleUpdateServer,
      setSelectedRouteId,
      setLiveMessage,
      setActiveServerId,
    }), { initialProps: { servers: [server] } });

    act(() => { result.current.handleDeleteRoute('r1'); });
    expect(handleUpdateServer).toHaveBeenCalled();
    expect(result.current.undoToast).toBeTruthy();

    const afterDelete = { ...server, routes: [] as ApiMockServerDefinitionV1['routes'] };
    rerender({ servers: [afterDelete] });
    const { unmount } = render(<>{result.current.undoToast}</>);

    act(() => {
      fireEvent.click(screen.getByTestId('api-mock-undo-restore'));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }));
    });
    expect(setLiveMessage).toHaveBeenCalledWith('Restored “Users”.');
    expect(setLiveMessage).not.toHaveBeenCalledWith('Could not restore the deleted rule.');
    expect(setActiveServerId).toHaveBeenCalledWith('srv-a');
    unmount();
  });

  it('reports when restore cannot put the rule back', () => {
    const server = makeServer();
    const setLiveMessage = vi.fn();
    const { result, rerender } = renderHook((props: { servers: ApiMockServerDefinitionV1[] }) => useApiMockRouteUndo({
      servers: props.servers,
      activeServerId: 'srv-a',
      activeServer: props.servers[0],
      selectedRouteId: 'r1',
      handleUpdateServer: vi.fn(),
      setSelectedRouteId: vi.fn(),
      setLiveMessage,
      setActiveServerId: vi.fn(),
    }), { initialProps: { servers: [server] } });

    act(() => { result.current.handleDeleteRoute('r1'); });
    rerender({ servers: [server] });
    const { unmount } = render(<>{result.current.undoToast}</>);
    act(() => { fireEvent.click(screen.getByTestId('api-mock-undo-restore')); });
    expect(setLiveMessage).toHaveBeenCalledWith('Could not restore the deleted rule.');
    unmount();
  });

  it('dismisses the toast when the origin server is gone and no-ops a missing delete', () => {
    const server = makeServer();
    const { result, rerender } = renderHook((props: { servers: ApiMockServerDefinitionV1[] }) => useApiMockRouteUndo({
      servers: props.servers,
      activeServerId: 'srv-a',
      activeServer: props.servers[0],
      selectedRouteId: 'r1',
      handleUpdateServer: vi.fn(),
      setSelectedRouteId: vi.fn(),
      setLiveMessage: vi.fn(),
      setActiveServerId: vi.fn(),
    }), { initialProps: { servers: [server] } });

    act(() => { result.current.handleDeleteRoute('missing'); });
    expect(result.current.undoToast).toBeNull();

    act(() => { result.current.handleDeleteRoute('r1'); });
    expect(result.current.undoToast).toBeTruthy();
    rerender({ servers: [] });
    expect(result.current.undoToast).toBeNull();
  });

  it('dismisses the toast without restoring', () => {
    const server = makeServer();
    const handleUpdateServer = vi.fn();
    const { result } = renderHook(() => useApiMockRouteUndo({
      servers: [server],
      activeServerId: 'srv-a',
      activeServer: server,
      selectedRouteId: 'r1',
      handleUpdateServer,
      setSelectedRouteId: vi.fn(),
      setLiveMessage: vi.fn(),
      setActiveServerId: vi.fn(),
    }));

    act(() => { result.current.handleDeleteRoute('r1'); });
    const { unmount } = render(<>{result.current.undoToast}</>);
    act(() => { fireEvent.click(screen.getByTestId('api-mock-undo-dismiss')); });
    expect(handleUpdateServer).toHaveBeenCalledTimes(1);
    unmount();
  });
});

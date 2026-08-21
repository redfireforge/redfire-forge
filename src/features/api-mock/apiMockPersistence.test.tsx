/**
 * @vitest-environment jsdom
 *
 * API Mock Studio — persistence tests. Verifies mock-server definitions survive
 * a save/load round-trip, corrupt storage falls back safely, and the page
 * hydrates persisted servers on mount (the "not persistent" regression).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiMockStudioPage } from './ApiMockStudioPage';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from './apiMockGalleryImport';
import {
  API_MOCK_RUNTIME_CHANGED_EVENT,
  API_MOCK_STORAGE_KEY,
  API_MOCK_WORKSPACE_PERSISTED_EVENT,
  loadApiMockWorkspace,
  peekApiMockWorkspaceSnapshot,
  publishApiMockRuntimeChanged,
  publishApiMockWorkspace,
  resetApiMockWorkspaceSnapshot,
  saveApiMockWorkspace,
} from './apiMockPersistence';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';
import * as storage from '../../shared/utils/storage';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id: string, name: string, port: number): ApiMockServerDefinitionV1 {
  return {
    id, name, enabled: true, host: '127.0.0.1',
    port, basePath: '', folders: [], variables: [], samples: [],
    routes: [], settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
  };
}

describe('apiMockPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    resetApiMockWorkspaceSnapshot();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('round-trips servers through save and load', async () => {
    const servers = [makeServer('srv-1', 'Alpha', 4600), makeServer('srv-2', 'Beta', 4601)];
    await saveApiMockWorkspace({ servers, activeServerId: 'srv-2' });

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toHaveLength(2);
    expect(loaded.servers.map(s => s.name)).toEqual(['Alpha', 'Beta']);
    expect(loaded.activeServerId).toBe('srv-2');
    // No explicit open-tab list: every saved server is treated as open.
    expect(loaded.openTabIds).toEqual(['srv-1', 'srv-2']);
  });

  it('keeps a parked server in the library with no open tab', async () => {
    const servers = [makeServer('srv-1', 'Alpha', 4600), makeServer('srv-2', 'Beta', 4601)];
    await saveApiMockWorkspace({ servers, activeServerId: 'srv-1', openTabIds: ['srv-1'] });

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.id)).toEqual(['srv-1', 'srv-2']);
    expect(loaded.openTabIds).toEqual(['srv-1']);

    const raw = JSON.parse(localStorage.getItem(API_MOCK_STORAGE_KEY) as string);
    expect(raw.tabOrder).toEqual(['srv-1']);
  });

  it('round-trips a workspace where every tab was closed', async () => {
    await saveApiMockWorkspace({ servers: [makeServer('srv-1', 'Alpha', 4600)], openTabIds: [] });

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toHaveLength(1);
    expect(loaded.openTabIds).toEqual([]);
  });

  it('shows the saved-server landing when the stored workspace has no open tabs', async () => {
    await saveApiMockWorkspace({ servers: [makeServer('srv-1', 'Parked API', 4611)], openTabIds: [] });

    render(<ApiMockStudioPage />);

    await waitFor(() => expect(screen.getByTestId('api-mock-library-landing')).toBeTruthy());
    expect(screen.getByTestId('api-mock-library-row-srv-1')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-empty')).toBeNull();
  });

  it('preserves a route created inside a server', async () => {
    const server = makeServer('srv-1', 'Alpha', 4600);
    server.routes = [{
      id: 'route-1', name: 'Users', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/users' }, priority: 20,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
      tags: [], createdAt: ts, updatedAt: ts,
    }];
    await saveApiMockWorkspace({ servers: [server], activeServerId: 'srv-1' });

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers[0].routes).toHaveLength(1);
    expect(loaded.servers[0].routes[0].path.value).toBe('/users');
  });

  it('falls back to empty on corrupt storage', async () => {
    localStorage.setItem(API_MOCK_STORAGE_KEY, '{ not valid json');
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toEqual([]);
  });

  it('returns empty when nothing is stored', async () => {
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toEqual([]);
  });

  it('notifies same-tab listeners on save without a gallery replace', async () => {
    const persisted: Event[] = [];
    const replaced: Event[] = [];
    const onPersisted = (e: Event) => persisted.push(e);
    const onReplaced = (e: Event) => replaced.push(e);
    window.addEventListener(API_MOCK_WORKSPACE_PERSISTED_EVENT, onPersisted);
    window.addEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, onReplaced);

    await saveApiMockWorkspace({
      servers: [makeServer('srv-1', 'Alpha', 4600)],
      activeServerId: 'srv-1',
    });

    window.removeEventListener(API_MOCK_WORKSPACE_PERSISTED_EVENT, onPersisted);
    window.removeEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, onReplaced);

    expect(persisted).toHaveLength(1);
    expect((persisted[0] as CustomEvent).detail.servers[0].id).toBe('srv-1');
    expect(replaced).toHaveLength(0);
  });

  it('notifies same-tab listeners when Studio start/stop publishes', () => {
    const seen: Event[] = [];
    const onRuntime = (e: Event) => seen.push(e);
    window.addEventListener(API_MOCK_RUNTIME_CHANGED_EVENT, onRuntime);
    publishApiMockRuntimeChanged();
    window.removeEventListener(API_MOCK_RUNTIME_CHANGED_EVENT, onRuntime);
    expect(seen).toHaveLength(1);
  });

  it('serves an empty in-memory snapshot after delete-all even if disk still has servers', async () => {
    await saveApiMockWorkspace({
      servers: [makeServer('srv-1', 'Alpha', 4600)],
      activeServerId: 'srv-1',
    });
    publishApiMockWorkspace({ servers: [], activeServerId: undefined, openTabIds: [] });

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toEqual([]);
    expect(JSON.parse(localStorage.getItem(API_MOCK_STORAGE_KEY) as string).servers).toHaveLength(1);
    expect(peekApiMockWorkspaceSnapshot()?.servers).toEqual([]);
  });

  it('exposes the in-memory snapshot synchronously after save', async () => {
    expect(peekApiMockWorkspaceSnapshot()).toBeNull();
    await saveApiMockWorkspace({
      servers: [makeServer('srv-live', 'Cart API', 4601)],
      activeServerId: 'srv-live',
    });
    expect(peekApiMockWorkspaceSnapshot()?.servers.map(s => s.id)).toEqual(['srv-live']);
  });

  it('serves the in-memory snapshot after save even if disk is empty', async () => {
    await saveApiMockWorkspace({
      servers: [makeServer('srv-live', 'Live', 4500)],
      activeServerId: 'srv-live',
    });
    localStorage.removeItem(API_MOCK_STORAGE_KEY);

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.id)).toEqual(['srv-live']);
  });

  it('hydrates persisted servers into the page on mount', async () => {
    await saveApiMockWorkspace({ servers: [makeServer('srv-1', 'Persisted API', 4611)], activeServerId: 'srv-1' });

    render(<ApiMockStudioPage />);

    // Studio (not the empty state) appears once hydration completes.
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());
    expect(screen.getByText('Persisted API')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-empty')).toBeNull();
  });

  it('reloads a saved workspace from disk after the snapshot is cleared', async () => {
    await saveApiMockWorkspace({
      servers: [makeServer('srv-1', 'Alpha', 4600)],
      activeServerId: 'srv-1',
    });
    resetApiMockWorkspaceSnapshot();
    expect(peekApiMockWorkspaceSnapshot()).toBeNull();

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.id)).toEqual(['srv-1']);
    expect(peekApiMockWorkspaceSnapshot()?.servers.map(s => s.id)).toEqual(['srv-1']);
  });

  it('does not cache an empty disk workspace as the live snapshot', async () => {
    await saveApiMockWorkspace({ servers: [], openTabIds: [] });
    resetApiMockWorkspaceSnapshot();

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toEqual([]);
    expect(peekApiMockWorkspaceSnapshot()).toBeNull();
  });

  it('defaults open tabs from the server list when publish omits them', () => {
    publishApiMockWorkspace({
      servers: [makeServer('srv-1', 'Alpha', 4600)],
      activeServerId: 'srv-1',
    });
    expect(peekApiMockWorkspaceSnapshot()?.openTabIds).toEqual(['srv-1']);
  });

  it('returns empty when storage read throws', async () => {
    vi.spyOn(storage, 'readKey').mockRejectedValueOnce(new Error('idb down'));
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toEqual([]);
  });

  it('swallows a failed write so the session keeps the in-memory library', async () => {
    vi.spyOn(storage, 'writeKey').mockRejectedValueOnce(new Error('quota'));
    await expect(saveApiMockWorkspace({
      servers: [makeServer('srv-1', 'Alpha', 4600)],
      activeServerId: 'srv-1',
    })).resolves.toBeUndefined();
    expect(peekApiMockWorkspaceSnapshot()?.servers[0].id).toBe('srv-1');
  });

  it('skips same-tab events when window is missing', () => {
    vi.stubGlobal('window', undefined);
    expect(() => publishApiMockRuntimeChanged()).not.toThrow();
    expect(() => publishApiMockWorkspace({ servers: [] })).not.toThrow();
  });
});

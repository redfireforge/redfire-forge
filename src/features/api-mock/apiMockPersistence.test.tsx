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
import ApiMockSidebar from './components/ApiMockSidebar';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from './apiMockGalleryImport';
import {
  API_MOCK_RUNTIME_CHANGED_EVENT,
  API_MOCK_STORAGE_KEY,
  API_MOCK_USER_STASH_KEY,
  API_MOCK_DEMO_SESSION_KEY,
  API_MOCK_WORKSPACE_PERSISTED_EVENT,
  dropApiMockDemoLessonServers,
  beginApiMockDemoPersistence,
  isApiMockDemoPersistenceActive,
  loadApiMockWorkspace,
  peekApiMockWorkspaceSnapshot,
  publishApiMockRuntimeChanged,
  publishApiMockWorkspace,
  resetApiMockWorkspaceSnapshot,
  restoreApiMockUserWorkspace,
  resumeApiMockDemoPersistenceIfNeeded,
  rememberApiMockDemoImportedServer,
  saveApiMockWorkspace,
  stashApiMockUserWorkspaceIfNeeded,
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

    render(<><ApiMockStudioPage /><ApiMockSidebar /></>);

    await waitFor(() => expect(screen.getByTestId('api-mock-library-landing')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('api-mock-sidebar-item-srv-1')).toBeTruthy());
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

  it('does not cache an empty workspace loaded from disk', async () => {
    localStorage.setItem(API_MOCK_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      servers: [],
      tabOrder: [],
      openTabIds: [],
    }));
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toEqual([]);
    expect(peekApiMockWorkspaceSnapshot()).toBeNull();
  });

  it('publishes runtime changes safely when no window exists', () => {
    vi.stubGlobal('window', undefined);
    expect(() => publishApiMockRuntimeChanged()).not.toThrow();
  });

  it('drops an active id that is absent from the live server set', () => {
    const server = makeServer('srv-1', 'Alpha', 4600);
    expect(dropApiMockDemoLessonServers({
      servers: [server],
      activeServerId: 'missing',
      openTabIds: ['srv-1'],
    }).activeServerId).toBeUndefined();
  });

  it('keeps the user library on disk while a demo lesson writes its own session', async () => {
    const servers = [makeServer('srv-1', 'Alpha', 4600), makeServer('srv-2', 'Beta', 4601)];
    await saveApiMockWorkspace({ servers, activeServerId: 'srv-2', openTabIds: ['srv-1'] });

    await expect(beginApiMockDemoPersistence()).resolves.toBe(true);
    expect(isApiMockDemoPersistenceActive()).toBe(true);

    rememberApiMockDemoImportedServer('srv-demo');
    await saveApiMockWorkspace({
      servers: [...servers, makeServer('srv-demo', 'Lesson', 4602)],
      openTabIds: ['srv-demo'],
    });

    const userDisk = JSON.parse(localStorage.getItem(API_MOCK_STORAGE_KEY) as string);
    expect(userDisk.servers.map((s: { name: string }) => s.name)).toEqual(['Alpha', 'Beta']);
    expect(JSON.parse(localStorage.getItem(API_MOCK_DEMO_SESSION_KEY) as string).servers.map((s: { name: string }) => s.name))
      .toEqual(['Alpha', 'Beta', 'Lesson']);

    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect(isApiMockDemoPersistenceActive()).toBe(false);
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.name)).toEqual(['Alpha', 'Beta']);
    expect(loaded.openTabIds).toEqual([]);
    expect(localStorage.getItem(API_MOCK_USER_STASH_KEY)).toBeNull();
    expect(localStorage.getItem(API_MOCK_DEMO_SESSION_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(API_MOCK_STORAGE_KEY) as string).servers.map((s: { name: string }) => s.name))
      .toEqual(['Alpha', 'Beta']);
  });

  it('does not let a late demo autosave clobber the restored user library', async () => {
    const servers = [makeServer('srv-1', 'Alpha', 4600)];
    await saveApiMockWorkspace({ servers, activeServerId: 'srv-1' });
    await beginApiMockDemoPersistence();
    await saveApiMockWorkspace({ servers, openTabIds: [] });

    await restoreApiMockUserWorkspace();
    await saveApiMockWorkspace({ servers: [] }, { persistAs: 'demo' });

    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.name)).toEqual(['Alpha']);
    expect(JSON.parse(localStorage.getItem(API_MOCK_STORAGE_KEY) as string).servers[0].name).toBe('Alpha');
  });

  it('resumes from the demo session after reload, not the pre-demo stash', async () => {
    const alpha = makeServer('srv-1', 'Alpha', 4600);
    const beta = makeServer('srv-2', 'Beta', 4601);
    await saveApiMockWorkspace({ servers: [alpha, beta], activeServerId: 'srv-1' });
    await beginApiMockDemoPersistence();
    await saveApiMockWorkspace({ servers: [alpha], openTabIds: [] });
    resetApiMockWorkspaceSnapshot();

    await expect(resumeApiMockDemoPersistenceIfNeeded()).resolves.toBe(true);
    expect(isApiMockDemoPersistenceActive()).toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Alpha']);
    expect(JSON.parse(localStorage.getItem(API_MOCK_STORAGE_KEY) as string).servers.map((s: { name: string }) => s.name))
      .toEqual(['Alpha', 'Beta']);
  });

  it('does not resume demo persist mode when there is no stash', async () => {
    await expect(resumeApiMockDemoPersistenceIfNeeded()).resolves.toBe(false);
    expect(isApiMockDemoPersistenceActive()).toBe(false);
  });

  it('rehydrates an empty in-memory snapshot from the stash when a lesson starts', async () => {
    const servers = [makeServer('srv-1', 'Keep Me', 4600)];
    servers[0] = { ...servers[0], serverFolder: 'QA' };
    await saveApiMockWorkspace({ servers, activeServerId: 'srv-1' });
    await beginApiMockDemoPersistence();
    resetApiMockWorkspaceSnapshot();
    localStorage.removeItem(API_MOCK_DEMO_SESSION_KEY);
    localStorage.setItem(
      API_MOCK_USER_STASH_KEY,
      JSON.stringify({ servers, activeServerId: 'srv-1', openTabIds: ['srv-1'] }),
    );
    await expect(beginApiMockDemoPersistence()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Keep Me']);
    expect((await loadApiMockWorkspace()).servers[0].serverFolder).toBe('QA');
  });

  it('does not resurrect servers the user deleted when the lesson restarts', async () => {
    const alpha = makeServer('srv-1', 'Mock Server 1', 4800);
    const beta = makeServer('srv-2', 'Mock Server 2', 4801);
    const gamma = makeServer('srv-3', 'Mock Server 3', 4802);
    await saveApiMockWorkspace({ servers: [alpha, beta, gamma], activeServerId: 'srv-1' });
    await beginApiMockDemoPersistence();
    await saveApiMockWorkspace({ servers: [alpha], openTabIds: [] });

    await expect(beginApiMockDemoPersistence()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Mock Server 1']);

    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Mock Server 1']);
  });

  it('keeps a rename and folder from the live library when the lesson exits', async () => {
    const original = { ...makeServer('srv-1', 'Mock Server 1', 4600), serverFolder: 'Folder' };
    const sibling = makeServer('srv-2', 'Mock Server 2', 4601);
    await saveApiMockWorkspace({ servers: [original, sibling], activeServerId: 'srv-2' });
    await beginApiMockDemoPersistence();
    const renamed = { ...original, name: 'Test 1' };
    await saveApiMockWorkspace({ servers: [renamed, sibling], openTabIds: ['srv-2'] });

    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.name)).toEqual(['Test 1', 'Mock Server 2']);
    expect(loaded.servers[0].serverFolder).toBe('Folder');
  });

  it('keeps a folder and mock server the user created during the lesson', async () => {
    const existing = makeServer('srv-2', 'Mock Server 2', 4601);
    await saveApiMockWorkspace({ servers: [existing], activeServerId: 'srv-2' });
    await beginApiMockDemoPersistence();
    const created = { ...makeServer('srv-new', 'Mock Server 3', 4602), serverFolder: 'New Folder' };
    await saveApiMockWorkspace({ servers: [existing, created], openTabIds: ['srv-new'] });

    await expect(beginApiMockDemoPersistence()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Mock Server 2', 'Mock Server 3']);
    expect((await loadApiMockWorkspace()).servers[1].serverFolder).toBe('New Folder');

    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.name)).toEqual(['Mock Server 2', 'Mock Server 3']);
    expect(loaded.servers[1].serverFolder).toBe('New Folder');
  });

  it('drops tour Demo Mock Server artifacts and leftover untitled mocks on Exit, keeping Demo 1', async () => {
    const keep = { ...makeServer('srv-2', 'BBBbbb', 4602), serverFolder: 'Folder2' };
    const prior = makeServer('srv-keep', 'Demo 1', 4600);
    await saveApiMockWorkspace({ servers: [prior, keep], activeServerId: 'srv-keep' });
    await beginApiMockDemoPersistence();
    const tour = makeServer('srv-tour', 'Mock Server 4', 4601);
    const demo = makeServer('srv-demo', 'Demo Mock Server', 4603);
    await saveApiMockWorkspace({ servers: [prior, keep, tour, demo], openTabIds: ['srv-demo'] });

    expect(dropApiMockDemoLessonServers(await loadApiMockWorkspace()).servers.map(s => s.id))
      .toEqual(['srv-keep', 'srv-2']);

    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => ({ id: s.id, name: s.name }))).toEqual([
      { id: 'srv-keep', name: 'Demo 1' },
      { id: 'srv-2', name: 'BBBbbb' },
    ]);
  });

  it('honors deletes from the demo session when memory was cleared before Exit', async () => {
    const alpha = makeServer('srv-1', 'Alpha', 4600);
    const beta = makeServer('srv-2', 'Beta', 4601);
    await saveApiMockWorkspace({ servers: [alpha, beta], activeServerId: 'srv-1', openTabIds: ['srv-1'] });
    await beginApiMockDemoPersistence();
    await saveApiMockWorkspace({ servers: [alpha], openTabIds: [] });
    resetApiMockWorkspaceSnapshot();

    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Alpha']);
  });

  it('swallows stash shrink errors so a demo save still succeeds', async () => {
    const alpha = makeServer('srv-1', 'Alpha', 4600);
    const beta = makeServer('srv-2', 'Beta', 4601);
    await saveApiMockWorkspace({ servers: [alpha, beta], activeServerId: 'srv-1' });
    await beginApiMockDemoPersistence();
    const write = vi.spyOn(storage, 'writeKey').mockImplementation(async (key: string) => {
      if (key === API_MOCK_USER_STASH_KEY) throw new Error('quota');
    });
    await expect(saveApiMockWorkspace({ servers: [alpha], openTabIds: [] })).resolves.toBeUndefined();
    write.mockRestore();
  });

  it('stashes the user library once and restores it after a wipe', async () => {
    const servers = [makeServer('srv-1', 'Alpha', 4600), makeServer('srv-2', 'Beta', 4601)];
    await saveApiMockWorkspace({ servers, activeServerId: 'srv-2', openTabIds: ['srv-1'] });

    await expect(stashApiMockUserWorkspaceIfNeeded()).resolves.toBe(true);
    expect(localStorage.getItem(API_MOCK_USER_STASH_KEY)).toBeTruthy();

    rememberApiMockDemoImportedServer('srv-demo');
    await saveApiMockWorkspace({
      servers: [...servers, makeServer('srv-demo', 'Lesson', 4600)],
      openTabIds: ['srv-demo'],
    });
    await expect(stashApiMockUserWorkspaceIfNeeded()).resolves.toBe(true);
    const stashed = JSON.parse(localStorage.getItem(API_MOCK_USER_STASH_KEY) as string);
    expect(stashed.servers.map((s: { name: string }) => s.name)).toEqual(['Alpha', 'Beta']);

    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers.map(s => s.name)).toEqual(['Alpha', 'Beta']);
    expect(loaded.openTabIds).toEqual([]);
    expect(localStorage.getItem(API_MOCK_USER_STASH_KEY)).toBeNull();
  });

  it('captures an empty user library so a later demo corpus is not restored as theirs', async () => {
    await expect(stashApiMockUserWorkspaceIfNeeded()).resolves.toBe(true);
    rememberApiMockDemoImportedServer('srv-demo');
    await saveApiMockWorkspace({ servers: [makeServer('srv-demo', 'Lesson', 4600)] });
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    const loaded = await loadApiMockWorkspace();
    expect(loaded.servers).toEqual([]);
  });

  it('returns false when there is no stash to restore', async () => {
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(false);
  });

  it('captures no demo user ids when an existing stash is invalid', async () => {
    localStorage.setItem(API_MOCK_USER_STASH_KEY, '{ invalid stash');
    await expect(beginApiMockDemoPersistence()).resolves.toBe(true);
    expect(isApiMockDemoPersistenceActive()).toBe(true);
  });

  it('restores from a non-empty stash when no live workspace exists', async () => {
    const stashed = makeServer('stash-1', 'Stashed', 4620);
    localStorage.setItem(API_MOCK_USER_STASH_KEY, JSON.stringify({ servers: [stashed] }));
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Stashed']);
  });

  it('restores from the user storage key when stash is empty', async () => {
    const disk = makeServer('disk-1', 'Disk', 4621);
    localStorage.setItem(API_MOCK_USER_STASH_KEY, JSON.stringify({ servers: [] }));
    localStorage.setItem(API_MOCK_STORAGE_KEY, JSON.stringify({ servers: [disk] }));
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers.map(s => s.name)).toEqual(['Disk']);
  });

  it('restores an empty persisted fallback when stash and disk are both empty', async () => {
    localStorage.setItem(API_MOCK_USER_STASH_KEY, JSON.stringify({ servers: [] }));
    localStorage.setItem(API_MOCK_STORAGE_KEY, JSON.stringify({ servers: [] }));
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers).toEqual([]);
  });

  it('ignores a corrupt stash and still drops it', async () => {
    localStorage.setItem(API_MOCK_USER_STASH_KEY, '{ not json');
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(false);
    expect(localStorage.getItem(API_MOCK_USER_STASH_KEY)).toBeNull();
  });

  it('drops a stash that is not a persisted workspace', async () => {
    localStorage.setItem(API_MOCK_USER_STASH_KEY, JSON.stringify({ servers: 'nope' }));
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(false);
    expect(localStorage.getItem(API_MOCK_USER_STASH_KEY)).toBeNull();
  });

  it('migrates a workspace-shaped stash that has no servers array', async () => {
    localStorage.setItem(API_MOCK_USER_STASH_KEY, JSON.stringify({ schemaVersion: 1, tabOrder: [] }));
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(true);
    expect((await loadApiMockWorkspace()).servers).toEqual([]);
  });

  it('treats a Tauri-cleared empty stash key as absent', async () => {
    localStorage.setItem(API_MOCK_USER_STASH_KEY, '');
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(false);
    await expect(stashApiMockUserWorkspaceIfNeeded()).resolves.toBe(true);
    expect(localStorage.getItem(API_MOCK_USER_STASH_KEY)).toBeTruthy();
  });

  it('returns false when stash read or write throws', async () => {
    vi.spyOn(storage, 'readKey').mockRejectedValueOnce(new Error('idb'));
    await expect(stashApiMockUserWorkspaceIfNeeded()).resolves.toBe(false);
    vi.spyOn(storage, 'readKey').mockRejectedValueOnce(new Error('idb'));
    await expect(restoreApiMockUserWorkspace()).resolves.toBe(false);
  });

  it('returns false when resume cannot read the stash', async () => {
    vi.spyOn(storage, 'readKey').mockRejectedValueOnce(new Error('idb'));
    await expect(resumeApiMockDemoPersistenceIfNeeded()).resolves.toBe(false);
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

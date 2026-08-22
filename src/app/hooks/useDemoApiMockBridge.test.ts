/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const stop = vi.fn(async () => ({ ok: true }));
const list = vi.fn(async () => ({
  ok: true as const,
  data: [{ serverId: 'srv-1', port: 4600, state: 'running' as const, generation: 1 }],
}));
let tauri = false;
const makeServer = (over: Record<string, unknown> = {}) => ({
  id: 'srv-1', host: '127.0.0.1', port: 4600, basePath: '', settings: {}, ...over,
});
const load = vi.fn(async () => ({ servers: [makeServer()], activeServerId: 'srv-1' }));
const httpFetch = vi.fn(async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' }));
const save = vi.fn(async () => undefined);
const stash = vi.fn(async () => true);
const restoreUser = vi.fn(async () => false);
const resumeDemo = vi.fn(async () => false);
const dispatch = vi.fn();
const importGallery = vi.fn(async () => ({ server: { id: 'srv-g' }, sampleHash: 'h' }));

vi.mock('../../features/api-mock/apiMockControlClient', () => ({
  apiMockControlClient: {
    stop: (...args: unknown[]) => stop(...args),
    list: (...args: unknown[]) => list(...args),
  },
}));
vi.mock('../../shared/utils/platform', () => ({
  isTauri: () => tauri,
}));
vi.mock('../../features/api-mock/apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => load(...args),
  saveApiMockWorkspace: (...args: unknown[]) => save(...args),
  beginApiMockDemoPersistence: (...args: unknown[]) => stash(...args),
  stashApiMockUserWorkspaceIfNeeded: (...args: unknown[]) => stash(...args),
  resumeApiMockDemoPersistenceIfNeeded: (...args: unknown[]) => resumeDemo(...args),
  restoreApiMockUserWorkspace: (...args: unknown[]) => restoreUser(...args),
  rememberApiMockDemoImportedServer: vi.fn(),
  dropApiMockDemoLessonServers: (ws: { servers?: Array<{ id: string; name?: string }> }) => ({
    ...ws,
    servers: (ws.servers ?? []).filter(s => !/^Demo Mock Server(?: \d+)?$/.test(s.name ?? '')),
  }),
}));
vi.mock('../../features/api-mock/apiMockGalleryImport', () => ({
  API_MOCK_WORKSPACE_CHANGED_EVENT: 'api-mock:workspace-changed',
  dispatchApiMockWorkspaceChanged: (...args: unknown[]) => dispatch(...args),
  importApiMockGalleryServer: (...args: unknown[]) => importGallery(...args),
}));
vi.mock('../../shared/utils/httpClient', () => ({
  httpFetch: (...args: unknown[]) => httpFetch(...(args as [])),
}));
vi.mock('../../data/galleries/api-mock', () => ({
  apiMockSampleCatalog: [
    { id: 'am-gallery-health', factory: () => ({ id: 'health' }) },
    { id: 'am-gallery-store', factory: () => ({ id: 'store' }) },
    { id: 'am-gallery-paths', factory: () => ({ id: 'paths' }) },
    { id: 'am-gallery-bodies', factory: () => ({ id: 'bodies' }) },
    { id: 'am-gallery-formats', factory: () => ({ id: 'formats' }) },
    { id: 'am-gallery-selection', factory: () => ({ id: 'selection' }) },
    { id: 'am-gallery-overlaps', factory: () => ({ id: 'overlaps' }) },
    { id: 'am-gallery-response', factory: () => ({ id: 'response' }) },
    { id: 'am-gallery-templating', factory: () => ({ id: 'templating' }) },
  ],
}));

describe('useDemoApiMockBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauri = false;
    stash.mockResolvedValue(true);
    resumeDemo.mockResolvedValue(false);
    restoreUser.mockResolvedValue(false);
    list.mockResolvedValue({
      ok: true,
      data: [{ serverId: 'srv-1', port: 4600, state: 'running', generation: 1 }],
    });
    delete (window as unknown as Record<string, unknown>).__demoWipeApiMockWorkspace;
    delete (window as unknown as Record<string, unknown>).__demoRestoreApiMockUserWorkspace;
    delete (window as unknown as Record<string, unknown>).__demoListApiMockServers;
    delete (window as unknown as Record<string, unknown>).__demoImportApiMockGallerySample;
    delete (window as unknown as Record<string, unknown>).__demoEnsureBlankApiMockServer;
  });

  afterEach(() => {
    sessionStorage.removeItem('redfire-demo-live-session-v1');
    delete (window as unknown as Record<string, unknown>).__demoWipeApiMockWorkspace;
    delete (window as unknown as Record<string, unknown>).__demoRestoreApiMockUserWorkspace;
    delete (window as unknown as Record<string, unknown>).__demoListApiMockServers;
    delete (window as unknown as Record<string, unknown>).__demoImportApiMockGallerySample;
    delete (window as unknown as Record<string, unknown>).__demoEnsureBlankApiMockServer;
  });

  it('does not mount when disabled', async () => {
    const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
    renderHook(() => useDemoApiMockBridge(false));
    expect((window as unknown as Record<string, unknown>).__demoWipeApiMockWorkspace).toBeUndefined();
  });

  it('mounts wipe and gallery import helpers', async () => {
    const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
    const { unmount } = renderHook(() => useDemoApiMockBridge(true));
    const wipe = (window as unknown as { __demoWipeApiMockWorkspace: () => Promise<boolean> })
      .__demoWipeApiMockWorkspace;
    const importSample = (window as unknown as {
      __demoImportApiMockGallerySample: (id: string) => Promise<boolean>;
    }).__demoImportApiMockGallerySample;
    expect(wipe).toBeTypeOf('function');
    expect((window as unknown as Record<string, unknown>).__demoListApiMockServers).toBeTypeOf('function');
    expect(importSample).toBeTypeOf('function');
    await expect(wipe()).resolves.toBe(true);
    expect(stash).toHaveBeenCalled();
    expect(stop).toHaveBeenCalledWith('srv-1');
    await expect(importSample('am-gallery-health')).resolves.toBe(true);
    expect(importGallery).toHaveBeenCalled();
    await expect(importSample('am-gallery-store')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'store' }, 'am-gallery-store');
    await expect(importSample('am-gallery-paths')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'paths' }, 'am-gallery-paths');
    await expect(importSample('am-gallery-bodies')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'bodies' }, 'am-gallery-bodies');
    await expect(importSample('am-gallery-formats')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'formats' }, 'am-gallery-formats');
    await expect(importSample('am-gallery-selection')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'selection' }, 'am-gallery-selection');
    await expect(importSample('am-gallery-overlaps')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'overlaps' }, 'am-gallery-overlaps');
    await expect(importSample('am-gallery-response')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'response' }, 'am-gallery-response');
    await expect(importSample('am-gallery-templating')).resolves.toBe(true);
    expect(importGallery).toHaveBeenLastCalledWith({ id: 'templating' }, 'am-gallery-templating');
    expect(stash).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith({
      servers: [expect.objectContaining({ id: 'srv-1' })],
      activeServerId: undefined,
      openTabIds: [],
    });
    await expect(importSample('unknown-sample')).resolves.toBe(false);
    unmount();
    expect((window as unknown as Record<string, unknown>).__demoWipeApiMockWorkspace).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoListApiMockServers).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoEnsureBlankApiMockServer).toBeUndefined();
  });

  it('lists remapped Studio servers with the active flag', async () => {
    load.mockResolvedValueOnce({
      servers: [makeServer({ id: 'srv-live', name: 'Cart API', port: 4601 })],
      activeServerId: 'srv-live',
    });
    const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
    const { unmount } = renderHook(() => useDemoApiMockBridge(true));
    const listServers = (window as unknown as {
      __demoListApiMockServers: () => Promise<Array<{ id: string; name: string; port: number; active: boolean }>>;
    }).__demoListApiMockServers;
    await expect(listServers()).resolves.toEqual([
      { id: 'srv-live', name: 'Cart API', port: 4601, active: true },
    ]);
    unmount();
  });

  it('returns an empty Studio list when load fails', async () => {
    load.mockRejectedValueOnce(new Error('disk'));
    const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
    const { unmount } = renderHook(() => useDemoApiMockBridge(true));
    const listServers = (window as unknown as {
      __demoListApiMockServers: () => Promise<Array<{ id: string }>>;
    }).__demoListApiMockServers;
    await expect(listServers()).resolves.toEqual([]);
    unmount();
  });

  describe('__demoEnsureBlankApiMockServer', () => {
    const mountBlank = async () => {
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      const ensure = (window as unknown as { __demoEnsureBlankApiMockServer: () => Promise<boolean> })
        .__demoEnsureBlankApiMockServer;
      return { ensure, unmount };
    };

    it('no-ops when a blank demo server is already the active open tab', async () => {
      load.mockResolvedValueOnce({
        servers: [makeServer({ id: 'srv-blank', name: 'Demo Mock Server' })],
        activeServerId: 'srv-blank',
        openTabIds: ['srv-blank'],
      });
      const { ensure, unmount } = await mountBlank();
      await expect(ensure()).resolves.toBe(true);
      expect(importGallery).not.toHaveBeenCalled();
      unmount();
    });

    it('imports a blank server when user servers are parked after wipe', async () => {
      // After wipeApiMockWorkspace, user servers remain but openTabIds is cleared.
      // The old `servers.length > 0` guard fired here — the new guard skips correctly.
      load.mockResolvedValueOnce({ servers: [makeServer()], activeServerId: undefined, openTabIds: [] });
      const { ensure, unmount } = await mountBlank();
      await expect(ensure()).resolves.toBe(true);
      expect(importGallery).toHaveBeenCalled();
      unmount();
    });

    it('imports an empty server when the workspace is empty', async () => {
      load.mockResolvedValueOnce({ servers: [], activeServerId: undefined, openTabIds: [] });
      const { ensure, unmount } = await mountBlank();
      await expect(ensure()).resolves.toBe(true);
      expect(importGallery).toHaveBeenCalled();
      expect(importGallery.mock.calls[0][0]).toMatchObject({ name: 'Demo Mock Server', routes: [] });
      expect(importGallery.mock.calls[0][1]).toBe('am-demo-blank');
      unmount();
    });

    it('returns false when gallery import throws', async () => {
      load.mockResolvedValueOnce({ servers: [], activeServerId: undefined });
      importGallery.mockRejectedValueOnce(new Error('no port'));
      const { ensure, unmount } = await mountBlank();
      await expect(ensure()).resolves.toBe(false);
      unmount();
    });
  });

  describe('wipe skips parked servers', () => {
    const mountWipe = async () => {
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      const wipe = (window as unknown as { __demoWipeApiMockWorkspace: () => Promise<boolean> })
        .__demoWipeApiMockWorkspace;
      return { wipe, unmount };
    };

    it('does not empty the workspace when demo isolation fails', async () => {
      stash.mockResolvedValueOnce(false);
      const { wipe, unmount } = await mountWipe();
      await expect(wipe()).resolves.toBe(false);
      expect(save).not.toHaveBeenCalled();
      unmount();
    });

    it('parks open tabs but keeps foldered mock servers in the library', async () => {
      load.mockResolvedValueOnce({
        servers: [makeServer({ id: 'srv-keep', name: 'Keep Me', serverFolder: 'QA' })],
        activeServerId: 'srv-keep',
        openTabIds: ['srv-keep'],
      });
      const { wipe, unmount } = await mountWipe();
      await expect(wipe()).resolves.toBe(true);
      expect(save).toHaveBeenCalledWith({
        servers: [expect.objectContaining({ id: 'srv-keep', name: 'Keep Me', serverFolder: 'QA' })],
        activeServerId: undefined,
        openTabIds: [],
      });
      expect(dispatch).toHaveBeenCalledWith({
        servers: [expect.objectContaining({ id: 'srv-keep', name: 'Keep Me', serverFolder: 'QA' })],
        activeServerId: undefined,
        openTabIds: [],
      });
      unmount();
    });

    it('drops Demo Mock Server lesson artifacts and keeps a user server named Demo 1', async () => {
      load.mockResolvedValueOnce({
        servers: [
          makeServer({ id: 'srv-keep', name: 'Demo 1', serverFolder: 'Folder' }),
          makeServer({ id: 'srv-demo', name: 'Demo Mock Server' }),
        ],
        activeServerId: 'srv-demo',
        openTabIds: ['srv-demo'],
      });
      const { wipe, unmount } = await mountWipe();
      await expect(wipe()).resolves.toBe(true);
      expect(save).toHaveBeenCalledWith({
        servers: [expect.objectContaining({ id: 'srv-keep', name: 'Demo 1' })],
        activeServerId: undefined,
        openTabIds: [],
      });
      unmount();
    });

    it('does not POST stop when the companion pool has no running listeners', async () => {
      list.mockResolvedValueOnce({ ok: true, data: [] });
      const { wipe, unmount } = await mountWipe();
      await expect(wipe()).resolves.toBe(true);
      expect(stop).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledWith({
        servers: [expect.objectContaining({ id: 'srv-1' })],
        activeServerId: undefined,
        openTabIds: [],
      });
      unmount();
    });

    it('stops running pool listeners even when they are not in the saved workspace', async () => {
      list.mockResolvedValueOnce({
        ok: true,
        data: [{ serverId: 'srv-orphan', port: 4610, state: 'running', generation: 2 }],
      });
      const { wipe, unmount } = await mountWipe();
      await expect(wipe()).resolves.toBe(true);
      expect(stop).toHaveBeenCalledWith('srv-orphan');
      expect(stop).not.toHaveBeenCalledWith('srv-1');
      expect(save.mock.invocationCallOrder[0]).toBeLessThan(stop.mock.invocationCallOrder[0]);
      expect(dispatch.mock.invocationCallOrder[0]).toBeLessThan(stop.mock.invocationCallOrder[0]);
      unmount();
    });

    it('skips HTTP stop when the companion list fails', async () => {
      list.mockResolvedValueOnce({ ok: false, error: { code: 'COMPANION_UNAVAILABLE' } });
      const { wipe, unmount } = await mountWipe();
      await expect(wipe()).resolves.toBe(true);
      expect(stop).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledWith({
        servers: [expect.objectContaining({ id: 'srv-1' })],
        activeServerId: undefined,
        openTabIds: [],
      });
      unmount();
    });

    it('falls back to saved ids on Tauri when list is an empty stub', async () => {
      tauri = true;
      list.mockResolvedValueOnce({ ok: true, data: [] });
      const { wipe, unmount } = await mountWipe();
      await expect(wipe()).resolves.toBe(true);
      expect(stop).toHaveBeenCalledWith('srv-1');
      unmount();
    });
  });

  describe('__demoSendApiMockRequest', () => {
    type Send = (req?: {
      path?: string; method?: string; headers?: Record<string, string>; body?: string; serverId?: string;
      timeoutMs?: number;
    }) => Promise<{ status: number; body: string } | null>;

    const mountSend = async (): Promise<{ send: Send; unmount: () => void }> => {
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      return { send: (window as unknown as { __demoSendApiMockRequest: Send }).__demoSendApiMockRequest, unmount };
    };

    it('sends to the active server and returns status + body', async () => {
      const { send, unmount } = await mountSend();
      await expect(send({ path: '/health' })).resolves.toEqual({ status: 200, body: '{"ok":true}' });
      expect(httpFetch).toHaveBeenCalledWith('http://127.0.0.1:4600/health', 'GET', {}, undefined);
      unmount();
      expect((window as unknown as Record<string, unknown>).__demoSendApiMockRequest).toBeUndefined();
    });

    it('defaults to GET / when no request is given', async () => {
      const { send } = await mountSend();
      await send();
      expect(httpFetch).toHaveBeenCalledWith('http://127.0.0.1:4600/', 'GET', {}, undefined);
    });

    it('prefixes basePath, honours TLS scheme, and forwards method/headers/body', async () => {
      load.mockResolvedValueOnce({
        servers: [makeServer({ basePath: '/api/v1', settings: { tls: { enabled: true } } })],
        activeServerId: 'srv-1',
      });
      const { send } = await mountSend();
      await send({ path: '/orders', method: 'POST', headers: { 'X-Trace': 'abc' }, body: '{"id":1}' });
      expect(httpFetch).toHaveBeenCalledWith(
        'https://127.0.0.1:4600/api/v1/orders', 'POST', { 'X-Trace': 'abc' }, '{"id":1}',
      );
    });

    it('targets an explicit serverId over the active server', async () => {
      load.mockResolvedValueOnce({
        servers: [makeServer(), makeServer({ id: 'srv-2', port: 4601 })],
        activeServerId: 'srv-1',
      });
      const { send } = await mountSend();
      await send({ path: '/health', serverId: 'srv-2' });
      expect(httpFetch).toHaveBeenCalledWith('http://127.0.0.1:4601/health', 'GET', {}, undefined);
    });

    it('returns null when the workspace has no servers', async () => {
      load.mockResolvedValueOnce({ servers: [], activeServerId: undefined });
      const { send } = await mountSend();
      await expect(send({ path: '/health' })).resolves.toBeNull();
      expect(httpFetch).not.toHaveBeenCalled();
    });

    it('returns null when the transport throws', async () => {
      httpFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const { send } = await mountSend();
      await expect(send({ path: '/health' })).resolves.toBeNull();
    });

    it('forwards timeoutMs as an AbortSignal', async () => {
      httpFetch.mockResolvedValueOnce({ status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' });
      const { send } = await mountSend();
      await expect(send({ path: '/payments', method: 'POST', timeoutMs: 20 })).resolves.toEqual({
        status: 0,
        body: '',
      });
      expect(httpFetch.mock.calls[0]?.[4]).toBeInstanceOf(AbortSignal);
    });
  });

  describe('__demoSeedApiMockExportSecrets', () => {
    it('patches the active server with a TLS key and a sensitive variable', async () => {
      load.mockResolvedValueOnce({
        servers: [makeServer({ variables: [], settings: { selection: {} } })],
        activeServerId: 'srv-1',
      });
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      const seed = (window as unknown as { __demoSeedApiMockExportSecrets: () => Promise<boolean> })
        .__demoSeedApiMockExportSecrets;
      await expect(seed()).resolves.toBe(true);
      expect(save).toHaveBeenCalled();
      const patched = save.mock.calls.at(-1)?.[0] as {
        servers: Array<{ settings: { tls: { keyPem: string } }; variables: Array<{ key: string; sensitive: boolean }> }>;
      };
      expect(patched.servers[0].settings.tls.keyPem).toContain('AM16-SUPER-SECRET-KEY');
      expect(patched.servers[0].variables.some(v => v.key === 'apiToken' && v.sensitive)).toBe(true);
      expect(dispatch).toHaveBeenCalled();
      unmount();
    });

    it('returns false when the workspace has no servers', async () => {
      load.mockResolvedValueOnce({ servers: [], activeServerId: undefined });
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      const seed = (window as unknown as { __demoSeedApiMockExportSecrets: () => Promise<boolean> })
        .__demoSeedApiMockExportSecrets;
      await expect(seed()).resolves.toBe(false);
      unmount();
    });
  });

  describe('user library stash / restore', () => {
    it('restores the stashed library and dispatches workspace-changed', async () => {
      restoreUser.mockResolvedValue(true);
      load.mockResolvedValueOnce({
        servers: [makeServer({ name: 'Mine' })],
        activeServerId: 'srv-1',
      });
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      const restore = (window as unknown as { __demoRestoreApiMockUserWorkspace: () => Promise<boolean> })
        .__demoRestoreApiMockUserWorkspace;
      await expect(restore()).resolves.toBe(true);
      expect(restoreUser).toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalled();
      unmount();
      expect((window as unknown as Record<string, unknown>).__demoRestoreApiMockUserWorkspace).toBeUndefined();
    });

    it('returns false when there is no stash without dispatching', async () => {
      restoreUser.mockResolvedValue(false);
      dispatch.mockClear();
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      const restore = (window as unknown as { __demoRestoreApiMockUserWorkspace: () => Promise<boolean> })
        .__demoRestoreApiMockUserWorkspace;
      await expect(restore()).resolves.toBe(false);
      expect(dispatch).not.toHaveBeenCalled();
      unmount();
    });

    it('returns false when restore throws', async () => {
      restoreUser.mockRejectedValueOnce(new Error('idb'));
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      const restore = (window as unknown as { __demoRestoreApiMockUserWorkspace: () => Promise<boolean> })
        .__demoRestoreApiMockUserWorkspace;
      await expect(restore()).resolves.toBe(false);
      unmount();
    });

    it('skips idle restore and resumes demo persist while a live demo session is active', async () => {
      sessionStorage.setItem('redfire-demo-live-session-v1', JSON.stringify({ lessonId: 'am-01-studio-tour' }));
      restoreUser.mockClear();
      resumeDemo.mockResolvedValue(true);
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      await Promise.resolve();
      expect(restoreUser).not.toHaveBeenCalled();
      expect(resumeDemo).toHaveBeenCalled();
      unmount();
    });

    it('treats sessionStorage errors as idle and attempts restore', async () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      restoreUser.mockClear();
      const { useDemoApiMockBridge } = await import('./useDemoApiMockBridge');
      const { unmount } = renderHook(() => useDemoApiMockBridge(true));
      await Promise.resolve();
      expect(restoreUser).toHaveBeenCalled();
      unmount();
      getItem.mockRestore();
    });
  });
});

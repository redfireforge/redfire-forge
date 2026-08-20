/**
 * Demo-player bridge for API Mock Studio.
 * Mounts `window.__demo*` helpers so lessons can wipe/import workspace quietly.
 */
import { useEffect, useLayoutEffect } from 'react';
import { apiMockSampleCatalog } from '../../data/galleries/api-mock';
import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';
import { mockClientOrigin } from '../../shared/api-mock/harExport';
import { httpFetch } from '../../shared/utils/httpClient';
import { apiMockControlClient } from '../../features/api-mock/apiMockControlClient';
import {
  API_MOCK_WORKSPACE_CHANGED_EVENT,
  dispatchApiMockWorkspaceChanged,
  importApiMockGalleryServer,
} from '../../features/api-mock/apiMockGalleryImport';
import { loadApiMockWorkspace, saveApiMockWorkspace } from '../../features/api-mock/apiMockPersistence';
import { DEFAULT_SETTINGS } from '../../shared/api-mock/defaults';
import { isTauri } from '../../shared/utils/platform';

const EMPTY_WORKSPACE = { servers: [] as ApiMockServerDefinitionV1[], activeServerId: undefined, openTabIds: [] as string[] };

type DemoBridgeWindow = Record<string, unknown>;

async function resolveGalleryFactory(
  sampleId: string,
): Promise<(() => ApiMockServerDefinitionV1) | undefined> {
  return apiMockSampleCatalog.find(entry => entry.id === sampleId)?.factory;
}

async function wipeWorkspace(): Promise<boolean> {
  try {
    const ws = await loadApiMockWorkspace();
    // Only POST /stop for listeners that are actually running. Parked / never-started
    // saved servers 404 on the companion, which Chrome logs as a failed request.
    const listed = await apiMockControlClient.list();
    const runningIds = listed.ok
      ? listed.data.filter(row => row.state === 'running').map(row => row.serverId)
      : [];
    // Web: never POST /stop for parked ids (404). Tauri list() is a stub, so
    // fall back to saved ids. Companion down / timed-out list → skip HTTP stop.
    const idsToStop = runningIds.length > 0
      ? runningIds
      : (isTauri() ? ws.servers.map(s => s.id) : []);
    // Clear the studio first so journal/state polling stops before /stop 404s.
    await saveApiMockWorkspace(EMPTY_WORKSPACE);
    dispatchApiMockWorkspaceChanged(EMPTY_WORKSPACE);
    for (const id of idsToStop) {
      try {
        await apiMockControlClient.stop(id);
      } catch {
        // Best-effort stop — port may already be free.
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function importGallerySample(sampleId: string): Promise<boolean> {
  const factory = await resolveGalleryFactory(sampleId);
  if (!factory) {
    console.warn('[api-mock demo] unknown gallery sample', sampleId);
    return false;
  }
  try {
    // Lesson boot must not inherit parked tabs — 8 open tabs reject gallery import.
    await saveApiMockWorkspace(EMPTY_WORKSPACE);
    await importApiMockGalleryServer(factory(), sampleId);
    return true;
  } catch (error) {
    console.warn('[api-mock demo] gallery import failed', sampleId, error);
    return false;
  }
}

function blankServerTemplate(): ApiMockServerDefinitionV1 {
  const now = new Date().toISOString();
  return {
    id: 'srv-blank',
    name: 'Import sandbox',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: now,
    updatedAt: now,
  };
}

/** Open an empty mock server when the workspace has none — import lessons start from nothing. */
async function ensureBlankApiMockServer(): Promise<boolean> {
  try {
    const ws = await loadApiMockWorkspace();
    if (ws.servers.length > 0) return true;
    await importApiMockGalleryServer(blankServerTemplate(), 'am-demo-blank');
    return true;
  } catch (error) {
    console.warn('[api-mock demo] blank server create failed', error);
    return false;
  }
}

const AM16_DEMO_CERT = '-----BEGIN CERTIFICATE-----\nAM16-DEMO-CERT\n-----END CERTIFICATE-----';
const AM16_DEMO_KEY = '-----BEGIN PRIVATE KEY-----\nAM16-SUPER-SECRET-KEY\n-----END PRIVATE KEY-----';
const AM16_SECRET_TOKEN = 'super-secret-token';

/**
 * Quiet corpus for the export lesson: a TLS private key and a sensitive
 * variable so redaction has something to strip. Does not enable HTTPS.
 */
async function seedExportSecrets(): Promise<boolean> {
  try {
    const ws = await loadApiMockWorkspace();
    const server = ws.servers.find(s => s.id === ws.activeServerId) ?? ws.servers[0];
    if (!server) return false;
    const now = new Date().toISOString();
    const next: ApiMockServerDefinitionV1 = {
      ...server,
      variables: [
        ...(server.variables ?? []).filter(v => v.key !== 'apiToken'),
        { id: 'var-am16-secret', key: 'apiToken', value: AM16_SECRET_TOKEN, sensitive: true },
      ],
      settings: {
        ...server.settings,
        tls: {
          enabled: false,
          certPem: AM16_DEMO_CERT,
          keyPem: AM16_DEMO_KEY,
        },
      },
      updatedAt: now,
    };
    const servers = ws.servers.map(s => s.id === next.id ? next : s);
    const patched = { ...ws, servers };
    await saveApiMockWorkspace(patched);
    dispatchApiMockWorkspaceChanged(patched);
    return true;
  } catch (error) {
    console.warn('[api-mock demo] export secret seed failed', error);
    return false;
  }
}

/**
 * Send real traffic to a running mock from inside the app.
 * Web routes through the Vite `/__proxy` middleware, so the lesson reads a real
 * status even though mock CORS is off by default; Tauri uses the native client.
 */
async function sendMockRequest(req: {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  serverId?: string;
  timeoutMs?: number;
} = {}): Promise<{ status: number; body: string } | null> {
  const controller = req.timeoutMs != null && req.timeoutMs > 0 ? new AbortController() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (controller && req.timeoutMs) {
    timer = setTimeout(() => controller.abort(), req.timeoutMs);
  }
  try {
    const ws = await loadApiMockWorkspace();
    const server = req.serverId
      ? ws.servers.find(s => s.id === req.serverId)
      : ws.servers.find(s => s.id === ws.activeServerId) ?? ws.servers[0];
    if (!server) return null;
    const origin = mockClientOrigin(server.host, server.port, Boolean(server.settings.tls?.enabled));
    const url = `${origin}${server.basePath ?? ''}${req.path ?? '/'}`;
    const res = controller
      ? await httpFetch(url, req.method ?? 'GET', req.headers ?? {}, req.body, controller.signal)
      : await httpFetch(url, req.method ?? 'GET', req.headers ?? {}, req.body);
    return { status: res.status, body: res.body };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function listStudioServers(): Promise<Array<{
  id: string;
  name: string;
  port: number;
  active: boolean;
}>> {
  try {
    const ws = await loadApiMockWorkspace();
    return ws.servers.map(s => ({
      id: s.id,
      name: s.name,
      port: s.port,
      active: s.id === ws.activeServerId,
    }));
  } catch {
    return [];
  }
}

function bindDemoApiMockBridge(win: DemoBridgeWindow): void {
  win.__demoWipeApiMockWorkspace = wipeWorkspace;
  win.__demoListApiMockServers = listStudioServers;
  win.__demoImportApiMockGallerySample = importGallerySample;
  win.__demoEnsureBlankApiMockServer = ensureBlankApiMockServer;
  win.__demoSeedApiMockExportSecrets = seedExportSecrets;
  win.__demoSendApiMockRequest = sendMockRequest;
  win.__demoApiMockWorkspaceChangedEvent = API_MOCK_WORKSPACE_CHANGED_EVENT;
}

function unbindDemoApiMockBridge(win: DemoBridgeWindow): void {
  delete win.__demoWipeApiMockWorkspace;
  delete win.__demoListApiMockServers;
  delete win.__demoImportApiMockGallerySample;
  delete win.__demoEnsureBlankApiMockServer;
  delete win.__demoSeedApiMockExportSecrets;
  delete win.__demoSendApiMockRequest;
  delete win.__demoApiMockWorkspaceChangedEvent;
}

export function useDemoApiMockBridge(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const win = window as unknown as DemoBridgeWindow;
    bindDemoApiMockBridge(win);
    return () => unbindDemoApiMockBridge(win);
  }, [enabled]);

  // Intentionally no deps: Fast Refresh may skip the [enabled] effect when this
  // module is replaced, leaving window.__demo* pointing at the previous evaluation.
  useLayoutEffect(() => {
    if (!enabled) return;
    const win = window as unknown as DemoBridgeWindow;
    if (typeof win.__demoImportApiMockGallerySample !== 'function') return;
    bindDemoApiMockBridge(win);
  });
}

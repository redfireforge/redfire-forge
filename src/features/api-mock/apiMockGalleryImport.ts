/**
 * Gallery → API Mock Studio import bridge.
 *
 * Persists a remapped server into the workspace, records the sample hash for
 * "Loaded" badges, and notifies a mounted Studio page to reload.
 */
import type {
  ApiMockPredicateGroupV1,
  ApiMockServerDefinitionV1,
} from '../../shared/api-mock/contracts';
import { gallerySampleHash } from '../../shared/utils/gallerySampleHash';
import { readKey, writeKey } from '../../shared/utils/storage';
import { apiMockControlClient } from './apiMockControlClient';
import { API_MOCK_MAX_TABS } from './apiMockPageHelpers';
import { loadApiMockWorkspace, saveApiMockWorkspace } from './apiMockPersistence';

export const API_MOCK_GALLERY_IMPORTS_KEY = 'api-mock-gallery-imports-v1';
export const API_MOCK_WORKSPACE_CHANGED_EVENT = 'api-mock:workspace-changed';

function shortId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function remapPredicateGroup(
  group: ApiMockPredicateGroupV1,
  mapId: (old: string, prefix: string) => string,
): ApiMockPredicateGroupV1 {
  return {
    ...group,
    id: mapId(group.id || shortId('pg'), 'pg'),
    children: group.children.map(c => ({
      ...c,
      id: mapId(c.id, 'pred'),
    })),
  };
}

/** Deep-clone a gallery template with fresh entity ids and the given listen port. */
export function cloneServerForGalleryImport(
  template: ApiMockServerDefinitionV1,
  port: number,
): ApiMockServerDefinitionV1 {
  const raw = structuredClone(template);
  const idMap = new Map<string, string>();
  const mapId = (old: string, prefix: string) => {
    const existing = idMap.get(old);
    if (existing) return existing;
    const next = shortId(prefix);
    idMap.set(old, next);
    return next;
  };

  const folderIdByOld = new Map<string, string>();
  for (const f of raw.folders ?? []) {
    folderIdByOld.set(f.id, mapId(f.id, 'fld'));
  }
  const folders = (raw.folders ?? []).map(f => ({
    ...f,
    id: folderIdByOld.get(f.id)!,
    parentId: f.parentId ? folderIdByOld.get(f.parentId) : undefined,
  }));

  const routes = raw.routes.map(route => {
    const newRouteId = mapId(route.id, 'route');
    return {
      ...route,
      id: newRouteId,
      folderId: route.folderId ? folderIdByOld.get(route.folderId) : undefined,
      predicates: remapPredicateGroup(route.predicates, mapId),
      responses: route.responses.map(resp => ({
        ...resp,
        id: mapId(resp.id, 'resp'),
        conditions: resp.conditions ? remapPredicateGroup(resp.conditions, mapId) : undefined,
      })),
    };
  });

  const samples = (raw.samples ?? []).map(sample => ({
    ...sample,
    id: mapId(sample.id, 'sample'),
    routeId: sample.routeId ? (idMap.get(sample.routeId) ?? sample.routeId) : sample.routeId,
    expected: sample.expected
      ? {
          ...sample.expected,
          routeId: sample.expected.routeId
            ? (idMap.get(sample.expected.routeId) ?? sample.expected.routeId)
            : sample.expected.routeId,
          responseId: sample.expected.responseId
            ? (idMap.get(sample.expected.responseId) ?? sample.expected.responseId)
            : sample.expected.responseId,
        }
      : sample.expected,
  }));

  const now = new Date().toISOString();
  return {
    ...raw,
    id: mapId(raw.id, 'srv'),
    port,
    folders,
    routes,
    samples,
    variables: (raw.variables ?? []).map(v => ({ ...v, id: mapId(v.id, 'var') })),
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadGalleryImportTracking(): Promise<Record<string, string>> {
  try {
    const raw = await readKey(API_MOCK_GALLERY_IMPORTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export async function markGallerySampleImported(sampleId: string, hash: string): Promise<void> {
  const current = await loadGalleryImportTracking();
  current[sampleId] = hash;
  await writeKey(API_MOCK_GALLERY_IMPORTS_KEY, JSON.stringify(current), { notifyOnQuotaExhausted: false });
}

export interface ApiMockWorkspaceChangedDetail {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
}

export function dispatchApiMockWorkspaceChanged(detail: ApiMockWorkspaceChangedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_CHANGED_EVENT, { detail }));
}

export interface GalleryImportResult {
  server: ApiMockServerDefinitionV1;
  sampleHash: string;
}

/**
 * Append a gallery mock server to the persisted workspace and notify Studio.
 */
export async function importApiMockGalleryServer(
  template: ApiMockServerDefinitionV1,
  sampleId: string,
): Promise<GalleryImportResult> {
  const sampleHash = gallerySampleHash(template);
  const ws = await loadApiMockWorkspace();
  if (ws.servers.length >= API_MOCK_MAX_TABS) {
    throw new Error(`You can have at most ${API_MOCK_MAX_TABS} mock servers open. Close a tab before importing another gallery sample.`);
  }
  const portRes = await apiMockControlClient.nextAutoPort(ws.servers.map(s => s.port));
  if (!portRes.ok) {
    throw new Error(portRes.error.message || 'No available mock port in 4600–4699.');
  }
  const server = cloneServerForGalleryImport(template, portRes.data.port);
  const servers = [...ws.servers, server];
  const next = { servers, activeServerId: server.id };
  await saveApiMockWorkspace(next);
  await markGallerySampleImported(sampleId, sampleHash);
  dispatchApiMockWorkspaceChanged(next);
  return { server, sampleHash };
}

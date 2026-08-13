import type { ApiMockRouteV1, ApiMockServerDefinitionV1, ApiMockSimulationSampleV1 } from '../../shared/api-mock/contracts';
import { AUTO_PORT_RANGE, HARD_CEILINGS } from '../../shared/api-mock/defaults';
import { stripCapturedRequestSecrets } from '../../shared/api-mock/harExport';
import type { ApiMockRuntimeStatus } from './components/ApiMockServerTabs';

/** W5 — open mock-server tabs cannot exceed the hard ceiling. */
export const API_MOCK_MAX_TABS = HARD_CEILINGS.maxOpenTabs;

export interface RuntimeInfoLike {
  status: ApiMockRuntimeStatus;
  generation: number;
  error?: string;
  appliedJson?: string;
}

export function computeHydrationResult(
  cancelled: boolean,
  state: { activeServerId?: string; servers: ApiMockServerDefinitionV1[] },
): { shouldApply: false } | { shouldApply: true; servers: ApiMockServerDefinitionV1[]; activeServerId?: string } {
  if (cancelled || state.servers.length === 0) return { shouldApply: false };
  return {
    shouldApply: true,
    servers: state.servers,
    activeServerId: resolveHydratedActiveServerId(state),
  };
}

export function resolveHydratedActiveServerId(state: { activeServerId?: string; servers: ApiMockServerDefinitionV1[] }): string | undefined {
  if (state.activeServerId && state.servers.some(s => s.id === state.activeServerId)) {
    return state.activeServerId;
  }
  return state.servers[0]?.id;
}

/** Lowest free auto-port in 4600–4699 not already claimed by open server tabs. */
export function pickNextAutoPort(
  servers: Array<{ port: number }>,
  range: { min: number; max: number } = AUTO_PORT_RANGE,
  excludePorts: Iterable<number> = [],
): number {
  const used = new Set<number>([
    ...servers.map(s => s.port),
    ...excludePorts,
  ]);
  for (let port = range.min; port <= range.max; port++) {
    if (!used.has(port)) return port;
  }
  throw new Error(`No available port in ${range.min}-${range.max}`);
}

/**
 * Like {@link pickNextAutoPort}, but skips ports that fail an OS/bind probe.
 * When `isAvailable` is omitted or throws, falls back to the first tab-free port.
 */
export async function resolveNextAutoPort(
  servers: Array<{ port: number }>,
  options?: {
    range?: { min: number; max: number };
    excludePorts?: Iterable<number>;
    isAvailable?: (port: number) => Promise<boolean>;
  },
): Promise<number> {
  const range = options?.range ?? AUTO_PORT_RANGE;
  const used = new Set<number>([
    ...servers.map(s => s.port),
    ...(options?.excludePorts ?? []),
  ]);
  const probe = options?.isAvailable;
  for (let port = range.min; port <= range.max; port++) {
    if (used.has(port)) continue;
    if (!probe) return port;
    try {
      if (await probe(port)) return port;
    } catch {
      // Probe transport down — use first free tab port (legacy behavior).
      return port;
    }
  }
  throw new Error(`No available port in ${range.min}-${range.max}`);
}

/** True when closing the tab must stop a live companion listener first (W5). */
export function isLiveRuntimeStatus(status: ApiMockRuntimeStatus | undefined): boolean {
  return status === 'running' || status === 'starting' || status === 'draining' || status === 'applying';
}

/** Parse companion "owned by server \"id\"" messages for orphan reclaim. */
export function parsePortOwnerServerId(message: string): string | undefined {
  const match = /owned by server "([^"]+)"/i.exec(message);
  return match?.[1];
}

/** Drop closed servers from the tab list and activate the nearest remaining tab. */
export function removeClosedServers(
  servers: ApiMockServerDefinitionV1[],
  closedIds: string[],
  activeServerId: string | undefined,
): { servers: ApiMockServerDefinitionV1[]; activeServerId: string | undefined } {
  const closed = new Set(closedIds);
  if (closed.size === 0) return { servers, activeServerId };
  const activeIndex = servers.findIndex(s => s.id === activeServerId);
  const next = servers.filter(s => !closed.has(s.id));
  if (activeServerId && next.some(s => s.id === activeServerId)) {
    return { servers: next, activeServerId };
  }
  if (next.length === 0) return { servers: next, activeServerId: undefined };
  if (activeIndex < 0) return { servers: next, activeServerId: next[0]?.id };
  return { servers: next, activeServerId: next[Math.min(activeIndex, next.length - 1)]?.id };
}

/** Drop a closed server from the tab list and activate the nearest remaining tab. */
export function removeClosedServer(
  servers: ApiMockServerDefinitionV1[],
  closedId: string,
  activeServerId: string | undefined,
): { servers: ApiMockServerDefinitionV1[]; activeServerId: string | undefined } {
  return removeClosedServers(servers, [closedId], activeServerId);
}

export function formatImportedRoutesMessage(count: number): string {
  return `Imported ${count} route${count === 1 ? '' : 's'} as drafts.`;
}

export function formatTabLimitMessage(max = API_MOCK_MAX_TABS): string {
  return `You can have at most ${max} mock servers open. Close a tab to create or duplicate another.`;
}

/** Non-destructive confirm options for the 8-tab ceiling (not a delete). */
export const TAB_LIMIT_CONFIRM_OPTIONS = {
  title: 'Tab limit',
  confirmLabel: 'OK',
  finalNote: '',
} as const;

/** Trigger a JSON/HAR file download from the browser. */
export function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatStopAndCloseMessage(names: string[]): string {
  if (names.length <= 1) return `Stop and close "${names[0] ?? 'mock server'}"?`;
  return `Stop and close ${names.length} mock servers? Running listeners will be stopped.`;
}

/** Clone a server tab with a new id, next port, and no TLS/variable secrets (W5). */
export function duplicateServerDefinition(
  source: ApiMockServerDefinitionV1,
  nextPort: number,
  now = new Date().toISOString(),
): ApiMockServerDefinitionV1 {
  const cloned = structuredClone(source);
  const tls = cloned.settings?.tls;
  if (tls) {
    cloned.settings = {
      ...cloned.settings,
      tls: {
        ...tls,
        keyPem: '',
        passphrase: undefined,
        mtls: tls.mtls ? { ...tls.mtls, clientKeyPem: undefined } : undefined,
      },
    };
  }
  return {
    ...cloned,
    id: `srv-${crypto.randomUUID().slice(0, 8)}`,
    name: /\scopy$/.test(source.name) ? source.name : `${source.name} copy`,
    port: nextPort,
    variables: (cloned.variables ?? []).map(v => (v.sensitive ? { ...v, value: '' } : v)),
    samples: (cloned.samples ?? []).map(s => ({ ...s, request: stripCapturedRequestSecrets(s.request) })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Move a tab from `fromIndex` to `toIndex`. Returns the original array when the move is a no-op. */
export function reorderServers<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= items.length
    || toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function formatConflictAnalysisMessage(count: number): string {
  return count === 0 ? 'No route conflicts found.' : `${count} potential conflict${count === 1 ? '' : 's'} found.`;
}

export function deriveSimulateDefaults(selectedRoute?: ApiMockServerDefinitionV1['routes'][0]): { initialPath: string; initialMethod: string } {
  return {
    initialPath: concreteMockPath(selectedRoute?.path.value),
    initialMethod: selectedRoute && selectedRoute.method !== 'ANY' ? selectedRoute.method : 'GET',
  };
}

/** Turn `/users/:id` / `/orders/{id}` into a concrete request path for Simulate. */
export function concreteMockPath(pathValue?: string): string {
  const filled = (pathValue || '/')
    .replace(/:[A-Za-z_]\w*/g, '42')
    .replace(/\{[A-Za-z_]\w*\}/g, '42');
  return filled || '/';
}

export function buildRuntimeMaps(
  servers: ApiMockServerDefinitionV1[],
  runtime: Record<string, RuntimeInfoLike>,
): { statusById: Record<string, ApiMockRuntimeStatus>; dirtyById: Record<string, boolean> } {
  const statusById: Record<string, ApiMockRuntimeStatus> = {};
  const dirtyById: Record<string, boolean> = {};
  for (const server of servers) {
    const info = runtime[server.id];
    statusById[server.id] = info?.status ?? 'stopped';
    dirtyById[server.id] = info?.status === 'running' && info.appliedJson !== undefined && JSON.stringify(server) !== info.appliedJson;
  }
  return { statusById, dirtyById };
}

export function mergeRuntimeInfo(
  prev: Record<string, RuntimeInfoLike>,
  id: string,
  patch: Partial<RuntimeInfoLike>,
): Record<string, RuntimeInfoLike> {
  const base: RuntimeInfoLike = prev[id] ?? { status: 'stopped', generation: 0 };
  return { ...prev, [id]: { ...base, ...patch } };
}

export function findSelectedRoute(
  activeServer: ApiMockServerDefinitionV1 | undefined,
  selectedRouteId: string | undefined,
): ApiMockServerDefinitionV1['routes'][0] | undefined {
  return activeServer?.routes.find(r => r.id === selectedRouteId);
}

export function buildUpdatedRoutesPatch(
  activeServerId: string | undefined,
  activeServer: ApiMockServerDefinitionV1 | undefined,
  routeId: string,
  patch: Partial<ApiMockServerDefinitionV1['routes'][0]>,
): { serverId: string; routes: ApiMockServerDefinitionV1['routes'] } | null {
  if (!activeServerId || !activeServer) return null;
  return {
    serverId: activeServerId,
    routes: activeServer.routes.map(r => r.id === routeId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r),
  };
}

export function getConflictAnalysisTarget(
  activeServer: ApiMockServerDefinitionV1 | undefined,
): { serverId: string; routes: ApiMockServerDefinitionV1['routes'] } | null {
  if (!activeServer) return null;
  return { serverId: activeServer.id, routes: activeServer.routes };
}

export function applyRouteUpdate(
  activeServerId: string | undefined,
  activeServer: ApiMockServerDefinitionV1 | undefined,
  routeId: string,
  patch: Partial<ApiMockServerDefinitionV1['routes'][0]>,
  updateServer: (id: string, patch: Partial<ApiMockServerDefinitionV1>) => void,
): void {
  const next = buildUpdatedRoutesPatch(activeServerId, activeServer, routeId, patch);
  if (!next) return;
  updateServer(next.serverId, { routes: next.routes });
}

/** Snapshot used by the route-delete undo toast. */
export interface DeletedRouteSnapshot {
  serverId: string;
  index: number;
  route: ApiMockRouteV1;
  attachedSampleIds: string[];
  selectedWasDeleted: boolean;
  /** Selection on this server at delete time — restored even after switching tabs. */
  priorSelectedRouteId?: string;
}

export function snapshotDeletedRoute(
  server: ApiMockServerDefinitionV1,
  routeId: string,
  selectedRouteId?: string,
): DeletedRouteSnapshot | undefined {
  const index = server.routes.findIndex(r => r.id === routeId);
  if (index < 0) return undefined;
  return {
    serverId: server.id,
    index,
    route: structuredClone(server.routes[index]),
    attachedSampleIds: (server.samples ?? []).filter(s => s.routeId === routeId).map(s => s.id),
    selectedWasDeleted: selectedRouteId === routeId,
    priorSelectedRouteId: selectedRouteId,
  };
}

function unlinkSamplesFromRoute(
  samples: ApiMockSimulationSampleV1[] | undefined,
  routeId: string,
): ApiMockSimulationSampleV1[] {
  return (samples ?? []).map(s => (
    s.routeId === routeId
      ? { ...s, routeId: undefined, expected: s.expected ? { ...s.expected, routeId: undefined } : undefined }
      : s
  ));
}

export function applyRouteDelete(
  activeServerId: string | undefined,
  activeServer: ApiMockServerDefinitionV1 | undefined,
  selectedRouteId: string | undefined,
  routeId: string,
  updateServer: (id: string, patch: Partial<ApiMockServerDefinitionV1>) => void,
  setSelectedRouteId: (id: string | undefined) => void,
  setLiveMessage: (message: string) => void,
): DeletedRouteSnapshot | undefined {
  if (!activeServerId || !activeServer || activeServer.id !== activeServerId) return undefined;
  const snapshot = snapshotDeletedRoute(activeServer, routeId, selectedRouteId);
  if (!snapshot) return undefined;
  updateServer(activeServerId, {
    routes: activeServer.routes.filter(r => r.id !== routeId),
    samples: unlinkSamplesFromRoute(activeServer.samples, routeId),
  });
  if (selectedRouteId === routeId) setSelectedRouteId(undefined);
  setLiveMessage(`Route “${snapshot.route.name}” deleted. Undo for a few seconds.`);
  return snapshot;
}

export function restoreDeletedRoute(
  activeServer: ApiMockServerDefinitionV1 | undefined,
  snapshot: DeletedRouteSnapshot | null | undefined,
  updateServer: (id: string, patch: Partial<ApiMockServerDefinitionV1>) => void,
  setSelectedRouteId: (id: string | undefined) => void,
  setLiveMessage: (message: string) => void,
): boolean {
  if (!snapshot || !activeServer || activeServer.id !== snapshot.serverId) return false;
  if (activeServer.routes.some(r => r.id === snapshot.route.id)) return false;
  const routes = [...activeServer.routes];
  const index = Math.min(Math.max(0, snapshot.index), routes.length);
  routes.splice(index, 0, structuredClone(snapshot.route));
  const attached = new Set(snapshot.attachedSampleIds);
  const samples = (activeServer.samples ?? []).map(s => {
    // Leave examples the user reassigned during the undo window on their new route.
    if (!attached.has(s.id) || (s.routeId != null && s.routeId !== snapshot.route.id)) return s;
    return {
      ...s,
      routeId: snapshot.route.id,
      expected: s.expected ? { ...s.expected, routeId: snapshot.route.id } : s.expected,
    };
  });
  updateServer(activeServer.id, { routes, samples });
  setSelectedRouteId(snapshot.priorSelectedRouteId);
  setLiveMessage(`Restored “${snapshot.route.name}”.`);
  return true;
}

/** Restore onto the snapshot's server even if another tab is active. */
export function restoreDeletedRouteInList(
  servers: ApiMockServerDefinitionV1[],
  snapshot: DeletedRouteSnapshot | null | undefined,
  updateServer: (id: string, patch: Partial<ApiMockServerDefinitionV1>) => void,
  setSelectedRouteId: (id: string | undefined) => void,
  setLiveMessage: (message: string) => void,
): boolean {
  if (!snapshot) return false;
  const target = servers.find(s => s.id === snapshot.serverId);
  return restoreDeletedRoute(target, snapshot, updateServer, setSelectedRouteId, setLiveMessage);
}

export async function runConflictAnalysis(
  activeServer: ApiMockServerDefinitionV1 | undefined,
  analyze: (routes: ApiMockServerDefinitionV1['routes'], serverId: string) => Promise<{ findings: Array<{ ruleIds: [string, string] }> }>,
  setConflictIds: (ids: string[]) => void,
  setLiveMessage: (message: string) => void,
  setFindings?: (findings: Array<{ ruleIds: [string, string] }>) => void,
  setStats?: (stats: { analyzedRules: number; durationMs: number }) => void,
): Promise<void> {
  const target = getConflictAnalysisTarget(activeServer);
  if (!target) return;
  const startedAt = performance.now();
  const { findings } = await analyze(target.routes, target.serverId);
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
  const ids = [...new Set(findings.flatMap(f => f.ruleIds))];
  setConflictIds(ids);
  setFindings?.(findings);
  setStats?.({ analyzedRules: target.routes.filter(r => r.enabled).length, durationMs });
  setLiveMessage(formatConflictAnalysisMessage(findings.length));
}

/** Preserve acknowledgements when fingerprints for the same rule pair are unchanged; mark stale otherwise. */
export function mergeConflictAcknowledgements<T extends {
  ruleIds: [string, string];
  ruleFingerprints?: [string, string];
  acknowledgedAt?: string;
  acknowledgementStale?: boolean;
}>(previous: T[], next: T[]): T[] {
  return next.map(f => {
    const prev = previous.find(p => (
      !!p.acknowledgedAt
      && p.ruleIds?.[0] === f.ruleIds?.[0]
      && p.ruleIds?.[1] === f.ruleIds?.[1]
    ));
    if (!prev?.acknowledgedAt) return { ...f, acknowledgementStale: false };
    const pf = prev.ruleFingerprints;
    const nf = f.ruleFingerprints;
    const sameFp = !pf || !nf || (pf[0] === nf[0] && pf[1] === nf[1]);
    if (sameFp) {
      return { ...f, acknowledgedAt: prev.acknowledgedAt, acknowledgementStale: false };
    }
    return { ...f, acknowledgementStale: true };
  });
}

import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';
import { AUTO_PORT_RANGE } from '../../shared/api-mock/defaults';
import type { ApiMockRuntimeStatus } from './components/ApiMockServerTabs';

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
  return state.activeServerId ?? state.servers[0]?.id;
}

/** Lowest free auto-port in 4600–4699 not already claimed by open server tabs. */
export function pickNextAutoPort(
  servers: Array<{ port: number }>,
  range: { min: number; max: number } = AUTO_PORT_RANGE,
): number {
  const used = new Set(servers.map(s => s.port));
  for (let port = range.min; port <= range.max; port++) {
    if (!used.has(port)) return port;
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

/** Drop a closed server from the tab list and pick a new active id when needed. */
export function removeClosedServer(
  servers: ApiMockServerDefinitionV1[],
  closedId: string,
  activeServerId: string | undefined,
): { servers: ApiMockServerDefinitionV1[]; activeServerId: string | undefined } {
  const next = servers.filter(s => s.id !== closedId);
  return {
    servers: next,
    activeServerId: activeServerId === closedId ? next[0]?.id : activeServerId,
  };
}

export function formatImportedRoutesMessage(count: number): string {
  return `Imported ${count} route${count === 1 ? '' : 's'} as drafts.`;
}

export function formatConflictAnalysisMessage(count: number): string {
  return count === 0 ? 'No route conflicts found.' : `${count} potential conflict${count === 1 ? '' : 's'} found.`;
}

export function deriveSimulateDefaults(selectedRoute?: ApiMockServerDefinitionV1['routes'][0]): { initialPath: string; initialMethod: string } {
  return {
    initialPath: selectedRoute?.path.value || '/',
    initialMethod: selectedRoute && selectedRoute.method !== 'ANY' ? selectedRoute.method : 'GET',
  };
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

export function applyRouteDelete(
  activeServerId: string | undefined,
  activeServer: ApiMockServerDefinitionV1 | undefined,
  selectedRouteId: string | undefined,
  routeId: string,
  updateServer: (id: string, patch: Partial<ApiMockServerDefinitionV1>) => void,
  setSelectedRouteId: (id: string | undefined) => void,
  setLiveMessage: (message: string) => void,
): void {
  if (!activeServerId || !activeServer) return;
  updateServer(activeServerId, { routes: activeServer.routes.filter(r => r.id !== routeId) });
  if (selectedRouteId === routeId) setSelectedRouteId(undefined);
  setLiveMessage('Route deleted.');
}

export async function runConflictAnalysis(
  activeServer: ApiMockServerDefinitionV1 | undefined,
  analyze: (routes: ApiMockServerDefinitionV1['routes'], serverId: string) => Promise<{ findings: Array<{ ruleIds: [string, string] }> }>,
  setConflictIds: (ids: string[]) => void,
  setLiveMessage: (message: string) => void,
  setFindings?: (findings: Array<{ ruleIds: [string, string] }>) => void,
): Promise<void> {
  const target = getConflictAnalysisTarget(activeServer);
  if (!target) return;
  const { findings } = await analyze(target.routes, target.serverId);
  const ids = [...new Set(findings.flatMap(f => f.ruleIds))];
  setConflictIds(ids);
  setFindings?.(findings);
  setLiveMessage(formatConflictAnalysisMessage(findings.length));
}

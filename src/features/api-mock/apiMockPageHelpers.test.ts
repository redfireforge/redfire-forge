/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '../../shared/api-mock/defaults';
import {
  applyRouteDelete,
  applyRouteUpdate,
  buildUpdatedRoutesPatch,
  buildRuntimeMaps,
  computeHydrationResult,
  deriveSimulateDefaults,
  findSelectedRoute,
  formatConflictAnalysisMessage,
  formatImportedRoutesMessage,
  getConflictAnalysisTarget,
  isLiveRuntimeStatus,
  mergeRuntimeInfo,
  parsePortOwnerServerId,
  pickNextAutoPort,
  removeClosedServer,
  resolveHydratedActiveServerId,
  runConflictAnalysis,
} from './apiMockPageHelpers';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id: string, method: ApiMockServerDefinitionV1['routes'][0]['method'] = 'GET', path = '/users'): ApiMockServerDefinitionV1 {
  return {
    id,
    name: `Mock Server ${id}`,
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: `${id}-r1`,
      name: 'Route',
      enabled: true,
      method,
      path: { kind: 'exact', value: path },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('apiMockPageHelpers', () => {
  it('resolves the hydrated active server id with and without an explicit value', () => {
    expect(resolveHydratedActiveServerId({ activeServerId: 'srv-2', servers: [makeServer('srv-1'), makeServer('srv-2')] })).toBe('srv-2');
    expect(resolveHydratedActiveServerId({ activeServerId: undefined, servers: [makeServer('srv-1'), makeServer('srv-2')] })).toBe('srv-1');
    expect(resolveHydratedActiveServerId({ activeServerId: undefined, servers: [] })).toBeUndefined();
  });

  it('picks the lowest free auto-port so closed tabs free their ports for reuse', () => {
    expect(pickNextAutoPort([])).toBe(4600);
    expect(pickNextAutoPort([{ port: 4600 }])).toBe(4601);
    expect(pickNextAutoPort([{ port: 4600 }, { port: 4602 }])).toBe(4601);
    expect(() => pickNextAutoPort(
      Array.from({ length: 3 }, (_, i) => ({ port: 10 + i })),
      { min: 10, max: 12 },
    )).toThrow(/No available port/);
  });

  it('classifies live runtime statuses and parses port-owner ids', () => {
    expect(isLiveRuntimeStatus('running')).toBe(true);
    expect(isLiveRuntimeStatus('starting')).toBe(true);
    expect(isLiveRuntimeStatus('stopped')).toBe(false);
    expect(isLiveRuntimeStatus(undefined)).toBe(false);
    expect(parsePortOwnerServerId('Port 4601 is owned by server "srv-6187f22c"')).toBe('srv-6187f22c');
    expect(parsePortOwnerServerId('something else')).toBeUndefined();
  });

  it('removes a closed server and reassigns active when needed', () => {
    const a = makeServer('srv-a');
    const b = makeServer('srv-b');
    expect(removeClosedServer([a, b], 'srv-a', 'srv-a')).toEqual({ servers: [b], activeServerId: 'srv-b' });
    expect(removeClosedServer([a, b], 'srv-a', 'srv-b')).toEqual({ servers: [b], activeServerId: 'srv-b' });
    expect(removeClosedServer([a], 'srv-a', 'srv-a')).toEqual({ servers: [], activeServerId: undefined });
  });

  it('computes hydration application only when not cancelled and servers exist', () => {
    expect(computeHydrationResult(true, { activeServerId: 'srv-1', servers: [makeServer('srv-1')] })).toEqual({ shouldApply: false });
    expect(computeHydrationResult(false, { activeServerId: undefined, servers: [] })).toEqual({ shouldApply: false });
    expect(computeHydrationResult(false, { activeServerId: undefined, servers: [makeServer('srv-1')] })).toEqual({
      shouldApply: true,
      servers: [makeServer('srv-1')],
      activeServerId: 'srv-1',
    });
  });

  it('formats singular and plural live messages', () => {
    expect(formatImportedRoutesMessage(1)).toBe('Imported 1 route as drafts.');
    expect(formatImportedRoutesMessage(2)).toBe('Imported 2 routes as drafts.');
    expect(formatConflictAnalysisMessage(0)).toBe('No route conflicts found.');
    expect(formatConflictAnalysisMessage(1)).toBe('1 potential conflict found.');
    expect(formatConflictAnalysisMessage(3)).toBe('3 potential conflicts found.');
  });

  it('derives simulate defaults for missing, GET, and ANY routes', () => {
    expect(deriveSimulateDefaults()).toEqual({ initialPath: '/', initialMethod: 'GET' });
    expect(deriveSimulateDefaults(makeServer('srv-1', 'GET', '/users').routes[0])).toEqual({ initialPath: '/users', initialMethod: 'GET' });
    expect(deriveSimulateDefaults(makeServer('srv-1', 'ANY', '').routes[0])).toEqual({ initialPath: '/', initialMethod: 'GET' });
  });

  it('builds runtime status and dirty maps', () => {
    const a = makeServer('a');
    const b = makeServer('b');
    const runtime = {
      a: { status: 'running', generation: 1, appliedJson: JSON.stringify(a) },
      b: { status: 'running', generation: 2, appliedJson: JSON.stringify({ ...b, name: 'old' }) },
    };
    const maps = buildRuntimeMaps([a, b], runtime);
    expect(maps.statusById).toEqual({ a: 'running', b: 'running' });
    expect(maps.dirtyById).toEqual({ a: false, b: true });
  });

  it('merges runtime info for new and existing entries', () => {
    expect(mergeRuntimeInfo({}, 'srv-1', { status: 'starting' })).toEqual({ 'srv-1': { status: 'starting', generation: 0 } });
    expect(mergeRuntimeInfo({ 'srv-1': { status: 'running', generation: 1, error: 'x' } }, 'srv-1', { generation: 2, error: undefined })).toEqual({
      'srv-1': { status: 'running', generation: 2, error: undefined },
    });
  });

  it('finds the selected route when present', () => {
    const server = makeServer('srv-1');
    expect(findSelectedRoute(undefined, 'srv-1-r1')).toBeUndefined();
    expect(findSelectedRoute(server, undefined)).toBeUndefined();
    expect(findSelectedRoute(server, 'srv-1-r1')?.id).toBe('srv-1-r1');
  });

  it('builds a route-update patch only when an active server exists', () => {
    const server = makeServer('srv-1');
    expect(buildUpdatedRoutesPatch(undefined, server, 'srv-1-r1', { name: 'Updated' })).toBeNull();
    expect(buildUpdatedRoutesPatch('srv-1', undefined, 'srv-1-r1', { name: 'Updated' })).toBeNull();
    const patch = buildUpdatedRoutesPatch('srv-1', server, 'srv-1-r1', { name: 'Updated' });
    expect(patch?.serverId).toBe('srv-1');
    expect(patch?.routes[0].name).toBe('Updated');
  });

  it('returns a conflict-analysis target only when there is an active server', () => {
    expect(getConflictAnalysisTarget(undefined)).toBeNull();
    const server = makeServer('srv-1');
    expect(getConflictAnalysisTarget(server)).toEqual({ serverId: 'srv-1', routes: server.routes });
  });

  it('applies route updates and no-ops when there is no active server', () => {
    const updateServer = vi.fn();
    const server = makeServer('srv-1');
    applyRouteUpdate(undefined, server, 'srv-1-r1', { name: 'Updated' }, updateServer);
    expect(updateServer).not.toHaveBeenCalled();

    applyRouteUpdate('srv-1', server, 'srv-1-r1', { name: 'Updated' }, updateServer);
    expect(updateServer).toHaveBeenCalledWith('srv-1', expect.objectContaining({ routes: [expect.objectContaining({ name: 'Updated' })] }));
  });

  it('applies route delete and clears selection only when deleting the selected route', () => {
    const updateServer = vi.fn();
    const setSelectedRouteId = vi.fn();
    const setLiveMessage = vi.fn();
    const server = makeServer('srv-1');

    applyRouteDelete('srv-1', server, 'other', 'srv-1-r1', updateServer, setSelectedRouteId, setLiveMessage);
    expect(updateServer).toHaveBeenCalled();
    expect(setSelectedRouteId).not.toHaveBeenCalled();
    expect(setLiveMessage).toHaveBeenCalledWith('Route deleted.');

    applyRouteDelete('srv-1', server, 'srv-1-r1', 'srv-1-r1', updateServer, setSelectedRouteId, setLiveMessage);
    expect(setSelectedRouteId).toHaveBeenCalledWith(undefined);
  });

  it('runs conflict analysis and no-ops without an active server', async () => {
    const analyze = vi.fn().mockResolvedValue({ findings: [{ ruleIds: ['a', 'b'] }] });
    const setConflictIds = vi.fn();
    const setLiveMessage = vi.fn();
    const setFindings = vi.fn();
    await runConflictAnalysis(undefined, analyze, setConflictIds, setLiveMessage, setFindings);
    expect(analyze).not.toHaveBeenCalled();

    const server = makeServer('srv-1');
    await runConflictAnalysis(server, analyze, setConflictIds, setLiveMessage, setFindings);
    expect(analyze).toHaveBeenCalledWith(server.routes, 'srv-1');
    expect(setConflictIds).toHaveBeenCalledWith(['a', 'b']);
    expect(setFindings).toHaveBeenCalledWith([{ ruleIds: ['a', 'b'] }]);
    expect(setLiveMessage).toHaveBeenCalledWith('1 potential conflict found.');
  });
});

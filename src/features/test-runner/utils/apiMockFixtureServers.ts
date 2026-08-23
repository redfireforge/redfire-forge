/**
 * Test Runner fixture — Studio library plus live listener state.
 * Definitions come from the workspace; running/stopped is reconciled from
 * the companion (never from disk).
 */
import { apiMockControlClient } from '../../api-mock/apiMockControlClient';
import { loadApiMockWorkspace } from '../../api-mock/apiMockPersistence';
import { isTauri } from '@shared/utils/platform';

export type ApiMockFixtureServerStatus = 'running' | 'stopped';

export interface ApiMockFixtureServerRow {
  id: string;
  name: string;
  port: number;
  status: ApiMockFixtureServerStatus;
}

export function fixtureServerLabel(server: Pick<ApiMockFixtureServerRow, 'name' | 'port'>): string {
  return `${server.name} (:${server.port})`;
}

export function fixtureServerStatusLabel(status: ApiMockFixtureServerStatus): string {
  return status === 'running' ? 'Running' : 'Stopped';
}

export async function loadListenerStates(
  ids: string[],
): Promise<Map<string, ApiMockFixtureServerStatus>> {
  const map = new Map<string, ApiMockFixtureServerStatus>();
  if (ids.length === 0) return map;

  if (isTauri()) {
    await Promise.all(ids.map(async (id) => {
      const st = await apiMockControlClient.status(id);
      map.set(id, st.ok && st.data.state === 'running' ? 'running' : 'stopped');
    }));
    return map;
  }

  const list = await apiMockControlClient.list();
  if (list.ok) {
    for (const row of list.data) {
      map.set(row.serverId, row.state === 'running' ? 'running' : 'stopped');
    }
  }
  return map;
}

export async function loadApiMockFixtureServers(): Promise<ApiMockFixtureServerRow[]> {
  const ws = await loadApiMockWorkspace();
  const states = await loadListenerStates(ws.servers.map(s => s.id));
  return ws.servers.map(s => ({
    id: s.id,
    name: s.name,
    port: s.port,
    status: states.get(s.id) ?? 'stopped',
  }));
}

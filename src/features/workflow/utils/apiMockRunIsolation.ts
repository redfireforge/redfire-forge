/**
 * Phase 11D — run-scoped registry of started API Mock servers for cleanup.
 */
import { apiMockControlClient } from '../../api-mock/apiMockControlClient';

const startedByRun = new Map<string, Set<string>>();

export function registerApiMockServerForRun(runId: string, serverId: string): void {
  if (!runId || !serverId) return;
  let set = startedByRun.get(runId);
  if (!set) {
    set = new Set();
    startedByRun.set(runId, set);
  }
  set.add(serverId);
}

export function listApiMockServersForRun(runId: string): string[] {
  return [...(startedByRun.get(runId) ?? [])];
}

export function clearApiMockRunRegistry(runId: string): void {
  startedByRun.delete(runId);
}

/** Stop every mock server registered for a workflow/test run (best-effort). */
export async function cleanupApiMockServersForRun(runId: string): Promise<{ stopped: string[]; errors: string[] }> {
  const ids = listApiMockServersForRun(runId);
  const stopped: string[] = [];
  const errors: string[] = [];
  await Promise.all(ids.map(async id => {
    const res = await apiMockControlClient.stop(id);
    if (res.ok) stopped.push(id);
    else errors.push(`${id}: ${res.error.message}`);
  }));
  clearApiMockRunRegistry(runId);
  return { stopped, errors };
}

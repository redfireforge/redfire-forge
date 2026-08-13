/**
 * Resolve an API Mock server definition for workflow/test-runner nodes.
 */
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { validateServer } from '../../../shared/api-mock/validation';
import { loadApiMockWorkspace } from '../../api-mock/apiMockPersistence';
import type { ApiMockStartNodeData } from '../types/workflow/node-api-mock';

export interface ResolvedApiMockDefinition {
  ok: true;
  definition: ApiMockServerDefinitionV1;
  workspaceServerId: string;
}

export interface ResolveApiMockDefinitionError {
  ok: false;
  error: string;
}

export type ResolveApiMockDefinitionResult = ResolvedApiMockDefinition | ResolveApiMockDefinitionError;

/** Build a run-scoped server id for parallel isolation. */
export function isolateApiMockServerId(serverId: string, runId: string): string {
  const safeRun = runId.replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 24) || 'run';
  return `${serverId}__run_${safeRun}`;
}

export async function resolveApiMockDefinition(opts: {
  serverId: string;
  portOverride?: number;
  isolateRun?: boolean;
  runId?: string;
  /** Injected for tests — defaults to loadApiMockWorkspace. */
  loadWorkspace?: typeof loadApiMockWorkspace;
}): Promise<ResolveApiMockDefinitionResult> {
  if (!opts.serverId?.trim()) {
    return { ok: false, error: 'serverId is required' };
  }
  const load = opts.loadWorkspace ?? loadApiMockWorkspace;
  const workspace = await load();
  const found = workspace.servers.find(s => s.id === opts.serverId);
  if (!found) {
    return { ok: false, error: `Mock server "${opts.serverId}" not found in workspace` };
  }

  let definition: ApiMockServerDefinitionV1 = {
    ...found,
    routes: found.routes.map(r => ({ ...r, responses: r.responses.map(v => ({ ...v })) })),
    settings: { ...found.settings },
  };

  if (opts.portOverride != null && opts.portOverride >= 1024 && opts.portOverride <= 65535) {
    definition = { ...definition, port: opts.portOverride };
  }

  if (opts.isolateRun && opts.runId) {
    definition = {
      ...definition,
      id: isolateApiMockServerId(opts.serverId, opts.runId),
      name: `${definition.name} (run)`,
    };
  }

  const errors = validateServer(definition).filter(d => d.severity === 'error');
  if (errors.length > 0) {
    return { ok: false, error: errors.map(e => e.message).join('; ') };
  }

  return { ok: true, definition, workspaceServerId: opts.serverId };
}

export function resolveStartOptions(data: ApiMockStartNodeData): {
  serverId: string;
  portOverride?: number;
  isolateRun: boolean;
} {
  return {
    serverId: data.serverId,
    portOverride: data.portOverride,
    isolateRun: data.isolateRun !== false,
  };
}

/**
 * Phase 11C — Test Runner setup/teardown for API Mock fixtures.
 */
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import type { Scenario } from '@shared/types';
import { replaceHost } from '@shared/utils/urlUtils';
import { apiMockControlClient } from '../../api-mock/apiMockControlClient';
import { loadApiMockWorkspace } from '../../api-mock/apiMockPersistence';
import { resolveApiMockDefinition } from '@workflow/utils/apiMockWorkflowDefinitionResolver';
import {
  cleanupApiMockServersForRun,
  registerApiMockServerForRun,
} from '@workflow/utils/apiMockRunIsolation';

export interface ApiMockTestFixtureConfig {
  enabled: boolean;
  serverId: string;
  portMode?: 'auto' | 'fixed';
  port?: number;
  /** When true (default), use run-isolated server ids. */
  isolateRun?: boolean;
  teardown?: 'stop' | 'none';
  /** Ignored — Mock Server always rewrites scenario URLs to the listener. */
  overrideBaseUrl?: boolean;
}

export interface ApiMockFixtureHandle {
  runId: string;
  serverId: string;
  port: number;
  generation: number;
  definition: ApiMockServerDefinitionV1;
  /** Isolate off: Studio was already running before this run — leave it up. */
  restoreRunning?: boolean;
}

/** Live fixture bind/teardown line shown on the Test Runner panel. */
export interface ApiMockFixtureRunStatus {
  phase: 'starting' | 'running' | 'stopped';
  port?: number;
  serverId?: string;
}

/** Turn the Host → Mock Server option on, keeping the last server/isolate choices. */
export function enableApiMockFixture(
  prev?: ApiMockTestFixtureConfig,
): ApiMockTestFixtureConfig {
  return {
    enabled: true,
    serverId: prev?.serverId ?? '',
    isolateRun: prev?.isolateRun !== false,
    overrideBaseUrl: true,
    teardown: prev?.teardown ?? 'stop',
    portMode: prev?.portMode ?? 'auto',
    port: prev?.port,
  };
}

/** Prefer the requested id; if blank, use the active workspace server or the first one. */
export function resolveFixtureServerId(
  requested: string | undefined,
  workspace: { servers: Array<{ id: string }>; activeServerId?: string },
): string {
  const id = requested?.trim() ?? '';
  if (id) return id;
  const active = workspace.activeServerId?.trim() ?? '';
  if (active && workspace.servers.some(s => s.id === active)) return active;
  return workspace.servers[0]?.id ?? '';
}

export async function setupApiMockFixture(
  config: ApiMockTestFixtureConfig,
  runId: string,
): Promise<{ ok: true; handle: ApiMockFixtureHandle } | { ok: false; error: string }> {
  if (!config.enabled) return { ok: false, error: 'API Mock fixture disabled' };
  const workspace = await loadApiMockWorkspace();
  const serverId = resolveFixtureServerId(config.serverId, workspace);
  const resolved = await resolveApiMockDefinition({
    serverId,
    portOverride: config.portMode === 'fixed' ? config.port : undefined,
    isolateRun: config.isolateRun !== false,
    runId,
    loadWorkspace: async () => workspace,
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const isolate = config.isolateRun !== false;
  let restoreRunning = false;
  if (!isolate) {
    const prior = await apiMockControlClient.status(serverId);
    restoreRunning = prior.ok && prior.data.state === 'running';
  }

  const start = await apiMockControlClient.start(resolved.definition);
  if (!start.ok) return { ok: false, error: `${start.error.title}: ${start.error.message}` };

  registerApiMockServerForRun(runId, start.data.serverId);
  return {
    ok: true,
    handle: {
      runId,
      serverId: start.data.serverId,
      port: start.data.port,
      generation: start.data.generation,
      definition: resolved.definition,
      restoreRunning,
    },
  };
}

export async function teardownApiMockFixture(
  handle: ApiMockFixtureHandle | undefined,
  config?: ApiMockTestFixtureConfig,
): Promise<void> {
  if (!handle) return;
  if (config?.teardown === 'none') return;
  // Isolate off: put Studio's mock back the way it was.
  if (config?.isolateRun === false && handle.restoreRunning) return;
  await cleanupApiMockServersForRun(handle.runId);
}

/**
 * Point scenario URLs at the mock listener.
 * Unlike `replaceHost`, this also rewrites absolute http(s) origins so fixture
 * override works for typical env-resolved absolute URLs.
 */
export function applyApiMockFixtureBaseUrl<T extends Scenario>(scenarios: T[], mockBaseUrl: string): T[] {
  return scenarios.map(s => ({ ...s, url: forceMockOrigin(s.url, mockBaseUrl) }));
}

function forceMockOrigin(testUrl: string, mockBaseUrl: string): string {
  if (!mockBaseUrl) return testUrl;
  if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
    return replaceHost(testUrl, mockBaseUrl);
  }
  try {
    const base = new URL(mockBaseUrl);
    const current = new URL(testUrl);
    current.protocol = base.protocol;
    current.host = base.host;
    const basePath = base.pathname.replace(/\/$/, '');
    if (basePath && basePath !== '/' && !current.pathname.startsWith(basePath)) {
      current.pathname = `${basePath}${current.pathname.startsWith('/') ? '' : '/'}${current.pathname}`;
    }
    return current.toString();
  } catch {
    return testUrl;
  }
}

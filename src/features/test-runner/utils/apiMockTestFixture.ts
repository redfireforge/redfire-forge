/**
 * Phase 11C — Test Runner setup/teardown for API Mock fixtures.
 */
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import type { Scenario } from '../../../shared/types';
import { replaceHost } from '../../../shared/utils/urlUtils';
import { apiMockControlClient } from '../../api-mock/apiMockControlClient';
import { resolveApiMockDefinition } from '../../workflow/utils/apiMockWorkflowDefinitionResolver';
import {
  cleanupApiMockServersForRun,
  registerApiMockServerForRun,
} from '../../workflow/utils/apiMockRunIsolation';

export interface ApiMockTestFixtureConfig {
  enabled: boolean;
  serverId: string;
  portMode?: 'auto' | 'fixed';
  port?: number;
  /** When true (default), use run-isolated server ids. */
  isolateRun?: boolean;
  teardown?: 'stop' | 'none';
  /**
   * When true (default), point the run's HTTP base URL at the mock listener.
   * Disable if tests already use absolute URLs / {{mockBaseUrl}}.
   */
  overrideBaseUrl?: boolean;
}

export interface ApiMockFixtureHandle {
  runId: string;
  serverId: string;
  port: number;
  generation: number;
  definition: ApiMockServerDefinitionV1;
}

/** Live fixture bind/teardown line shown on the Test Runner panel. */
export interface ApiMockFixtureRunStatus {
  phase: 'starting' | 'running' | 'stopped';
  port?: number;
  serverId?: string;
}

export async function setupApiMockFixture(
  config: ApiMockTestFixtureConfig,
  runId: string,
): Promise<{ ok: true; handle: ApiMockFixtureHandle } | { ok: false; error: string }> {
  if (!config.enabled) return { ok: false, error: 'API Mock fixture disabled' };
  const resolved = await resolveApiMockDefinition({
    serverId: config.serverId,
    portOverride: config.portMode === 'fixed' ? config.port : undefined,
    isolateRun: config.isolateRun !== false,
    runId,
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

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
    },
  };
}

export async function teardownApiMockFixture(
  handle: ApiMockFixtureHandle | undefined,
  config?: ApiMockTestFixtureConfig,
): Promise<void> {
  if (!handle) return;
  if (config?.teardown === 'none') return;
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

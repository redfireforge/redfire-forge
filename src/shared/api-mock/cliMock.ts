/**
 * API Mock Studio — CLI simulation utility (Phase 8C).
 * Pure functions for headless simulation. Server startup is in src-server/.
 */
import { simulateBatch } from './simulation';
import { migrateWorkspace } from './migration';
import { validateServer } from './validation';
import type { ApiMockWorkspaceV1, ApiMockSimulationResultV1, ApiMockDiagnosticV1 } from './contracts';

export interface CliSimulateOptions {
  workspace: ApiMockWorkspaceV1;
  serverId: string;
}

export function cliSimulateSamples(options: CliSimulateOptions): ApiMockSimulationResultV1[] {
  const srv = options.workspace.servers.find(s => s.id === options.serverId);
  if (!srv) return [];
  return simulateBatch(srv.samples, { routes: srv.routes, settings: srv.settings });
}

export interface CliLoadResult {
  workspace: ApiMockWorkspaceV1;
  diagnostics: ApiMockDiagnosticV1[];
  validationErrors: string[];
}

export function cliLoadAndValidate(raw: Record<string, unknown>): CliLoadResult {
  const { workspace, diagnostics } = migrateWorkspace(raw);
  const validationErrors: string[] = [];
  for (const srv of workspace.servers) {
    const diags = validateServer(srv);
    for (const d of diags) {
      if (d.severity === 'error') validationErrors.push(`${srv.id}: ${d.message}`);
    }
  }
  return { workspace, diagnostics, validationErrors };
}

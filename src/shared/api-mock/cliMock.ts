/**
 * API Mock Studio — CLI simulation utility (Phase 8C).
 * Pure functions for headless simulation. Server startup is in src-server/.
 */
import { simulateBatch } from './simulation';
import { migrateWorkspace } from './migration';
import { validateServer } from './validation';
import { HARD_CEILINGS } from './defaults';
import { assertMockCalls, type AssertMockCallsCriteria, type AssertMockCallsResult } from './assertMockCalls';
import type {
  ApiMockWorkspaceV1,
  ApiMockSimulationResultV1,
  ApiMockDiagnosticV1,
  ApiMockTransactionV1,
} from './contracts';

export interface CliSimulateOptions {
  workspace: ApiMockWorkspaceV1;
  serverId: string;
  /** When set, only simulate samples associated with this route. */
  routeId?: string;
}

export function cliSimulateSamples(options: CliSimulateOptions): ApiMockSimulationResultV1[] {
  const srv = options.workspace.servers.find(s => s.id === options.serverId);
  if (!srv) return [];
  const samples = (srv.samples ?? []).filter(s => (
    !options.routeId
    || s.routeId === options.routeId
    || s.expected?.routeId === options.routeId
  ));
  return simulateBatch(samples, {
    routes: srv.routes,
    settings: srv.settings,
    basePath: srv.basePath,
    variables: srv.variables,
  });
}

export interface CliLoadResult {
  workspace: ApiMockWorkspaceV1;
  diagnostics: ApiMockDiagnosticV1[];
  validationErrors: string[];
}

export function cliLoadAndValidate(raw: Record<string, unknown>): CliLoadResult {
  const { workspace: migrated, diagnostics } = migrateWorkspace(raw);
  const workspace = {
    ...migrated,
    servers: Array.isArray(migrated.servers) ? migrated.servers : [],
  };
  const validationErrors: string[] = [];
  for (const srv of workspace.servers) {
    const diags = validateServer(srv);
    for (const d of diags) {
      if (d.severity === 'error') validationErrors.push(`${srv.id}: ${d.message}`);
    }
  }
  return { workspace, diagnostics, validationErrors };
}

export interface CliFetchJournalOptions {
  controlBase: string;
  serverId: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}

export async function cliFetchJournal(options: CliFetchJournalOptions): Promise<
  { ok: true; transactions: ApiMockTransactionV1[] } | { ok: false; error: string }
> {
  const base = options.controlBase.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? HARD_CEILINGS.maxJournalEntries;
  try {
    const res = await fetchImpl(
      `${base}/api/mock/servers/${encodeURIComponent(options.serverId)}/transactions?limit=${limit}`,
    );
    const body = await res.json() as {
      ok?: boolean;
      data?: { transactions?: ApiMockTransactionV1[] };
      error?: { message?: string };
    };
    if (!res.ok || body.ok === false) {
      return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, transactions: body.data?.transactions ?? [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error
        ? `${e.message} — start the companion with \`npm run server:dev\`, or pass --simulate for offline corpus checks.`
        : 'Companion unreachable',
    };
  }
}

export function cliAssertJournal(
  transactions: ApiMockTransactionV1[],
  criteria: AssertMockCallsCriteria,
): AssertMockCallsResult {
  return assertMockCalls(transactions, criteria);
}

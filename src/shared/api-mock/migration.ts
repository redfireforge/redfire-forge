/**
 * API Mock Studio — schema migration framework (Phase 1A).
 * Pure functions: no side effects, no storage, no network.
 */
import type { ApiMockDiagnosticV1, ApiMockMigration, ApiMockWorkspaceV1 } from './contracts';
import { CURRENT_SCHEMA_VERSION } from './defaults';

const migrations: ApiMockMigration[] = [];

export function registerMigration(m: ApiMockMigration): void {
  migrations.push(m);
  migrations.sort((a, b) => a.fromVersion - b.fromVersion);
}

export interface MigrationResult {
  workspace: ApiMockWorkspaceV1;
  diagnostics: ApiMockDiagnosticV1[];
  migrated: boolean;
}

export function migrateWorkspace(raw: Record<string, unknown>): MigrationResult {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  const diagnostics: ApiMockDiagnosticV1[] = [];

  if (version > CURRENT_SCHEMA_VERSION) {
    diagnostics.push({
      code: 'AMS-IMPORT-VERSION-UNKNOWN',
      severity: 'error',
      path: '/schemaVersion',
      message: `Schema version ${version} is not supported (current: ${CURRENT_SCHEMA_VERSION})`,
      remediation: 'Use a newer version of RedfireForge or export from a compatible version',
    });
    return { workspace: raw as unknown as ApiMockWorkspaceV1, diagnostics, migrated: false };
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    return { workspace: normalizeV1(raw), diagnostics, migrated: false };
  }

  let data = raw;
  let currentVersion = version;
  for (const m of migrations) {
    if (m.fromVersion !== currentVersion) continue;
    const result = m.migrate(data);
    data = result.result;
    diagnostics.push(...result.diagnostics);
    currentVersion = m.toVersion;
    if (currentVersion === CURRENT_SCHEMA_VERSION) break;
  }

  if (currentVersion !== CURRENT_SCHEMA_VERSION) {
    diagnostics.push({
      code: 'AMS-IMPORT-VERSION-UNKNOWN',
      severity: 'error',
      path: '/schemaVersion',
      message: `No migration path from version ${version} to ${CURRENT_SCHEMA_VERSION}`,
    });
    return { workspace: data as unknown as ApiMockWorkspaceV1, diagnostics, migrated: false };
  }

  return { workspace: normalizeV1(data), diagnostics, migrated: true };
}

function normalizeV1(raw: Record<string, unknown>): ApiMockWorkspaceV1 {
  return {
    schemaVersion: 1,
    activeServerId: typeof raw.activeServerId === 'string' ? raw.activeServerId : undefined,
    servers: Array.isArray(raw.servers) ? raw.servers : [],
    tabOrder: Array.isArray(raw.tabOrder) ? raw.tabOrder : [],
    // Preserved as-is: an explicit empty array means "library only, no open tabs",
    // while `undefined` means a pre-library workspace where every server was open.
    openTabIds: Array.isArray(raw.openTabIds) ? raw.openTabIds : undefined,
  } as ApiMockWorkspaceV1;
}

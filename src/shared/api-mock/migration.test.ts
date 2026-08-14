/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { migrateWorkspace } from './migration';
import { CURRENT_SCHEMA_VERSION } from './defaults';

describe('migrateWorkspace', () => {
  it('accepts current schema version', () => {
    const result = migrateWorkspace({ schemaVersion: CURRENT_SCHEMA_VERSION, servers: [], tabOrder: [] });
    expect(result.migrated).toBe(false);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.workspace.schemaVersion).toBe(1);
  });

  it('rejects future schema versions', () => {
    const result = migrateWorkspace({ schemaVersion: 999, servers: [], tabOrder: [] });
    expect(result.migrated).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('AMS-IMPORT-VERSION-UNKNOWN');
  });

  it('normalizes missing optional fields', () => {
    const result = migrateWorkspace({ schemaVersion: 1 });
    expect(result.workspace.servers).toEqual([]);
    expect(result.workspace.tabOrder).toEqual([]);
    expect(result.workspace.activeServerId).toBeUndefined();
    // Absent means "pre-library workspace" — the loader then opens every server.
    expect(result.workspace.openTabIds).toBeUndefined();
  });

  it('preserves an explicit open-tab list, including the empty one', () => {
    expect(migrateWorkspace({ schemaVersion: 1, openTabIds: ['srv-1'] }).workspace.openTabIds).toEqual(['srv-1']);
    expect(migrateWorkspace({ schemaVersion: 1, openTabIds: [] }).workspace.openTabIds).toEqual([]);
    expect(migrateWorkspace({ schemaVersion: 1, openTabIds: 'nope' }).workspace.openTabIds).toBeUndefined();
  });

  it('rejects unknown versions with no migration path', () => {
    const result = migrateWorkspace({ schemaVersion: 0 });
    expect(result.diagnostics.some(d => d.code === 'AMS-IMPORT-VERSION-UNKNOWN')).toBe(true);
  });

  it('registers migrations in version order and applies them successfully', async () => {
    vi.resetModules();
    const { registerMigration, migrateWorkspace } = await import('./migration');

    registerMigration({
      fromVersion: 1,
      toVersion: 2,
      migrate: (input) => ({ result: { ...input, schemaVersion: 2 }, diagnostics: [] }),
    } as any);
    registerMigration({
      fromVersion: 0,
      toVersion: 1,
      migrate: (input) => ({
        result: { schemaVersion: 1, servers: [], tabOrder: [], activeServerId: input.activeServerId },
        diagnostics: [{ code: 'AMS-IMPORT-MIGRATED', severity: 'info', path: '/', message: 'migrated' }],
      }),
    } as any);

    const result = migrateWorkspace({ schemaVersion: 0, activeServerId: 'srv-1' });
    expect(result.migrated).toBe(true);
    expect(result.workspace.schemaVersion).toBe(1);
    expect(result.workspace.activeServerId).toBe('srv-1');
    expect(result.diagnostics.some(d => d.code === 'AMS-IMPORT-MIGRATED')).toBe(true);
  });

  it('stops at a missing intermediate migration path', async () => {
    vi.resetModules();
    const { registerMigration, migrateWorkspace } = await import('./migration');
    registerMigration({
      fromVersion: 0,
      toVersion: 1,
      migrate: (_input) => ({ result: { schemaVersion: 1, servers: [], tabOrder: [] }, diagnostics: [] }),
    } as any);

    const result = migrateWorkspace({ schemaVersion: 2 });
    expect(result.migrated).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'AMS-IMPORT-VERSION-UNKNOWN')).toBe(true);
  });

  it('defaults missing schemaVersion to 0 and walks a multi-step chain with skipped migrations', async () => {
    vi.resetModules();
    const { registerMigration, migrateWorkspace } = await import('./migration');
    registerMigration({
      fromVersion: -1,
      toVersion: 0,
      migrate: (input) => ({ result: input, diagnostics: [] }),
    } as any);
    registerMigration({
      fromVersion: 0,
      toVersion: 0,
      migrate: (input) => ({ result: input, diagnostics: [{ code: 'AMS-IMPORT-NOOP', severity: 'info', path: '/', message: 'noop' }] }),
    } as any);
    registerMigration({
      fromVersion: 0,
      toVersion: 1,
      migrate: () => ({ result: { schemaVersion: 1, servers: [], tabOrder: [] }, diagnostics: [] }),
    } as any);

    const result = migrateWorkspace({});
    expect(result.migrated).toBe(true);
    expect(result.workspace.schemaVersion).toBe(1);
    expect(result.diagnostics.some(d => d.code === 'AMS-IMPORT-NOOP')).toBe(true);
  });
});

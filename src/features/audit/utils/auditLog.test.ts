/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadAuditLog,
  addAuditEntry,
  clearAuditLog,
  deleteAuditEntry,
  computeChanges,
  logEnvironmentCreated,
  logEnvironmentDeleted,
  logEnvironmentRenamed,
  logMicroserviceCreated,
  logMicroserviceDeleted,
  logMicroserviceUpdated,
  logAuthProfileCreated,
  logAuthProfileDeleted,
  logAuthProfileUpdated,
  logAuthProfileRenamed,
  auditLogToCsv,
  formatAction,
  formatEntityType,
} from './auditLog';

// Mock platform to always use localStorage (non-Tauri)
vi.mock('../../../shared/utils/platform', () => ({ isTauri: () => false }));

const AUDIT_LOG_KEY = 'perf-test-audit-log';

beforeEach(() => {
  localStorage.clear();
});

describe('loadAuditLog', () => {
  it('returns empty array when no data', async () => {
    expect(await loadAuditLog()).toEqual([]);
  });

  it('returns empty array when data is invalid JSON', async () => {
    localStorage.setItem(AUDIT_LOG_KEY, '{bad json');
    expect(await loadAuditLog()).toEqual([]);
  });

  it('returns empty array when data is not an array', async () => {
    localStorage.setItem(AUDIT_LOG_KEY, '{"not": "array"}');
    expect(await loadAuditLog()).toEqual([]);
  });

  it('loads stored entries', async () => {
    const entries = [{ id: 'a', timestamp: 1, entityType: 'environment', entityId: 'e1', entityName: 'prod', action: 'created' }];
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries));
    const result = await loadAuditLog();
    expect(result).toEqual(entries);
  });
});

describe('addAuditEntry', () => {
  it('appends entry with id and timestamp', async () => {
    const entry = await addAuditEntry({
      entityType: 'environment',
      entityId: 'e1',
      entityName: 'staging',
      action: 'created',
    });
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.entityName).toBe('staging');

    const log = await loadAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].id).toBe(entry.id);
  });

  it('evicts oldest entries when exceeding max', async () => {
    for (let i = 0; i < 5; i++) {
      await addAuditEntry({
        entityType: 'environment',
        entityId: `e${i}`,
        entityName: `env-${i}`,
        action: 'created',
      }, 3);
    }
    const log = await loadAuditLog();
    expect(log).toHaveLength(3);
    expect(log[0].entityName).toBe('env-2');
    expect(log[2].entityName).toBe('env-4');
  });
});

describe('clearAuditLog', () => {
  it('removes all entries', async () => {
    await addAuditEntry({ entityType: 'environment', entityId: 'e1', entityName: 'x', action: 'created' });
    await clearAuditLog();
    expect(await loadAuditLog()).toEqual([]);
  });
});

describe('deleteAuditEntry', () => {
  it('removes a specific entry by id', async () => {
    const e1 = await addAuditEntry({ entityType: 'environment', entityId: 'a', entityName: 'a', action: 'created' });
    const e2 = await addAuditEntry({ entityType: 'microservice', entityId: 'b', entityName: 'b', action: 'created' });
    await deleteAuditEntry(e1.id);
    const log = await loadAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].id).toBe(e2.id);
  });
});

describe('computeChanges', () => {
  it('returns empty array when objects are equal', () => {
    expect(computeChanges({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual([]);
  });

  it('detects added fields', () => {
    const changes = computeChanges({}, { a: 1 });
    expect(changes).toEqual([{ field: 'a', oldValue: undefined, newValue: 1 }]);
  });

  it('detects removed fields', () => {
    const changes = computeChanges({ a: 1 }, {});
    expect(changes).toEqual([{ field: 'a', oldValue: 1, newValue: undefined }]);
  });

  it('detects changed values', () => {
    const changes = computeChanges({ url: 'old' }, { url: 'new' });
    expect(changes).toEqual([{ field: 'url', oldValue: 'old', newValue: 'new' }]);
  });

  it('detects deep changes', () => {
    const changes = computeChanges({ config: { a: 1 } }, { config: { a: 2 } });
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('config');
  });

  it('filters to specified fields', () => {
    const changes = computeChanges({ a: 1, b: 2 }, { a: 10, b: 20 }, ['a']);
    expect(changes).toEqual([{ field: 'a', oldValue: 1, newValue: 10 }]);
  });
});

describe('convenience loggers', () => {
  it('logEnvironmentCreated', async () => {
    await logEnvironmentCreated('prod', 'e1');
    const log = await loadAuditLog();
    expect(log[0].entityType).toBe('environment');
    expect(log[0].action).toBe('created');
    expect(log[0].entityName).toBe('prod');
  });

  it('logEnvironmentDeleted', async () => {
    await logEnvironmentDeleted('staging', 'e2');
    const log = await loadAuditLog();
    expect(log[0].action).toBe('deleted');
  });

  it('logEnvironmentRenamed', async () => {
    await logEnvironmentRenamed('e1', 'old', 'new');
    const log = await loadAuditLog();
    expect(log[0].action).toBe('renamed');
    expect(log[0].changes).toEqual([{ field: 'name', oldValue: 'old', newValue: 'new' }]);
  });

  it('logMicroserviceCreated', async () => {
    await logMicroserviceCreated('api-svc', 's1');
    const log = await loadAuditLog();
    expect(log[0].entityType).toBe('microservice');
    expect(log[0].action).toBe('created');
  });

  it('logMicroserviceDeleted', async () => {
    await logMicroserviceDeleted('old-svc', 's2');
    const log = await loadAuditLog();
    expect(log[0].action).toBe('deleted');
  });

  it('logMicroserviceUpdated with changes', async () => {
    await logMicroserviceUpdated('svc', 's1', [{ field: 'baseUrl', oldValue: 'old', newValue: 'new' }]);
    const log = await loadAuditLog();
    expect(log[0].action).toBe('updated');
    expect(log[0].changes).toHaveLength(1);
  });

  it('logMicroserviceUpdated skips when no changes', async () => {
    await logMicroserviceUpdated('svc', 's1', []);
    const log = await loadAuditLog();
    expect(log).toHaveLength(0);
  });

  it('logAuthProfileCreated', async () => {
    await logAuthProfileCreated('my-auth', 'a1');
    const log = await loadAuditLog();
    expect(log[0].entityType).toBe('authProfile');
    expect(log[0].action).toBe('created');
  });

  it('logAuthProfileDeleted', async () => {
    await logAuthProfileDeleted('old-auth', 'a2');
    const log = await loadAuditLog();
    expect(log[0].action).toBe('deleted');
  });

  it('logAuthProfileUpdated', async () => {
    await logAuthProfileUpdated('auth', 'a1', [{ field: 'type', oldValue: 'none', newValue: 'bearer' }]);
    const log = await loadAuditLog();
    expect(log[0].action).toBe('updated');
  });

  it('logAuthProfileRenamed', async () => {
    await logAuthProfileRenamed('a1', 'old-name', 'new-name');
    const log = await loadAuditLog();
    expect(log[0].action).toBe('renamed');
    expect(log[0].entityName).toBe('new-name');
  });
});

describe('auditLogToCsv', () => {
  it('generates CSV with header and data rows', () => {
    const entries = [
      { id: 'a', timestamp: 1700000000000, entityType: 'environment' as const, entityId: 'e1', entityName: 'prod', action: 'created' as const },
      { id: 'b', timestamp: 1700000001000, entityType: 'microservice' as const, entityId: 's1', entityName: 'api', action: 'updated' as const, changes: [{ field: 'baseUrl', oldValue: 'old', newValue: 'new' }] },
    ];
    const csv = auditLogToCsv(entries);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Timestamp,Entity Type,Entity Name,Action,Changes');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('environment');
    expect(lines[1]).toContain('prod');
    expect(lines[2]).toContain('baseUrl');
  });

  it('handles empty entries', () => {
    const csv = auditLogToCsv([]);
    expect(csv).toBe('Timestamp,Entity Type,Entity Name,Action,Changes');
  });

  it('escapes quotes in entity name', () => {
    const entries = [
      { id: 'a', timestamp: 1700000000000, entityType: 'environment' as const, entityId: 'e1', entityName: 'my "env"', action: 'created' as const },
    ];
    const csv = auditLogToCsv(entries);
    expect(csv).toContain('my ""env""');
  });
});

describe('formatAction', () => {
  it('returns human-readable labels', () => {
    expect(formatAction('created')).toBe('Created');
    expect(formatAction('updated')).toBe('Updated');
    expect(formatAction('deleted')).toBe('Deleted');
    expect(formatAction('renamed')).toBe('Renamed');
  });
});

describe('formatEntityType', () => {
  it('returns human-readable labels', () => {
    expect(formatEntityType('environment')).toBe('Environment');
    expect(formatEntityType('microservice')).toBe('Microservice');
    expect(formatEntityType('authProfile')).toBe('Auth Profile');
  });
});

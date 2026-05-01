import { v4 as uuidv4 } from 'uuid';
import { isTauri } from '../../../shared/utils/platform';

// ── Types ──

export type AuditEntityType = 'environment' | 'microservice' | 'authProfile';
export type AuditAction = 'created' | 'updated' | 'deleted' | 'renamed';

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  action: AuditAction;
  changes?: AuditChange[];
}

// ── Constants ──

const AUDIT_LOG_KEY = 'perf-test-audit-log';
const DEFAULT_MAX_ENTRIES = 500;

// ── Storage helpers ──

async function readKey(key: string): Promise<string | null> {
  if (isTauri()) {
    const { getItem } = await import('../../../shared/utils/tauriStore');
    return getItem(key);
  }
  return localStorage.getItem(key);
}

async function writeKey(key: string, value: string): Promise<void> {
  if (isTauri()) {
    const { setItem } = await import('../../../shared/utils/tauriStore');
    return setItem(key, value);
  }
  localStorage.setItem(key, value);
}

// ── Core API ──

/** Load all audit entries from storage. */
export async function loadAuditLog(): Promise<AuditEntry[]> {
  const raw = await readKey(AUDIT_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save audit entries to storage. */
async function saveAuditLog(entries: AuditEntry[]): Promise<void> {
  await writeKey(AUDIT_LOG_KEY, JSON.stringify(entries));
}

/** Append a new audit entry. FIFO eviction at max. */
export async function addAuditEntry(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>,
  maxEntries = DEFAULT_MAX_ENTRIES,
): Promise<AuditEntry> {
  const full: AuditEntry = {
    ...entry,
    id: uuidv4(),
    timestamp: Date.now(),
  };
  const log = await loadAuditLog();
  log.push(full);
  // FIFO eviction — remove oldest when over cap
  while (log.length > maxEntries) log.shift();
  await saveAuditLog(log);
  return full;
}

/** Clear entire audit log. */
export async function clearAuditLog(): Promise<void> {
  await saveAuditLog([]);
}

/** Delete a single audit entry by ID. */
export async function deleteAuditEntry(id: string): Promise<void> {
  const log = await loadAuditLog();
  await saveAuditLog(log.filter((e) => e.id !== id));
}

// ── Diff helpers ──

/** Compute field-level changes between two plain objects. */
export function computeChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields?: string[],
): AuditChange[] {
  const keys = fields ?? [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];
  const changes: AuditChange[] = [];
  for (const key of keys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
}

// ── Convenience loggers ──

export function logEnvironmentCreated(name: string, id: string) {
  return addAuditEntry({ entityType: 'environment', entityId: id, entityName: name, action: 'created' });
}

export function logEnvironmentDeleted(name: string, id: string) {
  return addAuditEntry({ entityType: 'environment', entityId: id, entityName: name, action: 'deleted' });
}

export function logEnvironmentRenamed(id: string, oldName: string, newName: string) {
  return addAuditEntry({
    entityType: 'environment',
    entityId: id,
    entityName: newName,
    action: 'renamed',
    changes: [{ field: 'name', oldValue: oldName, newValue: newName }],
  });
}

export function logMicroserviceCreated(name: string, id: string) {
  return addAuditEntry({ entityType: 'microservice', entityId: id, entityName: name, action: 'created' });
}

export function logMicroserviceDeleted(name: string, id: string) {
  return addAuditEntry({ entityType: 'microservice', entityId: id, entityName: name, action: 'deleted' });
}

export function logMicroserviceUpdated(name: string, id: string, changes: AuditChange[]) {
  if (changes.length === 0) return Promise.resolve(undefined);
  return addAuditEntry({ entityType: 'microservice', entityId: id, entityName: name, action: 'updated', changes });
}

export function logAuthProfileCreated(name: string, id: string) {
  return addAuditEntry({ entityType: 'authProfile', entityId: id, entityName: name, action: 'created' });
}

export function logAuthProfileDeleted(name: string, id: string) {
  return addAuditEntry({ entityType: 'authProfile', entityId: id, entityName: name, action: 'deleted' });
}

export function logAuthProfileUpdated(name: string, id: string, changes: AuditChange[]) {
  if (changes.length === 0) return Promise.resolve(undefined);
  return addAuditEntry({ entityType: 'authProfile', entityId: id, entityName: name, action: 'updated', changes });
}

export function logAuthProfileRenamed(id: string, oldName: string, newName: string) {
  return addAuditEntry({
    entityType: 'authProfile',
    entityId: id,
    entityName: newName,
    action: 'renamed',
    changes: [{ field: 'name', oldValue: oldName, newValue: newName }],
  });
}

// ── Export helpers ──

/** Format audit log as CSV string. */
export function auditLogToCsv(entries: AuditEntry[]): string {
  const header = 'Timestamp,Entity Type,Entity Name,Action,Changes';
  const rows = entries.map((e) => {
    const ts = new Date(e.timestamp).toISOString();
    const changes = e.changes
      ? e.changes.map((c) => `${c.field}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`).join('; ')
      : '';
    return `"${ts}","${e.entityType}","${e.entityName.replace(/"/g, '""')}","${e.action}","${changes.replace(/"/g, '""')}"`;
  });
  return [header, ...rows].join('\n');
}

/** Format human-readable action label. */
export function formatAction(action: AuditAction): string {
  switch (action) {
    case 'created': return 'Created';
    case 'updated': return 'Updated';
    case 'deleted': return 'Deleted';
    case 'renamed': return 'Renamed';
  }
}

/** Format entity type label. */
export function formatEntityType(type: AuditEntityType): string {
  switch (type) {
    case 'environment': return 'Environment';
    case 'microservice': return 'Microservice';
    case 'authProfile': return 'Auth Profile';
  }
}

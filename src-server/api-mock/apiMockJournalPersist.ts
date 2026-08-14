/**
 * Capped, redacted journal snapshots on disk (OS temp dir).
 * Writes never throw into the request path.
 */
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ApiMockTransactionV1 } from '../../src/shared/api-mock/contracts.js';

export interface JournalSnapshot {
  cursor: number;
  transactions: ApiMockTransactionV1[];
  drops?: number;
  truncations?: number;
}

export function journalPersistPath(serverId: string): string {
  const hash = createHash('sha1').update(serverId).digest('hex').slice(0, 10);
  const safe = serverId.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/\.\./g, '_').slice(0, 60) || 'server';
  return join(tmpdir(), 'redfireforge-api-mock-journals', `${safe}-${hash}.json`);
}

function isPersistableTx(value: unknown): value is ApiMockTransactionV1 {
  if (!value || typeof value !== 'object') return false;
  const tx = value as ApiMockTransactionV1;
  return typeof tx.id === 'string'
    && !!tx.request
    && typeof tx.request.method === 'string'
    && typeof tx.request.path === 'string'
    && !!tx.request.headers
    && typeof tx.request.headers === 'object'
    && !Array.isArray(tx.request.headers);
}

function nonNegInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function loadJournalSnapshot(file: string): JournalSnapshot | null {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as JournalSnapshot;
    if (!parsed || typeof parsed.cursor !== 'number' || !Number.isFinite(parsed.cursor) || !Array.isArray(parsed.transactions)) {
      return null;
    }
    return {
      cursor: parsed.cursor,
      transactions: parsed.transactions.filter(isPersistableTx),
      drops: nonNegInt(parsed.drops),
      truncations: nonNegInt(parsed.truncations),
    };
  } catch {
    return null;
  }
}

export function saveJournalSnapshot(file: string, snapshot: JournalSnapshot): void {
  try {
    const dir = dirname(file);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { chmodSync(dir, 0o700); } catch { /* existing dir / platform */ }
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot), { encoding: 'utf8', mode: 0o600 });
    renameSync(tmp, file);
    try { chmodSync(file, 0o600); } catch { /* platform */ }
  } catch {
    // Isolation: a full disk or permission error must not fail the mock response.
  }
}

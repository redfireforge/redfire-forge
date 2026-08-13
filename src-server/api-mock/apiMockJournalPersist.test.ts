import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  journalPersistPath,
  loadJournalSnapshot,
  saveJournalSnapshot,
} from './apiMockJournalPersist';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'am-jp-'));
  dirs.push(dir);
  return dir;
}

describe('apiMockJournalPersist', () => {
  it('sanitizes server ids into a temp-dir path', () => {
    const path = journalPersistPath('srv/../evil id!');
    expect(path).toContain('redfireforge-api-mock-journals');
    expect(path).toMatch(/srv_+evil_id_-[0-9a-f]{10}\.json$/);
    expect(journalPersistPath('')).toMatch(/server-[0-9a-f]{10}\.json$/);
    expect(journalPersistPath('foo/bar')).not.toBe(journalPersistPath('foo_bar'));
  });

  it('round-trips a snapshot and returns null for missing or corrupt files', () => {
    const dir = tmpDir();
    const file = join(dir, 'j.json');
    expect(loadJournalSnapshot(file)).toBeNull();
    writeFileSync(file, '{not json', 'utf8');
    expect(loadJournalSnapshot(file)).toBeNull();
    writeFileSync(file, JSON.stringify({ cursor: 'x', transactions: [] }), 'utf8');
    expect(loadJournalSnapshot(file)).toBeNull();
    writeFileSync(file, '{"cursor":1e1000,"transactions":[]}', 'utf8');
    expect(loadJournalSnapshot(file)).toBeNull();
    writeFileSync(file, JSON.stringify({
      cursor: 2,
      transactions: [
        { id: 'tx-ok', request: { method: 'GET', path: '/ok', headers: {} } },
        { id: 'tx-no-headers', request: { method: 'GET', path: '/x' } },
        { id: 'tx-array-headers', request: { method: 'GET', path: '/y', headers: ['bad'] } },
        null,
        { id: 'nope' },
        'bad',
      ],
    }), 'utf8');
    expect(loadJournalSnapshot(file)).toEqual({
      cursor: 2,
      transactions: [{ id: 'tx-ok', request: { method: 'GET', path: '/ok', headers: {} } }],
      drops: 0,
      truncations: 0,
    });

    saveJournalSnapshot(file, { cursor: 3, transactions: [], drops: 4, truncations: 2 });
    expect(loadJournalSnapshot(file)).toEqual({ cursor: 3, transactions: [], drops: 4, truncations: 2 });
    expect(JSON.parse(readFileSync(file, 'utf8')).cursor).toBe(3);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    writeFileSync(file, JSON.stringify({ cursor: 1, transactions: [], drops: -2, truncations: 'nope' }), 'utf8');
    expect(loadJournalSnapshot(file)).toEqual({ cursor: 1, transactions: [], drops: 0, truncations: 0 });
  });

  it('swallows write failures without throwing', () => {
    const dir = tmpDir();
    const blocker = join(dir, 'blocker');
    writeFileSync(blocker, 'not-a-dir', 'utf8');
    expect(() => saveJournalSnapshot(join(blocker, 'journal.json'), { cursor: 1, transactions: [] })).not.toThrow();
  });
});

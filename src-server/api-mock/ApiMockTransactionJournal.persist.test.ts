import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiMockTransactionJournal } from './ApiMockTransactionJournal';
import { DEFAULT_SETTINGS } from '../../src/shared/api-mock/defaults';
import type { ApiMockTransactionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-11T00:00:00.000Z';
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

function persistFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'am-j-'));
  dirs.push(dir);
  return join(dir, 'srv.json');
}

function makeTx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    serverId: 'srv-1', generation: 1, receivedAt: ts,
    request: {
      method: 'GET', path: '/test', rawPath: '/test', query: {}, cookies: {},
      headers: { authorization: ['Bearer secret-token'] },
      body: null, bodyTruncated: false, receivedAt: ts,
    },
    outcome: 'matched', matchedRouteId: 'r1',
    explanation: {
      normalizedRequest: { method: 'GET', path: '/test', decodedPath: '/test', pathSegments: ['test'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
      candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' },
      nearMisses: [],
    },
    ...overrides,
  };
}

function persistSettings(on: boolean) {
  return { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, persistToDisk: on, maxEntries: 5 } };
}

describe('ApiMockTransactionJournal persistToDisk', () => {
  it('does not write when persistToDisk is off even with a persist file', () => {
    const file = persistFile();
    const journal = new ApiMockTransactionJournal(persistSettings(false), { persistFile: file });
    journal.append(makeTx());
    expect(existsSync(file)).toBe(false);
  });

  it('writes a redacted snapshot and reloads it', () => {
    const file = persistFile();
    const first = new ApiMockTransactionJournal(persistSettings(true), { persistFile: file });
    first.append(makeTx({ id: 'tx-keep' }));
    const raw = readFileSync(file, 'utf8');
    expect(raw).toContain('tx-keep');
    expect(raw).toContain('Bearer [REDACTED]');
    expect(raw).not.toContain('secret-token');

    const reloaded = new ApiMockTransactionJournal(persistSettings(true), { persistFile: file });
    expect(reloaded.size()).toBe(1);
    expect(reloaded.getAll()[0].id).toBe('tx-keep');
    expect(reloaded.query().cursor).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 6; i++) reloaded.append(makeTx({ id: `tx-wrap-${i}` }));
    expect(reloaded.size()).toBe(5);
    expect(reloaded.getStats().drops).toBe(2);
  });

  it('restores drop and truncation counters from the snapshot', () => {
    const file = persistFile();
    const settings = {
      ...persistSettings(true),
      journal: { ...persistSettings(true).journal, persistToDisk: true, maxEntries: 2, maxCapturedBodyBytes: 8 },
    };
    const first = new ApiMockTransactionJournal(settings, { persistFile: file });
    first.append(makeTx({ request: { ...makeTx().request, body: 'abcdefghijklmnop' } }));
    first.append(makeTx());
    first.append(makeTx());
    const stats = first.getStats();
    expect(stats.drops).toBeGreaterThan(0);
    expect(stats.truncations).toBeGreaterThan(0);

    const reloaded = new ApiMockTransactionJournal(settings, { persistFile: file });
    expect(reloaded.getStats().drops).toBe(stats.drops);
    expect(reloaded.getStats().truncations).toBe(stats.truncations);
  });

  it('redacts configured JSONPath body fields in the on-disk snapshot', () => {
    const file = persistFile();
    const settings = {
      ...persistSettings(true),
      redaction: { ...DEFAULT_SETTINGS.redaction, jsonPaths: ['$.password'] },
    };
    const journal = new ApiMockTransactionJournal(settings, { persistFile: file });
    journal.append(makeTx({
      id: 'tx-body',
      request: { ...makeTx().request, body: '{"password":"disk-secret","ok":true}' },
    }));
    const raw = readFileSync(file, 'utf8');
    expect(raw).not.toContain('disk-secret');
    expect(raw).toContain('[REDACTED]');
  });

  it('starts empty when the snapshot file is corrupt', () => {
    const file = persistFile();
    writeFileSync(file, '{nope', 'utf8');
    const journal = new ApiMockTransactionJournal(persistSettings(true), { persistFile: file });
    expect(journal.size()).toBe(0);
    journal.append(makeTx({ id: 'tx-after' }));
    expect(journal.size()).toBe(1);
  });

  it('clears the snapshot and can enable persist after the fact', () => {
    const file = persistFile();
    const journal = new ApiMockTransactionJournal(persistSettings(true), { persistFile: file });
    journal.append(makeTx({ id: 'tx-1' }));
    journal.clear();
    expect(journal.size()).toBe(0);
    expect(JSON.parse(readFileSync(file, 'utf8')).transactions).toEqual([]);

    const lazy = new ApiMockTransactionJournal(persistSettings(false), { persistFile: file });
    lazy.append(makeTx({ id: 'tx-mem' }));
    expect(JSON.parse(readFileSync(file, 'utf8')).transactions).toEqual([]);
    lazy.updateSettings(persistSettings(true));
    lazy.updateSettings(persistSettings(true));
    expect(JSON.parse(readFileSync(file, 'utf8')).transactions[0].id).toBe('tx-mem');

    lazy.updateSettings(persistSettings(false));
    lazy.append(makeTx({ id: 'tx-not-flushed' }));
    expect(JSON.parse(readFileSync(file, 'utf8')).transactions).toHaveLength(1);
  });

  it('loads from disk when persist is enabled on an empty journal', () => {
    const file = persistFile();
    writeFileSync(file, JSON.stringify({
      cursor: 4,
      transactions: [makeTx({ id: 'tx-disk' })],
    }), 'utf8');
    const journal = new ApiMockTransactionJournal(persistSettings(false), { persistFile: file });
    expect(journal.size()).toBe(0);
    journal.updateSettings(persistSettings(true));
    expect(journal.getAll()[0].id).toBe('tx-disk');
    expect(journal.query().cursor).toBe(4);
  });

  it('re-redacts an older snapshot when persist is turned on', () => {
    const file = persistFile();
    writeFileSync(file, JSON.stringify({
      cursor: 1,
      transactions: [makeTx({
        id: 'tx-legacy',
        request: { ...makeTx().request, body: '{"password":"disk-secret"}', cookies: { sid: 'cookie-secret' } },
        response: {
          status: 200,
          headers: { 'set-cookie': ['sid=cookie-secret'] },
          cookies: [],
          body: null,
          bodyTruncated: false,
          durationMs: 1,
          generationAtResponse: 1,
        },
      })],
    }), 'utf8');
    const settings = {
      ...persistSettings(true),
      redaction: { ...DEFAULT_SETTINGS.redaction, jsonPaths: ['$.password'] },
    };
    const journal = new ApiMockTransactionJournal(settings, { persistFile: file });
    const tx = journal.getAll()[0];
    expect(tx.request.body).not.toContain('disk-secret');
    expect(tx.request.cookies.sid).toBe('[REDACTED]');
    expect(tx.response?.headers['set-cookie'][0]).toBe('[REDACTED]');
    expect(readFileSync(file, 'utf8')).not.toContain('disk-secret');
  });

  it('does not resurrect a snapshot after clear while persist is off', () => {
    const file = persistFile();
    const journal = new ApiMockTransactionJournal(persistSettings(true), { persistFile: file });
    journal.append(makeTx({ id: 'tx-old' }));
    journal.updateSettings(persistSettings(false));
    journal.clear();
    expect(journal.size()).toBe(0);
    expect(JSON.parse(readFileSync(file, 'utf8')).transactions).toEqual([]);

    journal.updateSettings(persistSettings(true));
    expect(journal.size()).toBe(0);
    expect(journal.getAll()).toEqual([]);
  });

  it('does not restore a snapshot while the journal is disabled', () => {
    const file = persistFile();
    const first = new ApiMockTransactionJournal(persistSettings(true), { persistFile: file });
    first.append(makeTx({ id: 'tx-keep' }));
    const disabled = {
      ...persistSettings(true),
      journal: { ...persistSettings(true).journal, persistToDisk: true, enabled: false },
    };
    const reloaded = new ApiMockTransactionJournal(disabled, { persistFile: file });
    expect(reloaded.size()).toBe(0);
    expect(existsSync(file)).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8')).transactions[0].id).toBe('tx-keep');

    reloaded.updateSettings(persistSettings(true));
    expect(reloaded.getAll()[0].id).toBe('tx-keep');
  });

  it('skips restore when the journal cap is zero', () => {
    const file = persistFile();
    writeFileSync(file, JSON.stringify({ cursor: 1, transactions: [makeTx({ id: 'tx-skip' })] }), 'utf8');
    const settings = {
      ...DEFAULT_SETTINGS,
      journal: { ...DEFAULT_SETTINGS.journal, persistToDisk: true, maxEntries: 0 },
    };
    const journal = new ApiMockTransactionJournal(settings, { persistFile: file });
    expect(journal.size()).toBe(0);
  });
});

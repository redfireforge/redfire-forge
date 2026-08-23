/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrashSettings } from '../types';
import { makeTrashItem } from '@test-utils/factories';

// Mock platform — defaults to non-Tauri (browser mode)
const mockIsTauri = vi.fn(() => false);
vi.mock('./platform', () => ({ isTauri: () => mockIsTauri() }));

// Mock IDB layer — always fall through so localStorage is used
vi.mock('./idbTrash', () => ({
  idbLoadTrash: vi.fn().mockResolvedValue(null),
  idbSaveTrash: vi.fn().mockRejectedValue(new Error('no IDB')),
}));

vi.mock('./storage', () => ({
  readKey: vi.fn(async (key: string) => localStorage.getItem(key)),
  writeKey: vi.fn(async (key: string, value: string) => { localStorage.setItem(key, value); }),
}));

import {
  loadTrash, saveTrash, addToTrash, removeFromTrash,
  purgeExpired, emptyTrash, loadTrashSettings, saveTrashSettings,
} from './trashStorage';

const TRASH_KEY = 'perf-test-v3-trash';
const SETTINGS_KEY = 'perf-test-v3-trash-settings';


describe('trashStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockIsTauri.mockReturnValue(false);
  });

  // ── loadTrash / saveTrash ──

  it('loads empty array when nothing stored', async () => {
    expect(await loadTrash()).toEqual([]);
  });

  it('saves and loads trash items', async () => {
    const items = [makeTrashItem({ id: 'a' }), makeTrashItem({ id: 'b' })];
    await saveTrash(items);
    const loaded = await loadTrash();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('a');
    expect(loaded[1].id).toBe('b');
  });

  it('handles corrupt localStorage data', async () => {
    localStorage.setItem(TRASH_KEY, 'not-json');
    expect(await loadTrash()).toEqual([]);
  });

  // ── addToTrash ──

  it('adds item to the front', async () => {
    const first = makeTrashItem({ id: 'first' });
    const second = makeTrashItem({ id: 'second' });
    await addToTrash(first);
    await addToTrash(second);
    const items = await loadTrash();
    expect(items[0].id).toBe('second');
    expect(items[1].id).toBe('first');
  });

  it('enforces maxItems — evicts expired first, then oldest', async () => {
    const settings: TrashSettings = { retentionDays: 30, maxItems: 3 };
    await saveTrashSettings(settings);

    const now = Date.now();
    const expired = makeTrashItem({ id: 'expired', deletedAt: now - 100_000, expiresAt: now - 1 });
    const old = makeTrashItem({ id: 'old', deletedAt: now - 50_000, expiresAt: now + 86_400_000 });
    const recent = makeTrashItem({ id: 'recent', deletedAt: now - 10_000, expiresAt: now + 86_400_000 });
    await saveTrash([expired, old, recent]);

    const newItem = makeTrashItem({ id: 'new' });
    await addToTrash(newItem);

    const items = await loadTrash();
    expect(items).toHaveLength(3);
    expect(items.map(i => i.id)).toEqual(['new', 'old', 'recent']);
  });

  it('evicts only enough expired items to reach max (early break)', async () => {
    const settings: TrashSettings = { retentionDays: 30, maxItems: 3 };
    await saveTrashSettings(settings);

    const now = Date.now();
    const e1 = makeTrashItem({ id: 'e1', expiresAt: now - 2 });
    const e2 = makeTrashItem({ id: 'e2', expiresAt: now - 1 });
    const valid1 = makeTrashItem({ id: 'v1', expiresAt: now + 86_400_000 });
    const valid2 = makeTrashItem({ id: 'v2', expiresAt: now + 86_400_000 });
    await saveTrash([e1, e2, valid1, valid2]);

    const newItem = makeTrashItem({ id: 'new' });
    await addToTrash(newItem);

    const items = await loadTrash();
    expect(items).toHaveLength(3);
    expect(items.some(i => i.id === 'new')).toBe(true);
    expect(items.some(i => i.id === 'v1')).toBe(true);
    expect(items.some(i => i.id === 'v2')).toBe(true);
  });

  it('evicts oldest non-expired when no expired items and at capacity', async () => {
    const settings: TrashSettings = { retentionDays: 30, maxItems: 2 };
    await saveTrashSettings(settings);

    const now = Date.now();
    const a = makeTrashItem({ id: 'a', deletedAt: now - 200, expiresAt: now + 86_400_000 });
    const b = makeTrashItem({ id: 'b', deletedAt: now - 100, expiresAt: now + 86_400_000 });
    await saveTrash([a, b]);

    const newItem = makeTrashItem({ id: 'new' });
    await addToTrash(newItem);

    const items = await loadTrash();
    expect(items).toHaveLength(2);
    expect(items.map(i => i.id)).toEqual(['new', 'a']);
  });

  // ── removeFromTrash ──

  it('removes by id', async () => {
    await saveTrash([makeTrashItem({ id: 'x' }), makeTrashItem({ id: 'y' })]);
    await removeFromTrash('x');
    const items = await loadTrash();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('y');
  });

  it('no-ops when id not found', async () => {
    await saveTrash([makeTrashItem({ id: 'x' })]);
    await removeFromTrash('missing');
    expect(await loadTrash()).toHaveLength(1);
  });

  // ── purgeExpired ──

  it('purges only expired items', async () => {
    const now = Date.now();
    const expired1 = makeTrashItem({ id: 'e1', expiresAt: now - 1000 });
    const expired2 = makeTrashItem({ id: 'e2', expiresAt: now - 1 });
    const valid = makeTrashItem({ id: 'v1', expiresAt: now + 86_400_000 });
    await saveTrash([expired1, valid, expired2]);

    const count = await purgeExpired();
    expect(count).toBe(2);
    const items = await loadTrash();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('v1');
  });

  it('returns 0 when nothing to purge', async () => {
    const valid = makeTrashItem({ id: 'v', expiresAt: Date.now() + 86_400_000 });
    await saveTrash([valid]);
    expect(await purgeExpired()).toBe(0);
  });

  it('returns 0 when trash is empty', async () => {
    expect(await purgeExpired()).toBe(0);
  });

  // ── emptyTrash ──

  it('removes all items', async () => {
    await saveTrash([makeTrashItem(), makeTrashItem(), makeTrashItem()]);
    await emptyTrash();
    expect(await loadTrash()).toEqual([]);
  });

  it('no-ops when already empty', async () => {
    await emptyTrash();
    expect(await loadTrash()).toEqual([]);
  });

  // ── Settings ──

  it('loads default settings when none stored', async () => {
    const settings = await loadTrashSettings();
    expect(settings).toEqual({ retentionDays: 30, maxItems: 100 });
  });

  it('saves and loads custom settings', async () => {
    await saveTrashSettings({ retentionDays: 7, maxItems: 50 });
    const settings = await loadTrashSettings();
    expect(settings).toEqual({ retentionDays: 7, maxItems: 50 });
  });

  it('fills missing fields with defaults', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ retentionDays: 14 }));
    const settings = await loadTrashSettings();
    expect(settings).toEqual({ retentionDays: 14, maxItems: 100 });
  });

  it('fills missing retentionDays with default', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ maxItems: 50 }));
    const settings = await loadTrashSettings();
    expect(settings).toEqual({ retentionDays: 30, maxItems: 50 });
  });

  it('returns defaults on corrupt settings data', async () => {
    localStorage.setItem(SETTINGS_KEY, 'not-json');
    const settings = await loadTrashSettings();
    expect(settings).toEqual({ retentionDays: 30, maxItems: 100 });
  });

  // ── IDB primary path ──

  it('loadTrash returns items from IDB when available', async () => {
    const { idbLoadTrash } = await import('./idbTrash');
    const items = [makeTrashItem({ id: 'idb-1' })];
    (idbLoadTrash as ReturnType<typeof vi.fn>).mockResolvedValueOnce(items);

    const loaded = await loadTrash();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('idb-1');
  });

  it('loadTrash falls back to localStorage when IDB throws', async () => {
    const { idbLoadTrash } = await import('./idbTrash');
    (idbLoadTrash as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('IDB crash'));

    const items = [makeTrashItem({ id: 'ls-1' })];
    localStorage.setItem(TRASH_KEY, JSON.stringify(items));

    const loaded = await loadTrash();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('ls-1');
  });

  it('saveTrash writes to IDB when available', async () => {
    const { idbSaveTrash } = await import('./idbTrash');
    (idbSaveTrash as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    const items = [makeTrashItem({ id: 'idb-s' })];
    await saveTrash(items);

    expect(idbSaveTrash).toHaveBeenCalledWith(items);
    // localStorage should NOT have been written to since IDB succeeded
    expect(localStorage.getItem(TRASH_KEY)).toBeNull();
  });

  it('saveTrash falls back to localStorage when IDB save fails', async () => {
    const { idbSaveTrash } = await import('./idbTrash');
    (idbSaveTrash as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('write fail'));

    const items = [makeTrashItem({ id: 'ls-s' })];
    await saveTrash(items);

    const raw = localStorage.getItem(TRASH_KEY);
    const stored = JSON.parse(raw!) as TrashItem[];
    expect(stored[0].id).toBe('ls-s');
  });

  // ── loadTrash with IDB returning data (success path) ──

  it('loadTrash returns IDB data when available', async () => {
    const { idbLoadTrash } = await import('./idbTrash');
    const items = [makeTrashItem({ id: 'idb-load' })];
    (idbLoadTrash as ReturnType<typeof vi.fn>).mockResolvedValueOnce(items);

    const result = await loadTrash();
    expect(result).toEqual(items);
  });

  // ── Tauri paths (readKey/writeKey fall back to localStorage in jsdom) ──

  it('loadTrash in Tauri mode bypasses IDB', async () => {
    mockIsTauri.mockReturnValue(true);
    const { idbLoadTrash } = await import('./idbTrash');
    (idbLoadTrash as ReturnType<typeof vi.fn>).mockClear();

    const items = [makeTrashItem({ id: 'tauri-load' })];
    localStorage.setItem(TRASH_KEY, JSON.stringify(items));

    const loaded = await loadTrash();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('tauri-load');
    expect(idbLoadTrash).not.toHaveBeenCalled();
  });

  it('saveTrash in Tauri mode bypasses IDB', async () => {
    mockIsTauri.mockReturnValue(true);
    const { idbSaveTrash } = await import('./idbTrash');
    (idbSaveTrash as ReturnType<typeof vi.fn>).mockClear();

    const items = [makeTrashItem({ id: 'tauri-save' })];
    await saveTrash(items);

    expect(idbSaveTrash).not.toHaveBeenCalled();
    const raw = localStorage.getItem(TRASH_KEY);
    const stored = JSON.parse(raw!) as TrashItem[];
    expect(stored[0].id).toBe('tauri-save');
  });
});

/**
 * Trash storage — dual-mode persistence for soft-deleted items.
 *
 * Web: IndexedDB primary → localStorage fallback.
 * Desktop (Tauri): Tauri FS via tauriStore.
 *
 * Follows the same pattern used by saveFeatureGroups/loadFeatureGroups in storage.ts.
 */

import type { TrashItem, TrashSettings } from '../types';
import { isTauri } from './platform';
import { idbLoadTrash, idbSaveTrash } from './idbTrash';
import { readKey, writeKey } from './storage';
import { DEFAULT_TRASH_SETTINGS } from './trashConstants';

const TRASH_KEY = 'perf-test-v3-trash';
const TRASH_SETTINGS_KEY = 'perf-test-v3-trash-settings';

// ── Settings ──

export async function loadTrashSettings(): Promise<TrashSettings> {
  try {
    const raw = await readKey(TRASH_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TrashSettings>;
      return {
        retentionDays: parsed.retentionDays ?? DEFAULT_TRASH_SETTINGS.retentionDays,
        maxItems: parsed.maxItems ?? DEFAULT_TRASH_SETTINGS.maxItems,
      };
    }
  } catch { /* use defaults */ }
  return { ...DEFAULT_TRASH_SETTINGS };
}

export async function saveTrashSettings(settings: TrashSettings): Promise<void> {
  await writeKey(TRASH_SETTINGS_KEY, JSON.stringify(settings));
}

// ── Core CRUD ──

export async function loadTrash(): Promise<TrashItem[]> {
  if (isTauri()) {
    return loadFromJson();
  }
  try {
    const fromIdb = await idbLoadTrash();
    if (fromIdb !== null) return fromIdb;
  } catch { /* fall through */ }
  return loadFromJson();
}

export async function saveTrash(items: TrashItem[]): Promise<void> {
  if (isTauri()) {
    await saveToJson(items);
    return;
  }
  try {
    await idbSaveTrash(items);
    return;
  } catch { /* fall through */ }
  await saveToJson(items);
}

export async function addToTrash(item: TrashItem): Promise<void> {
  const items = await loadTrash();
  const settings = await loadTrashSettings();

  items.unshift(item);

  enforceMaxItems(items, settings.maxItems);

  await saveTrash(items);
}

export async function removeFromTrash(id: string): Promise<void> {
  const items = await loadTrash();
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length !== items.length) {
    await saveTrash(filtered);
  }
}

export async function purgeExpired(): Promise<number> {
  const items = await loadTrash();
  const now = Date.now();
  const kept = items.filter(i => i.expiresAt > now);
  const purged = items.length - kept.length;
  if (purged > 0) {
    await saveTrash(kept);
  }
  return purged;
}

export async function emptyTrash(): Promise<void> {
  await saveTrash([]);
}

// ── Helpers ──

function enforceMaxItems(items: TrashItem[], max: number): void {
  if (items.length <= max) return;
  const now = Date.now();
  // Evict expired items first (oldest expired removed first)
  const expiredIndices: number[] = [];
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].expiresAt <= now) expiredIndices.push(i);
  }
  for (const idx of expiredIndices) {
    if (items.length <= max) break;
    items.splice(idx, 1);
  }
  // If still over limit, evict oldest non-expired items
  while (items.length > max) {
    items.pop();
  }
}

async function loadFromJson(): Promise<TrashItem[]> {
  try {
    const raw = await readKey(TRASH_KEY);
    if (raw) return JSON.parse(raw) as TrashItem[];
  } catch { /* corrupt data */ }
  return [];
}

async function saveToJson(items: TrashItem[]): Promise<void> {
  await writeKey(TRASH_KEY, JSON.stringify(items));
}

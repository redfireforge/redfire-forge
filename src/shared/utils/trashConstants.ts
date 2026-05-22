import type { TrashSettings } from '../types';

export const TRASH_MS_PER_DAY = 86_400_000;

export const DEFAULT_TRASH_SETTINGS: TrashSettings = {
  retentionDays: 30,
  maxItems: 100,
};

export const TRASH_RETENTION_OPTIONS = [7, 14, 30, 60, 90] as const;
export const TRASH_MAX_ITEMS_OPTIONS = [50, 100, 200] as const;

export const RESTORED_ITEMS_FG_NAME = 'Restored Items';
export const RESTORED_TESTS_SC_NAME = 'Restored Tests';
export const RESTORED_SUFFIX = ' (restored)';

export function computeExpiresAt(deletedAt: number, retentionDays: number): number {
  return deletedAt + retentionDays * TRASH_MS_PER_DAY;
}

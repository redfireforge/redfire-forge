/**
 * Phase 9 — Console settings persistence (shared by WS + SSE).
 *
 * Lives in the feature layer (not `shared/websocket`) to avoid a shared→feature
 * layering inversion, since the settings type is feature-owned. SSE reuses the
 * same `loadConsoleSettings`/`saveConsoleSettings` with its own key.
 */

import { readKey, writeKey } from '../../shared/utils/storage';
import { clampInt } from '../../shared/utils/persistSanitizers';
import type {
  WsConsoleCategoryFilter,
  WsConsoleLevelFilter,
  WsConsoleSettings,
  WsConsoleView,
} from './wsConsoleTypes';
import {
  WS_CONSOLE_CATEGORIES,
  WS_CONSOLE_DEFAULT_SETTINGS,
  WS_CONSOLE_LEVELS,
} from './wsConsoleTypes';

export const WS_CONSOLE_SETTINGS_KEY = 'redfire-ws-console-settings-v1';
export const SSE_CONSOLE_SETTINGS_KEY = 'redfire-sse-console-settings-v1';

const VIEWS = new Set<WsConsoleView>(['structured', 'raw']);
const LEVELS = new Set<string>(WS_CONSOLE_LEVELS);
const CATEGORIES = new Set<string>(WS_CONSOLE_CATEGORIES);

/** Corrupt-safe sanitizer: unknown JSON → a complete, valid settings object. */
export function sanitizeConsoleSettings(value: unknown): WsConsoleSettings {
  if (typeof value !== 'object' || value === null) {
    return { ...WS_CONSOLE_DEFAULT_SETTINGS };
  }
  const v = value as Record<string, unknown>;
  const view: WsConsoleView =
    typeof v.view === 'string' && VIEWS.has(v.view as WsConsoleView)
      ? (v.view as WsConsoleView)
      : WS_CONSOLE_DEFAULT_SETTINGS.view;
  const levelFilter: WsConsoleLevelFilter =
    v.levelFilter === 'all' || (typeof v.levelFilter === 'string' && LEVELS.has(v.levelFilter))
      ? (v.levelFilter as WsConsoleLevelFilter)
      : 'all';
  const categoryFilter: WsConsoleCategoryFilter =
    v.categoryFilter === 'all' ||
    (typeof v.categoryFilter === 'string' && CATEGORIES.has(v.categoryFilter))
      ? (v.categoryFilter as WsConsoleCategoryFilter)
      : 'all';
  return {
    view,
    levelFilter,
    categoryFilter,
    autoScroll:
      typeof v.autoScroll === 'boolean' ? v.autoScroll : WS_CONSOLE_DEFAULT_SETTINGS.autoScroll,
    maxEntries: clampInt(v.maxEntries, 50, 50000, WS_CONSOLE_DEFAULT_SETTINGS.maxEntries),
  };
}

export async function loadConsoleSettings(key: string): Promise<WsConsoleSettings> {
  const raw = await readKey(key);
  if (!raw) return { ...WS_CONSOLE_DEFAULT_SETTINGS };
  try {
    return sanitizeConsoleSettings(JSON.parse(raw));
  } catch {
    return { ...WS_CONSOLE_DEFAULT_SETTINGS };
  }
}

export async function saveConsoleSettings(
  key: string,
  settings: WsConsoleSettings,
): Promise<void> {
  await writeKey(key, JSON.stringify(settings));
}

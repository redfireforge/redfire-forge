/**
 * Phase 9 — Console feature shared types.
 *
 * A single `WsConsoleEntry` model powers BOTH the structured view (B, default)
 * and the Raw curl-verbose timeline (A). The two views render the SAME entries —
 * they differ only in presentation, so there is no data divergence. SSE reuses
 * this module (the console core lives in the websocket feature, mirroring how
 * `useSseConnection` reuses `wsAuthResolve`).
 */

export const WS_CONSOLE_LEVELS = ['info', 'warn', 'error', 'debug'] as const;
export type WsConsoleLevel = (typeof WS_CONSOLE_LEVELS)[number];

/** Glyph lane for the Raw timeline: `*` info, `>` out, `<` in, `$` command. */
export const WS_CONSOLE_DIRECTIONS = ['out', 'in', 'info', 'command'] as const;
export type WsConsoleDirection = (typeof WS_CONSOLE_DIRECTIONS)[number];

export const WS_CONSOLE_CATEGORIES = [
  'lifecycle',
  'handshake',
  'reconnect',
  'protocol',
  'control',
  'command',
  'system',
] as const;
export type WsConsoleCategory = (typeof WS_CONSOLE_CATEGORIES)[number];

/**
 * One console record. `detail` is an optional multi-line curl-verbose block
 * whose lines are prefixed (`> ` request / `< ` response / `* ` info). The
 * structured view renders it behind an expand chevron; the Raw view expands it
 * into per-line glyph rows via `parseRawConsoleLines`.
 */
export interface WsConsoleEntry {
  id: string;
  level: WsConsoleLevel;
  direction: WsConsoleDirection;
  category: WsConsoleCategory;
  message: string;
  detail?: string;
  timestamp: string;
}

export type WsConsoleView = 'structured' | 'raw';

export type WsConsoleLevelFilter = WsConsoleLevel | 'all';
export type WsConsoleCategoryFilter = WsConsoleCategory | 'all';

export interface WsConsoleSettings {
  view: WsConsoleView;
  levelFilter: WsConsoleLevelFilter;
  categoryFilter: WsConsoleCategoryFilter;
  autoScroll: boolean;
  /** Ring-buffer cap; older entries are dropped once exceeded. */
  maxEntries: number;
}

export const WS_CONSOLE_MAX_ENTRIES = 1000;

export const WS_CONSOLE_DEFAULT_SETTINGS: WsConsoleSettings = {
  view: 'structured',
  levelFilter: 'all',
  categoryFilter: 'all',
  autoScroll: true,
  maxEntries: WS_CONSOLE_MAX_ENTRIES,
};

export const WS_CONSOLE_LEVEL_LABELS: Record<WsConsoleLevel, string> = {
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  debug: 'Debug',
};

export const WS_CONSOLE_CATEGORY_LABELS: Record<WsConsoleCategory, string> = {
  lifecycle: 'Lifecycle',
  handshake: 'Handshake',
  reconnect: 'Reconnect',
  protocol: 'Protocol',
  control: 'Control',
  command: 'Command',
  system: 'System',
};

/** Glyph shown in the Raw timeline for each direction lane. */
export const WS_CONSOLE_DIRECTION_GLYPHS: Record<WsConsoleDirection, string> = {
  out: '>',
  in: '<',
  info: '*',
  command: '$',
};

/**
 * Phase 10 — Console command line: pure parsing + command registry.
 *
 * No React, no side effects. Owns the slash-command grammar, the per-variant
 * command spec lists (WS vs. SSE), the `/help` hint string, and the ↑↓ history
 * navigation math. The dispatch hook (`useConsoleCommands`) consumes these.
 */

/** Names of every console command (without the leading slash). */
export type ConsoleCommandName =
  | 'help'
  | 'clear'
  | 'connect'
  | 'disconnect'
  | 'ping'
  | 'close'
  | 'send'
  | 'template';

/** A single command's metadata, used for `/help`, hints, and validation. */
export interface ConsoleCommandSpec {
  name: ConsoleCommandName;
  /** Usage line shown in `/help`, e.g. `/close [code] [reason]`. */
  usage: string;
  description: string;
}

/**
 * Result of parsing one line of command-line input.
 * - `empty`    — blank / whitespace-only input (no-op).
 * - `command`  — a `/name [...args]`; `rest` is everything after the name
 *                (verbatim, for commands like `/send <data>` whose payload may
 *                contain spaces).
 * - `plain`    — non-empty input that does not start with `/`.
 */
export type ParsedConsoleCommand =
  | { kind: 'empty' }
  | { kind: 'command'; name: string; args: string[]; rest: string }
  | { kind: 'plain'; text: string };

/** Parse one line of command-line input. Pure. */
export function parseConsoleCommand(input: string): ParsedConsoleCommand {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'empty' };
  if (!trimmed.startsWith('/')) return { kind: 'plain', text: trimmed };

  // Tolerate whitespace right after the slash (e.g. `/  send hi`); the command
  // token is the first non-whitespace run, and `rest` is everything after the
  // whitespace that follows it (inner spacing preserved for payloads).
  const body = trimmed.slice(1).replace(/^\s+/, '');
  const firstSpace = body.search(/\s/);
  const name = (firstSpace === -1 ? body : body.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? '' : body.slice(firstSpace + 1).replace(/^\s+/, '');
  const args = rest.split(/\s+/).filter(Boolean);
  return { kind: 'command', name, args, rest };
}

// ── Command registries (per variant) ─────────────────────────────────

const HELP_SPEC: ConsoleCommandSpec = {
  name: 'help',
  usage: '/help',
  description: 'List the available console commands.',
};

const CLEAR_SPEC: ConsoleCommandSpec = {
  name: 'clear',
  usage: '/clear',
  description: 'Clear the console output.',
};

const CONNECT_SPEC: ConsoleCommandSpec = {
  name: 'connect',
  usage: '/connect [url]',
  description: 'Connect, optionally setting the URL first.',
};

const DISCONNECT_SPEC: ConsoleCommandSpec = {
  name: 'disconnect',
  usage: '/disconnect',
  description: 'Disconnect the current connection.',
};

/** Full command set for the WebSocket studio. */
export const WS_CONSOLE_COMMANDS: ConsoleCommandSpec[] = [
  HELP_SPEC,
  CLEAR_SPEC,
  CONNECT_SPEC,
  DISCONNECT_SPEC,
  { name: 'ping', usage: '/ping', description: 'Send a ping frame (requires a connection).' },
  {
    name: 'close',
    usage: '/close [code] [reason]',
    description: 'Close with an optional code and reason.',
  },
  { name: 'send', usage: '/send <data>', description: 'Send a message (requires a connection).' },
  {
    name: 'template',
    usage: '/template <name>',
    description: 'Send a saved message template by name.',
  },
];

/** Limited command set for the SSE studio (one-way stream). */
export const SSE_CONSOLE_COMMANDS: ConsoleCommandSpec[] = [
  HELP_SPEC,
  CLEAR_SPEC,
  CONNECT_SPEC,
  DISCONNECT_SPEC,
];

/** Build the single-line hint shown beside the command input. */
export function buildCommandHint(specs: ConsoleCommandSpec[]): string {
  const cmds = specs.map((s) => `/${s.name}`).join(' · ');
  return `↑↓ history · ${cmds}`;
}

/** Precomputed hints for each variant (stable references). */
export const WS_CONSOLE_HINT = buildCommandHint(WS_CONSOLE_COMMANDS);
export const SSE_CONSOLE_HINT = buildCommandHint(SSE_CONSOLE_COMMANDS);

// ── History navigation (↑/↓) ─────────────────────────────────────────

/**
 * Compute the next history index for an ↑/↓ key press. `history` is ordered
 * oldest→newest. A `null` index means "live" (the editable, non-recalled line).
 *
 * - `up`   from live → newest (length-1); otherwise one older (min 0).
 * - `down` from live → live (no-op); past the newest → live again; otherwise
 *          one newer.
 * - empty history → unchanged.
 */
export function navigateHistory(
  direction: 'up' | 'down',
  currentIndex: number | null,
  length: number,
): number | null {
  if (length <= 0) return currentIndex;
  if (direction === 'up') {
    if (currentIndex === null) return length - 1;
    return Math.max(0, currentIndex - 1);
  }
  // down
  if (currentIndex === null) return null;
  if (currentIndex >= length - 1) return null;
  return currentIndex + 1;
}

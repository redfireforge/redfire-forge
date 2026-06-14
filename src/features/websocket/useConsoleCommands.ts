/**
 * Phase 10 — Console command dispatch hook.
 *
 * Bridges the presentational command line (`ConsolePanel`) to the studio
 * actions. Pure parsing/validation lives in `wsConsoleCommands.ts`; this hook
 * owns the side effects: echo the typed line, dispatch to the variant-shaped
 * `capabilities`, then append a result or error entry.
 *
 * `runCommand` is stable across renders (capabilities/append/clear are read
 * from refs), so `ConsolePanel`'s `onCommand` prop identity stays constant.
 */

import { useCallback, useMemo, useRef } from 'react';
import type { WsConsoleEntry } from './wsConsoleTypes';
import {
  buildCommandEchoEntry,
  buildCommandErrorEntry,
  buildCommandResultEntry,
  buildHelpEntry,
} from './wsConsoleEntries';
import { parseConsoleCommand, type ConsoleCommandSpec } from './wsConsoleCommands';
import { byteLength } from './wsMessageUtils';

/** Valid WebSocket close codes for `close()`: 1000 or the 3000–4999 range. */
const MIN_CLOSE_CODE = 1000;
const MAX_CLOSE_CODE = 4999;
/** Max UTF-8 byte length of a WebSocket close reason. */
const MAX_REASON_BYTES = 123;

/** Optional close metadata for `/close [code] [reason]` and `/disconnect`. */
export interface ConsoleDisconnectDetail {
  code?: number;
  reason?: string;
}

/**
 * Variant-shaped side-effect surface. WS provides the full set; SSE omits
 * `ping`/`send`/`sendTemplate` (and its command spec list excludes them, so
 * they are rejected as unknown commands before dispatch).
 */
export interface ConsoleCommandCapabilities {
  /** The connection is fully open (gates /ping, /send, /close, /template). */
  isConnected: boolean;
  /** A connect is in flight (gates /connect; allows /disconnect to abort). */
  isConnecting?: boolean;
  /** Connect, optionally applying `url` to the draft/config first. */
  connect: (url?: string) => void;
  /** Disconnect, optionally with a close code/reason (WS). */
  disconnect: (detail?: ConsoleDisconnectDetail) => void;
  /** WS only — send a ping frame. */
  ping?: () => void;
  /** WS only — send a text message. */
  send?: (data: string) => void;
  /** WS only — send a saved template by name; returns `true` if found + sent. */
  sendTemplate?: (name: string) => boolean;
}

export interface UseConsoleCommandsOptions {
  /** Append a console entry (the buffer's `append`). */
  append: (entry: WsConsoleEntry) => void;
  /** Clear the console buffer (for `/clear`). */
  clearConsole: () => void;
  /** The command set available for this variant (drives `/help` + validation). */
  commands: ConsoleCommandSpec[];
  capabilities: ConsoleCommandCapabilities;
}

export interface UseConsoleCommandsReturn {
  runCommand: (input: string) => void;
}

export function useConsoleCommands(opts: UseConsoleCommandsOptions): UseConsoleCommandsReturn {
  const { append, clearConsole, commands, capabilities } = opts;

  const appendRef = useRef(append);
  appendRef.current = append;
  const clearRef = useRef(clearConsole);
  clearRef.current = clearConsole;
  const capsRef = useRef(capabilities);
  capsRef.current = capabilities;
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const commandNames = useMemo(() => new Set<string>(commands.map((c) => c.name)), [commands]);

  const runCommand = useCallback(
    (input: string) => {
      const emit = appendRef.current;
      emit(buildCommandEchoEntry(input));

      const parsed = parseConsoleCommand(input);
      if (parsed.kind === 'empty') return;
      if (parsed.kind === 'plain') {
        emit(buildCommandErrorEntry('Commands start with "/". Type /help for a list.'));
        return;
      }
      if (!commandNames.has(parsed.name)) {
        emit(buildCommandErrorEntry(`Unknown command "/${parsed.name}". Type /help for a list.`));
        return;
      }

      const caps = capsRef.current;
      switch (parsed.name) {
        case 'help':
          emit(buildHelpEntry(commandsRef.current));
          return;

        case 'clear':
          clearRef.current();
          return;

        case 'connect': {
          if (caps.isConnected) {
            emit(buildCommandErrorEntry('Already connected — use /disconnect first.'));
            return;
          }
          if (caps.isConnecting) {
            emit(buildCommandErrorEntry('Already connecting…'));
            return;
          }
          const url = parsed.rest.trim() || undefined;
          caps.connect(url);
          emit(buildCommandResultEntry(url ? `Connecting to ${url}…` : 'Connecting…'));
          return;
        }

        case 'disconnect': {
          if (!caps.isConnected && !caps.isConnecting) {
            emit(buildCommandErrorEntry('Not connected.'));
            return;
          }
          caps.disconnect();
          emit(buildCommandResultEntry('Disconnecting…'));
          return;
        }

        case 'ping': {
          if (!caps.isConnected) {
            emit(buildCommandErrorEntry('Not connected.'));
            return;
          }
          if (!caps.ping) {
            emit(buildCommandErrorEntry('/ping is not supported here.'));
            return;
          }
          caps.ping();
          emit(buildCommandResultEntry('Ping sent.'));
          return;
        }

        case 'close': {
          let code: number | undefined;
          let reason: string | undefined;
          if (parsed.args.length > 0) {
            const raw = parsed.args[0];
            if (!/^\d+$/.test(raw)) {
              emit(buildCommandErrorEntry(`Invalid close code "${raw}" — must be a number.`));
              return;
            }
            code = Number(raw);
            if (code < MIN_CLOSE_CODE || code > MAX_CLOSE_CODE) {
              emit(
                buildCommandErrorEntry(
                  `Invalid close code ${code} — must be in the range ${MIN_CLOSE_CODE}–${MAX_CLOSE_CODE}.`,
                ),
              );
              return;
            }
            reason = parsed.args.slice(1).join(' ') || undefined;
            if (reason && byteLength(reason) > MAX_REASON_BYTES) {
              emit(
                buildCommandErrorEntry(
                  `Close reason too long — max ${MAX_REASON_BYTES} bytes.`,
                ),
              );
              return;
            }
          }
          if (!caps.isConnected) {
            emit(buildCommandErrorEntry('Not connected.'));
            return;
          }
          caps.disconnect(code != null ? { code, reason } : undefined);
          emit(
            buildCommandResultEntry(
              code != null
                ? `Closing (code ${code}${reason ? `, "${reason}"` : ''})…`
                : 'Closing…',
            ),
          );
          return;
        }

        case 'send': {
          if (!caps.send) {
            emit(buildCommandErrorEntry('/send is not supported here.'));
            return;
          }
          if (!parsed.rest) {
            emit(buildCommandErrorEntry('Usage: /send <data>'));
            return;
          }
          if (!caps.isConnected) {
            emit(buildCommandErrorEntry('Not connected.'));
            return;
          }
          caps.send(parsed.rest);
          emit(buildCommandResultEntry('Message sent.'));
          return;
        }

        case 'template': {
          if (!caps.sendTemplate) {
            emit(buildCommandErrorEntry('/template is not supported here.'));
            return;
          }
          const name = parsed.rest.trim();
          if (!name) {
            emit(buildCommandErrorEntry('Usage: /template <name>'));
            return;
          }
          if (!caps.isConnected) {
            emit(buildCommandErrorEntry('Not connected.'));
            return;
          }
          const sent = caps.sendTemplate(name);
          emit(
            sent
              ? buildCommandResultEntry(`Sent template "${name}".`)
              : buildCommandErrorEntry(`No template named "${name}".`),
          );
          return;
        }

        default:
          return;
      }
    },
    [commandNames],
  );

  return { runCommand };
}

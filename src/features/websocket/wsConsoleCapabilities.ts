// Phase 10 — builds the console command capabilities object that bridges the
// slash-command dispatcher (`useConsoleCommands`) to the live studio actions.
// Extracted from `WsConnectionTabContent` so the command-mapping logic can be
// unit-tested in isolation.
import type { WsCloseDetail, WsMessageFormat } from '../../shared/websocket/types';
import type { ConsoleCommandCapabilities } from './useConsoleCommands';

/** Minimal template shape needed to resolve `/template <name>`. */
export interface WsConsoleTemplateLike {
  name: string;
  body: string;
  format?: WsMessageFormat;
}

/** Studio actions the console capabilities delegate to. */
export interface WsConsoleCapabilitiesDeps {
  /** The connection is fully open. */
  isConnected: boolean;
  /** Current connection lifecycle state (used to derive `isConnecting`). */
  connectionState: string;
  /** Apply a partial draft (used to set the URL on `/connect <url>`). */
  setDraft: (patch: { url: string }) => void;
  /** Initiate the connection. */
  connect: () => void;
  /** Close the connection, optionally with a code/reason. */
  disconnect: (detail?: WsCloseDetail) => void;
  /** Send a ping frame. */
  sendPing: () => void;
  /** Send a text/binary message. */
  send: (data: string, format?: WsMessageFormat) => void;
  /** Saved templates resolved by name for `/template`. */
  templates: WsConsoleTemplateLike[];
}

/**
 * Map the studio actions onto the {@link ConsoleCommandCapabilities} contract
 * consumed by `useConsoleCommands`.
 */
export function buildWsConsoleCapabilities(
  deps: WsConsoleCapabilitiesDeps,
): ConsoleCommandCapabilities {
  return {
    isConnected: deps.isConnected,
    isConnecting: deps.connectionState === 'connecting',
    connect: (url) => {
      if (url) deps.setDraft({ url });
      deps.connect();
    },
    disconnect: (detail) =>
      deps.disconnect(
        detail?.code != null ? { code: detail.code, reason: detail.reason } : undefined,
      ),
    ping: () => deps.sendPing(),
    send: (data) => deps.send(data),
    sendTemplate: (name) => {
      const tpl = deps.templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (!tpl) return false;
      deps.send(tpl.body, tpl.format);
      return true;
    },
  };
}

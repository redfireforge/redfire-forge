import { useWebSocketSend, type UseWebSocketSendOptions } from './useWebSocketSend';

export interface WebSocketSendPaneProps extends UseWebSocketSendOptions {
  /** When true (e.g. a recording replay is in progress), the composer is not
   * rendered — mirrors the message log's `{!isReplaying && composeBar}`
   * behavior so send/ping are unavailable while replaying. */
  hidden?: boolean;
}

/**
 * Phase 3: the message composer extracted out of `WebSocketMessageLog` into a
 * standalone, reusable pane. It wraps the existing `useWebSocketSend` hook
 * and renders its `composeBar` (text/binary editor, format selector, the
 * Socket.IO / STOMP / GraphQL-WS protocol composers, the templates dropdown,
 * and the send + ping actions). Hosting the composer on its own lets the left
 * `Compose` tab own it while the events list relocates to the right pane in
 * Phase 4.
 */
export function WebSocketSendPane({ hidden = false, ...options }: WebSocketSendPaneProps) {
  const { composeBar } = useWebSocketSend(options);
  if (hidden) return null;
  return <>{composeBar}</>;
}

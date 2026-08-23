import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { WsCloseDetail, WsConnectionSnapshot, WsFrame } from '@shared/websocket/types';
import { createFrame } from '@shared/websocket/types';
import { dispatchWsOperation } from '@shared/websocket/websocketClient';
import { sanitizeNativeCloseCode } from './wsMessageUtils';
import { formatCloseFrame } from './useWebSocketStudioTypes';

interface DisconnectContext {
  detail?: WsCloseDetail;
  mountedRef: MutableRefObject<boolean>;
  wsRef: MutableRefObject<WebSocket | null>;
  proxyConnectionIdRef: MutableRefObject<string | null>;
  manualDisconnectRef: MutableRefObject<boolean>;
  cancelReconnect: () => void;
  appendMessage: (frame: WsFrame) => void;
  setConnection: Dispatch<SetStateAction<WsConnectionSnapshot>>;
  stopProxyPolling: () => void;
  stopNativeListeners: () => void;
  resetConnectionTiming: () => void;
}

export function disconnectWebSocketConnection({
  detail,
  mountedRef,
  wsRef,
  proxyConnectionIdRef,
  manualDisconnectRef,
  cancelReconnect,
  appendMessage,
  setConnection,
  stopProxyPolling,
  stopNativeListeners,
  resetConnectionTiming,
}: DisconnectContext): void {
  manualDisconnectRef.current = true;
  cancelReconnect();

  const code = detail?.code ?? 1000;
  const reason = detail?.reason ?? 'User disconnected';
  const nativeCode = sanitizeNativeCloseCode(code);

  if (proxyConnectionIdRef.current) {
    if (detail) {
      appendMessage(createFrame('sent', 'close', formatCloseFrame('SENT', code, reason)));
    }
    setConnection((prev) => ({ ...prev, state: 'closing' }));
    const connId = proxyConnectionIdRef.current;
    proxyConnectionIdRef.current = null;
    stopProxyPolling();
    stopNativeListeners();

    dispatchWsOperation('disconnect', { connectionId: connId, code, reason })
      .then(() => {
        if (!mountedRef.current) return;
        resetConnectionTiming();
        appendMessage(createFrame('received', 'close', formatCloseFrame('ACK', code, reason)));
        setConnection((prev) => ({
          ...prev,
          state: 'disconnected',
          closedAt: new Date().toISOString(),
          closeCode: code,
          closeReason: reason,
        }));
      })
      .catch(() => {
        if (!mountedRef.current) return;
        resetConnectionTiming();
        setConnection((prev) => ({ ...prev, state: 'disconnected' }));
      });
    return;
  }

  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    if (detail) {
      appendMessage(createFrame('sent', 'close', formatCloseFrame('SENT', nativeCode, reason)));
    }
    setConnection((prev) => ({ ...prev, state: 'closing' }));
    wsRef.current.close(nativeCode, reason);
    return;
  }

  if (wsRef.current) {
    if (detail) {
      appendMessage(createFrame('sent', 'close', formatCloseFrame('SENT', nativeCode, reason)));
    }
    wsRef.current.close(nativeCode, reason);
    resetConnectionTiming();
    setConnection((prev) => ({ ...prev, state: 'disconnected' }));
    return;
  }

  resetConnectionTiming();
  setConnection((prev) => prev.state === 'disconnected' ? prev : { ...prev, state: 'disconnected' });
}

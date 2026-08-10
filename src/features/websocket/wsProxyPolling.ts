import { createFrame, type WsConnectionSnapshot, type WsFrame } from '../../shared/websocket/types';
import { dispatchWsOperation } from '../../shared/websocket/websocketClient';
import { formatCloseFrame } from './useWebSocketStudioTypes';
import { processReceivedMessage } from './wsMessageProcessing';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import type { SioServerParams } from './wsProtocolHelpers';
import type { Dispatch, SetStateAction } from 'react';

interface RefLike<T> {
  current: T;
}

interface ProxyMessageEnvelope {
  data: string;
  type: string;
  receivedAt: string;
  size: number;
}

interface ProxyMessagesData {
  messages: ProxyMessageEnvelope[];
  cursor: number;
  state?: string;
  closeCode?: number;
  closeReason?: string;
}

interface ProxyStatusData {
  state: string;
  lastError?: string;
}

interface StartWsProxyPollingArgs {
  connectionId: string;
  pollIntervalMs: number;
  mountedRef: RefLike<boolean>;
  proxyCursorRef: RefLike<number>;
  protocolModeRef: RefLike<WsProtocolMode>;
  detectedProtocolRef: RefLike<WsProtocolDetectionResult | null>;
  messageDetectionDoneRef: RefLike<boolean>;
  appendMessage: (frame: WsFrame) => void;
  appendMessages: (frames: WsFrame[]) => void;
  setSentCount: Dispatch<SetStateAction<number>>;
  setReceivedCount: Dispatch<SetStateAction<number>>;
  setSioServerParams: Dispatch<SetStateAction<SioServerParams | null>>;
  updateDetectedProtocol: (value: WsProtocolDetectionResult | null) => void;
  failProxyConnection: (next: Partial<WsConnectionSnapshot>) => void;
}

export function startWsProxyPolling({
  connectionId,
  pollIntervalMs,
  mountedRef,
  proxyCursorRef,
  protocolModeRef,
  detectedProtocolRef,
  messageDetectionDoneRef,
  appendMessage,
  appendMessages,
  setSentCount,
  setReceivedCount,
  setSioServerParams,
  updateDetectedProtocol,
  failProxyConnection,
}: StartWsProxyPollingArgs): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    if (!mountedRef.current) return;
    try {
      const env = await dispatchWsOperation<ProxyMessagesData>('messages', {
        connectionId,
        sinceCursor: proxyCursorRef.current,
      });

      if (!mountedRef.current) return;

      if (env.data?.state && env.data.state !== 'connected') {
        const code = env.data.closeCode ?? 1006;
        const reason = env.data.closeReason || undefined;
        const ackMsg = formatCloseFrame('ACK', code, reason);
        appendMessage(createFrame('received', 'close', ackMsg));
        failProxyConnection({
          state: env.data.state === 'error' ? 'error' : 'disconnected',
          closeCode: code,
          closeReason: reason,
          closedAt: new Date().toISOString(),
        });
        return;
      }

      if (env.data && env.data.messages.length > 0) {
        const allFrames: WsFrame[] = [];

        for (const m of env.data.messages) {
          const isBinary = m.type === 'binary';
          const result = processReceivedMessage(
            m.data,
            isBinary,
            protocolModeRef.current,
            detectedProtocolRef.current,
            messageDetectionDoneRef.current,
            (r) => {
              updateDetectedProtocol(r);
            },
          );
          messageDetectionDoneRef.current = result.detectionNowDone;

          if (result.autoRespond) {
            allFrames.push(result.frame);
            dispatchWsOperation('send', { connectionId, data: result.autoRespond.replyData, type: 'text' }).catch(() => {});
            allFrames.push(result.autoRespond.replyFrame);
            setSentCount((c) => c + 1);
            if (result.autoRespond.sioServerParams) {
              setSioServerParams(result.autoRespond.sioServerParams);
            }
            continue;
          }

          allFrames.push(result.frame);
        }

        appendMessages(allFrames);
        setReceivedCount((c) => c + env.data!.messages.length);
        proxyCursorRef.current = env.data.cursor;
      }
    } catch {
      if (!mountedRef.current) return;
      try {
        const statusEnv = await dispatchWsOperation<ProxyStatusData>('status', { connectionId });
        if (!mountedRef.current) return;
        if (statusEnv.data && statusEnv.data.state !== 'connected') {
          const statusData = statusEnv.data;
          failProxyConnection({
            state: statusData.state === 'error' ? 'error' : 'disconnected',
            lastError: statusData.lastError,
          });
        }
      } catch {
        if (!mountedRef.current) return;
        failProxyConnection({ state: 'disconnected' });
      }
    }
  }, pollIntervalMs);
}

import type { WsFrame } from '../../shared/websocket/types';
import { createFrame } from '../../shared/websocket/types';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import { detectFromMessage } from '../../shared/websocket/protocols/protocolDetector';
import { checkAutoRespond, type SioServerParams } from './wsProtocolHelpers';

export interface AutoRespondResult {
  replyData: string;
  replyFrame: WsFrame;
  sioServerParams?: SioServerParams | null;
}

/**
 * Process a received message through protocol detection and auto-respond logic.
 * Returns the frame plus optional auto-respond action.
 */
export function processReceivedMessage(
  data: string,
  isBinary: boolean,
  protocolMode: WsProtocolMode,
  detectedProtocol: WsProtocolDetectionResult | null,
  messageDetectionDone: boolean,
  onUpdateDetectedProtocol: (result: WsProtocolDetectionResult) => void,
): {
  frame: WsFrame;
  autoRespond: AutoRespondResult | null;
  detectionNowDone: boolean;
} {
  const frameType = isBinary ? 'binary' : 'text';
  const frame = createFrame('received', frameType, data);
  let detectionNowDone = messageDetectionDone;
  let effectiveDetected = detectedProtocol;

  // Protocol auto-detection on first message
  if (protocolMode === 'auto' && !messageDetectionDone && !isBinary) {
    detectionNowDone = true;
    const msgResult = detectFromMessage(data);
    if (msgResult) {
      onUpdateDetectedProtocol(msgResult);
      effectiveDetected = msgResult;
    }
  }

  // Auto-respond (e.g. Socket.IO heartbeat, STOMP connected ACK)
  if (!isBinary) {
    const autoResp = checkAutoRespond(frame, data, protocolMode, effectiveDetected);
    if (autoResp) {
      return {
        frame,
        autoRespond: {
          replyData: autoResp.replyData,
          replyFrame: autoResp.replyFrame,
          sioServerParams: autoResp.sioServerParams,
        },
        detectionNowDone,
      };
    }
  }

  return { frame, autoRespond: null, detectionNowDone };
}

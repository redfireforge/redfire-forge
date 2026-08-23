import { useEffect, useRef } from 'react';
import type { WsFrame } from '@shared/websocket/types';
import type { RecordingState } from './useWebSocketRecording';

export interface UseWebSocketRecordingBridgeParams {
  messages: WsFrame[];
  connectionState: string;
  draftUrl: string;
  recordingState: RecordingState;
  recordMessage: (frame: WsFrame) => void;
  recordStateChange: (state: string, url?: string) => void;
}

/**
 * Bridges live studio activity into the recording hook: while recording is
 * active, every newly-appended message frame is forwarded to `recordMessage`
 * (handling cap-eviction where the array doesn't grow but new frames arrive)
 * and every connection-state transition is forwarded to `recordStateChange`.
 *
 * Extracted from `WsConnectionTabContent` so the wiring can be unit-tested and
 * reused independently of the (large) tab-content component.
 */
export function useWebSocketRecordingBridge({
  messages,
  connectionState,
  draftUrl,
  recordingState,
  recordMessage,
  recordStateChange,
}: UseWebSocketRecordingBridgeParams): void {
  const prevMsgCountRef = useRef(0);
  const lastSeenMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const msgs = messages;
    const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
    if (recordingState !== 'recording') {
      prevMsgCountRef.current = msgs.length;
      lastSeenMsgIdRef.current = lastId;
      return;
    }
    if (msgs.length === 0 || lastId === lastSeenMsgIdRef.current) {
      prevMsgCountRef.current = msgs.length;
      return;
    }
    if (msgs.length > prevMsgCountRef.current) {
      for (let i = prevMsgCountRef.current; i < msgs.length; i++) {
        recordMessage(msgs[i]);
      }
    } else {
      // Cap eviction: array didn't grow but new messages exist
      const lastSeenIdx = lastSeenMsgIdRef.current
        ? msgs.findIndex((m) => m.id === lastSeenMsgIdRef.current)
        : -1;
      const startIdx = lastSeenIdx >= 0 ? lastSeenIdx + 1 : 0;
      for (let i = startIdx; i < msgs.length; i++) {
        recordMessage(msgs[i]);
      }
    }
    prevMsgCountRef.current = msgs.length;
    lastSeenMsgIdRef.current = lastId;
  }, [messages, recordingState, recordMessage]);

  const prevConnState2Ref = useRef(connectionState);
  useEffect(() => {
    if (recordingState !== 'recording') {
      prevConnState2Ref.current = connectionState;
      return;
    }
    if (prevConnState2Ref.current !== connectionState) {
      prevConnState2Ref.current = connectionState;
      recordStateChange(connectionState, draftUrl);
    }
  }, [connectionState, draftUrl, recordingState, recordStateChange]);
}

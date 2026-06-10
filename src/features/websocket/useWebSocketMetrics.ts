import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsFrame } from '../../shared/websocket/types';

const HISTORY_SIZE = 60;
const SAMPLE_INTERVAL_MS = 1000;

export interface WsMetricsSnapshot {
  msgPerSec: number;
  sentPerSec: number;
  receivedPerSec: number;
  totalBytesIn: number;
  totalBytesOut: number;
  bytesInPerSec: number;
  bytesOutPerSec: number;
  textFrames: number;
  binaryFrames: number;
  controlFrames: number;
  errorCount: number;
  history: number[];
}

const CONTROL_TYPES = new Set(['ping', 'pong', 'close']);

function createEmptySnapshot(): WsMetricsSnapshot {
  return {
    msgPerSec: 0,
    sentPerSec: 0,
    receivedPerSec: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
    bytesInPerSec: 0,
    bytesOutPerSec: 0,
    textFrames: 0,
    binaryFrames: 0,
    controlFrames: 0,
    errorCount: 0,
    history: [],
  };
}

export function useWebSocketMetrics(
  messages: WsFrame[],
  connectionState: string,
): WsMetricsSnapshot {
  const [snapshot, setSnapshot] = useState<WsMetricsSnapshot>(createEmptySnapshot);

  const prevCountRef = useRef(0);
  const historyRef = useRef<number[]>([]);
  const accSentRef = useRef(0);
  const accReceivedRef = useRef(0);
  const accBytesInRef = useRef(0);
  const accBytesOutRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sample = useCallback(() => {
    const sent = accSentRef.current;
    const received = accReceivedRef.current;
    const bytesIn = accBytesInRef.current;
    const bytesOut = accBytesOutRef.current;
    const rate = sent + received;

    accSentRef.current = 0;
    accReceivedRef.current = 0;
    accBytesInRef.current = 0;
    accBytesOutRef.current = 0;

    const history = historyRef.current;
    history.push(rate);
    if (history.length > HISTORY_SIZE) {
      history.splice(0, history.length - HISTORY_SIZE);
    }

    setSnapshot((prev) => ({
      ...prev,
      msgPerSec: rate,
      sentPerSec: sent,
      receivedPerSec: received,
      bytesInPerSec: bytesIn,
      bytesOutPerSec: bytesOut,
      history: [...history],
    }));
  }, []);

  useEffect(() => {
    if (connectionState !== 'connected') {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (connectionState === 'disconnected') {
        historyRef.current = [];
        accSentRef.current = 0;
        accReceivedRef.current = 0;
        accBytesInRef.current = 0;
        accBytesOutRef.current = 0;
        setSnapshot((prev) => ({
          ...prev,
          msgPerSec: 0,
          sentPerSec: 0,
          receivedPerSec: 0,
          bytesInPerSec: 0,
          bytesOutPerSec: 0,
          history: [],
        }));
      }
      return;
    }
    if (timerRef.current === null) {
      accSentRef.current = 0;
      accReceivedRef.current = 0;
      accBytesInRef.current = 0;
      accBytesOutRef.current = 0;
      timerRef.current = setInterval(sample, SAMPLE_INTERVAL_MS);
    }
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [connectionState, sample]);

  useEffect(() => {
    const len = messages.length;
    if (len <= prevCountRef.current) {
      if (len === 0 && prevCountRef.current > 0) {
        prevCountRef.current = 0;
        historyRef.current = [];
        setSnapshot(createEmptySnapshot());
      }
      return;
    }

    let newSent = 0;
    let newReceived = 0;
    let newBytesIn = 0;
    let newBytesOut = 0;
    let textFrames = 0;
    let binaryFrames = 0;
    let controlFrames = 0;
    let errorCount = 0;

    for (let i = prevCountRef.current; i < len; i++) {
      const frame = messages[i];
      if (frame.direction === 'sent') {
        newSent++;
        newBytesOut += frame.size;
      } else {
        newReceived++;
        newBytesIn += frame.size;
      }
      if (CONTROL_TYPES.has(frame.type)) {
        controlFrames++;
      } else if (frame.type === 'binary') {
        binaryFrames++;
      } else {
        textFrames++;
      }
      if (frame.type === 'close') {
        errorCount++;
      }
    }

    accSentRef.current += newSent;
    accReceivedRef.current += newReceived;
    accBytesInRef.current += newBytesIn;
    accBytesOutRef.current += newBytesOut;

    prevCountRef.current = len;

    setSnapshot((prev) => ({
      ...prev,
      totalBytesIn: prev.totalBytesIn + newBytesIn,
      totalBytesOut: prev.totalBytesOut + newBytesOut,
      textFrames: prev.textFrames + textFrames,
      binaryFrames: prev.binaryFrames + binaryFrames,
      controlFrames: prev.controlFrames + controlFrames,
      errorCount: prev.errorCount + errorCount,
    }));
  }, [messages]);

  return snapshot;
}

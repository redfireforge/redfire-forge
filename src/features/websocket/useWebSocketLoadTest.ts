/**
 * Load test orchestration hook.
 * Manages send loop, rate control, latency correlation, and result aggregation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WsLoadTestConfig,
  WsLoadTestState,
  WsLoadTestProgress,
  WsLoadTestResult,
  WsFrame,
} from '../../shared/websocket/types';
import {
  createLatencyTracker,
  createThroughputSampler,
  expandLoadTestTemplate,
  computeTargetRate,
  buildLoadTestResult,
  createDefaultLoadTestConfig,
  type LatencyTracker,
  type ThroughputSampler,
} from './wsLoadTestMetrics';
import { byteLength } from './wsMessageUtils';

const MAX_RATE = 1000;
const MAX_DURATION_SEC = 60;
const NONCE_PREFIX = '__lt_';
const PROGRESS_INTERVAL_MS = 250;

export interface UseWebSocketLoadTestReturn {
  state: WsLoadTestState;
  config: WsLoadTestConfig;
  setConfig: (patch: Partial<WsLoadTestConfig>) => void;
  progress: WsLoadTestProgress;
  result: WsLoadTestResult | null;
  start: () => void;
  stop: () => void;
  clearResult: () => void;
  loadResult: (imported: WsLoadTestResult) => void;
}

function clampConfig(config: WsLoadTestConfig): WsLoadTestConfig {
  return {
    ...config,
    rate: Math.min(MAX_RATE, Math.max(1, config.rate)),
    rateEnd: Math.min(MAX_RATE, Math.max(1, config.rateEnd)),
    durationSec: Math.min(MAX_DURATION_SEC, Math.max(1, config.durationSec)),
    burstCount: Math.min(MAX_RATE * MAX_DURATION_SEC, Math.max(1, config.burstCount)),
  };
}

const EMPTY_PROGRESS: WsLoadTestProgress = {
  elapsedMs: 0,
  totalSent: 0,
  totalReceived: 0,
  targetRate: 0,
  actualRate: 0,
  errorCount: 0,
};

export function embedNonce(message: string, counter: number): string {
  const nonce = `${NONCE_PREFIX}${counter}_${Date.now()}`;
  if (message.startsWith('{') && message.endsWith('}')) {
    const inner = message.slice(1, -1).trim();
    if (!inner) {
      return `{"__lt_nonce":"${nonce}"}`;
    }
    return `${message.slice(0, -1)},"__lt_nonce":"${nonce}"}`;
  }
  return message;
}

export function extractNonce(data: string): string | null {
  if (!data.includes(NONCE_PREFIX)) return null;
  const match = data.match(/"__lt_nonce":"(__lt_\d+_\d+)"/);
  return match ? match[1] : null;
}

export function useWebSocketLoadTest(
  sendFn: ((data: string) => void) | null,
  messages: WsFrame[],
  isConnected: boolean,
): UseWebSocketLoadTestReturn {
  const [state, setState] = useState<WsLoadTestState>('idle');
  const [config, setConfigState] = useState<WsLoadTestConfig>(createDefaultLoadTestConfig);
  const [progress, setProgress] = useState<WsLoadTestProgress>(EMPTY_PROGRESS);
  const [result, setResult] = useState<WsLoadTestResult | null>(null);

  const stateRef = useRef<WsLoadTestState>('idle');
  const configRef = useRef(config);
  const counterRef = useRef(0);
  const sentRef = useRef(0);
  const receivedRef = useRef(0);
  const errorRef = useRef(0);
  const bytesSentRef = useRef(0);
  const bytesReceivedRef = useRef(0);
  const startTsRef = useRef(0);
  const latencyRef = useRef<LatencyTracker | null>(null);
  const throughputRef = useRef<ThroughputSampler | null>(null);
  const sentTimestamps = useRef(new Map<string, number>());
  const sendLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendFnRef = useRef(sendFn);
  const prevMsgLenRef = useRef(0);
  const lastSeenMsgIdRef = useRef<string | null>(null);
  const scheduleSendLoopRef = useRef<() => void>(() => {});

  sendFnRef.current = sendFn;
  configRef.current = config;

  const setConfig = useCallback((patch: Partial<WsLoadTestConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const processReceivedFrames = useCallback((frames: WsFrame[]) => {
    for (const frame of frames) {
      if (frame.direction !== 'received') continue;
      receivedRef.current++;
      bytesReceivedRef.current += frame.size;
      const nonce = extractNonce(frame.data);
      if (nonce && sentTimestamps.current.has(nonce)) {
        const sentTs = sentTimestamps.current.get(nonce)!;
        latencyRef.current?.record(sentTs, Date.now());
        sentTimestamps.current.delete(nonce);
      }
    }
  }, []);

  useEffect(() => {
    if (stateRef.current !== 'running' && stateRef.current !== 'stopping') return;
    const msgs = messages;
    const len = msgs.length;
    const lastId = len > 0 ? msgs[len - 1].id : null;

    if (len === 0) {
      prevMsgLenRef.current = 0;
      lastSeenMsgIdRef.current = null;
      return;
    }
    if (lastId === lastSeenMsgIdRef.current) return;

    if (len > prevMsgLenRef.current) {
      processReceivedFrames(msgs.slice(prevMsgLenRef.current));
    } else {
      const lastSeenIdx = msgs.findIndex((m) => m.id === lastSeenMsgIdRef.current);
      const startIdx = lastSeenIdx >= 0 ? lastSeenIdx + 1 : 0;
      processReceivedFrames(msgs.slice(startIdx));
    }
    prevMsgLenRef.current = len;
    lastSeenMsgIdRef.current = lastId;
  }, [messages, processReceivedFrames]);

  const finalize = useCallback(() => {
    clearTimeout(sendLoopRef.current ?? undefined);
    sendLoopRef.current = null;
    clearInterval(progressTimerRef.current ?? undefined);
    progressTimerRef.current = null;

    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startTsRef.current;

    if (latencyRef.current && throughputRef.current) {
      const loadResult = buildLoadTestResult(
        configRef.current,
        new Date(startTsRef.current).toISOString(),
        endedAt,
        durationMs,
        sentRef.current,
        receivedRef.current,
        errorRef.current,
        bytesSentRef.current,
        bytesReceivedRef.current,
        latencyRef.current,
        throughputRef.current,
      );
      setResult(loadResult);
    }

    stateRef.current = 'done';
    setState('done');
    setProgress({
      elapsedMs: durationMs,
      totalSent: sentRef.current,
      totalReceived: receivedRef.current,
      targetRate: 0,
      actualRate: Math.round((sentRef.current * 1000) / Math.max(durationMs, 1)),
      errorCount: errorRef.current,
    });
    sentTimestamps.current.clear();
  }, []);

  const sendOne = useCallback(() => {
    if (!sendFnRef.current) return false;
    counterRef.current++;
    const expanded = expandLoadTestTemplate(configRef.current.messageTemplate, counterRef.current);
    const withNonce = embedNonce(expanded, counterRef.current);

    const nonce = extractNonce(withNonce);
    if (nonce) {
      sentTimestamps.current.set(nonce, Date.now());
        if (sentTimestamps.current.size > 10000) {
          sentTimestamps.current.delete(sentTimestamps.current.keys().next().value as string);
        }
    }

    try {
      sendFnRef.current(withNonce);
      sentRef.current++;
      bytesSentRef.current += byteLength(withNonce);
      return true;
    } catch {
      errorRef.current++;
      return false;
    }
  }, []);

  const scheduleSendLoop = useCallback(() => {
    if (stateRef.current !== 'running') return;
    const cfg = configRef.current;
    const elapsed = Date.now() - startTsRef.current;

    if (cfg.profile === 'burst') {
      const batchSize = Math.min(50, cfg.burstCount - sentRef.current);
      for (let i = 0; i < batchSize; i++) {
        if (sentRef.current >= cfg.burstCount) break;
        sendOne();
      }
      if (sentRef.current >= cfg.burstCount) {
        // Drain window: keep collecting echoes for 500ms before finalizing
        stateRef.current = 'stopping';
        setState('stopping');
        clearInterval(progressTimerRef.current ?? undefined);
        progressTimerRef.current = null;
        sendLoopRef.current = setTimeout(() => finalize(), 500);
        return;
      }
      sendLoopRef.current = setTimeout(() => scheduleSendLoopRef.current(), 0);
      return;
    }

    const totalMs = cfg.durationSec * 1000;
    if (elapsed >= totalMs) {
      // Send any messages that should have fired at exactly totalMs
      const finalExpected = cfg.profile === 'ramp'
        ? Math.round(((cfg.rate + (cfg.rateEnd ?? cfg.rate)) / 2) * cfg.durationSec)
        : cfg.rate * cfg.durationSec;
      const remaining = Math.min(finalExpected - sentRef.current, 50);
      for (let i = 0; i < remaining; i++) sendOne();
      // Drain window: keep collecting echoes for 500ms before finalizing
      stateRef.current = 'stopping';
      setState('stopping');
      clearInterval(progressTimerRef.current ?? undefined);
      progressTimerRef.current = null;
      sendLoopRef.current = setTimeout(() => finalize(), 500);
      return;
    }

    const targetRate = computeTargetRate(cfg, elapsed);
    const expectedSent = cfg.profile === 'ramp'
      ? computeRampExpected(cfg.rate, cfg.rateEnd, cfg.durationSec, elapsed)
      : Math.floor((targetRate * elapsed) / 1000);

    const deficit = expectedSent - sentRef.current;
    const batch = Math.min(deficit, 20);
    for (let i = 0; i < batch; i++) {
      sendOne();
    }

    const nextDelay = Math.max(1, Math.round(1000 / Math.max(targetRate, 1)));
    sendLoopRef.current = setTimeout(() => scheduleSendLoopRef.current(), Math.min(nextDelay, 50));
  }, [sendOne, finalize]);
  scheduleSendLoopRef.current = scheduleSendLoop;

  const startProgressTimer = useCallback(() => {
    progressTimerRef.current = setInterval(() => {
      if (stateRef.current !== 'running') return;
      const elapsed = Date.now() - startTsRef.current;
      const targetRate = computeTargetRate(configRef.current, elapsed);
      throughputRef.current?.tick(sentRef.current, receivedRef.current);
      setProgress({
        elapsedMs: elapsed,
        totalSent: sentRef.current,
        totalReceived: receivedRef.current,
        targetRate: Number.isFinite(targetRate) ? Math.round(targetRate) : 0,
        actualRate: Math.round((sentRef.current * 1000) / Math.max(elapsed, 1)),
        errorCount: errorRef.current,
      });
    }, PROGRESS_INTERVAL_MS);
  }, []);

  const start = useCallback(() => {
    if (stateRef.current === 'running') return;
    if (!sendFnRef.current) return;

    const clamped = clampConfig(configRef.current);
    setConfigState(clamped);
    configRef.current = clamped;

    counterRef.current = 0;
    sentRef.current = 0;
    receivedRef.current = 0;
    errorRef.current = 0;
    bytesSentRef.current = 0;
    bytesReceivedRef.current = 0;
    startTsRef.current = Date.now();
    prevMsgLenRef.current = messages.length;
    lastSeenMsgIdRef.current = messages.length > 0 ? messages[messages.length - 1].id : null;
    sentTimestamps.current.clear();

    latencyRef.current = createLatencyTracker();
    throughputRef.current = createThroughputSampler();

    stateRef.current = 'running';
    setState('running');
    setResult(null);
    setProgress(EMPTY_PROGRESS);

    startProgressTimer();
    scheduleSendLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, startProgressTimer, scheduleSendLoop]);

  const stop = useCallback(() => {
    if (stateRef.current !== 'running') return;
    stateRef.current = 'stopping';
    setState('stopping');
    finalize();
  }, [finalize]);

  const clearResult = useCallback(() => {
    stateRef.current = 'idle';
    setResult(null);
    setState('idle');
    setProgress(EMPTY_PROGRESS);
  }, []);

  const loadResult = useCallback((imported: WsLoadTestResult) => {
    stateRef.current = 'done';
    setState('done');
    setResult(imported);
    setProgress(EMPTY_PROGRESS);
  }, []);

  useEffect(() => {
    if (!isConnected && stateRef.current === 'running') {
      stateRef.current = 'stopping';
      setState('stopping');
      finalize();
    }
  }, [isConnected, finalize]);

  useEffect(() => {
    return () => {
      clearTimeout(sendLoopRef.current ?? undefined);
      clearInterval(progressTimerRef.current ?? undefined);
    };
  }, []);

  return { state, config, setConfig, progress, result, start, stop, clearResult, loadResult };
}

function computeRampExpected(
  rateStart: number,
  rateEnd: number,
  durationSec: number,
  elapsedMs: number,
): number {
  const t = elapsedMs / 1000;
  const totalSec = durationSec;
  if (totalSec <= 0) return 0;
  const avgRate = rateStart + ((rateEnd - rateStart) * t) / (2 * totalSec);
  return Math.floor(avgRate * t);
}

export { computeRampExpected };

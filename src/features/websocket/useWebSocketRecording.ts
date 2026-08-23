import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WsFrame,
  WsRecording,
  WsRecordingEvent,
  WsRecordingMessageEvent,
  WsReplayProgress,
  WsReplaySpeed,
} from '@shared/websocket/types';
import { saveJsonFile } from '@shared/utils/fileSaver';

export type RecordingState = 'idle' | 'recording' | 'replaying' | 'paused';

export interface UseWebSocketRecordingReturn {
  state: RecordingState;
  startRecording: (url: string, protocol: string) => void;
  stopRecording: () => void;
  recordMessage: (frame: WsFrame) => void;
  recordStateChange: (state: string, url?: string) => void;
  loadRecording: (file: File) => Promise<boolean>;
  startReplay: (onMessage: (frame: WsFrame) => void) => void;
  pauseReplay: () => void;
  resumeReplay: () => void;
  stopReplay: () => void;
  replaySpeed: WsReplaySpeed;
  setReplaySpeed: (speed: WsReplaySpeed) => void;
  replayProgress: WsReplayProgress | null;
  loadedRecording: WsRecording | null;
}

function isValidRecording(data: unknown): data is WsRecording {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;
  if (r._format !== 'ws-recording-v1') return false;
  if (!r.metadata || typeof r.metadata !== 'object') return false;
  if (!Array.isArray(r.events)) return false;
  return true;
}

export function useWebSocketRecording(): UseWebSocketRecordingReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [replaySpeed, setReplaySpeed] = useState<WsReplaySpeed>(1);
  const [replayProgress, setReplayProgress] = useState<WsReplayProgress | null>(null);
  const [loadedRecording, setLoadedRecording] = useState<WsRecording | null>(null);

  const eventsRef = useRef<WsRecordingEvent[]>([]);
  const startTimeRef = useRef<number>(0);
  const metadataRef = useRef<{ url: string; protocol: string }>({ url: '', protocol: '' });

  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayIdxRef = useRef(0);
  const replayCallbackRef = useRef<((frame: WsFrame) => void) | null>(null);
  const replaySpeedRef = useRef<WsReplaySpeed>(1);

  replaySpeedRef.current = replaySpeed;

  const startRecording = useCallback((url: string, protocol: string) => {
    eventsRef.current = [];
    startTimeRef.current = Date.now();
    metadataRef.current = { url, protocol };
    setState('recording');
  }, []);

  const stopRecording = useCallback(() => {
    const durationMs = Date.now() - startTimeRef.current;
    const messageCount = eventsRef.current.filter((e) => e.type === 'message').length;
    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: {
        url: metadataRef.current.url,
        protocol: metadataRef.current.protocol,
        startedAt: new Date(startTimeRef.current).toISOString(),
        durationMs,
        messageCount,
      },
      events: eventsRef.current,
    };
    const filename = `ws-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    saveJsonFile(recording, filename).catch(() => {});
    eventsRef.current = [];
    startTimeRef.current = 0;
    setState('idle');
  }, []);

  const recordMessage = useCallback((frame: WsFrame) => {
    if (startTimeRef.current === 0) return;
    eventsRef.current.push({
      type: 'message',
      relativeMs: Date.now() - startTimeRef.current,
      frame,
    });
  }, []);

  const recordStateChange = useCallback((connState: string, url?: string) => {
    if (startTimeRef.current === 0) return;
    eventsRef.current.push({
      type: 'state-change',
      relativeMs: Date.now() - startTimeRef.current,
      state: connState,
      url,
    });
  }, []);

  const loadRecording = useCallback(async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isValidRecording(parsed)) return false;
      setLoadedRecording(parsed);
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearReplayTimer = useCallback(() => {
    if (replayTimerRef.current !== null) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  }, []);

  const scheduleNextRef = useRef<(recording: WsRecording, onMessage: (frame: WsFrame) => void) => void>(() => {});

  const scheduleNext = useCallback((recording: WsRecording, onMessage: (frame: WsFrame) => void) => {
    const idx = replayIdxRef.current;
    const events = recording.events;

    if (idx >= events.length) {
      setState('idle');
      setReplayProgress(null);
      setLoadedRecording(null);
      return;
    }

    const event = events[idx];
    const speed = replaySpeedRef.current;

    const updateProgress = () => {
      setReplayProgress({
        current: replayIdxRef.current,
        total: events.length,
        elapsedMs: event.relativeMs,
        durationMs: recording.metadata.durationMs,
      });
    };

    if (speed === 0) {
      for (let i = idx; i < events.length; i++) {
        if (events[i].type === 'message') {
          onMessage((events[i] as WsRecordingMessageEvent).frame);
        }
      }
      replayIdxRef.current = events.length;
      setReplayProgress({
        current: events.length,
        total: events.length,
        elapsedMs: recording.metadata.durationMs,
        durationMs: recording.metadata.durationMs,
      });
      setState('idle');
      setLoadedRecording(null);
      return;
    }

    const prevRelativeMs = idx > 0 ? events[idx - 1].relativeMs : 0;
    const delayMs = Math.max(0, (event.relativeMs - prevRelativeMs) / speed);

    replayTimerRef.current = setTimeout(() => {
      replayTimerRef.current = null;
      if (event.type === 'message') {
        onMessage(event.frame);
      }
      replayIdxRef.current = idx + 1;
      updateProgress();
      scheduleNextRef.current(recording, onMessage);
    }, delayMs);
  }, []);

  scheduleNextRef.current = scheduleNext;

  const startReplay = useCallback((onMessage: (frame: WsFrame) => void) => {
    if (!loadedRecording) return;
    clearReplayTimer();
    replayIdxRef.current = 0;
    replayCallbackRef.current = onMessage;
    setReplayProgress({
      current: 0,
      total: loadedRecording.events.length,
      elapsedMs: 0,
      durationMs: loadedRecording.metadata.durationMs,
    });
    setState('replaying');
    scheduleNext(loadedRecording, onMessage);
  }, [loadedRecording, clearReplayTimer, scheduleNext]);

  const pauseReplay = useCallback(() => {
    clearReplayTimer();
    setState('paused');
  }, [clearReplayTimer]);

  const resumeReplay = useCallback(() => {
    if (!loadedRecording || !replayCallbackRef.current) return;
    setState('replaying');
    scheduleNext(loadedRecording, replayCallbackRef.current);
  }, [loadedRecording, scheduleNext]);

  const stopReplay = useCallback(() => {
    clearReplayTimer();
    replayIdxRef.current = 0;
    replayCallbackRef.current = null;
    setReplayProgress(null);
    setLoadedRecording(null);
    setState('idle');
  }, [clearReplayTimer]);

  useEffect(() => {
    return () => {
      if (replayTimerRef.current !== null) {
        clearTimeout(replayTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    recordMessage,
    recordStateChange,
    loadRecording,
    startReplay,
    pauseReplay,
    resumeReplay,
    stopReplay,
    replaySpeed,
    setReplaySpeed,
    replayProgress,
    loadedRecording,
  };
}

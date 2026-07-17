import { useCallback, useRef, useState } from 'react';

export interface UseWebSocketUptimeReturn {
  uptime: number | null;
  connectedAtRef: React.RefObject<number | null>;
  startUptimeTimer: () => void;
  stopUptimeTimer: () => void;
  resetConnectionTiming: () => void;
}

export function useWebSocketUptime(): UseWebSocketUptimeReturn {
  const [uptime, setUptime] = useState<number | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const uptimeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopUptimeTimer = useCallback(() => {
    if (uptimeTimerRef.current !== null) {
      clearInterval(uptimeTimerRef.current);
      uptimeTimerRef.current = null;
    }
  }, []);

  const resetConnectionTiming = useCallback(() => {
    stopUptimeTimer();
    connectedAtRef.current = null;
    setUptime(null);
  }, [stopUptimeTimer]);

  const startUptimeTimer = useCallback(() => {
    stopUptimeTimer();
    setUptime(0);
    uptimeTimerRef.current = setInterval(() => {
      if (connectedAtRef.current !== null) {
        setUptime(Date.now() - connectedAtRef.current);
      }
    }, 1000);
  }, [stopUptimeTimer]);

  return { uptime, connectedAtRef, startUptimeTimer, stopUptimeTimer, resetConnectionTiming };
}

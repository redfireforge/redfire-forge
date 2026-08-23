import { useState, useEffect, useRef } from 'react';
import { isTauri } from '@shared/utils/platform';

interface ServerStatus {
  online: boolean;
  port?: number;
  timestamp?: string;
  checking: boolean;
}

export default function ServerStatusIndicator() {
  const [status, setStatus] = useState<ServerStatus>({
    online: false,
    checking: true,
  });
  const consecutiveFailures = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkServerStatus = async () => {
      if (cancelled) return;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const response = await fetch('/health', {
          signal: controller.signal,
          priority: 'low' as RequestPriority,
        });

        clearTimeout(timeoutId);

        if (cancelled) return;
        if (response.ok) {
          const data = await response.json();
          consecutiveFailures.current = 0;
          setStatus({
            online: true,
            port: data.port,
            timestamp: data.timestamp,
            checking: false,
          });
        } else {
          consecutiveFailures.current++;
          setStatus({ online: false, checking: false });
        }
      } catch {
        if (cancelled) return;
        consecutiveFailures.current++;
        setStatus({ online: false, checking: false });
      }

      // Stop polling after 2 consecutive failures — user can click to retry
      if (consecutiveFailures.current >= 2 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    checkServerStatus();
    intervalRef.current = setInterval(checkServerStatus, 15000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleClick = async () => {
    setStatus(prev => ({ ...prev, checking: true }));
    consecutiveFailures.current = 0;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const response = await fetch('/health', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        setStatus({ online: true, port: data.port, timestamp: data.timestamp, checking: false });
        // Restart polling
        if (!intervalRef.current) {
          const poll = async () => {
            try {
              const c = new AbortController();
              const t = setTimeout(() => c.abort(), 1500);
              const r = await fetch('/health', { signal: c.signal, priority: 'low' as RequestPriority });
              clearTimeout(t);
              if (r.ok) {
                const d = await r.json();
                setStatus({ online: true, port: d.port, timestamp: d.timestamp, checking: false });
                consecutiveFailures.current = 0;
              } else {
                consecutiveFailures.current++;
                setStatus({ online: false, checking: false });
              }
            } catch {
              consecutiveFailures.current++;
              setStatus({ online: false, checking: false });
            }
            if (consecutiveFailures.current >= 2 && intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          };
          intervalRef.current = setInterval(poll, 15000);
        }
      } else {
        setStatus({ online: false, checking: false });
      }
    } catch {
      setStatus({ online: false, checking: false });
    }
  };

  const isDesktop = isTauri();
  const stateClass = status.checking ? 'checking' : status.online ? 'online' : isDesktop ? 'native' : 'offline';

  const label = status.checking
    ? '⟳ Checking...'
    : status.online
      ? '✓ Server Running'
      : isDesktop
        ? '⚡ Native Desktop'
        : '✗ Server Offline';

  const title = status.online
    ? `Server healthy on port ${status.port}\nClick to refresh`
    : isDesktop
      ? 'Running in native desktop mode\nWS/Kafka use Rust transport\nClick to check proxy server'
      : 'Server not responding\nClick to retry';

  return (
    <div
      className={`wf-server-status wf-server-status-${stateClass}`}
      onClick={handleClick}
      title={title}
    >
      <div className={`wf-server-dot wf-server-dot-${stateClass}`} />
      <span className="wf-server-label">
        {label}
      </span>
      {status.online && status.port && (
        <span className="wf-server-port">:{status.port}</span>
      )}
    </div>
  );
}

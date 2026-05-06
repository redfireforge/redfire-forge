import { useState, useEffect } from 'react';

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

  const checkServerStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch('/health', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setStatus({
          online: true,
          port: data.port,
          timestamp: data.timestamp,
          checking: false,
        });
      } else {
        setStatus({ online: false, checking: false });
      }
    } catch {
      setStatus({ online: false, checking: false });
    }
  };

  useEffect(() => {
    checkServerStatus();  
    const interval = setInterval(checkServerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const stateClass = status.checking ? 'checking' : status.online ? 'online' : 'offline';

  return (
    <div
      className={`wf-server-status wf-server-status-${stateClass}`}
      onClick={checkServerStatus}
      title={status.online ? `Server healthy on port ${status.port}\nClick to refresh` : 'Server not responding\nClick to retry'}
    >
      <div className={`wf-server-dot wf-server-dot-${stateClass}`} />
      <span className="wf-server-label">
        {status.checking ? '⟳ Checking...' : status.online ? '✓ Server Running' : '✗ Server Offline'}
      </span>
      {status.online && status.port && (
        <span className="wf-server-port">:{status.port}</span>
      )}
    </div>
  );
}

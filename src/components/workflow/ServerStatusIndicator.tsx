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

  useEffect(() => {
    // Check immediately on mount
    checkServerStatus();

    // Then check every 10 seconds
    const interval = setInterval(checkServerStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  const checkServerStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      const response = await fetch('http://localhost:3001/health', {
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
    } catch (error) {
      setStatus({ online: false, checking: false });
    }
  };

  const getStatusColor = () => {
    if (status.checking) return '#ffa726'; // Orange for checking
    return status.online ? '#4caf50' : '#f44336'; // Green for online, red for offline
  };

  const getStatusText = () => {
    if (status.checking) return 'Checking...';
    return status.online ? 'Server Running' : 'Server Offline';
  };

  const getStatusIcon = () => {
    if (status.checking) return '⟳';
    return status.online ? '✓' : '✗';
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: status.online ? '#e8f5e9' : (status.checking ? '#fff3e0' : '#ffebee'),
        border: `1px solid ${getStatusColor()}`,
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.3s',
      }}
      onClick={checkServerStatus}
      title={status.online ? `Server healthy on port ${status.port}\nClick to refresh` : 'Server not responding\nClick to retry'}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          animation: status.checking ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ color: getStatusColor() }}>
        {getStatusIcon()} {getStatusText()}
      </span>
      {status.online && status.port && (
        <span style={{ color: '#666', fontSize: '0.75rem' }}>
          :{status.port}
        </span>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

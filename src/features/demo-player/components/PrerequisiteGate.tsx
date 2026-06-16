/**
 * PrerequisiteGate — shown before a Docker-dependent demo lesson can start.
 *
 * Displays the required `docker compose` command and polls the endpoint every
 * 3 seconds. Calls `onServerReady` the moment the server becomes reachable so
 * the parent (LessonPlayer) can enable its single "Start Demo →" footer button.
 * There is intentionally NO second button here — one CTA only.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { checkEndpoint } from '../utils/checkEndpoint';

interface PrerequisiteGateProps {
  /** WS or HTTP URL to probe (e.g. ws://localhost:3100/socket.io/?EIO=4) */
  endpoint: string;
  /** Human-readable docker compose command to display */
  dockerCommand: string;
  /** Called once when the server first becomes reachable — parent uses this to enable Start Demo */
  onServerReady: () => void;
}

type ProbeState = 'idle' | 'checking' | 'up' | 'down';

export default function PrerequisiteGate({ endpoint, dockerCommand, onServerReady }: PrerequisiteGateProps) {
  const [probeState, setProbeState] = useState<ProbeState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const notifiedRef = useRef(false);

  const probe = useCallback(async () => {
    if (!mountedRef.current) return;
    setProbeState('checking');
    const ok = await checkEndpoint(endpoint, 2500);
    if (!mountedRef.current) return;
    setProbeState(ok ? 'up' : 'down');
    if (ok && !notifiedRef.current) {
      notifiedRef.current = true;
      onServerReady();
    }
  }, [endpoint, onServerReady]);

  useEffect(() => {
    mountedRef.current = true;
    notifiedRef.current = false;
    void probe();
    intervalRef.current = setInterval(probe, 3000);
    return () => {
      mountedRef.current = false;
      clearInterval(intervalRef.current!);
    };
  }, [probe]);

  const statusIcon = {
    idle:     '⏳',
    checking: '⏳',
    up:       '✓',
    down:     '✗',
  }[probeState];

  const statusLabel = {
    idle:     'Checking…',
    checking: 'Checking…',
    up:       'Server detected — ready to start',
    down:     'Server not detected — start the container below',
  }[probeState];

  return (
    <div className="prereq-gate" data-testid="prereq-gate">
      <div className="prereq-gate-header">
        <span className="prereq-gate-label">🐳 Docker Required</span>
        {probeState === 'checking' && (
          <span className="prereq-spinner" aria-label="Checking server…" />
        )}
      </div>

      <div className={`prereq-status prereq-status--${probeState}`} data-testid="prereq-status">
        <span className="prereq-status-icon" aria-hidden="true">{statusIcon}</span>
        <span className="prereq-status-label">{statusLabel}</span>
      </div>

      <div className="prereq-instruction">
        <p className="prereq-instruction-title">Run this command in a terminal:</p>
        <pre className="prereq-command" data-testid="prereq-command">
          <code>{dockerCommand}</code>
        </pre>
        <p className="prereq-instruction-note">
          This page will detect the container automatically — the Start Demo button below will unlock.
        </p>
      </div>
    </div>
  );
}

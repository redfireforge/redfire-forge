/**
 * PrerequisiteGate — shown before a Docker-dependent demo lesson can start.
 *
 * Displays the required `docker compose` command and polls the endpoint every
 * 3 seconds. Calls `onServerReady` the moment the server becomes reachable so
 * the parent (LessonPlayer) can enable its single "Start Demo →" footer button.
 * There is intentionally NO second button here — one CTA only.
 *
 * When `tabBudget` is set for a GraphQL Studio lesson, also checks that the
 * user has enough free tab slots (§11.0.7).
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { checkEndpoint } from '../utils/checkEndpoint';
import {
  countUserTabsInStorage,
  userTabsToCloseForLesson,
  MAX_TABS,
} from '../../graphql/utils/gqlDemoWorkspace';

interface PrerequisiteGateProps {
  /** WS or HTTP URL to probe (e.g. ws://localhost:3100/socket.io/?EIO=4). Legacy single-endpoint lessons. */
  endpoint?: string;
  /** All endpoints that must be reachable. When set, every probe must succeed. */
  endpoints?: string[];
  /** Human-readable docker compose command to display */
  dockerCommand: string;
  /** Called once when the server first becomes reachable — parent uses this to enable Start Demo */
  onServerReady: () => void;
  /** GraphQL Studio tab slots this lesson reserves (§11.0). Omit when not a studio lesson. */
  tabBudget?: number;
  /** Called once when the user has closed enough tabs for this lesson. */
  onTabCapacityReady?: () => void;
}

type ProbeState = 'idle' | 'checking' | 'up' | 'down';
type TabCapacityState = 'idle' | 'checking' | 'ok' | 'blocked';

export default function PrerequisiteGate({
  endpoint,
  endpoints,
  dockerCommand,
  onServerReady,
  tabBudget,
  onTabCapacityReady,
}: PrerequisiteGateProps) {
  const probeEndpoints = useMemo(
    () => (endpoints?.length ? endpoints : endpoint ? [endpoint] : []),
    [endpoints, endpoint],
  );
  const [probeState, setProbeState] = useState<ProbeState>('idle');
  const [tabCapacityState, setTabCapacityState] = useState<TabCapacityState>('idle');
  const [tabsToClose, setTabsToClose] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const notifiedRef = useRef(false);
  const tabNotifiedRef = useRef(false);
  const budget = tabBudget ?? 1;
  const needsTabGate = budget > 0 && Boolean(onTabCapacityReady);

  const checkTabCapacity = useCallback(async () => {
    if (!needsTabGate || !mountedRef.current) return;
    setTabCapacityState('checking');
    const userCount = await countUserTabsInStorage();
    const toClose = userTabsToCloseForLesson(userCount, budget);
    if (!mountedRef.current) return;
    setTabsToClose(toClose);
    if (toClose === 0) {
      setTabCapacityState('ok');
      if (!tabNotifiedRef.current) {
        tabNotifiedRef.current = true;
        onTabCapacityReady?.();
      }
    } else {
      setTabCapacityState('blocked');
    }
  }, [budget, needsTabGate, onTabCapacityReady]);

  const probe = useCallback(async () => {
    if (!mountedRef.current || probeEndpoints.length === 0) return;
    setProbeState('checking');
    const results = await Promise.all(
      probeEndpoints.map((url) => checkEndpoint(url, 2500)),
    );
    const ok = results.every(Boolean);
    if (!mountedRef.current) return;
    setProbeState(ok ? 'up' : 'down');
    if (ok && !notifiedRef.current) {
      notifiedRef.current = true;
      onServerReady();
    }
  }, [probeEndpoints, onServerReady]);

  useEffect(() => {
    mountedRef.current = true;
    notifiedRef.current = false;
    tabNotifiedRef.current = false;
    void probe();
    void checkTabCapacity();
    intervalRef.current = setInterval(() => {
      void probe();
      void checkTabCapacity();
    }, 3000);
    return () => {
      mountedRef.current = false;
      clearInterval(intervalRef.current!);
    };
  }, [probe, checkTabCapacity]);

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

      {needsTabGate && tabCapacityState === 'blocked' && (
        <div className="prereq-tab-capacity" data-testid="prereq-tab-capacity">
          <p className="prereq-tab-capacity-title">
            This lesson needs {budget} workspace tab slot{budget > 1 ? 's' : ''}.
          </p>
          <p className="prereq-tab-capacity-note">
            Close at least <strong>{tabsToClose}</strong> tab{tabsToClose > 1 ? 's' : ''} in GraphQL
            Studio (max {MAX_TABS - budget} user tabs while this lesson runs).
          </p>
        </div>
      )}

      {needsTabGate && tabCapacityState === 'ok' && tabsToClose === 0 && budget > 1 && (
        <div className="prereq-tab-capacity prereq-tab-capacity--ok" data-testid="prereq-tab-capacity-ok">
          <span className="prereq-status-icon" aria-hidden="true">✓</span>
          <span>Enough tab slots available for this lesson.</span>
        </div>
      )}
    </div>
  );
}

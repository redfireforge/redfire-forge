/** Phase 4J-D — Kubernetes port-forward settings with optional kubectl automation. */
import { useEffect, useRef, useState } from 'react';
import {
  getGrpcK8sPortForwardLogs,
  getGrpcK8sPortForwardStatus,
  postGrpcK8sPortForwardClearLogs,
  postGrpcK8sPortForwardStart,
  postGrpcK8sPortForwardStop,
  type GrpcK8sPortForwardApiLogLine,
} from '../../../shared/grpc/grpcApiClient';
import {
  buildKubectlPortForwardCommand,
  buildK8sLocalTarget,
  DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG,
  finalizeGrpcK8sPortForwardConfig,
  isGrpcK8sPortForwardConfigReady,
  normalizeGrpcK8sPortForwardConfig,
  normalizeGrpcK8sPortNumber,
  type GrpcK8sPortForwardConfig,
  type GrpcK8sPortForwardSession,
  type GrpcK8sTargetType,
} from '../utils/grpcK8sPortForward';

export interface GrpcK8sPortForwardPanelProps {
  session?: GrpcK8sPortForwardSession;
  disabled?: boolean;
  automationScopeId?: string;
  onSessionChange?: (session: GrpcK8sPortForwardSession) => void;
  onApplyTarget?: (target: string) => void;
}

export function GrpcK8sPortForwardPanel({
  session,
  disabled = false,
  automationScopeId,
  onSessionChange,
  onApplyTarget,
}: GrpcK8sPortForwardPanelProps) {
  const [config, setConfig] = useState<GrpcK8sPortForwardConfig>(() => (
    normalizeGrpcK8sPortForwardConfig(session?.config ?? DEFAULT_GRPC_K8S_PORT_FORWARD_CONFIG)
  ));
  const [active, setActive] = useState(session?.active ?? false);
  const configRef = useRef(config);
  const activeRef = useRef(active);
  const automationScopeRef = useRef(automationScopeId);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [automationPid, setAutomationPid] = useState<number | null>(null);
  const [automationBacked, setAutomationBacked] = useState(false);
  const [automationLogs, setAutomationLogs] = useState<GrpcK8sPortForwardApiLogLine[]>([]);
  const [automationLogSeq, setAutomationLogSeq] = useState(0);
  const [logActionBusy, setLogActionBusy] = useState(false);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const automationLogSeqRef = useRef(0);
  const logLinesRef = useRef<HTMLDivElement | null>(null);
  const onSessionChangeRef = useRef(onSessionChange);
  const onApplyTargetRef = useRef(onApplyTarget);

  configRef.current = config;
  activeRef.current = active;
  automationLogSeqRef.current = automationLogSeq;
  automationScopeRef.current = automationScopeId;
  onSessionChangeRef.current = onSessionChange;
  onApplyTargetRef.current = onApplyTarget;

  useEffect(() => {
    setActive(session?.active ?? false);
    activeRef.current = session?.active ?? false;
  }, [session?.active]);

  const ready = isGrpcK8sPortForwardConfigReady(config);
  const kubectlCommand = ready ? buildKubectlPortForwardCommand(config) : '';
  const automationScopeIdTrimmed = (automationScopeId ?? '').trim();
  const automationEnabled = automationScopeIdTrimmed.length > 0;
  const shouldSyncAutomationStatus = automationEnabled && automationBacked;
  const shouldPollAutomationLogs = automationEnabled && automationBacked;
  const fieldsDisabled = disabled || active || automationBusy;

  const persistSession = (nextConfig: GrpcK8sPortForwardConfig, nextActive: boolean) => {
    onSessionChangeRef.current?.({ config: nextConfig, active: nextActive });
  };

  const updateConfig = (patch: Partial<GrpcK8sPortForwardConfig>) => {
    const next = normalizeGrpcK8sPortForwardConfig({ ...configRef.current, ...patch });
    configRef.current = next;
    setConfig(next);
    persistSession(next, activeRef.current);
  };

  const handleStart = () => {
    const normalized = finalizeGrpcK8sPortForwardConfig(configRef.current);
    if (!isGrpcK8sPortForwardConfigReady(normalized) || disabled) return;

    setAutomationError(null);
    configRef.current = normalized;
    setConfig(normalized);

    setActive(true);
    activeRef.current = true;
    persistSession(normalized, true);
    onApplyTargetRef.current?.(buildK8sLocalTarget(normalized));

    if (automationEnabled) {
      setAutomationBusy(true);
      void postGrpcK8sPortForwardStart(automationScopeIdTrimmed, normalized)
        .then((serverState) => {
          setAutomationPid(serverState.pid ?? null);
          setAutomationBacked(Boolean(serverState.active));
          setAutomationLogs([]);
          setAutomationLogSeq(0);
        })
        .catch((error) => {
          // Fallback keeps prior manual workflow available if kubectl automation is unavailable.
          const message = error instanceof Error ? error.message : 'Failed to start kubectl automation';
          setAutomationError(`${message}. Running in manual mode.`);
          setAutomationPid(null);
          setAutomationBacked(false);
        })
        .finally(() => {
          setAutomationBusy(false);
        });
      return;
    }
  };

  const handleStop = () => {
    const normalized = finalizeGrpcK8sPortForwardConfig(configRef.current);
    configRef.current = normalized;
    setConfig(normalized);

    if (automationBacked && automationEnabled) {
      setAutomationBusy(true);
      void postGrpcK8sPortForwardStop(automationScopeIdTrimmed)
        .then(() => {
          setAutomationBacked(false);
          setAutomationPid(null);
          setActive(false);
          activeRef.current = false;
          persistSession(normalized, false);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Failed to stop kubectl automation';
          setAutomationError(message);
        })
        .finally(() => {
          setAutomationBusy(false);
        });
      return;
    }

    setActive(false);
    activeRef.current = false;
    persistSession(normalized, false);
  };

  useEffect(() => {
    if (!shouldSyncAutomationStatus) return;

    let cancelled = false;
    const sync = async () => {
      try {
        const status = await getGrpcK8sPortForwardStatus(automationScopeIdTrimmed);
        if (cancelled) return;
        if (status.config) {
          const syncedConfig = normalizeGrpcK8sPortForwardConfig(status.config);
          configRef.current = syncedConfig;
          setConfig(syncedConfig);
        }
        setAutomationPid(status.pid ?? null);
        setAutomationBacked(Boolean(status.active));
        const shouldAdoptRemoteActive = !activeRef.current || status.active;
        if (shouldAdoptRemoteActive && status.active !== activeRef.current) {
          setActive(status.active);
          activeRef.current = status.active;
          persistSession(configRef.current, status.active);
        }
      } catch {
        if (!cancelled) {
          setAutomationBacked(false);
        }
      }
    };

    void sync();

    if (!active) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => {
      void sync();
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, automationScopeId, shouldSyncAutomationStatus, automationScopeIdTrimmed]);

  useEffect(() => {
    if (autoScrollPaused) return;
    const container = logLinesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [automationLogs, autoScrollPaused]);

  const handleClearLogs = () => {
    if (!automationEnabled) {
      setAutomationLogs([]);
      return;
    }
    setLogActionBusy(true);
    void postGrpcK8sPortForwardClearLogs(automationScopeIdTrimmed)
      .then((result) => {
        setAutomationLogs([]);
        setAutomationLogSeq(result.latestSeq);
        automationLogSeqRef.current = result.latestSeq;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to clear kubectl logs';
        setAutomationError(message);
      })
      .finally(() => {
        setLogActionBusy(false);
      });
  };

  useEffect(() => {
    if (!shouldPollAutomationLogs) return;

    let cancelled = false;

    const readLogs = async () => {
      try {
        const logs = await getGrpcK8sPortForwardLogs(automationScopeIdTrimmed, automationLogSeqRef.current);
        if (cancelled || logs.lines.length === 0) return;
        setAutomationLogs((previous) => {
          const merged = [...previous, ...logs.lines];
          if (merged.length > 120) {
            return merged.slice(merged.length - 120);
          }
          return merged;
        });
        setAutomationLogSeq(logs.latestSeq);
        automationLogSeqRef.current = logs.latestSeq;
      } catch {
        // best-effort polling; UI already exposes status/errors elsewhere
      }
    };

    void readLogs();
    const timer = window.setInterval(() => {
      void readLogs();
    }, active ? 1500 : 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, automationScopeId, shouldPollAutomationLogs, automationScopeIdTrimmed]);

  return (
    <div className="grpc-k8s-panel" data-testid="grpc-k8s-panel">
      <div className="grpc-settings-card">
        <div className="grpc-settings-card-header">
          <h3 className="grpc-settings-card-title">Kubernetes Port-Forwarding</h3>
          <span className="grpc-settings-card-chip">Warthog-inspired</span>
        </div>
        <div className="grpc-settings-card-body">
          <p className="grpc-k8s-hint">
            Run
            {' '}
            <code className="grpc-inline-code">kubectl port-forward</code>
            {' '}
            in your terminal, then click
            {' '}
            <strong>Start Port-Forward</strong>
            {' '}
            to point gRPC Studio at the local forwarded port.
          </p>

          <div className="grpc-k8s-form-grid">
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-namespace">
                Namespace
              </label>
              <div className="grpc-tls-form-ctrl">
                <input
                  id="grpc-k8s-namespace"
                  type="text"
                  className="grpc-tls-text-input"
                  data-testid="grpc-k8s-namespace"
                  value={config.namespace}
                  disabled={fieldsDisabled}
                  onChange={(event) => updateConfig({ namespace: event.target.value })}
                />
              </div>
            </div>
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-target-type">
                Target type
              </label>
              <div className="grpc-tls-form-ctrl">
                <select
                  id="grpc-k8s-target-type"
                  className="grpc-compression-select"
                  data-testid="grpc-k8s-target-type"
                  value={config.targetType}
                  disabled={fieldsDisabled}
                  onChange={(event) => updateConfig({
                    targetType: event.target.value as GrpcK8sTargetType,
                  })}
                >
                  <option value="service">service</option>
                  <option value="pod">pod</option>
                  <option value="deployment">deployment</option>
                </select>
              </div>
            </div>
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-name">
                Name
              </label>
              <div className="grpc-tls-form-ctrl">
                <input
                  id="grpc-k8s-name"
                  type="text"
                  className="grpc-tls-text-input"
                  data-testid="grpc-k8s-name"
                  placeholder="service/pod name"
                  value={config.name}
                  disabled={fieldsDisabled}
                  onChange={(event) => updateConfig({ name: event.target.value })}
                />
              </div>
            </div>
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-remote-port">
                Remote port
              </label>
              <div className="grpc-tls-form-ctrl">
                <input
                  id="grpc-k8s-remote-port"
                  type="number"
                  className="grpc-tls-text-input"
                  data-testid="grpc-k8s-remote-port"
                  min={1}
                  max={65535}
                  value={config.remotePort}
                  disabled={fieldsDisabled}
                  onChange={(event) => {
                    const remotePort = normalizeGrpcK8sPortNumber(event.target.value);
                    if (remotePort != null) {
                      updateConfig({ remotePort });
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grpc-tls-form-row">
            <label className="grpc-tls-form-label" htmlFor="grpc-k8s-local-port">
              Local port
            </label>
            <div className="grpc-tls-form-ctrl">
              <input
                id="grpc-k8s-local-port"
                type="number"
                className="grpc-tls-text-input"
                data-testid="grpc-k8s-local-port"
                min={1}
                max={65535}
                value={config.localPort}
                disabled={fieldsDisabled}
                onChange={(event) => {
                  const localPort = normalizeGrpcK8sPortNumber(event.target.value);
                  if (localPort != null) {
                    updateConfig({ localPort });
                  }
                }}
              />
            </div>
          </div>

          <div className="grpc-tls-form-row">
            <label className="grpc-tls-form-label" htmlFor="grpc-k8s-context">
              Context (kubeconfig)
            </label>
            <div className="grpc-tls-form-ctrl">
              <input
                id="grpc-k8s-context"
                type="text"
                className="grpc-tls-text-input"
                data-testid="grpc-k8s-context"
                placeholder="Optional — e.g. minikube"
                value={config.context}
                disabled={fieldsDisabled}
                onChange={(event) => updateConfig({ context: event.target.value })}
              />
            </div>
          </div>

          <div className="grpc-k8s-actions">
            <button
              type="button"
              className="btn btn-primary"
              data-testid="grpc-k8s-start-btn"
              disabled={disabled || !ready || active || automationBusy}
              onClick={handleStart}
            >
              {automationBusy ? 'Working...' : 'Start Port-Forward'}
            </button>
            <button
              type="button"
              className="btn"
              data-testid="grpc-k8s-stop-btn"
              disabled={!active || automationBusy}
              onClick={handleStop}
            >
              Stop
            </button>
          </div>

          {automationError && (
            <p className="grpc-auth-warning" data-testid="grpc-k8s-automation-error">
              {automationError}
            </p>
          )}

          {kubectlCommand && (
            <p className="grpc-k8s-command" data-testid="grpc-k8s-command">
              <span className="grpc-k8s-command-label">kubectl:</span>
              {' '}
              <code className="grpc-inline-code">{kubectlCommand}</code>
            </p>
          )}

          {automationBacked && automationPid != null && (
            <p className="grpc-k8s-command" data-testid="grpc-k8s-automation-state">
              kubectl process running (PID:
              {' '}
              {automationPid}
              )
            </p>
          )}

          {automationEnabled && (
            <div className="grpc-k8s-log-view" data-testid="grpc-k8s-log-view">
              <div className="grpc-k8s-log-header">
                <div className="grpc-k8s-log-title">kubectl logs</div>
                <div className="grpc-k8s-log-actions">
                  <button
                    type="button"
                    className="btn"
                    data-testid="grpc-k8s-log-autoscroll-btn"
                    onClick={() => setAutoScrollPaused((value) => !value)}
                  >
                    {autoScrollPaused ? 'Resume Auto-Scroll' : 'Pause Auto-Scroll'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    data-testid="grpc-k8s-log-clear-btn"
                    disabled={logActionBusy || automationLogs.length === 0}
                    onClick={handleClearLogs}
                  >
                    {logActionBusy ? 'Clearing...' : 'Clear Logs'}
                  </button>
                </div>
              </div>
              <div
                ref={logLinesRef}
                className="grpc-k8s-log-lines"
                data-testid="grpc-k8s-log-lines"
              >
                {automationLogs.length === 0 ? (
                  <div className="grpc-k8s-log-empty" data-testid="grpc-k8s-log-empty">
                    No log lines yet. Start port-forwarding to stream kubectl output.
                  </div>
                ) : (
                  automationLogs.map((line) => (
                    <div
                      key={line.seq}
                      className={`grpc-k8s-log-line grpc-k8s-log-line--${line.stream}`}
                    >
                      [{line.stream}] {line.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {active && ready && (
            <div className="grpc-k8s-status" data-testid="grpc-k8s-status">
              Forwarding:
              {' '}
              <span className="grpc-k8s-status-local">localhost:{config.localPort}</span>
              {' → '}
              {config.namespace.trim() || 'default'}
              /
              {config.name.trim()}
              :
              {config.remotePort}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

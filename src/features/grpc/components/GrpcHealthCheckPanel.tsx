import { useCallback, useState } from 'react';
import type { GrpcCallResult } from '../../../shared/grpc/contracts';
import { useGrpcStudioHints } from '../hooks/useGrpcStudioHints';
import { formatGrpcHealthStatusLabel } from '../utils/grpcHealthProbe';
import { GrpcSpringHintCard } from './GrpcSpringHintCard';

export interface GrpcHealthCheckPanelProps {
  healthAvailable: boolean;
  healthWatchAvailable?: boolean;
  probeReady?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onCheckHealth: (serviceName: string) => Promise<{ ok: true; result: GrpcCallResult } | { ok: false; error: string }>;
  onStartWatch: (serviceName: string) => void;
}

export function GrpcHealthCheckPanel({
  healthAvailable,
  healthWatchAvailable = healthAvailable,
  probeReady = true,
  disabled = false,
  busy = false,
  onCheckHealth,
  onStartWatch,
}: GrpcHealthCheckPanelProps) {
  const [serviceName, setServiceName] = useState('');
  const [lastResult, setLastResult] = useState<GrpcCallResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { isDismissed, dismiss } = useGrpcStudioHints();
  const showSpringHealthHint = healthAvailable && !isDismissed('spring_health_actuator');

  const controlsDisabled = disabled || busy || !healthAvailable;
  const checkDisabled = controlsDisabled || !probeReady;
  const watchDisabled = controlsDisabled || !healthWatchAvailable || !probeReady;

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setLastError(null);
    setLastResult(null);
    try {
      const outcome = await onCheckHealth(serviceName);
      if (outcome.ok) {
        setLastResult(outcome.result);
      } else {
        setLastError(outcome.error);
      }
    } finally {
      setChecking(false);
    }
  }, [onCheckHealth, serviceName]);

  const handleWatch = useCallback(() => {
    onStartWatch(serviceName);
  }, [onStartWatch, serviceName]);

  const statusLabel = lastResult ? formatGrpcHealthStatusLabel(lastResult) : null;
  const isServing = statusLabel === 'SERVING';

  return (
    <div className="grpc-health-panel" data-testid="grpc-health-panel">
      <div className="grpc-settings-section">
        <p className="grpc-settings-intro grpc-health-hint">
          Probe server readiness using the standard gRPC health service before you execute real calls.
        </p>
        <div className="grpc-settings-card">
          <div className="grpc-settings-card-body">
            <p className="grpc-health-hint">
            Standard gRPC health protocol —
            {' '}
            <code className="grpc-inline-code">grpc.health.v1.Health/Check</code>
            {' '}
            (unary) and
            {' '}
            <code className="grpc-inline-code">grpc.health.v1.Health/Watch</code>
            {' '}
            (server streaming).
            </p>

            {!healthAvailable && (
              <p className="grpc-settings-note grpc-settings-note--warning grpc-health-unavailable" data-testid="grpc-health-unavailable" role="alert">
              Reflect services first — health.v1.Health was not found in the loaded descriptor.
              </p>
            )}

            {healthAvailable && !probeReady && (
              <p className="grpc-settings-note grpc-settings-note--warning grpc-health-unavailable" data-testid="grpc-health-probe-blocked" role="alert">
              Fix target and TLS configuration before running health checks.
              </p>
            )}

            {showSpringHealthHint && (
              <GrpcSpringHintCard
                hintId="spring_health_actuator"
                onDismiss={() => dismiss('spring_health_actuator')}
              />
            )}

            <div className="grpc-settings-form-card">
              <div className="grpc-settings-form-row">
                <div className="grpc-settings-form-row__label-col">
                  <label className="grpc-settings-form-row__label" htmlFor="grpc-health-service-name">
                    Service name
                  </label>
                  <span className="grpc-settings-form-row__label-hint">
                    Leave empty to check overall server health.
                  </span>
                </div>
                <div className="grpc-settings-form-row__ctrl">
              <input
                id="grpc-health-service-name"
                type="text"
                className="grpc-settings-input"
                data-testid="grpc-health-service-name"
                placeholder="db, redis, diskSpace (optional — empty = overall server health)"
                value={serviceName}
                disabled={controlsDisabled}
                onChange={(event) => setServiceName(event.target.value)}
              />
                </div>
              </div>
            </div>

            <div className="grpc-settings-action-row grpc-health-actions">
            <button
              type="button"
              className="btn btn-success grpc-health-check-btn"
              data-testid="grpc-health-check-btn"
              disabled={checkDisabled || checking}
              onClick={() => { void handleCheck(); }}
            >
              {checking ? 'Checking…' : 'Check Health (Unary)'}
            </button>
            <button
              type="button"
              className="btn grpc-health-watch-btn"
              data-testid="grpc-health-watch-btn"
              disabled={watchDisabled}
              title={!healthWatchAvailable ? 'health.v1.Health/Watch not found in loaded descriptor' : undefined}
              onClick={handleWatch}
            >
              Watch (Stream)
            </button>
            </div>

            {lastError && (
              <div className="grpc-settings-note grpc-settings-note--danger grpc-health-result grpc-health-result--error" data-testid="grpc-health-result-error" role="alert">
              <div className="grpc-health-result-title">Health check failed</div>
              <div className="grpc-health-result-detail">{lastError}</div>
              </div>
            )}

            {lastResult && (
              <div
                className={`grpc-settings-note grpc-health-result${isServing ? ' grpc-health-result--success' : ' grpc-health-result--warning'}`}
                data-testid="grpc-health-result"
              >
              <div className="grpc-health-result-title">
                {isServing ? '✓ SERVING' : statusLabel}
              </div>
              <div className="grpc-health-result-detail">
                {JSON.stringify(lastResult.body ?? {})}
                {' · '}
                {lastResult.durationMs}
                ms · grpc-status:
                {' '}
                {lastResult.status}
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

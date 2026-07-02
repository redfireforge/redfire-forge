import type { ChangeEvent } from 'react';
import type { GrpcAuthConfig, GrpcTargetConnectionSession, GrpcTlsMode } from '../../../shared/grpc/contracts';
import {
  formatGrpcDeadlineLabel,
  isGrpcAuthConfigured,
  resolveGrpcAuthBadgeLabel,
  resolveGrpcConnectionDotModifier,
  resolveGrpcConnectionToggleLabel,
  resolveGrpcTlsBadgePresentation,
} from '../utils/grpcConnectionBarUtils';

export interface GrpcConnectionBarProps {
  target: string;
  targetInvalid?: boolean;
  tlsMode: GrpcTlsMode;
  tlsValid: boolean;
  auth: GrpcAuthConfig | undefined;
  timeoutMs: number;
  targetConnection?: GrpcTargetConnectionSession;
  envName?: string | null;
  disabled?: boolean;
  /** Number of methods loaded via reflection (0 if not loaded). */
  reflectionLoadedCount?: number;
  onTargetChange: (value: string) => void;
  /** Phase 1 — Connect/Disconnect target probe toggle. */
  onConnectionToggle?: () => void;
  /** Phase 4J-B — opens TLS configuration modal. */
  onTlsBadgeClick?: () => void;
  onAuthBadgeClick?: () => void;
  /** Phase 4J-C — opens connection settings drawer on Call nav. */
  onDeadlineBadgeClick?: () => void;
  /** Phase 4J-C — opens connection settings drawer. */
  onSettingsClick?: () => void;
  /** Phase 5H — save current tab request to collection. */
  onSaveRequestClick?: () => void;
  /** Phase 5H — import grpcurl command into active tab. */
  onImportGrpcurlClick?: () => void;
  saveRequestDisabled?: boolean;
}

export function GrpcConnectionBar({
  target,
  targetInvalid = false,
  tlsMode,
  tlsValid,
  auth,
  timeoutMs,
  targetConnection,
  envName,
  disabled = false,
  reflectionLoadedCount = 0,
  onTargetChange,
  onConnectionToggle,
  onTlsBadgeClick,
  onAuthBadgeClick,
  onDeadlineBadgeClick,
  onSettingsClick,
  onSaveRequestClick,
  onImportGrpcurlClick,
  saveRequestDisabled = false,
}: GrpcConnectionBarProps) {
  const tlsBadge = resolveGrpcTlsBadgePresentation(tlsMode, tlsValid);
  const authLabel = resolveGrpcAuthBadgeLabel(auth);
  const authConfigured = isGrpcAuthConfigured(auth);
  const deadlineLabel = formatGrpcDeadlineLabel(timeoutMs);
  const connectionDot = resolveGrpcConnectionDotModifier(targetConnection);
  const connectionToggleLabel = resolveGrpcConnectionToggleLabel(targetConnection);
  const connectionConnected = targetConnection?.state === 'connected';

  const handleTargetChange = (event: ChangeEvent<HTMLInputElement>) => {
    onTargetChange(event.target.value);
  };

  return (
    <div className="grpc-connection-bar" data-testid="grpc-connection-bar">
      <span
        className={`grpc-connection-status-dot grpc-connection-status-dot--${connectionDot}`}
        data-testid="grpc-connection-status-dot"
        title={
          targetConnection?.state === 'connected'
            ? `Connected${targetConnection.latencyMs != null ? ` (${targetConnection.latencyMs}ms)` : ''}`
            : targetConnection?.state === 'error'
              ? (targetConnection.errorMessage ?? 'Connection error')
              : targetConnection?.state === 'connecting'
                ? 'Connecting…'
                : 'Disconnected — click Connect to probe target'
        }
        aria-label={`Connection status: ${connectionDot}`}
      />
      <div className="grpc-connection-target-wrap">
        <input
          id="grpc-target-input"
          className="grpc-connection-target-input"
          data-testid="grpc-target-input"
          value={target}
          onChange={handleTargetChange}
          placeholder="host:port or in-process:&lt;name&gt; or {{grpcHost}}"
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-invalid={targetInvalid}
          aria-describedby="grpc-target-validation"
          aria-label="gRPC target address"
        />
      </div>

      <button
        type="button"
        className={`grpc-connection-tls-badge grpc-connection-tls-badge--${tlsBadge.variant}`}
        data-testid="grpc-tls-badge"
        disabled={disabled}
        onClick={() => onTlsBadgeClick?.()}
        aria-haspopup="dialog"
        aria-label={`TLS mode: ${tlsBadge.label} — configure`}
        title={`TLS: ${tlsBadge.label} — click to configure`}
      >
        <span aria-hidden="true">{tlsBadge.icon}</span>
        {tlsBadge.label}
      </button>

      <button
        type="button"
        className={`grpc-connection-auth-badge${authConfigured ? ' grpc-connection-auth-badge--configured' : ''}`}
        data-testid="grpc-auth-badge"
        disabled={disabled || !onAuthBadgeClick}
        onClick={() => onAuthBadgeClick?.()}
        aria-label={`${authLabel} — open Auth tab`}
        title={`${authLabel} — open Auth tab`}
      >
        {authLabel}
      </button>

      <button
        type="button"
        className="grpc-connection-deadline-badge"
        data-testid="grpc-deadline-badge"
        disabled={disabled}
        onClick={() => onDeadlineBadgeClick?.()}
        aria-label={`Call deadline: ${deadlineLabel} — open call settings`}
        title={`Deadline: ${deadlineLabel} — open call settings`}
      >
        ⏱ {deadlineLabel}
      </button>

      {reflectionLoadedCount > 0 && (
        <span
          className="grpc-connection-reflection-badge"
          data-testid="grpc-connection-reflection-badge"
          title={`Schema loaded: ${reflectionLoadedCount} method${reflectionLoadedCount === 1 ? '' : 's'}`}
        >
          <span aria-hidden="true">●</span>
          {reflectionLoadedCount}
        </span>
      )}

      {envName && (
        <span className="grpc-connection-env-badge" data-testid="grpc-connection-env-badge" title="Active environment">
          {envName}
        </span>
      )}

      {onSettingsClick && (
        <button
          type="button"
          className="grpc-connection-settings-btn"
          data-testid="grpc-connection-settings-btn"
          disabled={disabled}
          onClick={() => onSettingsClick()}
          aria-label="Connection settings"
          title="Connection settings"
        >
          ⚙
        </button>
      )}

      {onConnectionToggle && (
        <button
          type="button"
          className={`grpc-btn grpc-btn--sm${connectionConnected ? ' grpc-btn--primary' : ' grpc-btn--ghost'}`}
          data-testid="grpc-connection-toggle-btn"
          disabled={disabled || targetInvalid || !tlsValid}
          onClick={() => onConnectionToggle()}
          aria-label={connectionToggleLabel}
          title={connectionToggleLabel}
        >
          {connectionToggleLabel}
        </button>
      )}

      <div className="grpc-connection-bar__actions">
        {onImportGrpcurlClick && (
          <button
            type="button"
            className="grpc-btn grpc-btn--ghost grpc-btn--sm"
            data-testid="grpc-import-grpcurl-btn"
            disabled={disabled}
            onClick={() => onImportGrpcurlClick()}
          >
            Import grpcurl
          </button>
        )}
        {onSaveRequestClick && (
          <button
            type="button"
            className="grpc-btn grpc-btn--primary grpc-btn--sm"
            data-testid="grpc-save-request-btn"
            disabled={disabled || saveRequestDisabled}
            onClick={() => onSaveRequestClick()}
          >
            Save request
          </button>
        )}
      </div>
    </div>
  );
}

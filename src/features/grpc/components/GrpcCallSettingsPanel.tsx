import { formatGrpcDeadlineLabel } from '../utils/grpcConnectionBarUtils';
import { formatGrpcTimeoutHeaderValue } from '../utils/grpcCallSettingsUtils';

export interface GrpcCallSettingsPanelProps {
  timeoutMs: number;
  disabled?: boolean;
  onTimeoutMsChange: (timeoutMs: number) => void;
}

export function GrpcCallSettingsPanel({
  timeoutMs,
  disabled = false,
  onTimeoutMsChange,
}: GrpcCallSettingsPanelProps) {
  const handleTimeoutChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onTimeoutMsChange(Math.round(parsed));
  };

  const headerPreview = formatGrpcTimeoutHeaderValue(timeoutMs);

  return (
    <div className="grpc-call-settings-panel" data-testid="grpc-call-settings-panel">
      <div className="grpc-settings-card">
        <div className="grpc-settings-card-header">
          <h3 className="grpc-settings-card-title">Call settings</h3>
          <span className="grpc-settings-card-chip">{formatGrpcDeadlineLabel(timeoutMs)}</span>
        </div>
        <div className="grpc-settings-card-body">
          <div className="grpc-tls-form-row">
            <label className="grpc-tls-form-label" htmlFor="grpc-call-settings-timeout">
              Deadline / timeout
            </label>
            <div className="grpc-tls-form-ctrl grpc-call-settings-timeout-ctrl">
              <input
                id="grpc-call-settings-timeout"
                type="number"
                min={1}
                step={1000}
                className="grpc-tls-text-input grpc-call-settings-timeout-input"
                data-testid="grpc-call-settings-timeout"
                value={timeoutMs}
                disabled={disabled}
                onChange={(event) => handleTimeoutChange(event.target.value)}
              />
              <span className="grpc-call-settings-timeout-unit">ms</span>
            </div>
          </div>
          <p className="grpc-call-settings-hint">
            Applied per call as the client deadline. Send-bar timeout stays in sync with this value.
          </p>
          <div className="grpc-call-settings-preview" data-testid="grpc-call-settings-preview">
            <span className="grpc-call-settings-preview-label">Effective grpc-timeout header</span>
            <code className="grpc-call-settings-preview-value">{headerPreview}</code>
          </div>

          <div className="grpc-call-settings-deferred-grid">
            <div className="grpc-tls-form-row grpc-call-settings-deferred-row">
              <label className="grpc-tls-form-label">Max response size</label>
              <div className="grpc-tls-form-ctrl">
                <input
                  type="text"
                  className="grpc-tls-text-input"
                  data-testid="grpc-call-settings-max-response"
                  value="4 MB"
                  disabled
                  readOnly
                />
                <span className="grpc-call-settings-hint">Channel option — requires proxy transport support</span>
              </div>
            </div>
            <div className="grpc-tls-form-row grpc-call-settings-deferred-row">
              <label className="grpc-tls-form-label">Keepalive (send interval)</label>
              <div className="grpc-tls-form-ctrl">
                <input
                  type="text"
                  className="grpc-tls-text-input"
                  data-testid="grpc-call-settings-keepalive"
                  value="30 s"
                  disabled
                  readOnly
                />
                <span className="grpc-call-settings-hint">Channel option — requires proxy transport support</span>
              </div>
            </div>
          </div>
          <p className="grpc-call-settings-deferred-hint">
            Keepalive and max message size will be editable when channel options ship on the Node proxy.
          </p>
        </div>
      </div>
    </div>
  );
}

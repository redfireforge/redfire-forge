import { formatGrpcTimeoutHeaderValue } from '../utils/grpcCallSettingsUtils';

export interface GrpcCallSettingsPanelProps {
  timeoutMs: number;
  maxResponseSizeMb: number;
  keepaliveIntervalSec: number;
  disabled?: boolean;
  onTimeoutMsChange: (timeoutMs: number) => void;
  onMaxResponseSizeMbChange: (mb: number) => void;
  onKeepaliveIntervalSecChange: (sec: number) => void;
}

export function GrpcCallSettingsPanel({
  timeoutMs,
  maxResponseSizeMb,
  keepaliveIntervalSec,
  disabled = false,
  onTimeoutMsChange,
  onMaxResponseSizeMbChange,
  onKeepaliveIntervalSecChange,
}: GrpcCallSettingsPanelProps) {
  const handleTimeoutChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onTimeoutMsChange(Math.round(parsed));
  };

  const handleMaxResponseSizeChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onMaxResponseSizeMbChange(Math.round(parsed));
  };

  const handleKeepaliveChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onKeepaliveIntervalSecChange(Math.round(parsed));
  };

  const headerPreview = formatGrpcTimeoutHeaderValue(timeoutMs);

  return (
    <div className="grpc-call-settings-panel" data-testid="grpc-call-settings-panel">
      <div className="grpc-settings-section">
        <p className="grpc-settings-intro">
          Control how long calls stay open and how aggressively the client accepts payloads on this tab.
        </p>
        <div className="grpc-settings-card">
          <div className="grpc-settings-card-body">
            <div className="grpc-settings-form-card">
              <div className="grpc-settings-form-row">
                <div className="grpc-settings-form-row__label-col">
                  <label className="grpc-settings-form-row__label" htmlFor="grpc-call-settings-timeout">
                    Deadline / timeout
                  </label>
                  <span className="grpc-settings-form-row__label-hint">
                    Applied per call as the client deadline.
                  </span>
                </div>
                <div className="grpc-settings-form-row__ctrl">
                  <div className="grpc-settings-inline-ctrl grpc-call-settings-timeout-ctrl">
                    <input
                      id="grpc-call-settings-timeout"
                      type="number"
                      min={1}
                      step={1000}
                      className="grpc-settings-input grpc-call-settings-timeout-input"
                      data-testid="grpc-call-settings-timeout"
                      value={timeoutMs}
                      disabled={disabled}
                      onChange={(event) => handleTimeoutChange(event.target.value)}
                    />
                    <span className="grpc-call-settings-timeout-unit">ms</span>
                    <code
                      className="grpc-call-settings-timeout-preview"
                      data-testid="grpc-call-settings-preview"
                      title="Effective grpc-timeout header value sent to the server"
                    >
                      {headerPreview}
                    </code>
                  </div>
                </div>
              </div>

              <div className="grpc-settings-form-row">
                <div className="grpc-settings-form-row__label-col">
                  <label className="grpc-settings-form-row__label" htmlFor="grpc-call-settings-max-response">
                    Max response size
                  </label>
                  <span className="grpc-settings-form-row__label-hint">
                    Channel option for large unary or stream payloads.
                  </span>
                </div>
                <div className="grpc-settings-form-row__ctrl">
                  <div className="grpc-settings-inline-ctrl grpc-call-settings-timeout-ctrl">
                    <input
                      id="grpc-call-settings-max-response"
                      type="number"
                      min={1}
                      step={1}
                      className="grpc-settings-input grpc-call-settings-timeout-input"
                      data-testid="grpc-call-settings-max-response"
                      value={maxResponseSizeMb}
                      disabled={disabled}
                      onChange={(event) => handleMaxResponseSizeChange(event.target.value)}
                    />
                    <span className="grpc-call-settings-timeout-unit">MB</span>
                    <span className="grpc-settings-inline-hint">Requires proxy transport support.</span>
                  </div>
                </div>
              </div>

              <div className="grpc-settings-form-row">
                <div className="grpc-settings-form-row__label-col">
                  <label className="grpc-settings-form-row__label" htmlFor="grpc-call-settings-keepalive">
                    Keepalive interval
                  </label>
                  <span className="grpc-settings-form-row__label-hint">
                    Send periodic HTTP/2 keepalive pings.
                  </span>
                </div>
                <div className="grpc-settings-form-row__ctrl">
                  <div className="grpc-settings-inline-ctrl grpc-call-settings-timeout-ctrl">
                    <input
                      id="grpc-call-settings-keepalive"
                      type="number"
                      min={1}
                      step={1}
                      className="grpc-settings-input grpc-call-settings-timeout-input"
                      data-testid="grpc-call-settings-keepalive"
                      value={keepaliveIntervalSec}
                      disabled={disabled}
                      onChange={(event) => handleKeepaliveChange(event.target.value)}
                    />
                    <span className="grpc-call-settings-timeout-unit">s</span>
                    <span className="grpc-settings-inline-hint">Requires proxy transport support.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grpc-settings-note">
              Send-bar timeout stays in sync with the deadline above. Keepalive and max message size
              become fully effective when proxy channel options are enabled.
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

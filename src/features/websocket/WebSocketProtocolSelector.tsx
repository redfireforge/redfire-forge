import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import { PROTOCOL_REGISTRY, getProtocolInfo } from '../../shared/websocket/protocols/protocolTypes';

interface WebSocketProtocolSelectorProps {
  protocolMode: WsProtocolMode;
  onProtocolModeChange: (mode: WsProtocolMode) => void;
  detectedProtocol: WsProtocolDetectionResult | null;
  disabled?: boolean;
}

export function WebSocketProtocolSelector({
  protocolMode,
  onProtocolModeChange,
  detectedProtocol,
  disabled = false,
}: WebSocketProtocolSelectorProps) {
  const showDetected = protocolMode === 'auto' && detectedProtocol != null;
  const detectedInfo = showDetected ? getProtocolInfo(detectedProtocol!.protocol) : null;

  return (
    <div className="ws-connect-field-row">
      <label className="ws-connect-label" htmlFor="ws-protocol-select">
        Protocol
      </label>
      <div className="ws-protocol-selector-wrapper">
        <select
          id="ws-protocol-select"
          className="ws-protocol-select"
          value={protocolMode}
          onChange={(e) => onProtocolModeChange(e.target.value as WsProtocolMode)}
          disabled={disabled}
          aria-label="Protocol mode"
          data-testid="protocol-select"
        >
          {PROTOCOL_REGISTRY.map((p) => (
            <option
              key={p.id}
              value={p.id}
              disabled={!p.available}
            >
              {p.label}{!p.available ? ' (coming soon)' : ''}
            </option>
          ))}
        </select>
        {showDetected && detectedInfo && (
          <span
            className="ws-protocol-detected-badge"
            title={detectedProtocol!.reason}
            data-testid="protocol-detected-badge"
          >
            Detected: {detectedInfo.label}
          </span>
        )}
      </div>
    </div>
  );
}

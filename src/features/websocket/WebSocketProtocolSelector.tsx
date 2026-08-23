import type { WsProtocolMode, WsProtocolDetectionResult } from '@shared/websocket/protocols/protocolTypes';
import { PROTOCOL_REGISTRY, getProtocolInfo } from '@shared/websocket/protocols/protocolTypes';
import { CustomSelect } from '@shared/components/CustomSelect';

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
        <CustomSelect
          className="ws-protocol-select"
          value={protocolMode}
          onChange={(v) => onProtocolModeChange(v as WsProtocolMode)}
          options={PROTOCOL_REGISTRY.map((p) => ({
            value: p.id,
            label: `${p.label}${!p.available ? ' (coming soon)' : ''}`,
            disabled: !p.available,
          }))}
          disabled={disabled}
          aria-label="Protocol mode"
          data-testid="protocol-select"
        />
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

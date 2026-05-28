interface Props {
  authMode: 'concrete' | 'inherit';
  setAuthMode: (mode: 'concrete' | 'inherit') => void;
  validationPreset: 'none' | 'status-200';
  setValidationPreset: (preset: 'none' | 'status-200') => void;
  /** Optional description for the "Snapshot" auth card (default: 'Freeze current auth') */
  snapshotDesc?: string;
}

/**
 * Shared Auth Mode + Validation option cards used in both SendToHarnessModal and
 * BatchSendToHarnessModal options steps.
 */
export default function HarnessOptionsGrid({
  authMode, setAuthMode,
  validationPreset, setValidationPreset,
  snapshotDesc = 'Freeze current auth',
}: Props) {
  return (
    <div className="send-harness-options-grid">
      <div className="send-harness-option-group">
        <label className="send-harness-label">Auth Mode</label>
        <div className="send-harness-option-cards">
          <label className={`send-harness-option-card${authMode === 'concrete' ? ' selected' : ''}`}>
            <input type="radio" checked={authMode === 'concrete'} onChange={() => setAuthMode('concrete')} />
            <div>
              <span className="send-harness-option-title">Snapshot</span>
              <span className="send-harness-option-desc">{snapshotDesc}</span>
            </div>
          </label>
          <label className={`send-harness-option-card${authMode === 'inherit' ? ' selected' : ''}`}>
            <input type="radio" checked={authMode === 'inherit'} onChange={() => setAuthMode('inherit')} />
            <div>
              <span className="send-harness-option-title">Inherit</span>
              <span className="send-harness-option-desc">Use Harness auth</span>
            </div>
          </label>
        </div>
      </div>

      <div className="send-harness-option-group">
        <label className="send-harness-label">Validation</label>
        <div className="send-harness-option-cards">
          <label className={`send-harness-option-card${validationPreset === 'none' ? ' selected' : ''}`}>
            <input type="radio" checked={validationPreset === 'none'} onChange={() => setValidationPreset('none')} />
            <div>
              <span className="send-harness-option-title">None</span>
              <span className="send-harness-option-desc">No validation rules</span>
            </div>
          </label>
          <label className={`send-harness-option-card${validationPreset === 'status-200' ? ' selected' : ''}`}>
            <input type="radio" checked={validationPreset === 'status-200'} onChange={() => setValidationPreset('status-200')} />
            <div>
              <span className="send-harness-option-title">Status 200</span>
              <span className="send-harness-option-desc">Assert HTTP 200 OK</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

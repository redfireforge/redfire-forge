import { createPortal } from 'react-dom';
import AppModalFrame from '../../shared/components/AppModalFrame';
import { WS_CLOSE_CODE_PRESETS } from '../../shared/websocket/types';
import { MAX_REASON_BYTES } from './WebSocketConnectPanel.helpers';

interface WebSocketCloseCodeModalProps {
  open: boolean;
  closeCode: number;
  setCloseCode: (code: number) => void;
  closeReason: string;
  setCloseReason: (reason: string) => void;
  reasonBytes: number;
  isCodeValid: boolean;
  isReasonValid: boolean;
  canCloseWithCode: boolean;
  codeDescription: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WebSocketCloseCodeModal({
  open,
  closeCode,
  setCloseCode,
  closeReason,
  setCloseReason,
  reasonBytes,
  isCodeValid,
  isReasonValid,
  canCloseWithCode,
  codeDescription,
  onCancel,
  onConfirm,
}: WebSocketCloseCodeModalProps) {
  if (!open) return null;

  return createPortal(
    <AppModalFrame
      open
      title="Close with code"
      titleId="ws-close-code-title"
      onClose={onCancel}
      overlayClassName="ws-close-code-overlay"
      dialogClassName="ws-close-code-modal"
      headerClassName="ws-close-code-header modal-header"
      bodyClassName="ws-close-code-body"
      footerClassName="ws-close-code-actions"
      dialogTestId="close-code-dropdown"
      overlayTestId="close-code-overlay"
      showExpandButton={false}
      showResizeHandles={false}
      closeButtonKind="none"
      footer={(
        <>
          <button
            type="button"
            className="ws-close-code-btn ws-close-code-btn-secondary"
            onClick={onCancel}
            data-testid="close-code-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="ws-close-code-btn ws-close-code-btn-danger"
            onClick={onConfirm}
            disabled={!canCloseWithCode}
            data-testid="close-with-code-btn"
          >
            Close with code
          </button>
        </>
      )}
    >
      <p className="ws-close-code-subtitle">
        Send a WebSocket close frame, then disconnect
      </p>

      <div className="ws-close-code-field">
        <label className="ws-close-code-label" htmlFor="ws-close-code-input">
          Status code
        </label>
        <div className="ws-close-code-input-row">
          <input
            id="ws-close-code-input"
            type="number"
            className="ws-close-code-input"
            value={closeCode}
            onChange={(e) => setCloseCode(parseInt(e.target.value, 10) || 1000)}
            min={1000}
            max={4999}
            data-testid="close-code-input"
            aria-invalid={!isCodeValid}
            aria-describedby={isCodeValid ? 'ws-close-code-desc' : 'ws-close-code-error'}
          />
          {isCodeValid ? (
            <span id="ws-close-code-desc" className="ws-close-code-desc">
              {codeDescription}
            </span>
          ) : (
            <span id="ws-close-code-error" className="ws-close-code-error">
              Must be 1000–4999
            </span>
          )}
        </div>
      </div>

      <div className="ws-close-code-presets-block">
        <span className="ws-close-code-section-label">Quick select</span>
        <div className="ws-close-code-presets" data-testid="close-code-presets">
          {WS_CLOSE_CODE_PRESETS.map((p) => (
            <button
              key={p.code}
              type="button"
              className={`ws-close-preset-btn${closeCode === p.code ? ' is-active' : ''}`}
              onClick={() => setCloseCode(p.code)}
              title={p.description}
              aria-pressed={closeCode === p.code}
            >
              <span className="ws-close-preset-code">{p.code}</span>
              <span className="ws-close-preset-label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ws-close-code-field">
        <div className="ws-close-reason-header">
          <label className="ws-close-code-label" htmlFor="ws-close-reason-input">
            Reason
            <span className="ws-close-reason-optional">Optional</span>
          </label>
          <span
            className={`ws-close-reason-counter${!isReasonValid ? ' is-over' : ''}`}
            aria-live="polite"
          >
            {reasonBytes}/{MAX_REASON_BYTES} bytes
          </span>
        </div>
        <textarea
          id="ws-close-reason-input"
          className="ws-close-reason-input"
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          placeholder="Short explanation sent with the close frame…"
          maxLength={123}
          rows={2}
          data-testid="close-reason-input"
        />
      </div>
    </AppModalFrame>,
    document.body,
  );
}

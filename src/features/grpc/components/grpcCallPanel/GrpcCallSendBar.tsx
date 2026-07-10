import { formatDescriptorSourceLabel } from '../../utils/grpcExplorerUtils';
import type { UseGrpcCallPanelReturn } from './useGrpcCallPanel';

type GrpcCallSendBarProps = Pick<
  UseGrpcCallPanelReturn,
  | 'hasMethod'
  | 'descriptorSource'
  | 'tab'
  | 'disabled'
  | 'hybridEditorEnabled'
  | 'unaryReady'
  | 'streamReady'
  | 'streamActive'
  | 'primaryLabel'
  | 'primaryDisabled'
  | 'isUnaryInFlight'
  | 'sendBlockHint'
  | 'handleTimeoutChange'
  | 'handleOpenHybridWorkspace'
  | 'handlePrimaryAction'
  | 'onCancelUnary'
>;

export function GrpcCallSendBar({
  hasMethod,
  descriptorSource,
  tab,
  disabled,
  hybridEditorEnabled,
  unaryReady,
  streamReady,
  streamActive,
  primaryLabel,
  primaryDisabled,
  isUnaryInFlight,
  sendBlockHint,
  handleTimeoutChange,
  handleOpenHybridWorkspace,
  handlePrimaryAction,
  onCancelUnary,
}: GrpcCallSendBarProps) {
  return (
    <>
      <div
        className={`grpc-call-send-bar${hasMethod ? '' : ' grpc-call-send-bar--placeholder'}`}
        data-testid="grpc-call-send-bar"
      >
        {!hasMethod && (
          <div className="grpc-call-method-empty">Select a method to compose a request.</div>
        )}
        {descriptorSource && (
          <span className="grpc-call-source" data-testid="grpc-call-source">
            {formatDescriptorSourceLabel(descriptorSource)}
          </span>
        )}
        <div className="grpc-call-send-bar-controls">
          <label className="grpc-call-timeout">
            <span>Timeout</span>
            <input
              type="number"
              min={1}
              step={1000}
              className="grpc-call-timeout-input"
              data-testid="grpc-call-timeout-input"
              value={tab.timeoutMs}
              disabled={disabled || !hasMethod}
              onChange={(event) => handleTimeoutChange(event.target.value)}
            />
            <span className="grpc-call-timeout-unit">ms</span>
          </label>
          <div className="grpc-call-inline-actions" data-testid="grpc-call-inline-actions">
            {hybridEditorEnabled && hasMethod && (
              <button
                type="button"
                className="grpc-call-full-form-btn"
                data-testid="grpc-open-full-form-editor-btn"
                disabled={disabled}
                onClick={handleOpenHybridWorkspace}
              >
                Open Full Form Editor
              </button>
            )}
            {unaryReady && (
              <button
                type="button"
                className="grpc-call-send-btn"
                data-testid="grpc-send-btn"
                disabled={primaryDisabled}
                aria-label="Send unary call"
                onClick={handlePrimaryAction}
              >
                {primaryLabel}
              </button>
            )}
            {streamReady && (
              <button
                type="button"
                className="grpc-call-send-btn"
                data-testid={streamActive ? 'grpc-stream-cancel-btn' : 'grpc-stream-start-btn'}
                disabled={primaryDisabled}
                aria-label={streamActive ? 'Cancel stream' : 'Start stream'}
                onClick={handlePrimaryAction}
              >
                {primaryLabel}
              </button>
            )}
            {isUnaryInFlight && (
              <button
                type="button"
                className="grpc-call-cancel-btn"
                data-testid="grpc-cancel-btn"
                aria-label="Cancel unary call"
                onClick={() => onCancelUnary?.()}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
      {sendBlockHint && (
        <p className="grpc-call-send-block-hint" data-testid="grpc-call-send-block-hint" role="alert">
          {sendBlockHint}
        </p>
      )}
    </>
  );
}

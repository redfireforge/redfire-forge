import type { UseGrpcCallPanelReturn } from './useGrpcCallPanel';

type GrpcCallMobileActionBarProps = Pick<
  UseGrpcCallPanelReturn,
  | 'unaryReady'
  | 'streamReady'
  | 'primaryLabel'
  | 'primaryDisabled'
  | 'isUnaryInFlight'
  | 'handlePrimaryAction'
  | 'onCancelUnary'
>;

export function GrpcCallMobileActionBar({
  unaryReady,
  streamReady,
  primaryLabel,
  primaryDisabled,
  isUnaryInFlight,
  handlePrimaryAction,
  onCancelUnary,
}: GrpcCallMobileActionBarProps) {
  return (
    <div className="grpc-call-mobile-action-bar" data-testid="grpc-call-mobile-action-bar">
      {(unaryReady || streamReady) && (
        <button
          type="button"
          className="grpc-call-mobile-primary-btn"
          data-testid="grpc-mobile-primary-action"
          disabled={primaryDisabled}
          onClick={handlePrimaryAction}
        >
          {primaryLabel}
        </button>
      )}
      {isUnaryInFlight && (
        <button
          type="button"
          className="grpc-call-mobile-secondary-btn"
          data-testid="grpc-mobile-cancel-action"
          onClick={() => onCancelUnary?.()}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

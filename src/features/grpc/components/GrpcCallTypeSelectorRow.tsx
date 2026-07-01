import type { GrpcCallType } from '../../../shared/grpc/contracts';
import {
  formatGrpcCallTypeBadge,
  formatGrpcCallTypeLabel,
  grpcCallTypeBadgeModifier,
} from '../utils/grpcExplorerUtils';

const CALL_TYPE_OPTIONS: GrpcCallType[] = [
  'unary',
  'server_streaming',
  'client_streaming',
  'bidi_streaming',
];

export interface GrpcCallTypeSelectorRowProps {
  activeCallType: GrpcCallType;
  /** When set, only the method's call type is selectable — others are preview-disabled. */
  lockedCallType?: GrpcCallType;
  disabled?: boolean;
  onSelectCallType: (callType: GrpcCallType) => void;
}

export function GrpcCallTypeSelectorRow({
  activeCallType,
  lockedCallType,
  disabled = false,
  onSelectCallType,
}: GrpcCallTypeSelectorRowProps) {
  return (
    <div className="grpc-call-type-selector" data-testid="grpc-call-type-selector">
      <span className="grpc-call-type-selector__label">Call type</span>
      <div className="grpc-call-type-selector__tabs" role="tablist" aria-label="Call type layout">
        {CALL_TYPE_OPTIONS.map((callType) => {
          const isActive = activeCallType === callType;
          const isLockedOther = lockedCallType != null && lockedCallType !== callType;
          const tabDisabled = disabled || isLockedOther;
          return (
            <button
              key={callType}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`grpc-call-type-selector__tab${isActive ? ' grpc-call-type-selector__tab--active' : ''}`}
              data-testid={`grpc-call-type-tab-${callType}`}
              disabled={tabDisabled}
              title={
                isLockedOther
                  ? `Select a ${formatGrpcCallTypeLabel(callType).toLowerCase()} method in the explorer`
                  : formatGrpcCallTypeLabel(callType)
              }
              onClick={() => onSelectCallType(callType)}
            >
              <span className={`grpc-method-badge ${grpcCallTypeBadgeModifier(callType)}`}>
                {formatGrpcCallTypeBadge(callType)}
              </span>
              {formatGrpcCallTypeLabel(callType)}
            </button>
          );
        })}
      </div>
      {lockedCallType && (
        <span className="grpc-call-type-selector__hint" data-testid="grpc-call-type-locked-hint">
          Layout follows selected method — switch methods in the explorer to change call type.
        </span>
      )}
    </div>
  );
}

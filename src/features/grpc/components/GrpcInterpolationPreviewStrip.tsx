import type { GrpcInterpolationPreviewViewMode } from '@shared/grpc/grpcInterpolationPreviewModel';

export interface GrpcInterpolationPreviewStripProps {
  showToggle: boolean;
  displayValue: string;
  viewMode: GrpcInterpolationPreviewViewMode;
  status: 'ready' | 'warning' | 'error';
  onViewModeChange: (mode: GrpcInterpolationPreviewViewMode) => void;
}

export function GrpcInterpolationPreviewStrip({
  showToggle,
  displayValue,
  viewMode,
  status,
  onViewModeChange,
}: GrpcInterpolationPreviewStripProps) {
  if (!showToggle && !displayValue) {
    return null;
  }

  return (
    <div
      className={`grpc-interpolation-preview-strip grpc-interpolation-preview-strip--${status}`}
      data-testid="grpc-interpolation-preview-strip"
      data-status={status}
    >
      {showToggle && (
        <div
          className="grpc-interpolation-preview-toggle"
          role="group"
          aria-label="Target preview mode"
        >
          <button
            type="button"
            className={`grpc-interpolation-preview-toggle-btn${viewMode === 'template' ? ' grpc-interpolation-preview-toggle-btn--active' : ''}`}
            data-testid="grpc-interpolation-preview-template"
            aria-pressed={viewMode === 'template'}
            onClick={() => onViewModeChange('template')}
          >
            Template
          </button>
          <button
            type="button"
            className={`grpc-interpolation-preview-toggle-btn${viewMode === 'resolved' ? ' grpc-interpolation-preview-toggle-btn--active' : ''}`}
            data-testid="grpc-interpolation-preview-resolved"
            aria-pressed={viewMode === 'resolved'}
            onClick={() => onViewModeChange('resolved')}
          >
            Resolved
          </button>
        </div>
      )}
      <code
        className="grpc-interpolation-preview-value"
        data-testid="grpc-interpolation-preview-value"
        aria-live="polite"
      >
        {displayValue}
      </code>
    </div>
  );
}

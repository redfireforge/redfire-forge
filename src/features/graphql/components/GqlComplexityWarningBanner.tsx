/**
 * GqlComplexityWarningBanner — inline warning shown when a query exceeds the
 * soft complexity threshold but has not yet hit the configurable hard block.
 */
import type { ComplexityResult } from '../utils/complexityEstimator';

interface GqlComplexityWarningBannerProps {
  visible: boolean;
  complexityResult: ComplexityResult | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function GqlComplexityWarningBanner({
  visible,
  complexityResult,
  onConfirm,
  onDismiss,
}: GqlComplexityWarningBannerProps) {
  if (!visible || !complexityResult) return null;
  return (
    <div
      className="gql-complexity-warning-banner"
      role="alert"
      aria-live="assertive"
      data-testid="gql-complexity-warning-banner"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="gql-complexity-warning-text">
        Very expensive query (cost ~{complexityResult.score}, threshold {complexityResult.threshold}). This may cause high server load.
      </span>
      <button type="button" className="gql-complexity-warning-confirm" onClick={onConfirm} data-testid="gql-complexity-warning-confirm">
        Run anyway
      </button>
      <button type="button" className="gql-complexity-warning-dismiss" onClick={onDismiss} aria-label="Dismiss complexity warning" data-testid="gql-complexity-warning-dismiss">
        ✕
      </button>
    </div>
  );
}

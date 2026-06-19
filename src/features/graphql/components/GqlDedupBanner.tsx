/**
 * GqlDedupBanner — Phase 3F deduplication in-flight banner.
 * Shown when an identical request is already in-flight.
 */

interface GqlDedupBannerProps {
  visible: boolean;
  onWait: () => void;
  onCancelOriginal: () => void;
  onSendAnyway: () => void;
}

export function GqlDedupBanner({ visible, onWait, onCancelOriginal, onSendAnyway }: GqlDedupBannerProps) {
  if (!visible) return null;
  return (
    <div className="gql-dedup-banner" role="alert">
      <span className="gql-dedup-badge">Duplicate in-flight</span>
      <span className="gql-dedup-msg">An identical request is already in-flight.</span>
      <button type="button" className="gql-dedup-btn" onClick={onWait}>
        Wait &amp; merge
      </button>
      <button type="button" className="gql-dedup-btn gql-dedup-btn--cancel" onClick={onCancelOriginal}>
        Cancel original
      </button>
      <button type="button" className="gql-dedup-btn gql-dedup-btn--anyway" onClick={onSendAnyway}>
        Send anyway
      </button>
    </div>
  );
}

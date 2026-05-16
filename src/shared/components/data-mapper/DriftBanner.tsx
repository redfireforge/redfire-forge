import { useMemo } from 'react';
import type { ClassifiedDrift } from './utils/schemaDrift';
import { summarizeClassifiedDrift } from './utils/schemaDrift';

export interface DriftBannerProps {
  drifts: ClassifiedDrift[];
  onAcceptAndUpdate: () => void;
  onDismiss: () => void;
  onShowDiff?: () => void;
}

export default function DriftBanner({ drifts, onAcceptAndUpdate, onDismiss, onShowDiff }: DriftBannerProps) {
  const summary = useMemo(() => summarizeClassifiedDrift(drifts), [drifts]);

  if (!summary.hasDrift) return null;

  const hasBreaking = summary.breakingCount > 0;

  const parts: string[] = [];
  if (summary.added > 0) parts.push(`${summary.added} added`);
  if (summary.removed > 0) parts.push(`${summary.removed} removed`);
  if (summary.typeChanged > 0) parts.push(`${summary.typeChanged} type changed`);
  if (summary.nullableChanged > 0) parts.push(`${summary.nullableChanged} nullable changed`);

  return (
    <div
      className={`dm-drift-banner ${hasBreaking ? 'dm-drift-banner--breaking' : 'dm-drift-banner--warning'}`}
      role="alert"
      aria-live="polite"
    >
      <div className="dm-drift-banner-icon">
        {hasBreaking ? '⛔' : '⚠'}
      </div>
      <div className="dm-drift-banner-content">
        <div className="dm-drift-banner-title">
          {hasBreaking
            ? 'Source schema has breaking changes'
            : 'Source schema changed since last mapping'}
        </div>
        <div className="dm-drift-banner-detail">
          {parts.join(', ')}
          {summary.totalAffectedMappings > 0 && (
            <span className="dm-drift-banner-affected">
              {' '}— {summary.totalAffectedMappings} mapping{summary.totalAffectedMappings !== 1 ? 's' : ''} affected
            </span>
          )}
        </div>
        {hasBreaking && (
          <div className="dm-drift-banner-items">
            {drifts.filter(d => d.severity === 'breaking').map((d) => (
              <div key={d.path} className="dm-drift-item dm-drift-item--breaking">
                <span className="dm-drift-item-icon">✕</span>
                <span className="dm-drift-item-text">{d.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="dm-drift-banner-actions">
        {onShowDiff && (
          <button
            className="dm-drift-btn dm-drift-btn--diff"
            onClick={onShowDiff}
            title="View detailed schema changes"
          >
            Show Diff
          </button>
        )}
        <button
          className="dm-drift-btn dm-drift-btn--accept"
          onClick={onAcceptAndUpdate}
          title="Accept changes and update the saved schema snapshot"
        >
          Accept &amp; Update
        </button>
        <button
          className="dm-drift-btn dm-drift-btn--dismiss"
          onClick={onDismiss}
          aria-label="Dismiss drift notification"
          title="Dismiss this notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

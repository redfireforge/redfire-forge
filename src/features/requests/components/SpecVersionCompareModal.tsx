import { useState, useMemo } from 'react';
import type { RequestItem } from '../../../shared/types';
import { useEscapeKey } from '../../../shared/hooks/useEscapeKey';
import { computeSpecVersionDiff } from '../../catalog/utils/versionDiff';

interface Props {
  request: RequestItem;
  onClose: () => void;
}

export function SpecVersionCompareModal({ request, onClose }: Props) {
  const versions = request.specVersions ?? [];
  const [leftId, setLeftId] = useState(versions[0]?.id ?? '');
  const [rightId, setRightId] = useState(request.activeSpecVersionId ?? versions[versions.length - 1]?.id ?? '');

  useEscapeKey(onClose);

  const leftVersion = versions.find(v => v.id === leftId);
  const rightVersion = versions.find(v => v.id === rightId);

  const changes = useMemo(
    () => computeSpecVersionDiff(leftVersion, rightVersion),
    [leftVersion, rightVersion],
  );

  return (
    <div className="spec-compare-overlay" onClick={onClose}>
      <div className="spec-compare-modal" onClick={e => e.stopPropagation()}>
        <div className="spec-compare-header">
          <h3>Compare Spec Versions</h3>
        </div>

        <div className="spec-compare-selectors">
          <select value={leftId} onChange={e => setLeftId(e.target.value)} aria-label="Left version">
            {versions.map(v => (
              <option key={v.id} value={v.id}>v{v.catalogVersion}</option>
            ))}
          </select>
          <span className="spec-compare-arrow">&rarr;</span>
          <select value={rightId} onChange={e => setRightId(e.target.value)} aria-label="Right version">
            {versions.map(v => (
              <option key={v.id} value={v.id}>v{v.catalogVersion}</option>
            ))}
          </select>
        </div>

        <div className="spec-compare-body">
          {changes.length === 0 ? (
            <div className="spec-compare-no-diff">No differences</div>
          ) : (
            changes.map((c, i) => (
              <div key={i} className={`spec-compare-row ${c.type}`}>
                <span className="spec-compare-icon">
                  {c.type === 'added' && '+'}
                  {c.type === 'removed' && '\u2212'}
                  {c.type === 'modified' && '~'}
                </span>
                <span className="spec-compare-field">{c.field}</span>
                <span className="spec-compare-desc">
                  {c.type === 'modified' && `${c.oldValue ?? ''} → ${c.newValue ?? ''}`}
                  {c.type === 'added' && (c.newValue ?? '')}
                  {c.type === 'removed' && (c.oldValue ?? '')}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="spec-compare-footer">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

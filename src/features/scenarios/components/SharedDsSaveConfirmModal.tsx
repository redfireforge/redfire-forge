/**
 * SharedDsSaveConfirmModal — Impact-aware save confirmation modal.
 * 
 * Shows when user tries to close SharedDataSourceModal with unsaved changes.
 * Displays:
 * - Which shared data sources have changes
 * - Which tests will be affected
 * - Summary of changes (rows added/removed, columns changed, cells modified)
 */
import PopupModal from '../../../shared/components/PopupModal';
import type { SharedDataSource, FeatureGroup } from '../../../shared/types';
import { detectChanges, summarizeChanges, getAffectedDsIds } from '../utils/sharedDsChangeDetection';
import { useMemo } from 'react';

interface Props {
  before: SharedDataSource[];
  after: SharedDataSource[];
  featureGroups: FeatureGroup[];
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function SharedDsSaveConfirmModal({
  before,
  after,
  featureGroups,
  onSave,
  onDiscard,
  onCancel,
}: Props) {
  const changes = useMemo(() => detectChanges(before, after), [before, after]);
  const changeSummary = useMemo(() => summarizeChanges(changes), [changes]);
  const affectedDsIds = useMemo(() => getAffectedDsIds(changes), [changes]);
  
  // Find tests affected by changes
  const affectedTests = useMemo(() => {
    const tests: Array<{ testName: string; fullPath: string; dsName: string }> = [];
    const affectedSet = new Set(affectedDsIds);
    
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        for (const test of sc.tests) {
          if (test.sharedDataSourceId && affectedSet.has(test.sharedDataSourceId)) {
            const ds = after.find(d => d.id === test.sharedDataSourceId);
            tests.push({
              testName: test.name,
              fullPath: `${fg.name} / ${sc.name} / ${test.name}`,
              dsName: ds?.name ?? 'Unknown',
            });
          }
        }
      }
    }
    
    return tests;
  }, [featureGroups, affectedDsIds, after]);
  
  // Get names of affected data sources
  const affectedDsNames = useMemo(() => {
    return affectedDsIds.map(id => {
      const ds = after.find(d => d.id === id) ?? before.find(d => d.id === id);
      return ds?.name ?? 'Unknown';
    });
  }, [affectedDsIds, after, before]);

  return (
    <PopupModal
      title="Save Changes?"
      onClose={onCancel}
      dialogClassName="shared-ds-save-confirm-modal"
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onDiscard}>
            Discard
          </button>
          <button className="btn btn-primary" onClick={onSave}>
            Save Changes
          </button>
        </>
      )}
    >
      <div className="shared-ds-save-confirm-content">
        {/* Summary banner */}
        <div className="shared-ds-save-confirm-banner">
          <span className="shared-ds-save-confirm-icon">⚠️</span>
          <div className="shared-ds-save-confirm-summary">
            <div className="shared-ds-save-confirm-headline">
              {affectedDsNames.length === 1 ? (
                <>Unsaved changes to <strong>{affectedDsNames[0]}</strong></>
              ) : (
                <>Unsaved changes to <strong>{affectedDsNames.length} data sources</strong></>
              )}
            </div>
            {affectedTests.length > 0 && (
              <div className="shared-ds-save-confirm-subtext">
                Will affect {affectedTests.length} linked test{affectedTests.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Affected tests as compact pills */}
        {affectedTests.length > 0 && (
          <div className="shared-ds-save-confirm-section">
            <div className="shared-ds-save-confirm-label">Affected Tests</div>
            <div className="shared-ds-save-confirm-pills">
              {affectedTests.slice(0, 6).map((t, i) => (
                <span key={i} className="shared-ds-save-confirm-pill" title={t.fullPath}>
                  {t.testName}
                </span>
              ))}
              {affectedTests.length > 6 && (
                <span className="shared-ds-save-confirm-pill shared-ds-save-confirm-pill-more">
                  +{affectedTests.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Changes summary */}
        {changeSummary.length > 0 && (
          <div className="shared-ds-save-confirm-section">
            <div className="shared-ds-save-confirm-label">Changes</div>
            <div className="shared-ds-save-confirm-changes">
              {changeSummary.slice(0, 6).map((change, i) => (
                <div key={i} className="shared-ds-save-confirm-change">
                  <span className="shared-ds-save-confirm-change-icon">→</span>
                  {change}
                </div>
              ))}
              {changeSummary.length > 6 && (
                <div className="shared-ds-save-confirm-change shared-ds-save-confirm-change-more">
                  +{changeSummary.length - 6} more changes
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PopupModal>
  );
}

import { normalizeMapperPath } from './utils/pathNormalization';
import type { PatternPropagationPreview } from './utils/patternPropagation';

interface BulkActionsBarProps {
  bulkSourcePath: string | null;
  bulkTargetPath: string | null;
  hasBulkSourceAndTarget: boolean;
  canMapSiblingSubtrees: boolean;
  canPreviewPropagation: boolean;
  selectedMappingTargetPath: string | null;
  propagationPreview: PatternPropagationPreview | null;
  onMapSubtree: () => void;
  onMapSiblingSubtrees: () => void;
  onClearTargetSubtree: () => void;
  onReplaceTargetSubtree: () => void;
  onPreviewPropagation: () => void;
  onApplyPropagation: () => void;
  onClosePropagation: () => void;
}

export default function BulkActionsBar({
  bulkSourcePath,
  bulkTargetPath,
  hasBulkSourceAndTarget,
  canMapSiblingSubtrees,
  canPreviewPropagation,
  selectedMappingTargetPath,
  propagationPreview,
  onMapSubtree,
  onMapSiblingSubtrees,
  onClearTargetSubtree,
  onReplaceTargetSubtree,
  onPreviewPropagation,
  onApplyPropagation,
  onClosePropagation,
}: BulkActionsBarProps) {
  return (
    <>
      <div className="dm-bulk-actions-bar" role="group" aria-label="Bulk mapping actions">
        <span className="dm-bulk-selection">
          Source: <strong>{bulkSourcePath ? normalizeMapperPath(bulkSourcePath) : 'none'}</strong>
        </span>
        <span className="dm-bulk-selection">
          Target: <strong>{bulkTargetPath ? normalizeMapperPath(bulkTargetPath) : 'none'}</strong>
        </span>
        <button
          type="button"
          className="dm-bulk-action-btn"
          onClick={onMapSubtree}
          disabled={!hasBulkSourceAndTarget}
          title="Map selected source subtree to selected target subtree"
        >
          Map subtree
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn"
          onClick={onMapSiblingSubtrees}
          disabled={!hasBulkSourceAndTarget || !canMapSiblingSubtrees}
          title="Map all matching array siblings for selected index nodes"
        >
          Map siblings
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn dm-bulk-action-btn--danger"
          onClick={onClearTargetSubtree}
          disabled={!bulkTargetPath}
          title="Clear mappings under selected target subtree"
        >
          Clear subtree
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn dm-bulk-action-btn--primary"
          onClick={onReplaceTargetSubtree}
          disabled={!hasBulkSourceAndTarget || !bulkTargetPath}
          title="Clear and replace selected target subtree"
        >
          Replace subtree
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn"
          onClick={onPreviewPropagation}
          disabled={!canPreviewPropagation}
          title="Preview pattern propagation from selected mapping"
        >
          Preview propagate
        </button>
        <span className="dm-bulk-selection dm-bulk-selection--inline">
          Anchor mapping: <strong>{selectedMappingTargetPath ? normalizeMapperPath(selectedMappingTargetPath) : 'none'}</strong>
        </span>
      </div>
      {propagationPreview && (
        <div className="dm-propagation-preview" role="region" aria-label="Pattern propagation preview">
          <div className="dm-propagation-preview-head">
            <span className="dm-propagation-preview-title">
              Propagation preview from <strong>{propagationPreview.anchorTargetPath}</strong>
            </span>
            <button
              type="button"
              className="dm-propagation-preview-close"
              onClick={onClosePropagation}
              aria-label="Close propagation preview"
            >
              Close
            </button>
          </div>
          <div className="dm-propagation-preview-stats">
            {propagationPreview.insertedCount} new · {propagationPreview.updatedCount} updated · {propagationPreview.unchangedCount} unchanged · {propagationPreview.missingSourceCount} skipped
          </div>
          <div className="dm-propagation-preview-rows">
            {propagationPreview.rows.slice(0, 12).map((row) => (
              <div key={row.targetPath} className={`dm-propagation-preview-row dm-propagation-preview-row--${row.action}`}>
                <span className="dm-propagation-preview-action">{row.action}</span>
                <span className="dm-propagation-preview-path">{row.targetPath}</span>
                <span className="dm-propagation-preview-arrow">←</span>
                <span className="dm-propagation-preview-path">{row.sourcePath}</span>
              </div>
            ))}
            {propagationPreview.rows.length > 12 && (
              <div className="dm-propagation-preview-more">
                +{propagationPreview.rows.length - 12} more rows
              </div>
            )}
          </div>
          <div className="dm-propagation-preview-actions">
            <button
              type="button"
              className="dm-bulk-action-btn dm-bulk-action-btn--primary"
              onClick={onApplyPropagation}
              disabled={(propagationPreview.insertedCount + propagationPreview.updatedCount) === 0}
            >
              Apply propagation
            </button>
            <button
              type="button"
              className="dm-bulk-action-btn"
              onClick={onClosePropagation}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

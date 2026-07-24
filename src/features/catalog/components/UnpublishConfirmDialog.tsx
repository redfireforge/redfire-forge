import { useState, useCallback } from 'react';
import type { AffectedWorkflowInfo } from '../utils/workflowExposureScanner';

export interface UnpublishRequest {
  endpointLabel: string;
  method: string;
  path: string;
  entryId: string;
  endpointId: string;
  affected: AffectedWorkflowInfo[];
}

interface Props {
  request: UnpublishRequest;
  onPaletteOnly: () => void;
  onPaletteAndWorkflows: () => void;
  onCancel: () => void;
}

export default function UnpublishConfirmDialog({ request, onPaletteOnly, onPaletteAndWorkflows, onCancel }: Props) {
  const [removing, setRemoving] = useState(false);

  const totalNodes = request.affected.reduce((sum, a) => sum + a.nodeIds.length, 0);

  const handleRemoveAll = useCallback(async () => {
    setRemoving(true);
    onPaletteAndWorkflows();
  }, [onPaletteAndWorkflows]);

  return (
    <div className="sw-unpublish-overlay" onMouseDown={onCancel}>
      <div className="sw-unpublish-dialog" onMouseDown={e => e.stopPropagation()}>
        <div className="sw-unpublish-header">
          <span className="sw-unpublish-title">Un-publish Endpoint</span>
        </div>

        <div className="sw-unpublish-body">
          <p className="sw-unpublish-summary">
            <strong>{request.method.toUpperCase()} {request.path}</strong> is used in{' '}
            <strong>{request.affected.length}</strong> workflow{request.affected.length > 1 ? 's' : ''}{' '}
            ({totalNodes} node{totalNodes > 1 ? 's' : ''} total).
          </p>

          <div className="sw-unpublish-list">
            {request.affected.map(a => (
              <div key={a.workflowId} className="sw-unpublish-wf-row">
                <span className="sw-unpublish-wf-name">{a.workflowName}</span>
                <span className="sw-unpublish-wf-count">{a.nodeIds.length} node{a.nodeIds.length > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sw-unpublish-footer">
          <button
            type="button"
            className="sw-unpublish-btn sw-unpublish-btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sw-unpublish-btn sw-unpublish-btn--palette"
            onClick={onPaletteOnly}
            title="Existing workflow nodes remain but lose their catalog link"
          >
            Remove from Palette Only
          </button>
          <button
            type="button"
            className="sw-unpublish-btn sw-unpublish-btn--destructive"
            onClick={handleRemoveAll}
            disabled={removing}
            title="Removes the endpoint from the palette AND deletes all referencing nodes from workflows"
          >
            {removing ? 'Removing…' : 'Remove from Palette & Workflows'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { useModalFrame } from '../../../shared/hooks/useModalFrame';

export interface PublishRequest {
  method: string;
  path: string;
  summary: string;
  entryName: string;
  versionLabel: string;
  currentVersionId: string;
  includeValues: boolean;
  values?: {
    paramValues: Record<string, string>;
    headerValues: Record<string, string>;
    body?: string;
  };
}

export interface PublishResult {
  note: string;
  includeValues: boolean;
}

interface Props {
  request: PublishRequest;
  onConfirm: (result: PublishResult) => void;
  onCancel: () => void;
}

export default function PublishEndpointModal({ request, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState('');
  const [includeValues, setIncludeValues] = useState(request.includeValues);

  const {
    dialogRef,
    dialogStyle,
    overlayStyle,
    headerDragStyle,
    onHeaderPointerDown,
  } = useModalFrame({ open: true, constrainDragToViewport: true });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    onConfirm({ note: note.trim(), includeValues });
  }, [note, includeValues, onConfirm]);

  const hasValues = !!(
    request.values &&
    (Object.values(request.values.paramValues).some(v => v) ||
     Object.values(request.values.headerValues).some(v => v) ||
     request.values.body)
  );

  return (
    <div className="sw-unpublish-overlay" onMouseDown={onCancel} style={overlayStyle} data-testid="publish-endpoint-modal">
      <div
        ref={dialogRef}
        role="dialog"
        className="sw-unpublish-dialog sw-publish-dialog"
        style={dialogStyle}
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className="sw-unpublish-header"
          style={headerDragStyle}
          onPointerDown={onHeaderPointerDown}
        >
          <span className="sw-unpublish-title">Publish Endpoint to Workflow Designer</span>
        </div>

        <div className="sw-unpublish-body sw-publish-body">
          <div className="sw-publish-endpoint-info">
            <span className="sw-publish-method" data-method={request.method.toUpperCase()} data-testid="publish-method">{request.method.toUpperCase()}</span>
            <span className="sw-publish-path" data-testid="publish-path">{request.path}</span>
          </div>

          <div className="sw-publish-meta">
            <div className="sw-publish-meta-row">
              <span className="sw-publish-meta-label">API</span>
              <span className="sw-publish-meta-value" data-testid="publish-api-name">{request.entryName}</span>
            </div>
            <div className="sw-publish-meta-row">
              <span className="sw-publish-meta-label">Version</span>
              <span className="sw-publish-meta-value" data-testid="publish-version">{request.versionLabel}</span>
            </div>
          </div>

          <p className="sw-publish-notice">
            This makes the endpoint permanently available in the Workflow Designer palette for all users.
          </p>

          <div className="sw-publish-note-section">
            <label className="sw-publish-note-label" htmlFor="publish-note">
              Note <span className="sw-publish-note-optional">(optional)</span>
            </label>
            <input
              id="publish-note"
              className="sw-publish-note-input"
              type="text"
              placeholder="e.g. Approved for load testing"
              value={note}
              onChange={e => setNote(e.target.value)}
              data-testid="publish-note-input"
              autoFocus
            />
          </div>

          {hasValues && (
            <label className="sw-publish-include-values">
              <input
                type="checkbox"
                checked={includeValues}
                onChange={e => setIncludeValues(e.target.checked)}
                data-testid="publish-include-values"
              />
              <span>Include current parameter values as defaults</span>
            </label>
          )}
        </div>

        <div className="sw-unpublish-footer">
          <button
            type="button"
            className="sw-unpublish-btn sw-unpublish-btn--secondary"
            onClick={onCancel}
            data-testid="publish-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="sw-unpublish-btn sw-publish-confirm-btn"
            onClick={handleConfirm}
            data-testid="publish-confirm-btn"
          >
            Publish Endpoint
          </button>
        </div>
      </div>
    </div>
  );
}

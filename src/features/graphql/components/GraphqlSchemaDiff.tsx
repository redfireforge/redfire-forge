/**
 * GraphqlSchemaDiff.tsx — Phase 3D (tasks 3D-4 + 3D-9)
 *
 * Schema diff modal:
 *  - Summary header: Breaking / Dangerous / Safe / Deprecated counts
 *  - Severity filter tabs
 *  - Change list with per-change "Acknowledge" button (BREAKING changes only)
 *  - Export diff as JSON
 *  - Export diff as HTML report (self-contained, downloadable)
 *  - Download current SDL
 *  - Optional: snapshot vs. snapshot comparison (hides Acknowledge when both historical)
 */

import { useCallback, useMemo, useState } from 'react';
import ModalResizeHandles from '../../../shared/components/ModalResizeHandles';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import { useModalResize } from '../../../shared/hooks/useModalResize';
import type { GraphqlSchemaDiffChange, GraphqlSchemaDiffResult } from '../../../shared/types/graphql';
import { saveFile, saveJsonFile } from '../../../shared/utils/fileSaver';
import { generateHtmlReport } from '../utils/graphqlSchemaDiffReport';
import { AcknowledgedSection, ChangeRow } from './GraphqlSchemaDiffChangeRows';
import { SdlDiffView } from './GraphqlSchemaDiffSdlView';

export type DiffSeverityFilter = 'all' | 'breaking' | 'dangerous' | 'safe' | 'deprecated';

export interface GraphqlSchemaDiffProps {
  /** Result from computeSchemaDiff() */
  result: GraphqlSchemaDiffResult;
  /** SDL of the baseline (snapshot or previous version) */
  oldSdl: string;
  /** SDL of the new version (usually current schema) */
  newSdl: string;
  /** Label for the old side — e.g. "v2.2 snapshot" */
  oldLabel: string;
  /** Label for the new side — e.g. "Current schema" */
  newLabel: string;
  /**
   * When truthy, BREAKING changes show the "Acknowledge" button.
   * Pass undefined/false for snapshot-vs-snapshot comparisons (read-only historical audits).
   */
  snapshotId?: string;
  /**
   * Number of collection operations that fail validation against the new schema (3D-6).
   * When > 0, a warning banner is shown at the top of the change list.
   */
  brokenItemCount?: number;
  onAcknowledge?: (changePath: string, note: string) => void;
  onUnacknowledge?: (changePath: string) => void;
  onClose: () => void;
}

const SEVERITY_LABELS: Record<DiffSeverityFilter, string> = {
  all: 'All',
  breaking: 'Breaking',
  dangerous: 'Dangerous',
  safe: 'Safe',
  deprecated: 'Deprecated',
};

export function GraphqlSchemaDiff({
  result,
  oldSdl,
  newSdl,
  oldLabel,
  newLabel,
  snapshotId,
  brokenItemCount = 0,
  onAcknowledge,
  onUnacknowledge,
  onClose,
}: GraphqlSchemaDiffProps) {
  const [filter, setFilter]               = useState<DiffSeverityFilter>('all');
  const [ackNotes, setAckNotes]           = useState<Record<string, string>>({});
  const [expandedAck, setExpandedAck]     = useState<string | null>(null);
  const [sdlView, setSdlView]             = useState<'changes' | 'sdl'>('changes');
  const { onDragStart, isDragged, overlayStyle, modalStyle } = useModalDrag(true);
  const { resizeStyle, onRightEdge, onCorner, onBottomEdge } = useModalResize(680, 420);

  useModalEscapeClose(onClose, { capture: true });

  const filteredChanges = useMemo(() => {
    if (filter === 'all') return result.changes;
    const criticalityMap: Partial<Record<DiffSeverityFilter, GraphqlSchemaDiffChange['criticality']>> = {
      breaking: 'BREAKING',
      dangerous: 'DANGEROUS',
      safe: 'SAFE',
      deprecated: 'DEPRECATED',
    };
    const target = criticalityMap[filter];
    return target ? result.changes.filter((c) => c.criticality === target) : result.changes;
  }, [result.changes, filter]);

  // Separate acknowledged / unacknowledged for display
  const unacked = filteredChanges.filter((c) => !c.acknowledged);
  const acked   = filteredChanges.filter((c) => c.acknowledged);

  const handleAckSubmit = useCallback((path: string) => {
    const note = ackNotes[path] ?? '';
    onAcknowledge?.(path, note);
    setExpandedAck(null);
    setAckNotes((prev) => { const n = { ...prev }; delete n[path]; return n; });
  }, [ackNotes, onAcknowledge]);

  const handleExportJson = useCallback(() => {
    void saveJsonFile({ oldLabel, newLabel, ...result }, `schema-diff-${Date.now()}.json`);
  }, [result, oldLabel, newLabel]);

  const handleExportHtml = useCallback(() => {
    const html = generateHtmlReport(result, oldLabel, newLabel);
    void saveFile(new Blob([html], { type: 'text/html' }), {
      filename: `schema-diff-${Date.now()}.html`,
      mimeType: 'text/html',
      description: 'HTML report',
    });
  }, [result, oldLabel, newLabel]);

  const handleDownloadSdl = useCallback(() => {
    void saveFile(new Blob([newSdl], { type: 'text/plain' }), {
      filename: `schema-${Date.now()}.graphql`,
      mimeType: 'text/plain',
      description: 'GraphQL SDL',
    });
  }, [newSdl]);

  return (
    <div
      className={`gql-diff-backdrop${isDragged ? ' gql-diff-backdrop--dragged' : ''}`}
      style={overlayStyle}
      data-testid="gql-diff-backdrop"
    >
      <div
        className={[
          'gql-diff-modal',
          sdlView === 'sdl' ? 'gql-diff-modal--wide' : '',
          isDragged ? 'gql-diff-modal--dragged' : '',
        ].filter(Boolean).join(' ')}
        style={{ ...modalStyle, ...resizeStyle }}
        role="dialog"
        aria-modal="true"
        aria-label={`Schema diff: ${oldLabel} → ${newLabel}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="gql-diff-modal"
      >
        {/* Header — drag handle */}
        <div
          className="gql-diff-header gql-diff-header--draggable"
          onMouseDown={onDragStart}
          data-testid="gql-diff-header"
        >
          <span className="gql-diff-drag-grip" aria-hidden="true" title="Drag to move">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" />
              <circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" />
              <circle cx="2" cy="14" r="1.2" /><circle cx="8" cy="14" r="1.2" />
            </svg>
          </span>
          <div className="gql-diff-header-main">
            <div className="gql-diff-title-row">
              <span className="gql-diff-title">Schema Diff</span>
              <div className="gql-diff-compare" aria-label={`Comparing ${oldLabel} to ${newLabel}`}>
                <span className="gql-diff-compare-chip gql-diff-compare-chip--old">{oldLabel}</span>
                <span className="gql-diff-compare-arrow" aria-hidden="true">→</span>
                <span className="gql-diff-compare-chip gql-diff-compare-chip--new">{newLabel}</span>
              </div>
            </div>
            <span className="gql-diff-drag-hint">Drag header to reposition</span>
          </div>
          {/* Summary counts */}
          <div className="gql-diff-summary">
            {result.breakingCount > 0 && (
              <span className="gql-diff-count gql-diff-count--breaking">
                {result.breakingCount} Breaking
              </span>
            )}
            {result.dangerousCount > 0 && (
              <span className="gql-diff-count gql-diff-count--dangerous">
                {result.dangerousCount} Dangerous
              </span>
            )}
            {result.safeCount > 0 && (
              <span className="gql-diff-count gql-diff-count--safe">
                {result.safeCount} Safe
              </span>
            )}
            {result.deprecatedCount > 0 && (
              <span className="gql-diff-count gql-diff-count--deprecated">
                {result.deprecatedCount} Deprecated
              </span>
            )}
            {result.changes.length === 0 && (
              <span className="gql-diff-count gql-diff-count--nochange">No changes</span>
            )}
            {result.changes.length > 0 && (
              <span className="gql-diff-count gql-diff-count--total">
                {result.changes.length} total
              </span>
            )}
          </div>
        </div>

        {/* View toggle + filters */}
        <div className="gql-diff-toolbar">
          <div className="gql-diff-view-toggle">
            <button
              type="button"
              className={`gql-diff-view-btn${sdlView === 'changes' ? ' gql-diff-view-btn--active' : ''}`}
              onClick={() => setSdlView('changes')}
            >
              Changes
            </button>
            <button
              type="button"
              className={`gql-diff-view-btn${sdlView === 'sdl' ? ' gql-diff-view-btn--active' : ''}`}
              onClick={() => setSdlView('sdl')}
            >
              SDL Diff
            </button>
          </div>
          {sdlView === 'changes' && (
            <div className="gql-diff-filters" role="tablist" aria-label="Filter changes by severity">
              {(Object.keys(SEVERITY_LABELS) as DiffSeverityFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  className={`gql-diff-filter${filter === f ? ' gql-diff-filter--active' : ''} gql-diff-filter--${f}`}
                  onClick={() => setFilter(f)}
                >
                  {SEVERITY_LABELS[f]}
                  {f !== 'all' && (
                    <span className="gql-diff-filter-count">
                      {f === 'breaking' ? result.breakingCount :
                       f === 'dangerous' ? result.dangerousCount :
                       f === 'safe' ? result.safeCount : result.deprecatedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className={`gql-diff-content${sdlView === 'sdl' ? ' gql-diff-content--sdl' : ''}`}>
          {/* 3D-6: Broken operations banner — shown when schema changes broke collection items */}
          {brokenItemCount > 0 && sdlView === 'changes' && (
            <div className="gql-diff-broken-banner" role="alert" data-testid="gql-diff-broken-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>
                {brokenItemCount} collection {brokenItemCount === 1 ? 'operation' : 'operations'} no longer validate against this schema.
                Check the collection tree for items marked with ⚠.
              </span>
            </div>
          )}
          {sdlView === 'sdl' ? (
            <SdlDiffView oldSdl={oldSdl} newSdl={newSdl} oldLabel={oldLabel} newLabel={newLabel} />
          ) : (
            <>
              {filteredChanges.length === 0 && (
                <div className="gql-diff-empty" data-testid="gql-diff-empty">
                  <div className="gql-diff-empty-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                    </svg>
                  </div>
                  <p className="gql-diff-empty-title">
                    {result.changes.length === 0 ? 'Schemas match' : 'No matching changes'}
                  </p>
                  <p className="gql-diff-empty-hint">
                    {result.changes.length === 0
                      ? 'The baseline and current SDL are identical. Switch to SDL Diff for a line-by-line view.'
                      : 'Try a different severity filter or view all changes.'}
                  </p>
                </div>
              )}

              {/* Unacknowledged changes */}
              {unacked.map((change) => (
                <ChangeRow
                  key={change.criticality + ':' + change.path}
                  change={change}
                  canAcknowledge={!!snapshotId && change.criticality === 'BREAKING'}
                  isAckExpanded={expandedAck === change.path}
                  ackNote={ackNotes[change.path] ?? ''}
                  onToggleAck={() => setExpandedAck((p) => p === change.path ? null : change.path)}
                  onAckNoteChange={(note) => setAckNotes((p) => ({ ...p, [change.path]: note }))}
                  onAckSubmit={() => handleAckSubmit(change.path)}
                  onUnacknowledge={undefined}
                />
              ))}

              {/* Acknowledged changes (collapsible group) */}
              {acked.length > 0 && (
                <AcknowledgedSection
                  changes={acked}
                  onUnacknowledge={snapshotId ? (path) => onUnacknowledge?.(path) : undefined}
                />
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="gql-diff-footer">
          <button
            type="button"
            className="gql-diff-action-btn"
            onClick={handleExportJson}
            title="Export diff as JSON"
            data-testid="gql-diff-export-json"
          >
            Export JSON
          </button>
          <button
            type="button"
            className="gql-diff-action-btn"
            onClick={handleExportHtml}
            title="Export diff as self-contained HTML report"
            data-testid="gql-diff-export-html"
          >
            Export HTML
          </button>
          <button
            type="button"
            className="gql-diff-action-btn"
            onClick={handleDownloadSdl}
            title="Download current schema SDL"
            data-testid="gql-diff-download-sdl"
          >
            Download SDL
          </button>
          <div className="gql-diff-footer-spacer" />
          <button
            type="button"
            className="gql-diff-action-btn gql-diff-action-btn--primary"
            onClick={onClose}
            data-testid="gql-diff-done"
          >
            Done
          </button>
        </div>
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} onBottomEdge={onBottomEdge} />
      </div>
    </div>
  );
}

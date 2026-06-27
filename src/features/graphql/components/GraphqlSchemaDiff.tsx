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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchMatchBar } from '../../../shared/components/SearchMatchBar';
import ModalResizeHandles from '../../../shared/components/ModalResizeHandles';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import { useModalResize } from '../../../shared/hooks/useModalResize';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';
import type { GraphqlSchemaDiffChange, GraphqlSchemaDiffResult } from '../../../shared/types/graphql';
import { saveFile, saveJsonFile } from '../../../shared/utils/fileSaver';
import {
  annotateSplitDiffHunks,
  buildSplitDiffRows,
  canonicalizeSdlForDiff,
  computeInlineDiffSpans,
  computeLineDiff,
  summarizeSplitDiffRows,
  type AnnotatedSdlSplitDiffRow,
  type HunkSegmentRole,
  type InlineDiffSpan,
  type SdlSplitRowKind,
} from '../utils/sdlLineDiff';
import { tokenizeSDL } from '../utils/sdlTokenizer';

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

const SEVERITY_CSS: Record<GraphqlSchemaDiffChange['criticality'], string> = {
  BREAKING:   'gql-diff-badge--breaking',
  DANGEROUS:  'gql-diff-badge--dangerous',
  SAFE:       'gql-diff-badge--safe',
  DEPRECATED: 'gql-diff-badge--deprecated',
};

const SEVERITY_LABEL: Record<GraphqlSchemaDiffChange['criticality'], string> = {
  BREAKING:   'Breaking',
  DANGEROUS:  'Dangerous',
  SAFE:       'Safe',
  DEPRECATED: 'Deprecated',
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

// ─── ChangeRow ─────────────────────────────────────────────────────────────────

interface ChangeRowProps {
  change: GraphqlSchemaDiffChange;
  canAcknowledge: boolean;
  isAckExpanded: boolean;
  ackNote: string;
  onToggleAck: () => void;
  onAckNoteChange: (note: string) => void;
  onAckSubmit: () => void;
  onUnacknowledge?: () => void;
}

function ChangeRow({
  change, canAcknowledge, isAckExpanded, ackNote,
  onToggleAck, onAckNoteChange, onAckSubmit, onUnacknowledge,
}: ChangeRowProps) {
  return (
    <div
      className={`gql-diff-row${change.acknowledged ? ' gql-diff-row--acked' : ''}`}
      data-testid="gql-diff-row"
    >
      <div className="gql-diff-row-main">
        <span className={`gql-diff-badge ${SEVERITY_CSS[change.criticality]}`}>
          {SEVERITY_LABEL[change.criticality]}
        </span>
        <span className="gql-diff-row-path" title={change.path}>{change.path}</span>
        <span className="gql-diff-row-desc">{change.description}</span>
        {canAcknowledge && !change.acknowledged && (
          <button
            type="button"
            className="gql-diff-ack-btn"
            onClick={onToggleAck}
            title="Mark as intentional (acknowledge this breaking change)"
            data-testid="gql-diff-ack-btn"
          >
            {isAckExpanded ? 'Cancel' : 'Acknowledge'}
          </button>
        )}
        {change.acknowledged && onUnacknowledge && (
          <button
            type="button"
            className="gql-diff-unack-btn"
            onClick={onUnacknowledge}
            title="Remove acknowledgement"
            data-testid="gql-diff-unack-btn"
          >
            ✓ Undo
          </button>
        )}
      </div>
      {isAckExpanded && (
        <div className="gql-diff-ack-form">
          <input
            type="text"
            className="gql-diff-ack-note"
            placeholder="Optional note: why is this change intentional?"
            value={ackNote}
            onChange={(e) => onAckNoteChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onAckSubmit(); }}
            autoFocus
            data-testid="gql-diff-ack-note"
          />
          <button
            type="button"
            className="gql-diff-ack-confirm"
            onClick={onAckSubmit}
            data-testid="gql-diff-ack-confirm"
          >
            Confirm
          </button>
        </div>
      )}
      {change.acknowledged && change.acknowledgeNote && (
        <div className="gql-diff-ack-note-display">
          Note: {change.acknowledgeNote}
        </div>
      )}
    </div>
  );
}

// ─── AcknowledgedSection ───────────────────────────────────────────────────────

function AcknowledgedSection({
  changes,
  onUnacknowledge,
}: {
  changes: GraphqlSchemaDiffChange[];
  onUnacknowledge?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="gql-diff-acked-section" data-testid="gql-diff-acked-section">
      <button
        type="button"
        className="gql-diff-acked-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? '▼' : '▶'} Acknowledged ({changes.length})
      </button>
      {expanded && changes.map((change) => (
        <ChangeRow
          key={change.criticality + ':' + change.path}
          change={change}
          canAcknowledge={false}
          isAckExpanded={false}
          ackNote=""
          onToggleAck={() => {}}
          onAckNoteChange={() => {}}
          onAckSubmit={() => {}}
          onUnacknowledge={onUnacknowledge ? () => onUnacknowledge(change.path) : undefined}
        />
      ))}
    </div>
  );
}

// ─── SdlDiffView ──────────────────────────────────────────────────────────────

function SdlHighlightedLine({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeSDL(text), [text]);
  return (
    <span className="gql-diff-sdl-text">
      {tokens.map((tok, j) => (
        tok.cls
          ? <span key={j} className={tok.cls}>{tok.text}</span>
          : <span key={j}>{tok.text}</span>
      ))}
    </span>
  );
}

function SdlInlineDiffLine({ spans }: { spans: InlineDiffSpan[] }) {
  return (
    <span className="gql-diff-sdl-text">
      {spans.map((span, j) => (
        span.kind === 'same'
          ? <span key={j}>{span.text}</span>
          : (
            <span
              key={j}
              className={span.kind === 'delete' ? 'gql-diff-sdl-inline-del' : 'gql-diff-sdl-inline-ins'}
            >
              {span.text}
            </span>
          )
      ))}
    </span>
  );
}

function SdlDiffLineContent({
  text,
  kind,
  side,
  pairText,
}: {
  text: string;
  kind: SdlSplitRowKind;
  side: 'left' | 'right';
  pairText?: string;
}) {
  const inlineSpans = useMemo(() => {
    if (kind !== 'modified' || pairText == null || pairText === text) return null;
    const left = side === 'left' ? text : pairText;
    const right = side === 'right' ? text : pairText;
    return computeInlineDiffSpans(left, right)[side];
  }, [text, pairText, kind, side]);

  if (inlineSpans) {
    return <SdlInlineDiffLine spans={inlineSpans} />;
  }
  return <SdlHighlightedLine text={text} />;
}

function SdlDiffConnectorGutter({
  kind,
  hunkRole,
}: {
  kind: SdlSplitRowKind;
  hunkRole: HunkSegmentRole;
}) {
  if (kind === 'unchanged') {
    return (
      <div
        className="gql-diff-sdl-connector gql-diff-sdl-connector--unchanged gql-diff-sdl-connector--slot-mid"
        aria-hidden="true"
        data-testid="gql-diff-sdl-connector"
      />
    );
  }

  const label = kind === 'modified' ? 'Updated line' : kind === 'removed' ? 'Deleted line' : 'Added line';
  const arrow = kind === 'modified' ? '↔' : kind === 'removed' ? '»' : '«';

  return (
    <div
      className={`gql-diff-sdl-connector gql-diff-sdl-connector--${kind} gql-diff-sdl-connector--${hunkRole} gql-diff-sdl-connector--slot-mid`}
      aria-label={label}
      title={label}
      data-testid="gql-diff-sdl-connector"
    >
      <svg className="gql-diff-sdl-connector-svg" viewBox="0 0 40 24" preserveAspectRatio="none" aria-hidden="true">
        {kind === 'removed' && (
          <polygon className="gql-diff-sdl-connector-shape gql-diff-sdl-connector-shape--removed" points="0,12 40,2 40,22" />
        )}
        {kind === 'added' && (
          <polygon className="gql-diff-sdl-connector-shape gql-diff-sdl-connector-shape--added" points="0,2 0,22 40,12" />
        )}
        {kind === 'modified' && (
          <polygon className="gql-diff-sdl-connector-shape gql-diff-sdl-connector-shape--modified" points="0,10 40,10 40,14 0,14" />
        )}
      </svg>
      <span className="gql-diff-sdl-connector-arrow" aria-hidden="true">{arrow}</span>
    </div>
  );
}

function SdlDiffPanePlaceholder({ side }: { side: 'left' | 'right' }) {
  return (
    <>
      <span className="gql-diff-sdl-ln gql-diff-sdl-ln--empty" aria-hidden="true" />
      <span
        className={`gql-diff-sdl-placeholder-cell gql-diff-sdl-placeholder-cell--${side}`}
        aria-hidden="true"
      />
    </>
  );
}

function SdlSplitDiffRowView({ row }: { row: AnnotatedSdlSplitDiffRow }) {
  const showLeft = row.leftText != null;
  const showRight = row.rightText != null;

  return (
    <div className={`gql-diff-sdl-row gql-diff-sdl-row--${row.kind}`} data-testid="gql-diff-sdl-row">
      <div className={`gql-diff-sdl-pane gql-diff-sdl-pane--left gql-diff-sdl-pane--slot-left${showLeft ? '' : ' gql-diff-sdl-pane--placeholder-side'}`}>
        {showLeft ? (
          <>
            <span className="gql-diff-sdl-ln" aria-hidden="true">{row.leftLineNum ?? ''}</span>
            <SdlDiffLineContent
              text={row.leftText!}
              kind={row.kind}
              side="left"
              pairText={row.rightText}
            />
          </>
        ) : (
          <SdlDiffPanePlaceholder side="left" />
        )}
      </div>
      <SdlDiffConnectorGutter kind={row.kind} hunkRole={row.hunkRole} />
      <div className={`gql-diff-sdl-pane gql-diff-sdl-pane--right gql-diff-sdl-pane--slot-right${showRight ? '' : ' gql-diff-sdl-pane--placeholder-side'}`}>
        {showRight ? (
          <>
            <span className="gql-diff-sdl-ln" aria-hidden="true">{row.rightLineNum ?? ''}</span>
            <SdlDiffLineContent
              text={row.rightText!}
              kind={row.kind}
              side="right"
              pairText={row.leftText}
            />
          </>
        ) : (
          <SdlDiffPanePlaceholder side="right" />
        )}
      </div>
    </div>
  );
}

function SdlDiffView({
  oldSdl,
  newSdl,
  oldLabel,
  newLabel,
}: {
  oldSdl: string;
  newSdl: string;
  oldLabel: string;
  newLabel: string;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [hideUnchanged, setHideUnchanged] = useState(false);

  const canonicalSdl = useMemo(() => ({
    old: canonicalizeSdlForDiff(oldSdl),
    new: canonicalizeSdlForDiff(newSdl),
  }), [oldSdl, newSdl]);

  const splitRows = useMemo(
    () => annotateSplitDiffHunks(buildSplitDiffRows(computeLineDiff(canonicalSdl.old, canonicalSdl.new))),
    [canonicalSdl],
  );

  const stats = useMemo(() => summarizeSplitDiffRows(splitRows), [splitRows]);

  const displayRows = useMemo(
    () => (hideUnchanged ? splitRows.filter((r) => r.kind !== 'unchanged') : splitRows),
    [splitRows, hideUnchanged],
  );

  const [searchQuery, setSearchQuery] = useState('');

  const matchingRowIndices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return displayRows.reduce<number[]>((acc, row, i) => {
      const left = row.leftText?.toLowerCase().includes(q);
      const right = row.rightText?.toLowerCase().includes(q);
      if (left || right) acc.push(i);
      return acc;
    }, []);
  }, [displayRows, searchQuery]);

  const matchCount = matchingRowIndices.length;

  const {
    currentMatchIndex,
    setCurrentMatchIndex,
    goNext,
    goPrev,
    clear: clearNav,
  } = useSearchMatchNavigation(matchCount);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
  }, [setCurrentMatchIndex]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    clearNav();
  }, [clearNav]);

  const activeRowIndex = matchCount > 0 ? matchingRowIndices[currentMatchIndex] : -1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (activeRowIndex < 0) return;
    rowRefs.current.get(activeRowIndex)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeRowIndex]);

  const hasEdits = stats.removed > 0 || stats.added > 0 || stats.modified > 0;

  return (
    <div className="gql-diff-sdl-view" data-testid="gql-diff-sdl-view">
      <div className="gql-diff-sdl-toolbar">
        <div className="gql-diff-sdl-stats">
          <span className="gql-diff-sdl-stat gql-diff-sdl-stat--removed">
            − {stats.removed} removed
          </span>
          {stats.modified > 0 && (
            <span className="gql-diff-sdl-stat gql-diff-sdl-stat--modified">
              ↔ {stats.modified} modified
            </span>
          )}
          <span className="gql-diff-sdl-stat gql-diff-sdl-stat--added">
            + {stats.added} added
          </span>
          <span className="gql-diff-sdl-stat gql-diff-sdl-stat--unchanged">
            {stats.unchanged} unchanged
          </span>
        </div>
        <label className="gql-diff-sdl-toggle">
          <input
            type="checkbox"
            checked={hideUnchanged}
            onChange={(e) => setHideUnchanged(e.target.checked)}
            data-testid="gql-diff-sdl-hide-unchanged"
          />
          <span>Changes only</span>
        </label>
      </div>

      <div className="gql-diff-sdl-search-bar">
        <SearchMatchBar
          value={searchQuery}
          onChange={handleSearchChange}
          currentMatch={matchCount > 0 ? currentMatchIndex + 1 : 0}
          totalMatches={matchCount}
          onPrev={goPrev}
          onNext={goNext}
          onClear={clearSearch}
          inputRef={searchInputRef}
          placeholder="Search SDL… (Cmd+F)"
          className="gql-diff-sdl-search-inner"
          inputClassName="gql-diff-sdl-search-input"
          countClassName="gql-diff-sdl-search-count"
          navClassName="gql-diff-sdl-search-nav"
          clearClassName="gql-diff-sdl-search-clear"
          navStyle="text"
          ariaLabel="Search SDL diff"
          prevTitle="Previous match (Shift+Enter)"
          nextTitle="Next match (Enter)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matchCount > 0) {
              e.preventDefault();
              if (e.shiftKey) goPrev();
              else goNext();
            }
          }}
        />
      </div>

      <div className="gql-diff-sdl-header gql-diff-sdl-header--split">
        <div className="gql-diff-sdl-pane-head gql-diff-sdl-pane-head--left">
          <span className="gql-diff-sdl-gutter-label" aria-hidden="true">#</span>
          <span className="gql-diff-sdl-col-label gql-diff-sdl-col-label--left">{oldLabel}</span>
        </div>
        <div className="gql-diff-sdl-connector-head" aria-hidden="true" title="Change linkage">
          <span className="gql-diff-sdl-connector-head-icon">↔</span>
        </div>
        <div className="gql-diff-sdl-pane-head gql-diff-sdl-pane-head--right">
          <span className="gql-diff-sdl-gutter-label" aria-hidden="true">#</span>
          <span className="gql-diff-sdl-col-label gql-diff-sdl-col-label--right">{newLabel}</span>
        </div>
      </div>

      <div className="gql-diff-sdl-body gql-diff-sdl-body--split">
        {!hasEdits && (
          <div className="gql-diff-sdl-no-edits" data-testid="gql-diff-sdl-no-edits">
            <span className="gql-diff-sdl-no-edits-icon" aria-hidden="true">✓</span>
            <span>No SDL differences — every line matches between versions.</span>
          </div>
        )}

        {displayRows.length === 0 && hasEdits && hideUnchanged && (
          <div className="gql-diff-sdl-no-edits">
            <span>All visible lines are unchanged. Uncheck &ldquo;Changes only&rdquo; to see full SDL.</span>
          </div>
        )}

        {displayRows.map((row, i) => (
          <div
            key={`${row.kind}:${i}:${row.leftLineNum ?? ''}:${row.rightLineNum ?? ''}:${row.leftText ?? ''}:${row.rightText ?? ''}`}
            ref={(el) => {
              if (el) rowRefs.current.set(i, el);
              else rowRefs.current.delete(i);
            }}
            className={i === activeRowIndex ? 'gql-diff-sdl-row-wrap gql-diff-sdl-row-wrap--search-active' : 'gql-diff-sdl-row-wrap'}
          >
            <SdlSplitDiffRowView row={row} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/** Generate a self-contained HTML diff report (3D-9) */
function generateHtmlReport(
  result: GraphqlSchemaDiffResult,
  oldLabel: string,
  newLabel: string,
): string {
  const rows = result.changes.map((c) => {
    const color = c.criticality === 'BREAKING'   ? '#f87171'
                : c.criticality === 'DANGEROUS'  ? '#fb923c'
                : c.criticality === 'DEPRECATED' ? '#facc15'
                : '#4ade80';
    const ackNote = c.acknowledged
      ? `<br><small style="color:#94a3b8">✓ Acknowledged${c.acknowledgeNote ? ': ' + escapeHtml(c.acknowledgeNote) : ''}</small>`
      : '';
    return `
      <tr>
        <td><span style="background:${color};color:#0f172a;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:700">${c.criticality}</span></td>
        <td style="font-family:monospace;font-size:13px">${escapeHtml(c.path)}</td>
        <td>${escapeHtml(c.description)}${ackNote}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Schema Diff: ${escapeHtml(oldLabel)} → ${escapeHtml(newLabel)}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9;margin:0;padding:24px}
    h1{font-size:1.4rem;margin:0 0 4px}
    .subtitle{color:#94a3b8;font-size:0.85rem;margin-bottom:20px}
    .summary{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
    .pill{padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600}
    .breaking{background:#7f1d1d;color:#fca5a5}
    .dangerous{background:#7c2d12;color:#fdba74}
    .safe{background:#14532d;color:#86efac}
    .deprecated{background:#713f12;color:#fde68a}
    table{width:100%;border-collapse:collapse}
    th{background:#1e293b;padding:8px 12px;text-align:left;font-size:0.78rem;color:#94a3b8;font-weight:500}
    td{padding:8px 12px;border-bottom:1px solid #1e293b;font-size:0.82rem;vertical-align:top}
    tr:hover td{background:#1e293b}
    .gen{color:#475569;font-size:0.72rem;margin-top:20px}
  </style>
</head>
<body>
  <h1>Schema Diff Report</h1>
  <div class="subtitle">${escapeHtml(oldLabel)} → ${escapeHtml(newLabel)}</div>
  <div class="summary">
    ${result.breakingCount  > 0 ? `<span class="pill breaking">${result.breakingCount} Breaking</span>`   : ''}
    ${result.dangerousCount > 0 ? `<span class="pill dangerous">${result.dangerousCount} Dangerous</span>` : ''}
    ${result.safeCount      > 0 ? `<span class="pill safe">${result.safeCount} Safe</span>`               : ''}
    ${result.deprecatedCount> 0 ? `<span class="pill deprecated">${result.deprecatedCount} Deprecated</span>` : ''}
    ${result.changes.length === 0 ? '<span style="color:#94a3b8">No changes</span>' : ''}
  </div>
  <table>
    <thead><tr><th>Severity</th><th>Path</th><th>Description</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="gen">Generated by RedfireForge — ${new Date().toISOString()}</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

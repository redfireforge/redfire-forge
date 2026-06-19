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
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import type { GraphqlSchemaDiffChange, GraphqlSchemaDiffResult } from '../../../shared/types/graphql';

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
    const json = JSON.stringify({ oldLabel, newLabel, ...result }, null, 2);
    downloadBlob(json, 'application/json', `schema-diff-${Date.now()}.json`);
  }, [result, oldLabel, newLabel]);

  const handleExportHtml = useCallback(() => {
    const html = generateHtmlReport(result, oldLabel, newLabel);
    downloadBlob(html, 'text/html', `schema-diff-${Date.now()}.html`);
  }, [result, oldLabel, newLabel]);

  const handleDownloadSdl = useCallback(() => {
    downloadBlob(newSdl, 'text/plain', `schema-${Date.now()}.graphql`);
  }, [newSdl]);

  return (
    <div className="gql-diff-backdrop" onClick={onClose} data-testid="gql-diff-backdrop">
      <div
        className="gql-diff-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Schema diff: ${oldLabel} → ${newLabel}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="gql-diff-modal"
      >
        {/* Header */}
        <div className="gql-diff-header">
          <div className="gql-diff-title-row">
            <span className="gql-diff-title">Schema Diff</span>
            <span className="gql-diff-subtitle">{oldLabel} → {newLabel}</span>
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
        <div className="gql-diff-content">
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
            <SdlDiffView oldSdl={oldSdl} newSdl={newSdl} />
          ) : (
            <>
              {filteredChanges.length === 0 && (
                <div className="gql-diff-empty">
                  {result.changes.length === 0
                    ? 'No changes between the two schema versions.'
                    : 'No changes matching the selected filter.'}
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

function SdlDiffView({ oldSdl, newSdl }: { oldSdl: string; newSdl: string }) {
  const diffLines = useMemo(() => computeLineDiff(oldSdl, newSdl), [oldSdl, newSdl]);
  return (
    <div className="gql-diff-sdl-view" data-testid="gql-diff-sdl-view">
      <div className="gql-diff-sdl-header">
        <span className="gql-diff-sdl-col-label gql-diff-sdl-col-label--removed">− Removed</span>
        <span className="gql-diff-sdl-col-label gql-diff-sdl-col-label--added">+ Added</span>
        <span className="gql-diff-sdl-col-label gql-diff-sdl-col-label--unchanged">Unchanged</span>
      </div>
      <div className="gql-diff-sdl-body">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={`gql-diff-sdl-line gql-diff-sdl-line--${line.type}`}
          >
            <span className="gql-diff-sdl-marker">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
            </span>
            <span className="gql-diff-sdl-text">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function downloadBlob(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  // Must be attached to the DOM for Firefox; revoke after a tick so the browser
  // has time to start the download before the object URL is invalidated.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 150);
}

type DiffLineType = 'added' | 'removed' | 'unchanged';
interface DiffLine { type: DiffLineType; text: string }

/**
 * Line-level diff using Myers' O(ND) LCS algorithm.
 * Produces a proper interleaved diff (removed/added lines in context).
 */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const n = a.length;
  const m = b.length;

  // Myers' diff: find the LCS edit script
  const max = n + m;
  const v = new Array<number>(2 * max + 1).fill(0);
  const trace: number[][] = [];

  let found = false;
  outer: for (let d = 0; d <= max; d++) {
    trace.push([...v]);
    for (let k = -d; k <= d; k += 2) {
      const idx = k + max;
      let x: number;
      if (k === -d || (k !== d && v[idx - 1] < v[idx + 1])) {
        x = v[idx + 1];
      } else {
        x = v[idx - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[idx] = x;
      if (x >= n && y >= m) { found = true; break outer; }
    }
  }
  /* c8 ignore next 7 -- Myers always terminates within n+m steps; defensive fallback only */
  if (!found) {
    return [
      ...a.map((text) => ({ type: 'removed' as DiffLineType, text })),
      ...b.map((text) => ({ type: 'added' as DiffLineType, text })),
    ];
  }

  // Back-track through trace to build the edit script
  const edits: DiffLine[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d];
    const k = x - y;
    const idx = k + max;
    let prevK: number;
    if (k === -d || (k !== d && vd[idx - 1] < vd[idx + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vd[prevK + max];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      edits.unshift({ type: 'unchanged', text: a[x - 1] });
      x--; y--;
    }
    if (d > 0) {
      if (x === prevX) {
        edits.unshift({ type: 'added', text: b[y - 1] });
        y--;
      } else {
        edits.unshift({ type: 'removed', text: a[x - 1] });
        x--;
      }
    }
  }

  return edits;
}

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

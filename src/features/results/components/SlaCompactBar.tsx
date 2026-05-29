/**
 * SlaCompactBar — compact one-line SLA summary bar (Phase C, SLA-C4).
 *
 * Rendered at the top of ResultsDashboard. Shows overall status pill, scope
 * badge, and detail text. Opens an inline SlaTargetEditor when "Edit Targets"
 * is clicked.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import type { TestSummary, RequestResult } from '../../../shared/types';
import {
  evaluateSlaTree,
  extractScenarioNames,
  type SlaTarget,
} from '../utils/slaTargets';
import { SlaTargetEditor } from './SlaTargetEditor';

interface SlaCompactBarProps {
  targets: SlaTarget[];
  results: RequestResult[];
  summary: TestSummary;
  scope: 'run' | 'workflow-def' | null;
  onSaveTargets: (targets: SlaTarget[]) => Promise<void>;
}

export function SlaCompactBar({
  targets,
  results,
  summary,
  scope,
  onSaveTargets,
}: SlaCompactBarProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<SlaTarget[]>([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the 'just saved' timer on unmount to avoid state updates on unmounted component.
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  const scenarioNames = useMemo(() => extractScenarioNames(results), [results]);
  const featureGroupNames = useMemo(
    () => [...new Set(results.filter((r) => r.featureGroupName).map((r) => r.featureGroupName!))],
    [results],
  );

  const tree = useMemo(
    () => evaluateSlaTree(results, summary, targets),
    [results, summary, targets],
  );

  const allChecks = useMemo(
    () => [
      ...tree.aggregateChecks,
      ...tree.featureNodes.flatMap((fn) => [
        ...fn.featureChecks,
        ...fn.scenarios.flatMap((s) => s.checks),
      ]),
    ],
    [tree],
  );

  const overall = tree.overall;
  const failCount = allChecks.filter((c) => c.status === 'fail').length;
  const warnCount = allChecks.filter((c) => c.status === 'warn').length;
  const passCount = allChecks.filter((c) => c.status === 'pass').length;
  const checkCount = allChecks.length;

  const isReadOnly = scope === 'run' || scope === 'workflow-def';

  // Scope label for non-null scopes (shown in both empty and normal states).
  // Note: scope === null → null here (no badge in empty state — no ad-hoc targets exist yet).
  const emptyScopeLabel =
    scope === 'run'          ? '🔒 This Run'
    : scope === 'workflow-def' ? '📋 Workflow'
    : null;

  const openEditor = () => {
    setDraft(targets.map((t) => ({ ...t })));
    setEditorOpen(true);
  };

  /** Opens the editor pre-populated with one default target row (used when targets is empty). */
  const openEditorWithNewTarget = () => {
    const newTarget: SlaTarget = { id: crypto.randomUUID(), metric: 'p95', operator: 'lte', value: 500 };
    setDraft([newTarget]);
    setEditorOpen(true);
  };

  const cancelEditor = () => setEditorOpen(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveTargets(draft);
      setEditorOpen(false);
      // D2 — brief inline save confirmation
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  // ── Empty state (no existing targets, editor closed) ──
  if (targets.length === 0 && !editorOpen) {
    return (
      <div className="sla-compact-bar sla-compact-bar-nodata">
        <span className="sla-compact-label">SLA</span>
        {/* D-R2 fix: show scope badge in empty state for non-null scopes */}
        {emptyScopeLabel !== null && (
          <span className={`sla-scope-badge sla-scope-${scope ?? 'adhoc'}`}>{emptyScopeLabel}</span>
        )}
        <span className="sla-compact-detail">No SLA targets defined</span>
        <div className="sla-compact-actions">
          {/* D-R1 fix: respect isReadOnly — no Add button for run/workflow-def scopes */}
          {isReadOnly ? (
            <span className="sla-compact-readonly">Read-only</span>
          ) : (
            <button className="btn btn-sm" onClick={openEditorWithNewTarget}>
              ＋ Add First Target
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Editor open, no existing targets ── (draft is pre-populated by openEditorWithNewTarget)
  if (targets.length === 0 && editorOpen) {
    return (
      <div className="sla-compact-editor">
        <SlaTargetEditor
          draft={draft}
          onChange={setDraft}
          onSave={handleSave}
          onCancel={cancelEditor}
          saving={saving}
          scenarioNames={scenarioNames}
          featureGroupNames={featureGroupNames}
        />
      </div>
    );
  }

  // ── Status computation ──
  const statusKey = overall === null || overall === 'no-data' ? 'nodata' : overall;

  let pillText: string;
  if (!checkCount || overall === null) {
    pillText = 'No matching data';
  } else if (overall === 'fail') {
    pillText = `⚠ ${failCount} Failing`;
  } else if (overall === 'warn') {
    pillText = `! ${warnCount} Warning${warnCount !== 1 ? 's' : ''}`;
  } else if (overall === 'pass') {
    pillText = `✓ All Passing`;
  } else {
    pillText = 'No data';
  }

  let detailText: string;
  if (!checkCount) {
    detailText = '';
  } else if (overall === 'fail') {
    const parts: string[] = [`${failCount} violation${failCount !== 1 ? 's' : ''}`];
    if (warnCount > 0) parts.push(`${warnCount} warning${warnCount !== 1 ? 's' : ''}`);
    if (passCount > 0) parts.push(`${passCount} passing`);
    detailText = parts.join(' — ');
  } else if (overall === 'warn') {
    const parts: string[] = [`${warnCount} warning${warnCount !== 1 ? 's' : ''}`];
    if (passCount > 0) parts.push(`${passCount} passing`);
    detailText = parts.join(', ');
  } else if (overall === 'pass') {
    detailText = `${checkCount} target${checkCount !== 1 ? 's' : ''} evaluated`;
  } else {
    detailText = '';
  }

  // D3 — scope === null means ad-hoc targets set post-run (not tied to any definition)
  const scopeLabel = emptyScopeLabel ?? '⚗ Ad-hoc';

  return (
    <div className="sla-compact-bar-wrapper">
      <div className={`sla-compact-bar sla-compact-bar-${statusKey}`}>
        <span className="sla-compact-label">SLA</span>
        <span className={`sla-compact-pill sla-compact-pill-${statusKey}`}>{pillText}</span>
        <span className={`sla-scope-badge sla-scope-${scope ?? 'adhoc'}`}>{scopeLabel}</span>
        <span className="sla-compact-detail">{detailText}</span>
        <div className="sla-compact-actions">
          {/* D2 — brief '✓ Saved' flash after a successful save */}
          {justSaved && <span className="sla-compact-saved">✓ Saved</span>}
          {!editorOpen && !isReadOnly && !justSaved && (
            <button className="btn btn-sm sla-edit-btn" onClick={openEditor}>
              Edit Targets
            </button>
          )}
          {isReadOnly && (
            <span className="sla-compact-readonly">Read-only</span>
          )}
        </div>
      </div>
      {editorOpen && (
        <div className="sla-compact-editor">
          <SlaTargetEditor
            draft={draft}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={cancelEditor}
            saving={saving}
            scenarioNames={scenarioNames}
            featureGroupNames={featureGroupNames}
          />
        </div>
      )}
    </div>
  );
}

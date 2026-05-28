/**
 * RunnerSlaOverridePanel — compact SLA trigger bar + full-screen modal.
 *
 * Runner page shows a single-line trigger bar with stats (configured / overrides / new).
 * Clicking "Configure" opens a modal with:
 *   - Configured Targets (read-only, grouped by scope, with per-row Override button)
 *   - Overrides section (cloned rows with locked scope+metric, or new rows with dropdowns)
 *
 * Targets entered here are NOT persisted — they are discarded when the page unmounts.
 */
import { useState, useMemo, useCallback } from 'react';
import type { SlaTarget, SlaMetric } from '../../../shared/types';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  SLA_METRIC_LABELS,
  SLA_METRIC_UNITS,
  SLA_METRIC_DEFAULT_OPERATOR,
} from '../../results/utils/slaTargets';
import { METRIC_OPTIONS, validateRow } from '../../results/components/slaEditorUtils';

// ── Types ──

/** Override row — extends SlaTarget with source tracking. */
interface OverrideRow extends SlaTarget {
  /** 'cloned' = from Override button (locked scope+metric); 'new' = from +Add Target */
  _source: 'cloned' | 'new';
  /** Original fail threshold (for "was X" hint on cloned rows). */
  _originalValue?: number;
  /** Original warn threshold. */
  _originalWarnAt?: number;
}

// Stable empty reference
const EMPTY_TARGETS: SlaTarget[] = [];

/** Conflict key — metric + scope identity. */
function conflictKey(t: SlaTarget): string {
  return `${t.metric}:${t.scenarioName ?? ''}:${t.featureGroupName ?? ''}`;
}

/** Build scope label from target fields. */
function scopeLabel(t: SlaTarget): string {
  if (t.featureGroupName) return `FG: ${t.featureGroupName}`;
  if (t.scenarioName) return `Test: ${t.scenarioName}`;
  return 'Aggregate';
}

/** Group definitions by scope for visual grouping. */
function groupByScope(targets: Array<SlaTarget & { scopeLabel: string }>) {
  const groups: Array<{ scope: string; targets: Array<SlaTarget & { scopeLabel: string }> }> = [];
  const map = new Map<string, Array<SlaTarget & { scopeLabel: string }>>();
  for (const t of targets) {
    const key = t.scopeLabel;
    if (!map.has(key)) {
      const arr: Array<SlaTarget & { scopeLabel: string }> = [];
      map.set(key, arr);
      groups.push({ scope: key, targets: arr });
    }
    map.get(key)!.push(t);
  }
  return groups;
}

// ── Props ──

interface RunnerSlaOverridePanelProps {
  initialTargets?: SlaTarget[];
  onSave: (targets: SlaTarget[]) => void;
  definitionTargetCount: number;
  definitionTargets?: Array<SlaTarget & { scopeLabel: string }>;
  scenarioNames: string[];
  testNames?: string[];
  disabled?: boolean;
}

export default function RunnerSlaOverridePanel({
  initialTargets = EMPTY_TARGETS,
  onSave,
  definitionTargetCount,
  definitionTargets = [],
  scenarioNames,
  testNames = [],
  disabled = false,
}: RunnerSlaOverridePanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<OverrideRow[]>(() => toOverrideRows(initialTargets, definitionTargets));
  const [showDefinitions, setShowDefinitions] = useState(true);

  // Sync draft when initialTargets changes externally
  const [lastInitial, setLastInitial] = useState(initialTargets);
  if (initialTargets !== lastInitial) {
    setLastInitial(initialTargets);
    setDraft(toOverrideRows(initialTargets, definitionTargets));
  }
  // All scope names for dropdowns
  const allScopeNames = useMemo(
    () => [...new Set([...scenarioNames, ...testNames])],
    [scenarioNames, testNames],
  );

  // Keys of currently overridden definitions
  const overriddenKeys = useMemo(
    () => new Set(draft.filter(r => r._source === 'cloned').map(conflictKey)),
    [draft],
  );

  // Count new vs cloned
  const clonedCount = draft.filter(r => r._source === 'cloned').length;
  const newCount = draft.filter(r => r._source === 'new').length;

  // ── Handlers ──

  const handleOverrideClick = useCallback((defTarget: SlaTarget) => {
    const row: OverrideRow = {
      ...defTarget,
      id: crypto.randomUUID(),
      _source: 'cloned',
      _originalValue: defTarget.value,
      _originalWarnAt: defTarget.warnAt,
    };
    setDraft(prev => [...prev, row]);
  }, []);

  const handleAddNew = useCallback(() => {
    const row: OverrideRow = {
      id: crypto.randomUUID(),
      metric: 'p95',
      operator: 'lte',
      value: 500,
      _source: 'new',
    };
    setDraft(prev => [...prev, row]);
  }, []);

  const handleRemoveRow = useCallback((idx: number) => {
    setDraft(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleUpdateRow = useCallback((idx: number, patch: Partial<SlaTarget>) => {
    setDraft(prev =>
      prev.map((t, i) => {
        if (i !== idx) return t;
        const updated = { ...t, ...patch };
        if (patch.metric !== undefined && patch.operator === undefined) {
          updated.operator = SLA_METRIC_DEFAULT_OPERATOR[patch.metric as SlaMetric];
          updated.warnAt = undefined;
        }
        return updated;
      }),
    );
  }, []);

  const handleSave = useCallback(() => {
    // Strip internal fields before passing up
    const clean: SlaTarget[] = draft.map(({ _source, _originalValue, _originalWarnAt, ...rest }) => rest);
    onSave(clean);
    setModalOpen(false);
  }, [draft, onSave]);

  const handleCancel = useCallback(() => {
    setDraft(toOverrideRows(initialTargets, definitionTargets));
    setModalOpen(false);
  }, [initialTargets, definitionTargets]);

  // Validation
  const errors = draft.map(t => validateRow(t));
  const hasErrors = errors.some(e => e.value !== undefined || e.warnAt !== undefined);

  // Group definitions by scope
  const groups = useMemo(() => groupByScope(definitionTargets), [definitionTargets]);

  return (
    <>
      {/* ── Compact trigger bar ── */}
      <div className={`sla-trigger${disabled ? ' sla-trigger--disabled' : ''}`}>
        <div className="sla-trigger-left">
          🎯 SLA Override
          <span className="sla-trigger-badge-opt">optional</span>
        </div>
        <div className="sla-trigger-right">
          <div className="sla-trigger-stats">
            {definitionTargetCount > 0 && (
              <span className="sla-trigger-stat">
                <span className="sla-stat-dot sla-stat-dot-def" /> {definitionTargetCount} configured
              </span>
            )}
            {clonedCount > 0 && (
              <span className="sla-trigger-stat">
                <span className="sla-stat-dot sla-stat-dot-ovr" /> {clonedCount} override{clonedCount !== 1 ? 's' : ''}
              </span>
            )}
            {newCount > 0 && (
              <span className="sla-trigger-stat">
                <span className="sla-stat-dot sla-stat-dot-new" /> {newCount} new
              </span>
            )}
          </div>
          <button
            className="sla-trigger-btn"
            onClick={() => setModalOpen(true)}
            disabled={disabled}
            type="button"
          >
            Configure
          </button>
        </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <AppModalFrame
          title="SLA Override"
          onClose={handleCancel}
          overlayClassName="sla-modal-overlay"
          dialogClassName="sla-override-modal"
          bodyClassName="sla-modal-body"
          footerClassName="sla-modal-footer"
          closeOnOverlayClick={false}
          showResizeHandles={false}
          disableDrag
          footer={
            <>
              <div className="sla-modal-footer-summary">
                {definitionTargetCount > 0 && <span>{definitionTargetCount} configured</span>}
                {clonedCount > 0 && <span className="sla-footer-ovr">{clonedCount} override{clonedCount !== 1 ? 's' : ''}</span>}
                {newCount > 0 && <span className="sla-footer-new">{newCount} new</span>}
              </div>
              <div className="sla-modal-footer-actions">
                <button className="btn btn-sm" onClick={handleCancel} type="button">Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={hasErrors} type="button">
                  Save
                </button>
              </div>
            </>
          }
        >
          <div className="sla-modal-subtitle">
            Configure SLA thresholds for this run. Overrides replace matching configured targets.
          </div>

              {/* ── Configured Targets (read-only) ── */}
              {definitionTargets.length > 0 && (
                <div className="sla-defs-section">
                  <button
                    type="button"
                    className="sla-defs-toggle"
                    onClick={() => setShowDefinitions(v => !v)}
                  >
                    <span>Configured Targets ({definitionTargets.length})</span>
                    <span className="sla-chevron">{showDefinitions ? '▲' : '▼'}</span>
                  </button>
                  {showDefinitions && (
                    <table className="sla-defs-table">
                      <colgroup>
                        <col className="col-scope" />
                        <col className="col-metric" />
                        <col className="col-threshold" />
                        <col className="col-warn" />
                        <col className="col-label" />
                        <col className="col-action" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Scope</th>
                          <th>Metric</th>
                          <th>Threshold</th>
                          <th>Warn</th>
                          <th>Label</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((group, gi) => (
                          group.targets.map((t, ti) => {
                            const unit = SLA_METRIC_UNITS[t.metric];
                            const isOverridden = overriddenKeys.has(conflictKey(t));
                            return (
                              <tr key={t.id ?? `${gi}-${ti}`} className={ti === 0 && gi > 0 ? 'sla-group-first' : undefined}>
                                <td>
                                  <span className={`sla-scope-badge ${getScopeBadgeClass(t)}`}>
                                    {t.scopeLabel}
                                  </span>
                                </td>
                                <td>{SLA_METRIC_LABELS[t.metric]}</td>
                                <td>
                                  {t.operator === 'lte' ? '≤' : '≥'} {t.value}
                                  {unit && <span className="sla-unit">{unit}</span>}
                                </td>
                                <td>
                                  {t.warnAt != null ? (
                                    <>{t.warnAt}{unit && <span className="sla-unit">{unit}</span>}</>
                                  ) : (
                                    <span className="sla-unit">—</span>
                                  )}
                                </td>
                                <td className="sla-label-muted">{t.label ?? '—'}</td>
                                <td>
                                  {isOverridden ? (
                                    <span className="sla-btn-overridden">Overridden</span>
                                  ) : (
                                    <button
                                      className="sla-btn-override"
                                      onClick={() => handleOverrideClick(t)}
                                      type="button"
                                    >
                                      Override
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── Overrides section ── */}
              <div className="sla-overrides-section">
                <div className="sla-overrides-header">
                  <span className="sla-overrides-title">
                    Overrides for This Run
                    {draft.length > 0 && <span className="sla-ovr-count">{draft.length}</span>}
                  </span>
                </div>

                {draft.length === 0 && (
                  <div className="sla-overrides-empty">No overrides configured. Click &ldquo;Override&rdquo; above or &ldquo;+ Add Target&rdquo; below.</div>
                )}

                {draft.length > 0 && (
                  <table className="sla-ovr-table">
                    <colgroup>
                      <col className="col-bar" />
                      <col className="col-scope" />
                      <col className="col-metric" />
                      <col className="col-fail" />
                      <col className="col-warn" />
                      <col className="col-del" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th></th>
                        <th>Scope</th>
                        <th>Metric</th>
                        <th>Threshold</th>
                        <th>Warn</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.map((t, idx) => {
                        const err = errors[idx];
                        const unit = SLA_METRIC_UNITS[t.metric];
                        const isCloned = t._source === 'cloned';

                        return (
                          <tr key={t.id}>
                            {/* Color bar */}
                            <td className="sla-bar-cell">
                              <div className={isCloned ? 'sla-bar sla-bar-override' : 'sla-bar sla-bar-new'} />
                            </td>

                            {/* Scope */}
                            <td>
                              {isCloned ? (
                                <>
                                  <span className={`sla-scope-badge ${getScopeBadgeClass(t)}`}>
                                    {scopeLabel(t)}
                                  </span>
                                  <span className="sla-ovr-badge sla-ovr-badge-override">override</span>
                                </>
                              ) : (
                                <>
                                  <select
                                    className="sla-ovr-select"
                                    value={scopeSelectValue(t)}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'aggregate') {
                                        handleUpdateRow(idx, { scenarioName: undefined, featureGroupName: undefined });
                                      } else {
                                        handleUpdateRow(idx, { scenarioName: val, featureGroupName: undefined });
                                      }
                                    }}
                                  >
                                    <option value="aggregate">Aggregate</option>
                                    {allScopeNames.map(n => (
                                      <option key={n} value={n}>{n}</option>
                                    ))}
                                  </select>
                                  <span className="sla-ovr-badge sla-ovr-badge-new">new</span>
                                </>
                              )}
                            </td>

                            {/* Metric */}
                            <td>
                              {isCloned ? (
                                <span className="sla-readonly">{SLA_METRIC_LABELS[t.metric]}</span>
                              ) : (
                                <select
                                  className="sla-ovr-select"
                                  value={t.metric}
                                  onChange={(e) => handleUpdateRow(idx, { metric: e.target.value as SlaMetric })}
                                >
                                  {METRIC_OPTIONS.map(m => (
                                    <option key={m} value={m}>{SLA_METRIC_LABELS[m]}</option>
                                  ))}
                                </select>
                              )}
                            </td>

                            {/* Fail if */}
                            <td>
                              <input
                                type="number"
                                className={`sla-ovr-input${err.value ? ' sla-input-error' : ''}`}
                                value={t.value}
                                min={0}
                                step="any"
                                onChange={(e) =>
                                  handleUpdateRow(idx, { value: e.target.value === '' ? 0 : Number(e.target.value) })
                                }
                              />
                              {unit && <span className="sla-unit">{unit}</span>}
                              {isCloned && t._originalValue !== undefined && (
                                <span className="sla-was-hint">was {t._originalValue}</span>
                              )}
                              {err.value && <div className="sla-ovr-error">{err.value}</div>}
                            </td>

                            {/* Warn at */}
                            <td>
                              <input
                                type="number"
                                className={`sla-ovr-input${err.warnAt ? ' sla-input-error' : ''}`}
                                value={t.warnAt ?? ''}
                                min={0}
                                step="any"
                                placeholder="—"
                                onChange={(e) =>
                                  handleUpdateRow(idx, {
                                    warnAt: e.target.value === '' ? undefined : Number(e.target.value),
                                  })
                                }
                              />
                              {unit && <span className="sla-unit">{unit}</span>}
                              {isCloned && t._originalWarnAt !== undefined && (
                                <span className="sla-was-hint">was {t._originalWarnAt}</span>
                              )}
                              {err.warnAt && <div className="sla-ovr-error">{err.warnAt}</div>}
                            </td>

                            {/* Delete */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-sm sla-delete-btn"
                                onClick={() => handleRemoveRow(idx)}
                                aria-label="Remove override"
                                type="button"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <button className="btn btn-sm sla-add-btn" onClick={handleAddNew} type="button">
                  + Add Target
                </button>
              </div>
        </AppModalFrame>
      )}
    </>
  );
}

// ── Helpers ──

function getScopeBadgeClass(t: SlaTarget): string {
  if (t.featureGroupName) return 'sla-scope-fg';
  if (t.scenarioName) return 'sla-scope-test';
  return 'sla-scope-agg';
}

function scopeSelectValue(t: SlaTarget): string {
  return t.scenarioName ?? t.featureGroupName ?? 'aggregate';
}

/** Convert saved SlaTarget[] back to OverrideRow[] (reconstruct _source metadata). */
function toOverrideRows(
  targets: SlaTarget[],
  definitions: Array<SlaTarget & { scopeLabel: string }>,
): OverrideRow[] {
  const defMap = new Map<string, SlaTarget>();
  for (const d of definitions) defMap.set(conflictKey(d), d);

  return targets.map((t): OverrideRow => {
    const key = conflictKey(t);
    const def = defMap.get(key);
    if (def) {
      return { ...t, _source: 'cloned', _originalValue: def.value, _originalWarnAt: def.warnAt };
    }
    return { ...t, _source: 'new' };
  });
}

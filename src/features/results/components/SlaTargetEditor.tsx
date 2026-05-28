/**
 * SlaTargetEditor — standalone SLA target table editor.
 *
 * Shared between the Results view (SlaCompactBar) and the WorkflowRunner
 * SLA configuration panel so SLA definitions can be edited from either place.
 */
import {
  SLA_METRIC_LABELS,
  SLA_METRIC_UNITS,
  SLA_METRIC_DEFAULT_OPERATOR,
  type SlaTarget,
  type SlaMetric,
} from '../utils/slaTargets';

// ── Types ──

export interface EditorProps {
  draft: SlaTarget[];
  onChange: (targets: SlaTarget[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  /** Scenario names available in the current run/workflow for the Scenario dropdown. */
  scenarioNames: string[];
  /** Feature group names available for the Feature Group scope option (SLA-C2). */
  featureGroupNames?: string[];
}

// ── Level helpers (SLA-C2) ──

type SlaLevel = 'aggregate' | 'scenario' | 'feature';

function getLevel(t: SlaTarget): SlaLevel {
  if (t.featureGroupName) return 'feature';
  if (t.scenarioName) return 'scenario';
  return 'aggregate';
}

import { validateRow, METRIC_OPTIONS } from './slaEditorUtils';
import type { RowError } from './slaEditorUtils';

// ── Target Editor ──

export function SlaTargetEditor({ draft, onChange, onSave, onCancel, saving, scenarioNames, featureGroupNames }: EditorProps) {
  const errors: RowError[] = draft.map((t) => validateRow(t));
  const hasErrors = errors.some((e) => e.value !== undefined || e.warnAt !== undefined);

  const addRow = () => {
    const newTarget: SlaTarget = {
      id: crypto.randomUUID(),
      metric: 'p95',
      operator: 'lte',
      value: 500,
    };
    onChange([...draft, newTarget]);
  };

  const removeRow = (idx: number) => {
    onChange(draft.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<SlaTarget>) => {
    onChange(
      draft.map((t, i) => {
        if (i !== idx) return t;
        const updated = { ...t, ...patch };
        // Auto-set operator when metric changes
        if (patch.metric !== undefined && patch.operator === undefined) {
          updated.operator = SLA_METRIC_DEFAULT_OPERATOR[patch.metric];
          // Clear warnAt — it may be invalid for the new operator direction
          updated.warnAt = undefined;
        }
        return updated;
      }),
    );
  };

  return (
    <div className="sla-editor">
      {draft.length === 0 ? (
        <div className="sla-empty-hint">No targets yet. Click + Add Target to define your first SLA.</div>
      ) : (
        <table className="sla-editor-table">
          <colgroup>
            <col className="col-metric" />
            <col className="col-op" />
            <col className="col-fail" />
            <col className="col-warn" />
            <col className="col-label" />
            <col className="col-scope" />
            <col className="col-del" />
          </colgroup>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Op</th>
              <th>Fail if</th>
              <th>Warn at</th>
              <th>Label</th>
              <th>Scope</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draft.map((t, idx) => {
              const err = errors[idx];
              const unit = SLA_METRIC_UNITS[t.metric];
              return (
                <tr key={t.id}>
                  <td>
                    <select
                      className="sla-editor-select"
                      value={t.metric}
                      onChange={(e) => updateRow(idx, { metric: e.target.value as SlaMetric })}
                    >
                      {METRIC_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {SLA_METRIC_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="sla-operator-display">
                      {t.operator === 'lte' ? '≤' : '≥'}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`sla-editor-input${err.value ? ' sla-input-error' : ''}`}
                      value={t.value}
                      min={0}
                      step="any"
                      onChange={(e) =>
                        updateRow(idx, { value: e.target.value === '' ? 0 : Number(e.target.value) })
                      }
                    />
                    {unit && <span className="sla-editor-unit">{unit}</span>}
                    {err.value && <div className="sla-editor-error">{err.value}</div>}
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`sla-editor-input${err.warnAt ? ' sla-input-error' : ''}`}
                      value={t.warnAt ?? ''}
                      min={0}
                      step="any"
                      placeholder="—"
                      onChange={(e) =>
                        updateRow(idx, {
                          warnAt: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                    {unit && <span className="sla-editor-unit">{unit}</span>}
                    {err.warnAt && <div className="sla-editor-error">{err.warnAt}</div>}
                  </td>
                  <td>
                    <input
                      type="text"
                      className="sla-editor-input sla-editor-input-label"
                      value={t.label ?? ''}
                      placeholder="optional"
                      onChange={(e) =>
                        updateRow(idx, { label: e.target.value || undefined })
                      }
                    />
                  </td>
                  <td className="sla-scope-cell">
                    <select
                      className="sla-level-select"
                      value={getLevel(t)}
                      onChange={(e) => {
                        const newLevel = e.target.value as SlaLevel;
                        if (newLevel === 'aggregate') {
                          updateRow(idx, { scenarioName: undefined, featureGroupName: undefined });
                        } else if (newLevel === 'scenario') {
                          updateRow(idx, { scenarioName: scenarioNames[0] ?? '', featureGroupName: undefined });
                        } else {
                          updateRow(idx, { featureGroupName: (featureGroupNames ?? [])[0] ?? '', scenarioName: undefined });
                        }
                      }}
                    >
                      <option value="aggregate">Aggregate</option>
                      <option value="scenario">Scenario</option>
                      {(featureGroupNames ?? []).length > 0 && (
                        <option value="feature">Feature Group</option>
                      )}
                    </select>
                    {(() => {
                      const level = getLevel(t);

                      if (level === 'scenario') {
                        const scenarioName = t.scenarioName as string;
                        const scenarioOptions = [...new Set([scenarioName, ...scenarioNames])];
                        return (
                          <select
                            className="sla-name-select"
                            value={scenarioName}
                            onChange={(e) =>
                              updateRow(idx, { scenarioName: e.target.value || undefined })
                            }
                          >
                            {/* Always include the current value so the select is never blank */}
                            {scenarioOptions.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        );
                      }

                      if (level === 'feature') {
                        const featureGroupName = t.featureGroupName as string;
                        const featureGroupOptions = [...new Set([featureGroupName, ...(featureGroupNames ?? [])])];
                        return (
                          <select
                            className="sla-fg-select sla-name-select"
                            value={featureGroupName}
                            onChange={(e) =>
                              updateRow(idx, { featureGroupName: e.target.value || undefined })
                            }
                          >
                            {/* Always include the current value so the select is never blank */}
                            {featureGroupOptions.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        );
                      }

                      return null;
                    })()}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm sla-delete-btn"
                      onClick={() => removeRow(idx)}
                      aria-label="Delete target"
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

      <div className="sla-editor-footer">
        <button className="btn btn-sm sla-add-btn" onClick={addRow}>
          + Add Target
        </button>
        <div className="sla-editor-actions">
          <button className="btn btn-sm" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={onSave}
            disabled={hasErrors || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

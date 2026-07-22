/**
 * TestSlaModal — modal for editing SLA targets on an individual test (Scenario).
 *
 * Opens when the user clicks the 🎯 SLA button on a test card.
 * Uses a simplified SlaTargetEditor without the Scope column (targets are
 * already scoped to the individual test).
 */
import { useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { SlaTarget, Scenario } from '../../../shared/types';
import {
  SLA_METRIC_LABELS,
  SLA_METRIC_UNITS,
  SLA_METRIC_DEFAULT_OPERATOR,
  type SlaMetric,
} from '../../results/utils/slaTargets';
import { validateRow, METRIC_OPTIONS } from '../../results/components/slaEditorUtils';

interface TestSlaModalProps {
  test: Scenario;
  onSave: (targets: SlaTarget[]) => void;
  onClose: () => void;
}

export default function TestSlaModal({ test, onSave, onClose }: TestSlaModalProps) {
  const [draft, setDraft] = useState<SlaTarget[]>(
    (test.slaTargets ?? []).map((t) => ({ ...t })),
  );

  const errors = draft.map((t) => validateRow(t));
  const hasErrors = errors.some((e) => e.value !== undefined || e.warnAt !== undefined);

  const addRow = () => {
    setDraft((prev) => [
      ...prev,
      { id: crypto.randomUUID(), metric: 'p95', operator: 'lte' as const, value: 500 },
    ]);
  };

  const removeRow = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<SlaTarget>) => {
    setDraft((prev) =>
      prev.map((t, i) => {
        if (i !== idx) return t;
        const updated = { ...t, ...patch };
        if (patch.metric !== undefined && patch.operator === undefined) {
          updated.operator = SLA_METRIC_DEFAULT_OPERATOR[patch.metric];
          updated.warnAt = undefined;
        }
        return updated;
      }),
    );
  };

  const handleSave = () => {
    if (hasErrors) return;
    onSave(draft);
    onClose();
  };

  return (
    <AppModalFrame
      open
      title={
        <span>
          🎯 SLA Targets — <strong>{test.name}</strong>
        </span>
      }
      onClose={onClose}
      overlayClassName="modal-overlay"
      dialogClassName="test-sla-modal"
      closeButtonKind="none"
      showExpandButton={false}
      closeOnOverlayClick={false}
      bodyClassName="test-sla-modal-body"
      footerClassName="test-sla-modal-footer"
      footer={
        <div className="sla-editor-footer">
          <button className="btn btn-sm sla-add-btn" onClick={addRow}>
            + Add Target
          </button>
          <div className="sla-editor-actions">
            <button className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleSave}
              disabled={hasErrors}
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      {draft.length === 0 ? (
        <div className="sla-empty-hint">
          No SLA targets yet. Click <strong>+ Add Target</strong> to define acceptance criteria for this test.
        </div>
      ) : (
        <table className="sla-editor-table sla-editor-table--test">
          <colgroup>
            <col className="col-metric" />
            <col className="col-op" />
            <col className="col-fail" />
            <col className="col-arrow" />
            <col className="col-warn" />
            <col className="col-label" />
            <col className="col-del" />
          </colgroup>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Op</th>
              <th>Fail at</th>
              <th></th>
              <th>Warn at</th>
              <th>Label</th>
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
                    <CustomSelect
                      className="sla-editor-select"
                      value={t.metric}
                      onChange={(v) => updateRow(idx, { metric: v as SlaMetric })}
                      options={METRIC_OPTIONS.map((m) => ({ value: m, label: SLA_METRIC_LABELS[m] }))}
                    />
                  </td>
                  <td>
                    <span className="sla-operator-display">{t.operator === 'lte' ? '≤' : '≥'}</span>
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`sla-editor-input${err.value ? ' sla-input-error' : ''}`}
                      value={t.value}
                      min={0}
                      step="any"
                      onChange={(e) => updateRow(idx, { value: e.target.value === '' ? 0 : Number(e.target.value) })}
                    />
                    {unit && <span className="sla-editor-unit">{unit}</span>}
                    {err.value && <div className="sla-editor-error">{err.value}</div>}
                  </td>
                  <td><span className="sla-arrow">warn →</span></td>
                  <td>
                    <input
                      type="number"
                      className={`sla-editor-input${err.warnAt ? ' sla-input-error' : ''}`}
                      value={t.warnAt ?? ''}
                      min={0}
                      step="any"
                      placeholder="—"
                      onChange={(e) => updateRow(idx, { warnAt: e.target.value === '' ? undefined : Number(e.target.value) })}
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
                      onChange={(e) => updateRow(idx, { label: e.target.value || undefined })}
                    />
                  </td>
                  <td>
                    <button className="btn btn-sm sla-delete-btn" onClick={() => removeRow(idx)} aria-label="Delete target">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppModalFrame>
  );
}

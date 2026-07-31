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
        <span className="test-sla-modal-title">
          <span className="test-sla-modal-icon">🎯</span>
          SLA Targets
          <span className="test-sla-modal-separator">—</span>
          <strong>{test.name}</strong>
        </span>
      }
      onClose={onClose}
      overlayClassName="modal-overlay"
      dialogClassName="test-sla-modal"
      closeButtonKind="none"
      showExpandButton={false}
      showResizeHandles
      closeOnOverlayClick={false}
      constrainDragToViewport
      dragViewportPadding={12}
      minWidth={720}
      minHeight={300}
      bodyClassName="test-sla-modal-body"
      footerClassName="test-sla-modal-footer"
      footer={
        <div className="test-sla-footer-bar">
          <div className="test-sla-footer-left">
            <button className="btn btn-sm test-sla-add-btn" onClick={addRow}>
              <span className="test-sla-add-icon">+</span>
              Add Target
            </button>
            <span className="test-sla-ux-hint">Drag header to move • drag bottom-right corner to resize</span>
          </div>
          <div className="test-sla-footer-actions">
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
        <div className="test-sla-empty">
          <div className="test-sla-empty-icon">🎯</div>
          <div className="test-sla-empty-text">No SLA targets yet</div>
          <div className="test-sla-empty-hint">
            Click <strong>+ Add Target</strong> to define acceptance criteria for this test.
          </div>
        </div>
      ) : (
        <div className="test-sla-table-wrap">
          <table className="test-sla-table">
            <thead>
              <tr>
                <th className="test-sla-th-idx">#</th>
                <th className="test-sla-th-metric">Metric</th>
                <th className="test-sla-th-op">Op</th>
                <th className="test-sla-th-fail">Fail at</th>
                <th className="test-sla-th-arrow"></th>
                <th className="test-sla-th-warn">Warn at</th>
                <th className="test-sla-th-label">Label</th>
                <th className="test-sla-th-del"></th>
              </tr>
            </thead>
            <tbody>
              {draft.map((t, idx) => {
                const err = errors[idx];
                const unit = SLA_METRIC_UNITS[t.metric];
                return (
                  <tr key={t.id} className="test-sla-row">
                    <td className="test-sla-cell-idx">{idx + 1}</td>
                    <td className="test-sla-cell-metric">
                      <CustomSelect
                        className="test-sla-select"
                        value={t.metric}
                        onChange={(v) => updateRow(idx, { metric: v as SlaMetric })}
                        options={METRIC_OPTIONS.map((m) => ({ value: m, label: SLA_METRIC_LABELS[m] }))}
                      />
                    </td>
                    <td className="test-sla-cell-op">
                      <span className="test-sla-operator">{t.operator === 'lte' ? '≤' : '≥'}</span>
                    </td>
                    <td className="test-sla-cell-fail">
                      <div className="test-sla-input-group">
                        <input
                          type="number"
                          className={`test-sla-input${err.value ? ' test-sla-input--error' : ''}`}
                          value={t.value}
                          min={0}
                          step="any"
                          onChange={(e) => updateRow(idx, { value: e.target.value === '' ? 0 : Number(e.target.value) })}
                        />
                        {unit && <span className="test-sla-unit">{unit}</span>}
                      </div>
                      {err.value && <div className="test-sla-error">{err.value}</div>}
                    </td>
                    <td className="test-sla-cell-arrow">
                      <span className="test-sla-warn-arrow">warn →</span>
                    </td>
                    <td className="test-sla-cell-warn">
                      <div className="test-sla-input-group">
                        <input
                          type="number"
                          className={`test-sla-input${err.warnAt ? ' test-sla-input--error' : ''}`}
                          value={t.warnAt ?? ''}
                          min={0}
                          step="any"
                          placeholder="—"
                          onChange={(e) => updateRow(idx, { warnAt: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        {unit && <span className="test-sla-unit">{unit}</span>}
                      </div>
                      {err.warnAt && <div className="test-sla-error">{err.warnAt}</div>}
                    </td>
                    <td className="test-sla-cell-label">
                      <input
                        type="text"
                        className="test-sla-input test-sla-input--label"
                        value={t.label ?? ''}
                        placeholder="optional"
                        onChange={(e) => updateRow(idx, { label: e.target.value || undefined })}
                      />
                    </td>
                    <td className="test-sla-cell-del">
                      <button className="test-sla-delete-btn" onClick={() => removeRow(idx)} aria-label="Delete target">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppModalFrame>
  );
}

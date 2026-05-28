import { useState } from 'react';
import type { RegressionThresholds } from '../utils/runBaselines';
import { DEFAULT_THRESHOLDS } from '../utils/runBaselines';

interface Props {
  thresholds: RegressionThresholds;
  onSave: (t: RegressionThresholds) => void;
  onCancel: () => void;
}

type ThresholdKey = keyof RegressionThresholds;

const ROWS: Array<{ key: ThresholdKey; label: string; unit: string; hint: string }> = [
  { key: 'avgPercent',        label: 'Avg Response Time', unit: '%',  hint: 'Warn when avg response time increases by this %' },
  { key: 'p50Percent',        label: 'P50 Response Time', unit: '%',  hint: 'Warn when P50 increases by this %' },
  { key: 'p95Percent',        label: 'P95 Response Time', unit: '%',  hint: 'Warn when P95 increases by this %' },
  { key: 'p99Percent',        label: 'P99 Response Time', unit: '%',  hint: 'Warn when P99 increases by this %' },
  { key: 'p999Percent',       label: 'P99.9 Response Time', unit: '%', hint: 'Warn when P99.9 increases by this %' },
  { key: 'tpsPercent',        label: 'TPS Drop',          unit: '%',  hint: 'Warn when TPS drops by this %' },
  { key: 'errorRateAbsolute', label: 'Error Rate Increase', unit: 'pp', hint: 'Warn when error rate increases by this many percentage points' },
];

export function RegressionThresholdsPanel({ thresholds, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<RegressionThresholds>({ ...thresholds });

  const set = (key: ThresholdKey, raw: string) => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 0) {
      setDraft((prev) => ({ ...prev, [key]: n }));
    }
  };

  const handleReset = () => setDraft({ ...DEFAULT_THRESHOLDS });

  return (
    <div className="thresholds-panel">
      <div className="thresholds-header">
        <span className="thresholds-title">Regression Thresholds</span>
        <span className="thresholds-hint">Critical alert fires at 2× these values</span>
      </div>

      <div className="thresholds-grid">
        <div className="thresholds-col-header">Metric</div>
        <div className="thresholds-col-header">Warning threshold</div>
        <div className="thresholds-col-header">Default</div>

        {ROWS.map(({ key, label, unit, hint }) => (
          <div key={key} className="thresholds-row" title={hint}>
            <label className="thresholds-label">{label}</label>
            <div className="thresholds-input-wrap">
              <input
                type="number"
                className="thresholds-input"
                min={0}
                step={key === 'errorRateAbsolute' ? 0.5 : 5}
                value={draft[key]}
                onChange={(e) => set(key, e.target.value)}
              />
              <span className="thresholds-unit">{unit}</span>
            </div>
            <span className="thresholds-default">{DEFAULT_THRESHOLDS[key]} {unit}</span>
          </div>
        ))}
      </div>

      <div className="thresholds-actions">
        <button className="btn btn-sm" onClick={handleReset} title="Reset all to defaults">
          Reset Defaults
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={() => onSave(draft)}>Save</button>
      </div>
    </div>
  );
}

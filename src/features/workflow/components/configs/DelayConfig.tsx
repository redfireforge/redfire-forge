import type { DelayNodeData } from '../../types/workflow';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';

const MODE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'random', label: 'Random Range' },
];

const PRESET_DELAYS_MS = [
  { ms: 250, label: '250 ms' },
  { ms: 500, label: '500 ms' },
  { ms: 1000, label: '1 s' },
  { ms: 2000, label: '2 s' },
  { ms: 5000, label: '5 s' },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = ms / 1000;
  return Number.isInteger(sec) ? `${sec} s` : `${sec.toFixed(1)} s`;
}

function clampMs(raw: string): number {
  return Math.max(0, Math.min(60000, parseInt(raw, 10) || 0));
}

export default function DelayConfig({ data, onChange }: { data: DelayNodeData; onChange: (d: DelayNodeData) => void }) {
  const update = (patch: Partial<DelayNodeData>) => onChange({ ...data, ...patch });
  const isFixed = data.mode === 'fixed';
  const minMs = data.minMs ?? 0;
  const maxMs = data.maxMs ?? data.delayMs;
  const summary = isFixed
    ? `Waits a fixed ${formatDuration(data.delayMs)} before continuing.`
    : `Waits a random duration between ${formatDuration(minMs)} and ${formatDuration(maxMs)}.`;

  return (
    <div className="wf-config-body wf-delay-config" data-testid="delay-config">
      <KafkaCard
        title="Delay"
        hint="Pause the workflow before the next node runs."
      >
        <div className="wf-kafka-form wf-kafka-form--delay">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Delay"
              aria-label="Delay label"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Mode" hint="Fixed or random range" compact>
            <CustomSelect
              value={data.mode}
              onChange={(v) => update({ mode: v as 'fixed' | 'random' })}
              options={MODE_OPTIONS}
              aria-label="Delay mode"
            />
          </KafkaFormRow>

          {isFixed && (
            <KafkaFormRow label="Duration" hint="0–60000 ms" compact>
              <div className="wf-delay-duration-ctrl">
                <input
                  className="wf-kafka-form-input"
                  type="number"
                  min={0}
                  max={60000}
                  value={data.delayMs}
                  onChange={(e) => update({ delayMs: clampMs(e.target.value) })}
                  aria-label="Delay (ms)"
                />
                <span className="unit">ms</span>
              </div>
            </KafkaFormRow>
          )}

          {!isFixed && (
            <>
              <KafkaFormRow label="Min" hint="Lower bound (inclusive)" compact>
                <div className="wf-delay-duration-ctrl">
                  <input
                    className="wf-kafka-form-input"
                    type="number"
                    min={0}
                    max={60000}
                    value={minMs}
                    onChange={(e) => update({ minMs: clampMs(e.target.value) })}
                    aria-label="Min (ms)"
                  />
                  <span className="unit">ms</span>
                </div>
              </KafkaFormRow>
              <KafkaFormRow label="Max" hint="Upper bound (inclusive)" compact>
                <div className="wf-delay-duration-ctrl">
                  <input
                    className="wf-kafka-form-input"
                    type="number"
                    min={0}
                    max={60000}
                    value={maxMs}
                    onChange={(e) => update({ maxMs: clampMs(e.target.value) })}
                    aria-label="Max (ms)"
                  />
                  <span className="unit">ms</span>
                </div>
              </KafkaFormRow>
            </>
          )}
        </div>

        {isFixed && (
          <div className="wf-delay-presets">
            <span className="wf-delay-presets-label">Presets</span>
            <div className="wf-delay-presets-row" role="group" aria-label="Quick delay presets">
              {PRESET_DELAYS_MS.map((p) => (
                <button
                  key={p.ms}
                  type="button"
                  className={`wf-delay-preset-chip${data.delayMs === p.ms ? ' is-active' : ''}`}
                  onClick={() => update({ delayMs: p.ms })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="wf-delay-summary">{summary}</p>
      </KafkaCard>

      <KafkaCard title="How delay works" hint="Quick reference for runners and load tests.">
        <ul className="wf-delay-tips">
          <li>
            <strong>Fixed</strong> always waits the same duration — useful for pacing or waiting on a known SLA.
          </li>
          <li>
            <strong>Random Range</strong> picks a value between min and max on each run — useful to simulate think time under load.
          </li>
          <li>
            Downstream nodes start only after the delay completes. Use short delays in Quick Test to keep demos snappy.
          </li>
        </ul>
      </KafkaCard>
    </div>
  );
}

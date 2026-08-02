import { useRef } from 'react';
import type { ScheduleTriggerNodeData } from '../../types/workflow';
import { KafkaAddButton, KafkaCard, KafkaFormRow } from './KafkaConfigUi';

interface Props {
  data: ScheduleTriggerNodeData;
  onChange: (patch: Partial<ScheduleTriggerNodeData>) => void;
  newVarKey: string;
  setNewVarKey: (key: string) => void;
  newVarValue: string;
  setNewVarValue: (value: string) => void;
  workflowVariables: Record<string, string>;
}

const CRON_EXAMPLES: { cron: string; label: string }[] = [
  { cron: '* * * * *', label: 'Every minute' },
  { cron: '*/15 * * * *', label: 'Every 15 minutes' },
  { cron: '0 * * * *', label: 'Every hour' },
  { cron: '0 */6 * * *', label: 'Every 6 hours' },
  { cron: '0 9 * * *', label: 'Daily at 9:00' },
  { cron: '0 9 * * MON-FRI', label: 'Weekdays at 9:00' },
  { cron: '0 0 * * SUN', label: 'Sundays at midnight' },
  { cron: '0 0 1 * *', label: '1st of month' },
];

const AUTO_VARS: { name: string; desc: string }[] = [
  { name: 'triggerTime', desc: 'ISO timestamp' },
  { name: 'triggerTimestamp', desc: 'Unix seconds' },
  { name: 'triggerDate', desc: 'YYYY-MM-DD' },
  { name: 'triggerHour', desc: 'HH (00–23)' },
  { name: 'triggerMinute', desc: 'MM (00–59)' },
];

export default function ScheduleConfig({
  data,
  onChange,
  newVarKey,
  setNewVarKey,
  newVarValue,
  setNewVarValue,
}: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const variables = data.inputVariables ?? {};
  const entries = Object.entries(variables);

  const updateVariables = (next: Record<string, string>) => {
    onChange({ inputVariables: next });
  };

  const addVar = () => {
    const key = newVarKey.trim().replace(/[{}]/g, '');
    if (!key) {
      nameInputRef.current?.focus();
      return;
    }
    updateVariables({ ...variables, [key]: newVarValue });
    setNewVarKey('');
    setNewVarValue('');
    nameInputRef.current?.focus();
  };

  const renameVar = (oldKey: string, rawNext: string) => {
    const newKey = rawNext.replace(/[{}]/g, '').trim();
    if (!newKey || newKey === oldKey) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(variables)) {
      next[k === oldKey ? newKey : k] = v;
    }
    updateVariables(next);
  };

  return (
    <div className="wf-config-body wf-schedule-config" data-testid="schedule-config">
      <KafkaCard
        title="Schedule"
        hint="When this workflow should run. Cron uses the timezone below."
      >
        <div className="wf-kafka-form wf-kafka-form--connection wf-kafka-form--schedule">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Schedule Trigger"
              aria-label="Schedule label"
            />
          </KafkaFormRow>

          <KafkaFormRow
            label="Cron expression"
            hint="minute hour day month weekday"
            compact
          >
            <input
              type="text"
              className="wf-kafka-form-input wf-kafka-form-input--mono"
              value={data.cronExpression}
              onChange={(e) => onChange({ cronExpression: e.target.value })}
              placeholder="0 9 * * MON-FRI"
              aria-label="Cron Expression"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Description" hint="Human-readable summary" compact>
            <input
              type="text"
              className="wf-kafka-form-input"
              value={data.scheduleDescription ?? ''}
              onChange={(e) => onChange({ scheduleDescription: e.target.value })}
              placeholder="Every weekday at 9:00 AM EST"
              aria-label="Schedule Description"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Timezone" hint="IANA identifier" compact>
            <input
              type="text"
              className="wf-kafka-form-input wf-kafka-form-input--mono"
              value={data.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              placeholder="America/New_York"
              aria-label="Timezone"
              list="wf-schedule-tz-suggestions"
            />
            <datalist id="wf-schedule-tz-suggestions">
              <option value="UTC" />
              <option value="America/New_York" />
              <option value="America/Chicago" />
              <option value="America/Denver" />
              <option value="America/Los_Angeles" />
              <option value="America/Sao_Paulo" />
              <option value="Europe/London" />
              <option value="Europe/Paris" />
              <option value="Europe/Berlin" />
              <option value="Asia/Tokyo" />
              <option value="Asia/Shanghai" />
              <option value="Asia/Kolkata" />
              <option value="Australia/Sydney" />
            </datalist>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Common cron examples"
        hint="Click an example to fill the cron expression. Adjust timezone separately."
      >
        <div className="wf-schedule-cron-grid">
          {CRON_EXAMPLES.map((ex) => (
            <button
              key={ex.cron}
              type="button"
              className={`wf-schedule-cron-chip${data.cronExpression === ex.cron ? ' is-active' : ''}`}
              onClick={() => onChange({ cronExpression: ex.cron })}
              title={`Use ${ex.cron}`}
            >
              <code className="wf-schedule-info-code">{ex.cron}</code>
              <span>{ex.label}</span>
            </button>
          ))}
        </div>
        <p className="wf-schedule-cron-format">
          Format: <code>minute (0–59) hour (0–23) day (1–31) month (1–12) weekday (SUN–SAT)</code>
        </p>
      </KafkaCard>

      <KafkaCard
        title="Automatic variables"
        hint="Injected on every scheduled run — available as {{name}} downstream."
      >
        <ul className="wf-schedule-auto-vars-list">
          {AUTO_VARS.map((v) => (
            <li key={v.name} className="wf-schedule-auto-var-row">
              <code>{`{{${v.name}}}`}</code>
              <span>{v.desc}</span>
            </li>
          ))}
        </ul>
        <p className="wf-schedule-info-tip">
          These are set when the schedule fires — separate from the initial variables you define below.
        </p>
      </KafkaCard>

      <KafkaCard
        title="Initial variables"
        hint="Optional seeds available when the schedule triggers, in addition to automatic variables."
        action={(
          <KafkaAddButton
            testId="schedule-var-add-btn"
            label="+ Add"
            onClick={() => {
              if (newVarKey.trim()) addVar();
              else nameInputRef.current?.focus();
            }}
          />
        )}
      >
        <div className="wf-start-vars-panel">
          {entries.length === 0 ? (
            <div className="wf-start-vars-empty">
              <p className="wf-start-vars-empty-title">No initial variables</p>
              <p className="wf-start-vars-empty-text">
                Add static seeds for each scheduled run — for example <code>region</code> or{' '}
                <code>env</code>.
              </p>
            </div>
          ) : (
            <div className="wf-start-vars-header" aria-hidden="true">
              <span className="wf-start-vars-col-name">Name</span>
              <span className="wf-start-vars-col-value">Value</span>
              <span className="wf-start-vars-col-del" />
            </div>
          )}

          <div className="wf-start-vars-list">
            {entries.map(([key, value], index) => (
              <div key={index} className="wf-start-vars-row">
                <div className="wf-start-vars-col-name">
                  <input
                    className="wf-kafka-form-input"
                    value={key}
                    onChange={(e) => renameVar(key, e.target.value)}
                    aria-label={`Variable name ${key}`}
                  />
                </div>
                <div className="wf-start-vars-col-value">
                  <input
                    className="wf-kafka-form-input"
                    value={value}
                    onChange={(e) => updateVariables({ ...variables, [key]: e.target.value })}
                    aria-label={`Value for ${key}`}
                  />
                </div>
                <div className="wf-start-vars-col-del">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    aria-label={`Remove variable ${key}`}
                    onClick={() => {
                      const next = { ...variables };
                      delete next[key];
                      updateVariables(next);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <div className="wf-start-vars-row wf-start-vars-row--new">
              <div className="wf-start-vars-col-name">
                <input
                  ref={nameInputRef}
                  className="wf-kafka-form-input"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  placeholder="name"
                  onKeyDown={(e) => e.key === 'Enter' && addVar()}
                  aria-label="New variable name"
                />
              </div>
              <div className="wf-start-vars-col-value">
                <input
                  className="wf-kafka-form-input"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  placeholder="value"
                  onKeyDown={(e) => e.key === 'Enter' && addVar()}
                  aria-label="New variable value"
                />
              </div>
              <div className="wf-start-vars-col-del">
                <button
                  type="button"
                  className="btn btn-sm wf-kafka-add-btn"
                  onClick={addVar}
                  aria-label="Add variable"
                  title="Add variable"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </KafkaCard>

      <KafkaCard title="Notes" hint="Optional description for teammates.">
        <div className="wf-kafka-card-pad">
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            rows={3}
            value={data.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Documentation or notes about this schedule..."
            aria-label="Notes (optional)"
          />
        </div>
      </KafkaCard>
    </div>
  );
}

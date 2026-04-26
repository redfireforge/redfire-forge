import type { ScheduleTriggerNodeData } from '../../types/workflow';
import VariablesSection from '../panels/VariablesSection';

interface Props {
  data: ScheduleTriggerNodeData;
  onChange: (patch: Partial<ScheduleTriggerNodeData>) => void;
  newVarKey: string;
  setNewVarKey: (key: string) => void;
  newVarValue: string;
  setNewVarValue: (value: string) => void;
  workflowVariables: Record<string, string>;
}

export default function ScheduleConfig({
  data,
  onChange,
  newVarKey,
  setNewVarKey,
  newVarValue,
  setNewVarValue,
  workflowVariables,
}: Props) {
  return (
    <>
      <div className="wf-config-section">
        <label className="wf-config-label">
          Cron Expression
          <input
            type="text"
            className="wf-config-input"
            value={data.cronExpression}
            onChange={(e) => onChange({ cronExpression: e.target.value })}
            placeholder="0 9 * * MON-FRI"
          />
          <span className="wf-config-hint">Standard cron format: minute hour day month weekday</span>
        </label>
      </div>

      {/* Schedule Info Panel */}
      <div className="wf-schedule-info-panel">
        <div className="wf-schedule-info-title">
          Schedule Information
        </div>
        <div className="wf-schedule-info-body">
          <div className="wf-schedule-info-row">
            <strong>Cron:</strong> <code className="wf-schedule-info-code">
              {data.cronExpression || '(not set)'}
            </code>
          </div>
          {data.scheduleDescription && (
            <div className="wf-schedule-info-row">
              <strong>Description:</strong> {data.scheduleDescription}
            </div>
          )}
          <div className="wf-schedule-info-row">
            <strong>Timezone:</strong> <code className="wf-schedule-info-code">
              {data.timezone || 'UTC'}
            </code>
          </div>
          <div className="wf-schedule-auto-vars">
            <div className="wf-schedule-auto-vars-title">Automatic Variables:</div>
            <div className="wf-schedule-auto-vars-list">
              {'{{triggerTime}}'} - ISO timestamp<br/>
              {'{{triggerTimestamp}}'} - Unix seconds<br/>
              {'{{triggerDate}}'} - YYYY-MM-DD<br/>
              {'{{triggerHour}}'} - HH (00-23)<br/>
              {'{{triggerMinute}}'} - MM (00-59)
            </div>
          </div>
          <div className="wf-schedule-info-tip">
            These variables are automatically injected when the schedule triggers.
          </div>
        </div>
      </div>

      <div className="wf-config-section">
        <label className="wf-config-label">
          Schedule Description
          <input
            type="text"
            className="wf-config-input"
            value={data.scheduleDescription ?? ''}
            onChange={(e) => onChange({ scheduleDescription: e.target.value })}
            placeholder="Every weekday at 9:00 AM EST"
          />
          <span className="wf-config-hint">Human-readable description of the schedule</span>
        </label>
      </div>
      <div className="wf-config-section">
        <label className="wf-config-label">
          Timezone
          <input
            type="text"
            className="wf-config-input"
            value={data.timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            placeholder="America/New_York"
          />
          <span className="wf-config-hint">IANA timezone identifier</span>
        </label>
      </div>

      {/* Common Cron Examples */}
      <details className="wf-schedule-cron-examples">
        <summary>Common Cron Examples</summary>
        <div className="wf-schedule-cron-examples-list">
          <div><code>* * * * *</code> - Every minute</div>
          <div><code>0 * * * *</code> - Every hour (on the hour)</div>
          <div><code>0 9 * * *</code> - Every day at 9:00 AM</div>
          <div><code>0 9 * * MON-FRI</code> - Weekdays at 9:00 AM</div>
          <div><code>0 0 * * SUN</code> - Sundays at midnight</div>
          <div><code>*/15 * * * *</code> - Every 15 minutes</div>
          <div><code>0 */6 * * *</code> - Every 6 hours</div>
          <div><code>0 0 1 * *</code> - First day of every month at midnight</div>
          <div className="wf-schedule-cron-format">
            Format: <code>minute (0-59) hour (0-23) day (1-31) month (1-12) weekday (0-7 or SUN-SAT)</code>
          </div>
        </div>
      </details>

      <VariablesSection
        title="Initial variables"
        hint="Variables available at schedule trigger time."
        variables={data.inputVariables ?? {}}
        onUpdateVariables={(vars) => onChange({ inputVariables: vars })}
        newVarKey={newVarKey}
        setNewVarKey={setNewVarKey}
        newVarValue={newVarValue}
        setNewVarValue={setNewVarValue}
        workflowVariables={workflowVariables}
      />
      <div className="wf-config-section">
        <label className="wf-config-label">
          Notes (optional)
          <textarea
            className="wf-config-textarea"
            rows={3}
            value={data.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Documentation or notes about this schedule..."
          />
        </label>
      </div>
    </>
  );
}

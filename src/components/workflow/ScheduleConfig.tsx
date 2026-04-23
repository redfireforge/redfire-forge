import type { ScheduleTriggerNodeData } from '../../types/workflow';
import VariablesSection from './VariablesSection';

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
      <div style={{
        padding: '12px',
        backgroundColor: '#e3f2fd',
        border: '1px solid #2196f3',
        borderRadius: '8px',
        marginBottom: '16px',
      }}>
        <div style={{ fontWeight: 'bold', color: '#1976d2', marginBottom: '8px', fontSize: '0.9rem' }}>
          ⏰ Schedule Information
        </div>
        <div style={{ fontSize: '0.85rem', color: '#555', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Cron:</strong> <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
              {data.cronExpression || '(not set)'}
            </code>
          </div>
          {data.scheduleDescription && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Description:</strong> {data.scheduleDescription}
            </div>
          )}
          <div style={{ marginBottom: '8px' }}>
            <strong>Timezone:</strong> <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
              {data.timezone || 'UTC'}
            </code>
          </div>
          <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>📝 Automatic Variables:</div>
            <div style={{ color: '#777', lineHeight: '1.5' }}>
              • <code>{'{{triggerTime}}'}</code> - ISO timestamp<br/>
              • <code>{'{{triggerTimestamp}}'}</code> - Unix milliseconds<br/>
              • <code>{'{{triggerDate}}'}</code> - YYYY-MM-DD<br/>
              • <code>{'{{triggerHour}}'}</code> - HH (00-23)<br/>
              • <code>{'{{triggerMinute}}'}</code> - MM (00-59)
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>
            💡 Tip: These variables are automatically injected when the schedule triggers. Use them in HTTP requests or conditions.
          </div>
        </div>
      </div>

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
      <details style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', color: '#555' }}>
          📚 Common Cron Examples
        </summary>
        <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#666', lineHeight: '1.8' }}>
          <div><code>* * * * *</code> - Every minute</div>
          <div><code>0 * * * *</code> - Every hour (on the hour)</div>
          <div><code>0 9 * * *</code> - Every day at 9:00 AM</div>
          <div><code>0 9 * * MON-FRI</code> - Weekdays at 9:00 AM</div>
          <div><code>0 0 * * SUN</code> - Sundays at midnight</div>
          <div><code>*/15 * * * *</code> - Every 15 minutes</div>
          <div><code>0 */6 * * *</code> - Every 6 hours</div>
          <div><code>0 0 1 * *</code> - First day of every month at midnight</div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
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

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

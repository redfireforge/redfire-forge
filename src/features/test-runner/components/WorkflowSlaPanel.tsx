/**
 * WorkflowSlaPanel — collapsible SLA target editor embedded in WorkflowRunner.
 *
 * Lets the user define SLA targets as part of a workflow's definition (pre-run).
 * These targets are saved to the workflow record and then embedded into TestConfig
 * at run time by WorkflowRunner, so Results shows them as read-only "📋 Workflow".
 */
import { useState } from 'react';
import type { SlaTarget } from '../../../shared/types';
import { SlaTargetEditor } from '../../results/components/SlaTargetEditor';

interface WorkflowSlaPanelProps {
  /** Current SLA targets stored on the workflow definition. */
  initialTargets: SlaTarget[];
  /** Called to persist updated targets to the workflow record. */
  onSave: (targets: SlaTarget[]) => Promise<void>;
  /** Disable editing while a run is in progress. */
  disabled?: boolean;
}

export default function WorkflowSlaPanel({ initialTargets, onSave, disabled = false }: WorkflowSlaPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<SlaTarget[]>(initialTargets);
  const [saving, setSaving] = useState(false);

  // Keep draft in sync when the workflow selection changes
  // (parent key-remounts the component, so this is only needed if parent doesn't remount)
  const [lastInitial, setLastInitial] = useState(initialTargets);
  if (initialTargets !== lastInitial) {
    setLastInitial(initialTargets);
    setDraft(initialTargets);
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(initialTargets);
    setExpanded(false);
  };

  const targetCount = initialTargets.length;

  return (
    <div className={`workflow-sla-panel${disabled ? ' workflow-sla-panel--disabled' : ''}`}>
      <button
        className="workflow-sla-panel-header"
        onClick={() => !disabled && setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={disabled}
      >
        <span className="workflow-sla-panel-title">
          SLA Targets
          {targetCount > 0 && (
            <span className="workflow-sla-count-badge">{targetCount}</span>
          )}
        </span>
        <span className="workflow-sla-panel-hint">
          {targetCount === 0
            ? 'Define SLA targets for this workflow'
            : `${targetCount} target${targetCount === 1 ? '' : 's'} defined — embedded at run time`}
        </span>
        <span className="workflow-sla-panel-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="workflow-sla-panel-body">
          <SlaTargetEditor
            draft={draft}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={handleCancel}
            saving={saving}
            scenarioNames={[]}
          />
        </div>
      )}
    </div>
  );
}

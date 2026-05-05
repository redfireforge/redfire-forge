import { useState, useMemo, useEffect } from 'react';
import type { Workflow } from '../../workflow/types/workflow';
import {
  getWorkflowRunConfigs,
  saveWorkflowRunConfig,
  updateWorkflowRunConfigLabel,
  deleteWorkflowRunConfig,
  formatConfigLabel,
  formatRelativeTime,
  type WorkflowRunConfig,
} from '../utils/workflowRunConfigStorage';

interface Props {
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  onWorkflowChange: (workflowId: string | null) => void;
  variables: Record<string, string>;
  onVariablesChange: (variables: Record<string, string>) => void;
  disabled?: boolean;
  /** Called when user clicks Run — saves config to history */
  onBeforeRun?: () => void;
}

export default function WorkflowPicker({
  workflows,
  selectedWorkflowId,
  onWorkflowChange,
  variables,
  onVariablesChange,
  disabled,
  onBeforeRun,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [history, setHistory] = useState<WorkflowRunConfig[]>([]);

  const selectedWorkflow = useMemo(
    () => workflows.find(w => w.id === selectedWorkflowId) ?? null,
    [workflows, selectedWorkflowId]
  );

  useEffect(() => {
    if (selectedWorkflowId) {
      setHistory(getWorkflowRunConfigs(selectedWorkflowId));
    } else {
      setHistory([]);
    }
  }, [selectedWorkflowId]);

  const httpNodeCount = useMemo(() => {
    if (!selectedWorkflow) return 0;
    return selectedWorkflow.nodes.filter(n => n.type === 'http').length;
  }, [selectedWorkflow]);

  const httpNodeNames = useMemo(() => {
    if (!selectedWorkflow) return [];
    return selectedWorkflow.nodes
      .filter(n => n.type === 'http')
      .map(n => (n.data as { label?: string })?.label || 'HTTP')
      .slice(0, 5);
  }, [selectedWorkflow]);

  const handleWorkflowSelect = (workflowId: string) => {
    const wf = workflows.find(w => w.id === workflowId);
    if (wf) {
      onWorkflowChange(workflowId);
      onVariablesChange({ ...wf.variables });
    }
  };

  const handleClearSelection = () => {
    onWorkflowChange(null);
    onVariablesChange({});
  };

  const handleRestoreConfig = (config: WorkflowRunConfig) => {
    onVariablesChange({ ...config.variables });
    setHistoryOpen(false);
  };

  const handleSaveCurrentToHistory = () => {
    if (!selectedWorkflowId) return;
    const saved = saveWorkflowRunConfig({
      workflowId: selectedWorkflowId,
      variables,
    });
    setHistory(getWorkflowRunConfigs(selectedWorkflowId));
    return saved;
  };

  const handleStartEditLabel = (config: WorkflowRunConfig) => {
    setEditingLabelId(config.id);
    setEditLabelValue(config.label || '');
  };

  const handleSaveLabel = () => {
    if (editingLabelId) {
      updateWorkflowRunConfigLabel(editingLabelId, editLabelValue);
      if (selectedWorkflowId) {
        setHistory(getWorkflowRunConfigs(selectedWorkflowId));
      }
    }
    setEditingLabelId(null);
    setEditLabelValue('');
  };

  const handleDeleteConfig = (configId: string) => {
    deleteWorkflowRunConfig(configId);
    if (selectedWorkflowId) {
      setHistory(getWorkflowRunConfigs(selectedWorkflowId));
    }
  };

  const handleResetToDefaults = () => {
    if (selectedWorkflow) {
      onVariablesChange({ ...selectedWorkflow.variables });
    }
  };

  useEffect(() => {
    if (onBeforeRun) {
      const originalOnBeforeRun = onBeforeRun;
      const wrappedOnBeforeRun = () => {
        handleSaveCurrentToHistory();
        originalOnBeforeRun();
      };
      return () => { wrappedOnBeforeRun; };
    }
  }, [onBeforeRun, selectedWorkflowId, variables]);

  const variableEntries = Object.entries(variables);
  const hasChanges = selectedWorkflow && JSON.stringify(variables) !== JSON.stringify(selectedWorkflow.variables);

  if (workflows.length === 0) {
    return (
      <div className="workflow-picker">
        <div className="workflow-picker-empty">
          <span className="empty-icon">⚡</span>
          <p>No workflows available</p>
          <p className="empty-hint">Create a workflow in the Workflow Designer first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-picker">
      <div className="workflow-picker-header">
        <label className="workflow-picker-label">Workflow</label>
        {selectedWorkflow && (
          <button
            type="button"
            className="btn btn-sm btn-link"
            onClick={handleClearSelection}
            disabled={disabled}
          >
            Clear
          </button>
        )}
      </div>

      <div className="workflow-picker-selector">
        <select
          className="workflow-picker-select"
          value={selectedWorkflowId || ''}
          onChange={(e) => e.target.value ? handleWorkflowSelect(e.target.value) : handleClearSelection()}
          disabled={disabled}
        >
          <option value="">Select a workflow...</option>
          {workflows.map(wf => (
            <option key={wf.id} value={wf.id}>
              {wf.name}
            </option>
          ))}
        </select>
      </div>

      {selectedWorkflow && (
        <>
          <div className="workflow-picker-summary">
            <span className="workflow-step-count">{httpNodeCount} HTTP step{httpNodeCount !== 1 ? 's' : ''}</span>
            {httpNodeNames.length > 0 && (
              <span className="workflow-step-names">
                {httpNodeNames.join(' → ')}
                {httpNodeCount > 5 && ' → ...'}
              </span>
            )}
          </div>

          <div className="workflow-vars-section">
            <div className="workflow-vars-header">
              <span className="var-panel-title">Initial Variables</span>
              <div className="workflow-vars-actions">
                {hasChanges && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link"
                    onClick={handleResetToDefaults}
                    disabled={disabled}
                    title="Reset to workflow defaults"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className={`btn btn-sm ${historyOpen ? 'btn-primary' : ''}`}
                  onClick={() => setHistoryOpen(!historyOpen)}
                  disabled={disabled}
                  title="View variable history"
                >
                  📜 History {history.length > 0 && `(${history.length})`}
                </button>
              </div>
            </div>

            {historyOpen && (
              <div className="workflow-history-panel">
                {history.length === 0 ? (
                  <p className="history-empty">No saved configurations yet. Run a test to save the current variables.</p>
                ) : (
                  <ul className="history-list">
                    {history.map(config => (
                      <li key={config.id} className="history-item">
                        {editingLabelId === config.id ? (
                          <div className="history-edit-row">
                            <input
                              type="text"
                              value={editLabelValue}
                              onChange={(e) => setEditLabelValue(e.target.value)}
                              placeholder="Enter label..."
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLabel();
                                if (e.key === 'Escape') setEditingLabelId(null);
                              }}
                            />
                            <button className="btn btn-sm" onClick={handleSaveLabel}>Save</button>
                            <button className="btn btn-sm" onClick={() => setEditingLabelId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <div className="history-item-info" onClick={() => handleRestoreConfig(config)}>
                              <span className="history-label">{formatConfigLabel(config)}</span>
                              <span className="history-time">{formatRelativeTime(config.usedAt)}</span>
                            </div>
                            <div className="history-item-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-link"
                                onClick={() => handleStartEditLabel(config)}
                                title="Edit label"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-link btn-danger"
                                onClick={() => handleDeleteConfig(config.id)}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <p className="extraction-hint" style={{ marginBottom: 6 }}>
              Variables available to all steps via <code>{'{{name}}'}</code>.
              {hasChanges && <span className="vars-modified-badge"> (modified)</span>}
            </p>

            {variableEntries.length > 0 ? (
              <div className="wf-vars-list">
                {variableEntries.map(([key, value]) => (
                  <div key={key} className="wf-var-row">
                    <span className="extraction-brace">{'{{'}</span>
                    <span className="wf-var-key">{key}</span>
                    <span className="extraction-brace">{'}}'}</span>
                    <span className="var-chip-eq">=</span>
                    <input
                      className="wf-var-value-input"
                      value={value}
                      onChange={(e) => onVariablesChange({ ...variables, [key]: e.target.value })}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-vars-hint">This workflow has no defined variables.</p>
            )}
          </div>
        </>
      )}

      {!selectedWorkflow && (
        <p className="workflow-picker-hint">
          Select a workflow above to run it as a performance test with full graph topology (conditions, forks, joins, loops).
        </p>
      )}
    </div>
  );
}

export { saveWorkflowRunConfig };

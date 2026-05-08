import { useState, useMemo, useEffect } from 'react';
import type { Workflow } from '../../workflow/types/workflow';
import {
  getWorkflowRunConfigs,
  saveWorkflowRunConfigManually,
  updateWorkflowRunConfigLabel,
  deleteWorkflowRunConfig,
  formatRelativeTime,
  type WorkflowRunConfig,
} from '../utils/workflowRunConfigStorage';
import { sampleWorkflowCatalog } from '../../../data/galleries/workflows';

interface Props {
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  onWorkflowChange: (workflowId: string | null) => void;
  variables: Record<string, string>;
  onVariablesChange: (variables: Record<string, string>) => void;
  disabled?: boolean;
  onImportSample?: (workflow: Workflow) => void;
}

const PERF_SAMPLE_IDS = ['perf-workflow-simple', 'perf-workflow-branching', 'perf-workflow-parallel'];

export default function WorkflowPicker({
  workflows,
  selectedWorkflowId,
  onWorkflowChange,
  variables,
  onVariablesChange,
  disabled,
  onImportSample,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [history, setHistory] = useState<WorkflowRunConfig[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

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

  const handleSavePreset = () => {
    if (!selectedWorkflowId) return;
    saveWorkflowRunConfigManually(selectedWorkflowId, variables, newPresetName);
    setHistory(getWorkflowRunConfigs(selectedWorkflowId));
    setNewPresetName('');
    setSavingPreset(false);
  };

  const handleResetToDefaults = () => {
    if (selectedWorkflow) {
      onVariablesChange({ ...selectedWorkflow.variables });
    }
  };

  const variableEntries = Object.entries(variables);
  const hasChanges = selectedWorkflow && JSON.stringify(variables) !== JSON.stringify(selectedWorkflow.variables);

  const perfSamples = useMemo(() =>
    sampleWorkflowCatalog.filter(s => PERF_SAMPLE_IDS.includes(s.id)),
    []
  );

  const alreadyImportedIds = useMemo(() => {
    const names = new Set(workflows.map(w => w.name));
    return new Set(perfSamples.filter(s => names.has(s.name)).map(s => s.id));
  }, [workflows, perfSamples]);

  const handleImportSample = (sampleId: string) => {
    if (!onImportSample) return;
    const entry = perfSamples.find(s => s.id === sampleId);
    if (!entry?.factory) return;
    const existingWf = workflows.find(w => w.name === entry.name);
    const wf = entry.factory();
    if (existingWf) {
      wf.id = existingWf.id;
    }
    onImportSample(wf);
  };

  if (workflows.length === 0) {
    return (
      <div className="workflow-picker">
        <div className="workflow-picker-empty">
          <span className="empty-icon">⚡</span>
          <p>No workflows available</p>
          <p className="empty-hint">Create a workflow in the Workflow Designer, or try a sample below.</p>
        </div>
        {onImportSample && perfSamples.length > 0 && (
          <div className="workflow-picker-samples">
            <span className="samples-label">Quick Start — Performance Samples</span>
            <div className="samples-grid">
              {perfSamples.map(sample => (
                <button
                  key={sample.id}
                  className="sample-card"
                  onClick={() => handleImportSample(sample.id)}
                  disabled={disabled}
                >
                  <span className="sample-icon">{sample.icon}</span>
                  <span className="sample-name">{sample.name}</span>
                  <span className="sample-desc">{sample.description}</span>
                  <span className="sample-meta">{sample.nodeCount} nodes · {sample.difficulty}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
          data-testid="workflow-select"
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
                  className="btn btn-sm"
                  onClick={() => { setSavingPreset(true); setHistoryOpen(true); }}
                  disabled={disabled}
                  title="Save the current variable values as a named preset"
                >
                  💾 Save preset
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${historyOpen ? 'btn-primary' : ''}`}
                  onClick={() => { setHistoryOpen(!historyOpen); setSavingPreset(false); }}
                  disabled={disabled}
                  title="View and restore saved variable presets"
                >
                  📋 Presets {history.length > 0 && `(${history.length})`}
                </button>
              </div>
            </div>

            {historyOpen && (
              <div className="workflow-history-panel">
                {/* Save new preset form */}
                {savingPreset ? (
                  <div className="history-save-form">
                    <span className="history-save-label">Name this preset</span>
                    <input
                      type="text"
                      className="history-save-input"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="e.g. Staging config, Prod test..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePreset();
                        if (e.key === 'Escape') { setSavingPreset(false); setNewPresetName(''); }
                      }}
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleSavePreset}>Save</button>
                    <button className="btn btn-sm" onClick={() => { setSavingPreset(false); setNewPresetName(''); }}>Cancel</button>
                  </div>
                ) : (
                  <p className="history-panel-hint">
                    Saved variable presets. Click <strong>Restore</strong> to apply a preset's values.
                  </p>
                )}

                {history.length === 0 ? (
                  <p className="history-empty">No presets yet. Use <strong>Save preset</strong> or run a workflow to save values.</p>
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
                              placeholder="Give this run a name..."
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLabel();
                                if (e.key === 'Escape') setEditingLabelId(null);
                              }}
                            />
                            <button className="btn btn-sm btn-primary" onClick={handleSaveLabel}>Save</button>
                            <button className="btn btn-sm" onClick={() => setEditingLabelId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <div className="history-item-info">
                              <div className="history-item-header">
                                <span className="history-label">{config.label || 'Unnamed preset'}</span>
                                <span className="history-time">{formatRelativeTime(config.usedAt)}</span>
                              </div>
                              <div className="history-item-vars">
                                {Object.entries(config.variables).map(([k, v]) => (
                                  <span key={k} className="history-var-row">
                                    <span className="history-var-key">{k}</span>
                                    <span className="history-var-eq">=</span>
                                    <span className="history-var-val">{v || <em>empty</em>}</span>
                                  </span>
                                ))}
                                {Object.keys(config.variables).length === 0 && (
                                  <span className="history-var-empty">No variables</span>
                                )}
                              </div>
                            </div>
                            <div className="history-item-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => handleRestoreConfig(config)}
                                title="Restore these variable values"
                              >
                                ↩ Restore
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-link"
                                onClick={() => handleStartEditLabel(config)}
                                title="Rename this entry"
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
        <>
          <p className="workflow-picker-hint">
            Select a workflow above to run it as a performance test with full graph topology (conditions, forks, joins, loops).
          </p>
          {perfSamples.length > 0 && (
            <div className="workflow-picker-samples compact">
              <span className="samples-label">Quick Start — Performance Samples</span>
              <div className="samples-inline">
                {perfSamples.map(sample => {
                  const imported = alreadyImportedIds.has(sample.id);
                  return (
                    <button
                      key={sample.id}
                      className={`sample-chip ${imported ? 'imported' : ''}`}
                      onClick={() => handleImportSample(sample.id)}
                      disabled={disabled}
                      title={imported ? `Update & select "${sample.name}"` : sample.description}
                    >
                      {sample.icon} {sample.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


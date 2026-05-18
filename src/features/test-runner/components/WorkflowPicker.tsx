import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Workflow, WorkflowFolder } from '../../workflow/types/workflow';
import { getFolderPath, buildFolderTree, getUnfiledWorkflows, countNodeWorkflows } from '../../workflow/utils/workflowFolderTree';
import type { FolderTreeNode } from '../../workflow/utils/workflowFolderTree';
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
  folders?: WorkflowFolder[];
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
  folders = [],
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [navFolderId, setNavFolderId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const folderTree = useMemo(() =>
    folders.length > 0 ? buildFolderTree(folders, workflows) : [],
    [folders, workflows],
  );

  const unfiledWfs = useMemo(() =>
    folders.length > 0 ? getUnfiledWorkflows(folders, workflows) : workflows,
    [folders, workflows],
  );

  const currentNavNode = useMemo((): FolderTreeNode | null => {
    if (!navFolderId) return null;
    const find = (nodes: FolderTreeNode[]): FolderTreeNode | null => {
      for (const n of nodes) {
        if (n.folder.id === navFolderId) return n;
        const found = find(n.children);
        if (found) return found;
      }
      return null;
    };
    return find(folderTree);
  }, [navFolderId, folderTree]);

  const navBreadcrumb = useMemo(() => {
    if (!navFolderId) return [];
    return getFolderPath(navFolderId, folders).split(' / ');
  }, [navFolderId, folders]);

  const wfpSearchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    return workflows
      .filter((wf) => wf.name.toLowerCase().includes(q))
      .map((wf) => ({
        workflow: wf,
        breadcrumb: wf.folderId && folders.length > 0 ? getFolderPath(wf.folderId, folders) : '',
      }));
  }, [searchQuery, workflows, folders]);

  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery('');
        setNavFolderId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleWorkflowSelect = useCallback((workflowId: string) => {
    const wf = workflows.find(w => w.id === workflowId);
    if (wf) {
      onWorkflowChange(workflowId);
      onVariablesChange({ ...wf.variables });
      setDropdownOpen(false);
      setSearchQuery('');
      setNavFolderId(null);
    }
  }, [workflows, onWorkflowChange, onVariablesChange]);

  const handleClearSelection = () => {
    onWorkflowChange(null);
    onVariablesChange({});
    setSearchQuery('');
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="wfp-search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
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

      <div className="workflow-picker-selector" ref={dropdownRef}>
        <button
          type="button"
          className={`wfp-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
          data-testid="workflow-select"
          onClick={() => !disabled && setDropdownOpen((v) => !v)}
          disabled={disabled}
        >
          <span className="wfp-dropdown-text">
            {selectedWorkflow ? selectedWorkflow.name : 'Select a workflow…'}
          </span>
          <span className="wfp-dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
        </button>
        {dropdownOpen && (
          <div className="wfp-dropdown-panel">
            <div className="wfp-dropdown-search">
              <input
                ref={searchInputRef}
                type="text"
                className="wfp-dropdown-search-input"
                placeholder="Search workflows…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setNavFolderId(null); }}
                data-testid="wfp-search-input"
              />
              {searchQuery && (
                <button
                  className="wfp-dropdown-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >×</button>
              )}
            </div>

            {navFolderId && !wfpSearchResults && (
              <div className="wft-dropdown-breadcrumb">
                <button
                  type="button"
                  className="wft-breadcrumb-back"
                  onClick={() => {
                    const parentFolder = folders.find((f) => f.id === navFolderId);
                    setNavFolderId(parentFolder?.parentId ?? null);
                  }}
                >←</button>
                <span className="wft-breadcrumb-root" onClick={() => setNavFolderId(null)}>All</span>
                {navBreadcrumb.map((seg, i) => (
                  <span key={i}>
                    <span className="wft-breadcrumb-sep">/</span>
                    {i === navBreadcrumb.length - 1
                      ? <span className="wft-breadcrumb-current">{seg}</span>
                      : <span className="wft-breadcrumb-seg">{seg}</span>}
                  </span>
                ))}
              </div>
            )}

            <div className="wfp-dropdown-list">
              {wfpSearchResults ? (
                wfpSearchResults.length === 0 ? (
                  <div className="wfp-dropdown-empty">No workflows match "{searchQuery}"</div>
                ) : (
                  wfpSearchResults.map(({ workflow: wf, breadcrumb }) => (
                    <button
                      key={wf.id}
                      type="button"
                      className={`wfp-dropdown-item wft-dropdown-item-search ${wf.id === selectedWorkflowId ? 'active' : ''}`}
                      onClick={() => handleWorkflowSelect(wf.id)}
                    >
                      <span className="wft-item-name">{highlightMatch(wf.name, searchQuery.trim())}</span>
                      {breadcrumb && <span className="wft-item-breadcrumb">{breadcrumb}</span>}
                    </button>
                  ))
                )
              ) : navFolderId && currentNavNode ? (
                <>
                  {currentNavNode.children.map((child) => (
                    <button
                      key={child.folder.id}
                      type="button"
                      className="wft-dropdown-folder"
                      onClick={() => setNavFolderId(child.folder.id)}
                    >
                      <span className="wft-folder-icon">📁</span>
                      <span className="wft-folder-name">{child.folder.name}</span>
                      <span className="wft-folder-count">({countNodeWorkflows(child)})</span>
                      <span className="wft-folder-arrow">›</span>
                    </button>
                  ))}
                  {currentNavNode.workflows.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      className={`wfp-dropdown-item ${wf.id === selectedWorkflowId ? 'active' : ''}`}
                      onClick={() => handleWorkflowSelect(wf.id)}
                    >
                      {wf.name}
                    </button>
                  ))}
                  {currentNavNode.children.length === 0 && currentNavNode.workflows.length === 0 && (
                    <div className="wfp-dropdown-empty">Empty folder</div>
                  )}
                </>
              ) : (
                <>
                  {folderTree.map((node) => (
                    <button
                      key={node.folder.id}
                      type="button"
                      className="wft-dropdown-folder"
                      onClick={() => setNavFolderId(node.folder.id)}
                    >
                      <span className="wft-folder-icon">📁</span>
                      <span className="wft-folder-name">{node.folder.name}</span>
                      <span className="wft-folder-count">({countNodeWorkflows(node)})</span>
                      <span className="wft-folder-arrow">›</span>
                    </button>
                  ))}
                  {unfiledWfs.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      className={`wfp-dropdown-item ${wf.id === selectedWorkflowId ? 'active' : ''}`}
                      onClick={() => handleWorkflowSelect(wf.id)}
                    >
                      {wf.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
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


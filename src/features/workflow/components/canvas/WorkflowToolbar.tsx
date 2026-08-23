import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { Environment } from '@shared/types';
import type { Workflow, WorkflowFolder, WorkflowService } from '../../types/workflow';
import { checkAllEnvReadiness } from '../../utils/workflowEnvReadiness';
import { buildFolderTree, getFolderPath, getUnfiledWorkflows, countNodeWorkflows } from '../../utils/workflowFolderTree';
import type { FolderTreeNode } from '../../utils/workflowFolderTree';
import { highlightSearchMatch } from '@shared/utils/consoleLogUtils';
import { CustomSelect } from '@shared/components/CustomSelect';

export interface RunProgress {
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
  lastRunStatus?: 'idle' | 'running' | 'pass' | 'fail' | 'stopped';
}

interface Props {
  workflows: Workflow[];
  selected: Workflow | null;
  isRunning: boolean;
  /** Brief confirmation after Save persisted (cleared by parent). */
  saveAcknowledged?: boolean;
  /** Number of services configured in the Service Registry. */
  serviceCount?: number;
  /** Number of workflow-level default variables. */
  variableCount?: number;
  /** Number of saved version snapshots. */
  versionCount?: number;
  /** Workflow folders for grouped display in the selector. */
  folders?: WorkflowFolder[];
  environments?: Environment[];
  selectedEnvId?: string;
  onEnvSelect?: (id: string) => void;
  workflowServices?: WorkflowService[];
  isPreview?: boolean;
  onSelect: (id: string) => void;
  onSave: () => void;
  onQuickTest: () => void;
  onDebugTest?: () => void;
  isDebugMode?: boolean;
  onOpenServices?: () => void;
  onOpenDefaults?: () => void;
  onOpenVersions?: () => void;
  runProgress?: RunProgress | null;
  onReset?: () => void;
  /** Navigate to Workflow Runner with this workflow pre-selected for load testing. */
  onRunInHarness?: () => void;
}

export default function WorkflowToolbar({
  workflows, selected, isRunning, saveAcknowledged, serviceCount = 0, variableCount = 0, versionCount = 0,
  folders = [], environments = [], selectedEnvId = '', onEnvSelect, workflowServices = [], isPreview = false,
  onSelect, onSave, onQuickTest, onDebugTest, isDebugMode, onOpenServices, onOpenDefaults, onOpenVersions,
  runProgress = null, onReset, onRunInHarness,
}: Props) {
  const [wfDropdownOpen, setWfDropdownOpen] = useState(false);
  const [wfSearch, setWfSearch] = useState('');
  const [navFolderId, setNavFolderId] = useState<string | null>(null);
  const wfDropdownRef = useRef<HTMLDivElement>(null);
  const wfSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wfDropdownOpen && wfSearchInputRef.current) wfSearchInputRef.current.focus();
  }, [wfDropdownOpen]);

  useEffect(() => {
    if (!wfDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (wfDropdownRef.current && !wfDropdownRef.current.contains(e.target as Node)) {
        setWfDropdownOpen(false);
        setWfSearch('');
        setNavFolderId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [wfDropdownOpen]);

  const handleWfSelect = useCallback((id: string) => {
    onSelect(id);
    setWfDropdownOpen(false);
    setWfSearch('');
    setNavFolderId(null);
  }, [onSelect]);

  const folderTree = useMemo(() =>
    folders.length > 0 ? buildFolderTree(folders, workflows) : [],
    [folders, workflows],
  );

  const unfiledWorkflows = useMemo(() =>
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

  const searchResults = useMemo(() => {
    const q = wfSearch.toLowerCase().trim();
    if (!q) return null;
    return workflows
      .filter((wf) => wf.name.toLowerCase().includes(q))
      .map((wf) => ({
        workflow: wf,
        breadcrumb: wf.folderId && folders.length > 0 ? getFolderPath(wf.folderId, folders) : '',
      }));
  }, [wfSearch, workflows, folders]);


  const highlightMatch = useCallback((text: string, query: string) => {
    return highlightSearchMatch(text, query, 'wft-search-highlight');
  }, []);

  const envReadinessMap = useMemo(
    () => workflowServices.length > 0
      ? checkAllEnvReadiness(environments.map((e) => e.id), workflowServices)
      : new Map(),
    [environments, workflowServices],
  );

  const currentReadiness = selectedEnvId ? envReadinessMap.get(selectedEnvId) : undefined;

  return (
    <div className="wf-toolbar">
      <div className="wf-toolbar-left">
        {(workflows.length > 0 || isPreview) && (
          <div className="wft-dropdown-wrap" ref={wfDropdownRef}>
            <button
              type="button"
              className={`wft-dropdown-trigger ${wfDropdownOpen ? 'open' : ''}`}
              onClick={() => !isRunning && setWfDropdownOpen((v) => !v)}
              disabled={isRunning}
              data-testid="wf-toolbar-select"
            >
              <span className="wft-dropdown-text">
                {selected ? selected.name : 'Open workflow…'}
              </span>
              <span className="wft-dropdown-arrow">{wfDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {wfDropdownOpen && (
              <>
              <div className="wft-dropdown-backdrop" onClick={() => { setWfDropdownOpen(false); setWfSearch(''); setNavFolderId(null); }} />
              <div className="wft-dropdown-panel">
                <div className="wft-dropdown-search">
                  <input
                    ref={wfSearchInputRef}
                    type="text"
                    className="wft-dropdown-search-input"
                    placeholder="Search workflows…"
                    value={wfSearch}
                    onChange={(e) => { setWfSearch(e.target.value); setNavFolderId(null); }}
                  />
                  {wfSearch && (
                    <button className="wft-dropdown-search-clear" onClick={() => setWfSearch('')}>×</button>
                  )}
                </div>

                {/* Breadcrumb nav when inside a folder */}
                {navFolderId && !searchResults && (
                  <div className="wft-dropdown-breadcrumb">
                    <button
                      type="button"
                      className="wft-breadcrumb-back"
                      onClick={() => {
                        const parentFolder = folders.find((f) => f.id === navFolderId);
                        setNavFolderId(parentFolder?.parentId ?? null);
                      }}
                    >
                      ←
                    </button>
                    <span
                      className="wft-breadcrumb-root"
                      onClick={() => setNavFolderId(null)}
                    >
                      All
                    </span>
                    {navBreadcrumb.map((seg, i) => {
                      const isLast = i === navBreadcrumb.length - 1;
                      return (
                        <span key={i}>
                          <span className="wft-breadcrumb-sep">/</span>
                          {isLast ? (
                            <span className="wft-breadcrumb-current">{seg}</span>
                          ) : (
                            <span className="wft-breadcrumb-seg">{seg}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="wft-dropdown-list">
                  {searchResults ? (
                    /* Search mode: flat results with breadcrumb hints */
                    searchResults.length === 0 ? (
                      <div className="wft-dropdown-empty">No workflows match &quot;{wfSearch}&quot;</div>
                    ) : (
                      searchResults.map(({ workflow: wf, breadcrumb }) => (
                        <button
                          key={wf.id}
                          type="button"
                          className={`wft-dropdown-item wft-dropdown-item-search ${wf.id === selected?.id ? 'active' : ''}`}
                          onClick={() => handleWfSelect(wf.id)}
                        >
                          <span className="wft-item-name">{highlightMatch(wf.name, wfSearch.trim())}</span>
                          {breadcrumb && <span className="wft-item-breadcrumb">{breadcrumb}</span>}
                        </button>
                      ))
                    )
                  ) : navFolderId && currentNavNode ? (
                    /* Inside a folder: show sub-folders then workflows */
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
                          className={`wft-dropdown-item ${wf.id === selected?.id ? 'active' : ''}`}
                          onClick={() => handleWfSelect(wf.id)}
                        >
                          {wf.name}
                        </button>
                      ))}
                      {currentNavNode.children.length === 0 && currentNavNode.workflows.length === 0 && (
                        <div className="wft-dropdown-empty">Empty folder</div>
                      )}
                    </>
                  ) : (
                    /* Root level: show root folders, then unfiled workflows */
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
                      {unfiledWorkflows.map((wf) => (
                        <button
                          key={wf.id}
                          type="button"
                          className={`wft-dropdown-item ${wf.id === selected?.id ? 'active' : ''}`}
                          onClick={() => handleWfSelect(wf.id)}
                        >
                          {wf.name}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {selected && (
          <>
            <span className="wf-toolbar-divider" />

            <button
              data-testid="wf-toolbar-services-btn"
              className="btn btn-sm wf-toolbar-btn wf-toolbar-services-btn"
              onClick={onOpenServices}
              disabled={isRunning}
              title="Manage external service hostnames and auth for this workflow"
            >
              <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Services
              {serviceCount > 0 && <span className="wf-toolbar-services-badge">{serviceCount}</span>}
            </button>

            <button
              data-testid="wf-toolbar-variables-btn"
              className="btn btn-sm wf-toolbar-btn wf-toolbar-variables-btn"
              onClick={onOpenDefaults}
              disabled={isRunning}
              title="Manage workflow-level default variables"
            >
              <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Variables
              {variableCount > 0 && <span className="wf-toolbar-services-badge">{variableCount}</span>}
            </button>

            <button
              className="btn btn-sm wf-toolbar-btn wf-toolbar-versions-btn"
              onClick={onOpenVersions}
              disabled={isRunning}
              title="View and manage workflow version history"
            >
              <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Versions
              {versionCount > 0 && <span className="wf-toolbar-services-badge">{versionCount}</span>}
            </button>

            {!isPreview && onRunInHarness && (
              <button
                className="btn btn-sm wf-toolbar-btn wf-toolbar-harness-btn"
                onClick={onRunInHarness}
                disabled={isRunning}
                title="Run this workflow under load in the Workflow Runner"
              >
                <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                Run in Harness
              </button>
            )}

            {!isPreview && (
              <span className="wf-toolbar-env-wrap">
                <CustomSelect
                  className="wf-toolbar-env-select"
                  value={selectedEnvId}
                  onChange={(v) => onEnvSelect?.(v)}
                  disabled={isRunning}
                  size="sm"
                  placeholder="Env…"
                  options={environments.map((e) => {
                    const r = envReadinessMap.get(e.id);
                    const warn = r && !r.ready ? ` ! ${r.issues.length} missing` : '';
                    return { value: e.id, label: `${e.name}${warn}` };
                  })}
                  aria-label="Select target environment for Quick Test"
                />
                {currentReadiness && !currentReadiness.ready && (
                  <span
                    className="wf-toolbar-env-warn"
                    title={`Missing config: ${currentReadiness.issues.map((i: { serviceName: string }) => i.serviceName).join(', ')}`}
                  ><svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                )}
              </span>
            )}

            <span className="wf-toolbar-divider" />

            <span className="wf-toolbar-save-wrap">
              <button className="btn btn-sm" onClick={onSave} disabled={isRunning || isPreview} title={isPreview ? "Preview mode - click 'Use as Template' to save" : "Save canvas and variables to this workflow"}>
                <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save
              </button>
              {saveAcknowledged && (
                <span className="wf-toolbar-saved-msg" role="status">
                  Saved
                </span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="wf-toolbar-right">
        {selected && (
          <>
            <button
              className={`btn btn-sm wf-quick-test-btn ${isRunning && !isDebugMode ? 'btn-danger' : 'btn-primary'}`}
              onClick={onQuickTest}
            >
              {isRunning && !isDebugMode ? (
                <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop</>
              ) : (
                <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Quick Test</>
              )}
            </button>
            {onDebugTest && (
              <button
                className={`btn btn-sm ${isRunning && isDebugMode ? 'btn-danger' : 'btn-outline'}`}
                onClick={onDebugTest}
                title="Run workflow step-by-step"
              >
                {isRunning && isDebugMode ? (
                  <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop Debug</>
                ) : (
                  <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Debug</>
                )}
              </button>
            )}

            {runProgress && runProgress.lastRunStatus === 'running' && (
              <span className="wf-run-progress wf-run-progress-running">
                <span className="wf-spinner" />
                Step {runProgress.completed}/{runProgress.total} · {(runProgress.elapsedMs / 1000).toFixed(1)}s
                <span className="wf-run-progress-bar-wrap">
                  <span className="wf-run-progress-bar wf-run-progress-bar-running" style={{ width: `${runProgress.total > 0 ? (runProgress.completed / runProgress.total) * 100 : 0}%` }} />
                </span>
              </span>
            )}
            {runProgress && runProgress.lastRunStatus === 'pass' && (
              <span className="wf-run-progress wf-run-progress-pass">
                <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> {runProgress.completed}/{runProgress.total} passed · {(runProgress.elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
            {runProgress && runProgress.lastRunStatus === 'fail' && (
              <span className="wf-run-progress wf-run-progress-fail">
                <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> {runProgress.completed - runProgress.failed}/{runProgress.total}{runProgress.failed > 0 ? ` · ${runProgress.failed} failed` : ''} · {(runProgress.elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
            {runProgress && runProgress.lastRunStatus === 'stopped' && (
              <span className="wf-run-progress wf-run-progress-stopped">
                <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stopped by user · {runProgress.completed}/{runProgress.total} completed · {(runProgress.elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
            {runProgress && !isRunning && (runProgress.lastRunStatus === 'pass' || runProgress.lastRunStatus === 'fail' || runProgress.lastRunStatus === 'stopped') && onReset && (
              <button
                className="btn btn-sm btn-ghost wf-toolbar-reset-btn"
                onClick={onReset}
                title="Clear previous run status from all nodes"
              >
                <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Clear
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

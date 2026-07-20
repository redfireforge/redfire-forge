import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ScriptNodeData, ScriptMode } from '../../types/workflow';
import InsertVarField from '../expression/InsertVarField';
import ScriptCodeEditor from './ScriptCodeEditor';
import ScriptTestResult from './ScriptTestResult';
import { SCRIPT_MODE_OPTIONS, useScriptTest } from './useScriptTest';
import WorkflowEditorModalFrame from '../modals/WorkflowEditorModalFrame';
import JsonPreview, { buildJTree, collectJTreePaths } from '../../../requests/components/JsonTreePreview';
import type { JNode } from '../../../requests/components/JsonTreePreview';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { useSplitterDrag } from '../../../../shared/hooks/useSplitterDrag';
import { prettyJson, isValidJson } from '../../../../shared/utils/helpers';
import { SearchMatchBar } from '../../../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../../../shared/hooks/useSearchMatchNavigation';
import { useJsonTreeCollapseState } from '../../../../shared/hooks/useJsonTreeCollapseState';

const collectAllPaths = collectJTreePaths;

/* ── Test Value Panel — right-side inline panel ── */
function TestValuePanel({ varName, initialValue, onApply, onClose, style }: {
  varName: string;
  initialValue: string;
  onApply: (value: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState(initialValue);
  const handleChange = useCallback((val: string) => {
    setDraft(val);
    onApply(val);
  }, [onApply]);
  const [viewMode, setViewMode] = useState<'text' | 'tree'>(() => (isValidJson(initialValue) ? 'tree' : 'text'));
  const [searchTerm, setSearchTermState] = useState('');
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const { collapsedSet, handleTreeToggle: handleToggle, handleCollapseAll: collapseAll, handleExpandAll } = useJsonTreeCollapseState();
  const debouncedSearch = useDebounce(searchTerm, 200);

  const isPretty = draft.includes('\n');

  const tryPretty = prettyJson;
  const tryMinify = (text: string): string => {
    try { return JSON.stringify(JSON.parse(text)); } catch { return text; }
  };

  const draftIsValidJson = useMemo(() => isValidJson(draft), [draft]);

  const jTree = useMemo((): JNode | null => {
    if (viewMode !== 'tree') return null;
    try { return buildJTree(JSON.parse(draft), ''); } catch { return null; }
  }, [draft, viewMode]);

  const allPaths = useMemo(() => (jTree ? collectAllPaths(jTree, '') : []), [jTree]);
  const handleCollapseAll = useCallback(() => collapseAll(new Set(allPaths)), [allPaths, collapseAll]);

  const handleTreeMatchCountChange = useCallback((count: number) => {
    setSearchMatchCount(count);
  }, []);

  const textMatchCount = useMemo(() => {
    if (viewMode !== 'text' || !debouncedSearch.trim()) return 0;
    try {
      const re = new RegExp(debouncedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return (draft.match(re) ?? []).length;
    } catch { return 0; }
  }, [draft, debouncedSearch, viewMode]);

  const effectiveCount = viewMode === 'tree' ? searchMatchCount : textMatchCount;

  const {
    currentMatchIndex: searchMatchIdx,
    setCurrentMatchIndex: setSearchMatchIdx,
    goNext,
    goPrev,
    clear: clearSearchNav,
  } = useSearchMatchNavigation(effectiveCount);

  const setSearchTerm = useCallback((value: string) => {
    setSearchTermState(value);
    setSearchMatchIdx(0);
  }, [setSearchMatchIdx]);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    clearSearchNav();
  }, [clearSearchNav]);

  return (
    <div className="wf-script-value-panel" style={style}>
      {/* Header */}
      <div className="wf-script-value-panel-header">
        <code className="wf-script-value-popup-name">{varName}</code>

        <SearchMatchBar
          value={searchTerm}
          onChange={setSearchTerm}
          currentMatch={searchMatchIdx + 1}
          totalMatches={effectiveCount}
          onPrev={goPrev}
          onNext={goNext}
          onClear={clearSearch}
          inputType="search"
          placeholder="Search…"
          inputClassName="results-search wf-resp-search-input wf-script-value-popup-search"
          countClassName="wf-resp-search-count"
          navClassName="wf-resp-search-nav"
          controlsVisible={!!debouncedSearch.trim()}
          hideClear
          navStyle="text"
          onKeyDown={(e) => {
            if (e.key === 'Escape') clearSearch();
            if (e.key === 'Enter' && effectiveCount > 0) {
              e.preventDefault();
              if (e.shiftKey) goPrev();
              else goNext();
            }
          }}
        />

        {viewMode === 'tree' && jTree && (
          <>
            <button type="button" className="jt-expand-collapse-btn" onClick={handleExpandAll}>Expand All</button>
            <button type="button" className="jt-expand-collapse-btn" onClick={handleCollapseAll}>Collapse All</button>
          </>
        )}

        <div className="wf-script-value-popup-actions">
          {draftIsValidJson && (
            <button
              className="wf-config-add-btn"
              title={viewMode === 'tree' ? 'Switch to text editor' : 'Switch to tree view'}
              onClick={() => setViewMode(prev => prev === 'tree' ? 'text' : 'tree')}
            >
              {viewMode === 'tree' ? '✎' : '🌳'}
            </button>
          )}
          <button
            className="wf-config-add-btn"
            title={isPretty ? 'Minify JSON (remove whitespace)' : 'Pretty Format JSON'}
            onClick={() => handleChange(isPretty ? tryMinify(draft) : tryPretty(draft))}
          >
            {isPretty ? '{ }' : '{ … }'}
          </button>
        </div>
      </div>

      {/* Body */}
      {viewMode === 'tree' && jTree ? (
        <div className="wf-script-value-panel-body">
          {/* Isolated scroll container — nested flex + req-json-preview-wrapper rules otherwise prevent vertical scroll */}
          <div className="wf-script-value-panel-json-scroll">
            <JsonPreview
              body={draft}
              search={debouncedSearch}
              currentMatchIdx={searchMatchIdx}
              onMatchCountChange={handleTreeMatchCountChange}
              collapsedSet={collapsedSet}
              onToggle={handleToggle}
              prebuiltTree={jTree}
            />
          </div>
        </div>
      ) : (
        <textarea
          className="wf-script-value-panel-editor"
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
        />
      )}

      <div className="wf-script-value-panel-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

interface Props {
  data: ScriptNodeData;
  onSave: (updated: ScriptNodeData) => void;
  onClose: () => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  /** Workflow variable snapshot — used to pre-populate test values from last run / current scope. */
  workflowVariables?: Record<string, string>;
}

export default function ScriptCodeModal({ data: initialData, onSave, onClose, onRequestVariableInsert, workflowVariables = {} }: Props) {
  const [data, setData] = useState<ScriptNodeData>({ ...initialData });
  const {
    testResult, mockInputs, setMockInputs,
    inferredDefaults, complexityWarnings,
    handleTestScript, handleAutoDetect,
  } = useScriptTest(data, workflowVariables);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [valuePanelWidth, setValuePanelWidth] = useState(400);
  const [valuePopup, setValuePopup] = useState<{ varName: string; draft: string } | null>(null);

  const handleSplitterMouseDown = useSplitterDrag(sidebarWidth, setSidebarWidth, 200, 700);
  const handlePanelSplitterMouseDown = useSplitterDrag(valuePanelWidth, setValuePanelWidth, 250, 900);

  const handleCodeChange = useCallback((code: string) => {
    setData(prev => ({ ...prev, code }));
  }, []);

  const handleAutoDetectOutputs = useCallback(() => {
    const detected = handleAutoDetect();
    if (detected.length > 0) {
      setData(prev => ({ ...prev, outputVariables: detected }));
    }
  }, [handleAutoDetect]);

  const handleSave = () => {
    onSave(data);
    onClose();
  };

  const hasChanges = data.code !== initialData.code
    || data.mode !== initialData.mode
    || JSON.stringify(data.inputVariables) !== JSON.stringify(initialData.inputVariables)
    || JSON.stringify(data.outputVariables) !== JSON.stringify(initialData.outputVariables);

  return createPortal(
    <WorkflowEditorModalFrame
      title={<span id="wf-script-editor-title">SCRIPT EDITOR — {data.label || 'Untitled'}</span>}
      titleId="wf-script-editor-title"
      onClose={onClose}
      overlayClassName="wf-script-modal-overlay"
      dialogClassName="wf-config-modal wf-script-modal"
      bodyScrollable={false}
      expandMode="fullscreen"
      forceExpanded={!!valuePopup}
      headerActions={
        <select
          className="wf-script-modal-mode-select"
          value={data.mode}
          onChange={(e) => setData(prev => ({ ...prev, mode: e.target.value as ScriptMode }))}
          title="Script mode"
        >
          {SCRIPT_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      }
      footer={
        <>
          {hasChanges && <span className="wf-script-modal-unsaved"><svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> Unsaved changes</span>}
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
        </>
      }
    >
      <div className="wf-script-modal-layout">
        {/* ── Left: Code Editor ── */}
        <div className="wf-script-modal-editor">
          {complexityWarnings.length > 0 && (
            <div className="wf-script-warnings" style={{ marginBottom: 6 }}>
              {complexityWarnings.map((w, i) => (
                <div key={i} className="wf-script-warning"><svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {w}</div>
              ))}
            </div>
          )}
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            onInsert={(snippet) => setData(prev => ({ ...prev, code: prev.code + snippet }))}
          >
            <ScriptCodeEditor
              value={data.code}
              onChange={handleCodeChange}
              inputVariables={data.inputVariables}
              outputVariables={data.outputVariables}
              height="calc(85vh - 110px)"
            />
          </InsertVarField>
        </div>

        {/* ── Resizable Splitter ── */}
        <div className="wf-script-modal-splitter" onMouseDown={handleSplitterMouseDown} />

        {/* ── Right: Test Panel ── */}
        <div className="wf-script-modal-sidebar" style={{ width: sidebarWidth }}>
          {/* ── Scrollable config: Input/Output Variables + Test Values ── */}
          <div className="wf-script-sidebar-config">
            <div className="wf-script-modal-section">
              <div className="wf-script-modal-section-header">
                <strong>Input Variables</strong>
                <button className="wf-config-add-btn" onClick={() => setData(prev => ({ ...prev, inputVariables: [...prev.inputVariables, ''] }))}>+</button>
              </div>
              {data.inputVariables.map((v, i) => (
                <div key={i} className="wf-script-modal-var-row">
                  <input
                    className="wf-script-modal-var-name"
                    value={v}
                    onChange={(e) => {
                      const updated = [...data.inputVariables];
                      updated[i] = e.target.value;
                      setData(prev => ({ ...prev, inputVariables: updated }));
                    }}
                    placeholder="name"
                  />
                  <button className="wf-config-remove-btn" onClick={() => setData(prev => ({ ...prev, inputVariables: prev.inputVariables.filter((_, idx) => idx !== i) }))} title="Remove">✕</button>
                </div>
              ))}
            </div>

            <div className="wf-script-modal-section">
              <div className="wf-script-modal-section-header">
                <strong>Output Variables</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="wf-config-add-btn" onClick={handleAutoDetectOutputs} title="Auto-detect from code">⚡</button>
                  <button className="wf-config-add-btn" onClick={() => setData(prev => ({ ...prev, outputVariables: [...prev.outputVariables, ''] }))}>+</button>
                </div>
              </div>
              {data.outputVariables.map((v, i) => (
                <div key={i} className="wf-script-modal-var-row">
                  <input
                    className="wf-script-modal-var-name"
                    value={v}
                    onChange={(e) => {
                      const updated = [...data.outputVariables];
                      updated[i] = e.target.value;
                      setData(prev => ({ ...prev, outputVariables: updated }));
                    }}
                    placeholder="name"
                  />
                  <button className="wf-config-remove-btn" onClick={() => setData(prev => ({ ...prev, outputVariables: prev.outputVariables.filter((_, idx) => idx !== i) }))} title="Remove">✕</button>
                </div>
              ))}
            </div>

            {/* Test Values — compact badges */}
            {data.inputVariables.filter(Boolean).length > 0 && (
              <div className="wf-script-modal-section">
                <div className="wf-script-modal-section-header">
                  <strong>Test Values</strong>
                </div>
                {data.inputVariables.filter(Boolean).map(v => {
                  const value = mockInputs[v] ?? '';
                  const placeholder = inferredDefaults[v] || '';
                  const displayValue = value || placeholder;
                  return (
                    <div key={v} className="wf-script-test-value-row">
                      <button
                        type="button"
                        className="wf-script-test-value-header"
                        onClick={() => setValuePopup({ varName: v, draft: value || placeholder })}
                        title="Click to view / edit"
                      >
                        <span className="wf-script-test-value-chevron">▸</span>
                        <code className="wf-script-test-value-name">{v}</code>
                        {displayValue && (
                          <span className="wf-script-test-value-preview">
                            {displayValue.slice(0, 40)}{displayValue.length > 40 ? '…' : ''}
                          </span>
                        )}
                        {!value && placeholder && <span className="wf-script-test-value-auto">auto</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Run Test Button — always visible, pinned ── */}
          <div className="wf-script-sidebar-run">
            <button className="wf-config-test-btn wf-script-modal-run-btn" onClick={handleTestScript}>
              ▶ Run Test
            </button>
          </div>

          {/* ── Scrollable results ── */}
          {testResult && (
            <div className="wf-script-sidebar-test">
              <ScriptTestResult result={testResult} />
            </div>
          )}
        </div>

        {/* ── Right: Test Value Detail Panel ── */}
        {valuePopup && (
          <>
            <div className="wf-script-modal-splitter" onMouseDown={handlePanelSplitterMouseDown} />
            <TestValuePanel
              key={valuePopup.varName}
              varName={valuePopup.varName}
              initialValue={valuePopup.draft}
              onApply={(value) => setMockInputs(prev => ({ ...prev, [valuePopup.varName]: value }))}
              onClose={() => setValuePopup(null)}
              style={{ width: valuePanelWidth }}
            />
          </>
        )}
      </div>
    </WorkflowEditorModalFrame>,
    document.querySelector('.workflow-designer-mount') || document.body,
  );
}

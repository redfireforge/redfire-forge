import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { MutableRefObject } from 'react';
import type { Assertion, FailureDetail, Scenario, ValidationMode } from '../../../shared/types';
import ResponseVersionPanel from '../../requests/components/ResponseVersionPanel';
import RulesVersionPanel from '../../requests/components/RulesVersionPanel';
import { RegexAssertionBuilderModal } from '../../../shared/components/data-mapper';
import type { AssertionAdapterResult } from '../../../shared/components/data-mapper';
import AssertionPresetMenu from './AssertionPresetMenu';
import { useValidationVersionHandlers } from '../hooks/useValidationVersionHandlers';
import ValidationRulesSummary from './ValidationRulesSummary';
import ValidationVerifyPanel from './ValidationVerifyPanel';
import ValidationResponsePreview from './ValidationResponsePreview';
import FetchErrorBanner from '../../../shared/components/data-mapper/FetchErrorBanner';
import type { FetchErrorDetail } from '../../../shared/components/data-mapper/types';
import { DataMapperModal, createValidationAdapter } from '../../../shared/components/data-mapper';
import type { ValidationAdapterOutput } from '../../../shared/components/data-mapper';
import { buildPivotedRulesFromExpectedFields } from './testEditorValidationPivot';
import { ADD_ASSERTION_MENU_ROWS, ASSERTION_CATEGORIES } from './testEditorValidationAddMenu';
import AssertionRowEditor from './AssertionRowEditor';

export interface TestEditorValidationTabProps {
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  draftRef: MutableRefObject<Scenario>;
  resolvedBaseUrl: string;
  fetchingResponse: boolean;
  fetchError: FetchErrorDetail | null;
  fetchHostOverride: string;
  setFetchHostOverride: (v: string) => void;
  fetchHostEnabled: boolean;
  setFetchHostEnabled: (v: boolean) => void;
  onFetchSampleResponse: () => void | Promise<void>;
  fetchSampleDataForMapper?: () => Promise<unknown>;
  validating: boolean;
  validationResult: { passed: boolean; failures: FailureDetail[]; httpStatus?: number; statusText?: string; responseJson?: string; responseHeaders?: Record<string, string>; verifyScope?: 'assertions' | 'rules' | 'all' } | null;
  setValidationResult: (v: { passed: boolean; failures: FailureDetail[]; httpStatus?: number; statusText?: string; responseJson?: string; responseHeaders?: Record<string, string>; verifyScope?: 'assertions' | 'rules' | 'all' } | null) => void;
  onValidateResponse: (scope?: 'assertions' | 'rules' | 'all') => void | Promise<void>;
  /** When non-null, a new response was fetched but user has existing rules — show confirmation dialog */
  pendingFetchResponse?: string | null;
  /** Accept new response but keep existing validation rules */
  onFetchKeepRules?: () => void;
  /** Accept new response and clear all validation rules */
  onFetchReplaceAll?: () => void;
  /** Discard the fetched response entirely */
  onFetchCancel?: () => void;
}

export default function TestEditorValidationTab({
  draft,
  onDraftChange,
  draftRef,
  resolvedBaseUrl,
  fetchingResponse,
  fetchError,
  fetchHostOverride,
  setFetchHostOverride,
  fetchHostEnabled,
  setFetchHostEnabled,
  onFetchSampleResponse,
  fetchSampleDataForMapper,
  validating,
  validationResult,
  setValidationResult,
  onValidateResponse,
  pendingFetchResponse,
  onFetchKeepRules,
  onFetchReplaceAll,
  onFetchCancel,
}: TestEditorValidationTabProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuSearch, setAddMenuSearch] = useState('');
  const [addMenuPos, setAddMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const addMenuSearchRef = useRef<HTMLInputElement>(null);
  const [regexModalIdx, setRegexModalIdx] = useState<number | null>(null);
  const [assertionsExpanded, setAssertionsExpanded] = useState(true);
  const [validationMapperOpen, setValidationMapperOpen] = useState(false);
  const [openMapperAfterKeepRules, setOpenMapperAfterKeepRules] = useState(false);
  const [rulesViewMode, setRulesViewMode] = useState<'flat' | 'pivot'>('flat');
  const [verifyScope, setVerifyScope] = useState<'assertions' | 'rules' | 'all'>('all');

  const validationAdapter = useMemo(
    () => createValidationAdapter({
      sampleResponseBody: draft.validation.sampleJson || undefined,
      selectiveMode: draft.validation.selectiveMode || 'include',
      expectedFields: draft.validation.expectedFields || [],
      fetchSampleData: fetchSampleDataForMapper,
    }),
    [draft.validation.sampleJson, draft.validation.selectiveMode, draft.validation.expectedFields, fetchSampleDataForMapper],
  );

  const validationMapperInitialData = useMemo<ValidationAdapterOutput>(() => ({
    selectiveMode: draft.validation.selectiveMode || 'include',
    expectedFields: draft.validation.expectedFields || [],
    excludedPaths: draft.validation.excludedPaths || [],
    assertions: draft.validation.assertions || [],
  }), [draft.validation.selectiveMode, draft.validation.expectedFields, draft.validation.excludedPaths, draft.validation.assertions]);

  const handleValidationMapperSave = useCallback((output: ValidationAdapterOutput, options?: { unorderedArrays?: boolean }) => {
    const prev = draftRef.current;
    onDraftChange({
      ...prev,
      validation: {
        ...prev.validation,
        selectiveMode: output.selectiveMode,
        expectedFields: output.expectedFields,
        excludedPaths: output.excludedPaths,
        unorderedArrays: options?.unorderedArrays ?? prev.validation.unorderedArrays,
        assertions: output.assertions !== undefined ? output.assertions : prev.validation.assertions,
      },
    });
    setValidationMapperOpen(false);
  }, [draftRef, onDraftChange]);

  const handleFetchKeepRulesClick = useCallback(() => {
    if (!onFetchKeepRules) return;
    setOpenMapperAfterKeepRules(true);
    onFetchKeepRules();
  }, [onFetchKeepRules]);

  useEffect(() => {
    if (!showAddMenu) { setAddMenuSearch(''); return; }
    requestAnimationFrame(() => {
      addMenuSearchRef.current?.focus();
      const btn = addBtnRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const menuHeight = 460;
        const dropUp = rect.bottom + menuHeight > window.innerHeight;
        const right = Math.max(4, window.innerWidth - rect.right);
        if (dropUp) {
          setAddMenuPos({ bottom: window.innerHeight - rect.top + 4, right });
        } else {
          setAddMenuPos({ top: rect.bottom + 4, right });
        }
      }
    });
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node) &&
          addBtnRef.current && !addBtnRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAddMenu]);

  useEffect(() => {
    if (!openMapperAfterKeepRules || pendingFetchResponse) return;
    setOpenMapperAfterKeepRules(false);
    if (draft.validation.sampleJson?.trim()) {
      setValidationMapperOpen(true);
    }
  }, [openMapperAfterKeepRules, pendingFetchResponse, draft.validation.sampleJson]);

  const assertions = draft.validation.assertions ?? [];
  const responsePreviewJson = pendingFetchResponse ?? draft.validation.sampleJson ?? '';
  const hasResponsePreview = responsePreviewJson.trim().length > 0;

  const removeExpectedField = useCallback((index: number) => {
    const prev = draftRef.current;
    const next = [...(prev.validation.expectedFields || [])];
    next.splice(index, 1);
    onDraftChange({ ...prev, validation: { ...prev.validation, expectedFields: next } });
  }, [draftRef, onDraftChange]);

  const removeExpectedFieldsByPathPrefix = useCallback((rowKey: string) => {
    const prev = draftRef.current;
    const next = (prev.validation.expectedFields || []).filter((f) => {
      const lastDot = f.jsonPath.lastIndexOf('.');
      const itsRowKey = lastDot === -1 ? '(root)' : f.jsonPath.slice(0, lastDot);
      return itsRowKey !== rowKey;
    });
    onDraftChange({ ...prev, validation: { ...prev.validation, expectedFields: next } });
  }, [draftRef, onDraftChange]);

  const pivotedRules = useMemo(
    () => buildPivotedRulesFromExpectedFields(draft.validation.expectedFields || []),
    [draft.validation.expectedFields],
  );

  const canPivot = !!pivotedRules.arrayPrefix && pivotedRules.rows.length > 0;

  function updateAssertion(idx: number, patch: Partial<Assertion>) {
    const prev = draftRef.current;
    const list = [...(prev.validation.assertions ?? [])];
    list[idx] = { ...list[idx], ...patch } as Assertion;
    onDraftChange({ ...prev, validation: { ...prev.validation, assertions: list } });
  }
  function removeAssertion(idx: number) {
    const prev = draftRef.current;
    const list = (prev.validation.assertions ?? []).filter((_, i) => i !== idx);
    onDraftChange({ ...prev, validation: { ...prev.validation, assertions: list } });
  }
  function addAssertion(a: Assertion) {
    const prev = draftRef.current;
    const list = [...(prev.validation.assertions ?? []), a];
    onDraftChange({ ...prev, validation: { ...prev.validation, assertions: list } });
    setShowAddMenu(false);
  }
  function importAssertions(items: Assertion[]) {
    const prev = draftRef.current;
    const list = [...(prev.validation.assertions ?? []), ...items];
    onDraftChange({ ...prev, validation: { ...prev.validation, assertions: list } });
  }

  const {
    handleSaveResponseVersion,
    handleRestoreResponseVersion,
    handleDeleteResponseVersion,
    handleRenameResponseVersion,
    handleSaveRulesVersion,
    handleRestoreRulesVersion,
    handleDeleteRulesVersion,
    handleRenameRulesVersion,
  } = useValidationVersionHandlers({ draftRef, onDraftChange });

  return (
    <div>
      {/* ── Rich Assertions ────────────────────────────── */}
      <div className="assertions-section">
        <div className="assertions-header">
          <button
            type="button"
            className="assertions-collapse-toggle"
            onClick={() => setAssertionsExpanded(v => !v)}
            aria-expanded={assertionsExpanded}
            title={assertionsExpanded ? 'Collapse assertions' : 'Expand assertions'}
          >
            <span className={`assertions-collapse-arrow ${assertionsExpanded ? 'expanded' : ''}`}>▶</span>
          </button>
          <span className="assertions-title">Assertions</span>
          {assertions.length > 0 && (
            <span className="assertions-count-badge">{assertions.length}</span>
          )}
          <span className="assertions-hint">Run on every request regardless of validation mode</span>
          <AssertionPresetMenu onImport={importAssertions} />
          <div className="assertions-add-wrap">
            <button ref={addBtnRef} type="button" className="btn btn-sm btn-accent" onClick={() => setShowAddMenu(!showAddMenu)}>+ Add</button>
            {showAddMenu && createPortal(
              <div
                ref={addMenuRef}
                className="assertions-add-menu"
                style={{
                  ...(addMenuPos.top != null ? { top: addMenuPos.top } : {}),
                  ...(addMenuPos.bottom != null ? { bottom: addMenuPos.bottom } : {}),
                  right: addMenuPos.right,
                }}
              >
                <div className="aam-search-wrap">
                  <input
                    ref={addMenuSearchRef}
                    className="aam-search"
                    type="text"
                    placeholder="Filter assertions…"
                    value={addMenuSearch}
                    onChange={(e) => setAddMenuSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowAddMenu(false); } }}
                  />
                </div>
                <div className="aam-categories">
                  {ASSERTION_CATEGORIES.map((cat) => {
                    const q = addMenuSearch.trim().toLowerCase();
                    const items = ADD_ASSERTION_MENU_ROWS.filter(
                      (r): r is Exclude<typeof r, { kind: 'divider' }> =>
                        r.kind !== 'divider' && r.category === cat &&
                        (!q || r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)),
                    );
                    if (items.length === 0) return null;
                    return (
                      <div key={cat} className="aam-category">
                        <div className="aam-category-header">{cat}</div>
                        <div className="aam-category-grid">
                          {items.map((row, idx) => {
                            if (row.kind === 'regexBuilder') {
                              return (
                                <button
                                  key={`${cat}-${idx}`}
                                  type="button"
                                  className="aam-grid-item"
                                  onClick={() => {
                                    addAssertion({ type: 'regex', jsonPath: '', pattern: '' });
                                    setRegexModalIdx((draft.validation.assertions ?? []).length);
                                  }}
                                >
                                  <span className="aam-icon">{row.icon}</span>
                                  <span className="aam-label">{row.label}</span>
                                </button>
                              );
                            }
                            const resolved = typeof row.assertion === 'function' ? row.assertion() : row.assertion;
                            const iconClass = row.iconClassName ? `aam-icon ${row.iconClassName}` : 'aam-icon';
                            return (
                              <button key={`${cat}-${idx}`} type="button" className="aam-grid-item" title={row.desc} onClick={() => addAssertion(resolved)}>
                                <span className={iconClass}>{row.icon}</span>
                                <span className="aam-label">{row.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {ASSERTION_CATEGORIES.every((cat) => {
                    const q = addMenuSearch.trim().toLowerCase();
                    const items = ADD_ASSERTION_MENU_ROWS.filter(
                      (r) => r.kind !== 'divider' && r.category === cat &&
                        (!q || r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)),
                    );
                    return items.length === 0;
                  }) && (
                    <div className="aam-no-results">No matching assertions</div>
                  )}
                </div>
              </div>,
              document.body,
            )}
          </div>
        </div>
        {assertionsExpanded && assertions.length > 0 && (
          <div className="assertions-list">
            {assertions.map((a, i) => (
              <AssertionRowEditor
                key={i}
                assertion={a}
                index={i}
                sampleJson={draft.validation.sampleJson || ''}
                onUpdate={updateAssertion}
                onRemove={removeAssertion}
                onOpenRegexBuilder={setRegexModalIdx}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Body Validation Mode ──────────────────────── */}
      <div className="body-validation-section">
        <div className="body-validation-header">
          <span className="body-validation-title">Body Validation</span>
          <span className="body-validation-hint">Compare the response body against expected JSON</span>
        </div>
        <div className="radio-group">
          {(['none', 'full', 'selective'] as ValidationMode[]).map((m) => (
            <label key={m} className="radio-label">
              <input type="radio" name="validationMode" checked={draft.validation.mode === m} onChange={() => onDraftChange({ ...draft, validation: { ...draft.validation, mode: m } })} />
              {m === 'none' ? 'No Body Validation' : m === 'full' ? 'Full JSON Match' : 'Selective Fields'}
            </label>
          ))}
        </div>
      </div>
      {draft.validation.mode === 'full' && (
        <div className="form-row">
          <label>Expected JSON Response
            <button
              type="button"
              className="btn btn-xs"
              style={{ marginLeft: 8 }}
              title="Format JSON with indentation"
              disabled={!draft.validation.expectedJson?.trim()}
              onClick={() => {
                const raw = draft.validation.expectedJson?.trim();
                if (!raw) return;
                try {
                  const formatted = JSON.stringify(JSON.parse(raw), null, 2);
                  onDraftChange({ ...draft, validation: { ...draft.validation, expectedJson: formatted } });
                } catch { /* invalid JSON — no-op */ }
              }}
            >
              Pretty Format
            </button>
            <button
              type="button"
              className="btn btn-xs"
              style={{ marginLeft: 4 }}
              title="Minify JSON (remove whitespace)"
              disabled={!draft.validation.expectedJson?.trim()}
              onClick={() => {
                const raw = draft.validation.expectedJson?.trim();
                if (!raw) return;
                try {
                  const minified = JSON.stringify(JSON.parse(raw));
                  onDraftChange({ ...draft, validation: { ...draft.validation, expectedJson: minified } });
                } catch { /* invalid JSON — no-op */ }
              }}
            >
              Minify
            </button>
          </label>
          <textarea
            rows={10}
            value={draft.validation.expectedJson || ''}
            onChange={(e) => onDraftChange({ ...draft, validation: { ...draft.validation, expectedJson: e.target.value } })}
            placeholder='Paste the complete expected JSON response here'
          />
          {!draft.validation.expectedJson?.trim() && (
            <div className="validation-empty-warning">
              ⚠ No expected JSON provided — body validation won't run. Paste a response or switch to <button type="button" className="link-btn" onClick={() => onDraftChange({ ...draft, validation: { ...draft.validation, mode: 'none' } })}>No Body Validation</button>.
            </div>
          )}
        </div>
      )}
      {draft.validation.mode !== 'selective' && (draft.validation.assertions?.length ?? 0) > 0 && (
        <ValidationVerifyPanel
          expectedFieldCount={0}
          assertionCount={(draft.validation.assertions || []).length}
          validating={validating}
          verifyScope={'assertions'}
          onVerifyScopeChange={() => {}}
          onValidate={() => void onValidateResponse('assertions')}
          fetchHostEnabled={fetchHostEnabled}
          onFetchHostEnabledChange={setFetchHostEnabled}
          fetchHostOverride={fetchHostOverride}
          onFetchHostOverrideChange={setFetchHostOverride}
          resolvedBaseUrl={resolvedBaseUrl}
          onUseSettingsUrl={() => setFetchHostOverride(resolvedBaseUrl || '')}
          validationResult={validationResult}
          onDismissResult={() => setValidationResult(null)}
          unorderedArrays={draft.validation.unorderedArrays}
          onEnableUnorderedAndReVerify={() => {}}
        />
      )}
      {draft.validation.mode === 'selective' && (
        <>
          <div className="validation-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.validation.unorderedArrays || false}
                onChange={(e) => {
                  const prev = draftRef.current;
                  onDraftChange({ ...prev, validation: { ...prev.validation, unorderedArrays: e.target.checked } });
                }}
              />
              Unordered array matching
              <span className="option-hint">— ignore array item positions, match by value instead</span>
            </label>
          </div>
          <div className="fetch-host-override-row">
            <button
              type="button"
              className="btn btn-sm btn-accent"
              onClick={() => void onFetchSampleResponse()}
              disabled={fetchingResponse}
            >
              {fetchingResponse ? 'Fetching...' : 'Fetch Response'}
            </button>
            <label className="checkbox-label fetch-host-toggle">
              <input
                type="checkbox"
                checked={fetchHostEnabled}
                onChange={(e) => setFetchHostEnabled(e.target.checked)}
              />
              Host Override
            </label>
            <input
              value={fetchHostOverride}
              onChange={(e) => setFetchHostOverride(e.target.value)}
              placeholder={resolvedBaseUrl || 'Enter base URL'}
              disabled={!fetchHostEnabled}
            />
            {fetchHostEnabled && resolvedBaseUrl && !fetchHostOverride && (
              <button type="button" className="btn btn-sm" onClick={() => setFetchHostOverride(resolvedBaseUrl)} title="Use Settings base URL">Use Settings</button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-accent"
              onClick={() => setValidationMapperOpen(true)}
              disabled={!draft.validation.sampleJson?.trim() && !(draft.validation.expectedFields?.length)}
              title={
                draft.validation.sampleJson?.trim() || draft.validation.expectedFields?.length
                  ? 'Open Data Mapper'
                  : 'Fetch response or add rules first'
              }
            >
              ⚡ Data Mapper
            </button>
          </div>
          {fetchError && <FetchErrorBanner error={fetchError} />}
          {pendingFetchResponse && (
            <div className="fetch-confirm-bar">
              <span className="fetch-confirm-msg">New response fetched. You have <strong>{(draft.validation.expectedFields || []).length}</strong> existing rule(s).</span>
              <div className="fetch-confirm-actions">
                <button type="button" className="btn btn-sm btn-accent" onClick={handleFetchKeepRulesClick}>Keep Rules &amp; Update Response</button>
                <button type="button" className="btn btn-sm btn-danger" onClick={onFetchReplaceAll}>Replace All</button>
                <button type="button" className="btn btn-sm" onClick={onFetchCancel}>Cancel</button>
              </div>
            </div>
          )}
          {hasResponsePreview && (
            <ValidationResponsePreview
              responsePreviewJson={responsePreviewJson}
              isPending={!!pendingFetchResponse}
            />
          )}
          <ValidationRulesSummary
            expectedFields={draft.validation.expectedFields || []}
            pivotedRules={pivotedRules}
            canPivot={canPivot}
            rulesViewMode={rulesViewMode}
            onViewModeChange={setRulesViewMode}
            onRemoveField={removeExpectedField}
            onRemoveRowPrefix={removeExpectedFieldsByPathPrefix}
          />

          <ValidationVerifyPanel
            expectedFieldCount={(draft.validation.expectedFields || []).length}
            assertionCount={(draft.validation.assertions || []).length}
            validating={validating}
            verifyScope={verifyScope}
            onVerifyScopeChange={setVerifyScope}
            onValidate={() => void onValidateResponse(verifyScope)}
            fetchHostEnabled={fetchHostEnabled}
            onFetchHostEnabledChange={setFetchHostEnabled}
            fetchHostOverride={fetchHostOverride}
            onFetchHostOverrideChange={setFetchHostOverride}
            resolvedBaseUrl={resolvedBaseUrl}
            onUseSettingsUrl={() => setFetchHostOverride(resolvedBaseUrl || '')}
            validationResult={validationResult}
            onDismissResult={() => setValidationResult(null)}
            unorderedArrays={draft.validation.unorderedArrays}
            onEnableUnorderedAndReVerify={() => {
              const prev = draftRef.current;
              const updated = { ...prev, validation: { ...prev.validation, unorderedArrays: true } };
              draftRef.current = updated;
              onDraftChange(updated);
              void onValidateResponse(verifyScope);
            }}
          />

          <ResponseVersionPanel
            versions={draft.validation.responseVersions || []}
            currentJson={draft.validation.sampleJson || ''}
            currentValidation={draft.validation}
            excludedPaths={draft.validation.excludedPaths}
            onSaveVersion={handleSaveResponseVersion}
            onRestore={handleRestoreResponseVersion}
            onDeleteVersion={handleDeleteResponseVersion}
            onRenameVersion={handleRenameResponseVersion}
          />

          <RulesVersionPanel
            versions={draft.validation.rulesVersions || []}
            currentValidation={draft.validation}
            onSaveVersion={handleSaveRulesVersion}
            onRestore={handleRestoreRulesVersion}
            onDeleteVersion={handleDeleteRulesVersion}
            onRenameVersion={handleRenameRulesVersion}
          />
        </>
      )}

      {validationMapperOpen && (
        <DataMapperModal
          adapter={validationAdapter}
          initialData={validationMapperInitialData}
          onSave={handleValidationMapperSave}
          onCancel={() => setValidationMapperOpen(false)}
          unorderedArrays={draft.validation.unorderedArrays}
          contextScope={draft.id}
        />
      )}

      {regexModalIdx !== null && (() => {
        const a = (draft.validation.assertions ?? [])[regexModalIdx];
        const regexA = a?.type === 'regex' ? a : undefined;
        return (
          <RegexAssertionBuilderModal
            initialJsonPath={regexA?.jsonPath || ''}
            initialPattern={regexA?.pattern || ''}
            sampleJson={draft.validation.sampleJson || ''}
            onFetchSampleResponse={onFetchSampleResponse}
            fetchingResponse={fetchingResponse}
            fetchError={fetchError}
            onSave={(result: AssertionAdapterResult) => {
              updateAssertion(regexModalIdx, { jsonPath: result.jsonPath, pattern: result.pattern });
              setRegexModalIdx(null);
            }}
            onCancel={() => setRegexModalIdx(null)}
          />
        );
      })()}
    </div>
  );
}

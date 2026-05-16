import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Assertion, AssertionOperator, ComparisonOperator, DateReference, FailureDetail, FieldOperator, JsonTypeName, Scenario, ValidationMode } from '../../../shared/types';
import ResponseVersionPanel from '../../requests/components/ResponseVersionPanel';
import RulesVersionPanel from '../../requests/components/RulesVersionPanel';
import { RegexAssertionBuilderModal } from '../../../shared/components/data-mapper';
import type { AssertionAdapterResult } from '../../../shared/components/data-mapper';
import AssertionPresetMenu from './AssertionPresetMenu';
import { useValidationVersionHandlers } from '../hooks/useValidationVersionHandlers';
import JsonPathPicker from './JsonPathPicker';
import ValidationRulesSummary from './ValidationRulesSummary';
import ValidationVerifyPanel from './ValidationVerifyPanel';
import ValidationResponsePreview from './ValidationResponsePreview';
import FetchErrorBanner from '../../../shared/components/data-mapper/FetchErrorBanner';
import type { FetchErrorDetail } from '../../../shared/components/data-mapper/types';
import { getByPath, stripJsonPathPrefix } from '../../../shared/utils/jsonPath';
import { generateJsonSchema } from '../../../shared/components/data-mapper/utils/schemaGenerator';
import { DataMapperModal, createValidationAdapter } from '../../../shared/components/data-mapper';
import type { ValidationAdapterOutput } from '../../../shared/components/data-mapper';
import { buildPivotedRulesFromExpectedFields } from './testEditorValidationPivot';
import { ADD_ASSERTION_MENU_ROWS, ASSERTION_CATEGORIES } from './testEditorValidationAddMenu';
import {
  ARRAY_CONTAINS_MODE_OPTIONS,
  CalendarIcon,
  ComparisonSelect,
  DATE_OP_OPTIONS,
  FIELD_OP_OPTIONS,
  getAssertionTypeBadgeLabel,
  NUMERIC_OP_OPTIONS,
} from './testEditorValidationConstants';

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
  const addMenuRef = useRef<HTMLDivElement>(null);
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
    requestAnimationFrame(() => addMenuSearchRef.current?.focus());
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
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
          <div className="assertions-add-wrap" ref={addMenuRef}>
            <button type="button" className="btn btn-sm btn-accent" onClick={() => setShowAddMenu(!showAddMenu)}>+ Add</button>
            {showAddMenu && (
              <div className="assertions-add-menu">
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
              </div>
            )}
          </div>
        </div>
        {assertionsExpanded && assertions.length > 0 && (
          <div className="assertions-list">
            {assertions.map((a, i) => (
              <div key={i} className={`assertion-row${a.negate ? ' assertion-row--negated' : ''}`}>
                <span className={`assertion-type-badge assertion-type-${a.type}`}>
                  {getAssertionTypeBadgeLabel(a.type)}
                </span>
                <button
                  type="button"
                  className={`assertion-negate-toggle${a.negate ? ' assertion-negate-toggle--active' : ''}`}
                  title={a.negate ? 'Negated — click to remove NOT' : 'Click to negate this assertion (NOT)'}
                  onClick={() => updateAssertion(i, { negate: a.negate ? undefined : true } as Partial<Assertion>)}
                  aria-label={a.negate ? 'Remove negation' : 'Negate assertion'}
                >
                  NOT
                </button>
                {a.type === 'status' && (
                  <div className="assertion-field">
                    <span className="assertion-field-label">Expected</span>
                    <input value={a.expected} onChange={(e) => updateAssertion(i, { expected: e.target.value })} placeholder="200, 2xx, 200-299" className="assertion-input" />
                  </div>
                )}
                {a.type === 'responseTime' && (
                  <div className="assertion-field">
                    <span className="assertion-field-label">Max</span>
                    <input type="number" value={a.maxMs} onChange={(e) => updateAssertion(i, { maxMs: Number(e.target.value) || 0 })} className="assertion-input assertion-input-sm" min={0} />
                    <span className="assertion-unit">ms</span>
                  </div>
                )}
                {a.type === 'header' && (
                  <div className="assertion-field">
                    <input value={a.name} onChange={(e) => updateAssertion(i, { name: e.target.value })} placeholder="Header name" className="assertion-input assertion-input-header-name" />
                    <select value={a.operator} onChange={(e) => updateAssertion(i, { operator: e.target.value as AssertionOperator })} className="assertion-select">
                      <option value="equals">equals</option>
                      <option value="contains">contains</option>
                      <option value="regex">regex</option>
                      <option value="exists">exists</option>
                    </select>
                    {a.operator !== 'exists' && (
                      <input value={a.value ?? ''} onChange={(e) => updateAssertion(i, { value: e.target.value })} placeholder="Expected value" className="assertion-input assertion-input-header-val" />
                    )}
                  </div>
                )}
                {a.type === 'regex' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.path" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <span className="assertion-regex-slash">/</span>
                    <input value={a.pattern} onChange={(e) => updateAssertion(i, { pattern: e.target.value })} placeholder="pattern" className="assertion-input" />
                    <span className="assertion-regex-slash">/</span>
                    <button type="button" className="assertion-builder-btn" onClick={() => setRegexModalIdx(i)} title="Open Regex Builder">Builder</button>
                  </div>
                )}
                {a.type === 'arrayLength' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.items" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <span className="assertion-field-label assertion-field-label-fixed">length</span>
                    <ComparisonSelect value={a.operator} onChange={(op) => updateAssertion(i, { operator: op })} options={NUMERIC_OP_OPTIONS} />
                    <input type="number" value={a.value} onChange={(e) => updateAssertion(i, { value: Number(e.target.value) || 0 })} className="assertion-input assertion-input-sm" min={0} />
                  </div>
                )}
                {a.type === 'numeric' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.price" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <span className="assertion-field-label assertion-field-label-fixed">&nbsp;</span>
                    <ComparisonSelect value={a.operator} onChange={(op) => updateAssertion(i, { operator: op })} options={NUMERIC_OP_OPTIONS} />
                    <input type="number" value={a.value} onChange={(e) => updateAssertion(i, { value: Number(e.target.value) || 0 })} className="assertion-input assertion-input-sm" step="any" />
                  </div>
                )}
                {a.type === 'date' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.expiresAt" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <span className="assertion-field-label assertion-field-label-fixed">&nbsp;</span>
                    <ComparisonSelect value={a.operator} onChange={(op) => updateAssertion(i, { operator: op })} options={DATE_OP_OPTIONS} />
                    <select value={a.reference.kind} onChange={(e) => {
                      const kind = e.target.value as 'today' | 'fixed';
                      const ref: DateReference = kind === 'today'
                        ? { kind: 'today', timezone: (a.reference.kind === 'today' ? a.reference.timezone : 'utc') }
                        : { kind: 'fixed', iso: (a.reference.kind === 'fixed' ? a.reference.iso : new Date().toISOString().slice(0, 10)) };
                      updateAssertion(i, { reference: ref });
                    }} className="assertion-select">
                      <option value="today">today</option>
                      <option value="fixed">fixed date</option>
                    </select>
                    {a.reference.kind === 'today' && (
                      <select value={a.reference.timezone} onChange={(e) => updateAssertion(i, { reference: { kind: 'today', timezone: e.target.value as 'utc' | 'local' } })} className="assertion-select assertion-select-sm">
                        <option value="utc">UTC</option>
                        <option value="local">Local</option>
                      </select>
                    )}
                    {a.reference.kind === 'fixed' && (
                      <div className="assertion-date-wrap">
                        <input type="date" value={a.reference.iso} onChange={(e) => updateAssertion(i, { reference: { kind: 'fixed', iso: e.target.value } })} className="assertion-input assertion-input-sm" />
                        <button type="button" className="assertion-date-btn" title="Pick date" onClick={(e) => { const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement; input?.showPicker?.(); }}>
                          <CalendarIcon />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {a.type === 'typeCheck' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.price" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <span className="assertion-field-label assertion-field-label-fixed">is</span>
                    <select value={a.expectedType} onChange={(e) => updateAssertion(i, { expectedType: e.target.value as JsonTypeName })} className="assertion-select">
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="array">array</option>
                      <option value="object">object</option>
                      <option value="null">null</option>
                    </select>
                  </div>
                )}
                {a.type === 'existence' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.metadata.tags" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <select value={a.expectExists ? 'exists' : 'not_exists'} onChange={(e) => updateAssertion(i, { expectExists: e.target.value === 'exists' })} className="assertion-select">
                      <option value="exists">exists</option>
                      <option value="not_exists">does not exist</option>
                    </select>
                  </div>
                )}
                {a.type === 'arrayContains' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.items" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <select value={a.mode} onChange={(e) => updateAssertion(i, { mode: e.target.value as 'any' | 'all' | 'only' | 'none' })} className="assertion-select">
                      {ARRAY_CONTAINS_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <textarea
                      value={a.value}
                      onChange={(e) => updateAssertion(i, { value: e.target.value })}
                      placeholder='{"name": "example"} or "value"'
                      className="assertion-input assertion-input-json"
                      rows={1}
                    />
                  </div>
                )}
                {a.type === 'each' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.items" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <input value={a.fieldPath} onChange={(e) => updateAssertion(i, { fieldPath: e.target.value })} placeholder="field (e.g. rank)" className="assertion-input assertion-input-sm" />
                    <JsonPathPicker
                      sampleJson={(() => {
                        try {
                          const parsed = JSON.parse(draft.validation.sampleJson || '');
                          const arr = a.jsonPath ? getByPath(parsed, a.jsonPath) : parsed;
                          if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
                            return JSON.stringify(arr[0]);
                          }
                        } catch { /* ignore */ }
                        return '';
                      })()}
                      onSelect={(p) => {
                        const field = stripJsonPathPrefix(p);
                        updateAssertion(i, { fieldPath: field });
                      }}
                    />
                    <select value={a.operator} onChange={(e) => updateAssertion(i, { operator: e.target.value as FieldOperator })} className="assertion-select">
                      {FIELD_OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {!['is_true', 'is_false', 'is_null', 'is_not_null', 'is_empty', 'is_not_empty', 'exists', 'not_exists'].includes(a.operator) && (
                      <input value={a.value ?? ''} onChange={(e) => updateAssertion(i, { value: e.target.value })} placeholder="value" className="assertion-input assertion-input-sm" />
                    )}
                  </div>
                )}
                {a.type === 'containsSubset' && (
                  <div className="assertion-field">
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$" className="assertion-input assertion-input-path" />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <textarea
                      value={a.expected}
                      onChange={(e) => updateAssertion(i, { expected: e.target.value })}
                      placeholder='{"status": "active", "enabled": true}'
                      className="assertion-input assertion-input-json"
                      rows={2}
                    />
                  </div>
                )}
                {a.type === 'jsonSchema' && (
                  <div className="assertion-field assertion-field--schema">
                    <div className="assertion-schema-toolbar">
                      <button
                        type="button"
                        className="btn btn-xs btn-outline assertion-schema-action"
                        onClick={() => {
                          if (!navigator.clipboard?.readText) return;
                          navigator.clipboard.readText().then(text => {
                            updateAssertion(i, { schema: text });
                          }).catch(() => {});
                        }}
                        title="Paste schema from clipboard"
                      >
                        Paste Schema
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline assertion-schema-action"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(a.schema);
                            updateAssertion(i, { schema: JSON.stringify(parsed, null, 2) });
                          } catch { /* ignore malformed JSON */ }
                        }}
                        title="Pretty-print JSON with indentation"
                      >
                        Pretty
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline assertion-schema-action"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(a.schema);
                            updateAssertion(i, { schema: JSON.stringify(parsed) });
                          } catch { /* ignore malformed JSON */ }
                        }}
                        title="Minify JSON to single line"
                      >
                        Minify
                      </button>
                      {draft.validation.sampleJson && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline assertion-schema-action assertion-schema-action--generate"
                        onClick={() => {
                          try {
                            const sample = JSON.parse(draft.validation.sampleJson || '{}');
                            const schema = generateJsonSchema(sample, { strict: Object.keys(sample as object).length > 0 });
                            updateAssertion(i, { schema: JSON.stringify(schema, null, 2) });
                          } catch { /* ignore malformed JSON */ }
                        }}
                          title="Generate schema from sample response"
                        >
                          Generate from Response
                        </button>
                      )}
                    </div>
                    <textarea
                      value={a.schema}
                      onChange={(e) => updateAssertion(i, { schema: e.target.value })}
                      placeholder={'{\n  "type": "object",\n  "required": ["id", "name"],\n  "properties": {\n    "id": { "type": "integer" },\n    "name": { "type": "string" }\n  }\n}'}
                      className={`assertion-input assertion-input-schema${(() => { try { JSON.parse(a.schema); return ''; } catch { return ' assertion-input-schema--invalid'; } })()}`}
                      rows={6}
                      spellCheck={false}
                    />
                    {(() => { try { JSON.parse(a.schema); return null; } catch (e) { return <span className="assertion-schema-error">{e instanceof Error ? e.message : 'Invalid JSON'}</span>; } })()}
                  </div>
                )}
                {a.type === 'bodySize' && (
                  <div className="assertion-field assertion-field--bodysize">
                    <select
                      value={a.operator}
                      onChange={(e) => updateAssertion(i, { operator: e.target.value as ComparisonOperator })}
                      className="assertion-select assertion-select--operator"
                    >
                      <option value="<">less than</option>
                      <option value="<=">at most</option>
                      <option value="=">exactly</option>
                      <option value=">=">at least</option>
                      <option value=">">more than</option>
                      <option value="!=">not equal</option>
                    </select>
                    <input
                      type="number"
                      value={a.value}
                      onChange={(e) => updateAssertion(i, { value: Number(e.target.value) || 0 })}
                      className="assertion-input assertion-input-num"
                      min={0}
                      step={1}
                    />
                    <select
                      value={a.unit}
                      onChange={(e) => updateAssertion(i, { unit: e.target.value as 'bytes' | 'kb' | 'mb' })}
                      className="assertion-select assertion-select--unit"
                    >
                      <option value="bytes">Bytes</option>
                      <option value="kb">KB</option>
                      <option value="mb">MB</option>
                    </select>
                  </div>
                )}
                {a.type === 'datePrecise' && (
                  <div className="assertion-field assertion-field--dateprecise">
                    <input
                      value={a.jsonPath}
                      onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })}
                      placeholder="$.timestamp"
                      className="assertion-input assertion-input-path"
                    />
                    <JsonPathPicker sampleJson={draft.validation.sampleJson || ''} onSelect={(p) => updateAssertion(i, { jsonPath: p })} />
                    <select
                      value={a.operator}
                      onChange={(e) => updateAssertion(i, { operator: e.target.value as ComparisonOperator })}
                      className="assertion-select assertion-select--operator"
                    >
                      <option value="=">equals</option>
                      <option value="!=">not equals</option>
                      <option value=">">after</option>
                      <option value=">=">on or after</option>
                      <option value="<">before</option>
                      <option value="<=">on or before</option>
                    </select>
                    <div className="assertion-date-wrap">
                      <input
                        type="datetime-local"
                        value={a.reference ? a.reference.slice(0, 16) : ''}
                        onChange={(e) => updateAssertion(i, { reference: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                        className="assertion-input assertion-input-date"
                      />
                      <button type="button" className="assertion-date-btn" title="Pick date/time" onClick={(e) => { const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement; input?.showPicker?.(); }}>
                        <CalendarIcon />
                      </button>
                      <select
                        value={a.precision}
                        onChange={(e) => updateAssertion(i, { precision: e.target.value as 'day' | 'hour' | 'minute' | 'second' | 'millisecond' })}
                        className="assertion-select assertion-select--precision"
                      >
                        <option value="day">Day</option>
                        <option value="hour">Hour</option>
                        <option value="minute">Minute</option>
                        <option value="second">Second</option>
                        <option value="millisecond">Millisecond</option>
                      </select>
                    </div>
                  </div>
                )}
                {a.type === 'custom' && (
                  <div className="assertion-field assertion-field--custom">
                    <div className="assertion-custom-expression-wrap">
                      <label className="assertion-field-label assertion-field-label--mono">λ Expression</label>
                      <textarea
                        value={a.expression}
                        onChange={(e) => updateAssertion(i, { expression: e.target.value })}
                        placeholder='$gt($.body.count, 0) or $includes($.body.name, "test")'
                        className="assertion-textarea assertion-textarea--expression"
                        rows={2}
                        spellCheck={false}
                        aria-label="Custom predicate expression"
                      />
                    </div>
                    <div className="assertion-custom-description-wrap">
                      <label className="assertion-field-label">Description</label>
                      <input
                        value={a.description ?? ''}
                        onChange={(e) => updateAssertion(i, { description: e.target.value || undefined })}
                        placeholder="Optional — describe what this checks"
                        className="assertion-input assertion-input--description"
                        aria-label="Custom predicate description"
                      />
                    </div>
                    <div className="assertion-custom-hint">
                      <span className="assertion-custom-hint-icon">i</span>
                      <span>Use <code>$.body</code>, <code>$.status</code>, <code>$.headers</code>, <code>$.responseTime</code> — supports all 113 expression functions including lambdas</span>
                    </div>
                  </div>
                )}
                <button type="button" className="btn btn-xs btn-danger assertion-remove" onClick={() => removeAssertion(i)} title="Remove assertion">×</button>
              </div>
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
          <label>Expected JSON Response</label>
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
            assertions={draft.validation.assertions}
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

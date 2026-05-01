import { useState, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Assertion, AssertionOperator, ComparisonOperator, DateReference, FailureDetail, ResponseVersion, RulesVersion, Scenario, ValidationMode } from '../../../shared/types';
import JsonPathBuilder from '../../requests/components/JsonPathBuilder';
import ResponseVersionPanel from '../../requests/components/ResponseVersionPanel';
import RulesVersionPanel from '../../requests/components/RulesVersionPanel';
import RegexAssertionModal from '../../requests/components/RegexAssertionModal';
import type { RegexAssertionResult } from '../../requests/components/RegexAssertionModal';
import AssertionPresetMenu from './AssertionPresetMenu';
import JsonPathPicker from './JsonPathPicker';

export interface TestEditorValidationTabProps {
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  draftRef: MutableRefObject<Scenario>;
  resolvedBaseUrl: string;
  fetchingResponse: boolean;
  fetchError: string | null;
  fetchHostOverride: string;
  setFetchHostOverride: (v: string) => void;
  fetchHostEnabled: boolean;
  setFetchHostEnabled: (v: boolean) => void;
  onFetchSampleResponse: () => void | Promise<void>;
  validating: boolean;
  validationResult: { passed: boolean; failures: FailureDetail[]; httpStatus?: number; responseJson?: string } | null;
  setValidationResult: (v: { passed: boolean; failures: FailureDetail[]; httpStatus?: number; responseJson?: string } | null) => void;
  onValidateResponse: () => void | Promise<void>;
  /** When non-null, a new response was fetched but user has existing rules — show confirmation dialog */
  pendingFetchResponse?: string | null;
  /** Accept new response but keep existing validation rules */
  onFetchKeepRules?: () => void;
  /** Accept new response and clear all validation rules */
  onFetchReplaceAll?: () => void;
  /** Discard the fetched response entirely */
  onFetchCancel?: () => void;
}

const NUMERIC_OP_OPTIONS: { value: ComparisonOperator; label: string }[] = [
  { value: '=', label: 'equals (=)' },
  { value: '!=', label: 'not equals (≠)' },
  { value: '>', label: 'greater than (>)' },
  { value: '>=', label: 'at least (≥)' },
  { value: '<', label: 'less than (<)' },
  { value: '<=', label: 'at most (≤)' },
];

const DATE_OP_OPTIONS: { value: ComparisonOperator; label: string }[] = [
  { value: '=', label: 'equals (=)' },
  { value: '!=', label: 'not equals (≠)' },
  { value: '>', label: 'after (>)' },
  { value: '>=', label: 'on or after (≥)' },
  { value: '<', label: 'before (<)' },
  { value: '<=', label: 'on or before (≤)' },
];

function ComparisonSelect({ value, onChange, options, className }: {
  value: ComparisonOperator;
  onChange: (op: ComparisonOperator) => void;
  options: { value: ComparisonOperator; label: string }[];
  className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ComparisonOperator)} className={className ?? 'assertion-select assertion-select-operator'}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
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
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [regexModalIdx, setRegexModalIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!showAddMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAddMenu]);
  const assertions = draft.validation.assertions ?? [];

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

  return (
    <div>
      {/* ── Rich Assertions ────────────────────────────── */}
      <div className="assertions-section">
        <div className="assertions-header">
          <span className="assertions-title">Assertions</span>
          <span className="assertions-hint">Run on every request regardless of validation mode</span>
          <AssertionPresetMenu onImport={importAssertions} />
          <div className="assertions-add-wrap" ref={addMenuRef}>
            <button type="button" className="btn btn-sm btn-accent" onClick={() => setShowAddMenu(!showAddMenu)}>+ Add</button>
            {showAddMenu && (
              <div className="assertions-add-menu">
                <button type="button" onClick={() => addAssertion({ type: 'status', expected: '200' })}>
                  <span className="aam-icon">🔢</span>
                  <span className="aam-label">Status Code</span>
                  <span className="aam-desc">Assert HTTP status (200, 404…)</span>
                </button>
                <button type="button" onClick={() => addAssertion({ type: 'responseTime', maxMs: 500 })}>
                  <span className="aam-icon">⏱</span>
                  <span className="aam-label">Response Time SLA</span>
                  <span className="aam-desc">Set max response time threshold</span>
                </button>
                <button type="button" onClick={() => addAssertion({ type: 'header', name: 'content-type', operator: 'contains', value: 'json' })}>
                  <span className="aam-icon">📋</span>
                  <span className="aam-label">Response Header</span>
                  <span className="aam-desc">Check header name &amp; value</span>
                </button>
                <button type="button" onClick={() => addAssertion({ type: 'regex', jsonPath: '$.name', pattern: '^[A-Z].*' })}>
                  <span className="aam-icon">🔤</span>
                  <span className="aam-label">Regex Match</span>
                  <span className="aam-desc">Quick regex on a JSON path</span>
                </button>
                <div className="aam-divider" />
                <button type="button" onClick={() => { addAssertion({ type: 'regex', jsonPath: '', pattern: '' }); setRegexModalIdx((draft.validation.assertions ?? []).length); }}>
                  <span className="aam-icon">🛠</span>
                  <span className="aam-label">Regex Builder…</span>
                  <span className="aam-desc">Visual builder with pattern library</span>
                </button>
                <div className="aam-divider" />
                <button type="button" onClick={() => addAssertion({ type: 'arrayLength', jsonPath: '', operator: '>=', value: 1 })}>
                  <span className="aam-icon">📏</span>
                  <span className="aam-label">Array Length</span>
                  <span className="aam-desc">Assert array size at a JSON path</span>
                </button>
                <button type="button" onClick={() => addAssertion({ type: 'numeric', jsonPath: '', operator: '=', value: 0 })}>
                  <span className="aam-icon">🔢</span>
                  <span className="aam-label">Numeric Compare</span>
                  <span className="aam-desc">Compare number at a JSON path</span>
                </button>
                <button type="button" onClick={() => addAssertion({ type: 'date', jsonPath: '', operator: '>', reference: { kind: 'today', timezone: 'utc' } })}>
                  <span className="aam-icon">📅</span>
                  <span className="aam-label">Date Compare</span>
                  <span className="aam-desc">Compare date at a JSON path</span>
                </button>
              </div>
            )}
          </div>
        </div>
        {assertions.length > 0 && (
          <div className="assertions-list">
            {assertions.map((a, i) => (
              <div key={i} className="assertion-row">
                <span className={`assertion-type-badge assertion-type-${a.type}`}>
                  {a.type === 'status' ? 'STATUS' : a.type === 'responseTime' ? 'TIME' : a.type === 'header' ? 'HEADER' : a.type === 'regex' ? 'REGEX' : a.type === 'arrayLength' ? 'ARRAY' : a.type === 'numeric' ? 'NUMBER' : 'DATE'}
                </span>
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
                      <input type="date" value={a.reference.iso} onChange={(e) => updateAssertion(i, { reference: { kind: 'fixed', iso: e.target.value } })} className="assertion-input assertion-input-sm" />
                    )}
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
          </div>
          {fetchError && <div className="fetch-error-inline">{fetchError}</div>}
          {pendingFetchResponse && (
            <div className="fetch-confirm-bar">
              <span className="fetch-confirm-msg">New response fetched. You have <strong>{(draft.validation.expectedFields || []).length}</strong> existing rule(s).</span>
              <div className="fetch-confirm-actions">
                <button type="button" className="btn btn-sm btn-accent" onClick={onFetchKeepRules}>Keep Rules &amp; Update Response</button>
                <button type="button" className="btn btn-sm btn-danger" onClick={onFetchReplaceAll}>Replace All</button>
                <button type="button" className="btn btn-sm" onClick={onFetchCancel}>Cancel</button>
              </div>
            </div>
          )}
          <JsonPathBuilder
            sampleJson={draft.validation.sampleJson || ''}
            onSampleJsonChange={(json) => {
              const prev = draftRef.current;
              onDraftChange({ ...prev, validation: { ...prev.validation, sampleJson: json } });
            }}
            selectiveMode={draft.validation.selectiveMode || 'include'}
            expectedFields={draft.validation.expectedFields || []}
            excludedPaths={draft.validation.excludedPaths || []}
            onUpdate={(patch) => {
              const prev = draftRef.current;
              onDraftChange({ ...prev, validation: { ...prev.validation, ...patch } });
            }}
          />

          {(draft.validation.expectedFields || []).length > 0 && (
            <div className="validate-response-section">
              <div className="validate-response-row">
                <button
                  type="button"
                  className="btn btn-sm btn-validate"
                  onClick={() => void onValidateResponse()}
                  disabled={validating}
                >
                  {validating ? 'Validating...' : 'Verify Rules'}
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
                  className="validate-host-input"
                  value={fetchHostOverride}
                  onChange={(e) => setFetchHostOverride(e.target.value)}
                  placeholder={resolvedBaseUrl || 'Enter base URL'}
                  disabled={!fetchHostEnabled}
                />
                {fetchHostEnabled && resolvedBaseUrl && !fetchHostOverride && (
                  <button type="button" className="btn btn-sm" onClick={() => setFetchHostOverride(resolvedBaseUrl)} title="Use Settings base URL">Use Settings</button>
                )}
              </div>
              {validationResult && (
                <div className={`validate-result ${validationResult.passed ? 'validate-pass' : 'validate-fail'}`}>
                  <div className="validate-result-header">
                    <span className={`validate-badge ${validationResult.passed ? 'badge-pass' : 'badge-fail'}`}>
                      {validationResult.passed ? 'PASSED' : 'FAILED'}
                    </span>
                    {validationResult.httpStatus && (
                      <span className="validate-http-status">HTTP {validationResult.httpStatus}</span>
                    )}
                    <span className="validate-summary">
                      {validationResult.passed
                        ? `All ${(draft.validation.expectedFields || []).length} rules matched`
                        : `${validationResult.failures.length} discrepanc${validationResult.failures.length === 1 ? 'y' : 'ies'} found`}
                    </span>
                    <button className="btn btn-xs" onClick={() => setValidationResult(null)}>×</button>
                  </div>
                  {!validationResult.passed && validationResult.failures.length > 0 && (
                    <table className="validate-failures-table">
                      <thead>
                        <tr>
                          <th>Path</th>
                          <th>Expected</th>
                          <th>Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.failures.map((f, i) => (
                          <tr key={i}>
                            <td><code>{f.path}</code></td>
                            <td className="val-expected">{f.expected}</td>
                            <td className="val-actual">{f.actual}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          <ResponseVersionPanel
            versions={draft.validation.responseVersions || []}
            currentJson={draft.validation.sampleJson || ''}
            currentValidation={draft.validation}
            excludedPaths={draft.validation.excludedPaths}
            onSaveVersion={() => {
              const prev = draftRef.current;
              const v = prev.validation;
              const json = v.sampleJson || '';
              if (!json.trim()) return;
              const prevVersions = v.responseVersions || [];
              const newVersion: ResponseVersion = {
                id: uuidv4(), timestamp: Date.now(), json,
                validationMode: v.mode, selectiveMode: v.selectiveMode,
                expectedFields: v.expectedFields ? [...v.expectedFields] : [],
                excludedPaths: v.excludedPaths ? [...v.excludedPaths] : [],
                unorderedArrays: v.unorderedArrays,
              };
              onDraftChange({ ...prev, validation: { ...v, responseVersions: [...prevVersions, newVersion] } });
            }}
            onRestore={(ver) => {
              const prev = draftRef.current;
              onDraftChange({
                ...prev,
                validation: {
                  ...prev.validation,
                  sampleJson: ver.json,
                  mode: ver.validationMode || prev.validation.mode,
                  selectiveMode: ver.selectiveMode || prev.validation.selectiveMode,
                  expectedFields: ver.expectedFields || [],
                  excludedPaths: ver.excludedPaths || prev.validation.excludedPaths || [],
                  unorderedArrays: ver.unorderedArrays ?? prev.validation.unorderedArrays,
                },
              });
            }}
            onDeleteVersion={(id) => {
              const prev = draftRef.current;
              onDraftChange({ ...prev, validation: { ...prev.validation, responseVersions: (prev.validation.responseVersions || []).filter((v) => v.id !== id) } });
            }}
            onRenameVersion={(id, label) => {
              const prev = draftRef.current;
              onDraftChange({ ...prev, validation: { ...prev.validation, responseVersions: (prev.validation.responseVersions || []).map((v) => v.id === id ? { ...v, label } : v) } });
            }}
          />

          <RulesVersionPanel
            versions={draft.validation.rulesVersions || []}
            currentValidation={draft.validation}
            onSaveVersion={() => {
              const prev = draftRef.current;
              const v = prev.validation;
              if (!(v.expectedFields || []).length) return;
              const prevVersions = v.rulesVersions || [];
              const newVersion: RulesVersion = {
                id: uuidv4(), timestamp: Date.now(),
                validationMode: v.mode,
                selectiveMode: v.selectiveMode,
                expectedFields: v.expectedFields ? [...v.expectedFields] : [],
                excludedPaths: v.excludedPaths ? [...v.excludedPaths] : [],
                unorderedArrays: v.unorderedArrays,
              };
              onDraftChange({ ...prev, validation: { ...v, rulesVersions: [...prevVersions, newVersion] } });
            }}
            onRestore={(ver) => {
              const prev = draftRef.current;
              onDraftChange({
                ...prev,
                validation: {
                  ...prev.validation,
                  mode: ver.validationMode || prev.validation.mode,
                  selectiveMode: ver.selectiveMode || prev.validation.selectiveMode,
                  expectedFields: ver.expectedFields || [],
                  excludedPaths: ver.excludedPaths || prev.validation.excludedPaths || [],
                  unorderedArrays: ver.unorderedArrays ?? prev.validation.unorderedArrays,
                },
              });
            }}
            onDeleteVersion={(id) => {
              const prev = draftRef.current;
              onDraftChange({ ...prev, validation: { ...prev.validation, rulesVersions: (prev.validation.rulesVersions || []).filter((v) => v.id !== id) } });
            }}
            onRenameVersion={(id, label) => {
              const prev = draftRef.current;
              onDraftChange({ ...prev, validation: { ...prev.validation, rulesVersions: (prev.validation.rulesVersions || []).map((v) => v.id === id ? { ...v, label } : v) } });
            }}
          />
        </>
      )}

      {regexModalIdx !== null && (() => {
        const a = (draft.validation.assertions ?? [])[regexModalIdx];
        const regexA = a?.type === 'regex' ? a : undefined;
        return (
          <RegexAssertionModal
            initialJsonPath={regexA?.jsonPath || ''}
            initialPattern={regexA?.pattern || ''}
            sampleJson={draft.validation.sampleJson || ''}
            onFetchSampleResponse={onFetchSampleResponse}
            fetchingResponse={fetchingResponse}
            fetchError={fetchError}
            onApply={(result: RegexAssertionResult) => {
              updateAssertion(regexModalIdx, { jsonPath: result.jsonPath, pattern: result.pattern });
              setRegexModalIdx(null);
            }}
            onClose={() => setRegexModalIdx(null)}
          />
        );
      })()}
    </div>
  );
}

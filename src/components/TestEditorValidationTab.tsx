import { useState } from 'react';
import type { MutableRefObject } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Assertion, AssertionOperator, FailureDetail, ResponseVersion, Scenario, ValidationMode } from '../types';
import JsonPathBuilder from './JsonPathBuilder';
import ResponseVersionPanel from './ResponseVersionPanel';

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
}: TestEditorValidationTabProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
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

  return (
    <div>
      {/* ── Rich Assertions ────────────────────────────── */}
      <div className="assertions-section">
        <div className="assertions-header">
          <span className="assertions-title">Assertions</span>
          <span className="assertions-hint">Run on every request regardless of validation mode</span>
          <div className="assertions-add-wrap">
            <button type="button" className="btn btn-sm btn-accent" onClick={() => setShowAddMenu(!showAddMenu)}>+ Add</button>
            {showAddMenu && (
              <div className="assertions-add-menu">
                <button type="button" onClick={() => addAssertion({ type: 'status', expected: '200' })}>Status Code</button>
                <button type="button" onClick={() => addAssertion({ type: 'responseTime', maxMs: 500 })}>Response Time SLA</button>
                <button type="button" onClick={() => addAssertion({ type: 'header', name: 'content-type', operator: 'contains', value: 'json' })}>Response Header</button>
                <button type="button" onClick={() => addAssertion({ type: 'regex', jsonPath: '$.name', pattern: '^[A-Z].*' })}>Regex Match</button>
              </div>
            )}
          </div>
        </div>
        {assertions.length > 0 && (
          <div className="assertions-list">
            {assertions.map((a, i) => (
              <div key={i} className="assertion-row">
                <span className={`assertion-type-badge assertion-type-${a.type}`}>
                  {a.type === 'status' ? 'STATUS' : a.type === 'responseTime' ? 'TIME' : a.type === 'header' ? 'HEADER' : 'REGEX'}
                </span>
                {a.type === 'status' && (
                  <label className="assertion-field">
                    Expected:
                    <input value={a.expected} onChange={(e) => updateAssertion(i, { expected: e.target.value })} placeholder="200, 2xx, 200-299" className="assertion-input" />
                  </label>
                )}
                {a.type === 'responseTime' && (
                  <label className="assertion-field">
                    Max:
                    <input type="number" value={a.maxMs} onChange={(e) => updateAssertion(i, { maxMs: Number(e.target.value) || 0 })} className="assertion-input assertion-input-sm" min={0} />
                    <span className="assertion-unit">ms</span>
                  </label>
                )}
                {a.type === 'header' && (
                  <>
                    <input value={a.name} onChange={(e) => updateAssertion(i, { name: e.target.value })} placeholder="Header name" className="assertion-input" />
                    <select value={a.operator} onChange={(e) => updateAssertion(i, { operator: e.target.value as AssertionOperator })} className="assertion-select">
                      <option value="equals">equals</option>
                      <option value="contains">contains</option>
                      <option value="regex">matches regex</option>
                      <option value="exists">exists</option>
                    </select>
                    {a.operator !== 'exists' && (
                      <input value={a.value ?? ''} onChange={(e) => updateAssertion(i, { value: e.target.value })} placeholder="Expected value" className="assertion-input" />
                    )}
                  </>
                )}
                {a.type === 'regex' && (
                  <>
                    <input value={a.jsonPath} onChange={(e) => updateAssertion(i, { jsonPath: e.target.value })} placeholder="$.path" className="assertion-input" />
                    <span className="assertion-regex-slash">/</span>
                    <input value={a.pattern} onChange={(e) => updateAssertion(i, { pattern: e.target.value })} placeholder="pattern" className="assertion-input" />
                    <span className="assertion-regex-slash">/</span>
                  </>
                )}
                <button type="button" className="btn btn-xs btn-danger" onClick={() => removeAssertion(i)} title="Remove assertion">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── JSON Validation Mode ───────────────────────── */}
      <div className="radio-group">
        {(['none', 'full', 'selective'] as ValidationMode[]).map((m) => (
          <label key={m} className="radio-label">
            <input type="radio" name="validationMode" checked={draft.validation.mode === m} onChange={() => onDraftChange({ ...draft, validation: { ...draft.validation, mode: m } })} />
            {m === 'none' ? 'No Validation' : m === 'full' ? 'Full JSON Match' : 'Selective Fields'}
          </label>
        ))}
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
        </>
      )}
    </div>
  );
}

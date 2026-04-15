import type { MutableRefObject } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FailureDetail, ResponseVersion, Scenario, ValidationMode } from '../types';
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
  return (
    <div>
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

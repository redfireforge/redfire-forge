/**
 * Step 3: Validate — Validation mode, field selection, array ordering.
 * Extracted from DataSourceSetupModal to reduce file size.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Scenario, ExpectedField } from '../../../shared/types';
import JsonPathBuilder from '../../requests/components/JsonPathBuilder';

export interface SetupStepValidateProps {
  validationMode: 'none' | 'selective' | 'full';
  setValidationMode: (mode: 'none' | 'selective' | 'full') => void;
  validateFields: ExpectedField[];
  setValidateFields: Dispatch<SetStateAction<ExpectedField[]>>;
  validateExcluded: string[];
  setValidateExcluded: Dispatch<SetStateAction<string[]>>;
  sampleJson: string;
  setSampleJson: Dispatch<SetStateAction<string>>;
  handleFetchForValidate: () => Promise<void>;
  fetching: boolean;
  fetchError: string | null;
  arrayPrefixes: string[];
  arrayModes: Record<string, 'ordered' | 'unordered'>;
  setArrayModes: Dispatch<SetStateAction<Record<string, 'ordered' | 'unordered'>>>;
  test: Pick<Scenario, 'validation'>;
}

export default function SetupStepValidate({
  validationMode, setValidationMode,
  validateFields, setValidateFields,
  validateExcluded, setValidateExcluded,
  sampleJson, setSampleJson,
  handleFetchForValidate, fetching, fetchError,
  arrayPrefixes, arrayModes, setArrayModes,
  test,
}: SetupStepValidateProps) {
  return (
    <div className="excel-step-content parameterize-validate-step">
      {/* Validation mode selector */}
      <div className="parameterize-validation-mode">
        <div className="parameterize-validation-mode-row">
          <span className="parameterize-validation-mode-label">Validation Mode</span>
          <div className="parameterize-validation-mode-options">
            <label className="parameterize-radio-pill">
              <input type="radio" name="validationMode" value="none" checked={validationMode === 'none'} onChange={() => setValidationMode('none')} />
              <span className="parameterize-radio-pill-label">No Rows</span>
            </label>
            <label className="parameterize-radio-pill">
              <input type="radio" name="validationMode" value="selective" checked={validationMode === 'selective'} onChange={() => setValidationMode('selective')} />
              <span className="parameterize-radio-pill-label">Sample Rows Only</span>
            </label>
            <label className="parameterize-radio-pill">
              <input type="radio" name="validationMode" value="full" checked={validationMode === 'full'} onChange={() => setValidationMode('full')} />
              <span className="parameterize-radio-pill-label">All Rows</span>
            </label>
          </div>
        </div>
        {validateFields.length > 0 && (
          <span className="parameterize-validate-field-count">{validateFields.length} field{validateFields.length !== 1 ? 's' : ''} selected</span>
        )}
      </div>

      {!sampleJson ? (
        <div className="parameterize-fetch-empty">
          <div className="parameterize-fetch-icon">🔍</div>
          <h3>Add Validate Columns</h3>
          <p className="text-muted">
            Fetch a sample response from the API and select which fields to validate per data row.
            This step is optional — you can skip it and add validate columns later.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleFetchForValidate()}
            disabled={fetching}
          >
            {fetching ? '⏳ Fetching…' : '📡 Fetch Sample Response'}
          </button>
          {fetchError && (
            <div className="data-source-fetch-error">
              <span>⚠️ {fetchError}</span>
            </div>
          )}
          {test.validation.sampleJson && (
            <button type="button" className="btn btn-sm" onClick={() => setSampleJson(test.validation.sampleJson!)} style={{ marginTop: 8 }}>
              Or use stored response ({(test.validation.sampleJson.length / 1024).toFixed(1)} KB)
            </button>
          )}
        </div>
      ) : (
        <div className="parameterize-validate-builder">
          <div className="parameterize-validate-toolbar">
            <div className="parameterize-validate-toolbar-left">
              <span className="parameterize-validate-title">Select Validate Fields</span>
              <span className="parameterize-validate-meta">
                {(sampleJson.length / 1024).toFixed(1)} KB response
              </span>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => void handleFetchForValidate()} disabled={fetching}>
              {fetching ? '⏳ Fetching…' : '↻ Re-fetch'}
            </button>
          </div>
          <div className="parameterize-validate-content">
            <JsonPathBuilder
              sampleJson={sampleJson}
              onSampleJsonChange={setSampleJson}
              selectiveMode="include"
              expectedFields={validateFields}
              excludedPaths={validateExcluded}
              onUpdate={(patch) => {
                if (patch.expectedFields) setValidateFields(patch.expectedFields);
                if (patch.excludedPaths) setValidateExcluded(patch.excludedPaths);
              }}
            />
          </div>

          {/* Array ordering mode toggles */}
          {arrayPrefixes.length > 0 && (
            <div className="parameterize-array-modes">
              <div className="parameterize-array-modes-header">
                <span className="parameterize-array-modes-title">Array Validation Order</span>
                <span className="text-muted">How should array items be compared?</span>
              </div>
              {arrayPrefixes.map(prefix => {
                const mode_ = arrayModes[prefix] ?? 'ordered';
                return (
                  <div key={prefix} className="parameterize-array-mode-row">
                    <code className="parameterize-array-mode-path">{prefix}</code>
                    <div className="parameterize-array-mode-toggle">
                      <button
                        type="button"
                        className={`parameterize-mode-btn ${mode_ === 'ordered' ? 'active' : ''}`}
                        onClick={() => setArrayModes(prev => ({ ...prev, [prefix]: 'ordered' }))}
                        title="Ordered: validates by index position (item[0] must match item[0])"
                      >
                        ↕ Ordered
                      </button>
                      <button
                        type="button"
                        className={`parameterize-mode-btn ${mode_ === 'unordered' ? 'active' : ''}`}
                        onClick={() => setArrayModes(prev => ({ ...prev, [prefix]: 'unordered' }))}
                        title="Unordered: validates values exist anywhere in the array"
                      >
                        ⟳ Unordered
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

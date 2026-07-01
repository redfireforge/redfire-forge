/**
 * Step 3: Validate — Validation mode, field selection, array ordering.
 * Extracted from DataSourceSetupModal to reduce file size.
 */
import { useState, useMemo, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Scenario, ExpectedField } from '../../../shared/types';
import type { FetchErrorDetail } from '../../../shared/components/data-mapper/types';
import FetchErrorBanner from '../../../shared/components/data-mapper/FetchErrorBanner';
import {
  DataMapperModal,
  createValidationAdapter,
} from '../../../shared/components/data-mapper';
import type { ValidationAdapterOutput } from '../../../shared/components/data-mapper';

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
  fetchError: FetchErrorDetail | null;
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
  const [mapperOpen, setMapperOpen] = useState(false);

  const validationAdapter = useMemo(
    () => createValidationAdapter({
      sampleResponseBody: sampleJson || undefined,
      selectiveMode: 'include',
    }),
    [sampleJson],
  );

  const mapperInitialData = useMemo<ValidationAdapterOutput>(() => ({
    selectiveMode: 'include',
    expectedFields: validateFields,
    excludedPaths: validateExcluded,
  }), [validateFields, validateExcluded]);

  const handleMapperSave = useCallback((output: ValidationAdapterOutput, options?: { unorderedArrays?: boolean }) => {
    setValidateFields(output.expectedFields);
    setValidateExcluded(output.excludedPaths);
    if (options?.unorderedArrays !== undefined) {
      const mode = options.unorderedArrays ? 'unordered' as const : 'ordered' as const;
      setArrayModes((prev) => {
        const next: Record<string, 'ordered' | 'unordered'> = {};
        for (const key of Object.keys(prev)) next[key] = mode;
        for (const prefix of arrayPrefixes) next[prefix] = mode;
        return next;
      });
    }
    setMapperOpen(false);
  }, [setValidateFields, setValidateExcluded, setArrayModes, arrayPrefixes]);

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
          {fetchError && <FetchErrorBanner error={fetchError} />}
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
            <div className="validation-mapper-toggle">
              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={() => setMapperOpen(true)}
              >
                ⚡ Data Mapper
              </button>
            </div>
            {validateFields.length > 0 && (
              <div className="validation-fields-summary">
                <table className="validation-fields-table">
                  <thead>
                    <tr><th>JSON Path</th><th>Operator</th><th>Expected Value</th><th /></tr>
                  </thead>
                  <tbody>
                    {validateFields.map((f: ExpectedField, idx: number) => (
                      <tr key={idx}>
                        <td><code>{f.jsonPath}</code></td>
                        <td>
                          <span className={`validation-field-op-badge validation-field-op-badge--${f.operator ?? 'equals'}`}>
                            {f.operator ? f.operator.replace(/_/g, ' ') : 'equals'}
                          </span>
                        </td>
                        <td><code>{f.operatorValue ?? f.expectedValue}</code></td>
                        <td>
                          <button type="button" className="btn-icon-sm" title="Remove" onClick={() => {
                            const next = [...validateFields];
                            next.splice(idx, 1);
                            setValidateFields(next);
                          }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {mapperOpen && (
            <DataMapperModal
              adapter={validationAdapter}
              initialData={mapperInitialData}
              onSave={handleMapperSave}
              onCancel={() => setMapperOpen(false)}
              unorderedArrays={Object.values(arrayModes).some((m) => m === 'unordered')}
              contextScope="setup-wizard"
            />
          )}

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

/**
 * Step 5: Review & Create — Summary of all configuration before finalizing.
 * Extracted from DataSourceSetupModal to reduce file size.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Scenario, FeatureGroup, TestScenario } from '@shared/types';
import type { ColumnDef } from '../utils/csvTemplate';
import { formatAuthLabel } from '../utils/dataSourceSetupUtils';
import { CustomSelect } from '@shared/components/CustomSelect';

export interface SetupStepReviewProps {
  copyName: string;
  setCopyName: Dispatch<SetStateAction<string>>;
  featureGroups?: FeatureGroup[];
  targetFgId: string;
  setTargetFgId: Dispatch<SetStateAction<string>>;
  targetScenarioId: string;
  setTargetScenarioId: Dispatch<SetStateAction<string>>;
  newScenarioName: string;
  setNewScenarioName: Dispatch<SetStateAction<string>>;
  targetFg: FeatureGroup | undefined;
  targetScenario: TestScenario | undefined;
  workingAuth: Scenario['auth'];
  validationModeLabel: string;
  validateFieldCount: number;
  reviewPathVariables: { variableName: string; sourceValue: string }[];
  queryParamsForReview: ColumnDef[];
  inputColumnsForReview: ColumnDef[];
  validateColumnsForReview: ColumnDef[];
  buildUrlTemplate: () => string;
  arrayPrefixes: string[];
  arrayModes: Record<string, 'ordered' | 'unordered'>;
  testName: string;
  columnDefs: ColumnDef[];
}

export default function SetupStepReview({
  copyName, setCopyName,
  featureGroups, targetFgId, setTargetFgId,
  targetScenarioId, setTargetScenarioId,
  newScenarioName, setNewScenarioName,
  targetFg, targetScenario,
  workingAuth, validationModeLabel, validateFieldCount,
  reviewPathVariables, queryParamsForReview,
  inputColumnsForReview, validateColumnsForReview,
  buildUrlTemplate,
  arrayPrefixes, arrayModes,
  testName, columnDefs,
}: SetupStepReviewProps) {
  const CREATE_NEW = '__new__';
  const paramScenarios = (targetFg?.scenarios ?? []).filter(sc => sc.kind === 'parameterized');
  const scenarioOptions = [
    { value: CREATE_NEW, label: '+ Create new Parameterized Scenario' },
    ...paramScenarios.map(sc => ({ value: sc.id, label: sc.name })),
  ];
  const isCreatingNew = targetScenarioId === CREATE_NEW;
  return (
    <div className="excel-step-content parameterize-create-step">
      <div className="review-page-header">
        <div className="csv-panel-title">Review &amp; Create</div>
        <div className="review-page-stats">
          <span className="review-stat">{columnDefs.filter(d => d.type !== 'validate').length} input</span>
          <span className="review-stat review-stat-validate">{columnDefs.filter(d => d.type === 'validate').length} validate</span>
          <span className="review-stat review-stat-vars">{reviewPathVariables.length + queryParamsForReview.length} vars</span>
        </div>
      </div>

      <div className="parameterize-create-form">
        <div className="review-form-row">
          <label className="parameterize-form-label">
            Test Name
            <input
              type="text"
              className="parameterize-name-input"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              placeholder="Name for the parameterized test"
            />
          </label>
          {featureGroups && featureGroups.length > 0 && (
            <>
              <label className="parameterize-form-label">
                Feature Group
                <CustomSelect
                  className="parameterize-select"
                  value={targetFgId}
                  onChange={(v) => {
                    setTargetFgId(v);
                    const fg = featureGroups.find((f) => f.id === v);
                    const firstParam = fg?.scenarios.find(sc => sc.kind === 'parameterized');
                    setTargetScenarioId(firstParam ? firstParam.id : CREATE_NEW);
                  }}
                  options={featureGroups.map((fg) => ({ value: fg.id, label: fg.name }))}
                />
              </label>
              <label className="parameterize-form-label">
                Parameterized Scenario
                <CustomSelect
                  className="parameterize-select"
                  value={targetScenarioId}
                  onChange={(v) => setTargetScenarioId(v)}
                  options={scenarioOptions}
                />
              </label>
              {isCreatingNew && (
                <label className="parameterize-form-label">
                  New Scenario Name
                  <input
                    data-testid="param-new-scenario-name-input"
                    type="text"
                    className="parameterize-name-input"
                    value={newScenarioName}
                    onChange={(e) => setNewScenarioName(e.target.value)}
                    placeholder="Parameterized Scenario name"
                  />
                </label>
              )}
            </>
          )}
        </div>

        <div className="review-cards-grid">
          <div className="parameterize-summary">
            <div className="parameterize-summary-header">
              <div className="csv-panel-title">Configuration</div>
            </div>
            <div className="parameterize-summary-items">
              <div className="parameterize-summary-item">
                <span className="parameterize-summary-label">Auth</span>
                <span className="parameterize-summary-value">{formatAuthLabel(workingAuth)}</span>
              </div>
              <div className="parameterize-summary-item">
                <span className="parameterize-summary-label">Validation Mode</span>
                <span className="parameterize-summary-value">{validationModeLabel}</span>
              </div>
              <div className="parameterize-summary-item">
                <span className="parameterize-summary-label">Validate Rules</span>
                <span className="parameterize-summary-value">{validateFieldCount} field{validateFieldCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="parameterize-summary-item">
                <span className="parameterize-summary-label">Initial Row</span>
                <span className="parameterize-summary-value">1 row from current test</span>
              </div>
            </div>
          </div>

          <div className="parameterize-summary">
            <div className="parameterize-summary-header">
              <div className="csv-panel-title">Variables &amp; URL Template</div>
            </div>
            <div className="parameterize-summary-items">
              {reviewPathVariables.length > 0 && (
                <div className="parameterize-summary-item review-section-label">
                  <span className="parameterize-summary-label">Path Variables</span>
                  <span className="parameterize-summary-value">{reviewPathVariables.length}</span>
                </div>
              )}
              {reviewPathVariables.map(v => (
                <div key={`pv-${v.variableName}`} className="parameterize-summary-item">
                  <span className="parameterize-summary-label">{v.variableName}</span>
                  <span className="parameterize-summary-value">{`{{${v.variableName}}}`}</span>
                </div>
              ))}
              {queryParamsForReview.length > 0 && (
                <div className="parameterize-summary-item review-section-label">
                  <span className="parameterize-summary-label">Query Variables</span>
                  <span className="parameterize-summary-value">{queryParamsForReview.length}</span>
                </div>
              )}
              {queryParamsForReview.map(col => (
                <div key={`qp-${col.mapping}`} className="parameterize-summary-item">
                  <span className="parameterize-summary-label">{col.mapping}</span>
                  <span className="parameterize-summary-value">{`{{${col.customName.trim()}}}`}</span>
                </div>
              ))}
              <div className="parameterize-summary-item review-url-row">
                <span className="parameterize-summary-label">URL Template</span>
                <span className="parameterize-summary-value review-url-value">{buildUrlTemplate()}</span>
              </div>
            </div>
          </div>

          <div className="parameterize-summary">
            <div className="parameterize-summary-header">
              <div className="csv-panel-title">Column Mapping</div>
            </div>
            <div className="parameterize-summary-items">
              {inputColumnsForReview.map(col => (
                <div key={`in-${col.type}-${col.mapping}`} className="parameterize-summary-item">
                  <span className="parameterize-summary-label"><span className={`review-type-tag review-type-${col.type}`}>{col.type}</span> {col.mapping}</span>
                  <span className="parameterize-summary-value">{col.customName.trim()}</span>
                </div>
              ))}
              {inputColumnsForReview.length === 0 && (
                <div className="parameterize-summary-item">
                  <span className="parameterize-summary-label">Input Columns</span>
                  <span className="parameterize-summary-value">None</span>
                </div>
              )}
            </div>
          </div>

          <div className="parameterize-summary">
            <div className="parameterize-summary-header">
              <div className="csv-panel-title">Validate Rules</div>
            </div>
            <div className="parameterize-summary-items">
              <div className="parameterize-summary-item">
                <span className="parameterize-summary-label">Mode</span>
                <span className="parameterize-summary-value">{validationModeLabel}</span>
              </div>
              {validateColumnsForReview.slice(0, 10).map(col => (
                <div key={`val-${col.mapping}`} className="parameterize-summary-item">
                  <span className="parameterize-summary-label">{col.mapping}</span>
                  <span className="parameterize-summary-value">{col.customName.trim()}</span>
                </div>
              ))}
              {validateColumnsForReview.length > 10 && (
                <div className="parameterize-summary-item">
                  <span className="parameterize-summary-label" style={{ fontStyle: 'italic' }}>+ {validateColumnsForReview.length - 10} more</span>
                  <span className="parameterize-summary-value"></span>
                </div>
              )}
              {arrayPrefixes.map(prefix => (
                <div key={`arr-${prefix}`} className="parameterize-summary-item">
                  <span className="parameterize-summary-label"><span className="review-type-tag review-type-array">array</span> {prefix}</span>
                  <span className="parameterize-summary-value">{(arrayModes[prefix] ?? 'ordered') === 'unordered' ? 'Unordered' : 'Ordered'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {targetFg && targetScenario && (
          <div className="parameterize-tree-preview">
            <div className="csv-panel-title">File Location</div>
            <div className="parameterize-tree">
              <div className="parameterize-tree-node">📁 {targetFg.name}</div>
              <div className="parameterize-tree-node parameterize-tree-indent">📂 {targetScenario.name}</div>
              <div className="parameterize-tree-node parameterize-tree-indent2">🔗 {testName} <span className="text-muted">← original</span></div>
              <div className="parameterize-tree-node parameterize-tree-indent2 parameterize-tree-new">📋 {copyName} <span className="parameterize-tree-badge">NEW</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

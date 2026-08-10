/**
 * Unified Data Source Setup / Export Template modal.
 *
 * Wizard steps:
 *  1. Path Variables — pick which URL segments are variables
 *  2. Columns — configure column names and types
 *  3. Apply (saves to inline data source) or Export (downloads .xlsx)
 *
 * All state and logic live in useDataSourceSetupState.
 */
import FullPanelModal from '../../../shared/components/FullPanelModal';
import SetupStepVariables from './SetupStepVariables';
import SetupStepValidate from './SetupStepValidate';
import SetupStepReview from './SetupStepReview';
import { DataSourceSetupColumnsStep, DataSourceSetupColumnOrderStep } from './DataSourceSetupColumnsStep';
import {
  useDataSourceSetupState,
  type DataSourceSetupProps,
} from '../hooks/useDataSourceSetupState';

export type { SetupMode } from '../hooks/useDataSourceSetupState';

export default function DataSourceSetupModal(props: DataSourceSetupProps) {
  const { test, mode, onClose } = props;
  const s = useDataSourceSetupState(props);

  const isParamMode = s.isParamMode;
  const {
    step, setStep, stepLabels, currentStepIdx, prevStep, prevStepLabel,
    columnNamesValid, copyName,
    handleClose, handleApply, handleExport,
    enterStep2, enterStep3Validate, enterStep4Create,
  } = s;

  return (
    <FullPanelModal
      title={(
        <div className="ds-setup-title-block">
          <div className="ds-setup-title">
            {isParamMode ? 'Create Parameterized Copy' : mode === 'export' ? 'Export Template' : 'Configure Data Source'}
          </div>
          <span className="csv-export-subtitle ds-setup-subtitle">
            <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span>
            <span className="ds-setup-subtitle-name">{test.name}</span>
          </span>
        </div>
      )}
      onClose={handleClose}
      overlayClassName="ds-setup-overlay"
      dialogClassName="ds-setup-dialog"
      movable
      resizable
      bodyScrollable={false}
      minWidth={640}
      minHeight={420}
      footer={(
        <>
          {prevStep && (
            <button className="btn" onClick={() => setStep(prevStep)}>
              {prevStepLabel ? `Back: ${prevStepLabel}` : 'Back'}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          {step === 'variables' && (
            <button className="btn btn-primary" onClick={enterStep2}>
              Next: Columns
            </button>
          )}
          {step === 'columns' && !isParamMode && (
            <>
              {mode === 'export' && (
                <button className="btn btn-primary" onClick={handleExport} disabled={!columnNamesValid}>
                  Export .xlsx
                </button>
              )}
              <button className="btn btn-primary" onClick={handleApply} disabled={!columnNamesValid}>
                {mode === 'export' ? 'Apply & Close' : 'Apply to Data Source'}
              </button>
            </>
          )}
          {step === 'columns' && isParamMode && (
            <button className="btn btn-primary" onClick={enterStep3Validate} disabled={!columnNamesValid}>
              Next: Validate Fields
            </button>
          )}
          {step === 'validate' && isParamMode && (
            <button className="btn btn-primary" onClick={() => { enterStep4Create(); setStep('order'); }}>
              Next: Column Order
            </button>
          )}
          {step === 'order' && isParamMode && (
            <button className="btn btn-primary" onClick={() => setStep('create')}>
              Next: Review
            </button>
          )}
          {step === 'create' && isParamMode && (
            <button className="btn btn-primary" onClick={handleApply} disabled={!columnNamesValid || !copyName.trim()}>
              Create & Open
            </button>
          )}
        </>
      )}
    >
      <div className="ds-setup-layout">
        <nav className="ds-setup-steps" aria-label="Setup steps">
          {stepLabels.map((sl, i) => {
            const isActive = step === sl.key;
            const isDone = currentStepIdx > i;
            return (
              <div key={sl.key} className="ds-setup-step-wrap">
                {i > 0 && <div className={`ds-setup-step-connector ${isDone || isActive ? 'is-complete' : ''}`} aria-hidden />}
                <div
                  className={`ds-setup-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="ds-setup-step-num">{isDone ? '✓' : sl.num}</span>
                  <span className="ds-setup-step-label">{sl.label}</span>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="ds-setup-content csv-export-body">
          {/* ==================== Step 1: Path Variables ==================== */}
          {step === 'variables' && (
            <SetupStepVariables
              analysis={s.analysis}
              selections={s.selections}
              toggleSegment={s.toggleSegment}
              setVarName={s.setVarName}
              autoUrlTemplate={s.autoUrlTemplate}
              urlTemplateInput={s.urlTemplateInput}
              setUrlTemplateInput={s.setUrlTemplateInput}
              isTemplateCustomized={s.isTemplateCustomized}
              setIsTemplateCustomized={s.setIsTemplateCustomized}
              urlParams={s.urlParams}
              paramSelections={s.paramSelections}
              setParamSelection={s.setParamSelection}
              headerCandidates={s.headerCandidates}
              headerSelections={s.headerSelections}
              setHeaderSelection={s.setHeaderSelection}
              bodyVariableCandidates={s.bodyVariableCandidates}
              bodySelections={s.bodySelections}
              setBodySelection={s.setBodySelection}
              workingAuth={s.workingAuth}
              setWorkingAuthType={s.setWorkingAuthType}
              patchWorkingAuth={s.patchWorkingAuth}
              test={test}
            />
          )}

          {/* ==================== Step 2: Columns ==================== */}
          {step === 'columns' && (
            <DataSourceSetupColumnsStep
              columnDefs={s.columnDefs}
              duplicateNames={s.duplicateNames}
              contractPatterns={s.contractPatterns}
              setContractPatterns={s.setContractPatterns}
              showColOrder={s.showColOrder}
              setShowColOrder={s.setShowColOrder}
              updateColumnName={s.updateColumnName}
              setColumnDefs={s.setColumnDefs}
            />
          )}

          {/* ==================== Step 3: Validate Fields (parameterize mode) ==================== */}
          {step === 'validate' && isParamMode && (
            <SetupStepValidate
              validationMode={s.validationMode}
              setValidationMode={s.setValidationMode}
              validateFields={s.validateFields}
              setValidateFields={s.setValidateFields}
              validateExcluded={s.validateExcluded}
              setValidateExcluded={s.setValidateExcluded}
              sampleJson={s.sampleJson}
              setSampleJson={s.setSampleJson}
              handleFetchForValidate={s.handleFetchForValidate}
              fetching={s.fetching}
              fetchError={s.fetchError}
              arrayPrefixes={s.arrayPrefixes}
              arrayModes={s.arrayModes}
              setArrayModes={s.setArrayModes}
              test={test}
            />
          )}

          {/* ==================== Step 4: Column Order (parameterize mode) ==================== */}
          {step === 'order' && isParamMode && (
            <DataSourceSetupColumnOrderStep
              columnDefs={s.columnDefs}
              setColumnDefs={s.setColumnDefs}
            />
          )}

          {/* ==================== Step 5: Review & Create (parameterize mode) ==================== */}
          {step === 'create' && isParamMode && (
            <SetupStepReview
              copyName={s.copyName}
              setCopyName={s.setCopyName}
              featureGroups={props.featureGroups}
              targetFgId={s.targetFgId}
              setTargetFgId={s.setTargetFgId}
              targetScenarioId={s.targetScenarioId}
              setTargetScenarioId={s.setTargetScenarioId}
              newScenarioName={s.newScenarioName}
              setNewScenarioName={s.setNewScenarioName}
              targetFg={s.targetFg}
              targetScenario={s.targetScenario}
              workingAuth={s.workingAuth}
              validationModeLabel={s.validationModeLabel}
              validateFieldCount={s.validateFields.length}
              reviewPathVariables={s.reviewPathVariables}
              queryParamsForReview={s.queryParamsForReview}
              inputColumnsForReview={s.inputColumnsForReview}
              validateColumnsForReview={s.validateColumnsForReview}
              buildUrlTemplate={s.getReviewUrlTemplate}
              arrayPrefixes={s.arrayPrefixes}
              arrayModes={s.arrayModes}
              testName={test.name}
              columnDefs={s.columnDefs}
            />
          )}
        </div>
      </div>
    </FullPanelModal>
  );
}


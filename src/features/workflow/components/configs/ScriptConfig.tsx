import { useState } from 'react';
import type { ScriptNodeData, ScriptMode } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import ScriptCodeEditor from './ScriptCodeEditor';
import ScriptCodeModal from './ScriptCodeModal';
import ScriptTemplateGallery from './ScriptTemplateGallery';
import ScriptLibraryManager from './ScriptLibraryManager';
import ScriptTestResult from './ScriptTestResult';
import { SCRIPT_MODE_OPTIONS, useScriptTest } from './useScriptTest';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { saveScriptLibraries } from '../../engine/scriptLibraries';
import type { ScriptTemplate } from '../../engine/scriptTemplates';
import type { ScriptLibrary } from '../../engine/scriptLibraries';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';

export default function ScriptConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
  workflowVariables = {},
}: {
  data: ScriptNodeData;
  onChange: (d: ScriptNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
  workflowVariables?: Record<string, string>;
}) {
  const {
    testResult, mockInputs, libraries,
    inferredDefaults, complexityWarnings,
    handleTestScript, handleAutoDetect, handleMockInputChange,
  } = useScriptTest(data, workflowVariables);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLibraries, setShowLibraries] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [localLibraries, setLocalLibraries] = useState<ScriptLibrary[]>(libraries);

  const handleAddInputVar = () => {
    onChange({ ...data, inputVariables: [...data.inputVariables, ''] });
  };

  const handleRemoveInputVar = (index: number) => {
    onChange({ ...data, inputVariables: data.inputVariables.filter((_, i) => i !== index) });
  };

  const handleInputVarChange = (index: number, value: string) => {
    const updated = [...data.inputVariables];
    updated[index] = value;
    onChange({ ...data, inputVariables: updated });
  };

  const handleAddOutputVar = () => {
    onChange({ ...data, outputVariables: [...data.outputVariables, ''] });
  };

  const handleRemoveOutputVar = (index: number) => {
    onChange({ ...data, outputVariables: data.outputVariables.filter((_, i) => i !== index) });
  };

  const handleOutputVarChange = (index: number, value: string) => {
    const updated = [...data.outputVariables];
    updated[index] = value;
    onChange({ ...data, outputVariables: updated });
  };

  const handleAutoDetectOutputs = () => {
    const detected = handleAutoDetect();
    if (detected.length > 0) {
      onChange({ ...data, outputVariables: detected });
    }
  };

  const handleApplyTemplate = (template: ScriptTemplate) => {
    onChange({
      ...data,
      code: template.code,
      mode: template.mode,
      inputVariables: template.inputVariables,
      outputVariables: template.outputVariables,
    });
    setShowTemplates(false);
  };

  const handleLibrariesChange = (updated: ScriptLibrary[]) => {
    setLocalLibraries(updated);
    saveScriptLibraries(updated);
  };

  const handleLibrarySelectionChange = (ids: string[]) => {
    onChange({ ...data, libraryIds: ids });
  };

  const modeHint = SCRIPT_MODE_OPTIONS.find((o) => o.value === data.mode)?.description;

  return (
    <div className="wf-config-body wf-script-config" data-testid="script-config">
      <KafkaCard title="Script" hint="Run sandboxed JavaScript against workflow variables.">
        <div className="wf-kafka-form wf-kafka-form--script">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Script label"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Mode" hint={modeHint} compact>
            <div className="wf-script-mode-ctrl">
              <CustomSelect
                value={data.mode}
                onChange={(v) => onChange({ ...data, mode: v as ScriptMode })}
                options={SCRIPT_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                menuMinWidth={200}
                aria-label="Script mode"
              />
            </div>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Code"
        hint="JavaScript — read input.varName, write output.varName."
        action={(
          <div className="wf-script-card-actions">
            <button
              type="button"
              className={`wf-script-tool-btn${showTemplates ? ' is-active' : ''}`}
              onClick={() => {
                setShowTemplates((v) => !v);
                if (!showTemplates) setShowLibraries(false);
              }}
            >
              {showTemplates ? 'Hide Templates' : 'Templates'}
            </button>
            <button
              type="button"
              className={`wf-script-tool-btn${showLibraries ? ' is-active' : ''}`}
              onClick={() => {
                setShowLibraries((v) => !v);
                if (!showLibraries) setShowTemplates(false);
              }}
            >
              {showLibraries ? 'Hide Libraries' : 'Libraries'}
            </button>
            <button
              type="button"
              className="wf-script-tool-btn wf-script-tool-btn--primary"
              onClick={() => setShowCodeModal(true)}
              title="Open full-screen editor with test panel"
            >
              <svg className="wf-inline-icon" viewBox="0 0 24 24">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              {' '}
              Open Editor
            </button>
          </div>
        )}
      >
        {showTemplates && (
          <div className="wf-script-panel-slot">
            <ScriptTemplateGallery
              onSelect={handleApplyTemplate}
              onClose={() => setShowTemplates(false)}
            />
          </div>
        )}

        {showLibraries && (
          <div className="wf-script-panel-slot">
            <ScriptLibraryManager
              libraries={localLibraries}
              selectedIds={data.libraryIds ?? []}
              onLibrariesChange={handleLibrariesChange}
              onSelectionChange={handleLibrarySelectionChange}
              onClose={() => setShowLibraries(false)}
            />
          </div>
        )}

        <div className="wf-script-code-block">
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            shortRef
            onInsert={(snippet) => onChange({ ...data, code: data.code + snippet })}
          >
            <ScriptCodeEditor
              value={data.code}
              onChange={(code) => onChange({ ...data, code })}
              inputVariables={data.inputVariables}
              outputVariables={data.outputVariables}
            />
          </InsertVarField>
        </div>

        {complexityWarnings.length > 0 && (
          <div className="wf-script-warnings">
            {complexityWarnings.map((w, i) => (
              <div key={i} className="wf-script-warning">
                <svg className="wf-inline-icon" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {' '}
                {w}
              </div>
            ))}
          </div>
        )}
      </KafkaCard>

      <KafkaCard
        title="Input Variables"
        hint="Available in the script as input.varName."
        action={<KafkaAddButton label="+ Add Input Variable" onClick={handleAddInputVar} />}
      >
        {data.inputVariables.length === 0 ? (
          <KafkaEmptyState
            title="No input variables"
            text="Add names for workflow values the script should read."
          />
        ) : (
          <div className="wf-script-var-list">
            {data.inputVariables.map((v, i) => (
              <div key={i} className="wf-script-var-row">
                <span className="wf-script-var-idx" aria-hidden="true">{i + 1}</span>
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  value={v}
                  onChange={(e) => handleInputVarChange(i, e.target.value)}
                  placeholder="Variable name"
                  aria-label={`Input variable ${i + 1}`}
                />
                <button
                  type="button"
                  className="wf-script-var-remove"
                  onClick={() => handleRemoveInputVar(i)}
                  title="Remove"
                  aria-label={`Remove input variable ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </KafkaCard>

      <KafkaCard
        title="Output Variables"
        hint="Written via output.varName and exported back to the workflow."
        action={(
          <div className="wf-script-card-actions">
            <KafkaAddButton
              label="Auto-detect from code"
              onClick={handleAutoDetectOutputs}
            />
            <KafkaAddButton label="+ Add Output Variable" onClick={handleAddOutputVar} />
          </div>
        )}
      >
        {data.outputVariables.length === 0 ? (
          <KafkaEmptyState
            title="No output variables"
            text="Add names or auto-detect output.xxx assignments from the code."
          />
        ) : (
          <div className="wf-script-var-list">
            {data.outputVariables.map((v, i) => (
              <div key={i} className="wf-script-var-row">
                <span className="wf-script-var-idx" aria-hidden="true">{i + 1}</span>
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  value={v}
                  onChange={(e) => handleOutputVarChange(i, e.target.value)}
                  placeholder="Variable name"
                  aria-label={`Output variable ${i + 1}`}
                />
                <button
                  type="button"
                  className="wf-script-var-remove"
                  onClick={() => handleRemoveOutputVar(i)}
                  title="Remove"
                  aria-label={`Remove output variable ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </KafkaCard>

      <KafkaCard title="Runtime" hint="Execution limits and console capture.">
        <div className="wf-kafka-form wf-kafka-form--script wf-kafka-form--script-runtime">
          <KafkaFormRow label="Timeout" hint="Max execution time (100–30000)." compact>
            <div className="wf-script-timeout-ctrl">
              <input
                className="wf-kafka-form-input"
                type="number"
                min={100}
                max={30000}
                value={data.timeoutMs}
                onChange={(e) =>
                  onChange({
                    ...data,
                    timeoutMs: Math.max(100, Math.min(30000, Number(e.target.value) || 5000)),
                  })
                }
                aria-label="Script timeout"
              />
              <span className="unit">ms</span>
            </div>
          </KafkaFormRow>

          <KafkaFormRow label="Console" hint="Capture console.log() into workflow logs." compact>
            <label className="wf-script-checkbox">
              <input
                type="checkbox"
                checked={data.captureConsole}
                onChange={(e) => onChange({ ...data, captureConsole: e.target.checked })}
              />
              Capture console output
            </label>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Test"
        hint="Run the script with sample inputs before saving."
        action={(
          <button type="button" className="wf-script-test-btn" onClick={handleTestScript}>
            ▶ Test Script
          </button>
        )}
      >
        {data.inputVariables.filter(Boolean).length > 0 ? (
          <div className="wf-script-test-panel">
            <div className="wf-script-test-panel-title">Test Inputs</div>
            <p className="wf-script-test-panel-hint">
              Provide sample values. JSON inputs should be valid JSON (e.g. <code>{'{}'}</code>).
            </p>
            {data.inputVariables.filter(Boolean).map((v) => (
              <div key={v} className="wf-script-test-input-row">
                <label className="wf-script-test-input-label">{v}</label>
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  value={mockInputs[v] ?? ''}
                  onChange={(e) => handleMockInputChange(v, e.target.value)}
                  placeholder={
                    inferredDefaults[v]
                      ? `default: ${
                          inferredDefaults[v].length > 40
                            ? `${inferredDefaults[v].slice(0, 37)}…`
                            : inferredDefaults[v]
                        }`
                      : 'Sample value'
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <KafkaEmptyState
            title="Ready to test"
            text="No input variables — run with an empty input object."
          />
        )}
        {testResult && (
          <div className="wf-script-test-result-slot">
            <ScriptTestResult result={testResult} maxOutputLength={100} />
          </div>
        )}
      </KafkaCard>

      <AvailableVariables hints={variableHints} />

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <ul>
          <li>Input variables are passed as a read-only <code>input</code> object.</li>
          <li>Set output values on the <code>output</code> object (e.g. <code>output.result = &quot;ok&quot;</code>).</li>
          <li>In <strong>Validate</strong> mode, set <code>output.result</code> to <code>true</code>/<code>false</code>.</li>
          <li>The script runs in a sandboxed environment with no access to DOM, network, or file system.</li>
          <li>Maximum output size: 1 MB total across all output variables.</li>
        </ul>
      </div>

      {showCodeModal && (
        <ScriptCodeModal
          data={data}
          onSave={(updated) => onChange(updated)}
          onClose={() => setShowCodeModal(false)}
          onRequestVariableInsert={onRequestVariableInsert}
          workflowVariables={workflowVariables}
        />
      )}
    </div>
  );
}

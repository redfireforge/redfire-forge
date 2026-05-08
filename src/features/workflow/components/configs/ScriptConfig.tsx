import { useState } from 'react';
import type { ScriptNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import ScriptCodeEditor from './ScriptCodeEditor';
import ScriptCodeModal from './ScriptCodeModal';
import ScriptTemplateGallery from './ScriptTemplateGallery';
import ScriptLibraryManager from './ScriptLibraryManager';
import ScriptTestResult from './ScriptTestResult';
import { SCRIPT_MODE_OPTIONS, useScriptTest } from './useScriptTest';
import { saveScriptLibraries } from '../../engine/scriptLibraries';
import type { ScriptTemplate } from '../../engine/scriptTemplates';
import type { ScriptLibrary } from '../../engine/scriptLibraries';

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

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Mode</label>
        <select
          value={data.mode}
          onChange={(e) => onChange({ ...data, mode: e.target.value as import('../../types/workflow').ScriptMode })}
        >
          {SCRIPT_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="wf-config-hint">
          {SCRIPT_MODE_OPTIONS.find(o => o.value === data.mode)?.description}
        </span>
      </div>

      <div className="wf-config-field">
        <div className="wf-config-button-row">
          <button className="wf-config-add-btn" onClick={() => setShowTemplates(!showTemplates)}>
            {showTemplates ? 'Hide Templates' : 'Templates'}
          </button>
          <button className="wf-config-add-btn" onClick={() => setShowLibraries(!showLibraries)}>
            {showLibraries ? 'Hide Libraries' : 'Libraries'}
          </button>
        </div>
      </div>

      {showTemplates && (
        <ScriptTemplateGallery
          onSelect={handleApplyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showLibraries && (
        <ScriptLibraryManager
          libraries={localLibraries}
          selectedIds={data.libraryIds ?? []}
          onLibrariesChange={handleLibrariesChange}
          onSelectionChange={handleLibrarySelectionChange}
          onClose={() => setShowLibraries(false)}
        />
      )}

      <div className="wf-config-field">
        <label>Script Code</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          onInsert={(snippet) => onChange({ ...data, code: data.code + snippet })}
        >
          <ScriptCodeEditor
            value={data.code}
            onChange={(code) => onChange({ ...data, code })}
            inputVariables={data.inputVariables}
            outputVariables={data.outputVariables}
          />
        </InsertVarField>
        <div className="wf-config-button-row" style={{ marginTop: 4 }}>
          <button className="wf-config-add-btn" onClick={() => setShowCodeModal(true)} title="Open full-screen editor with test panel">
            <svg className="wf-inline-icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> Open Editor
          </button>
        </div>
        <span className="wf-config-hint">
          JavaScript code. Use <code>input.varName</code> to read and <code>output.varName</code> to write variables.
        </span>
      </div>

      {complexityWarnings.length > 0 && (
        <div className="wf-config-field">
          <div className="wf-script-warnings">
            {complexityWarnings.map((w, i) => (
              <div key={i} className="wf-script-warning"><svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {w}</div>
            ))}
          </div>
        </div>
      )}

      <div className="wf-config-field">
        <label>Input Variables</label>
        {data.inputVariables.map((v, i) => (
          <div key={i} className="wf-config-list-row">
            <input
              value={v}
              onChange={(e) => handleInputVarChange(i, e.target.value)}
              placeholder="Variable name"
            />
            <button className="wf-config-remove-btn" onClick={() => handleRemoveInputVar(i)} title="Remove">✕</button>
          </div>
        ))}
        <button className="wf-config-add-btn" onClick={handleAddInputVar}>+ Add Input Variable</button>
        <span className="wf-config-hint">
          Workflow variables passed into the script as <code>input.varName</code>.
        </span>
      </div>

      <div className="wf-config-field">
        <label>Output Variables</label>
        {data.outputVariables.map((v, i) => (
          <div key={i} className="wf-config-list-row">
            <input
              value={v}
              onChange={(e) => handleOutputVarChange(i, e.target.value)}
              placeholder="Variable name"
            />
            <button className="wf-config-remove-btn" onClick={() => handleRemoveOutputVar(i)} title="Remove">✕</button>
          </div>
        ))}
        <div className="wf-config-button-row">
          <button className="wf-config-add-btn" onClick={handleAddOutputVar}>+ Add Output Variable</button>
          <button className="wf-config-add-btn" onClick={handleAutoDetectOutputs} title="Scan code for output.xxx = assignments">Auto-detect from code</button>
        </div>
        <span className="wf-config-hint">
          Variables written by the script via <code>output.varName</code> and exported back to the workflow.
        </span>
      </div>

      <div className="wf-config-field">
        <label>Timeout (ms)</label>
        <input
          type="number"
          min={100}
          max={30000}
          value={data.timeoutMs}
          onChange={(e) => onChange({ ...data, timeoutMs: Math.max(100, Math.min(30000, Number(e.target.value) || 5000)) })}
        />
        <span className="wf-config-hint">Maximum execution time in milliseconds (100–30000).</span>
      </div>

      <div className="wf-config-field">
        <label className="wf-config-checkbox-label">
          <input
            type="checkbox"
            checked={data.captureConsole}
            onChange={(e) => onChange({ ...data, captureConsole: e.target.checked })}
          />
          Capture console output
        </label>
        <span className="wf-config-hint">
          When enabled, <code>console.log()</code> calls in the script are captured and shown in the workflow console.
        </span>
      </div>

      {data.inputVariables.filter(Boolean).length > 0 && (
        <div className="wf-config-field">
          <label>Test Inputs</label>
          <span className="wf-config-hint">Provide sample values for testing. Variables expecting JSON should contain valid JSON (e.g. <code>{'{}'}</code>).</span>
          {data.inputVariables.filter(Boolean).map(v => (
            <div key={v} className="wf-script-test-input-row">
              <label className="wf-script-test-input-label">{v}</label>
              <input
                value={mockInputs[v] ?? ''}
                onChange={(e) => handleMockInputChange(v, e.target.value)}
                placeholder={inferredDefaults[v] ? `default: ${inferredDefaults[v].length > 40 ? inferredDefaults[v].slice(0, 37) + '…' : inferredDefaults[v]}` : 'Sample value'}
              />
            </div>
          ))}
        </div>
      )}

      <div className="wf-config-field">
        <button className="wf-config-test-btn" onClick={handleTestScript}>
          ▶ Test Script
        </button>
        {testResult && <ScriptTestResult result={testResult} maxOutputLength={100} />}
      </div>

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

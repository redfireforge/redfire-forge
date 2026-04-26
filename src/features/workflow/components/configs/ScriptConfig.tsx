import { useState, useMemo } from 'react';
import type { ScriptNodeData, ScriptMode } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import ScriptCodeEditor from './ScriptCodeEditor';
import ScriptTemplateGallery from './ScriptTemplateGallery';
import ScriptLibraryManager from './ScriptLibraryManager';
import { detectOutputVariables, analyzeScriptComplexity } from '../../engine/scriptAnalysis';
import { executeScript } from '../../engine/scriptSandbox';
import { loadScriptLibraries, saveScriptLibraries, buildLibraryPreamble } from '../../engine/scriptLibraries';
import type { ScriptTemplate } from '../../engine/scriptTemplates';
import type { ScriptLibrary } from '../../engine/scriptLibraries';

const MODE_OPTIONS: { value: ScriptMode; label: string; description: string }[] = [
  { value: 'transform', label: 'Transform', description: 'Transform data from input to output variables' },
  { value: 'validate', label: 'Validate', description: 'Validate data — set output.result to true/false' },
  { value: 'generate', label: 'Generate', description: 'Generate new data from scratch' },
];

export default function ScriptConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: ScriptNodeData;
  onChange: (d: ScriptNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const [testResult, setTestResult] = useState<{ success: boolean; outputs: Record<string, string>; error?: string; consoleLogs: string[]; durationMs: number } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLibraries, setShowLibraries] = useState(false);
  const [libraries, setLibraries] = useState<ScriptLibrary[]>(() => loadScriptLibraries());

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

  const handleAutoDetect = () => {
    const detected = detectOutputVariables(data.code);
    if (detected.length > 0) {
      onChange({ ...data, outputVariables: detected });
    }
  };

  const handleTestScript = () => {
    // Build mock inputs (empty strings for each declared input variable)
    const mockInputs: Record<string, string> = {};
    for (const v of data.inputVariables) {
      if (v) mockInputs[v] = '';
    }
    const result = executeScript(data, mockInputs,
      data.libraryIds?.length ? buildLibraryPreamble(libraries, data.libraryIds) : undefined,
    );
    setTestResult(result);
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
    setLibraries(updated);
    saveScriptLibraries(updated);
  };

  const handleLibrarySelectionChange = (ids: string[]) => {
    onChange({ ...data, libraryIds: ids });
  };

  // Complexity warnings — memoized on code changes
  const complexityWarnings = useMemo(
    () => analyzeScriptComplexity(data.code),
    [data.code],
  );

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
          onChange={(e) => onChange({ ...data, mode: e.target.value as ScriptMode })}
        >
          {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="wf-config-hint">
          {MODE_OPTIONS.find(o => o.value === data.mode)?.description}
        </span>
      </div>

      <div className="wf-config-field">
        <div className="wf-config-button-row">
          <button className="wf-config-add-btn" onClick={() => setShowTemplates(!showTemplates)}>
            {showTemplates ? 'Hide Templates' : '📋 Templates'}
          </button>
          <button className="wf-config-add-btn" onClick={() => setShowLibraries(!showLibraries)}>
            {showLibraries ? 'Hide Libraries' : '📚 Libraries'}
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
          libraries={libraries}
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
        <span className="wf-config-hint">
          JavaScript code. Use <code>input.varName</code> to read and <code>output.varName</code> to write variables.
        </span>
      </div>

      {complexityWarnings.length > 0 && (
        <div className="wf-config-field">
          <div className="wf-script-warnings">
            {complexityWarnings.map((w, i) => (
              <div key={i} className="wf-script-warning">⚠ {w}</div>
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
          <button className="wf-config-add-btn" onClick={handleAutoDetect} title="Scan code for output.xxx = assignments">Auto-detect from code</button>
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

      <div className="wf-config-field">
        <button className="wf-config-test-btn" onClick={handleTestScript}>
          ▶ Test Script
        </button>
        {testResult && (
          <div className={`wf-script-test-result ${testResult.success ? 'wf-script-test-pass' : 'wf-script-test-fail'}`}>
            <div className="wf-script-test-header">
              {testResult.success ? '✅ Passed' : '❌ Failed'} ({testResult.durationMs.toFixed(1)}ms)
            </div>
            {testResult.error && (
              <div className="wf-script-test-error">{testResult.error}</div>
            )}
            {Object.keys(testResult.outputs).length > 0 && (
              <div className="wf-script-test-outputs">
                <strong>Outputs:</strong>
                {Object.entries(testResult.outputs).map(([k, v]) => (
                  <div key={k} className="wf-script-test-output-row">
                    <code>{k}</code> = <code>{v.length > 100 ? v.slice(0, 97) + '…' : v}</code>
                  </div>
                ))}
              </div>
            )}
            {testResult.consoleLogs.length > 0 && (
              <div className="wf-script-test-console">
                <strong>Console:</strong>
                {testResult.consoleLogs.map((line, i) => (
                  <div key={i} className="wf-script-test-console-line">{line}</div>
                ))}
              </div>
            )}
          </div>
        )}
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
    </div>
  );
}

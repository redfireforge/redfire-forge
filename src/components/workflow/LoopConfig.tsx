import type { LoopNodeData, LoopMode } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from './InsertVarField';
import AvailableVariables from './AvailableVariables';

const MODE_OPTIONS: { value: LoopMode; label: string; desc: string }[] = [
  { value: 'count', label: 'Repeat N times', desc: 'Execute the body a fixed number of times' },
  { value: 'forEach', label: 'For Each', desc: 'Iterate over a JSON array' },
  { value: 'while', label: 'While', desc: 'Repeat while a condition is true' },
];

const OPERATORS = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'not-contains', label: 'not contains' },
  { value: 'regex', label: 'regex' },
] as const;

export default function LoopConfig({ data, onChange, onRequestVariableInsert, variableHints = [] }: {
  data: LoopNodeData;
  onChange: (d: LoopNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Mode</label>
        <select value={data.mode} onChange={(e) => onChange({ ...data, mode: e.target.value as LoopMode })}>
          {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="wf-config-hint">{MODE_OPTIONS.find(o => o.value === data.mode)?.desc}</span>
      </div>

      {/* Count mode */}
      {data.mode === 'count' && (
        <>
          <div className="wf-config-field">
            <label>Iterations</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={data.count ?? 1}
              onChange={(e) => onChange({ ...data, count: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="wf-config-field">
            <label>Or expression</label>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              onInsert={(snippet) => onChange({ ...data, countExpression: (data.countExpression ?? '') + snippet })}
            >
              <input
                value={data.countExpression ?? ''}
                onChange={(e) => onChange({ ...data, countExpression: e.target.value })}
                placeholder="e.g. {{retryCount}} (overrides fixed count)"
              />
            </InsertVarField>
          </div>
          <div className="wf-config-field">
            <label>Index variable</label>
            <input
              value={data.indexVariable ?? 'i'}
              onChange={(e) => onChange({ ...data, indexVariable: e.target.value })}
              placeholder="i"
            />
            <span className="wf-config-hint">Available as {'{{i}}'} inside the loop body (0-based)</span>
          </div>
        </>
      )}

      {/* ForEach mode */}
      {data.mode === 'forEach' && (
        <>
          <div className="wf-config-field">
            <label>Source array</label>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              onInsert={(snippet) => onChange({ ...data, sourceExpression: (data.sourceExpression ?? '') + snippet })}
            >
              <input
                value={data.sourceExpression ?? ''}
                onChange={(e) => onChange({ ...data, sourceExpression: e.target.value })}
                placeholder="e.g. {{items}} or {{$.data.results}}"
              />
            </InsertVarField>
            <span className="wf-config-hint">Expression that resolves to a JSON array</span>
          </div>
          <div className="wf-config-field">
            <label>Item variable</label>
            <input
              value={data.itemVariable ?? 'item'}
              onChange={(e) => onChange({ ...data, itemVariable: e.target.value })}
              placeholder="item"
            />
            <span className="wf-config-hint">Each element available as {'{{item}}'}</span>
          </div>
          <div className="wf-config-field">
            <label>Index variable</label>
            <input
              value={data.indexVariable ?? 'i'}
              onChange={(e) => onChange({ ...data, indexVariable: e.target.value })}
              placeholder="i"
            />
          </div>
        </>
      )}

      {/* While mode */}
      {data.mode === 'while' && (
        <>
          <div className="wf-config-field">
            <label>Left operand</label>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              onInsert={(snippet) => onChange({ ...data, whileLeft: (data.whileLeft ?? '') + snippet })}
            >
              <input
                value={data.whileLeft ?? ''}
                onChange={(e) => onChange({ ...data, whileLeft: e.target.value })}
                placeholder="e.g. {{status}}"
              />
            </InsertVarField>
          </div>
          <div className="wf-config-field">
            <label>Operator</label>
            <select
              value={data.whileOperator ?? '=='}
              onChange={(e) => onChange({ ...data, whileOperator: e.target.value as LoopNodeData['whileOperator'] })}
            >
              {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="wf-config-field">
            <label>Right operand</label>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              onInsert={(snippet) => onChange({ ...data, whileRight: (data.whileRight ?? '') + snippet })}
            >
              <input
                value={data.whileRight ?? ''}
                onChange={(e) => onChange({ ...data, whileRight: e.target.value })}
                placeholder="e.g. 200"
              />
            </InsertVarField>
          </div>
        </>
      )}

      <div className="wf-config-field">
        <label>Max iterations (safety)</label>
        <input
          type="number"
          min={1}
          max={10000}
          value={data.maxIterations ?? 100}
          onChange={(e) => onChange({ ...data, maxIterations: parseInt(e.target.value) || 100 })}
        />
        <span className="wf-config-hint">Prevents infinite loops. Default 100.</span>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}

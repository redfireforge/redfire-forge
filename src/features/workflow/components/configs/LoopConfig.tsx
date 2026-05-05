import { useMemo, useState } from 'react';
import type { LoopNodeData, LoopMode } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import type { Scenario } from '../../../../shared/types';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import DataSourceEditor from '../../../scenarios/components/DataSourceEditor';

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
  const hasDataSource = !!data.dataSource;
  const [dsOpen, setDsOpen] = useState(hasDataSource);
  const enabledRowCount = useMemo(
    () => data.dataSource?.rows?.filter(r => r.enabled).length ?? 0,
    [data.dataSource],
  );

  /** Wrap loop's dataSource in a minimal Scenario for DataSourceEditor. */
  const wrapScenario = (): Scenario => ({
    id: 'loop-ds',
    name: data.label,
    url: data.dataSource?.urlTemplate ?? '',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    dataSource: data.dataSource,
  });

  const handleDraftChange = (scenario: Scenario) => {
    onChange({ ...data, dataSource: scenario.dataSource });
  };

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
              <ExpressionInput
                value={data.countExpression ?? ''}
                onChange={(val) => onChange({ ...data, countExpression: val })}
                placeholder="e.g. {{retryCount}} (overrides fixed count)"
                variableHints={variableHints}
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
            <label>Source array{hasDataSource ? ' (overridden by data source)' : ''}</label>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              onInsert={(snippet) => onChange({ ...data, sourceExpression: (data.sourceExpression ?? '') + snippet })}
            >
              <ExpressionInput
                value={data.sourceExpression ?? ''}
                onChange={(val) => onChange({ ...data, sourceExpression: val })}
                placeholder="e.g. {{items}} or {{$.data.results}}"
                variableHints={variableHints}
                disabled={hasDataSource}
              />
            </InsertVarField>
            <span className="wf-config-hint">{hasDataSource ? `Using data source (${enabledRowCount} enabled rows) — expression is ignored` : 'Expression that resolves to a JSON array'}</span>
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

          <div className="wf-loop-datasource-section">
            <button type="button" className="wf-loop-datasource-toggle" onClick={() => setDsOpen(o => !o)}>
              <span>{dsOpen ? '▾' : '▸'}</span>
              📊 Data Source {enabledRowCount > 0 && <span className="tab-badge">{enabledRowCount}</span>}
            </button>
            {dsOpen && (
              <div className="wf-loop-datasource-editor">
                <DataSourceEditor
                  draft={wrapScenario()}
                  onDraftChange={handleDraftChange}
                />
              </div>
            )}
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
              <ExpressionInput
                value={data.whileLeft ?? ''}
                onChange={(val) => onChange({ ...data, whileLeft: val })}
                placeholder="e.g. {{status}}"
                variableHints={variableHints}
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
              <ExpressionInput
                value={data.whileRight ?? ''}
                onChange={(val) => onChange({ ...data, whileRight: val })}
                placeholder="e.g. 200"
                variableHints={variableHints}
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

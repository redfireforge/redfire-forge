import { useState, useMemo, useEffect } from 'react';
import type { ConditionNodeData } from '../../types/workflow';
import {
  guessConditionLeftMode,
  parseSingleVariableRef,
  validateConditionLeftRefs,
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import InsertVarField from './InsertVarField';
import ExpressionInput from './ExpressionInput';
import SearchableVariableSelect from './SearchableVariableSelect';
import ExpressionTextarea from './ExpressionTextarea';

const CUSTOM_SELECT = '__custom__';

export default function ConditionConfig({
  data,
  onChange,
  variableHints,
  onRequestVariableInsert,
}: {
  data: ConditionNodeData;
  onChange: (d: ConditionNodeData) => void;
  variableHints: WorkflowVariableHint[];
  onRequestVariableInsert?: (apply: (snippet: string) => void, shortRef?: boolean, initialSearch?: string) => void;
}) {
  const [uiMode, setUiMode] = useState<'pick' | 'expr'>(() => guessConditionLeftMode(data.left));
  const [pickCustom, setPickCustom] = useState(false);

  const singleName = useMemo(() => parseSingleVariableRef(data.left), [data.left]);
  const hintSet = useMemo(() => new Set(variableHints.map((h) => h.ref)), [variableHints]);
  const validation = useMemo(
    () => validateConditionLeftRefs(data.left, variableHints),
    [data.left, variableHints],
  );

  /** Extract the last {{var}} reference from the expression for search context. */
  const leftInitialSearch = useMemo(() => {
    const matches = data.left.match(/\{\{([^}]+)\}\}/g);
    if (!matches || matches.length === 0) return '';
    const last = matches[matches.length - 1];
    return last.replace(/^\{\{|\}\}$/g, '');
  }, [data.left]);

  useEffect(() => {
    const sn = parseSingleVariableRef(data.left);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pick mode when left operand or available hints change
    if (sn !== null && !hintSet.has(sn)) setPickCustom(true);
     
    else if (sn !== null && hintSet.has(sn)) setPickCustom(false);
  }, [data.left, hintSet]);

  const selectValue = useMemo(() => {
    if (singleName !== null && hintSet.has(singleName)) return singleName;
    if (pickCustom || (singleName !== null && !hintSet.has(singleName))) return CUSTOM_SELECT;
    return '';
  }, [singleName, hintSet, pickCustom]);

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>
      <div className="wf-config-field">
        <label>Left operand</label>
        <div className="wf-condition-left-mode" role="group" aria-label="Left operand mode">
          <label className="wf-config-inline-radio">
            <input
              type="radio"
              name="wf-condition-left-mode"
              checked={uiMode === 'pick'}
              onChange={() => setUiMode('pick')}
            />
            Choose variable
          </label>
          <label className="wf-config-inline-radio">
            <input
              type="radio"
              name="wf-condition-left-mode"
              checked={uiMode === 'expr'}
              onChange={() => setUiMode('expr')}
            />
            Expression
          </label>
        </div>

        {uiMode === 'pick' && (
          <>
            <SearchableVariableSelect
              hints={variableHints}
              value={selectValue === CUSTOM_SELECT ? '' : selectValue}
              onChange={(ref) => {
                if (ref === '') {
                  setPickCustom(false);
                  onChange({ ...data, left: '' });
                  return;
                }
                setPickCustom(false);
                onChange({ ...data, left: `{{${ref}}}` });
              }}
              showCustom
              onCustom={() => {
                setPickCustom(true);
                onChange({ ...data, left: '' });
              }}
              invalid={!validation.ok && singleName !== null}
              aria-label="Variable for left operand"
            />
            {selectValue === CUSTOM_SELECT && (
              <input
                className={!validation.ok && singleName !== null && !hintSet.has(singleName) ? 'wf-input-invalid' : undefined}
                style={{ marginTop: 6 }}
                placeholder="name or node:stepId.name"
                value={singleName ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^a-zA-Z0-9_.:\-"]/g, '');
                  onChange({ ...data, left: raw ? `{{${raw}}}` : '' });
                }}
                aria-label="Custom variable name or node-scoped ref"
              />
            )}
            {variableHints.length === 0 && (
              <p className="wf-config-hint-text" style={{ marginTop: 6 }}>
                No names yet. Add Initial variables below, or connect an HTTP step above and define extractions.
              </p>
            )}
          </>
        )}

        {uiMode === 'expr' && (
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            onInsert={(snippet) => onChange({ ...data, left: data.left + snippet })}
            initialSearch={leftInitialSearch}
          >
            <ExpressionTextarea
              className={`wf-config-textarea ${!validation.ok ? 'wf-input-invalid' : ''}`}
              value={data.left}
              onChange={(val) => onChange({ ...data, left: val })}
              rows={3}
              placeholder="Literal text or {{var}} placeholders"
              spellCheck={false}
              aria-label="Left operand expression"
              variableHints={variableHints}
            />
          </InsertVarField>
        )}

        {!validation.ok && (
          <p className="wf-config-field-error" role="alert">
            Unknown variable
            {validation.unknown.length > 1 ? 's' : ''}
            {': '}
            {validation.unknown.map((u) => (
              <code key={u}>{`{{${u}}}`}</code>
            ))}
            . Use a hint from the dropdown, or <code>{'{{node:<step id>.<name>}}'}</code> for a specific HTTP step.
          </p>
        )}

        <p className="wf-config-hint-text" style={{ marginTop: 4 }}>
          Valid names appear in the dropdown. Unscoped names refer to the latest value; scoped refs target one HTTP
          step when several share a name. After a request runs, <code>status</code> is the response code unless you
          extract a different <code>status</code> from the body.
        </p>
      </div>
      <div className="wf-config-field">
        <label>Operator</label>
        <select value={data.operator} onChange={(e) => onChange({ ...data, operator: e.target.value as ConditionNodeData['operator'] })}>
          <option value="==">== (equals)</option>
          <option value="!=">!= (not equals)</option>
          <option value=">">{'>'} (greater than)</option>
          <option value="<">{'<'} (less than)</option>
          <option value=">=">{'≥'} (greater or equal)</option>
          <option value="<=">{'≤'} (less or equal)</option>
          <option value="contains">contains</option>
          <option value="not-contains">not contains</option>
          <option value="regex">regex match</option>
        </select>
      </div>
      <div className="wf-config-field">
        <label>Right (value to compare)</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          onInsert={(snippet) => onChange({ ...data, right: data.right + snippet })}
        >
          <ExpressionInput value={data.right} onChange={(val) => onChange({ ...data, right: val })} placeholder="200" variableHints={variableHints} />
        </InsertVarField>
      </div>
      <p className="wf-config-hint-text" style={{ marginTop: 4 }}>
        Connect multiple HTTP (or other) steps to the same Yes or No handle to run them all when that branch is taken; steps on the other branch are skipped.
      </p>
    </div>
  );
}

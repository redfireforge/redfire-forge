import { useState, useMemo, useEffect } from 'react';
import type { ConditionNodeData } from '../../types/workflow';
import {
  guessConditionLeftMode,
  parseSingleVariableRef,
  validateConditionLeftRefs,
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import SearchableVariableSelect from '../expression/SearchableVariableSelect';
import ExpressionTextarea from '../expression/ExpressionTextarea';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

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
     
    if (sn !== null && !hintSet.has(sn)) setPickCustom(true);
     
    else if (sn !== null && hintSet.has(sn)) setPickCustom(false);
  }, [data.left, hintSet]);

  const selectValue = useMemo(() => {
    if (singleName !== null && hintSet.has(singleName)) return singleName;
    if (pickCustom || (singleName !== null && !hintSet.has(singleName))) return CUSTOM_SELECT;
    return '';
  }, [singleName, hintSet, pickCustom]);

  return (
    <div className="wf-config-body wf-condition-config" data-testid="condition-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field--row wf-config-field--row-top">
        <label>Value to check</label>
        <div className="wf-config-row-stack">
          <div className="wf-condition-left-controls">
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
              <div className="wf-condition-left-select">
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
              </div>
            )}
          </div>

          {uiMode === 'pick' && selectValue === CUSTOM_SELECT && (
            <input
              className={!validation.ok && singleName !== null && !hintSet.has(singleName) ? 'wf-input-invalid' : undefined}
              placeholder="name or node:stepId.name"
              value={singleName ?? ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^a-zA-Z0-9_.:\-"]/g, '');
                onChange({ ...data, left: raw ? `{{${raw}}}` : '' });
              }}
              aria-label="Custom variable name or node-scoped ref"
            />
          )}
          {uiMode === 'pick' && variableHints.length === 0 && (
            <p className="wf-config-hint-text--below">
              No names yet. Add Initial variables below, or connect an HTTP step above and define extractions.
            </p>
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

          <p className="wf-config-hint-text--below">
            Valid names appear in the dropdown. Unscoped names refer to the latest value; scoped refs target one HTTP
            step when several share a name. After a request runs, <code>status</code> is the response code unless you
            extract a different <code>status</code> from the body.
          </p>
        </div>
      </div>

      <div className="wf-config-field--row">
        <label>Operator</label>
        <CustomSelect
          value={data.operator}
          onChange={(v) => onChange({ ...data, operator: v as ConditionNodeData['operator'] })}
          options={[
            { value: '==', label: '== (equals)' },
            { value: '!=', label: '!= (not equals)' },
            { value: '>', label: '> (greater than)' },
            { value: '<', label: '< (less than)' },
            { value: '>=', label: '≥ (greater or equal)' },
            { value: '<=', label: '≤ (less or equal)' },
            { value: 'contains', label: 'contains' },
            { value: 'not-contains', label: 'not contains' },
            { value: 'regex', label: 'regex match' },
          ]}
        />
      </div>

      <div className="wf-config-field--row">
        <label>Compare value</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          onInsert={(snippet) => onChange({ ...data, right: data.right + snippet })}
        >
          <ExpressionInput value={data.right} onChange={(val) => onChange({ ...data, right: val })} placeholder="200" variableHints={variableHints} />
        </InsertVarField>
      </div>

      <div className="wf-config-section-info">
        <ul>
          <li>
            Connect multiple HTTP (or other) steps to the same <strong>Yes</strong> or <strong>No</strong> handle to
            run them all when that branch is taken; steps on the other branch are skipped.
          </li>
        </ul>
      </div>
    </div>
  );
}

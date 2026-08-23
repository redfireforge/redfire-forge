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
import { CustomSelect } from '@shared/components/CustomSelect';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';

const CUSTOM_SELECT = '__custom__';

const OPERATOR_OPTIONS: { value: ConditionNodeData['operator']; label: string }[] = [
  { value: '==', label: '== (equals)' },
  { value: '!=', label: '!= (not equals)' },
  { value: '>', label: '> (greater than)' },
  { value: '<', label: '< (less than)' },
  { value: '>=', label: '≥ (greater or equal)' },
  { value: '<=', label: '≤ (less or equal)' },
  { value: 'contains', label: 'contains' },
  { value: 'not-contains', label: 'not contains' },
  { value: 'regex', label: 'regex match' },
];

function previewToken(value: string, empty: string): string {
  const trimmed = value.trim();
  if (!trimmed) return empty;
  return trimmed.length > 42 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

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

  const showCustomInput = uiMode === 'pick' && selectValue === CUSTOM_SELECT;

  return (
    <div className="wf-config-body wf-condition-config" data-testid="condition-config">
      <KafkaCard title="Condition" hint="Branch Yes / No from a comparison at runtime.">
        <div className="wf-kafka-form wf-kafka-form--condition">
          <KafkaFormRow label="Label" hint="Title shown on the canvas node.">
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Condition label"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard title="Comparison" hint="Left value · operator · compare value">
        <div className="wf-condition-preview" aria-live="polite">
          <div className="wf-condition-preview-expr">
            <code title={data.left || undefined}>{previewToken(data.left, 'left')}</code>
            <span className="wf-condition-preview-op">{data.operator}</span>
            <code title={data.right || undefined}>{previewToken(data.right, 'right')}</code>
          </div>
          <div className="wf-condition-preview-branches" aria-hidden="true">
            <span className="wf-condition-branch wf-condition-branch--yes">Yes</span>
            <span className="wf-condition-branch wf-condition-branch--no">No</span>
          </div>
        </div>

        <div className="wf-condition-left-panel">
          <div className="wf-condition-left-toolbar">
            <span className="wf-condition-left-title">Left value</span>
            <div className="wf-condition-seg" role="group" aria-label="Left operand mode">
              <button
                type="button"
                className={`wf-condition-seg-btn${uiMode === 'pick' ? ' is-active' : ''}`}
                aria-label="Choose variable"
                aria-pressed={uiMode === 'pick'}
                onClick={() => setUiMode('pick')}
              >
                Variable
              </button>
              <button
                type="button"
                className={`wf-condition-seg-btn${uiMode === 'expr' ? ' is-active' : ''}`}
                aria-label="Expression"
                aria-pressed={uiMode === 'expr'}
                onClick={() => setUiMode('expr')}
              >
                Expression
              </button>
            </div>
          </div>

          <div className="wf-condition-left-body">
            {uiMode === 'pick' && (
              <div className={`wf-condition-left-pick${showCustomInput ? ' wf-condition-left-pick--custom' : ''}`}>
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

                {showCustomInput && (
                  <div className="wf-condition-custom-field">
                    <label className="wf-condition-custom-label" htmlFor="wf-condition-custom-ref">
                      Custom name
                    </label>
                    <input
                      id="wf-condition-custom-ref"
                      className={`wf-kafka-form-input wf-kafka-form-input--mono${
                        !validation.ok && singleName !== null && !hintSet.has(singleName)
                          ? ' wf-input-invalid'
                          : ''
                      }`}
                      placeholder="name or node:stepId.name"
                      value={singleName ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^a-zA-Z0-9_.:\-"]/g, '');
                        onChange({ ...data, left: raw ? `{{${raw}}}` : '' });
                      }}
                      aria-label="Custom variable name or node-scoped ref"
                    />
                  </div>
                )}

                {variableHints.length === 0 && (
                  <p className="wf-config-hint-text--below">
                    No names yet. Add Initial variables below, or connect an HTTP step above and define
                    extractions.
                  </p>
                )}
              </div>
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
                  rows={2}
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
                . Pick a listed name, or use <code>{'{{node:<step id>.<name>}}'}</code>.
              </p>
            )}
          </div>
        </div>

        <div className="wf-kafka-form wf-kafka-form--condition wf-kafka-form--condition-compare">
          <KafkaFormRow label="Operator" hint="How left and right are compared." compact>
            <div className="wf-condition-operator-ctrl">
              <CustomSelect
                value={data.operator}
                onChange={(v) => onChange({ ...data, operator: v as ConditionNodeData['operator'] })}
                options={OPERATOR_OPTIONS}
              />
            </div>
          </KafkaFormRow>

          <KafkaFormRow label="Compare to" hint="Literal text or a {{variable}}." compact>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => onChange({ ...data, right: data.right + snippet })}
            >
              <ExpressionInput
                value={data.right}
                onChange={(val) => onChange({ ...data, right: val })}
                placeholder="200"
                variableHints={variableHints}
                aria-label="Compare value"
              />
            </InsertVarField>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <ul>
          <li>
            Connect steps to the <strong>Yes</strong> or <strong>No</strong> handle. Multiple steps on the same
            handle all run; the other branch is skipped.
          </li>
          <li>
            Unscoped names use the latest value; scoped refs (<code>{'{{node:<step id>.name}}'}</code>) target one
            HTTP step when several share a name.
          </li>
          <li>
            After a request runs, <code>status</code> is the response code unless you extract a different{' '}
            <code>status</code> from the body.
          </li>
        </ul>
      </div>
    </div>
  );
}

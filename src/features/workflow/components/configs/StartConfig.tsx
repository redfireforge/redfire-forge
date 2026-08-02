import { useRef } from 'react';
import type { StartNodeData } from '../../types/workflow';
import { KafkaAddButton, KafkaCard, KafkaFormRow } from './KafkaConfigUi';

interface Props {
  data: StartNodeData;
  onChange: (patch: Partial<StartNodeData>) => void;
  newVarKey: string;
  setNewVarKey: (key: string) => void;
  newVarValue: string;
  setNewVarValue: (value: string) => void;
  workflowVariables?: Record<string, string>;
}

/**
 * Start node config — label + trigger input variables seeded when the workflow begins.
 */
export default function StartConfig({
  data,
  onChange,
  newVarKey,
  setNewVarKey,
  newVarValue,
  setNewVarValue,
  workflowVariables = {},
}: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const variables = data.inputVariables ?? {};
  const entries = Object.entries(variables);
  const workflowDefaultNames = Object.keys(workflowVariables).filter(Boolean).slice(0, 6);

  const updateVariables = (next: Record<string, string>) => {
    onChange({ inputVariables: next });
  };

  const addVar = () => {
    const key = newVarKey.trim().replace(/[{}]/g, '');
    if (!key) {
      nameInputRef.current?.focus();
      return;
    }
    updateVariables({ ...variables, [key]: newVarValue });
    setNewVarKey('');
    setNewVarValue('');
    nameInputRef.current?.focus();
  };

  const renameVar = (oldKey: string, rawNext: string) => {
    const newKey = rawNext.replace(/[{}]/g, '').trim();
    if (!newKey || newKey === oldKey) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(variables)) {
      next[k === oldKey ? newKey : k] = v;
    }
    updateVariables(next);
  };

  const focusAddRow = () => {
    nameInputRef.current?.focus();
  };

  return (
    <div className="wf-config-body wf-start-config" data-testid="start-config">
      <KafkaCard
        title="Start"
        hint="Entry point for the workflow. Trigger variables are seeded before the first step runs."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" hint="Shown on the canvas node" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Start"
              aria-label="Start node label"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Trigger input variables"
        hint={<>Seeded at run start. Reference them as <code>{'{{name}}'}</code> in any downstream step.</>}
        action={(
          <KafkaAddButton
            testId="start-var-add-btn"
            label="+ Add"
            onClick={() => {
              if (newVarKey.trim()) addVar();
              else focusAddRow();
            }}
          />
        )}
      >
        <div className="wf-start-vars-panel">
          {entries.length === 0 ? (
            <div className="wf-start-vars-empty">
              <p className="wf-start-vars-empty-title">No trigger variables yet</p>
              <p className="wf-start-vars-empty-text">
                Add values injected when the workflow starts — for example <code>orderId</code> or{' '}
                <code>customerId</code>.
              </p>
            </div>
          ) : (
            <div className="wf-start-vars-header" aria-hidden="true">
              <span className="wf-start-vars-col-name">Name</span>
              <span className="wf-start-vars-col-value">Value</span>
              <span className="wf-start-vars-col-del" />
            </div>
          )}

          <div className="wf-start-vars-list">
            {entries.map(([key, value], index) => (
              <div key={index} className="wf-start-vars-row">
                <div className="wf-start-vars-col-name">
                  <input
                    className="wf-kafka-form-input"
                    value={key}
                    onChange={(e) => renameVar(key, e.target.value)}
                    aria-label={`Variable name ${key}`}
                  />
                </div>
                <div className="wf-start-vars-col-value">
                  <input
                    className="wf-kafka-form-input"
                    value={value}
                    onChange={(e) => updateVariables({ ...variables, [key]: e.target.value })}
                    aria-label={`Value for ${key}`}
                  />
                </div>
                <div className="wf-start-vars-col-del">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    aria-label={`Remove variable ${key}`}
                    onClick={() => {
                      const next = { ...variables };
                      delete next[key];
                      updateVariables(next);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <div className="wf-start-vars-row wf-start-vars-row--new">
              <div className="wf-start-vars-col-name">
                <input
                  ref={nameInputRef}
                  className="wf-kafka-form-input"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  placeholder="name"
                  onKeyDown={(e) => e.key === 'Enter' && addVar()}
                  aria-label="New variable name"
                />
              </div>
              <div className="wf-start-vars-col-value">
                <input
                  className="wf-kafka-form-input"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  placeholder="value"
                  onKeyDown={(e) => e.key === 'Enter' && addVar()}
                  aria-label="New variable value"
                />
              </div>
              <div className="wf-start-vars-col-del">
                <button
                  type="button"
                  className="btn btn-sm wf-kafka-add-btn"
                  onClick={addVar}
                  aria-label="Add variable"
                  title="Add variable"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </KafkaCard>

      <KafkaCard title="How trigger variables work" hint="Quick reference for runners and Quick Test.">
        <ul className="wf-start-tips">
          <li>
            Values here are injected when the workflow <strong>starts</strong> — before Produce, HTTP, or Wait nodes run.
          </li>
          <li>
            Use <code>{'{{name}}'}</code> in topic templates, bodies, headers, and correlation expressions.
          </li>
          <li>
            The <strong>Input</strong> tab shows the same map for the current run; runner overrides can replace these defaults.
          </li>
          {workflowDefaultNames.length > 0 ? (
            <li>
              Workflow Variables also define:{' '}
              {workflowDefaultNames.map((n, i) => (
                <span key={n}>
                  {i > 0 ? ', ' : ''}
                  <code>{n}</code>
                </span>
              ))}
              {Object.keys(workflowVariables).length > workflowDefaultNames.length ? '…' : ''}.
            </li>
          ) : (
            <li>
              Prefer <strong>Workflow Variables</strong> (toolbar) for shared defaults; use Start for trigger-specific seeds.
            </li>
          )}
        </ul>
      </KafkaCard>
    </div>
  );
}

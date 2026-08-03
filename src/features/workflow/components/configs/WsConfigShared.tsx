/**
 * Shared sub-components extracted from WsConnect/WsSend/WsReceive/WsTrigger configs
 * to eliminate duplication of Output Bindings, Match Criteria, Extraction Rules,
 * Connection ID field, and Key-Value row section patterns.
 */
import { useMemo, useState } from 'react';
import type { WsMatchCriteria, WsExtractionRule, WsNodeHeaderRow } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import { MSG_TYPE_FILTER_OPTIONS, createWsExtractionRule } from './wsConfigFactories';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

// ── Key-Value Row Section (Headers / Query Parameters) ─────────────────────

export function WsKeyValueSection({
  title,
  hint,
  emptyText,
  rows,
  keyPlaceholder,
  addLabel,
  crud,
  onAdd,
  onRequestVariableInsert,
  variableHints,
}: {
  title: string;
  hint?: string;
  emptyText?: string;
  rows: WsNodeHeaderRow[];
  keyPlaceholder: string;
  addLabel: string;
  crud: { update: (index: number, patch: Partial<WsNodeHeaderRow>) => void; remove: (index: number) => void };
  onAdd: () => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints: WorkflowVariableHint[];
}) {
  return (
    <KafkaCard
      title={title}
      hint={hint}
      action={<KafkaAddButton label={addLabel} onClick={onAdd} />}
    >
      {rows.length === 0 ? (
        <KafkaEmptyState text={emptyText ?? `No ${title.toLowerCase()} yet.`} />
      ) : (
        <div className="wf-kafka-kv-panel">
          <div className="wf-config-kv-col-headers">
            <span className="wf-kv-col-toggle">On</span>
            <span className="wf-kv-col-fill">Name</span>
            <span className="wf-kv-col-fill">Value</span>
            <span className="wf-kv-col-del" />
          </div>
          <div className="wf-config-kv-list">
            {rows.map((row, index) => (
              <div key={row.id} className="wf-config-kv-row">
                <div className="wf-kv-toggle">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => crud.update(index, { enabled: e.target.checked })}
                    aria-label={`Enable ${row.key || index + 1}`}
                  />
                </div>
                <input
                  value={row.key}
                  placeholder={keyPlaceholder}
                  onChange={(e) => crud.update(index, { key: e.target.value })}
                />
                <div className="wf-config-kv-val-wrap">
                  <InsertVarField
                    onRequestVariableInsert={onRequestVariableInsert}
                    shortRef
                    onInsert={(snippet) => crud.update(index, { value: `${row.value}${snippet}` })}
                    initialSearch={row.key}
                  >
                    <ExpressionInput
                      value={row.value}
                      placeholder="Value"
                      onChange={(value) => crud.update(index, { value })}
                      variableHints={variableHints}
                    />
                  </InsertVarField>
                </div>
                <div className="wf-kv-del">
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => crud.remove(index)}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </KafkaCard>
  );
}

// ── Connection ID Field (Send / Receive) ───────────────────────────────────

export function WsConnectionIdField({
  connectionId,
  onChange,
  availableConnectionIds,
}: {
  connectionId: string;
  onChange: (value: string) => void;
  availableConnectionIds: string[];
}) {
  const [forceCustom, setForceCustom] = useState(false);
  const customConnId = useMemo(
    () => forceCustom || !availableConnectionIds.includes(connectionId),
    [forceCustom, availableConnectionIds, connectionId],
  );

  return (
    <KafkaFormRow label="Connection ID" hint="From a WS Connect node" compact>
      <div className="wf-ws-conn-id-ctrl">
        {availableConnectionIds.length > 0 && (
          <CustomSelect
            value={customConnId ? '__custom__' : connectionId}
            onChange={(v) => {
              if (v === '__custom__') {
                setForceCustom(true);
              } else {
                setForceCustom(false);
                onChange(v);
              }
            }}
            options={[
              ...availableConnectionIds.map((id) => ({ value: id, label: id })),
              { value: '__custom__', label: '(custom)' },
            ]}
          />
        )}
        {(availableConnectionIds.length === 0 || customConnId) && (
          <input
            className="wf-kafka-form-input"
            value={connectionId}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ws1"
          />
        )}
      </div>
    </KafkaFormRow>
  );
}

// ── Match Criteria Section (Receive / Trigger) ─────────────────────────────

export function WsMatchCriteriaSection({
  matchCriteria,
  updateMatch,
  onRequestVariableInsert,
  variableHints,
  hintText,
}: {
  matchCriteria: Partial<WsMatchCriteria>;
  updateMatch: (patch: Partial<WsMatchCriteria>) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints: WorkflowVariableHint[];
  hintText: string;
}) {
  const mc = matchCriteria;
  return (
    <KafkaCard title="Match Criteria" hint={hintText}>
      <div className="wf-kafka-form wf-kafka-form--ws-match">
        <KafkaFormRow label="Message type" hint="Any · Text · Binary" compact>
          <CustomSelect
            value={mc.messageType ?? 'any'}
            onChange={(v) => updateMatch({ messageType: v as WsMatchCriteria['messageType'] })}
            options={MSG_TYPE_FILTER_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </KafkaFormRow>

        <KafkaFormRow label="Content contains" hint="Substring match">
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            shortRef
            onInsert={(snippet) => updateMatch({ contentContains: `${mc.contentContains ?? ''}${snippet}` })}
          >
            <ExpressionInput
              value={mc.contentContains ?? ''}
              onChange={(value) => updateMatch({ contentContains: value || undefined })}
              placeholder="Substring to match"
              variableHints={variableHints}
            />
          </InsertVarField>
        </KafkaFormRow>

        <KafkaFormRow label="Content regex" hint="Optional pattern" compact>
          <input
            className="wf-kafka-form-input wf-kafka-form-input--mono"
            value={mc.contentRegex ?? ''}
            onChange={(e) => updateMatch({ contentRegex: e.target.value || undefined })}
            placeholder="Regular expression pattern"
          />
        </KafkaFormRow>

        <KafkaFormRow label="JSONPath match" hint="Path in JSON body" compact>
          <input
            className="wf-kafka-form-input wf-kafka-form-input--mono"
            value={mc.jsonPathMatch ?? ''}
            onChange={(e) => updateMatch({ jsonPathMatch: e.target.value || undefined })}
            placeholder="$.event.type"
          />
        </KafkaFormRow>

        {mc.jsonPathMatch ? (
          <KafkaFormRow label="Expected value" hint="Value at JSONPath">
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => updateMatch({ jsonPathValue: `${mc.jsonPathValue ?? ''}${snippet}` })}
            >
              <ExpressionInput
                value={mc.jsonPathValue ?? ''}
                onChange={(value) => updateMatch({ jsonPathValue: value || undefined })}
                placeholder="Expected value at JSONPath"
                variableHints={variableHints}
              />
            </InsertVarField>
          </KafkaFormRow>
        ) : null}
      </div>
    </KafkaCard>
  );
}

// ── Extraction Rules Section (Receive / Trigger) ────────────────────────────

export function WsExtractionRulesSection({
  extractionRules,
  onChange,
  title = 'Extraction Rules',
  hint = 'Extract fields from the received message into workflow variables via JSONPath.',
  addLabel = '+ Add Extraction',
}: {
  extractionRules: WsExtractionRule[];
  onChange: (rules: WsExtractionRule[]) => void;
  title?: string;
  hint?: string;
  addLabel?: string;
}) {
  const handleChange = (index: number, field: 'variableName' | 'jsonPath', value: string) => {
    const next = [...extractionRules];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };
  const handleRemove = (index: number) => {
    onChange(extractionRules.filter((_, i) => i !== index));
  };

  return (
    <KafkaCard
      title={title}
      hint={hint}
      action={(
        <KafkaAddButton
          label={addLabel}
          onClick={() => onChange([...extractionRules, createWsExtractionRule()])}
        />
      )}
    >
      {extractionRules.length === 0 ? (
        <KafkaEmptyState text="No extractions yet. Add a variable name and JSONPath to pull fields from the message." />
      ) : (
        <div className="wf-kafka-extract-panel">
          <div className="wf-kafka-extract-header" aria-hidden="true">
            <span className="wf-kafka-extract-col-name">Variable name</span>
            <span className="wf-kafka-extract-col-path">JSONPath</span>
            <span className="wf-kafka-extract-col-del" />
          </div>
          <div className="wf-kafka-extract-list">
            {extractionRules.map((er, index) => (
              <div key={index} className="wf-kafka-extract-row">
                <div className="wf-kafka-extract-col-name">
                  <input
                    value={er.variableName}
                    placeholder="Variable name"
                    onChange={(e) => handleChange(index, 'variableName', e.target.value)}
                  />
                </div>
                <div className="wf-kafka-extract-col-path">
                  <input
                    value={er.jsonPath}
                    placeholder="$.field.path"
                    onChange={(e) => handleChange(index, 'jsonPath', e.target.value)}
                  />
                </div>
                <div className="wf-kafka-extract-col-del">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemove(index)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </KafkaCard>
  );
}

// ── Output Bindings Section (Connect / Send / Receive) ──────────────────────

export function WsOutputBindingsSection<F extends string>({
  outputBindings,
  fieldOptions,
  bindingCrud,
  onAdd,
  hint = 'Map connection or message metadata into workflow variables.',
}: {
  outputBindings: { field: F; variableName: string; enabled: boolean }[];
  fieldOptions: readonly F[];
  bindingCrud: {
    update: (index: number, patch: Partial<{ field: F; variableName: string; enabled: boolean }>) => void;
    remove: (index: number) => void;
  };
  onAdd: () => void;
  hint?: string;
}) {
  return (
    <KafkaCard
      title="Output Bindings"
      hint={hint}
      action={<KafkaAddButton label="+ Add Binding" onClick={onAdd} />}
    >
      {outputBindings.length === 0 ? (
        <KafkaEmptyState
          title="No output bindings"
          text="Bind a field (protocol, extensions, latency, …) to a workflow variable."
        />
      ) : (
        <div className="wf-kafka-bindings-panel">
          <div className="wf-kafka-bindings-header" aria-hidden="true">
            <span className="wf-kafka-bindings-col-on">On</span>
            <span className="wf-kafka-bindings-col-source">Field</span>
            <span className="wf-kafka-bindings-col-target">Target variable</span>
            <span className="wf-kafka-bindings-col-del" />
          </div>
          <div className="wf-kafka-bindings-list">
            {outputBindings.map((row, index) => (
              <div key={index} className="wf-kafka-bindings-row">
                <div className="wf-kafka-bindings-col-on">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => bindingCrud.update(index, { enabled: e.target.checked })}
                    aria-label={`Enable binding ${row.variableName || index + 1}`}
                  />
                </div>
                <div className="wf-kafka-bindings-col-source">
                  <CustomSelect
                    value={row.field}
                    onChange={(v) => bindingCrud.update(index, { field: v as F })}
                    options={fieldOptions.map((f) => ({ value: f, label: f }))}
                  />
                </div>
                <div className="wf-kafka-bindings-col-target">
                  <input
                    value={row.variableName}
                    onChange={(e) => bindingCrud.update(index, { variableName: e.target.value })}
                    placeholder="Variable name"
                  />
                </div>
                <div className="wf-kafka-bindings-col-del">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => bindingCrud.remove(index)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </KafkaCard>
  );
}

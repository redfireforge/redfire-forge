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
import { CustomSelect } from '../../../../shared/components/CustomSelect';

// ── Key-Value Row Section (Headers / Query Parameters) ─────────────────────

export function WsKeyValueSection({
  title,
  rows,
  keyPlaceholder,
  addLabel,
  crud,
  onAdd,
  onRequestVariableInsert,
  variableHints,
}: {
  title: string;
  rows: WsNodeHeaderRow[];
  keyPlaceholder: string;
  addLabel: string;
  crud: { update: (index: number, patch: Partial<WsNodeHeaderRow>) => void; remove: (index: number) => void };
  onAdd: () => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints: WorkflowVariableHint[];
}) {
  return (
    <div className="wf-ws-section">
      <div className="wf-ws-section-title">{title}</div>
      <div className="wf-config-kv-list">
        {rows.map((row, index) => (
          <div key={row.id} className="wf-config-kv-row">
            <label className="wf-config-checkbox-label" style={{ minWidth: 72 }}>
              <input type="checkbox" checked={row.enabled} onChange={(e) => crud.update(index, { enabled: e.target.checked })} />
              Enabled
            </label>
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
            <button type="button" className="btn btn-sm btn-danger" onClick={() => crud.remove(index)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" onClick={onAdd}>{addLabel}</button>
    </div>
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
    <div className="wf-config-field--row">
      <label>Connection ID</label>
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
          value={connectionId}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ws1"
        />
      )}
    </div>
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
    <div className="wf-ws-section">
      <div className="wf-ws-section-title">Match Criteria</div>
      <span className="wf-config-hint">{hintText}</span>

      <div className="wf-config-field">
        <label>Message Type</label>
        <CustomSelect
          value={mc.messageType ?? 'any'}
          onChange={(v) => updateMatch({ messageType: v as WsMatchCriteria['messageType'] })}
          options={MSG_TYPE_FILTER_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
        />
      </div>

      <div className="wf-config-field">
        <label>Content Contains</label>
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
      </div>

      <div className="wf-config-field">
        <label>Content Regex</label>
        <input
          value={mc.contentRegex ?? ''}
          onChange={(e) => updateMatch({ contentRegex: e.target.value || undefined })}
          placeholder="Regular expression pattern"
        />
      </div>

      <div className="wf-config-field">
        <label>JSONPath Match</label>
        <input
          value={mc.jsonPathMatch ?? ''}
          onChange={(e) => updateMatch({ jsonPathMatch: e.target.value || undefined })}
          placeholder="$.event.type"
        />
      </div>

      {mc.jsonPathMatch && (
        <div className="wf-config-field">
          <label>Expected Value</label>
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
        </div>
      )}
    </div>
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
    <div className="wf-ws-section">
      <div className="wf-ws-section-title">{title}</div>
      <span className="wf-config-hint">{hint}</span>
      <div className="wf-config-kv-list">
        {extractionRules.map((er, index) => (
          <div key={index} className="wf-config-kv-row">
            <input
              value={er.variableName}
              placeholder="Variable name"
              onChange={(e) => handleChange(index, 'variableName', e.target.value)}
            />
            <input
              value={er.jsonPath}
              placeholder="$.field.path"
              onChange={(e) => handleChange(index, 'jsonPath', e.target.value)}
            />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemove(index)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" onClick={() => onChange([...extractionRules, createWsExtractionRule()])}>{addLabel}</button>
    </div>
  );
}

// ── Output Bindings Section (Connect / Send / Receive) ──────────────────────

export function WsOutputBindingsSection<F extends string>({
  outputBindings,
  fieldOptions,
  bindingCrud,
  onAdd,
}: {
  outputBindings: { field: F; variableName: string; enabled: boolean }[];
  fieldOptions: readonly F[];
  bindingCrud: {
    update: (index: number, patch: Partial<{ field: F; variableName: string; enabled: boolean }>) => void;
    remove: (index: number) => void;
  };
  onAdd: () => void;
}) {
  return (
    <div className="wf-ws-section">
      <div className="wf-ws-section-title">Output Bindings</div>
      <div className="wf-config-kv-list">
        {outputBindings.map((row, index) => (
          <div key={index} className="wf-config-kv-row">
            <label className="wf-config-checkbox-label" style={{ minWidth: 72 }}>
              <input type="checkbox" checked={row.enabled} onChange={(e) => bindingCrud.update(index, { enabled: e.target.checked })} />
              Enabled
            </label>
            <CustomSelect
              value={row.field}
              onChange={(v) => bindingCrud.update(index, { field: v as F })}
              options={fieldOptions.map((f) => ({ value: f, label: f }))}
            />
            <input
              value={row.variableName}
              onChange={(e) => bindingCrud.update(index, { variableName: e.target.value })}
              placeholder="Variable name"
            />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => bindingCrud.remove(index)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" onClick={onAdd}>+ Add Binding</button>
    </div>
  );
}

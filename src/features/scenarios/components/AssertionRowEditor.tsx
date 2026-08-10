import type { Assertion, AssertionOperator, ComparisonOperator, DateReference, FieldOperator, JsonTypeName, WsAssertionTarget, WsNumericAssertionTarget, KafkaAssertionTarget } from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import JsonPathPicker from './JsonPathPicker';
import { getByPath, stripJsonPathPrefix } from '../../../shared/utils/jsonPath';
import { generateJsonSchema } from '../../../shared/components/data-mapper/utils/schemaGenerator';
import {
  ARRAY_CONTAINS_MODE_OPTIONS,
  CalendarIcon,
  ComparisonSelect,
  DATE_OP_OPTIONS,
  FIELD_OP_OPTIONS,
  getAssertionTypeBadgeLabel,
  NUMERIC_OP_OPTIONS,
} from './testEditorValidationConstants';
import { prettyJson, isValidJson } from '../../../shared/utils/helpers';

export interface AssertionRowEditorProps {
  assertion: Assertion;
  index: number;
  sampleJson: string;
  onUpdate: (index: number, patch: Partial<Assertion>) => void;
  onRemove: (index: number) => void;
  onOpenRegexBuilder?: (index: number) => void;
}

export default function AssertionRowEditor({
  assertion: a,
  index: i,
  sampleJson,
  onUpdate,
  onRemove,
  onOpenRegexBuilder,
}: AssertionRowEditorProps) {
  const updateAssertion = (patch: Partial<Assertion>) => onUpdate(i, patch);

  return (
    <div className={`assertion-row${a.negate ? ' assertion-row--negated' : ''}`}>
      <span className={`assertion-type-badge assertion-type-${a.type}`}>
        {getAssertionTypeBadgeLabel(a.type)}
      </span>
      <button
        type="button"
        className={`assertion-negate-toggle${a.negate ? ' assertion-negate-toggle--active' : ''}`}
        title={a.negate ? 'Negated — click to remove NOT' : 'Click to negate this assertion (NOT)'}
        onClick={() => updateAssertion({ negate: a.negate ? undefined : true } as Partial<Assertion>)}
        aria-label={a.negate ? 'Remove negation' : 'Negate assertion'}
      >
        NOT
      </button>

      {a.type === 'status' && (
        <div className="assertion-field">
          <span className="assertion-field-label">Expected</span>
          <input
            value={a.expected}
            onChange={(e) => updateAssertion({ expected: e.target.value })}
            placeholder="200, 2xx, 200-299"
            className="assertion-input"
          />
        </div>
      )}

      {a.type === 'responseTime' && (
        <div className="assertion-field">
          <span className="assertion-field-label">Max</span>
          <input
            type="number"
            value={a.maxMs}
            onChange={(e) => updateAssertion({ maxMs: Number(e.target.value) || 0 })}
            className="assertion-input assertion-input-sm"
            min={0}
          />
          <span className="assertion-unit">ms</span>
        </div>
      )}

      {a.type === 'header' && (
        <div className="assertion-field">
          <input
            value={a.name}
            onChange={(e) => updateAssertion({ name: e.target.value })}
            placeholder="Header name"
            className="assertion-input assertion-input-header-name"
          />
          <CustomSelect
            value={a.operator}
            onChange={(v) => updateAssertion({ operator: v as AssertionOperator })}
            className="assertion-select"
            options={[
              { value: 'equals', label: 'equals' },
              { value: 'contains', label: 'contains' },
              { value: 'regex', label: 'regex' },
              { value: 'exists', label: 'exists' },
            ]}
          />
          {a.operator !== 'exists' && (
            <input
              value={a.value ?? ''}
              onChange={(e) => updateAssertion({ value: e.target.value })}
              placeholder="Expected value"
              className="assertion-input assertion-input-header-val"
            />
          )}
        </div>
      )}

      {a.type === 'regex' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.path"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <span className="assertion-regex-slash">/</span>
          <input
            value={a.pattern}
            onChange={(e) => updateAssertion({ pattern: e.target.value })}
            placeholder="pattern"
            className="assertion-input"
          />
          <span className="assertion-regex-slash">/</span>
          <button
            type="button"
            className="assertion-builder-btn"
            onClick={() => onOpenRegexBuilder?.(i)}
            title="Open Regex Builder"
          >
            Builder
          </button>
        </div>
      )}

      {a.type === 'arrayLength' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.items"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <span className="assertion-field-label assertion-field-label-fixed">length</span>
          <ComparisonSelect
            value={a.operator}
            onChange={(op) => updateAssertion({ operator: op })}
            options={NUMERIC_OP_OPTIONS}
          />
          <input
            type="number"
            value={a.value}
            onChange={(e) => updateAssertion({ value: Number(e.target.value) || 0 })}
            className="assertion-input assertion-input-sm"
            min={0}
          />
        </div>
      )}

      {a.type === 'numeric' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.price"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <span className="assertion-field-label assertion-field-label-fixed">&nbsp;</span>
          <ComparisonSelect
            value={a.operator}
            onChange={(op) => updateAssertion({ operator: op })}
            options={NUMERIC_OP_OPTIONS}
          />
          <input
            type="number"
            value={a.value}
            onChange={(e) => updateAssertion({ value: Number(e.target.value) || 0 })}
            className="assertion-input assertion-input-sm"
            step="any"
          />
        </div>
      )}

      {a.type === 'date' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.expiresAt"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <span className="assertion-field-label assertion-field-label-fixed">&nbsp;</span>
          <ComparisonSelect
            value={a.operator}
            onChange={(op) => updateAssertion({ operator: op })}
            options={DATE_OP_OPTIONS}
          />
          <CustomSelect
            value={a.reference.kind}
            onChange={(kind) => {
              const k = kind as 'today' | 'fixed';
              const ref: DateReference =
                k === 'today'
                  ? { kind: 'today', timezone: a.reference.kind === 'today' ? a.reference.timezone : 'utc' }
                  : {
                      kind: 'fixed',
                      iso: a.reference.kind === 'fixed' ? a.reference.iso : new Date().toISOString().slice(0, 10),
                    };
              updateAssertion({ reference: ref });
            }}
            className="assertion-select"
            options={[
              { value: 'today', label: 'today' },
              { value: 'fixed', label: 'fixed date' },
            ]}
          />
          {a.reference.kind === 'today' && (
            <CustomSelect
              value={a.reference.timezone}
              onChange={(v) =>
                updateAssertion({ reference: { kind: 'today', timezone: v as 'utc' | 'local' } })
              }
              className="assertion-select assertion-select-sm"
              size="sm"
              options={[
                { value: 'utc', label: 'UTC' },
                { value: 'local', label: 'Local' },
              ]}
            />
          )}
          {a.reference.kind === 'fixed' && (
            <div className="assertion-date-wrap">
              <input
                type="date"
                value={a.reference.iso}
                onChange={(e) => updateAssertion({ reference: { kind: 'fixed', iso: e.target.value } })}
                className="assertion-input assertion-input-sm"
              />
              <button
                type="button"
                className="assertion-date-btn"
                title="Pick date"
                onClick={(e) => {
                  const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                  input?.showPicker?.();
                }}
              >
                <CalendarIcon />
              </button>
            </div>
          )}
        </div>
      )}

      {a.type === 'typeCheck' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.price"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <span className="assertion-field-label assertion-field-label-fixed">is</span>
          <CustomSelect
            value={a.expectedType}
            onChange={(v) => updateAssertion({ expectedType: v as JsonTypeName })}
            className="assertion-select"
            options={[
              { value: 'string', label: 'string' },
              { value: 'number', label: 'number' },
              { value: 'boolean', label: 'boolean' },
              { value: 'array', label: 'array' },
              { value: 'object', label: 'object' },
              { value: 'null', label: 'null' },
            ]}
          />
        </div>
      )}

      {a.type === 'existence' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.metadata.tags"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <span className="assertion-field-label assertion-field-label-fixed">&nbsp;</span>
          <CustomSelect
            value={a.expectExists ? 'exists' : 'not_exists'}
            onChange={(v) => updateAssertion({ expectExists: v === 'exists' })}
            className="assertion-select"
            options={[
              { value: 'exists', label: 'exists' },
              { value: 'not_exists', label: 'does not exist' },
            ]}
          />
        </div>
      )}

      {a.type === 'arrayContains' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.items"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <CustomSelect
            value={a.mode}
            onChange={(v) => updateAssertion({ mode: v as 'any' | 'all' | 'only' | 'none' })}
            className="assertion-select"
            options={ARRAY_CONTAINS_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <textarea
            value={a.value}
            onChange={(e) => updateAssertion({ value: e.target.value })}
            placeholder='{"name": "example"} or "value"'
            className="assertion-input assertion-input-json"
            rows={1}
          />
        </div>
      )}

      {a.type === 'each' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.items"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <input
            value={a.fieldPath}
            onChange={(e) => updateAssertion({ fieldPath: e.target.value })}
            placeholder="field (e.g. rank)"
            className="assertion-input assertion-input-sm"
          />
          <JsonPathPicker
            sampleJson={(() => {
              try {
                const parsed = JSON.parse(sampleJson || '');
                const arr = a.jsonPath ? getByPath(parsed, a.jsonPath) : parsed;
                if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
                  return JSON.stringify(arr[0]);
                }
              } catch {
                /* ignore */
              }
              return '';
            })()}
            onSelect={(p) => {
              const field = stripJsonPathPrefix(p);
              updateAssertion({ fieldPath: field });
            }}
          />
          <CustomSelect
            value={a.operator}
            onChange={(v) => updateAssertion({ operator: v as FieldOperator })}
            className="assertion-select"
            options={FIELD_OP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          {!['is_true', 'is_false', 'is_null', 'is_not_null', 'is_empty', 'is_not_empty', 'exists', 'not_exists'].includes(
            a.operator
          ) && (
            <input
              value={a.value ?? ''}
              onChange={(e) => updateAssertion({ value: e.target.value })}
              placeholder="value"
              className="assertion-input assertion-input-sm"
            />
          )}
        </div>
      )}

      {a.type === 'containsSubset' && (
        <div className="assertion-field">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <textarea
            value={a.expected}
            onChange={(e) => updateAssertion({ expected: e.target.value })}
            placeholder='{"status": "active", "enabled": true}'
            className="assertion-input assertion-input-json"
            rows={2}
          />
        </div>
      )}

      {a.type === 'jsonSchema' && (
        <div className="assertion-field assertion-field--schema">
          <div className="assertion-schema-toolbar">
            <button
              type="button"
              className="btn btn-xs btn-outline assertion-schema-action"
              onClick={() => {
                if (!navigator.clipboard?.readText) return;
                navigator.clipboard
                  .readText()
                  .then((text) => {
                    updateAssertion({ schema: text });
                  })
                  .catch(() => {});
              }}
              title="Paste schema from clipboard"
            >
              Paste Schema
            </button>
            <button
              type="button"
              className="btn btn-xs btn-outline assertion-schema-action"
              onClick={() => updateAssertion({ schema: prettyJson(a.schema) })}
              title="Pretty Format JSON"
            >
              Pretty Format
            </button>
            <button
              type="button"
              className="btn btn-xs btn-outline assertion-schema-action"
              onClick={() => {
                try {
                  const parsed = JSON.parse(a.schema);
                  updateAssertion({ schema: JSON.stringify(parsed) });
                } catch {
                  /* ignore malformed JSON */
                }
              }}
              title="Minify JSON (remove whitespace)"
            >
              Minify
            </button>
            {sampleJson && (
              <button
                type="button"
                className="btn btn-xs btn-outline assertion-schema-action assertion-schema-action--generate"
                onClick={() => {
                  try {
                    const sample = JSON.parse(sampleJson || '{}');
                    const schema = generateJsonSchema(sample, { strict: Object.keys(sample as object).length > 0 });
                    updateAssertion({ schema: JSON.stringify(schema, null, 2) });
                  } catch {
                    /* ignore malformed JSON */
                  }
                }}
                title="Generate schema from sample response"
              >
                Generate from Response
              </button>
            )}
          </div>
          <textarea
            value={a.schema}
            onChange={(e) => updateAssertion({ schema: e.target.value })}
            placeholder={
              '{\n  "type": "object",\n  "required": ["id", "name"],\n  "properties": {\n    "id": { "type": "integer" },\n    "name": { "type": "string" }\n  }\n}'
            }
            className={`assertion-input assertion-input-schema${isValidJson(a.schema) ? '' : ' assertion-input-schema--invalid'}`}
            rows={6}
            spellCheck={false}
          />
          {(() => {
            try {
              JSON.parse(a.schema);
              return null;
            } catch (e) {
              return (
                <span className="assertion-schema-error">{e instanceof Error ? e.message : 'Invalid JSON'}</span>
              );
            }
          })()}
        </div>
      )}

      {a.type === 'bodySize' && (
        <div className="assertion-field assertion-field--bodysize">
          <CustomSelect
            value={a.operator}
            onChange={(v) => updateAssertion({ operator: v as ComparisonOperator })}
            className="assertion-select assertion-select--operator"
            showDetailInTrigger
            options={[
              { value: '<', label: 'less than', detail: '<' },
              { value: '<=', label: 'at most', detail: '≤' },
              { value: '=', label: 'exactly', detail: '=' },
              { value: '>=', label: 'at least', detail: '≥' },
              { value: '>', label: 'more than', detail: '>' },
              { value: '!=', label: 'not equal', detail: '≠' },
            ]}
          />
          <input
            type="number"
            value={a.value}
            onChange={(e) => updateAssertion({ value: Number(e.target.value) || 0 })}
            className="assertion-input assertion-input-num"
            min={0}
            step={1}
          />
          <CustomSelect
            value={a.unit}
            onChange={(v) => updateAssertion({ unit: v as 'bytes' | 'kb' | 'mb' })}
            className="assertion-select assertion-select--unit"
            options={[
              { value: 'bytes', label: 'Bytes' },
              { value: 'kb', label: 'KB' },
              { value: 'mb', label: 'MB' },
            ]}
          />
        </div>
      )}

      {a.type === 'datePrecise' && (
        <div className="assertion-field assertion-field--dateprecise">
          <input
            value={a.jsonPath}
            onChange={(e) => updateAssertion({ jsonPath: e.target.value })}
            placeholder="$.timestamp"
            className="assertion-input assertion-input-path"
          />
          <JsonPathPicker sampleJson={sampleJson} onSelect={(p) => updateAssertion({ jsonPath: p })} />
          <CustomSelect
            value={a.operator}
            onChange={(v) => updateAssertion({ operator: v as ComparisonOperator })}
            className="assertion-select assertion-select--operator"
            showDetailInTrigger
            options={[
              { value: '=', label: 'equals', detail: '=' },
              { value: '!=', label: 'not equals', detail: '≠' },
              { value: '>', label: 'after', detail: '>' },
              { value: '>=', label: 'on or after', detail: '≥' },
              { value: '<', label: 'before', detail: '<' },
              { value: '<=', label: 'on or before', detail: '≤' },
            ]}
          />
          <div className="assertion-date-wrap">
            <input
              type="datetime-local"
              value={a.reference ? a.reference.slice(0, 16) : ''}
              onChange={(e) =>
                updateAssertion({ reference: e.target.value ? new Date(e.target.value).toISOString() : '' })
              }
              className="assertion-input assertion-input-date"
            />
            <button
              type="button"
              className="assertion-date-btn"
              title="Pick date/time"
              onClick={(e) => {
                const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                input?.showPicker?.();
              }}
            >
              <CalendarIcon />
            </button>
            <CustomSelect
              value={a.precision}
              onChange={(v) =>
                updateAssertion({ precision: v as 'day' | 'hour' | 'minute' | 'second' | 'millisecond' })
              }
              className="assertion-select assertion-select--precision"
              options={[
                { value: 'day', label: 'Day' },
                { value: 'hour', label: 'Hour' },
                { value: 'minute', label: 'Minute' },
                { value: 'second', label: 'Second' },
                { value: 'millisecond', label: 'Millisecond' },
              ]}
            />
          </div>
        </div>
      )}

      {a.type === 'custom' && (
        <div className="assertion-field assertion-field--custom-inline">
          <input
            value={a.expression}
            onChange={(e) => updateAssertion({ expression: e.target.value })}
            placeholder="$gt($count($.body.offers), 0)"
            className="assertion-input assertion-input--expression-inline"
            spellCheck={false}
            aria-label="Custom predicate expression"
          />
          <input
            value={a.description ?? ''}
            onChange={(e) => updateAssertion({ description: e.target.value || undefined })}
            placeholder="Optional — describe what this checks"
            className="assertion-input assertion-input--desc-inline"
            aria-label="Custom predicate description"
          />
          <button
            type="button"
            className="assertion-custom-hint-tip"
            title="Use $.body, $.status, $.headers, $.responseTime — supports all 113 expression functions including lambdas"
            onClick={(e) => {
              const btn = e.currentTarget;
              const existing = btn.parentElement?.querySelector('.assertion-custom-hint-pop');
              if (existing) { existing.remove(); return; }
              const pop = document.createElement('div');
              pop.className = 'assertion-custom-hint-pop';
              pop.textContent = 'Use $.body, $.status, $.headers, $.responseTime — supports all 113 expression functions including lambdas';
              btn.parentElement?.appendChild(pop);
              const dismiss = (ev: MouseEvent) => {
                if (!pop.contains(ev.target as Node) && ev.target !== btn) {
                  pop.remove();
                  document.removeEventListener('mousedown', dismiss);
                }
              };
              setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
            }}
            aria-label="Expression syntax help"
          >
            i
          </button>
        </div>
      )}

      {a.type === 'wsField' && (
        <div className="assertion-field">
          <CustomSelect
            value={a.target.startsWith('ws.$.') ? 'ws.$.' : a.target.startsWith('ws.header.') ? 'ws.header.' : a.target}
            onChange={(v) => updateAssertion({ target: v as WsAssertionTarget })}
            className="assertion-select"
            aria-label="WS target"
            options={[
              { value: 'ws.body', label: 'ws.body' },
              { value: 'ws.type', label: 'ws.type' },
              { value: 'ws.protocol', label: 'ws.protocol' },
              { value: 'ws.connectionId', label: 'ws.connectionId' },
              { value: 'ws.header.', label: 'ws.header.name' },
              { value: 'ws.$.', label: 'ws.$.path (JSON)' },
            ]}
          />
          {a.target.startsWith('ws.header.') && (
            <input
              value={a.target.slice(10)}
              onChange={(e) => updateAssertion({ target: `ws.header.${e.target.value}` as WsAssertionTarget })}
              placeholder="header-name"
              className="assertion-input assertion-input-path"
              aria-label="WS header name"
            />
          )}
          {a.target.startsWith('ws.$.') && (
            <input
              value={a.target.slice(5)}
              onChange={(e) => updateAssertion({ target: `ws.$.${e.target.value}` as WsAssertionTarget })}
              placeholder="data.status"
              className="assertion-input assertion-input-path"
              aria-label="JSONPath within WS body"
            />
          )}
          <CustomSelect
            value={a.operator}
            onChange={(v) => updateAssertion({ operator: v as AssertionOperator })}
            className="assertion-select"
            options={[
              { value: 'equals', label: 'equals' },
              { value: 'contains', label: 'contains' },
              { value: 'regex', label: 'regex' },
              { value: 'exists', label: 'exists' },
            ]}
          />
          {a.operator !== 'exists' && (
            <input
              value={a.value ?? ''}
              onChange={(e) => updateAssertion({ value: e.target.value })}
              placeholder="Expected value"
              className="assertion-input"
            />
          )}
        </div>
      )}

      {a.type === 'wsNumericField' && (
        <div className="assertion-field">
          <CustomSelect
            value={a.target}
            onChange={(v) => updateAssertion({ target: v as WsNumericAssertionTarget })}
            className="assertion-select"
            aria-label="WS numeric target"
            options={[
              { value: 'ws.latencyMs', label: 'ws.latencyMs' },
              { value: 'ws.size', label: 'ws.size' },
            ]}
          />
          <ComparisonSelect
            value={a.operator}
            onChange={(op) => updateAssertion({ operator: op })}
            options={NUMERIC_OP_OPTIONS}
          />
          <input
            type="number"
            value={a.value}
            onChange={(e) => updateAssertion({ value: Number(e.target.value) || 0 })}
            className="assertion-input assertion-input-sm"
            min={0}
            step="any"
          />
        </div>
      )}

      {a.type === 'kafkaField' && (
        <div className="assertion-field">
          <CustomSelect
            value={a.target.startsWith('kafka.header.') ? 'kafka.header.' : a.target}
            onChange={(v) => updateAssertion({ target: v as KafkaAssertionTarget })}
            className="assertion-select"
            aria-label="Kafka target"
            options={[
              { value: 'kafka.body', label: 'kafka.body' },
              { value: 'kafka.key', label: 'kafka.key' },
              { value: 'kafka.partition', label: 'kafka.partition' },
              { value: 'kafka.offset', label: 'kafka.offset' },
              { value: 'kafka.header.', label: 'kafka.header.name' },
            ]}
          />
          {a.target.startsWith('kafka.header.') && (
            <input
              value={a.target.slice(13)}
              onChange={(e) => updateAssertion({ target: `kafka.header.${e.target.value}` as KafkaAssertionTarget })}
              placeholder="header-name"
              className="assertion-input assertion-input-path"
              aria-label="Kafka header name"
            />
          )}
          <CustomSelect
            value={a.operator}
            onChange={(v) => updateAssertion({ operator: v as AssertionOperator })}
            className="assertion-select"
            options={[
              { value: 'equals', label: 'equals' },
              { value: 'contains', label: 'contains' },
              { value: 'regex', label: 'regex' },
              { value: 'exists', label: 'exists' },
            ]}
          />
          {a.operator !== 'exists' && (
            <input
              value={a.value ?? ''}
              onChange={(e) => updateAssertion({ value: e.target.value })}
              placeholder="Expected value"
              className="assertion-input"
            />
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn-xs btn-danger assertion-remove"
        onClick={() => onRemove(i)}
        title="Remove assertion"
      >
        ×
      </button>
    </div>
  );
}

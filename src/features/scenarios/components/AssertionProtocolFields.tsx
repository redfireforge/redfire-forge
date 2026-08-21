import type {
  Assertion,
  AssertionOperator,
  KafkaAssertionTarget,
  WsAssertionTarget,
  WsNumericAssertionTarget,
} from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { ComparisonSelect, NUMERIC_OP_OPTIONS } from './testEditorValidationConstants';

interface AssertionProtocolFieldsProps {
  assertion: Assertion;
  updateAssertion: (patch: Partial<Assertion>) => void;
}

export default function AssertionProtocolFields({ assertion: a, updateAssertion }: AssertionProtocolFieldsProps) {
  if (a.type === 'wsField') {
    return (
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
    );
  }

  if (a.type === 'wsNumericField') {
    return (
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
    );
  }

  if (a.type === 'kafkaField') {
    return (
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
    );
  }

  return null;
}

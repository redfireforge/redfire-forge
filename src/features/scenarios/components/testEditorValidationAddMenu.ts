import type { ReactNode } from 'react';
import type { Assertion, ScenarioActionType } from '../../../shared/types';
import { isWsActionType } from '../../../shared/types';

/** Transport filter — which transports this row applies to. undefined = all transports. */
type TransportFilter = 'http' | 'kafka' | 'ws';

export type AddAssertionMenuRow =
  | { kind: 'divider' }
  | {
      kind: 'item';
      icon: ReactNode;
      iconClassName?: string;
      label: string;
      desc: string;
      category: string;
      assertion: Assertion | (() => Assertion);
      transport?: TransportFilter;
    }
  | { kind: 'regexBuilder'; icon: ReactNode; label: string; desc: string; category: string; transport?: TransportFilter };

export const ASSERTION_CATEGORIES = [
  'Response',
  'Field Validation',
  'Array & Structure',
  'Schema & Advanced',
  'WebSocket',
  'Kafka',
] as const;

/** Returns the transport filter key for a given scenario actionType. */
export function getTransportFilter(actionType: ScenarioActionType | undefined): TransportFilter {
  if (!actionType || actionType === 'http') return 'http';
  if (actionType === 'kafkaProduce' || actionType === 'kafkaConsume') return 'kafka';
  if (isWsActionType(actionType)) return 'ws';
  return 'http';
}

/** Returns true if a menu row should be visible for the given transport filter. */
export function isRowVisibleForTransport(row: AddAssertionMenuRow, transport: TransportFilter): boolean {
  if (row.kind === 'divider') return true;
  if (!row.transport) return true;
  return row.transport === transport;
}

export const ADD_ASSERTION_MENU_ROWS: AddAssertionMenuRow[] = [
  // ── HTTP Response ────────────────────────────────
  { kind: 'item', icon: '🔢', label: 'Status Code', desc: 'Assert HTTP status (200, 404…)', category: 'Response', assertion: { type: 'status', expected: '200' }, transport: 'http' },
  { kind: 'item', icon: '⏱', label: 'Response Time SLA', desc: 'Set max response time threshold', category: 'Response', assertion: { type: 'responseTime', maxMs: 500 } },
  { kind: 'item', icon: '📋', label: 'Response Header', desc: 'Check header name & value', category: 'Response', assertion: { type: 'header', name: 'content-type', operator: 'contains', value: 'json' }, transport: 'http' },
  { kind: 'item', icon: '⚖', label: 'Body Size', desc: 'Assert response body size within bounds', category: 'Response', assertion: { type: 'bodySize', operator: '<=', value: 1024, unit: 'kb' }, transport: 'http' },

  // ── Field Validation (transport-agnostic) ────────
  { kind: 'item', icon: '🔤', label: 'Regex Match', desc: 'Quick regex on a JSON path', category: 'Field Validation', assertion: { type: 'regex', jsonPath: '$.name', pattern: '^[A-Z].*' } },
  { kind: 'regexBuilder', icon: '🛠', label: 'Regex Builder…', desc: 'Visual builder with pattern library', category: 'Field Validation' },
  { kind: 'item', icon: '🔢', label: 'Numeric Compare', desc: 'Compare number at a JSON path', category: 'Field Validation', assertion: { type: 'numeric', jsonPath: '', operator: '=', value: 0 } },
  { kind: 'item', icon: '📅', label: 'Date Compare', desc: 'Compare date at a JSON path', category: 'Field Validation', assertion: { type: 'date', jsonPath: '', operator: '>', reference: { kind: 'today', timezone: 'utc' } } },
  {
    kind: 'item',
    icon: '⏱',
    label: 'Date Precise',
    desc: 'Compare date/time with sub-day precision',
    category: 'Field Validation',
    assertion: () => ({ type: 'datePrecise', jsonPath: '', operator: '>=', reference: new Date().toISOString(), precision: 'second' }),
  },
  { kind: 'item', icon: '🏷', label: 'Type Check', desc: 'Assert value type at a JSON path', category: 'Field Validation', assertion: { type: 'typeCheck', jsonPath: '', expectedType: 'string' } },
  { kind: 'item', icon: '🔍', label: 'Field Exists', desc: 'Assert a JSON path exists or not', category: 'Field Validation', assertion: { type: 'existence', jsonPath: '', expectExists: true } },

  // ── Array & Structure ────────────────────────────
  { kind: 'item', icon: '📏', label: 'Array Length', desc: 'Assert array size at a JSON path', category: 'Array & Structure', assertion: { type: 'arrayLength', jsonPath: '', operator: '>=', value: 1 } },
  { kind: 'item', icon: '⊇', label: 'Array Contains', desc: 'Check if array includes specific items', category: 'Array & Structure', assertion: { type: 'arrayContains', jsonPath: '', value: '', mode: 'any' } },
  { kind: 'item', icon: '∀', label: 'Each Element', desc: 'Assert condition on every array element', category: 'Array & Structure', assertion: { type: 'each', jsonPath: '', fieldPath: '', operator: 'greater_than_or_equal', value: '0' } },
  { kind: 'item', icon: '⊆', label: 'Contains Subset', desc: 'Partial deep match on a JSON structure', category: 'Array & Structure', assertion: { type: 'containsSubset', jsonPath: '$', expected: '{}' } },

  // ── Schema & Advanced ────────────────────────────
  { kind: 'item', icon: '{}', label: 'JSON Schema', desc: 'Validate response against a JSON Schema document', category: 'Schema & Advanced', assertion: { type: 'jsonSchema', schema: '{}' } },
  { kind: 'item', icon: 'λ', iconClassName: 'aam-icon--lambda', label: 'Custom Predicate', desc: 'Write an expression that evaluates to truthy/falsy', category: 'Schema & Advanced', assertion: { type: 'custom', expression: '', description: '' } },

  // ── WebSocket ────────────────────────────────────
  { kind: 'item', icon: '⚡', label: 'WS Body', desc: 'Assert WebSocket message body content', category: 'WebSocket', assertion: { type: 'wsField', target: 'ws.body', operator: 'contains', value: '' }, transport: 'ws' },
  { kind: 'item', icon: '⚡', label: 'WS Frame Type', desc: 'Assert frame type (text/binary)', category: 'WebSocket', assertion: { type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text' }, transport: 'ws' },
  { kind: 'item', icon: '⚡', label: 'WS Protocol', desc: 'Assert negotiated subprotocol', category: 'WebSocket', assertion: { type: 'wsField', target: 'ws.protocol', operator: 'equals', value: '' }, transport: 'ws' },
  { kind: 'item', icon: '⚡', label: 'WS JSON Path', desc: 'Assert a value inside the WS message body', category: 'WebSocket', assertion: { type: 'wsField', target: 'ws.$.', operator: 'equals', value: '' }, transport: 'ws' },
  { kind: 'item', icon: '⚡', label: 'WS Header', desc: 'Assert upgrade response header value', category: 'WebSocket', assertion: { type: 'wsField', target: 'ws.header.', operator: 'equals', value: '' }, transport: 'ws' },
  { kind: 'item', icon: '⚡', label: 'WS Latency', desc: 'Assert WebSocket round-trip latency', category: 'WebSocket', assertion: { type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 1000 }, transport: 'ws' },
  { kind: 'item', icon: '⚡', label: 'WS Message Size', desc: 'Assert message size in bytes', category: 'WebSocket', assertion: { type: 'wsNumericField', target: 'ws.size', operator: '<', value: 65536 }, transport: 'ws' },

  // ── Kafka ────────────────────────────────────────
  { kind: 'item', icon: '📨', label: 'Kafka Body', desc: 'Assert Kafka message body content', category: 'Kafka', assertion: { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: '' }, transport: 'kafka' },
  { kind: 'item', icon: '📨', label: 'Kafka Key', desc: 'Assert Kafka message key', category: 'Kafka', assertion: { type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: '' }, transport: 'kafka' },
  { kind: 'item', icon: '📨', label: 'Kafka Partition', desc: 'Assert consumed partition number', category: 'Kafka', assertion: { type: 'kafkaField', target: 'kafka.partition', operator: 'equals', value: '' }, transport: 'kafka' },
];

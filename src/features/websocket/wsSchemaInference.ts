/**
 * JSON Schema inference from WebSocket message samples.
 * Extends the existing schemaGenerator pattern with multi-message merge.
 */
import type { WsFrame } from '../../shared/websocket/types';
import type { WsSchemaDirection } from './wsSchemaTypes';

interface SchemaNode {
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  format?: string;
  additionalProperties?: boolean;
}

const MAX_SAMPLES = 50;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const URI_RE = /^https?:\/\//;

function detectStringFormat(value: string): string | undefined {
  if (EMAIL_RE.test(value)) return 'email';
  if (UUID_RE.test(value)) return 'uuid';
  if (ISO_DATETIME_RE.test(value)) return 'date-time';
  if (ISO_DATE_RE.test(value)) return 'date';
  if (URI_RE.test(value)) return 'uri';
  return undefined;
}

function inferSingle(value: unknown): SchemaNode {
  if (value === null) return { type: 'null' };

  if (Array.isArray(value)) {
    const schema: SchemaNode = { type: 'array' };
    if (value.length > 0) {
      const items = value.slice(0, 5).map((v) => inferSingle(v));
      schema.items = mergeNodes(items);
    }
    return schema;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const props: Record<string, SchemaNode> = {};
    for (const key of Object.keys(obj)) {
      props[key] = inferSingle(obj[key]);
    }
    return {
      type: 'object',
      properties: props,
      required: Object.keys(obj),
      additionalProperties: false,
    };
  }

  if (typeof value === 'string') {
    const node: SchemaNode = { type: 'string' };
    const fmt = detectStringFormat(value);
    if (fmt) node.format = fmt;
    return node;
  }

  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }

  if (typeof value === 'boolean') return { type: 'boolean' };

  return { type: 'string' };
}

function mergeNodes(nodes: SchemaNode[]): SchemaNode {
  if (nodes.length === 0) return {};
  if (nodes.length === 1) return nodes[0];

  const types = new Set(nodes.flatMap((n) => (Array.isArray(n.type) ? n.type : [n.type]).filter(Boolean)));

  if (types.size === 1) {
    const first = nodes[0];
    if (first.type === 'object' && first.properties) {
      const allKeys = new Set(nodes.flatMap((n) => Object.keys(n.properties ?? {})));
      const commonKeys = [...allKeys].filter((k) =>
        nodes.every((n) => n.properties?.[k] !== undefined),
      );
      const merged: SchemaNode = {
        type: 'object',
        properties: {},
        required: commonKeys,
        additionalProperties: false,
      };
      for (const key of allKeys) {
        const keyNodes = nodes
          .map((n) => n.properties?.[key])
          .filter((n): n is SchemaNode => n !== undefined);
        merged.properties![key] = mergeNodes(keyNodes);
      }
      return merged;
    }
    if (first.type === 'array') {
      const itemNodes = nodes
        .map((n) => n.items)
        .filter((n): n is SchemaNode => n !== undefined);
      return {
        type: 'array',
        ...(itemNodes.length > 0 ? { items: mergeNodes(itemNodes) } : {}),
      };
    }
    return first;
  }

  return { type: [...types] as string[] };
}

function collectJsonMessages(
  messages: WsFrame[],
  direction: WsSchemaDirection,
): unknown[] {
  const samples: unknown[] = [];
  const filtered = direction === 'both'
    ? messages
    : messages.filter((m) => m.direction === direction);

  for (let i = filtered.length - 1; i >= 0 && samples.length < MAX_SAMPLES; i--) {
    const frame = filtered[i];
    if (frame.type !== 'text') continue;
    try {
      samples.push(JSON.parse(frame.data));
    } catch {
      // skip non-JSON
    }
  }

  return samples;
}

export function inferSchemaFromMessages(
  messages: WsFrame[],
  direction: WsSchemaDirection,
): string | null {
  const samples = collectJsonMessages(messages, direction);
  if (samples.length === 0) return null;

  const nodes = samples.map((s) => inferSingle(s));
  const merged = mergeNodes(nodes);

  return JSON.stringify(merged, null, 2);
}

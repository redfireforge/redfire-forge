import type { SchemaObject } from '../types/catalog';

const MAX_DEPTH = 10;

export function generateStub(schema: SchemaObject | undefined, depth = 0): unknown {
  if (!schema || depth > MAX_DEPTH) return null;

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  if (schema.allOf && schema.allOf.length > 0) {
    const merged = mergeAllOf(schema.allOf);
    return generateStub(merged, depth);
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return generateStub(schema.oneOf[0], depth + 1);
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    return generateStub(schema.anyOf[0], depth + 1);
  }

  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'string':
      return stubString(schema);
    case 'integer':
      return schema.minimum ?? 0;
    case 'number':
      return schema.minimum ?? 0;
    case 'boolean':
      return false;
    case 'array':
      return [generateStub(schema.items, depth + 1)];
    case 'object':
      return stubObject(schema, depth);
    default:
      if (schema.properties) return stubObject(schema, depth);
      return null;
  }
}

function stubString(schema: SchemaObject): string {
  switch (schema.format) {
    case 'date-time': return '2026-01-01T00:00:00Z';
    case 'date': return '2026-01-01';
    case 'email': return 'user@example.com';
    case 'uuid': return '00000000-0000-0000-0000-000000000000';
    case 'uri':
    case 'url': return 'https://example.com';
    case 'ipv4': return '127.0.0.1';
    case 'ipv6': return '::1';
    default: return 'string';
  }
}

function stubObject(schema: SchemaObject, depth: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!schema.properties) return result;

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    result[key] = generateStub(propSchema, depth + 1);
  }
  return result;
}

function mergeAllOf(schemas: SchemaObject[]): SchemaObject {
  const merged: SchemaObject = { type: 'object', properties: {}, required: [] };
  for (const s of schemas) {
    if (s.properties) {
      merged.properties = { ...merged.properties, ...s.properties };
    }
    if (s.required) {
      merged.required = [...(merged.required ?? []), ...s.required];
    }
    if (s.type && s.type !== 'object') {
      merged.type = s.type;
    }
  }
  return merged;
}

export function generateStubJson(schema: SchemaObject | undefined): string {
  const stub = generateStub(schema);
  return JSON.stringify(stub, null, 2);
}

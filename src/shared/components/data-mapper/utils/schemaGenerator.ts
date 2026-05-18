interface SchemaNode {
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  format?: string;
  additionalProperties?: boolean;
  enum?: unknown[];
}

interface GenerateOptions {
  strict?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const URI_RE = /^https?:\/\//;
const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function detectStringFormat(value: string): string | undefined {
  if (EMAIL_RE.test(value)) return 'email';
  if (UUID_RE.test(value)) return 'uuid';
  if (ISO_DATETIME_RE.test(value)) return 'date-time';
  if (ISO_DATE_RE.test(value)) return 'date';
  if (URI_RE.test(value)) return 'uri';
  if (IPV4_RE.test(value)) return 'ipv4';
  return undefined;
}

function inferSchema(value: unknown, strict: boolean): SchemaNode {
  if (value === null) {
    return { type: 'null' };
  }

  if (Array.isArray(value)) {
    const schema: SchemaNode = { type: 'array' };
    if (value.length > 0) {
      const itemSchemas = value.slice(0, 5).map(item => inferSchema(item, strict));
      schema.items = mergeSchemas(itemSchemas);
    }
    return schema;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const schema: SchemaNode = {
      type: 'object',
      properties: {},
    };

    for (const key of keys) {
      schema.properties![key] = inferSchema(obj[key], strict);
    }

    if (strict) {
      schema.required = keys;
      schema.additionalProperties = false;
    }

    return schema;
  }

  if (typeof value === 'string') {
    const schema: SchemaNode = { type: 'string' };
    const format = detectStringFormat(value);
    if (format) schema.format = format;
    return schema;
  }

  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }

  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }

  return { type: 'string' };
}

function mergeSchemas(schemas: SchemaNode[]): SchemaNode {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];

  const types = new Set(schemas.map(s => s.type).flat().filter(Boolean));

  if (types.size === 1) {
    const base = schemas[0];
    if (base.type === 'object' && base.properties) {
      const merged: SchemaNode = { type: 'object', properties: {} };
      const allKeys = new Set(schemas.flatMap(s => Object.keys(s.properties ?? {})));
      for (const key of allKeys) {
        const keySchemas = schemas
          .map(s => s.properties?.[key])
          .filter((s): s is SchemaNode => s !== undefined);
        merged.properties![key] = keySchemas.length === 1 ? keySchemas[0] : mergeSchemas(keySchemas);
      }
      const commonKeys = [...allKeys].filter(key =>
        schemas.every(s => s.properties?.[key] !== undefined),
      );
      if (schemas[0].required) {
        merged.required = commonKeys;
      }
      if (schemas.some(s => s.additionalProperties === false)) {
        merged.additionalProperties = false;
      }
      return merged;
    }
    return base;
  }

  // Heterogeneous array — use union of types
  return { type: [...types] as string[] };
}

export function generateJsonSchema(sampleData: unknown, options?: GenerateOptions): SchemaNode {
  const strict = options?.strict ?? true;
  return inferSchema(sampleData, strict);
}

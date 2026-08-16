/**
 * Pattern Toolbox draft checks for JSON Schema and XML names / XSD.
 * Stricter than the runtime matcher: Apply only accepts a complete, named contract.
 */
import { isJsonSchemaCompileable, xmlSafeLocalName, xmlSchemaRequiredNames } from './schemaMatchers';
import { evaluateXPath } from './xpathMatcher';

export type SchemaDraftKind = 'json' | 'xml';
export type SchemaDraftValidity = { ok: true } | { ok: false; message: string };

const JSON_SCHEMA_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);

function isJsonSchemaType(value: unknown): boolean {
  if (typeof value === 'string') return JSON_SCHEMA_TYPES.has(value);
  return Array.isArray(value) && value.length > 0 && value.every(isJsonSchemaType);
}

function formatKeys(keys: string[]): string {
  return keys.map(k => `\`${k}\``).join(', ');
}

function inspectJsonSchemaObject(schema: Record<string, unknown>, path: string): string | undefined {
  if ('type' in schema && !isJsonSchemaType(schema.type)) {
    const shown = typeof schema.type === 'string' ? schema.type : JSON.stringify(schema.type);
    return `${path}: unknown type ${shown}. Use string, number, integer, boolean, object, array, or null.`;
  }
  if ('required' in schema) {
    if (!Array.isArray(schema.required) || schema.required.some(k => typeof k !== 'string' || !k)) {
      return `${path}: \`required\` must be an array of property names.`;
    }
    const required = schema.required as string[];
    const props = schema.properties;
    const propMap = props && typeof props === 'object' && !Array.isArray(props)
      ? props as Record<string, unknown>
      : undefined;
    if (required.length > 0) {
      if (!propMap) {
        return `${path}: \`required\` lists ${formatKeys(required)} but \`properties\` is missing.`;
      }
      const missing = required.filter(k => !(k in propMap));
      if (missing.length) {
        return `${path}: \`required\` lists ${formatKeys(missing)} but those keys are not in \`properties\`.`;
      }
    }
  }
  if (schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)) {
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = inspectJsonSchemaObject(value as Record<string, unknown>, `${path}.properties.${key}`);
        if (nested) return nested;
      }
    }
  }
  if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    return inspectJsonSchemaObject(schema.items as Record<string, unknown>, `${path}.items`);
  }
  return undefined;
}

export function validateJsonSchemaDraft(text: string): SchemaDraftValidity {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: 'JSON Schema is required.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'parse failed';
    return { ok: false, message: `Not valid JSON. ${detail}` };
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'JSON Schema must be an object, not an array or primitive.' };
  }
  const issue = inspectJsonSchemaObject(parsed as Record<string, unknown>, 'schema');
  if (issue) return { ok: false, message: issue };
  if (!isJsonSchemaCompileable(parsed)) {
    return { ok: false, message: 'Ajv could not compile this JSON Schema.' };
  }
  return { ok: true };
}

export function validateXmlSchemaDraft(text: string): SchemaDraftValidity {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter element names (Order, Id) or an XSD snippet with element name attributes.' };
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'parse failed';
      return { ok: false, message: `Not valid JSON. ${detail}` };
    }
  }
  const names = xmlSchemaRequiredNames(trimmed);
  if (trimmed.includes('<') && names.length === 0) {
    if (!evaluateXPath(trimmed, '/*').ok) {
      return { ok: false, message: 'XSD snippet is not well-formed XML.' };
    }
    return {
      ok: false,
      message: 'XSD snippet has no <element name="…"> entries. Add declarations or use a name list (Order, Id).',
    };
  }
  if (names.length === 0) {
    return {
      ok: false,
      message: 'List at least one XML element name, or paste an XSD snippet with element name attributes.',
    };
  }
  const unsafe = names.find(n => !xmlSafeLocalName(n));
  if (unsafe) {
    return { ok: false, message: `"${unsafe}" is not a valid XML element name.` };
  }
  return { ok: true };
}

export function validateSchemaDraft(kind: SchemaDraftKind, text: string): SchemaDraftValidity {
  return kind === 'xml' ? validateXmlSchemaDraft(text) : validateJsonSchemaDraft(text);
}

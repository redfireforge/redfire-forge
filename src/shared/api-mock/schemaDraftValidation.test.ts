import { describe, expect, it, vi } from 'vitest';
import * as schemaMatchers from './schemaMatchers';
import {
  validateJsonSchemaDraft,
  validateSchemaDraft,
  validateXmlSchemaDraft,
} from './schemaDraftValidation';

describe('schemaDraftValidation', () => {
  it('accepts a complete JSON Schema and rejects empty, non-object, and broken JSON', () => {
    expect(validateJsonSchemaDraft('{"type":"object"}')).toEqual({ ok: true });
    expect(validateJsonSchemaDraft('  { "type": "string" }  ')).toEqual({ ok: true });
    expect(validateJsonSchemaDraft('')).toEqual({ ok: false, message: 'JSON Schema is required.' });
    expect(validateJsonSchemaDraft('   ')).toEqual({ ok: false, message: 'JSON Schema is required.' });
    expect(validateJsonSchemaDraft('[]')).toEqual({
      ok: false, message: 'JSON Schema must be an object, not an array or primitive.',
    });
    expect(validateJsonSchemaDraft('true')).toEqual({
      ok: false, message: 'JSON Schema must be an object, not an array or primitive.',
    });
    expect(validateJsonSchemaDraft('null')).toEqual({
      ok: false, message: 'JSON Schema must be an object, not an array or primitive.',
    });
    const broken = validateJsonSchemaDraft('{');
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.message).toMatch(/^Not valid JSON\./);
  });

  it('requires every required key to have a property schema', () => {
    expect(validateJsonSchemaDraft('{"type":"object","required":["id"]}')).toEqual({
      ok: false,
      message: 'schema: `required` lists `id` but `properties` is missing.',
    });
    expect(validateJsonSchemaDraft(
      '{"type":"object","required":["id","tier"],"properties":{"tier":{"type":"string"}}}',
    )).toEqual({
      ok: false,
      message: 'schema: `required` lists `id` but those keys are not in `properties`.',
    });
    expect(validateJsonSchemaDraft(
      '{"type":"object","required":["id"],"properties":{"id":{"type":"string"}}}',
    )).toEqual({ ok: true });
  });

  it('rejects unknown types, bad required arrays, and nested gaps', () => {
    expect(validateJsonSchemaDraft('{"type":"widget"}').ok).toBe(false);
    expect(validateJsonSchemaDraft('{"type":["object","string"]}')).toEqual({ ok: true });
    expect(validateJsonSchemaDraft('{"type":[]}')).toMatchObject({ ok: false });
    expect(validateJsonSchemaDraft('{"required":"id"}')).toEqual({
      ok: false,
      message: 'schema: `required` must be an array of property names.',
    });
    expect(validateJsonSchemaDraft('{"required":[""]}')).toEqual({
      ok: false,
      message: 'schema: `required` must be an array of property names.',
    });
    const nested = validateJsonSchemaDraft(JSON.stringify({
      type: 'object',
      properties: {
        customer: { type: 'object', required: ['id'] },
      },
    }));
    expect(nested).toEqual({
      ok: false,
      message: 'schema.properties.customer: `required` lists `id` but `properties` is missing.',
    });
    const items = validateJsonSchemaDraft(JSON.stringify({
      type: 'array',
      items: { type: 'object', required: ['sku'] },
    }));
    expect(items).toEqual({
      ok: false,
      message: 'schema.items: `required` lists `sku` but `properties` is missing.',
    });
  });

  it('accepts XML name lists and XSD element declarations, and rejects the rest', () => {
    expect(validateXmlSchemaDraft('Order, Id')).toEqual({ ok: true });
    expect(validateXmlSchemaDraft('["Order"]')).toEqual({ ok: true });
    expect(validateXmlSchemaDraft('{"required":["Order"]}')).toEqual({ ok: true });
    expect(validateXmlSchemaDraft('{"requiredElements":["Id"]}')).toEqual({ ok: true });
    expect(validateXmlSchemaDraft('<xs:element name="Order"/><xs:element name="Id"/>')).toEqual({ ok: true });
    expect(validateXmlSchemaDraft('')).toMatchObject({ ok: false });
    expect(validateXmlSchemaDraft('{"type":"object"}')).toMatchObject({ ok: false });
    expect(validateXmlSchemaDraft('<xs/>')).toMatchObject({ ok: false });
    expect(validateXmlSchemaDraft('<Order/>')).toEqual({
      ok: false,
      message: 'XSD snippet has no <element name="…"> entries. Add declarations or use a name list (Order, Id).',
    });
    expect(validateXmlSchemaDraft('<not-closed')).toEqual({
      ok: false, message: 'XSD snippet is not well-formed XML.',
    });
    const badJson = validateXmlSchemaDraft('{not-json');
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.message).toMatch(/^Not valid JSON\./);
    expect(validateXmlSchemaDraft('Order, 1bad')).toEqual({
      ok: false, message: '"1bad" is not a valid XML element name.',
    });
  });

  it('accepts nested property and items schemas when every required key is defined', () => {
    expect(validateJsonSchemaDraft(JSON.stringify({
      type: 'object',
      required: ['customer'],
      properties: {
        customer: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        note: { type: 'string' },
      },
    }))).toEqual({ ok: true });
    expect(validateJsonSchemaDraft(JSON.stringify({
      type: 'array',
      items: { type: 'object', required: ['sku'], properties: { sku: { type: 'string' } } },
    }))).toEqual({ ok: true });
    expect(validateJsonSchemaDraft('{"type":1}')).toMatchObject({ ok: false });
    expect(validateJsonSchemaDraft('{"type":"array","items":[{"type":"string"}]}')).toEqual({ ok: true });
  });

  it('uses a fallback when JSON.parse throws a non-Error', () => {
    const spy = vi.spyOn(JSON, 'parse').mockImplementation(() => { throw 'boom'; });
    expect(validateJsonSchemaDraft('{')).toEqual({ ok: false, message: 'Not valid JSON. parse failed' });
    expect(validateXmlSchemaDraft('{x')).toEqual({ ok: false, message: 'Not valid JSON. parse failed' });
    spy.mockRestore();
  });

  it('reports when Ajv cannot compile a parsed object', () => {
    const spy = vi.spyOn(schemaMatchers, 'isJsonSchemaCompileable').mockReturnValue(false);
    expect(validateJsonSchemaDraft('{"type":"object"}')).toEqual({
      ok: false, message: 'Ajv could not compile this JSON Schema.',
    });
    spy.mockRestore();
  });

  it('dispatches by kind', () => {
    expect(validateSchemaDraft('json', '{"type":"object"}').ok).toBe(true);
    expect(validateSchemaDraft('xml', 'Order').ok).toBe(true);
    expect(validateSchemaDraft('json', 'Order').ok).toBe(false);
    expect(validateSchemaDraft('xml', '{"type":"object"}').ok).toBe(false);
  });
});

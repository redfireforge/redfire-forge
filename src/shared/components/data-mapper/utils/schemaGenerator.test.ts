import { describe, it, expect } from 'vitest';
import { generateJsonSchema } from './schemaGenerator';

describe('generateJsonSchema', () => {
  it('generates schema from simple object (strict)', () => {
    const schema = generateJsonSchema({ id: 1, name: 'Alice' });
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['id', 'name']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.id?.type).toBe('integer');
    expect(schema.properties?.name?.type).toBe('string');
  });

  it('generates schema from nested object', () => {
    const schema = generateJsonSchema({
      user: { id: 1, profile: { bio: 'Hello' } },
    });
    expect(schema.type).toBe('object');
    expect(schema.properties?.user?.type).toBe('object');
    expect(schema.properties?.user?.properties?.profile?.type).toBe('object');
    expect(schema.properties?.user?.properties?.profile?.properties?.bio?.type).toBe('string');
  });

  it('generates schema from array of objects', () => {
    const schema = generateJsonSchema([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
    expect(schema.type).toBe('array');
    expect(schema.items?.type).toBe('object');
    expect(schema.items?.properties?.id?.type).toBe('integer');
    expect(schema.items?.properties?.name?.type).toBe('string');
  });

  it('detects email format', () => {
    const schema = generateJsonSchema({ email: 'alice@example.com' });
    expect(schema.properties?.email?.format).toBe('email');
  });

  it('detects date format', () => {
    const schema = generateJsonSchema({ born: '2024-01-15' });
    expect(schema.properties?.born?.format).toBe('date');
  });

  it('detects date-time format', () => {
    const schema = generateJsonSchema({ created: '2024-01-15T10:30:00Z' });
    expect(schema.properties?.created?.format).toBe('date-time');
  });

  it('detects uuid format', () => {
    const schema = generateJsonSchema({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    expect(schema.properties?.id?.format).toBe('uuid');
  });

  it('detects uri format', () => {
    const schema = generateJsonSchema({ url: 'https://example.com/api' });
    expect(schema.properties?.url?.format).toBe('uri');
  });

  it('detects ipv4 format', () => {
    const schema = generateJsonSchema({ ip: '192.168.1.1' });
    expect(schema.properties?.ip?.format).toBe('ipv4');
  });

  it('strict mode sets required + additionalProperties: false', () => {
    const schema = generateJsonSchema({ a: 1, b: 'x' }, { strict: true });
    expect(schema.required).toEqual(['a', 'b']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('lenient mode omits required + additionalProperties', () => {
    const schema = generateJsonSchema({ a: 1, b: 'x' }, { strict: false });
    expect(schema.required).toBeUndefined();
    expect(schema.additionalProperties).toBeUndefined();
  });

  it('handles heterogeneous array', () => {
    const schema = generateJsonSchema([1, 'hello', true]);
    expect(schema.type).toBe('array');
    const itemTypes = schema.items?.type;
    expect(Array.isArray(itemTypes)).toBe(true);
    expect(itemTypes).toContain('integer');
    expect(itemTypes).toContain('string');
    expect(itemTypes).toContain('boolean');
  });

  it('handles null values', () => {
    const schema = generateJsonSchema({ data: null });
    expect(schema.properties?.data?.type).toBe('null');
  });

  it('handles boolean values', () => {
    const schema = generateJsonSchema({ active: true });
    expect(schema.properties?.active?.type).toBe('boolean');
  });

  it('distinguishes integer vs number', () => {
    const schema = generateJsonSchema({ count: 42, ratio: 3.14 });
    expect(schema.properties?.count?.type).toBe('integer');
    expect(schema.properties?.ratio?.type).toBe('number');
  });

  it('handles empty object', () => {
    const schema = generateJsonSchema({});
    expect(schema.type).toBe('object');
    expect(schema.properties).toEqual({});
  });

  it('handles empty array', () => {
    const schema = generateJsonSchema([]);
    expect(schema.type).toBe('array');
    expect(schema.items).toBeUndefined();
  });

  it('handles deeply nested arrays', () => {
    const schema = generateJsonSchema({
      matrix: [[1, 2], [3, 4]],
    });
    expect(schema.properties?.matrix?.type).toBe('array');
    expect(schema.properties?.matrix?.items?.type).toBe('array');
    expect(schema.properties?.matrix?.items?.items?.type).toBe('integer');
  });

  it('string without recognized format has no format property', () => {
    const schema = generateJsonSchema({ label: 'hello world' });
    expect(schema.properties?.label?.type).toBe('string');
    expect(schema.properties?.label?.format).toBeUndefined();
  });

  it('produces a valid JSON Schema that Ajv can compile', async () => {
    const Ajv = (await import('ajv')).default;
    const addFormats = (await import('ajv-formats')).default;

    const sample = { id: 1, name: 'Test', tags: ['a', 'b'], active: true };
    const schema = generateJsonSchema(sample);

    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(sample)).toBe(true);
    expect(validate({ id: 'wrong', name: 42 })).toBe(false);
  });
});

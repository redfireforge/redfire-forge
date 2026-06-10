import { describe, it, expect, beforeEach } from 'vitest';
import {
  compileSchema,
  removeCompiledSchema,
  clearCompiledSchemas,
  validateMessage,
  isSchemaJsonValid,
} from './wsSchemaValidator';
import type { WsSchemaDefinition } from './wsSchemaTypes';

function makeSchema(
  overrides: Partial<WsSchemaDefinition> = {},
): WsSchemaDefinition {
  return {
    id: 'schema-1',
    name: 'Test Schema',
    schema: JSON.stringify({ type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }),
    direction: 'received',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('wsSchemaValidator', () => {
  beforeEach(() => {
    clearCompiledSchemas();
  });

  describe('compileSchema', () => {
    it('compiles a valid JSON Schema', () => {
      const result = compileSchema('s1', JSON.stringify({ type: 'object' }));
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects invalid JSON', () => {
      const result = compileSchema('s2', '{not valid json}');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects invalid schema syntax', () => {
      const result = compileSchema('s3', JSON.stringify({ type: 'invalidtype' }));
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('removeCompiledSchema', () => {
    it('removes a cached compiled schema and recompiles on next validate', () => {
      const schema = makeSchema({ id: 's1' });
      compileSchema('s1', schema.schema);
      removeCompiledSchema('s1');
      const results = validateMessage('{"name": "Alice"}', 'received', [schema]);
      expect(results.length).toBe(1);
      expect(results[0].valid).toBe(true);
    });
  });

  describe('isSchemaJsonValid', () => {
    it('accepts a valid JSON Schema', () => {
      const result = isSchemaJsonValid(JSON.stringify({ type: 'object' }));
      expect(result.valid).toBe(true);
    });

    it('rejects non-object JSON', () => {
      const result = isSchemaJsonValid('"hello"');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Schema must be a JSON object');
    });

    it('rejects array JSON', () => {
      const result = isSchemaJsonValid('[1, 2]');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Schema must be a JSON object');
    });

    it('rejects invalid JSON', () => {
      const result = isSchemaJsonValid('not json');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateMessage', () => {
    it('validates a valid JSON message', () => {
      const schema = makeSchema();
      const results = validateMessage('{"name": "Alice"}', 'received', [schema]);
      expect(results.length).toBe(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
      expect(results[0].schemaName).toBe('Test Schema');
    });

    it('reports errors for an invalid JSON message', () => {
      const schema = makeSchema();
      const results = validateMessage('{"age": 42}', 'received', [schema]);
      expect(results.length).toBe(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.length).toBeGreaterThan(0);
      expect(results[0].errors[0].keyword).toBe('required');
    });

    it('returns empty array for non-JSON data', () => {
      const schema = makeSchema();
      const results = validateMessage('not json', 'received', [schema]);
      expect(results).toEqual([]);
    });

    it('skips disabled schemas', () => {
      const schema = makeSchema({ enabled: false });
      const results = validateMessage('{"name": "Alice"}', 'received', [schema]);
      expect(results).toEqual([]);
    });

    it('skips schemas with non-matching direction', () => {
      const schema = makeSchema({ direction: 'sent' });
      const results = validateMessage('{"name": "Alice"}', 'received', [schema]);
      expect(results).toEqual([]);
    });

    it('validates when direction is "both"', () => {
      const schema = makeSchema({ direction: 'both' });
      const results = validateMessage('{"name": "Alice"}', 'sent', [schema]);
      expect(results.length).toBe(1);
      expect(results[0].valid).toBe(true);
    });

    it('validates against multiple schemas', () => {
      const s1 = makeSchema({ id: 's1', name: 'S1' });
      const s2 = makeSchema({
        id: 's2',
        name: 'S2',
        schema: JSON.stringify({ type: 'object', properties: { age: { type: 'number' } }, required: ['age'] }),
      });
      const results = validateMessage('{"name": "Alice"}', 'received', [s1, s2]);
      expect(results.length).toBe(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });

    it('provides error details with path, message, and keyword', () => {
      const schema = makeSchema({
        schema: JSON.stringify({
          type: 'object',
          properties: { name: { type: 'string' }, age: { type: 'number' } },
          required: ['name', 'age'],
        }),
      });
      const results = validateMessage('{"name": 123}', 'received', [schema]);
      expect(results[0].valid).toBe(false);
      const errors = results[0].errors;
      expect(errors.length).toBeGreaterThanOrEqual(2);
      const typeError = errors.find((e) => e.keyword === 'type' && e.path === '/name');
      expect(typeError).toBeDefined();
      expect(typeError!.message).toContain('string');
    });

    it('limits errors to 20', () => {
      const props: Record<string, { type: string }> = {};
      for (let i = 0; i < 30; i++) {
        props[`field${i}`] = { type: 'string' };
      }
      const schema = makeSchema({
        schema: JSON.stringify({
          type: 'object',
          properties: props,
          required: Object.keys(props),
        }),
      });
      const results = validateMessage('{}', 'received', [schema]);
      expect(results[0].errors.length).toBeLessThanOrEqual(20);
    });

    it('caches compiled validators across calls', () => {
      const schema = makeSchema();
      validateMessage('{"name": "a"}', 'received', [schema]);
      const results = validateMessage('{"name": "b"}', 'received', [schema]);
      expect(results[0].valid).toBe(true);
    });

    it('handles schemas with $id without caching conflicts', () => {
      clearCompiledSchemas();
      const schema1 = makeSchema({
        id: 's-id1',
        schema: JSON.stringify({ $id: 'mySchema', type: 'object', properties: { x: { type: 'number' } }, required: ['x'] }),
      });
      const r1 = validateMessage('{"x": 1}', 'received', [schema1]);
      expect(r1[0].valid).toBe(true);

      clearCompiledSchemas();
      const schema2 = makeSchema({
        id: 's-id2',
        schema: JSON.stringify({ $id: 'mySchema', type: 'object', properties: { y: { type: 'string' } }, required: ['y'] }),
      });
      const r2 = validateMessage('{"y": "hello"}', 'received', [schema2]);
      expect(r2[0].valid).toBe(true);
    });

    it('handles schema update by recompiling', () => {
      const schema = makeSchema({ id: 'update-test' });
      const r1 = validateMessage('{"name": "Alice"}', 'received', [schema]);
      expect(r1[0].valid).toBe(true);

      const updated = {
        ...schema,
        schema: JSON.stringify({ type: 'object', properties: { email: { type: 'string' } }, required: ['email'] }),
      };
      compileSchema(updated.id, updated.schema);
      const r2 = validateMessage('{"name": "Alice"}', 'received', [updated]);
      expect(r2[0].valid).toBe(false);
    });

    it('handles schema with format validation (ajv-formats)', () => {
      const schema = makeSchema({
        schema: JSON.stringify({
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
          required: ['email'],
        }),
      });
      const valid = validateMessage('{"email": "test@example.com"}', 'received', [schema]);
      expect(valid[0].valid).toBe(true);
      const invalid = validateMessage('{"email": "not-an-email"}', 'received', [schema]);
      expect(invalid[0].valid).toBe(false);
    });
  });
});

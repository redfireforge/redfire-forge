import { describe, it, expect } from 'vitest';
import { generateStub, generateStubJson } from './schemaStubGenerator';
import type { SchemaObject } from '../types/catalog';

describe('schemaStubGenerator', () => {
  describe('generateStub', () => {
    it('returns null for undefined schema', () => {
      expect(generateStub(undefined)).toBeNull();
    });

    it('returns null for empty schema', () => {
      expect(generateStub({})).toBeNull();
    });

    it('uses example value when present', () => {
      expect(generateStub({ type: 'string', example: 'hello' })).toBe('hello');
    });

    it('uses default value when present', () => {
      expect(generateStub({ type: 'integer', default: 42 })).toBe(42);
    });

    it('prefers example over default', () => {
      expect(generateStub({ type: 'string', example: 'ex', default: 'def' })).toBe('ex');
    });

    // String types
    it('stubs plain string', () => {
      expect(generateStub({ type: 'string' })).toBe('string');
    });

    it('stubs date-time string', () => {
      expect(generateStub({ type: 'string', format: 'date-time' })).toBe('2026-01-01T00:00:00Z');
    });

    it('stubs date string', () => {
      expect(generateStub({ type: 'string', format: 'date' })).toBe('2026-01-01');
    });

    it('stubs email string', () => {
      expect(generateStub({ type: 'string', format: 'email' })).toBe('user@example.com');
    });

    it('stubs uuid string', () => {
      expect(generateStub({ type: 'string', format: 'uuid' })).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('stubs uri string', () => {
      expect(generateStub({ type: 'string', format: 'uri' })).toBe('https://example.com');
    });

    // Numeric types
    it('stubs integer', () => {
      expect(generateStub({ type: 'integer' })).toBe(0);
    });

    it('stubs integer with minimum', () => {
      expect(generateStub({ type: 'integer', minimum: 5 })).toBe(5);
    });

    it('stubs number', () => {
      expect(generateStub({ type: 'number' })).toBe(0);
    });

    it('stubs number with minimum', () => {
      expect(generateStub({ type: 'number', minimum: 1.5 })).toBe(1.5);
    });

    // Boolean
    it('stubs boolean', () => {
      expect(generateStub({ type: 'boolean' })).toBe(false);
    });

    // Enum
    it('picks first enum value', () => {
      expect(generateStub({ type: 'string', enum: ['active', 'inactive'] })).toBe('active');
    });

    it('picks first numeric enum value', () => {
      expect(generateStub({ type: 'integer', enum: [1, 2, 3] })).toBe(1);
    });

    // Array
    it('stubs array with items', () => {
      expect(generateStub({ type: 'array', items: { type: 'string' } })).toEqual(['string']);
    });

    it('stubs array without items', () => {
      expect(generateStub({ type: 'array' })).toEqual([null]);
    });

    // Object
    it('stubs object with properties', () => {
      const schema: SchemaObject = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
          active: { type: 'boolean' },
        },
      };
      expect(generateStub(schema)).toEqual({
        name: 'string',
        age: 0,
        active: false,
      });
    });

    it('stubs object without explicit type but with properties', () => {
      const schema: SchemaObject = {
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      };
      expect(generateStub(schema)).toEqual({
        id: '00000000-0000-0000-0000-000000000000',
      });
    });

    it('stubs nested objects', () => {
      const schema: SchemaObject = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
            },
          },
        },
      };
      expect(generateStub(schema)).toEqual({
        user: {
          name: 'string',
          email: 'user@example.com',
        },
      });
    });

    it('stubs empty object', () => {
      expect(generateStub({ type: 'object' })).toEqual({});
    });

    // Composition
    it('handles oneOf by picking first', () => {
      const schema: SchemaObject = {
        oneOf: [
          { type: 'string' },
          { type: 'integer' },
        ],
      };
      expect(generateStub(schema)).toBe('string');
    });

    it('handles anyOf by picking first', () => {
      const schema: SchemaObject = {
        anyOf: [
          { type: 'integer', example: 10 },
          { type: 'string' },
        ],
      };
      expect(generateStub(schema)).toBe(10);
    });

    it('merges allOf schemas', () => {
      const schema: SchemaObject = {
        allOf: [
          { type: 'object', properties: { id: { type: 'string' } } },
          { type: 'object', properties: { name: { type: 'string' } } },
        ],
      };
      expect(generateStub(schema)).toEqual({ id: 'string', name: 'string' });
    });

    // Depth guard
    it('returns null when max depth exceeded', () => {
      expect(generateStub({ type: 'string' }, 11)).toBeNull();
    });
  });

  describe('generateStubJson', () => {
    it('returns formatted JSON string', () => {
      const schema: SchemaObject = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };
      const json = generateStubJson(schema);
      expect(JSON.parse(json)).toEqual({ name: 'string' });
    });

    it('returns "null" for undefined schema', () => {
      expect(generateStubJson(undefined)).toBe('null');
    });
  });
});

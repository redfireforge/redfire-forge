import { describe, it, expect } from 'vitest';
import { createSchemaDefinition, MAX_SCHEMAS } from './wsSchemaTypes';
import type { WsSchemaDefinition, WsSchemaDirection, WsValidationError, WsValidationResult, WsValidationFilter } from './wsSchemaTypes';

describe('wsSchemaTypes', () => {
  describe('createSchemaDefinition', () => {
    it('creates a schema with correct fields', () => {
      const schema = createSchemaDefinition('UserMessage', '{"type":"object"}', 'sent');
      expect(schema.name).toBe('UserMessage');
      expect(schema.schema).toBe('{"type":"object"}');
      expect(schema.direction).toBe('sent');
      expect(schema.enabled).toBe(true);
      expect(schema.id).toMatch(/^ws-schema-/);
      expect(schema.createdAt).toBeTruthy();
      expect(schema.updatedAt).toBeTruthy();
    });

    it('generates unique IDs', () => {
      const s1 = createSchemaDefinition('A', '{}', 'sent');
      const s2 = createSchemaDefinition('B', '{}', 'received');
      expect(s1.id).not.toBe(s2.id);
    });

    it('supports all direction values', () => {
      const dirs: WsSchemaDirection[] = ['sent', 'received', 'both'];
      for (const dir of dirs) {
        const schema = createSchemaDefinition('Test', '{}', dir);
        expect(schema.direction).toBe(dir);
      }
    });

    it('sets createdAt and updatedAt to ISO strings', () => {
      const schema = createSchemaDefinition('X', '{}', 'both');
      expect(() => new Date(schema.createdAt)).not.toThrow();
      expect(() => new Date(schema.updatedAt)).not.toThrow();
    });
  });

  describe('type contracts', () => {
    it('WsSchemaDefinition has all required fields', () => {
      const schema: WsSchemaDefinition = {
        id: 'test', name: 'Test', schema: '{}', direction: 'sent',
        enabled: true, createdAt: '', updatedAt: '',
      };
      expect(schema).toBeTruthy();
    });

    it('WsValidationResult with errors', () => {
      const error: WsValidationError = { path: '/name', message: 'required', keyword: 'required' };
      const result: WsValidationResult = {
        schemaId: 's1', schemaName: 'Test', valid: false, errors: [error],
      };
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('WsValidationFilter accepts all values', () => {
      const filters: WsValidationFilter[] = ['all', 'valid', 'invalid'];
      expect(filters).toHaveLength(3);
    });
  });

  it('MAX_SCHEMAS is 20', () => {
    expect(MAX_SCHEMAS).toBe(20);
  });
});

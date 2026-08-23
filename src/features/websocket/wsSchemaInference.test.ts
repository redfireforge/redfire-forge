import { describe, it, expect } from 'vitest';
import { inferSchemaFromMessages } from './wsSchemaInference';
import type { WsFrame } from '@shared/websocket/types';

function makeFrame(data: string, direction: 'sent' | 'received' = 'received'): WsFrame {
  return {
    id: `f-${Math.random().toString(36).slice(2, 8)}`,
    direction,
    type: 'text',
    data,
    size: data.length,
    timestamp: new Date().toISOString(),
  };
}

describe('wsSchemaInference', () => {
  describe('inferSchemaFromMessages', () => {
    it('returns null when no messages', () => {
      expect(inferSchemaFromMessages([], 'received')).toBeNull();
    });

    it('returns null when no JSON messages match direction', () => {
      const frames = [makeFrame('hello', 'sent')];
      expect(inferSchemaFromMessages(frames, 'received')).toBeNull();
    });

    it('returns null when messages are not JSON', () => {
      const frames = [makeFrame('plain text', 'received')];
      expect(inferSchemaFromMessages(frames, 'received')).toBeNull();
    });

    it('infers schema from a single JSON message', () => {
      const frames = [makeFrame('{"name": "Alice", "age": 30}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      expect(result).not.toBeNull();
      const schema = JSON.parse(result!);
      expect(schema.type).toBe('object');
      expect(schema.properties.name.type).toBe('string');
      expect(schema.properties.age.type).toBe('integer');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('age');
    });

    it('merges schemas across multiple messages', () => {
      const frames = [
        makeFrame('{"name": "Alice", "age": 30}', 'received'),
        makeFrame('{"name": "Bob"}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.required).toContain('name');
      expect(schema.required).not.toContain('age');
      expect(schema.properties.age).toBeDefined();
    });

    it('handles direction=both', () => {
      const frames = [
        makeFrame('{"msg": "hello"}', 'sent'),
        makeFrame('{"msg": "world"}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'both');
      const schema = JSON.parse(result!);
      expect(schema.properties.msg.type).toBe('string');
    });

    it('filters by direction', () => {
      const frames = [
        makeFrame('{"sent": true}', 'sent'),
        makeFrame('{"received": true}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'sent');
      const schema = JSON.parse(result!);
      expect(schema.properties.sent).toBeDefined();
      expect(schema.properties.received).toBeUndefined();
    });

    it('infers array types', () => {
      const frames = [makeFrame('{"items": [1, 2, 3]}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.items.type).toBe('array');
      expect(schema.properties.items.items.type).toBe('integer');
    });

    it('detects string formats (email, uuid, date-time)', () => {
      const frames = [makeFrame('{"email": "test@example.com", "id": "550e8400-e29b-41d4-a716-446655440000", "created": "2024-01-01T00:00:00Z"}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.email.format).toBe('email');
      expect(schema.properties.id.format).toBe('uuid');
      expect(schema.properties.created.format).toBe('date-time');
    });

    it('detects date and uri string formats', () => {
      const frames = [makeFrame('{"born":"2024-01-01","link":"https://example.com"}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.born.format).toBe('date');
      expect(schema.properties.link.format).toBe('uri');
    });

    it('returns null schema when no json messages match direction', () => {
      const frames = [makeFrame('plain text', 'sent')];
      expect(inferSchemaFromMessages(frames, 'received')).toBeNull();
    });

    it('handles nested objects', () => {
      const frames = [makeFrame('{"user": {"name": "Alice", "role": "admin"}}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.user.type).toBe('object');
      expect(schema.properties.user.properties.name.type).toBe('string');
    });

    it('handles null values', () => {
      const frames = [makeFrame('{"value": null}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.value.type).toBe('null');
    });

    it('handles boolean values', () => {
      const frames = [makeFrame('{"active": true}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.active.type).toBe('boolean');
    });

    it('skips binary frames', () => {
      const binaryFrame: WsFrame = {
        id: 'f-bin',
        direction: 'received',
        type: 'binary',
        data: 'AQID',
        size: 3,
        timestamp: new Date().toISOString(),
      };
      expect(inferSchemaFromMessages([binaryFrame], 'received')).toBeNull();
    });

    it('uses most recent messages (up to 50)', () => {
      const frames: WsFrame[] = [];
      for (let i = 0; i < 60; i++) {
        frames.push(makeFrame(`{"index": ${i}}`, 'received'));
      }
      const result = inferSchemaFromMessages(frames, 'received');
      expect(result).not.toBeNull();
    });

    it('handles heterogeneous types across messages', () => {
      const frames = [
        makeFrame('{"value": "text"}', 'received'),
        makeFrame('{"value": 42}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(Array.isArray(schema.properties.value.type)).toBe(true);
      expect(schema.properties.value.type).toContain('string');
      expect(schema.properties.value.type).toContain('integer');
    });

    it('handles number vs integer distinction', () => {
      const frames = [makeFrame('{"x": 1.5}', 'received')];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.x.type).toBe('number');
    });

    it('merges array items across samples with different item types', () => {
      const frames = [
        makeFrame('{"items": [1, 2]}', 'received'),
        makeFrame('{"items": ["a", "b"]}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.items.type).toBe('array');
      expect(Array.isArray(schema.properties.items.items.type)).toBe(true);
      expect(schema.properties.items.items.type).toContain('integer');
      expect(schema.properties.items.items.type).toContain('string');
    });

    it('merges array items when some samples have empty arrays', () => {
      const frames = [
        makeFrame('{"data": []}', 'received'),
        makeFrame('{"data": [{"id": 1}]}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.data.type).toBe('array');
      expect(schema.properties.data.items.type).toBe('object');
    });

    it('handles merging array schemas where all samples have empty arrays (itemNodes empty → no items key)', () => {
      // All arrays empty → itemNodes = [] → false branch of `itemNodes.length > 0`
      const frames = [
        makeFrame('{"data": []}', 'received'),
        makeFrame('{"data": []}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.properties.data.type).toBe('array');
      expect(schema.properties.data.items).toBeUndefined();
    });

    it('infers optional properties (keys not present in all samples are excluded from required)', () => {
      // Two object samples with different keys → commonKeys only includes shared keys
      const frames = [
        makeFrame('{"a": 1, "b": 2}', 'received'),
        makeFrame('{"a": 3}', 'received'),
      ];
      const result = inferSchemaFromMessages(frames, 'received');
      const schema = JSON.parse(result!);
      expect(schema.required).toContain('a');
      expect(schema.required).not.toContain('b');
      // 'b' should still appear as a property (from first sample)
      expect(schema.properties.b).toBeDefined();
    });
  });
});

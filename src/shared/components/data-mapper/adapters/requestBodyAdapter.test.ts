import { describe, it, expect, vi } from 'vitest';
import {
  createRequestBodyAdapter,
  extractBodyTemplateRefs,
  parseBodyJson,
  collectBodyLeafPaths,
  buildBodyFromMappings,
  resolveTemplateValue,
} from './requestBodyAdapter';
import type { Mapping } from '../types';

// ─── extractBodyTemplateRefs ──────────────────────────────

describe('extractBodyTemplateRefs', () => {
  it('extracts single ref', () => {
    expect(extractBodyTemplateRefs('Hello {{name}}')).toEqual(['name']);
  });

  it('extracts multiple refs', () => {
    expect(extractBodyTemplateRefs('{{first}} {{last}}')).toEqual(['first', 'last']);
  });

  it('trims whitespace inside braces', () => {
    expect(extractBodyTemplateRefs('{{ name }}')).toEqual(['name']);
  });

  it('returns empty array for no refs', () => {
    expect(extractBodyTemplateRefs('no templates here')).toEqual([]);
  });

  it('returns empty for empty string', () => {
    expect(extractBodyTemplateRefs('')).toEqual([]);
  });

  it('handles refs with dots', () => {
    expect(extractBodyTemplateRefs('{{node:abc.status}}')).toEqual(['node:abc.status']);
  });

  it('handles generator refs starting with $', () => {
    expect(extractBodyTemplateRefs('{{$uuid}}')).toEqual(['$uuid']);
  });

  it('handles multiple refs on same line', () => {
    expect(extractBodyTemplateRefs('a={{x}}&b={{y}}')).toEqual(['x', 'y']);
  });

  it('skips empty braces', () => {
    expect(extractBodyTemplateRefs('{{}} text')).toEqual([]);
  });
});

// ─── parseBodyJson ────────────────────────────────────────

describe('parseBodyJson', () => {
  it('parses valid JSON object', () => {
    expect(parseBodyJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('returns null for array JSON', () => {
    expect(parseBodyJson('[1, 2]')).toBeNull();
  });

  it('returns null for primitive JSON', () => {
    expect(parseBodyJson('"hello"')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseBodyJson('not json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseBodyJson('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseBodyJson('   ')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseBodyJson(undefined as unknown as string)).toBeNull();
  });

  it('parses nested objects', () => {
    const result = parseBodyJson('{"user": {"name": "Alice", "age": 30}}');
    expect(result).toEqual({ user: { name: 'Alice', age: 30 } });
  });

  it('handles JSON with template refs', () => {
    const result = parseBodyJson('{"id": "{{userId}}"}');
    expect(result).toEqual({ id: '{{userId}}' });
  });
});

// ─── collectBodyLeafPaths ─────────────────────────────────

describe('collectBodyLeafPaths', () => {
  it('collects flat object leaves', () => {
    const leaves = collectBodyLeafPaths({ a: 1, b: 'hello' });
    expect(leaves).toEqual([
      { path: 'a', value: 1 },
      { path: 'b', value: 'hello' },
    ]);
  });

  it('collects nested leaves', () => {
    const leaves = collectBodyLeafPaths({ user: { name: 'Alice', age: 30 } });
    expect(leaves).toEqual([
      { path: 'user.name', value: 'Alice' },
      { path: 'user.age', value: 30 },
    ]);
  });

  it('treats arrays as leaf values', () => {
    const leaves = collectBodyLeafPaths({ tags: ['a', 'b'] });
    expect(leaves).toEqual([{ path: 'tags', value: ['a', 'b'] }]);
  });

  it('handles null values', () => {
    const leaves = collectBodyLeafPaths({ x: null });
    expect(leaves).toEqual([{ path: 'x', value: null }]);
  });

  it('handles boolean values', () => {
    const leaves = collectBodyLeafPaths({ active: true });
    expect(leaves).toEqual([{ path: 'active', value: true }]);
  });

  it('handles empty object as leaf', () => {
    const leaves = collectBodyLeafPaths({ empty: {} });
    expect(leaves).toEqual([{ path: 'empty', value: {} }]);
  });

  it('returns empty array for null input', () => {
    expect(collectBodyLeafPaths(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(collectBodyLeafPaths(undefined)).toEqual([]);
  });

  it('handles deeply nested objects', () => {
    const leaves = collectBodyLeafPaths({ a: { b: { c: { d: 42 } } } });
    expect(leaves).toEqual([{ path: 'a.b.c.d', value: 42 }]);
  });
});

describe('resolveTemplateValue', () => {
  it('formats bigint and symbol as string display', () => {
    expect(resolveTemplateValue(42n)).toEqual({ display: '42', type: 'string' });
    expect(resolveTemplateValue(Symbol('s')).display).toMatch(/^Symbol/);
    expect(resolveTemplateValue(Symbol('s')).type).toBe('string');
  });
});

// ─── buildBodyFromMappings ────────────────────────────────

describe('buildBodyFromMappings', () => {
  it('builds body from mappings with null base', () => {
    const mappings: Mapping[] = [
      { id: '1', sourceId: 's', sourcePath: 'userId', targetPath: 'id' },
      { id: '2', sourceId: 's', sourcePath: 'userName', targetPath: 'name' },
    ];
    const result = JSON.parse(buildBodyFromMappings(mappings, null));
    expect(result).toEqual({ id: '{{userId}}', name: '{{userName}}' });
  });

  it('overlays mappings on existing base object', () => {
    const base = { id: 0, name: 'placeholder', extra: true };
    const mappings: Mapping[] = [
      { id: '1', sourceId: 's', sourcePath: 'userId', targetPath: 'id' },
    ];
    const result = JSON.parse(buildBodyFromMappings(mappings, base));
    expect(result.id).toBe('{{userId}}');
    expect(result.name).toBe('placeholder');
    expect(result.extra).toBe(true);
  });

  it('creates nested structure from dotted target paths', () => {
    const mappings: Mapping[] = [
      { id: '1', sourceId: 's', sourcePath: 'street', targetPath: 'address.street' },
      { id: '2', sourceId: 's', sourcePath: 'city', targetPath: 'address.city' },
    ];
    const result = JSON.parse(buildBodyFromMappings(mappings, null));
    expect(result).toEqual({
      address: {
        street: '{{street}}',
        city: '{{city}}',
      },
    });
  });

  it('uses expression over sourcePath when available', () => {
    const mappings: Mapping[] = [
      { id: '1', sourceId: 's', sourcePath: 'raw', targetPath: 'total', expression: '$parseFloat(raw)' },
    ];
    const result = JSON.parse(buildBodyFromMappings(mappings, null));
    expect(result.total).toBe('{{$parseFloat(raw)}}');
  });

  it('skips mappings with empty targetPath', () => {
    const mappings: Mapping[] = [
      { id: '1', sourceId: 's', sourcePath: 'x', targetPath: '' },
      { id: '2', sourceId: 's', sourcePath: 'y', targetPath: 'valid' },
    ];
    const result = JSON.parse(buildBodyFromMappings(mappings, null));
    expect(result).toEqual({ valid: '{{y}}' });
  });

  it('skips mappings with empty sourcePath', () => {
    const mappings: Mapping[] = [
      { id: '1', sourceId: 's', sourcePath: '', targetPath: 'field' },
    ];
    const result = JSON.parse(buildBodyFromMappings(mappings, null));
    expect(result).toEqual({});
  });

  it('returns empty object JSON for no mappings', () => {
    const result = JSON.parse(buildBodyFromMappings([], null));
    expect(result).toEqual({});
  });

  it('does not mutate the base object', () => {
    const base = { id: 1 };
    const original = JSON.stringify(base);
    buildBodyFromMappings(
      [{ id: '1', sourceId: 's', sourcePath: 'x', targetPath: 'id' }],
      base,
    );
    expect(JSON.stringify(base)).toBe(original);
  });

  it('falls back to JSON serialization when structuredClone throws', () => {
    const spy = vi.spyOn(globalThis, 'structuredClone').mockImplementation(() => {
      throw new Error('clone failed');
    });
    const parsed = JSON.parse(buildBodyFromMappings(
      [{ id: '1', sourceId: 's', sourcePath: 'x', targetPath: 'field' }],
      { ok: true, nested: { y: 1 } },
    ));
    spy.mockRestore();
    expect(parsed.ok).toBe(true);
    expect(parsed.nested.y).toBe(1);
    expect(parsed.field).toBe('{{x}}');
  });
});

// ─── createRequestBodyAdapter ─────────────────────────────

describe('createRequestBodyAdapter', () => {
  // ─── Factory / Sources ────────────────────────────────

  describe('factory', () => {
    it('creates adapter with correct contextId and title', () => {
      const adapter = createRequestBodyAdapter({});
      expect(adapter.contextId).toBe('request-body');
      expect(adapter.title).toBe('Variables → Request Body');
      expect(adapter.category).toBe('http');
    });

    it('always includes generators source', () => {
      const adapter = createRequestBodyAdapter({});
      const gen = adapter.sources.find(s => s.id === '__generators__');
      expect(gen).toBeDefined();
      expect(gen!.label).toBe('Generators');
      const sample = gen!.sampleData as Record<string, string>;
      expect(sample.$uuid).toBe('string');
      expect(sample.$timestamp).toBe('number');
      expect(sample.$isoDate).toBe('string');
      expect(sample.$randomInt).toBe('number');
    });

    it('adds empty source when no variable hints provided', () => {
      const adapter = createRequestBodyAdapter({});
      const empty = adapter.sources.find(s => s.id === '__empty__');
      expect(empty).toBeDefined();
      expect(empty!.label).toBe('No upstream variables');
    });

    it('creates sources from variable hints grouped by node', () => {
      const adapter = createRequestBodyAdapter({
        variableHints: [
          { ref: 'orderId', label: 'Order ID', type: 'number', source: { nodeLabel: 'Create Order', nodeType: 'http', category: 'http', nodeId: 'n1' } },
          { ref: 'status', label: 'Status', type: 'string', source: { nodeLabel: 'Create Order', nodeType: 'http', category: 'http', nodeId: 'n1' } },
          { ref: 'token', label: 'Token', type: 'string', source: { nodeLabel: 'Auth', nodeType: 'http', category: 'http', nodeId: 'n2' } },
        ],
      });

      const n1 = adapter.sources.find(s => s.id === 'n1');
      expect(n1).toBeDefined();
      expect(n1!.label).toBe('Create Order');
      expect((n1!.sampleData as Record<string, string>).orderId).toBe('number');
      expect((n1!.sampleData as Record<string, string>).status).toBe('string');

      const n2 = adapter.sources.find(s => s.id === 'n2');
      expect(n2).toBeDefined();
      expect(n2!.label).toBe('Auth');
    });

    it('does not add empty source when variable hints are provided', () => {
      const adapter = createRequestBodyAdapter({
        variableHints: [
          { ref: 'x', label: 'X', source: { nodeLabel: 'Node', nodeType: 'http', category: 'http' } },
        ],
      });
      expect(adapter.sources.find(s => s.id === '__empty__')).toBeUndefined();
    });

    it('adds environment variables source', () => {
      const adapter = createRequestBodyAdapter({
        envVariables: ['API_KEY', 'BASE_URL'],
      });
      const env = adapter.sources.find(s => s.id === '__env__');
      expect(env).toBeDefined();
      expect(env!.label).toBe('Environment');
      expect((env!.sampleData as Record<string, string>).API_KEY).toBe('string');
      expect((env!.sampleData as Record<string, string>).BASE_URL).toBe('string');
    });

    it('does not add env source when envVariables is empty', () => {
      const adapter = createRequestBodyAdapter({ envVariables: [] });
      expect(adapter.sources.find(s => s.id === '__env__')).toBeUndefined();
    });

    it('includes field descriptions for hints with descriptions', () => {
      const adapter = createRequestBodyAdapter({
        variableHints: [
          { ref: 'orderId', label: 'Order ID', description: 'The order identifier', source: { nodeLabel: 'Node', nodeType: 'http', category: 'http', nodeId: 'n1' } },
        ],
      });
      const src = adapter.sources.find(s => s.id === 'n1');
      expect(src!.fieldDescriptions).toEqual({ orderId: 'The order identifier' });
    });

    it('includes generator descriptions', () => {
      const adapter = createRequestBodyAdapter({});
      const gen = adapter.sources.find(s => s.id === '__generators__');
      expect(gen!.fieldDescriptions!.$uuid).toBe('Random UUID v4');
    });
  });

  // ─── Target ───────────────────────────────────────────

  describe('target', () => {
    it('allows custom fields', () => {
      const adapter = createRequestBodyAdapter({});
      expect(adapter.target.allowCustomFields).toBe(true);
    });

    it('has no fields when no existing body or schema', () => {
      const adapter = createRequestBodyAdapter({});
      expect(adapter.target.fields).toBeUndefined();
      expect(adapter.target.sampleData).toBeUndefined();
    });

    it('builds target fields from existing JSON body', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"name": "Alice", "age": 30}',
      });
      expect(adapter.target.fields).toHaveLength(2);
      expect(adapter.target.fields![0].path).toBe('name');
      expect(adapter.target.fields![1].path).toBe('age');
    });

    it('builds target fields from nested JSON body', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"user": {"name": "Alice", "email": "a@b.com"}}',
      });
      expect(adapter.target.fields).toHaveLength(2);
      expect(adapter.target.fields![0].path).toBe('user.name');
      expect(adapter.target.fields![1].path).toBe('user.email');
    });

    it('detects template refs in existing body as mapped indicators', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"id": "{{userId}}"}',
      });
      expect(adapter.target.fields).toHaveLength(1);
      expect(adapter.target.fields![0].path).toBe('id');
      const sample = adapter.target.sampleData as Record<string, string>;
      expect(sample.id).toBe('→ userId');
    });

    it('builds target from body schema', () => {
      const adapter = createRequestBodyAdapter({
        bodySchema: [
          { path: 'name', type: 'string', required: true, description: 'User name' },
          { path: 'age', type: 'number', required: false },
        ],
      });
      expect(adapter.target.fields).toHaveLength(2);
      expect(adapter.target.fields![0]).toEqual({
        path: 'name', label: 'name', type: 'string', required: true, location: 'body',
      });
    });

    it('merges schema fields not already in body', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"name": "Alice"}',
        bodySchema: [
          { path: 'name', type: 'string' },
          { path: 'email', type: 'string', description: 'Email address' },
        ],
      });
      expect(adapter.target.fields).toHaveLength(2);
      expect(adapter.target.fields!.map(f => f.path)).toEqual(['name', 'email']);
    });

    it('handles invalid JSON body gracefully', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: 'not valid json',
      });
      expect(adapter.target.fields).toBeUndefined();
    });

    it('serialize preserves invalid JSON body instead of wiping to {}', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: 'not valid json {{myVar}}',
      });
      const result = adapter.serialize([]);
      expect(result).toBe('not valid json {{myVar}}');
    });

    it('resolves null values in body to null type', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"field": null}',
      });
      expect(adapter.target.fields).toHaveLength(1);
      const sample = adapter.target.sampleData as Record<string, string>;
      expect(sample.field).toBe('null');
    });

    it('resolves array values in body as individual elements', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"tags": ["a","b"]}',
      });
      expect(adapter.target.fields!.length).toBeGreaterThanOrEqual(1);
    });

    it('resolves boolean values in body', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"active": true}',
      });
      const sample = adapter.target.sampleData as Record<string, string>;
      expect(sample.active).toBe('true');
    });

    it('resolves number values in body', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"count": 42}',
      });
      const sample = adapter.target.sampleData as Record<string, string>;
      expect(sample.count).toBe('42');
    });

    it('resolves empty object leaf as object display type', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"meta": {}}',
      });
      expect(adapter.target.fields).toHaveLength(1);
      const sample = adapter.target.sampleData as Record<string, string>;
      expect(sample.meta).toBe('{}');
      expect(adapter.target.fields![0].type).toBe('object');
    });
  });

  // ─── serialize ────────────────────────────────────────

  describe('serialize', () => {
    it('produces JSON with {{ref}} placeholders', () => {
      const adapter = createRequestBodyAdapter({});
      const result = adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: 'userId', targetPath: 'id' },
        { id: '2', sourceId: 's', sourcePath: 'name', targetPath: 'user.name' },
      ]);
      const parsed = JSON.parse(result);
      expect(parsed.id).toBe('{{userId}}');
      expect(parsed.user.name).toBe('{{name}}');
    });

    it('preserves existing body fields not in mappings', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"id": 0, "extra": true}',
      });
      const result = adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: 'userId', targetPath: 'id' },
      ]);
      const parsed = JSON.parse(result);
      expect(parsed.id).toBe('{{userId}}');
      expect(parsed.extra).toBe(true);
    });

    it('returns empty object for no mappings with no base body', () => {
      const adapter = createRequestBodyAdapter({});
      const result = JSON.parse(adapter.serialize([]));
      expect(result).toEqual({});
    });

    it('preserves base body when no mappings', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"existing": "value"}',
      });
      const result = JSON.parse(adapter.serialize([]));
      expect(result.existing).toBe('value');
    });

    it('uses expression when available', () => {
      const adapter = createRequestBodyAdapter({});
      const result = adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: 'x', targetPath: 'total', expression: '$parseFloat(x)' },
      ]);
      expect(JSON.parse(result).total).toBe('{{$parseFloat(x)}}');
    });
  });

  // ─── deserialize ──────────────────────────────────────

  describe('deserialize', () => {
    it('reconstructs mappings from body with template refs', () => {
      const adapter = createRequestBodyAdapter({
        variableHints: [
          { ref: 'userId', label: 'User ID', source: { nodeLabel: 'N', nodeType: 'http', category: 'http', nodeId: 'n1' } },
        ],
      });
      const body = JSON.stringify({ id: '{{userId}}', name: '{{userName}}' });
      const mappings = adapter.deserialize(body);
      expect(mappings).toHaveLength(2);
      expect(mappings[0].sourcePath).toBe('userId');
      expect(mappings[0].targetPath).toBe('id');
      expect(mappings[0].sourceId).toBe('n1');
      expect(mappings[1].sourcePath).toBe('userName');
      expect(mappings[1].targetPath).toBe('name');
    });

    it('returns empty array for empty string', () => {
      const adapter = createRequestBodyAdapter({});
      expect(adapter.deserialize('')).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const adapter = createRequestBodyAdapter({});
      expect(adapter.deserialize('not json')).toEqual([]);
    });

    it('returns empty array for body with no template refs', () => {
      const adapter = createRequestBodyAdapter({});
      expect(adapter.deserialize('{"id": 42}')).toEqual([]);
    });

    it('handles nested template refs', () => {
      const adapter = createRequestBodyAdapter({});
      const body = JSON.stringify({ user: { id: '{{userId}}' } });
      const mappings = adapter.deserialize(body);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].targetPath).toBe('user.id');
      expect(mappings[0].sourcePath).toBe('userId');
    });

    it('assigns generator refs to generators source', () => {
      const adapter = createRequestBodyAdapter({});
      const body = JSON.stringify({ id: '{{$uuid}}' });
      const mappings = adapter.deserialize(body);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].sourceId).toBe('__generators__');
    });

    it('assigns env refs to env source when env vars exist', () => {
      const adapter = createRequestBodyAdapter({
        envVariables: ['API_KEY'],
      });
      const body = JSON.stringify({ key: '{{API_KEY}}' });
      const mappings = adapter.deserialize(body);
      expect(mappings[0].sourceId).toBe('__env__');
    });

    it('ignores non-string leaf values', () => {
      const adapter = createRequestBodyAdapter({});
      const body = JSON.stringify({ num: 42, bool: true, str: '{{ref}}' });
      const mappings = adapter.deserialize(body);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].targetPath).toBe('str');
    });
  });

  // ─── Round-trip ───────────────────────────────────────

  describe('round-trip', () => {
    it('serialize → deserialize produces equivalent mappings', () => {
      const adapter = createRequestBodyAdapter({
        variableHints: [
          { ref: 'orderId', label: 'Order ID', type: 'number', source: { nodeLabel: 'N', nodeType: 'http', category: 'http', nodeId: 'n1' } },
          { ref: 'status', label: 'Status', type: 'string', source: { nodeLabel: 'N', nodeType: 'http', category: 'http', nodeId: 'n1' } },
        ],
      });

      const original: Mapping[] = [
        { id: '1', sourceId: 'n1', sourcePath: 'orderId', targetPath: 'order.id' },
        { id: '2', sourceId: 'n1', sourcePath: 'status', targetPath: 'order.status' },
      ];

      const serialized = adapter.serialize(original);
      const deserialized = adapter.deserialize(serialized);

      expect(deserialized).toHaveLength(2);
      expect(deserialized.map(m => m.sourcePath).sort()).toEqual(['orderId', 'status']);
      expect(deserialized.map(m => m.targetPath).sort()).toEqual(['order.id', 'order.status']);
      expect(deserialized.every(m => m.sourceId === 'n1')).toBe(true);
    });

    it('round-trips generator refs', () => {
      const adapter = createRequestBodyAdapter({});
      const original: Mapping[] = [
        { id: '1', sourceId: '__generators__', sourcePath: '$uuid', targetPath: 'requestId' },
      ];

      const serialized = adapter.serialize(original);
      expect(JSON.parse(serialized).requestId).toBe('{{$uuid}}');

      const deserialized = adapter.deserialize(serialized);
      expect(deserialized).toHaveLength(1);
      expect(deserialized[0].sourcePath).toBe('$uuid');
      expect(deserialized[0].sourceId).toBe('__generators__');
    });

    it('round-trips environment variables', () => {
      const adapter = createRequestBodyAdapter({
        envVariables: ['API_KEY'],
      });
      const original: Mapping[] = [
        { id: '1', sourceId: '__env__', sourcePath: 'API_KEY', targetPath: 'auth.key' },
      ];

      const serialized = adapter.serialize(original);
      const deserialized = adapter.deserialize(serialized);
      expect(deserialized[0].sourcePath).toBe('API_KEY');
      expect(deserialized[0].sourceId).toBe('__env__');
    });

    it('round-trips mixed sources', () => {
      const adapter = createRequestBodyAdapter({
        variableHints: [
          { ref: 'userId', label: 'User ID', source: { nodeLabel: 'Auth', nodeType: 'http', category: 'http', nodeId: 'auth' } },
        ],
        envVariables: ['BASE_URL'],
      });

      const original: Mapping[] = [
        { id: '1', sourceId: 'auth', sourcePath: 'userId', targetPath: 'user.id' },
        { id: '2', sourceId: '__generators__', sourcePath: '$uuid', targetPath: 'requestId' },
        { id: '3', sourceId: '__env__', sourcePath: 'BASE_URL', targetPath: 'config.baseUrl' },
      ];

      const serialized = adapter.serialize(original);
      const deserialized = adapter.deserialize(serialized);

      expect(deserialized).toHaveLength(3);
      const byTarget = new Map(deserialized.map(m => [m.targetPath, m]));
      expect(byTarget.get('user.id')!.sourceId).toBe('auth');
      expect(byTarget.get('requestId')!.sourceId).toBe('__generators__');
      expect(byTarget.get('config.baseUrl')!.sourceId).toBe('__env__');
    });
  });

  // ─── validate ─────────────────────────────────────────

  describe('validate', () => {
    it('returns info for empty mappings', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([]);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('info');
    });

    it('reports error for empty targetPath', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([
        { id: '1', sourceId: 's', sourcePath: 'x', targetPath: '' },
      ]);
      expect(issues.some(i => i.severity === 'error' && i.message.includes('Target field path'))).toBe(true);
    });

    it('reports error for empty sourcePath', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([
        { id: '1', sourceId: 's', sourcePath: '', targetPath: 'field' },
      ]);
      expect(issues.some(i => i.severity === 'error' && i.message.includes('No variable bound'))).toBe(true);
    });

    it('reports warning for duplicate targetPath', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([
        { id: '1', sourceId: 's', sourcePath: 'a', targetPath: 'field' },
        { id: '2', sourceId: 's', sourcePath: 'b', targetPath: 'field' },
      ]);
      expect(issues.some(i => i.severity === 'warning' && i.message.includes('multiple mappings'))).toBe(true);
    });

    it('no issues for valid mappings', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([
        { id: '1', sourceId: 's', sourcePath: 'x', targetPath: 'field1' },
        { id: '2', sourceId: 's', sourcePath: 'y', targetPath: 'field2' },
      ]);
      expect(issues).toHaveLength(0);
    });

    it('considers expression as bound ref', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([
        { id: '1', sourceId: 's', sourcePath: '', targetPath: 'field', expression: '$uuid' },
      ]);
      expect(issues).toHaveLength(0);
    });

    it('treats empty expression string as unbound', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([
        { id: '1', sourceId: 's', sourcePath: '', targetPath: 'field', expression: '' },
      ]);
      expect(issues.some(i => i.severity === 'error' && i.message.includes('No variable bound'))).toBe(true);
    });

    it('reports reserved path segment in field path during validate', () => {
      const adapter = createRequestBodyAdapter({});
      const issues = adapter.validate!([
        { id: '1', sourceId: 's', sourcePath: 'x', targetPath: 'data.__proto__.x' },
      ]);
      expect(issues.some(i => i.severity === 'error' && i.message.includes('reserved segment'))).toBe(true);
    });
  });

  // ─── Edge cases ───────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty JSON body {} without spurious fields', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{}',
      });
      expect(adapter.target.fields).toBeUndefined();
      expect(adapter.target.sampleData).toBeUndefined();
    });

    it('handles body with array values as single leaf targets', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"tags": ["a", "b"], "name": "test"}',
      });
      const fields = adapter.target.fields!;
      const paths = fields.map(f => f.path);
      expect(paths).toContain('tags');
      expect(paths).toContain('name');
      expect(paths).not.toContain('tags[0]');
    });

    it('composite template {{a}}{{b}} restores all refs on deserialize', () => {
      const adapter = createRequestBodyAdapter({});
      const body = JSON.stringify({ field: '{{a}}{{b}}' });
      const mappings = adapter.deserialize(body);
      expect(mappings).toHaveLength(2);
      expect(mappings[0].sourcePath).toBe('a');
      expect(mappings[1].sourcePath).toBe('b');
      expect(mappings[0].targetPath).toBe('field');
      expect(mappings[1].targetPath).toBe('field');
    });

    it('multi-ref round-trip: deserialize → serialize preserves {{a}}{{b}}', () => {
      const adapter = createRequestBodyAdapter({});
      const original = JSON.stringify({ field: '{{a}}{{b}}' });
      const mappings = adapter.deserialize(original);
      const serialized = adapter.serialize(mappings);
      const parsed = JSON.parse(serialized);
      expect(parsed.field).toBe('{{a}}{{b}}');
    });

    it('serialize uses setByPath (prototype keys are rejected)', () => {
      const adapter = createRequestBodyAdapter({});
      const result = adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: 'x', targetPath: '__proto__.polluted' },
      ]);
      const parsed = JSON.parse(result);
      expect(Object.keys(parsed)).not.toContain('__proto__');
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('serialize handles structuredClone fallback for exotic base', () => {
      const adapter = createRequestBodyAdapter({
        existingBody: '{"ok": true}',
      });
      const result = JSON.parse(adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: 'x', targetPath: 'field' },
      ]));
      expect(result.ok).toBe(true);
      expect(result.field).toBe('{{x}}');
    });

    it('serialize skips mapping when expression is empty and sourcePath is empty', () => {
      const adapter = createRequestBodyAdapter({});
      const result = JSON.parse(adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: '', targetPath: 'field', expression: '' },
      ]));
      expect(result).toEqual({});
    });

    it('serialize prefers non-empty expression over sourcePath', () => {
      const adapter = createRequestBodyAdapter({});
      const result = JSON.parse(adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: 'fallback', targetPath: 'f', expression: '$uuid' },
      ]));
      expect(result.f).toBe('{{$uuid}}');
    });

    it('serialize falls back to sourcePath when expression is empty string', () => {
      const adapter = createRequestBodyAdapter({});
      const result = JSON.parse(adapter.serialize([
        { id: '1', sourceId: 's', sourcePath: 'fallback', targetPath: 'f', expression: '' },
      ]));
      expect(result.f).toBe('{{fallback}}');
    });

    it('round-trip preserves deeply nested structure', () => {
      const adapter = createRequestBodyAdapter({
        variableHints: [
          { ref: 'city', label: 'City', source: { nodeLabel: 'N', nodeType: 'http', category: 'http', nodeId: 'n1' } },
        ],
      });
      const original: Mapping[] = [
        { id: '1', sourceId: 'n1', sourcePath: 'city', targetPath: 'address.primary.city' },
      ];
      const serialized = adapter.serialize(original);
      const parsed = JSON.parse(serialized);
      expect(parsed.address.primary.city).toBe('{{city}}');

      const deserialized = adapter.deserialize(serialized);
      expect(deserialized).toHaveLength(1);
      expect(deserialized[0].targetPath).toBe('address.primary.city');
    });

    it('schema description used as sample data when no body exists', () => {
      const adapter = createRequestBodyAdapter({
        bodySchema: [
          { path: 'email', type: 'string', description: 'User email address' },
        ],
      });
      const sample = adapter.target.sampleData as Record<string, string>;
      expect(sample.email).toBe('User email address');
    });

    it('schema without description uses type placeholder', () => {
      const adapter = createRequestBodyAdapter({
        bodySchema: [
          { path: 'age', type: 'number' },
        ],
      });
      const sample = adapter.target.sampleData as Record<string, string>;
      expect(sample.age).toBe('<number>');
    });
  });
});

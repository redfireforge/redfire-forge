import { describe, expect, it } from 'vitest';
import { createApiMockBodyAdapter } from './apiMockBodyAdapter';

describe('createApiMockBodyAdapter', () => {
  it('round-trips template refs and serializes faker / request helpers', () => {
    const adapter = createApiMockBodyAdapter({
      existingBody: '{"id":"{{pathParam \'id\'}}","name":"{{faker \'person.firstName\'}}","createdAt":"{{now}}"}',
      pathParams: ['id'],
    });
    const mappings = adapter.deserialize(adapter.target.sampleData ? JSON.stringify(adapter.target.sampleData) : '');
    expect(mappings.some(m => m.sourceId === 'request' && m.sourcePath === 'pathParam.id')).toBe(true);
    expect(mappings.some(m => m.sourceId === 'faker')).toBe(true);
    expect(mappings.some(m => m.sourceId === 'helpers' && m.sourcePath === 'now')).toBe(true);

    const out = adapter.serialize([
      { id: '1', sourceId: 'request', sourcePath: 'pathParam.id', targetPath: 'id' },
      { id: '2', sourceId: 'faker', sourcePath: 'person.firstName', targetPath: 'name' },
      { id: '3', sourceId: 'helpers', sourcePath: 'now', targetPath: 'createdAt' },
    ]);
    expect(out).toContain("{{pathParam 'id'}}");
    expect(out).toContain("{{faker 'person.firstName'}}");
    expect(out).toContain('{{now}}');
  });

  it('validates empty, missing target, unsafe path, and missing source', () => {
    const adapter = createApiMockBodyAdapter();
    expect(adapter.validate?.([])[0].severity).toBe('info');
    expect(adapter.validate?.([
      { id: 'a', sourceId: 'helpers', sourcePath: 'uuid', targetPath: '' },
      { id: 'b', sourceId: 'helpers', sourcePath: '', targetPath: 'id' },
      { id: 'c', sourceId: 'helpers', sourcePath: 'uuid', targetPath: '__proto__.x' },
    ]).map(i => i.severity)).toEqual(['error', 'error', 'error']);
  });

  it('skips non-json bodies and unsafe serialize paths', () => {
    const adapter = createApiMockBodyAdapter({ existingBody: 'not-json' });
    expect(adapter.deserialize('not-json')).toEqual([]);
    const out = adapter.serialize([
      { id: '1', sourceId: 'helpers', sourcePath: 'uuid', targetPath: '__proto__' },
      { id: '2', sourceId: 'helpers', sourcePath: '', targetPath: 'id' },
    ]);
    expect(out).toBe('not-json');
  });

  it('does not alias the default body across adapter instances', () => {
    const a = createApiMockBodyAdapter();
    (a.target.sampleData as Record<string, string>).id = 'polluted';
    const b = createApiMockBodyAdapter();
    expect((b.target.sampleData as Record<string, string>).id).toBe('');
  });

  it('preserves JSON array bodies instead of replacing them with the default object', () => {
    const adapter = createApiMockBodyAdapter({ existingBody: '[{"id":1}]' });
    expect(adapter.serialize([
      { id: '1', sourceId: 'helpers', sourcePath: 'uuid', targetPath: 'id' },
    ])).toBe('[{"id":1}]');
  });

  it('derives path params from the route pattern and does not mutate sample data on serialize', () => {
    const adapter = createApiMockBodyAdapter({
      existingBody: '{"user":{"id":"x"}}',
      pathPattern: '/orders/:orderId/items/{itemId}',
    });
    expect(Object.keys(adapter.sources[0].sampleData as object)).toEqual(
      expect.arrayContaining(['pathParam.orderId', 'pathParam.itemId']),
    );
    const before = JSON.stringify(adapter.target.sampleData);
    adapter.serialize([{ id: '1', sourceId: 'helpers', sourcePath: 'uuid', targetPath: 'user.id' }]);
    expect(JSON.stringify(adapter.target.sampleData)).toBe(before);
  });

  it('covers helper fallbacks and empty path params', () => {
    const adapter = createApiMockBodyAdapter({ pathParams: [], pathPattern: '/plain' });
    expect(Object.keys(adapter.sources[0].sampleData as object)).toContain('pathParam.id');

    const out = adapter.serialize([
      { id: '1', sourceId: 'unknown', sourcePath: 'raw', targetPath: 'id' },
      { id: '2', sourceId: 'request', sourcePath: 'method', targetPath: 'name' },
      { id: '3', sourceId: 'helpers', sourcePath: '', expression: '   ', targetPath: 'createdAt' },
    ]);
    expect(out).toContain('{{raw}}');
    expect(out).toContain('{{method}}');
    expect(JSON.parse(out).createdAt).toBe('');

    const mappings = adapter.deserialize(
      '{"a":"{{faker noquotes}}","b":"{{pathParam noquotes}}","c":1}',
    );
    expect(mappings.some(m => m.sourceId === 'faker')).toBe(true);
    expect(mappings.some(m => m.sourceId === 'request' && m.sourcePath === 'pathParam noquotes')).toBe(true);
  });
});

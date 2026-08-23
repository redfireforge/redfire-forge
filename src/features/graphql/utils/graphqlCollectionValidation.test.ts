import { describe, it, expect } from 'vitest';
import { buildClientSchema } from 'graphql';
import type { GraphqlCollectionItem } from '@shared/types/graphql';
import { computeInvalidCollectionItemIds } from './graphqlCollectionValidation';

const introspection = {
  __schema: {
    queryType: { name: 'Query' },
    mutationType: null,
    subscriptionType: null,
    types: [
      {
        kind: 'OBJECT',
        name: 'Query',
        fields: [{ name: 'hello', type: { kind: 'SCALAR', name: 'String' }, args: [] }],
        interfaces: [],
      },
      { kind: 'SCALAR', name: 'String' },
    ],
    directives: [],
  },
} as const;

function makeItem(id: string, query: string): GraphqlCollectionItem {
  return {
    id,
    name: id,
    operation: { id: `${id}-op`, query, variables: '{}', operationType: 'query' },
  };
}

describe('computeInvalidCollectionItemIds', () => {
  it('returns empty set when introspection or items are missing', () => {
    expect(computeInvalidCollectionItemIds(null, [makeItem('a', '{ hello }')])).toEqual(new Set());
    expect(computeInvalidCollectionItemIds(introspection, [])).toEqual(new Set());
  });

  it('marks items with invalid queries', () => {
    const items = [
      makeItem('valid', '{ hello }'),
      makeItem('invalid', '{ unknownField }'),
      makeItem('empty', '   '),
    ];
    const invalid = computeInvalidCollectionItemIds(introspection, items);
    expect(invalid.has('valid')).toBe(false);
    expect(invalid.has('invalid')).toBe(true);
    expect(invalid.has('empty')).toBe(false);
  });

  it('returns empty set when introspection cannot build schema', () => {
    const invalid = computeInvalidCollectionItemIds({ bad: true }, [makeItem('a', '{ hello }')]);
    expect(invalid.size).toBe(0);
  });

  it('marks parse errors as invalid', () => {
    const items = [makeItem('syntax', '{ hello ')];
    const invalid = computeInvalidCollectionItemIds(introspection, items);
    expect(invalid.has('syntax')).toBe(true);
  });

  it('validates against built client schema', () => {
    const schema = buildClientSchema(introspection as never);
    expect(schema.getQueryType()?.getFields().hello).toBeDefined();
  });
});

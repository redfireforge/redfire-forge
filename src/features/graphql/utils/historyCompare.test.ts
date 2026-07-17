/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { compareHistoryItems, filterHistoryItems } from './historyCompare';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';

function makeItem(overrides: Partial<GraphqlHistoryItem> = {}): GraphqlHistoryItem {
  return {
    id: 'item-1',
    connectionId: 'conn-1',
    timestamp: Date.now(),
    latencyMs: 12,
    status: 'success',
    operation: {
      query: 'query GetUser($id: ID!) { user(id: $id) { id name email } }',
      variables: '{"id":"usr-a"}',
      name: 'GetUser',
      operationType: 'query',
      headers: [],
    },
    response: JSON.stringify({
      data: { user: { id: 'usr-a', name: 'Alice', email: 'alice@demo.local' } },
    }),
    ...overrides,
  };
}

describe('compareHistoryItems', () => {
  it('detects differing variables and response fields', () => {
    const alice = makeItem();
    const bob = makeItem({
      id: 'item-2',
      operation: {
        ...makeItem().operation,
        variables: '{"id":"usr-b"}',
      },
      response: JSON.stringify({
        data: { user: { id: 'usr-b', name: 'Bob', email: 'bob@demo.local' } },
      }),
    });
    const result = compareHistoryItems(alice, bob);
    expect(result.querySame).toBe(true);
    expect(result.variablesRows.find((r) => r.path === 'id')).toMatchObject({
      valueA: 'usr-a',
      valueB: 'usr-b',
      same: false,
    });
    expect(result.responseRows.find((r) => r.path === 'user.name')).toMatchObject({
      valueA: 'Alice',
      valueB: 'Bob',
      same: false,
    });
    expect(result.responseRows.find((r) => r.path === 'user.email')?.same).toBe(false);
  });

  it('marks identical query text', () => {
    const a = makeItem();
    const b = makeItem({ id: 'item-2' });
    expect(compareHistoryItems(a, b).querySame).toBe(true);
  });
});

describe('filterHistoryItems', () => {
  const items = [
    makeItem(),
    makeItem({
      id: 'item-2',
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
      operation: { ...makeItem().operation, variables: '{"id":"usr-b"}' },
    }),
  ];

  it('matches operation name', () => {
    expect(filterHistoryItems(items, 'GetUser')).toHaveLength(2);
  });

  it('matches response body text', () => {
    expect(filterHistoryItems(items, 'alice')).toHaveLength(1);
    expect(filterHistoryItems(items, 'Bob')).toHaveLength(1);
  });

  it('filters by variables JSON', () => {
    expect(filterHistoryItems(items, 'usr-b')).toHaveLength(1);
  });

  it('does not treat missing path as equal when one side has a value', () => {
    const a = makeItem();
    const b = makeItem({
      id: 'item-2',
      operation: { ...makeItem().operation, variables: '{}' },
      response: JSON.stringify({ data: {} }),
    });
    const result = compareHistoryItems(a, b);
    const idRow = result.variablesRows.find((r) => r.path === 'id');
    expect(idRow?.same).toBe(false);
    expect(idRow?.valueA).toBe('usr-a');
    expect(idRow?.valueB).toBe('—');
  });

  it('detects different query text', () => {
    const a = makeItem();
    const b = makeItem({
      id: 'item-2',
      operation: { ...makeItem().operation, query: 'query Other { health }' },
    });
    expect(compareHistoryItems(a, b).querySame).toBe(false);
  });

  it('flattens nested objects and arrays in response data', () => {
    const a = makeItem({
      response: JSON.stringify({ data: { user: { tags: ['a', 'b'], meta: { active: true } } } }),
    });
    const b = makeItem({
      id: 'item-2',
      response: JSON.stringify({ data: { user: { tags: ['a', 'c'], meta: { active: false } } } }),
    });
    const result = compareHistoryItems(a, b);
    expect(result.responseRows.find((r) => r.path === 'user.tags')?.same).toBe(false);
    expect(result.responseRows.find((r) => r.path === 'user.meta.active')?.same).toBe(false);
  });

  it('returns all items when search query is blank', () => {
    expect(filterHistoryItems(items, '   ')).toHaveLength(2);
  });

  it('stringifies null response values and anonymous operation names', () => {
    const a = makeItem({
      operation: { ...makeItem().operation, name: undefined },
      response: JSON.stringify({ data: { user: { name: null } } }),
    });
    const b = makeItem({
      id: 'item-2',
      operation: { ...makeItem().operation, name: undefined },
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
    });
    const result = compareHistoryItems(a, b);
    expect(result.nameA).toBe('Anonymous');
    expect(result.responseRows.find((r) => r.path === 'user.name')?.valueA).toBe('null');
  });
});

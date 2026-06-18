/**
 * queryBuilderGenerator.test.ts — unit tests for the SDL generator (2F-2)
 */

import { describe, it, expect } from 'vitest';
import {
  stripTypeModifiers,
  isLeafType,
  getRootTypeName,
  resolvePathFieldType,
  buildFieldTree,
  generateQuery,
  searchFields,
  getAncestorPaths,
} from './queryBuilderGenerator';
import type { GraphqlSchemaInfo, GraphqlTypeNode } from '../../../shared/types/graphql';

// ─── Test schema fixture ──────────────────────────────────────────────────────

const TYPES: GraphqlTypeNode[] = [
  {
    name: 'Query',
    kind: 'OBJECT',
    fields: [
      { name: 'user',     type: 'User',       args: [{ name: 'id', type: 'ID!', description: undefined }] },
      { name: 'users',    type: '[User!]!',    args: [] },
      { name: 'product',  type: 'Product',     args: [{ name: 'id', type: 'ID!', description: undefined }] },
    ],
  },
  {
    name: 'User',
    kind: 'OBJECT',
    fields: [
      { name: 'id',       type: 'ID!',         args: [] },
      { name: 'name',     type: 'String!',      args: [] },
      { name: 'email',    type: 'String!',      args: [] },
      { name: 'role',     type: 'UserRole',     args: [] },
      {
        name: 'orders',
        type: 'OrderConnection!',
        args: [
          { name: 'first',  type: 'Int',    description: undefined },
          { name: 'status', type: 'OrderStatus', description: undefined },
        ],
      },
    ],
  },
  {
    name: 'UserRole',
    kind: 'ENUM',
    enumValues: ['ADMIN', 'USER', 'GUEST'],
  },
  {
    name: 'OrderConnection',
    kind: 'OBJECT',
    fields: [
      { name: 'nodes',      type: '[Order!]!',  args: [] },
      { name: 'totalCount', type: 'Int!',        args: [] },
    ],
  },
  {
    name: 'Order',
    kind: 'OBJECT',
    fields: [
      { name: 'id',     type: 'ID!',   args: [] },
      { name: 'total',  type: 'Float!', args: [] },
    ],
  },
  {
    name: 'OrderStatus',
    kind: 'ENUM',
    enumValues: ['PLACED', 'SHIPPED', 'DELIVERED'],
  },
  {
    name: 'Product',
    kind: 'OBJECT',
    fields: [
      { name: 'id',    type: 'ID!',     args: [] },
      { name: 'title', type: 'String!', args: [] },
    ],
  },
];

const SCHEMA_INFO: GraphqlSchemaInfo = {
  sdl:           '',
  types:         TYPES,
  queryType:     'Query',
  mutationType:  'Mutation',
  fetchedAt:     0,
};

// ─── stripTypeModifiers ───────────────────────────────────────────────────────

describe('stripTypeModifiers', () => {
  it('strips ! modifier', () => {
    expect(stripTypeModifiers('String!')).toBe('String');
  });
  it('strips [, ] and ! from list types', () => {
    expect(stripTypeModifiers('[User!]!')).toBe('User');
    expect(stripTypeModifiers('[Order!]')).toBe('Order');
  });
  it('leaves plain type names unchanged', () => {
    expect(stripTypeModifiers('ID')).toBe('ID');
    expect(stripTypeModifiers('UserRole')).toBe('UserRole');
  });
  it('strips whitespace', () => {
    expect(stripTypeModifiers('String !  ')).toBe('String');
  });
});

// ─── isLeafType ───────────────────────────────────────────────────────────────

describe('isLeafType', () => {
  it('recognises built-in scalars', () => {
    for (const s of ['String', 'Int', 'Float', 'Boolean', 'ID']) {
      expect(isLeafType(s, TYPES)).toBe(true);
    }
  });
  it('recognises built-in scalars with modifiers', () => {
    expect(isLeafType('String!', TYPES)).toBe(true);
    expect(isLeafType('[Int!]!', TYPES)).toBe(true);
  });
  it('recognises custom ENUM types as leaf', () => {
    expect(isLeafType('UserRole', TYPES)).toBe(true);
    expect(isLeafType('OrderStatus!', TYPES)).toBe(true);
  });
  it('recognises OBJECT types as non-leaf', () => {
    expect(isLeafType('User', TYPES)).toBe(false);
    expect(isLeafType('OrderConnection!', TYPES)).toBe(false);
  });
  it('treats unknown types as non-leaf', () => {
    expect(isLeafType('UnknownType', TYPES)).toBe(false);
  });
});

// ─── getRootTypeName ─────────────────────────────────────────────────────────

describe('getRootTypeName', () => {
  it('returns queryType for query operations', () => {
    expect(getRootTypeName('query', SCHEMA_INFO)).toBe('Query');
  });
  it('returns mutationType for mutations', () => {
    expect(getRootTypeName('mutation', SCHEMA_INFO)).toBe('Mutation');
  });
  it('falls back to Subscription for subscription when not in schema', () => {
    expect(getRootTypeName('subscription', SCHEMA_INFO)).toBe('Subscription');
  });
  it('uses schema subscriptionType when present', () => {
    const s = { ...SCHEMA_INFO, subscriptionType: 'Subscription' };
    expect(getRootTypeName('subscription', s)).toBe('Subscription');
  });
  it('falls back to Query when queryType is undefined', () => {
    const s = { ...SCHEMA_INFO, queryType: undefined };
    expect(getRootTypeName('query', s)).toBe('Query');
  });
});

// ─── resolvePathFieldType ─────────────────────────────────────────────────────

describe('resolvePathFieldType', () => {
  it('resolves a single-segment path', () => {
    expect(resolvePathFieldType('user', 'Query', TYPES)).toBe('User');
  });
  it('resolves a multi-segment path', () => {
    expect(resolvePathFieldType('user.orders.nodes', 'Query', TYPES)).toBe('Order');
  });
  it('resolves to a leaf type', () => {
    expect(resolvePathFieldType('user.id', 'Query', TYPES)).toBe('ID');
    expect(resolvePathFieldType('user.name', 'Query', TYPES)).toBe('String');
  });
  it('returns null for unknown field', () => {
    expect(resolvePathFieldType('user.unknown', 'Query', TYPES)).toBeNull();
  });
  it('returns null for unknown root', () => {
    expect(resolvePathFieldType('ghost', 'UnknownRoot', TYPES)).toBeNull();
  });
});

// ─── buildFieldTree ───────────────────────────────────────────────────────────

describe('buildFieldTree', () => {
  it('builds a single-level tree', () => {
    const tree = buildFieldTree(['user']);
    expect(tree).toEqual({ user: true });
  });
  it('builds a two-level tree', () => {
    const tree = buildFieldTree(['user.id', 'user.name']);
    expect(tree).toEqual({ user: { id: true, name: true } });
  });
  it('builds a deep tree', () => {
    const tree = buildFieldTree(['user.orders.nodes.id']);
    expect(tree).toEqual({ user: { orders: { nodes: { id: true } } } });
  });
  it('merges multiple paths sharing a prefix', () => {
    const tree = buildFieldTree(['user.id', 'user.orders.nodes.id', 'user.name']);
    expect(tree).toEqual({
      user: {
        id:     true,
        name:   true,
        orders: { nodes: { id: true } },
      },
    });
  });
  it('handles empty input', () => {
    expect(buildFieldTree([])).toEqual({});
  });
});

// ─── generateQuery ────────────────────────────────────────────────────────────

describe('generateQuery', () => {
  const baseState = {
    operationType: 'query' as const,
    operationName: 'TestQuery',
    selectedFields: {},
    argValues:      {},
  };

  it('returns a placeholder when no fields selected', () => {
    const { sdl } = generateQuery(baseState, SCHEMA_INFO);
    expect(sdl).toContain('query TestQuery');
    expect(sdl).toContain('# Select fields');
  });

  it('generates a simple flat query', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true, 'user.name': true },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('query TestQuery');
    expect(sdl).toContain('user {');
    expect(sdl).toContain('id');
    expect(sdl).toContain('name');
  });

  it('generates nested selections', () => {
    const state = {
      ...baseState,
      selectedFields: {
        'user.id': true,
        'user.orders.nodes.id': true,
        'user.orders.totalCount': true,
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('orders {');
    expect(sdl).toContain('nodes {');
    expect(sdl).toContain('totalCount');
  });

  it('inlines string arg values with quotes', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      argValues:      { user: { id: 'abc123' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('user(id: "abc123")');
  });

  it('inlines numeric arg values without quotes', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.orders.nodes.id': true },
      argValues:      { 'user.orders': { first: '10' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('orders(first: 10)');
  });

  it('inlines enum arg values without quotes', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.orders.nodes.id': true },
      argValues:      { 'user.orders': { status: 'SHIPPED' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('orders(status: SHIPPED)');
  });

  it('promotes {{varName}} to $varName variable declaration', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      argValues:      { user: { id: '{{userId}}' } },
    };
    const { sdl, variableDeclarations } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('$userId: ID!');
    expect(sdl).toContain('user(id: $userId)');
    expect(variableDeclarations).toHaveLength(1);
    expect(variableDeclarations[0]).toEqual({ name: 'userId', type: 'ID!' });
  });

  it('promotes $varRef to $varRef variable declaration', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      argValues:      { user: { id: '$userId' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('user(id: $userId)');
  });

  it('skips empty arg values', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      argValues:      { user: { id: '' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('user {');
    expect(sdl).not.toContain('user(');
  });

  it('works with null schemaInfo (fallback to Query root)', () => {
    const state = { ...baseState, selectedFields: { 'user.id': true } };
    const { sdl } = generateQuery(state, null);
    expect(sdl).toContain('user');
  });

  it('returns empty variables object when no variable refs used', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
    };
    const { variables } = generateQuery(state, SCHEMA_INFO);
    expect(variables).toEqual({});
  });

  it('returns variable placeholders for promoted vars', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      argValues:      { user: { id: '{{myVar}}' } },
    };
    const { variables } = generateQuery(state, SCHEMA_INFO);
    expect(variables).toHaveProperty('myVar');
  });
});

// ─── searchFields ─────────────────────────────────────────────────────────────

describe('searchFields', () => {
  it('returns empty array for empty query', () => {
    expect(searchFields('', 'Query', TYPES)).toHaveLength(0);
  });
  it('finds a root-level field by name', () => {
    const results = searchFields('user', 'Query', TYPES);
    expect(results.some((r) => r.fieldName === 'user')).toBe(true);
  });
  it('finds a nested field', () => {
    const results = searchFields('email', 'Query', TYPES);
    expect(results.some((r) => r.fieldName === 'email')).toBe(true);
    expect(results[0].path).toContain('email');
  });
  it('is case-insensitive', () => {
    const lower = searchFields('email', 'Query', TYPES);
    const upper = searchFields('EMAIL', 'Query', TYPES);
    expect(lower.length).toBe(upper.length);
  });
  it('returns parentType info', () => {
    const results = searchFields('id', 'Query', TYPES);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.parentType).toBeTruthy();
    }
  });
  it('includes path info for nested fields', () => {
    const results = searchFields('total', 'Query', TYPES);
    const totalResult = results.find((r) => r.fieldName === 'totalCount');
    expect(totalResult?.path).toBeTruthy();
    expect(totalResult?.path.includes('.')).toBe(true);
  });
});

// ─── getAncestorPaths ─────────────────────────────────────────────────────────

describe('getAncestorPaths', () => {
  it('returns empty for single-segment path', () => {
    expect(getAncestorPaths('user')).toEqual([]);
  });
  it('returns one ancestor for two-segment path', () => {
    expect(getAncestorPaths('user.id')).toEqual(['user']);
  });
  it('returns all ancestor paths for deep path', () => {
    expect(getAncestorPaths('user.orders.nodes.id')).toEqual([
      'user',
      'user.orders',
      'user.orders.nodes',
    ]);
  });
});

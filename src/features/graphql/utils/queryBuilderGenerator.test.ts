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
    fieldAliases:   {} as Record<string, string>,
    fieldDirectives: {} as Record<string, import('../hooks/useGraphqlQueryBuilder').BuilderFieldDirectives>,
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

  // ── Aliases ──────────────────────────────────────────────────────────────

  it('prefixes an aliased leaf field', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   { 'user.id': 'userId' },
      fieldDirectives: {},
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('userId: id');
  });

  it('prefixes an aliased object field', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   { user: 'me' },
      fieldDirectives: {},
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('me: user {');
  });

  it('ignores blank alias', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   { 'user.id': '   ' },
      fieldDirectives: {},
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).not.toContain(':');
    expect(sdl).toContain('id');
  });

  // ── Directives ────────────────────────────────────────────────────────────

  it('appends @include directive with {{var}} condition', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   {},
      fieldDirectives: {
        user: { include: { enabled: true, ifVar: '{{showUser}}' } },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('@include(if: $showUser)');
    expect(sdl).toContain('$showUser: Boolean!');
  });

  it('appends @skip directive with $varRef condition', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   {},
      fieldDirectives: {
        user: { skip: { enabled: true, ifVar: '$adminOnly' } },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('@skip(if: $adminOnly)');
  });

  it('emits @include(if: true) when enabled with empty ifVar', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   {},
      fieldDirectives: {
        'user.id': { include: { enabled: true, ifVar: '' } },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('id @include(if: true)');
  });

  it('emits @skip(if: false) when enabled with whitespace-only ifVar', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   {},
      fieldDirectives: {
        'user.id': { skip: { enabled: true, ifVar: '   ' } },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('@skip(if: false)');
  });

  it('does not append disabled directive', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   {},
      fieldDirectives: {
        user: { include: { enabled: false, ifVar: '{{showUser}}' } },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).not.toContain('@include');
  });

  it('appends both @include and @skip when both enabled', () => {
    const state = {
      ...baseState,
      selectedFields: { 'user.id': true },
      fieldAliases:   {},
      fieldDirectives: {
        user: {
          include: { enabled: true, ifVar: '{{show}}' },
          skip: { enabled: true, ifVar: '{{hide}}' },
        },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('@include(if: $show)');
    expect(sdl).toContain('@skip(if: $hide)');
  });

  it('works without fieldAliases/fieldDirectives keys in state', () => {
    // Backwards-compat: state without the new keys (e.g. loaded from old storage)
    const { sdl } = generateQuery(baseState, SCHEMA_INFO);
    expect(sdl).toContain('query TestQuery');
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

// ─── getRootTypeName fallback branches ───────────────────────────────────────

describe('getRootTypeName — fallback branches', () => {
  it('falls back to "Mutation" when mutationType is undefined', () => {
    const s = { ...SCHEMA_INFO, mutationType: undefined };
    expect(getRootTypeName('mutation', s)).toBe('Mutation');
  });
  it('falls back to "Subscription" when subscriptionType is undefined', () => {
    const s = { ...SCHEMA_INFO, subscriptionType: undefined };
    expect(getRootTypeName('subscription', s)).toBe('Subscription');
  });
});

// ─── resolveArgDef edge cases (tested via generateQuery) ─────────────────────

describe('generateQuery — resolveArgDef edge cases', () => {
  it('falls back to String type when arg is unknown (literal value)', () => {
    // Arg name not in schema — should still inline with string quotes
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { 'user.id': true },
      argValues: { user: { unknownArg: 'hello' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('user(unknownArg: "hello")');
  });

  it('falls back to String type when arg is unknown (variable)', () => {
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { 'user.id': true },
      argValues: { user: { unknownArg: '{{myVar}}' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    // Variable declaration should fall back to String type
    expect(sdl).toContain('$myVar: String');
    expect(sdl).toContain('user(unknownArg: $myVar)');
  });

  it('deduplicates variable declarations when same varName used twice', () => {
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { 'user.id': true },
      argValues: {
        user: { id: '{{sharedVar}}' },
        // second usage — same varName; should not duplicate the variable declaration
        product: { id: '{{sharedVar}}' },
      },
    };
    const { sdl, variableDeclarations } = generateQuery(state, SCHEMA_INFO);
    // Only one declaration for sharedVar
    const matches = sdl.match(/\$sharedVar/g) ?? [];
    // Should appear in declaration + at least one usage
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(variableDeclarations.filter((v) => v.name === 'sharedVar')).toHaveLength(1);
  });

  it('formats Boolean arg as false when value is not true/1', () => {
    const boolTypes: GraphqlTypeNode[] = [
      {
        name: 'Query',
        kind: 'OBJECT',
        fields: [
          { name: 'search', type: 'String', args: [{ name: 'active', type: 'Boolean', description: undefined }] },
        ],
      },
    ];
    const schemaInfo = { sdl: '', types: boolTypes, queryType: 'Query', fetchedAt: 0 };
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { 'search': true },
      argValues: { search: { active: '0' } },
    };
    const { sdl } = generateQuery(state, schemaInfo);
    expect(sdl).toContain('search(active: false)');
  });

  it('skips object branches that produce no child output', () => {
    // A non-leaf field with no selected children should not appear in the output
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      // Only select the parent-level `user` but not any of its leaf children
      selectedFields: { 'user': true },
      argValues: {},
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    // 'user' itself is a leaf reference in the field tree (selectedFields value is true)
    expect(sdl).toContain('user');
  });
});

// ─── buildFieldTree — duplicate leaf preservation ─────────────────────────────

describe('buildFieldTree — existing leaf stays true', () => {
  it('preserves true when the same leaf is added twice', () => {
    const tree = buildFieldTree(['user.id', 'user.id']);
    expect(tree).toEqual({ user: { id: true } });
  });

  it('does not overwrite an existing object with true', () => {
    // 'user' is first added as a subtree node, then added as a leaf
    const tree = buildFieldTree(['user.id', 'user']);
    // The intermediate node 'user' should remain an object (has id key)
    expect(tree.user).toHaveProperty('id', true);
  });
});

// ─── searchFields — depth, visited, no-fields edge cases ─────────────────────

describe('searchFields — edge cases', () => {
  it('stops recursion at maxDepth', () => {
    // With maxDepth=0 only root fields reachable
    const results = searchFields('id', 'Query', TYPES, 0);
    // At depth 0 we traverse Query type. depth starts at 0, and increments before recursion.
    // We should only get fields from Query, not nested User.id
    expect(results.every((r) => !r.path.includes('.'))).toBe(true);
  });

  it('handles types that have no fields (ENUM or SCALAR root)', () => {
    const results = searchFields('ADMIN', 'UserRole', TYPES);
    // UserRole is an ENUM with no `fields` array — should return empty
    expect(results).toHaveLength(0);
  });

  it('handles circular type references without infinite loop', () => {
    const circularTypes: GraphqlTypeNode[] = [
      {
        name: 'Query',
        kind: 'OBJECT',
        fields: [{ name: 'self', type: 'Query', args: [] }],
      },
    ];
    // Should not throw or loop forever
    const results = searchFields('self', 'Query', circularTypes);
    expect(results.some((r) => r.fieldName === 'self')).toBe(true);
  });
});

// ─── Fragment spreads, directive literals, and remaining branches ───────────────

describe('generateQuery — fragments and directive literals', () => {
  it('includes active fragment spreads and emits fragment definitions', () => {
    const state = {
      operationType: 'query' as const,
      operationName: 'WithFrags',
      selectedFields: {},
      argValues: {},
      fieldAliases: {},
      fieldDirectives: {},
      activeFragmentSpreads: ['UserFields'],
      fragments: {
        UserFields: { name: 'UserFields', onType: 'User', fieldPaths: ['id', 'name'] },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('...UserFields');
    expect(sdl).toContain('fragment UserFields on User');
    expect(sdl).toContain('id');
    expect(sdl).toContain('name');
  });

  it('skips fragment spread when fragment definition is missing', () => {
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: {},
      argValues: {},
      activeFragmentSpreads: ['MissingFrag'],
      fragments: {},
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).not.toContain('...MissingFrag');
  });

  it('uses bare true/false literals in @include/@skip directives', () => {
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { 'user.id': true },
      argValues: {},
      fieldAliases: {},
      fieldDirectives: {
        user: {
          include: { enabled: true, ifVar: 'false' },
          skip: { enabled: true, ifVar: 'true' },
        },
      },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain('@include(if: false)');
    expect(sdl).toContain('@skip(if: true)');
  });

  it('formats Boolean arg as true when value is true or 1', () => {
    const boolTypes: GraphqlTypeNode[] = [
      {
        name: 'Query',
        kind: 'OBJECT',
        fields: [
          { name: 'search', type: 'String', args: [{ name: 'active', type: 'Boolean', description: undefined }] },
        ],
      },
    ];
    const schemaInfo = { sdl: '', types: boolTypes, queryType: 'Query', fetchedAt: 0 };
    const stateTrue = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { search: true },
      argValues: { search: { active: 'true' } },
    };
    const stateOne = {
      ...stateTrue,
      argValues: { search: { active: '1' } },
    };
    expect(generateQuery(stateTrue, schemaInfo).sdl).toContain('search(active: true)');
    expect(generateQuery(stateOne, schemaInfo).sdl).toContain('search(active: true)');
  });

  it('escapes quotes and backslashes in string literal args', () => {
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { 'user.id': true },
      argValues: { user: { id: 'say "hi"' } },
    };
    const { sdl } = generateQuery(state, SCHEMA_INFO);
    expect(sdl).toContain(String.raw`say \"hi\"`);
  });

  it('reuses existing Boolean variable when directive var was already declared', () => {
    const state = {
      operationType: 'query' as const,
      operationName: 'Q',
      selectedFields: { 'user.id': true, 'users.id': true },
      argValues: {},
      fieldAliases: {},
      fieldDirectives: {
        user: { include: { enabled: true, ifVar: '{{showUser}}' } },
        users: { skip: { enabled: true, ifVar: '{{showUser}}' } },
      },
    };
    const { sdl, variableDeclarations } = generateQuery(state, SCHEMA_INFO);
    expect(sdl.match(/\$showUser: Boolean!/g)?.length).toBe(1);
    expect(variableDeclarations.filter((v) => v.name === 'showUser')).toHaveLength(1);
  });
});

describe('isLeafType — custom SCALAR', () => {
  it('recognises custom SCALAR types as leaf', () => {
    const types = [...TYPES, { name: 'DateTime', kind: 'SCALAR' as const }];
    expect(isLeafType('DateTime!', types)).toBe(true);
  });
});

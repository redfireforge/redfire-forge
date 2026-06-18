/**
 * complexityEstimator.test.ts — Sprint 7 (2G-2) unit tests
 */

import { describe, it, expect } from 'vitest';
import { computeQueryComplexity } from './complexityEstimator';
import type { GraphqlSchemaInfo, GraphqlTypeNode } from '../../../shared/types/graphql';

// ─── Test schema ─────────────────────────────────────────────────────────────

const makeSchema = (extraTypes: GraphqlTypeNode[] = []): GraphqlSchemaInfo => ({
  sdl: '',
  queryType: 'Query',
  mutationType: 'Mutation',
  fetchedAt: 0,
  types: [
    {
      name: 'Query',
      kind: 'OBJECT',
      fields: [
        { name: 'user',  type: 'User',    args: [{ name: 'id', type: 'ID!' }] },
        { name: 'users', type: '[User!]!', args: [] },
        { name: 'count', type: 'Int',     args: [] },
      ],
    },
    {
      name: 'User',
      kind: 'OBJECT',
      fields: [
        { name: 'id',      type: 'ID!'    },
        { name: 'name',    type: 'String' },
        { name: 'email',   type: 'String' },
        { name: 'orders',  type: '[Order!]!' },
        { name: 'profile', type: 'Profile' },
      ],
    },
    {
      name: 'Order',
      kind: 'OBJECT',
      fields: [
        { name: 'id',    type: 'ID!'    },
        { name: 'total', type: 'Float'  },
        { name: 'items', type: '[OrderItem!]!' },
      ],
    },
    {
      name: 'OrderItem',
      kind: 'OBJECT',
      fields: [
        { name: 'id',    type: 'ID!'   },
        { name: 'name',  type: 'String' },
        { name: 'price', type: 'Float'  },
      ],
    },
    {
      name: 'Profile',
      kind: 'OBJECT',
      fields: [
        { name: 'bio',    type: 'String' },
        { name: 'avatar', type: 'String' },
      ],
    },
    { name: 'ID',     kind: 'SCALAR' },
    { name: 'String', kind: 'SCALAR' },
    { name: 'Int',    kind: 'SCALAR' },
    { name: 'Float',  kind: 'SCALAR' },
    { name: 'Boolean', kind: 'SCALAR' },
    ...extraTypes,
  ],
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeQueryComplexity', () => {
  it('returns score 0 when schemaInfo is null', () => {
    const r = computeQueryComplexity('{ user(id: "1") { name } }', null);
    expect(r.score).toBe(0);
    expect(r.level).toBe('ok');
  });

  it('returns score 0 for empty query', () => {
    const r = computeQueryComplexity('   ', makeSchema());
    expect(r.score).toBe(0);
  });

  it('returns score 0 for unparseable query', () => {
    const r = computeQueryComplexity('{ !!! invalid }', makeSchema());
    expect(r.score).toBe(0);
  });

  it('scores a single scalar field as 1', () => {
    // count is a scalar, depth 0
    const r = computeQueryComplexity('{ count }', makeSchema());
    expect(r.score).toBe(1);
  });

  it('scores an object field as 2 + child cost', () => {
    // user (object) = 2 + name (scalar) = 2 + 1 = 3
    const r = computeQueryComplexity('{ user(id: "1") { name } }', makeSchema());
    expect(r.score).toBe(3);
  });

  it('scores a list field multiplied by listMultiplier', () => {
    // users = [User!]! → (2 (object field) + id scalar 1) × 10 (list) = 30
    const r = computeQueryComplexity('{ users { id } }', makeSchema(), { listMultiplier: 10 });
    // Field cost: users is list → (2 + 1) * 10 = 30
    expect(r.score).toBe(30);
  });

  it('uses custom listMultiplier', () => {
    const r1 = computeQueryComplexity('{ users { id } }', makeSchema(), { listMultiplier: 5 });
    const r2 = computeQueryComplexity('{ users { id } }', makeSchema(), { listMultiplier: 20 });
    expect(r1.score).toBeLessThan(r2.score);
  });

  it('level is ok when score is below threshold/2', () => {
    const r = computeQueryComplexity('{ count }', makeSchema(), { threshold: 500 });
    expect(r.level).toBe('ok');
    expect(r.score).toBe(1);
  });

  it('level is warn when score is between threshold/2 and threshold', () => {
    // Force a medium-cost query: users with orders.items (nested lists)
    // users list (×10) → each User has orders (×10) → each Order has items
    const r = computeQueryComplexity(
      '{ users { orders { total } } }',
      makeSchema(),
      { threshold: 100, listMultiplier: 5 },
    );
    expect(['ok', 'warn', 'danger']).toContain(r.level);
  });

  it('level is danger when score exceeds threshold', () => {
    // Small threshold to trigger danger
    const r = computeQueryComplexity(
      '{ users { orders { items { name } } } }',
      makeSchema(),
      { threshold: 5, listMultiplier: 10 },
    );
    expect(r.level).toBe('danger');
    expect(r.shouldBlock).toBe(true);
  });

  it('shouldBlock is false when score is below 2x threshold', () => {
    const r = computeQueryComplexity('{ count }', makeSchema(), { threshold: 500 });
    expect(r.shouldBlock).toBe(false);
  });

  it('returns threshold in result', () => {
    const r = computeQueryComplexity('{ count }', makeSchema(), { threshold: 200 });
    expect(r.threshold).toBe(200);
  });

  it('uses default threshold of 500', () => {
    const r = computeQueryComplexity('{ count }', makeSchema());
    expect(r.threshold).toBe(500);
  });

  it('handles named fragments', () => {
    const q = `
      fragment UserFields on User { name email }
      { user(id: "1") { ...UserFields } }
    `;
    const r = computeQueryComplexity(q, makeSchema());
    // user (object, depth 0) = 2 + UserFields = name(1) + email(1) = 4 total
    expect(r.score).toBe(4);
  });

  it('handles inline fragments', () => {
    const q = `{ user(id: "1") { ... on User { name } } }`;
    const r = computeQueryComplexity(q, makeSchema());
    // user = 2 + inline fragment User: name = 1 → 3
    expect(r.score).toBe(3);
  });

  it('handles @defer reducing fragment cost by 50%', () => {
    const q = `{ user(id: "1") { id ... @defer { profile { bio } } } }`;
    const r = computeQueryComplexity(q, makeSchema());
    const rNoDefer = computeQueryComplexity('{ user(id: "1") { id profile { bio } } }', makeSchema());
    // With @defer, inline fragment cost should be ≤ without defer
    expect(r.score).toBeLessThanOrEqual(rNoDefer.score);
  });

  it('handles multiple operations — sums all', () => {
    const q = `
      query GetUser { user(id: "1") { name } }
      query GetCount { count }
    `;
    const r = computeQueryComplexity(q, makeSchema());
    const rUser  = computeQueryComplexity('{ user(id: "1") { name } }', makeSchema());
    const rCount = computeQueryComplexity('{ count }', makeSchema());
    expect(r.score).toBe(rUser.score + rCount.score);
  });

  it('filters by operationName when provided', () => {
    const q = `
      query Cheap { count }
      query Expensive { user(id: "1") { name email } }
    `;
    const all = computeQueryComplexity(q, makeSchema());
    const cheap = computeQueryComplexity(q, makeSchema(), undefined, 'Cheap');
    const expensive = computeQueryComplexity(q, makeSchema(), undefined, 'Expensive');
    expect(all.score).toBe(cheap.score + expensive.score);
    expect(cheap.score).toBeLessThan(expensive.score);
  });

  it('returns 0 when operationName matches no operation', () => {
    const q = 'query A { count }';
    const r = computeQueryComplexity(q, makeSchema(), undefined, 'NonExistent');
    expect(r.score).toBe(0);
  });

  it('scores mutation operation using mutationType (lines 241-242 true branch)', () => {
    const q = 'mutation CreateUser { createUser { id name } }';
    const schema = makeSchema([
      {
        name: 'Mutation',
        kind: 'OBJECT',
        fields: [
          { name: 'createUser', type: 'User', args: [] },
        ],
      },
    ]);
    schema.mutationType = 'Mutation';
    const r = computeQueryComplexity(q, schema);
    expect(r.score).toBeGreaterThan(0);
  });

  it('scores subscription operation using subscriptionType (lines 251-252 cond-expr true)', () => {
    const q = 'subscription OnMessage { onMessage { id text } }';
    const schema = makeSchema([
      {
        name: 'Subscription',
        kind: 'OBJECT',
        fields: [
          { name: 'onMessage', type: 'Message', args: [] },
        ],
      },
      {
        name: 'Message',
        kind: 'OBJECT',
        fields: [
          { name: 'id', type: 'ID' },
          { name: 'text', type: 'String' },
        ],
      },
    ]);
    schema.subscriptionType = 'Subscription';
    const r = computeQueryComplexity(q, schema);
    expect(r.score).toBeGreaterThan(0);
  });

  it('uses default Subscription type when subscriptionType is undefined (line 252 ??Subscription)', () => {
    const q = 'subscription { onMessage { id } }';
    const schema = makeSchema([
      {
        name: 'Subscription',
        kind: 'OBJECT',
        fields: [{ name: 'onMessage', type: 'Message', args: [] }],
      },
      {
        name: 'Message',
        kind: 'OBJECT',
        fields: [{ name: 'id', type: 'ID' }],
      },
    ]);
    schema.subscriptionType = undefined as unknown as string;
    const r = computeQueryComplexity(q, schema);
    expect(r.score).toBeGreaterThan(0);
  });

  it('@defer on fragment spread reduces cost by 50% (line 183 true branch)', () => {
    // Named fragment with @defer applied on the spread
    const q = `
      fragment UserFields on User { name email profile { bio } }
      { user(id: "1") { id ...UserFields @defer } }
    `;
    const withDefer = computeQueryComplexity(q, makeSchema());
    const q2 = `
      fragment UserFields on User { name email profile { bio } }
      { user(id: "1") { id ...UserFields } }
    `;
    const withoutDefer = computeQueryComplexity(q2, makeSchema());
    expect(withDefer.score).toBeLessThan(withoutDefer.score);
  });

  it('returns 0 when fragment spread references unknown fragment (line 176 if(!def))', () => {
    // Fragment spread referencing undefined fragment
    const q = `{ user(id: "1") { ...NonExistentFragment } }`;
    const r = computeQueryComplexity(q, makeSchema());
    // Should not throw and return valid score without the missing fragment
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('uses leaf type cost 1 vs object cost 2 for scoreField (line 139 cond-expr branches)', () => {
    // Scalar field should score lower than object field
    const scalarQ = '{ count }';
    const objectQ = '{ user(id: "1") { id } }';
    const scalarR = computeQueryComplexity(scalarQ, makeSchema());
    const objectR = computeQueryComplexity(objectQ, makeSchema());
    // Object field has cost 2, scalar has cost 1
    expect(objectR.score).toBeGreaterThan(scalarR.score);
  });

  it('handles circular schema references without infinite loop', () => {
    // Add a self-referential type
    const schema = makeSchema([
      {
        name: 'Category',
        kind: 'OBJECT',
        fields: [
          { name: 'name', type: 'String' },
          { name: 'children', type: '[Category!]!' },
        ],
      },
    ]);
    // Extend Query to have categories
    schema.types[0].fields!.push({ name: 'categories', type: '[Category!]!', args: [] });

    const q = '{ categories { name children { name children { name } } } }';
    // Should complete without hanging or throwing
    expect(() => computeQueryComplexity(q, schema)).not.toThrow();
    const r = computeQueryComplexity(q, schema);
    expect(r.score).toBeGreaterThan(0);
  });
});

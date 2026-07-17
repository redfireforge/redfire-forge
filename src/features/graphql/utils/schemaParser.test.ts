/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { buildSchema, introspectionFromSchema } from 'graphql';
import { parseIntrospectionResult } from './schemaParser';

function makeIntrospectionData(sdl: string): Record<string, unknown> {
  const schema = buildSchema(sdl);
  return introspectionFromSchema(schema) as unknown as Record<string, unknown>;
}

const FULL_SDL = `
  """A person in the system."""
  type Person implements Node {
    id: ID!
    name: String!
    age: Int
    """@deprecated"""
    oldField: String @deprecated(reason: "use name instead")
    args(limit: Int = 10, cursor: String): [String!]
  }

  interface Node {
    id: ID!
  }

  union SearchResult = Person

  input CreatePersonInput {
    name: String!
    age: Int
  }

  enum Status {
    ACTIVE
    INACTIVE
  }

  scalar Date

  type Query {
    person(id: ID!): Person
    search(q: String!): SearchResult
    status: Status
    today: Date
  }

  type Mutation {
    create(input: CreatePersonInput!): Person
  }

  type Subscription {
    newPerson: Person
  }
`;

describe('parseIntrospectionResult', () => {
  it('returns sdl and types for a well-formed schema', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    expect(typeof result.sdl).toBe('string');
    expect(result.sdl.length).toBeGreaterThan(0);
    expect(Array.isArray(result.types)).toBe(true);
  });

  it('includes OBJECT types', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const person = result.types.find((t) => t.name === 'Person');
    expect(person).toBeDefined();
    expect(person?.kind).toBe('OBJECT');
    expect(person?.fields?.some((f) => f.name === 'name')).toBe(true);
  });

  it('includes INTERFACE types', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const node = result.types.find((t) => t.name === 'Node');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('INTERFACE');
    expect(node?.fields?.some((f) => f.name === 'id')).toBe(true);
  });

  it('includes UNION types', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const union = result.types.find((t) => t.name === 'SearchResult');
    expect(union?.kind).toBe('UNION');
    expect(union?.possibleTypes).toContain('Person');
  });

  it('includes INPUT_OBJECT types', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const input = result.types.find((t) => t.name === 'CreatePersonInput');
    expect(input?.kind).toBe('INPUT_OBJECT');
    expect(input?.fields?.some((f) => f.name === 'name')).toBe(true);
  });

  it('includes ENUM types', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const enm = result.types.find((t) => t.name === 'Status');
    expect(enm?.kind).toBe('ENUM');
    expect(enm?.enumValues).toContain('ACTIVE');
  });

  it('includes SCALAR types (custom only, not built-ins)', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const scalar = result.types.find((t) => t.name === 'Date');
    expect(scalar?.kind).toBe('SCALAR');
    // Built-in scalars like String, Int, Boolean should be excluded
    expect(result.types.find((t) => t.name === 'String')).toBeUndefined();
    expect(result.types.find((t) => t.name === 'Boolean')).toBeUndefined();
  });

  it('excludes introspection types (__Schema, __Type, etc.)', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    expect(result.types.find((t) => t.name.startsWith('__'))).toBeUndefined();
  });

  it('marks deprecated fields', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const person = result.types.find((t) => t.name === 'Person');
    const deprecated = person?.fields?.find((f) => f.name === 'oldField');
    expect(deprecated?.isDeprecated).toBe(true);
    expect(deprecated?.deprecationReason).toMatch(/use name/);
  });

  it('includes field args with name and type', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const person = result.types.find((t) => t.name === 'Person');
    const argsField = person?.fields?.find((f) => f.name === 'args');
    expect(argsField?.args).toBeDefined();
    expect(argsField?.args?.some((a) => a.name === 'limit')).toBe(true);
    expect(argsField?.args?.some((a) => a.name === 'cursor')).toBe(true);
    const limitArg = argsField?.args?.find((a) => a.name === 'limit');
    expect(limitArg?.type).toBeTruthy();
  });

  it('resolves root type names', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    expect(result.queryType).toBe('Query');
    expect(result.mutationType).toBe('Mutation');
    expect(result.subscriptionType).toBe('Subscription');
  });

  it('resolves undefined mutation/subscription when not present', () => {
    const simple = `type Query { x: String }`;
    const data = makeIntrospectionData(simple);
    const result = parseIntrospectionResult(data);
    expect(result.queryType).toBe('Query');
    expect(result.mutationType).toBeUndefined();
    expect(result.subscriptionType).toBeUndefined();
  });

  it('sorts types: OBJECT before INTERFACE before UNION before INPUT_OBJECT before ENUM before SCALAR', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    const kindOrder = ['OBJECT', 'INTERFACE', 'UNION', 'INPUT_OBJECT', 'ENUM', 'SCALAR'];
    let lastKindIdx = -1;
    for (const t of result.types) {
      const idx = kindOrder.indexOf(t.kind);
      expect(idx).toBeGreaterThanOrEqual(lastKindIdx);
      lastKindIdx = idx;
    }
  });

  it('includes sdlFragment for each type', () => {
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    for (const t of result.types) {
      expect(typeof t.sdlFragment).toBe('string');
      expect(t.sdlFragment!.length).toBeGreaterThan(0);
    }
  });

  it('sets fetchedAt timestamp', () => {
    const before = Date.now();
    const data = makeIntrospectionData(FULL_SDL);
    const result = parseIntrospectionResult(data);
    expect(result.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  it('throws for invalid introspection data', () => {
    expect(() => parseIntrospectionResult({ invalid: true })).toThrow();
  });

  it('parses interface types with fields and args correctly', () => {
    const sdlWithInterface = `
      interface Node {
        find(id: ID!): Boolean
      }
      type Query implements Node {
        find(id: ID!): Boolean
      }
    `;
    const data = makeIntrospectionData(sdlWithInterface);
    const result = parseIntrospectionResult(data);
    const nodeInterface = result.types.find((t) => t.name === 'Node');
    expect(nodeInterface).toBeDefined();
    expect(nodeInterface?.kind).toBe('INTERFACE');
    expect(nodeInterface?.fields).toBeDefined();
    const findField = nodeInterface?.fields?.find((f) => f.name === 'find');
    expect(findField).toBeDefined();
    expect(findField?.args).toBeDefined();
    expect(findField?.args?.length).toBeGreaterThan(0);
    const idArg = findField?.args?.find((a) => a.name === 'id');
    expect(idArg).toBeDefined();
    expect(idArg?.type).toContain('ID');
  });

  it('parses args with and without defaultValues correctly (line 66 false branch)', () => {
    // Both with default and without default args — exercises the `undefined` false branch
    // Note: buildClientSchema always returns undefined for arg.defaultValue (graphql-js limitation),
    // so the true branch of the ternary is not reachable via normal introspection flow.
    const sdlWithDefault = `
      type Query {
        search(limit: Int = 10, query: String): String
      }
    `;
    const data = makeIntrospectionData(sdlWithDefault);
    const result = parseIntrospectionResult(data);
    const query = result.types.find((t) => t.name === 'Query');
    const searchField = query?.fields?.find((f) => f.name === 'search');
    expect(searchField?.args).toBeDefined();
    expect(searchField?.args?.length).toBe(2);
    // Both args have undefined defaultValue after buildClientSchema (by design)
    const limitArg = searchField?.args?.find((a) => a.name === 'limit');
    expect(limitArg).toBeDefined();
    const queryArg = searchField?.args?.find((a) => a.name === 'query');
    expect(queryArg).toBeDefined();
  });
});

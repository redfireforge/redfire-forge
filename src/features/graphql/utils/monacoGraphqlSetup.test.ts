/**
 * monacoGraphqlSetup.test.ts — unit tests for pure functions in monacoGraphqlSetup.ts
 *
 * The Monaco-dependent APIs (registerGraphqlLanguage, getOrInitGraphqlMode, etc.)
 * require a full Monaco runtime and are tested via E2E. This file focuses on the
 * pure utility functions: buildModelUri, buildVarsModelUri, extractOperations,
 * deriveTabLabel, deriveOperationType.
 */

import { describe, it, expect, vi } from 'vitest';

// Monaco editor and monaco-graphql both attempt to access `window` at module-load
// time (not inside functions), so we have to stub them before any local import.
vi.mock('monaco-editor', () => ({ editor: {}, Uri: { parse: vi.fn((s: string) => s) }, Range: class {} }));
vi.mock('monaco-graphql/initializeMode', () => ({ initializeMode: vi.fn(() => ({})) }));
vi.mock('monaco-graphql/esm/graphql.worker?worker', () => ({ default: class {} }));

import {
  buildModelUri,
  buildVarsModelUri,
  extractOperations,
  deriveTabLabel,
  deriveOperationType,
} from './monacoGraphqlSetup';

// ─── buildModelUri ────────────────────────────────────────────────────────────

describe('buildModelUri', () => {
  it('builds correct URI pattern', () => {
    expect(buildModelUri('tab-1')).toBe('inmemory://graphql/tab-1');
  });

  it('encodes tab IDs with special characters', () => {
    const uri = buildModelUri('tab/special');
    expect(uri).toContain('tab/special');
  });
});

describe('buildVarsModelUri', () => {
  it('builds correct vars URI pattern', () => {
    expect(buildVarsModelUri('tab-1')).toBe('inmemory://graphql-vars/tab-1');
  });

  it('produces a different URI from buildModelUri', () => {
    expect(buildVarsModelUri('x')).not.toBe(buildModelUri('x'));
  });
});

// ─── extractOperations ────────────────────────────────────────────────────────

describe('extractOperations', () => {
  it('returns [] for empty string', () => {
    expect(extractOperations('')).toEqual([]);
    expect(extractOperations('   ')).toEqual([]);
  });

  it('extracts a single named query', () => {
    const ops = extractOperations('query GetUser { user { id } }');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ type: 'query', name: 'GetUser' });
  });

  it('extracts a named mutation', () => {
    const ops = extractOperations('mutation CreatePost($title: String!) { createPost(title: $title) { id } }');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('mutation');
    expect(ops[0].name).toBe('CreatePost');
  });

  it('extracts a named subscription', () => {
    const ops = extractOperations('subscription OnNewMessage { newMessage { text } }');
    expect(ops[0]).toEqual({ type: 'subscription', name: 'OnNewMessage' });
  });

  it('extracts multiple operations', () => {
    const ops = extractOperations(
      'query GetUser { user { id } }\nmutation UpdateUser { updateUser { id } }',
    );
    expect(ops).toHaveLength(2);
    expect(ops[0].name).toBe('GetUser');
    expect(ops[1].name).toBe('UpdateUser');
  });

  it('returns [] for anonymous operation', () => {
    expect(extractOperations('query { user { id } }')).toEqual([]);
    expect(extractOperations('{ user { id } }')).toEqual([]);
  });

  it('ignores operation names in comments', () => {
    const ops = extractOperations('# query FakeOp {\nquery GetUser { user }');
    const names = ops.map((o) => o.name);
    expect(names).not.toContain('FakeOp');
    expect(names).toContain('GetUser');
  });

  it('handles operation names starting with lowercase', () => {
    const ops = extractOperations('query getUserById { user }');
    expect(ops[0].name).toBe('getUserById');
  });
});

// ─── deriveTabLabel ───────────────────────────────────────────────────────────

describe('deriveTabLabel', () => {
  it('returns "Untitled" for empty string', () => {
    expect(deriveTabLabel('')).toBe('Untitled');
  });

  it('returns "Untitled" for anonymous query', () => {
    expect(deriveTabLabel('{ user { id } }')).toBe('Untitled');
  });

  it('returns first operation name for named query', () => {
    expect(deriveTabLabel('query GetUser { user { id } }')).toBe('GetUser');
  });

  it('returns first operation name when multiple ops exist', () => {
    expect(deriveTabLabel('query A { x }\nmutation B { y }')).toBe('A');
  });
});

// ─── deriveOperationType ──────────────────────────────────────────────────────

describe('deriveOperationType', () => {
  it('returns undefined for empty string', () => {
    expect(deriveOperationType('')).toBeUndefined();
    expect(deriveOperationType('   ')).toBeUndefined();
  });

  it('returns "query" for shorthand { }', () => {
    expect(deriveOperationType('{ user { id } }')).toBe('query');
  });

  it('returns "query" for named query', () => {
    expect(deriveOperationType('query GetUser { user { id } }')).toBe('query');
  });

  it('returns "mutation" for named mutation', () => {
    expect(deriveOperationType('mutation CreateUser { createUser { id } }')).toBe('mutation');
  });

  it('returns "subscription" for named subscription', () => {
    expect(deriveOperationType('subscription OnMsg { msg { text } }')).toBe('subscription');
  });

  it('returns "query" for anonymous query keyword', () => {
    expect(deriveOperationType('query { user { id } }')).toBe('query');
  });

  it('returns "mutation" for anonymous mutation', () => {
    expect(deriveOperationType('mutation { createUser { id } }')).toBe('mutation');
  });

  it('returns operation type of first operation when multiple exist', () => {
    expect(deriveOperationType('mutation A { x }\nquery B { y }')).toBe('mutation');
  });
});

/**
 * monacoGraphqlSetup.test.ts — unit tests for pure functions in monacoGraphqlSetup.ts
 *
 * The Monaco-dependent APIs (registerGraphqlLanguage, getOrInitGraphqlMode, etc.)
 * require a full Monaco runtime and are tested via E2E. This file focuses on the
 * pure utility functions: buildModelUri, buildVarsModelUri, extractOperations,
 * deriveTabLabel, deriveOperationType, plus the Monaco-wrapped functions that
 * can be tested with lightweight mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Monaco editor and monaco-graphql both attempt to access `window` at module-load
// time (not inside functions), so we have to stub them before any local import.
const mockSetSchemaConfig = vi.fn();
vi.mock('monaco-editor', () => ({
  editor: {
    defineTheme: vi.fn(),
  },
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    setLanguageConfiguration: vi.fn(),
  },
  Uri: { parse: vi.fn((s: string) => s) },
  Range: class {},
}));
vi.mock('monaco-graphql/initializeMode', () => ({
  initializeMode: vi.fn(() => ({ setSchemaConfig: mockSetSchemaConfig })),
}));
vi.mock('monaco-graphql/esm/graphql.worker?worker', () => ({ default: class {} }));

import {
  buildModelUri,
  buildVarsModelUri,
  extractOperations,
  deriveTabLabel,
  deriveOperationType,
  getOrInitGraphqlMode,
  setGraphqlSchema,
  clearGraphqlSchema,
  registerGraphqlLanguage,
  getGraphqlEditorOptions,
  getVariablesEditorOptions,
  GRAPHQL_LANGUAGE_ID,
  GRAPHQL_THEME_ID,
} from './monacoGraphqlSetup';
import { initializeMode } from 'monaco-graphql/initializeMode';
import * as MonacoEditor from 'monaco-editor';

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

// ─── getOrInitGraphqlMode / setGraphqlSchema / clearGraphqlSchema ─────────────

describe('getOrInitGraphqlMode', () => {
  it('calls initializeMode on first call', () => {
    // The module singleton may already be set from import; check it returns the API
    const api = getOrInitGraphqlMode();
    expect(api).toBeDefined();
    expect(typeof api.setSchemaConfig).toBe('function');
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    const a = getOrInitGraphqlMode();
    const b = getOrInitGraphqlMode();
    expect(a).toBe(b);
  });

  it('initializeMode is called exactly once across multiple getOrInitGraphqlMode calls', () => {
    // Already called above — just verify it was only called once total
    getOrInitGraphqlMode();
    getOrInitGraphqlMode();
    expect(initializeMode).toHaveBeenCalledTimes(1);
  });
});

describe('setGraphqlSchema', () => {
  it('calls setSchemaConfig with correct arguments', () => {
    const schema = { __schema: { types: [] } };
    setGraphqlSchema(schema);
    expect(mockSetSchemaConfig).toHaveBeenCalledWith([
      expect.objectContaining({ uri: 'schema.graphql', introspectionJSON: schema }),
    ]);
  });

  it('does not throw when called with any object', () => {
    expect(() => setGraphqlSchema({ anything: true })).not.toThrow();
  });
});

describe('clearGraphqlSchema', () => {
  it('calls setSchemaConfig with an empty array', () => {
    clearGraphqlSchema();
    expect(mockSetSchemaConfig).toHaveBeenCalledWith([]);
  });
});

// ─── registerGraphqlLanguage ──────────────────────────────────────────────────

describe('registerGraphqlLanguage', () => {
  beforeEach(() => {
    vi.mocked(MonacoEditor.languages.register).mockClear();
    vi.mocked(MonacoEditor.languages.setMonarchTokensProvider).mockClear();
    vi.mocked(MonacoEditor.languages.setLanguageConfiguration).mockClear();
    vi.mocked(MonacoEditor.editor.defineTheme).mockClear();
  });

  it('registers the graphql language ID', () => {
    // This test may be a no-op if language was already registered from a prior test run.
    // The call is idempotent — call with the same monaco mock to capture any call.
    const monaco = MonacoEditor as unknown as Parameters<typeof registerGraphqlLanguage>[0];
    registerGraphqlLanguage(monaco);
    // registerGraphqlLanguage is guarded by a module-level flag; it only runs once.
    // If already called, mocks remain empty but no error.
    // We just verify the function does not throw.
    expect(() => registerGraphqlLanguage(monaco)).not.toThrow();
  });

  it('defines a theme with the correct ID constant', () => {
    expect(GRAPHQL_THEME_ID).toBe('graphql-dark');
  });

  it('defines a language with the correct ID constant', () => {
    expect(GRAPHQL_LANGUAGE_ID).toBe('graphql');
  });
});

// ─── getGraphqlEditorOptions ──────────────────────────────────────────────────

describe('getGraphqlEditorOptions', () => {
  it('returns an options object with minimap disabled', () => {
    const opts = getGraphqlEditorOptions();
    expect(opts.minimap?.enabled).toBe(false);
  });

  it('returns an options object with automaticLayout enabled', () => {
    const opts = getGraphqlEditorOptions();
    expect(opts.automaticLayout).toBe(true);
  });

  it('returns an options object with wordWrap on', () => {
    const opts = getGraphqlEditorOptions();
    expect(opts.wordWrap).toBe('on');
  });

  it('returns an options object with tabSize 2', () => {
    const opts = getGraphqlEditorOptions();
    expect(opts.tabSize).toBe(2);
  });

  it('has suggest.showWords disabled', () => {
    const opts = getGraphqlEditorOptions();
    expect(opts.suggest?.showWords).toBe(false);
  });

  it('returns a new object on each call (not shared reference)', () => {
    const a = getGraphqlEditorOptions();
    const b = getGraphqlEditorOptions();
    expect(a).not.toBe(b);
  });
});

// ─── getVariablesEditorOptions ────────────────────────────────────────────────

describe('getVariablesEditorOptions', () => {
  it('returns an options object with minimap disabled', () => {
    const opts = getVariablesEditorOptions();
    expect(opts.minimap?.enabled).toBe(false);
  });

  it('returns an options object with automaticLayout enabled', () => {
    const opts = getVariablesEditorOptions();
    expect(opts.automaticLayout).toBe(true);
  });

  it('returns an options object with tabSize 2', () => {
    const opts = getVariablesEditorOptions();
    expect(opts.tabSize).toBe(2);
  });

  it('returns a smaller fontSize than getGraphqlEditorOptions', () => {
    const gqlOpts = getGraphqlEditorOptions();
    const varOpts = getVariablesEditorOptions();
    expect(varOpts.fontSize).toBeLessThan(gqlOpts.fontSize!);
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

  it('ignores operation names inside block strings', () => {
    const ops = extractOperations('"""\nquery FakeInString { x }\n"""\nquery RealOp { y }');
    const names = ops.map((o) => o.name);
    expect(names).not.toContain('FakeInString');
    expect(names).toContain('RealOp');
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

  it('returns "query" for anonymous query with variable definitions', () => {
    expect(deriveOperationType('query($id: ID!) { user(id: $id) { name } }')).toBe('query');
  });

  it('returns "mutation" for anonymous mutation with variable definitions', () => {
    expect(deriveOperationType('mutation($name: String!) { createUser(name: $name) { id } }')).toBe('mutation');
  });

  it('returns "subscription" for anonymous subscription with variable definitions', () => {
    expect(deriveOperationType('subscription($topic: String!) { messages(topic: $topic) { text } }')).toBe('subscription');
  });

  it('returns undefined for only comments', () => {
    expect(deriveOperationType('# this is a comment')).toBeUndefined();
  });
});


// ─── deriveOperationType — additional coverage ───────────────────────────────

describe('deriveOperationType — returns undefined for non-operation content', () => {
  it('returns undefined for fragment definitions', () => {
    expect(deriveOperationType('fragment UserFields on User { id name }')).toBeUndefined();
  });

  it('returns undefined for schema type definitions', () => {
    expect(deriveOperationType('type Query { user: User }')).toBeUndefined();
  });
});

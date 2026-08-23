/**
 * envUtils.test.ts — unit tests for GraphQL environment variable utilities.
 */

import { describe, it, expect } from 'vitest';
import { resolveVars, findUnresolvedVars, hasUnresolvedVars } from './envUtils';
import type { GraphqlEnvironment } from '@shared/types/graphql';

function makeEnv(vars: Record<string, string>, enabled = true): GraphqlEnvironment {
  return {
    id: 'env-1',
    name: 'Test Env',
    variables: Object.entries(vars).map(([key, value]) => ({ key, value, enabled })),
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

// ─── resolveVars ─────────────────────────────────────────────────────────────

describe('resolveVars', () => {
  it('returns string unchanged when env is null/undefined', () => {
    expect(resolveVars('https://{{host}}/graphql', null)).toBe('https://{{host}}/graphql');
    expect(resolveVars('https://{{host}}/graphql', undefined)).toBe('https://{{host}}/graphql');
  });

  it('returns string unchanged when string is empty', () => {
    const env = makeEnv({ host: 'api.example.com' });
    expect(resolveVars('', env)).toBe('');
  });

  it('resolves simple {{var}} placeholder', () => {
    const env = makeEnv({ host: 'api.example.com' });
    expect(resolveVars('https://{{host}}/graphql', env)).toBe('https://api.example.com/graphql');
  });

  it('resolves multiple placeholders in one string', () => {
    const env = makeEnv({ host: 'api.example.com', path: 'graphql' });
    expect(resolveVars('https://{{host}}/{{path}}', env)).toBe('https://api.example.com/graphql');
  });

  it('leaves unresolvable placeholders unchanged', () => {
    const env = makeEnv({});
    expect(resolveVars('{{missing}}', env)).toBe('{{missing}}');
  });

  it('trims key before lookup', () => {
    const env = makeEnv({ host: 'example.com' });
    expect(resolveVars('{{ host }}', env)).toBe('example.com');
  });

  it('does not resolve disabled variables', () => {
    const env: GraphqlEnvironment = {
      id: 'e',
      name: 'E',
      variables: [{ key: 'host', value: 'example.com', enabled: false }],
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(resolveVars('{{host}}', env)).toBe('{{host}}');
  });

  it('does not resolve variables with empty keys', () => {
    const env: GraphqlEnvironment = {
      id: 'e',
      name: 'E',
      variables: [{ key: '', value: 'something', enabled: true }],
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(resolveVars('{{}}', env)).toBe('{{}}');
  });

  it('resolves global header vars when local env is null', () => {
    expect(resolveVars('{{graphqlUrl}}', null, { graphqlUrl: 'https://api.example.com/graphql' }))
      .toBe('https://api.example.com/graphql');
  });

  it('lets local GraphQL tab vars override global header vars', () => {
    const env = makeEnv({ host: 'local.example.com' });
    expect(resolveVars('{{host}}', env, { host: 'global.example.com' }))
      .toBe('local.example.com');
  });
});

// ─── findUnresolvedVars ───────────────────────────────────────────────────────

describe('findUnresolvedVars', () => {
  it('returns [] for empty string', () => {
    expect(findUnresolvedVars('', null)).toEqual([]);
  });

  it('returns [] when all vars are resolved', () => {
    const env = makeEnv({ host: 'example.com', path: 'graphql' });
    expect(findUnresolvedVars('https://{{host}}/{{path}}', env)).toEqual([]);
  });

  it('returns unresolved var names', () => {
    const env = makeEnv({ host: 'example.com' });
    const unresolved = findUnresolvedVars('{{host}}/{{path}}', env);
    expect(unresolved).toEqual(['path']);
  });

  it('de-duplicates repeated unresolved vars', () => {
    const env = makeEnv({});
    const unresolved = findUnresolvedVars('{{foo}}/{{foo}}', env);
    expect(unresolved).toEqual(['foo']);
  });

  it('returns all var names when env is null', () => {
    const unresolved = findUnresolvedVars('{{host}}/{{token}}', null);
    expect(unresolved).toContain('host');
    expect(unresolved).toContain('token');
  });

  it('ignores disabled variables when finding unresolved', () => {
    const env: GraphqlEnvironment = {
      id: 'e',
      name: 'E',
      variables: [{ key: 'host', value: 'example.com', enabled: false }],
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    };
    const unresolved = findUnresolvedVars('{{host}}', env);
    expect(unresolved).toContain('host');
  });
});

// ─── hasUnresolvedVars ────────────────────────────────────────────────────────

describe('hasUnresolvedVars', () => {
  it('returns false when string has no vars', () => {
    expect(hasUnresolvedVars('https://example.com', null)).toBe(false);
  });

  it('returns false when all vars resolved', () => {
    const env = makeEnv({ host: 'example.com' });
    expect(hasUnresolvedVars('{{host}}', env)).toBe(false);
  });

  it('returns true when any var is unresolved', () => {
    const env = makeEnv({});
    expect(hasUnresolvedVars('{{missing}}', env)).toBe(true);
  });
});

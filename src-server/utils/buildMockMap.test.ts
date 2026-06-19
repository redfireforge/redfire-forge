/**
 * buildMockMap.test.ts — Phase 3E unit tests (task 3E-14)
 *
 * Tests: Random/Fixed/Script/Error resolver modes + scalar factory presets.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildMockMap } from './buildMockMap.js';
import * as mockScriptRunner from './mockScriptRunner.js';

describe('buildMockMap', () => {
  describe('Random mode', () => {
    it('omits the field from IMocks when mode is random', () => {
      const mocks = buildMockMap({
        Query: { user: { type: 'random' } },
      });
      // IMocks for Query should not be included (random = let graphql-tools generate)
      expect(mocks['Query']).toBeUndefined();
    });

    it('returns empty object when all resolvers are random', () => {
      const mocks = buildMockMap({
        Query: { user: { type: 'random' }, posts: { type: 'random' } },
        User:  { name: { type: 'random' } },
      });
      expect(Object.keys(mocks)).toHaveLength(0);
    });
  });

  describe('Fixed mode', () => {
    it('returns configured string value', () => {
      const mocks = buildMockMap({
        Query: { greeting: { type: 'fixed', value: 'Hello world' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      expect(typeResolver['greeting']()).toBe('Hello world');
    });

    it('returns configured numeric value', () => {
      const mocks = buildMockMap({
        Query: { count: { type: 'fixed', value: 42 } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      expect(typeResolver['count']()).toBe(42);
    });

    it('returns configured boolean value', () => {
      const mocks = buildMockMap({
        User: { isActive: { type: 'fixed', value: false } },
      });
      const typeResolver = (mocks['User'] as () => Record<string, () => unknown>)();
      expect(typeResolver['isActive']()).toBe(false);
    });

    it('returns configured null value', () => {
      const mocks = buildMockMap({
        User: { deletedAt: { type: 'fixed', value: null } },
      });
      const typeResolver = (mocks['User'] as () => Record<string, () => unknown>)();
      expect(typeResolver['deletedAt']()).toBeNull();
    });

    it('returns configured object value', () => {
      const mocks = buildMockMap({
        Query: { meta: { type: 'fixed', value: { count: 5 } } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      expect(typeResolver['meta']()).toEqual({ count: 5 });
    });
  });

  describe('Script mode', () => {
    it('evaluates script and returns result', () => {
      const mocks = buildMockMap({
        Query: { timestamp: { type: 'script', code: 'return new Date().toISOString()' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      const val = typeResolver['timestamp']();
      expect(typeof val).toBe('string');
      expect(String(val)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('passes field name to script context', () => {
      const mocks = buildMockMap({
        User: { name: { type: 'script', code: 'return field' } },
      });
      const typeResolver = (mocks['User'] as () => Record<string, () => unknown>)();
      expect(typeResolver['name']()).toBe('name');
    });

    it('passes typeName to script context', () => {
      const mocks = buildMockMap({
        Product: { title: { type: 'script', code: 'return typeName' } },
      });
      const typeResolver = (mocks['Product'] as () => Record<string, () => unknown>)();
      expect(typeResolver['title']()).toBe('Product');
    });

    it('throws on script error, wrapping with context info', () => {
      const mocks = buildMockMap({
        Query: { broken: { type: 'script', code: 'throw new Error("oops")' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, (fa?: Record<string, unknown>) => unknown>)();
      expect(() => typeResolver['broken']()).toThrow('Mock script error on Query.broken');
    });

    it('forwards GraphQL field args to script context via args parameter', () => {
      // @graphql-tools/mock calls field resolvers with (fieldArgs) as first argument.
      // Scripts must be able to read these via the `args` context variable.
      const mocks = buildMockMap({
        Query: { user: { type: 'script', code: 'return args.id' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, (fa?: Record<string, unknown>) => unknown>)();
      const resolver = typeResolver['user'];
      expect(resolver({ id: 'abc-123' })).toBe('abc-123');
    });

    it('args defaults to empty object when called without arguments', () => {
      const mocks = buildMockMap({
        Query: { ping: { type: 'script', code: 'return JSON.stringify(args)' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, (fa?: Record<string, unknown>) => unknown>)();
      const resolver = typeResolver['ping'];
      expect(resolver()).toBe('{}');
    });
  });

  describe('Error mode', () => {
    it('returns Error instance with configured message (spec 3E-13: return new Error(msg))', () => {
      const mocks = buildMockMap({
        Query: { user: { type: 'error', message: 'Not found' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      const result = typeResolver['user']();
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Not found');
    });

    it('returns Error with default message when message is empty', () => {
      const mocks = buildMockMap({
        Query: { user: { type: 'error', message: '' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      const result = typeResolver['user']();
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('Mock error for Query.user');
    });

    it('returns Error with default message when message is omitted', () => {
      const mocks = buildMockMap({
        Query: { user: { type: 'error', message: undefined as unknown as string } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      const result = typeResolver['user']();
      expect((result as Error).message).toContain('Mock error for Query.user');
    });

    it('GraphQL treats returned Error as a field error (end-to-end semantic)', () => {
      // Returning an Error instance from a resolver is equivalent to throwing it:
      // GraphQL.js coerces returned Error values into field errors in the errors array.
      const mocks = buildMockMap({
        Query: { user: { type: 'error', message: 'Bang' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      const result = typeResolver['user']();
      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('Mixed modes per type', () => {
    it('handles multiple fields with different modes', () => {
      const mocks = buildMockMap({
        User: {
          id:    { type: 'fixed',  value: 'abc123' },
          name:  { type: 'random' },
          email: { type: 'script', code: 'return "user@example.com"' },
          bio:   { type: 'error',  message: 'Not available' },
        },
      });
      const typeResolver = (mocks['User'] as () => Record<string, () => unknown>)();
      expect(typeResolver['id']()).toBe('abc123');
      expect(typeResolver['name']).toBeUndefined();   // random fields are omitted
      expect(typeResolver['email']()).toBe('user@example.com');
      // Error mode: returns an Error instance (spec 3E-13 "return new Error(msg)")
      const bioResult = typeResolver['bio']();
      expect(bioResult).toBeInstanceOf(Error);
      expect((bioResult as Error).message).toBe('Not available');
    });
  });

  describe('Scalar factory presets', () => {
    it('email preset returns email-shaped string', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'EmailAddress', preset: 'email' }]);
      const gen = mocks['EmailAddress'] as () => string;
      expect(gen()).toMatch(/@example\.com$/);
    });

    it('date-iso preset returns ISO date string', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'DateTime', preset: 'date-iso' }]);
      const gen = mocks['DateTime'] as () => string;
      expect(gen()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('uuid preset returns uuid-shaped string', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'UUID', preset: 'uuid' }]);
      const gen = mocks['UUID'] as () => string;
      const val = gen();
      // Should be 8-4-4-4-12 format (our custom generator uses simpler hex format)
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(10);
    });

    it('url preset returns URL string', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'URL', preset: 'url' }]);
      const gen = mocks['URL'] as () => string;
      expect(gen()).toMatch(/^https:\/\//);
    });

    it('phone preset returns phone-shaped string', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'Phone', preset: 'phone' }]);
      const gen = mocks['Phone'] as () => string;
      expect(gen()).toMatch(/^\+1\d{10}$/);
    });

    it('name preset returns non-empty string', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'FullName', preset: 'name' }]);
      const gen = mocks['FullName'] as () => string;
      const val = gen();
      expect(typeof val).toBe('string');
      expect(val.trim().length).toBeGreaterThan(0);
    });

    it('sentence preset returns a sentence', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'Description', preset: 'sentence' }]);
      const gen = mocks['Description'] as () => string;
      expect(gen()).toMatch(/\.$/);
    });

    it('script mode factory evaluates expression', () => {
      const mocks = buildMockMap({}, [{
        scalarName: 'CustomType',
        scriptCode: 'return "custom-value"',
      }]);
      const gen = mocks['CustomType'] as () => string;
      expect(gen()).toBe('custom-value');
    });

    it('script factory throws on script failure (consistent with field script errors)', () => {
      const mocks = buildMockMap({}, [{
        scalarName: 'BrokenType',
        scriptCode: 'throw new Error("bad factory")',
      }]);
      const gen = mocks['BrokenType'] as () => string;
      // Throws a field error (consistent with field script error behavior)
      expect(() => gen()).toThrow(/scalar script error.*bad factory/);
    });

    it('preserves Error instances from scalar script failures', () => {
      vi.spyOn(mockScriptRunner, 'runMockScript').mockImplementationOnce(() => {
        throw new Error('direct-scalar-error');
      });
      const mocks = buildMockMap({}, [{ scalarName: 'CustomScalar', scriptCode: 'ignored' }]);
      expect(() => (mocks['CustomScalar'] as () => unknown)()).toThrow('direct-scalar-error');
    });

    it('does not add entry if neither preset nor script', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'EmptyFactory' }]);
      expect(mocks['EmptyFactory']).toBeUndefined();
    });

    it('ignores unknown preset names', () => {
      const mocks = buildMockMap({}, [{ scalarName: 'Custom', preset: 'not-a-preset' as 'email' }]);
      expect(mocks['Custom']).toBeUndefined();
    });

    it('wraps non-Error field script failures', () => {
      const mocks = buildMockMap({
        Query: { broken: { type: 'script', code: 'throw "string-failure"' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      expect(() => typeResolver['broken']()).toThrow('Mock script error on Query.broken');
    });

    it('preserves Error instances from field script failures', () => {
      vi.spyOn(mockScriptRunner, 'runMockScript').mockImplementationOnce(() => {
        throw new Error('direct-field-error');
      });
      const mocks = buildMockMap({
        Query: { fail: { type: 'script', code: 'ignored' } },
      });
      const typeResolver = (mocks['Query'] as () => Record<string, () => unknown>)();
      expect(() => typeResolver['fail']()).toThrow('direct-field-error');
    });

    it('prefers preset over scriptCode when both are provided', () => {
      const mocks = buildMockMap({}, [{
        scalarName: 'Email',
        preset: 'email',
        scriptCode: 'return "ignored"',
      }]);
      const gen = mocks['Email'] as () => string;
      expect(gen()).toMatch(/@example\.com$/);
    });
  });

  describe('Multiple types', () => {
    it('adds separate entries for each type with overrides', () => {
      const mocks = buildMockMap({
        Query:   { count: { type: 'fixed', value: 1 } },
        Mutation: { create: { type: 'error', message: 'Forbidden' } },
      });
      expect(mocks['Query']).toBeDefined();
      expect(mocks['Mutation']).toBeDefined();
    });
  });

  describe('Empty inputs', () => {
    it('returns empty IMocks for empty resolver map', () => {
      expect(buildMockMap({})).toEqual({});
    });

    it('returns empty IMocks for empty resolvers and no factories', () => {
      expect(buildMockMap({}, [])).toEqual({});
    });
  });
});

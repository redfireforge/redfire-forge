/**
 * mockScriptRunner.test.ts — Phase 3E unit tests (task 3E-14)
 *
 * Tests: sandbox isolation, timeout, return value propagation, error propagation.
 */

import { describe, it, expect } from 'vitest';
import { runMockScript } from './mockScriptRunner';

const BASIC_CTX = {
  field:    'title',
  typeName: 'Book',
  args:     { id: '1' },
  log:      () => { /* noop */ },
};

describe('mockScriptRunner', () => {
  it('returns a value from a simple return statement', () => {
    const result = runMockScript('return 42', BASIC_CTX);
    expect(result).toBe(42);
  });

  it('can access field from context', () => {
    const result = runMockScript('return field.toUpperCase()', BASIC_CTX);
    expect(result).toBe('TITLE');
  });

  it('can access typeName from context', () => {
    const result = runMockScript('return typeName', BASIC_CTX);
    expect(result).toBe('Book');
  });

  it('can access args from context', () => {
    const result = runMockScript('return args.id', BASIC_CTX);
    expect(result).toBe('1');
  });

  it('can use Date built-in', () => {
    const result = runMockScript('return new Date().toISOString()', BASIC_CTX);
    expect(typeof result).toBe('string');
    expect(String(result)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('can use Math built-in', () => {
    const result = runMockScript('return Math.floor(3.9)', BASIC_CTX);
    expect(result).toBe(3);
  });

  it('can use JSON built-in', () => {
    const result = runMockScript('return JSON.stringify({ ok: true })', BASIC_CTX);
    expect(result).toBe('{"ok":true}');
  });

  it('propagates thrown errors', () => {
    expect(() => runMockScript('throw new Error("intentional")', BASIC_CTX)).toThrow('intentional');
  });

  it('propagates syntax errors', () => {
    expect(() => runMockScript('{{{broken syntax', BASIC_CTX)).toThrow();
  });

  it('blocks access to require', () => {
    expect(() => runMockScript('return require("fs")', BASIC_CTX)).toThrow();
  });

  it('blocks access to process', () => {
    // process is not in the sandbox — accessing it should be undefined or throw
    const result = runMockScript(
      'try { return typeof process; } catch (e) { return "undefined"; }',
      BASIC_CTX,
    );
    expect(result).toBe('undefined');
  });

  it('does not expose require in the sandbox', () => {
    // Node.js vm sandboxes do not fully prevent Function-constructor escapes
    // (that is a known limitation documented in the Node.js vm module).
    // What we DO guarantee is that `require` is not directly available in the context.
    expect(() => runMockScript('return require("fs")', BASIC_CTX)).toThrow();
  });

  it('times out after 10s for infinite loop', async () => {
    // We can't easily wait 10s in tests so just verify the timeout option is wired
    // by checking that a very short script with while(true) throws DOMException / timeout error
    // Note: vm.runInContext with timeout triggers a Script execution timed out error
    expect(() => runMockScript('while(true) {}', BASIC_CTX)).toThrow();
  }, 15_000);

  it('returns undefined for a script with no return', () => {
    const result = runMockScript('const x = 5;', BASIC_CTX);
    expect(result).toBeUndefined();
  });

  it('can return an object', () => {
    const result = runMockScript('return { name: "Alice", age: 30 }', BASIC_CTX);
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('can return an array', () => {
    const result = runMockScript('return [1, 2, 3]', BASIC_CTX);
    expect(result).toEqual([1, 2, 3]);
  });

  it('calls log without throwing', () => {
    const logs: unknown[] = [];
    expect(() => runMockScript('log("hello")', {
      ...BASIC_CTX,
      log: (...args) => logs.push(...args),
    })).not.toThrow();
    expect(logs).toContain('hello');
  });
});

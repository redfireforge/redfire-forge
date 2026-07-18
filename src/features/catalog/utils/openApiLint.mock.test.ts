import { describe, it, expect, vi, beforeEach } from 'vitest';

// A mutable getter lets each test swap the `validate` export (a fn, or undefined).
let validateImpl: unknown;
vi.mock('oas-validator', () => ({
  get validate() { return validateImpl; },
}));

import { lintOpenApi } from './openApiLint';

const DOC = { openapi: '3.0.3', info: { title: 'X', version: '1' }, paths: {} };

beforeEach(() => { validateImpl = undefined; });

describe('lintOpenApi (mocked oas-validator)', () => {
  it('returns clean when validate resolves without throwing', async () => {
    validateImpl = vi.fn().mockResolvedValue({ valid: true });
    const r = await lintOpenApi(DOC, '3.0.4');
    expect(r).toEqual({ supported: true, clean: true, findings: [] });
  });

  it('collects findings from a lint-aggregate rejection (no schema error)', async () => {
    validateImpl = vi.fn().mockRejectedValue(Object.assign(new Error('There were 2 lint rule violations'), {
      options: { warnings: [
        { pointer: '#/info', rule: { name: 'info-contact', description: 'needs contact' } },
        { pointer: '#/x', rule: { name: 'operation-tags', description: 'needs tags' } },
      ] },
    }));
    const r = await lintOpenApi(DOC, '3.0.4');
    expect(r.supported).toBe(true);
    expect(r.clean).toBe(false);
    expect(r.schemaError).toBeUndefined();
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0].rule).toBe('info-contact');
  });

  it('reports a schema error for a non-lint rejection', async () => {
    validateImpl = vi.fn().mockRejectedValue(new Error('expected Object {} to have property responses'));
    const r = await lintOpenApi(DOC, '3.0.4');
    expect(r.clean).toBe(false);
    expect(r.schemaError).toBe('expected Object {} to have property responses');
    expect(r.findings).toEqual([]);
  });

  it('stringifies a non-Error rejection into schemaError', async () => {
    validateImpl = vi.fn().mockRejectedValue('kaboom');
    const r = await lintOpenApi(DOC, '3.0.4');
    expect(r.schemaError).toBe('kaboom');
  });

  it('marks unavailable when the module exposes no validate function', async () => {
    validateImpl = undefined; // getter returns undefined
    const r = await lintOpenApi(DOC, '3.0.4');
    expect(r.unavailable).toBe(true);
    expect(r.supported).toBe(false);
  });
});

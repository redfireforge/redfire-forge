import { describe, it, expect } from 'vitest';
import { resolveValidate, extractFindings, lintOpenApi } from './openApiLint';

// ─── resolveValidate ─────────────────────────────────────

describe('resolveValidate', () => {
  it('finds a top-level validate export', () => {
    const fn = () => Promise.resolve();
    expect(resolveValidate({ validate: fn })).toBe(fn);
  });
  it('falls back to default.validate (ESM interop)', () => {
    const fn = () => Promise.resolve();
    expect(resolveValidate({ default: { validate: fn } })).toBe(fn);
  });
  it('returns undefined when no validate function is present', () => {
    expect(resolveValidate({})).toBeUndefined();
    expect(resolveValidate({ validate: 'nope' })).toBeUndefined();
    expect(resolveValidate(null)).toBeUndefined();
  });
});

// ─── extractFindings ─────────────────────────────────────

describe('extractFindings', () => {
  it('maps pointer + rule + description and dedupes', () => {
    const ex = {
      options: {
        warnings: [
          { pointer: '#/info', rule: { name: 'info-contact', description: 'needs contact' } },
          { pointer: '#/info', rule: { name: 'info-contact', description: 'needs contact' } }, // dup
          { pointer: '#/paths', rule: { name: 'operation-tags', description: 'needs tags' } },
        ],
      },
    };
    const out = extractFindings(ex);
    expect(out).toEqual([
      { pointer: '#/info', rule: 'info-contact', message: 'needs contact' },
      { pointer: '#/paths', rule: 'operation-tags', message: 'needs tags' },
    ]);
  });

  it('falls back to the rule name, then a generic message, when description is missing', () => {
    const out = extractFindings({ options: { warnings: [
      { pointer: '#/x', rule: { name: 'only-name' } },
      { pointer: '#/y' },
    ] } });
    expect(out[0]).toEqual({ pointer: '#/x', rule: 'only-name', message: 'only-name' });
    expect(out[1]).toEqual({ pointer: '#/y', rule: undefined, message: 'Lint rule violation' });
  });

  it('returns [] for missing/invalid warning shapes', () => {
    expect(extractFindings(undefined)).toEqual([]);
    expect(extractFindings({})).toEqual([]);
    expect(extractFindings({ options: {} })).toEqual([]);
    expect(extractFindings({ options: { warnings: 'nope' } })).toEqual([]);
    expect(extractFindings({ options: { warnings: [null, 1, 'x'] } })).toEqual([]);
  });
});

// ─── lintOpenApi (real oas-validator integration) ────────

describe('lintOpenApi (integration)', () => {
  it('reports supported:false without importing for a 3.1 target', async () => {
    const r = await lintOpenApi({ openapi: '3.1.0' }, '3.1.1');
    expect(r.supported).toBe(false);
    expect(r.clean).toBe(true);
    expect(r.findings).toEqual([]);
    expect(r.unavailable).toBeUndefined();
  });

  it('reports supported:false for a 3.2 target', async () => {
    const r = await lintOpenApi({ openapi: '3.2.0' }, '3.2.0');
    expect(r.supported).toBe(false);
  });

  it('surfaces real advisory findings on a bare 3.0 document', async () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'X', version: '1' },
      paths: { '/a': { get: { responses: { '200': { description: 'ok' } } } } },
    };
    const r = await lintOpenApi(doc, '3.0.4');
    expect(r.supported).toBe(true);
    expect(r.clean).toBe(false);
    expect(r.schemaError).toBeUndefined();
    expect(r.findings.some(f => f.rule === 'operation-operationId')).toBe(true);
  });

  it('reports a schema error for a structurally invalid 3.0 document', async () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'X', version: '1' },
      paths: { '/a': { get: {} } }, // missing responses → schema-level failure
    };
    const r = await lintOpenApi(doc, '3.0.4');
    expect(r.supported).toBe(true);
    expect(r.clean).toBe(false);
    expect(r.schemaError).toBeTruthy();
  });
});

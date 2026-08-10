import { describe, it, expect } from 'vitest';
import { collectWarnings, resolveConvertObj, runSwagger2OpenApi } from './swagger2openapiEngine';
import { deriveWarnings } from './scalarEngine';

describe('swagger2openapiEngine.runSwagger2OpenApi', () => {
  it('rejects a non-3.0 target before loading the library', async () => {
    await expect(runSwagger2OpenApi({}, '3.1')).rejects.toThrow(/only target OpenAPI 3\.0/);
  });
});

describe('swagger2openapiEngine.collectWarnings', () => {
  it('returns [] when there are no warnings', () => {
    expect(collectWarnings({ openapi: '3.0.4' }, [])).toEqual([]);
  });

  it('collects string and { message } option warnings', () => {
    const out = collectWarnings({}, ['plain warning', { message: 'obj warning' }, { nope: 1 }, 42]);
    expect(out).toContain('plain warning');
    expect(out).toContain('obj warning');
    expect(out).toHaveLength(2);
  });

  it('collects x-s2o-warning extensions embedded in the document (deep + array)', () => {
    const doc = {
      openapi: '3.0.4',
      paths: {
        '/x': {
          get: {
            'x-s2o-warning': 'converted default response',
            responses: [{ 'x-s2o-warning': 'nested-in-array' }],
          },
        },
      },
    };
    const out = collectWarnings(doc, []);
    expect(out).toContain('converted default response');
    expect(out).toContain('nested-in-array');
  });

  it('deduplicates identical warnings', () => {
    const out = collectWarnings({ a: { 'x-s2o-warning': 'dup' }, b: { 'x-s2o-warning': 'dup' } }, ['dup']);
    expect(out).toEqual(['dup']);
  });

  it('tolerates cycles without infinite recursion', () => {
    const cyclic: Record<string, unknown> = { openapi: '3.0.4' };
    cyclic.self = cyclic;
    expect(() => collectWarnings(cyclic, [])).not.toThrow();
  });
});

describe('swagger2openapiEngine.resolveConvertObj', () => {
  it('returns a top-level convertObj export', () => {
    const fn = () => {};
    expect(resolveConvertObj({ convertObj: fn })).toBe(fn);
  });

  it('falls back to a default-nested convertObj (ESM/CJS interop)', () => {
    const fn = () => {};
    expect(resolveConvertObj({ default: { convertObj: fn } })).toBe(fn);
  });

  it('throws when no convertObj can be found', () => {
    expect(() => resolveConvertObj({})).toThrow(/convertObj export not found/);
    expect(() => resolveConvertObj({ convertObj: 'not a fn' })).toThrow(/convertObj export not found/);
  });
});

describe('scalarEngine.deriveWarnings', () => {
  it('returns [] when all $refs are local', () => {
    const doc = { openapi: '3.1.1', components: { schemas: { A: { $ref: '#/components/schemas/B' } } } };
    expect(deriveWarnings(doc)).toEqual([]);
  });

  it('warns about unresolved external $refs (deep + array)', () => {
    const doc = {
      openapi: '3.1.1',
      paths: {
        '/x': {
          get: {
            responses: {
              '200': { content: { 'application/json': { schema: { $ref: 'external.yaml#/Thing' } } } },
            },
          },
        },
      },
      list: [{ $ref: './other.json#/A' }],
    };
    const out = deriveWarnings(doc);
    expect(out).toContain('External $ref not resolved: external.yaml#/Thing');
    expect(out).toContain('External $ref not resolved: ./other.json#/A');
  });

  it('deduplicates and tolerates cycles', () => {
    const cyclic: Record<string, unknown> = { openapi: '3.1.1' };
    cyclic.self = cyclic;
    expect(() => deriveWarnings(cyclic)).not.toThrow();
  });
});

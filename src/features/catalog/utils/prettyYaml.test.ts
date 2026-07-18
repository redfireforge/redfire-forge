import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import { prettifyOpenApiYaml, resolveSort } from './prettyYaml';

describe('resolveSort', () => {
  it('finds openapiSort on the module namespace', () => {
    const fn = () => Promise.resolve({ data: {} });
    expect(resolveSort({ openapiSort: fn })).toBe(fn);
  });

  it('finds openapiSort on a default export (ESM interop)', () => {
    const fn = () => Promise.resolve({ data: {} });
    expect(resolveSort({ default: { openapiSort: fn } })).toBe(fn);
  });

  it('returns undefined for non-object / missing export', () => {
    expect(resolveSort(null)).toBeUndefined();
    expect(resolveSort(undefined)).toBeUndefined();
    expect(resolveSort(42)).toBeUndefined();
    expect(resolveSort({})).toBeUndefined();
    expect(resolveSort({ openapiSort: 'nope' })).toBeUndefined();
  });
});

describe('prettifyOpenApiYaml (real openapi-format)', () => {
  it('reorders top-level keys into canonical OpenAPI order', async () => {
    const doc = {
      paths: { '/pets': { get: { responses: { '200': { description: 'ok' } } } } },
      openapi: '3.0.3',
      info: { title: 'Pets', version: '1.0.0' },
    };
    const { yaml, applied } = await prettifyOpenApiYaml(doc);
    expect(applied).toBe(true);
    const openapiIdx = yaml.indexOf('openapi:');
    const infoIdx = yaml.indexOf('info:');
    const pathsIdx = yaml.indexOf('paths:');
    expect(openapiIdx).toBeGreaterThanOrEqual(0);
    expect(openapiIdx).toBeLessThan(infoIdx);
    expect(infoIdx).toBeLessThan(pathsIdx);
  });

  it('produces YAML that round-trips to the same document', async () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'Pets', version: '1.0.0' },
      paths: { '/pets': { get: { responses: { '200': { description: 'ok' } } } } },
    };
    const { yaml } = await prettifyOpenApiYaml(doc);
    expect(YAML.parse(yaml)).toEqual(doc);
  });

  it('does not mutate the input document', async () => {
    const doc = { paths: {}, openapi: '3.0.3', info: { title: 't', version: '1' } };
    const before = JSON.stringify(doc);
    await prettifyOpenApiYaml(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });
});

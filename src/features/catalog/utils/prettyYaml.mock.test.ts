import { describe, it, expect, vi, beforeEach } from 'vitest';
import YAML from 'yaml';

const openapiSort = vi.fn();
vi.mock('openapi-format', () => ({ openapiSort }));

import { prettifyOpenApiYaml } from './prettyYaml';

const DOC = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {} };

describe('prettifyOpenApiYaml (mocked openapi-format)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the sorted document when openapiSort succeeds', async () => {
    openapiSort.mockResolvedValue({ data: { openapi: '3.0.3', info: { title: 'x', version: '2' } } });
    const { yaml, applied } = await prettifyOpenApiYaml(DOC);
    expect(applied).toBe(true);
    expect(YAML.parse(yaml)).toEqual({ openapi: '3.0.3', info: { title: 'x', version: '2' } });
  });

  it('falls back to plain YAML when openapiSort returns no object data', async () => {
    openapiSort.mockResolvedValue({ data: null });
    const { yaml, applied } = await prettifyOpenApiYaml(DOC);
    expect(applied).toBe(false);
    expect(YAML.parse(yaml)).toEqual(DOC);
  });

  it('falls back to plain YAML when openapiSort throws', async () => {
    openapiSort.mockRejectedValue(new Error('boom'));
    const { yaml, applied } = await prettifyOpenApiYaml(DOC);
    expect(applied).toBe(false);
    expect(YAML.parse(yaml)).toEqual(DOC);
  });
});

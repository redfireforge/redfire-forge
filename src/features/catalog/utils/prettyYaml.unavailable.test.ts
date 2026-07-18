import { describe, it, expect, vi } from 'vitest';
import YAML from 'yaml';

// Simulate the openapi-format module failing to load (e.g. a browser-bundling
// problem) — prettify must degrade gracefully to the plain YAML rendering.
vi.mock('openapi-format', () => { throw new Error('module unavailable'); });

import { prettifyOpenApiYaml } from './prettyYaml';

describe('prettifyOpenApiYaml (openapi-format unavailable)', () => {
  it('falls back to plain YAML.stringify without throwing', async () => {
    const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {} };
    const { yaml, applied } = await prettifyOpenApiYaml(doc);
    expect(applied).toBe(false);
    expect(YAML.parse(yaml)).toEqual(doc);
  });
});

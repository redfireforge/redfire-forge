import { describe, it, expect } from 'vitest';
import { buildCatalogCurlCommand, buildCatalogCurlSingleLine, buildDefaultCurlCommand, resolveBaseUrl, buildFullUrl } from './catalogCurlGenerator';
import type { CatalogEndpoint, CatalogServer, HostConfig } from '../types/catalog';
import type { AuthConfig } from '../types';

function makeEndpoint(overrides: Partial<CatalogEndpoint> = {}): CatalogEndpoint {
  return {
    id: 'ep1',
    summary: 'Test',
    method: 'GET',
    path: '/pets',
    parameters: [],
    responses: [],
    tags: [],
    ...overrides,
  };
}

const servers: CatalogServer[] = [
  { url: 'https://api.example.com/v1', description: 'Production' },
  { url: 'https://staging.example.com/v1', description: 'Staging' },
];

const noAuth: AuthConfig = { type: 'none' };

describe('resolveBaseUrl', () => {
  it('returns hardcoded URL when strategy is hardcoded', () => {
    const hc: HostConfig = { strategy: 'hardcoded', hardcodedUrl: 'https://custom.com/api' };
    expect(resolveBaseUrl(hc, servers)).toBe('https://custom.com/api');
  });

  it('strips trailing slash from hardcoded URL', () => {
    const hc: HostConfig = { strategy: 'hardcoded', hardcodedUrl: 'https://custom.com/' };
    expect(resolveBaseUrl(hc, servers)).toBe('https://custom.com');
  });

  it('returns first server when inherited', () => {
    const hc: HostConfig = { strategy: 'inherited', selectedServerIndex: 0 };
    expect(resolveBaseUrl(hc, servers)).toBe('https://api.example.com/v1');
  });

  it('returns selected server by index', () => {
    const hc: HostConfig = { strategy: 'inherited', selectedServerIndex: 1 };
    expect(resolveBaseUrl(hc, servers)).toBe('https://staging.example.com/v1');
  });

  it('falls back to first server for out-of-range index', () => {
    const hc: HostConfig = { strategy: 'inherited', selectedServerIndex: 99 };
    expect(resolveBaseUrl(hc, servers)).toBe('https://api.example.com/v1');
  });

  it('returns empty string when no servers and no hardcoded URL', () => {
    const hc: HostConfig = { strategy: 'hardcoded' };
    expect(resolveBaseUrl(hc, [])).toBe('');
  });
});

describe('buildFullUrl', () => {
  it('builds simple URL', () => {
    expect(buildFullUrl('https://api.com', '/pets', {}, [])).toBe('https://api.com/pets');
  });

  it('substitutes path parameters', () => {
    const params = [{ name: 'petId', in: 'path' as const, required: true, schema: { type: 'string' } }];
    expect(buildFullUrl('https://api.com', '/pets/{petId}', { petId: '123' }, params))
      .toBe('https://api.com/pets/123');
  });

  it('keeps placeholder when path param not provided', () => {
    const params = [{ name: 'petId', in: 'path' as const, required: true, schema: { type: 'string' } }];
    expect(buildFullUrl('https://api.com', '/pets/{petId}', {}, params))
      .toBe('https://api.com/pets/%7BpetId%7D');
  });

  it('appends query parameters', () => {
    const params = [
      { name: 'limit', in: 'query' as const, required: false, schema: { type: 'integer' } },
      { name: 'offset', in: 'query' as const, required: false, schema: { type: 'integer' } },
    ];
    const url = buildFullUrl('https://api.com', '/pets', { limit: '10', offset: '20' }, params);
    expect(url).toBe('https://api.com/pets?limit=10&offset=20');
  });

  it('skips empty query parameters', () => {
    const params = [
      { name: 'limit', in: 'query' as const, required: false, schema: { type: 'integer' } },
    ];
    expect(buildFullUrl('https://api.com', '/pets', {}, params)).toBe('https://api.com/pets');
  });

  it('URL-encodes special characters', () => {
    const params = [{ name: 'q', in: 'query' as const, required: false, schema: { type: 'string' } }];
    const url = buildFullUrl('https://api.com', '/search', { q: 'hello world' }, params);
    expect(url).toBe('https://api.com/search?q=hello%20world');
  });
});

describe('buildCatalogCurlCommand', () => {
  const hostConfig: HostConfig = { strategy: 'inherited', selectedServerIndex: 0 };

  it('builds simple GET request', () => {
    const curl = buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('curl');
    expect(curl).toContain("'https://api.example.com/v1/pets'");
    expect(curl).not.toContain('-X');
  });

  it('adds -X for non-GET methods', () => {
    const curl = buildCatalogCurlCommand({
      endpoint: makeEndpoint({ method: 'POST' }),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('-X POST');
  });

  it('includes bearer auth header', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'my-jwt-token' };
    const curl = buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain("Authorization: Bearer my-jwt-token");
  });

  it('includes basic auth header', () => {
    const auth: AuthConfig = { type: 'basic', username: 'user', password: 'pass' };
    const curl = buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('Authorization: Basic');
  });

  it('includes API key in header', () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'secret123', apiKeyIn: 'header' };
    const curl = buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('X-API-Key: secret123');
  });

  it('includes request body with content-type', () => {
    const body = '{"name":"Fido"}';
    const curl = buildCatalogCurlCommand({
      endpoint: makeEndpoint({ method: 'POST' }),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: body, auth: noAuth,
    });
    expect(curl).toContain("Content-Type: application/json");
    expect(curl).toContain("-d");
    expect(curl).toContain('{"name":"Fido"}');
  });

  it('includes custom headers', () => {
    const curl = buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {},
      headerValues: { 'X-Custom': 'value1' }, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('X-Custom: value1');
  });

  it('substitutes path parameters in URL', () => {
    const ep = makeEndpoint({
      path: '/pets/{petId}',
      parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
    });
    const curl = buildCatalogCurlCommand({
      endpoint: ep,
      hostConfig, servers, paramValues: { petId: '42' }, headerValues: {}, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('/pets/42');
  });
});

describe('buildCatalogCurlSingleLine', () => {
  const hostConfig: HostConfig = { strategy: 'inherited', selectedServerIndex: 0 };

  it('removes line continuations', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'tok' };
    const curl = buildCatalogCurlSingleLine({
      endpoint: makeEndpoint({ method: 'POST' }),
      hostConfig, servers, paramValues: {}, headerValues: {},
      bodyText: '{"a":1}', auth,
    });
    expect(curl).not.toContain('\\\n');
    expect(curl).not.toContain('\n');
    expect(curl).toContain('curl');
    expect(curl).toContain('-H');
    expect(curl).toContain('-d');
  });
});

describe('buildDefaultCurlCommand', () => {
  const hostConfig: HostConfig = { strategy: 'inherited', selectedServerIndex: 0 };

  it('uses example values from parameters', () => {
    const ep = makeEndpoint({
      path: '/pets/{petId}',
      parameters: [{ name: 'petId', in: 'path', required: true, example: '99', schema: { type: 'string' } }],
    });
    const curl = buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).toContain('/pets/99');
  });

  it('uses schema default values', () => {
    const ep = makeEndpoint({
      parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20 } }],
    });
    const curl = buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).toContain('limit=20');
  });

  it('generates body from request body schema', () => {
    const ep = makeEndpoint({
      method: 'POST',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: { type: 'object', properties: { name: { type: 'string' } } },
        }],
      },
    });
    const curl = buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).toContain('-d');
    expect(curl).toContain('name');
  });
});

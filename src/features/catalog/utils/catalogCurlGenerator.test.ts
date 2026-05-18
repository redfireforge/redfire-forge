import { describe, it, expect, vi } from 'vitest';
import { buildCatalogCurlCommand, buildCatalogCurlSingleLine, buildDefaultCurlCommand, resolveBaseUrl, buildFullUrl, extractServerPathPrefix } from './catalogCurlGenerator';

vi.mock('../../../engine/tokenManager', () => ({
  acquireOAuth2Token: vi.fn(),
}));

import { acquireOAuth2Token } from '../../../engine/tokenManager';
import type { CatalogEndpoint, CatalogServer, HostConfig } from '../types/catalog';
import type { AuthConfig, Microservice } from '../../../shared/types';

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

  it('resolves environment URL from linked microservice', () => {
    const hc: HostConfig = { strategy: 'environment', environmentId: 'env1' };
    const svc: Microservice = {
      id: 'svc1', name: 'MySvc',
      baseUrls: { env1: 'https://mysvc.dev.example.com/' },
    };
    const result = resolveBaseUrl(hc, servers, undefined, svc);
    expect(result).toBe('https://mysvc.dev.example.com/v1');
  });

  it('resolves environment URL from catalog environments', () => {
    const hc: HostConfig = { strategy: 'environment', environmentId: 'env1' };
    const envs = [{ id: 'env1', name: 'dev', baseUrl: 'https://dev.example.com/api/' }];
    const result = resolveBaseUrl(hc, [], envs);
    expect(result).toBe('https://dev.example.com/api');
  });

  it('falls back to environments when microservice omits base url for tenant', () => {
    const hc: HostConfig = { strategy: 'environment', environmentId: 'env1' };
    const svc: Microservice = { id: 's1', name: 'S', baseUrls: {}, customEnvs: [] };
    const envs = [{ id: 'env1', name: 'dev', baseUrl: 'https://catalog-fallback.example/' }];
    expect(resolveBaseUrl(hc, [{ url: '/p', description: '' }], envs, svc)).toBe('https://catalog-fallback.example');
  });

  it('defaults selectedServerIndex to 0', () => {
    const hc: HostConfig = { strategy: 'inherited' };
    expect(resolveBaseUrl(hc, servers)).toBe('https://api.example.com/v1');
  });
});

describe('extractServerPathPrefix', () => {
  it('extracts path from server URL', () => {
    expect(extractServerPathPrefix([{ url: 'https://api.com/v1', description: '' }])).toBe('/v1');
  });

  it('returns empty for root path', () => {
    expect(extractServerPathPrefix([{ url: 'https://api.com/', description: '' }])).toBe('');
  });

  it('returns empty for no servers', () => {
    expect(extractServerPathPrefix([])).toBe('');
  });

  it('returns empty for invalid URL', () => {
    expect(extractServerPathPrefix([{ url: 'not-a-url', description: '' }])).toBe('');
  });

  it('treats slash-prefixed literals as relative prefixes', () => {
    expect(extractServerPathPrefix([{ url: '/service-root/', description: '' }])).toBe('/service-root');
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

  it('builds simple GET request', async () => {
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('curl');
    expect(curl).toContain("'https://api.example.com/v1/pets'");
    expect(curl).not.toContain('-X');
  });

  it('adds -X for non-GET methods', async () => {
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint({ method: 'POST' }),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('-X POST');
  });

  it('includes bearer auth header', async () => {
    const auth: AuthConfig = { type: 'bearer', token: 'my-jwt-token' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain("Authorization: Bearer my-jwt-token");
  });

  it('includes basic auth header', async () => {
    const auth: AuthConfig = { type: 'basic', username: 'user', password: 'pass' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('Authorization: Basic');
  });

  it('emits OAuth2 token error placeholder when token acquisition fails', async () => {
    vi.mocked(acquireOAuth2Token).mockRejectedValueOnce(new Error('token failed'));
    const auth: AuthConfig = {
      type: 'oauth2',
      tokenUrl: 'https://idp/oauth/token',
      clientId: 'cid',
      clientSecret: 'sec',
    };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig,
      servers,
      paramValues: {},
      headerValues: {},
      bodyText: '',
      auth,
    });
    expect(curl).toContain('Bearer <TOKEN_ERROR: check OAuth2 config>');
  });

  it('includes Bearer from OAuth2 when token acquisition succeeds', async () => {
    vi.mocked(acquireOAuth2Token).mockResolvedValueOnce('oauth-access-token');
    const auth: AuthConfig = {
      type: 'oauth2',
      tokenUrl: 'https://idp/oauth/token',
      clientId: 'cid',
      clientSecret: 'sec',
    };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig,
      servers,
      paramValues: {},
      headerValues: {},
      bodyText: '',
      auth,
    });
    expect(curl).toContain('Authorization: Bearer oauth-access-token');
  });

  it('includes API key in header', async () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'secret123', apiKeyIn: 'header' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('X-API-Key: secret123');
  });

  it('includes request body with content-type', async () => {
    const body = '{"name":"Fido"}';
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint({ method: 'POST' }),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: body, auth: noAuth,
    });
    expect(curl).toContain("Content-Type: application/json");
    expect(curl).toContain("-d");
    expect(curl).toContain('{"name":"Fido"}');
  });

  it('includes custom headers', async () => {
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {},
      headerValues: { 'X-Custom': 'value1' }, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('X-Custom: value1');
  });

  it('adds API key as query parameter', async () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val123', apiKeyIn: 'query' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('key=val123');
  });

  it('adds Bearer prefix for apikey auth with Authorization header name', async () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'Authorization', apiKeyValue: 'my-token', apiKeyIn: 'header' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('Authorization: Bearer my-token');
  });

  it('does not add Content-Type if already in headerValues', async () => {
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint({ method: 'POST' }),
      hostConfig, servers, paramValues: {},
      headerValues: { 'Content-Type': 'text/xml' },
      bodyText: '<root/>', auth: noAuth,
    });
    expect(curl).toContain('Content-Type: text/xml');
    const matches = curl.match(/Content-Type/g);
    expect(matches?.length).toBe(1);
  });

  it('does not add body data for GET even if bodyText provided', async () => {
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint({ method: 'GET' }),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '{"x":1}', auth: noAuth,
    });
    expect(curl).not.toContain('-d');
  });

  it('uses custom bearer prefix', async () => {
    const auth: AuthConfig = { type: 'bearer', token: 'tok', prefix: 'Token' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('Authorization: Token tok');
  });

  it('escapes single quotes in body', async () => {
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint({ method: 'POST' }),
      hostConfig, servers, paramValues: {}, headerValues: {},
      bodyText: "it's a test", auth: noAuth,
    });
    expect(curl).toContain("it'\\''s a test");
  });

  it('substitutes path parameters in URL', async () => {
    const ep = makeEndpoint({
      path: '/pets/{petId}',
      parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
    });
    const curl = await buildCatalogCurlCommand({
      endpoint: ep,
      hostConfig, servers, paramValues: { petId: '42' }, headerValues: {}, bodyText: '', auth: noAuth,
    });
    expect(curl).toContain('/pets/42');
  });
});

describe('buildCatalogCurlSingleLine', () => {
  const hostConfig: HostConfig = { strategy: 'inherited', selectedServerIndex: 0 };

  it('removes line continuations', async () => {
    const auth: AuthConfig = { type: 'bearer', token: 'tok' };
    const curl = await buildCatalogCurlSingleLine({
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

  it('uses example values from parameters', async () => {
    const ep = makeEndpoint({
      path: '/pets/{petId}',
      parameters: [{ name: 'petId', in: 'path', required: true, example: '99', schema: { type: 'string' } }],
    });
    const curl = await buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).toContain('/pets/99');
  });

  it('uses schema default values', async () => {
    const ep = makeEndpoint({
      parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20 } }],
    });
    const curl = await buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).toContain('limit=20');
  });

  it('uses schema.example when no top-level example', async () => {
    const ep = makeEndpoint({
      path: '/pets/{petId}',
      parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string', example: 'abc' } }],
    });
    const curl = await buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).toContain('/pets/abc');
  });

  it('generates body from request body schema', async () => {
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
    const curl = await buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).toContain('-d');
    expect(curl).toContain('name');
  });

  it('does not add body when requestBody has no json content type', async () => {
    const ep = makeEndpoint({
      method: 'POST',
      requestBody: {
        required: true,
        contentTypes: [{ mediaType: 'text/plain' }],
      },
    });
    const curl = await buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).not.toContain('-d');
  });

  it('does not add body when no requestBody', async () => {
    const ep = makeEndpoint({ method: 'POST' });
    const curl = await buildDefaultCurlCommand(ep, hostConfig, servers, noAuth);
    expect(curl).not.toContain('-d');
  });
});

describe('catalogCurlGenerator — additional branch coverage', () => {
  const hostConfig: HostConfig = { strategy: 'inherited', selectedServerIndex: 0 };

  it('falls through basic auth when username is empty', async () => {
    const auth: AuthConfig = { type: 'basic', username: '' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).not.toContain('Authorization');
  });

  it('falls through bearer auth when token is empty', async () => {
    const auth: AuthConfig = { type: 'bearer', token: '' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).not.toContain('Authorization');
  });

  it('falls through apikey auth when apiKeyName is missing', async () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: '', apiKeyValue: 'val', apiKeyIn: 'header' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).not.toContain('apikey');
  });

  it('apikey in header without Authorization name does not add Bearer prefix', async () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'abc', apiKeyIn: 'header' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('X-Key: abc');
    expect(curl).not.toContain('Bearer');
  });

  it('apikey with Authorization name and existing Bearer prefix does not double-prefix', async () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'Authorization', apiKeyValue: 'Bearer existing', apiKeyIn: 'header' };
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {}, headerValues: {}, bodyText: '', auth,
    });
    expect(curl).toContain('Authorization: Bearer existing');
  });

  it('resolveBaseUrl returns empty when environment strategy but no matching env', () => {
    const hc: HostConfig = { strategy: 'environment', environmentId: 'env-missing' };
    const envs = [{ id: 'env1', name: 'dev', baseUrl: 'https://dev.example.com' }];
    expect(resolveBaseUrl(hc, [], envs)).toBe('');
  });

  it('resolveBaseUrl falls through when linkedMicroservice has no matching envId', () => {
    const hc: HostConfig = { strategy: 'environment', environmentId: 'env2' };
    const svc: Microservice = { id: 's1', name: 'Svc', baseUrls: { env1: 'https://svc.dev' } };
    const envs = [{ id: 'env2', name: 'staging', baseUrl: 'https://staging.example.com/' }];
    expect(resolveBaseUrl(hc, [], envs, svc)).toBe('https://staging.example.com');
  });

  it('resolveBaseUrl uses microservice URL without path prefix for root servers', () => {
    const hc: HostConfig = { strategy: 'environment', environmentId: 'env1' };
    const svc: Microservice = { id: 's1', name: 'Svc', baseUrls: { env1: 'https://svc.dev/' } };
    const rootServers: CatalogServer[] = [{ url: 'https://api.com/', description: '' }];
    expect(resolveBaseUrl(hc, rootServers, undefined, svc)).toBe('https://svc.dev');
  });

  it('skips empty header keys and values', async () => {
    const curl = await buildCatalogCurlCommand({
      endpoint: makeEndpoint(),
      hostConfig, servers, paramValues: {},
      headerValues: { '': 'val', 'key': '', '  ': '  ' },
      bodyText: '', auth: noAuth,
    });
    expect(curl).not.toContain("-H ':");
  });
});

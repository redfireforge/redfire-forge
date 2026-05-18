import { describe, it, expect } from 'vitest';
import { catalogEndpointToRequest } from './catalogEndpointToRequest';
import type { CatalogEndpoint, CatalogServer } from '../types/catalog';

function makeEndpoint(overrides?: Partial<CatalogEndpoint>): CatalogEndpoint {
  return {
    id: 'ep-1',
    operationId: 'getUsers',
    summary: 'List Users',
    method: 'GET',
    path: '/users',
    parameters: [],
    responses: [],
    tags: ['users'],
    ...overrides,
  };
}

const servers: CatalogServer[] = [{ url: 'https://api.example.com', description: 'Prod' }];

describe('catalogEndpointToRequest', () => {
  it('creates correct temporary RequestItem', () => {
    const req = catalogEndpointToRequest(makeEndpoint(), servers, { type: 'none' }, 'entry-1', 'Petstore', '1.0.0');
    expect(req.name).toBe('List Users');
    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.example.com/users');
    expect(req.catalogMeta?.catalogEntryId).toBe('entry-1');
    expect(req.catalogMeta?.catalogVersion).toBe('1.0.0');
    expect(req.catalogMeta?.originalPath).toBe('/users');
    expect(req.catalogMeta?.tags).toEqual(['users']);
  });

  it('includes catalogMeta and specVersions', () => {
    const req = catalogEndpointToRequest(makeEndpoint(), servers, { type: 'none' }, 'e1', 'API', '2.0');
    expect(req.catalogMeta?.sourceSpec).toBe('API');
    expect(req.specVersions).toHaveLength(1);
    expect(req.specVersions![0].catalogVersion).toBe('2.0');
    expect(req.activeSpecVersionId).toBe(req.specVersions![0].id);
  });

  it('promotion from catalog creates valid scenario-ready request', () => {
    const ep = makeEndpoint({
      parameters: [
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
        { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
      ],
    });
    const req = catalogEndpointToRequest(ep, servers, { type: 'bearer', token: 'tok' });
    expect(req.savedQueryParams).toHaveLength(1);
    expect(req.savedQueryParams![0].key).toBe('limit');
    expect(req.savedPathParams).toHaveLength(1);
    expect(req.savedPathParams![0].key).toBe('userId');
    expect(req.auth).toEqual({ type: 'bearer', token: 'tok' });
  });

  it('generates sample body from schema when no example is provided', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/pet',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['available', 'pending', 'sold'] },
              tags: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } } },
            },
          },
        }],
      },
    });
    const req = catalogEndpointToRequest(ep, servers, { type: 'none' });
    expect(req.bodyType).toBe('json');
    expect(req.body).toBeTruthy();
    const parsed = JSON.parse(req.body);
    expect(parsed.id).toBe(0);
    expect(parsed.name).toBe('string');
    expect(parsed.status).toBe('available');
    expect(parsed.tags).toEqual([{ id: 0, name: 'string' }]);
  });

  it('prefers explicit example over schema-generated sample', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/pet',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: { type: 'object', properties: { name: { type: 'string' } }, example: { name: 'Fido' } },
        }],
      },
    });
    const req = catalogEndpointToRequest(ep, servers, { type: 'none' });
    expect(JSON.parse(req.body)).toEqual({ name: 'Fido' });
  });

  it('uses content-type level example over schema', () => {
    const ep = makeEndpoint({
      method: 'PUT',
      path: '/pet',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: { type: 'object', properties: { name: { type: 'string' } } },
          example: { name: 'Rex', id: 42 },
        }],
      },
    });
    const req = catalogEndpointToRequest(ep, servers, { type: 'none' });
    expect(JSON.parse(req.body)).toEqual({ name: 'Rex', id: 42 });
  });

  it('defaults name when summary is absent', () => {
    const ep = makeEndpoint({ summary: '', method: 'DELETE', path: '/gone' });
    const req = catalogEndpointToRequest(ep, servers, { type: 'none' });
    expect(req.name).toBe('DELETE /gone');
  });

  it('returns path-only URL when no servers provided', () => {
    const req = catalogEndpointToRequest(makeEndpoint(), [], { type: 'none' });
    expect(req.url).toBe('/users');
  });

  it('trims trailing slash from server URL when joining path', () => {
    const req = catalogEndpointToRequest(makeEndpoint(), [{ url: 'https://host.com/', description: 'x' }], { type: 'none' });
    expect(req.url).toBe('https://host.com/users');
  });

  it('adds headers for header parameters', () => {
    const ep = makeEndpoint({
      parameters: [{ name: 'X-Req', in: 'header', required: true, schema: { type: 'string' } }],
    });
    expect(catalogEndpointToRequest(ep, servers, { type: 'none' }).headers).toEqual([{ key: 'X-Req', value: '' }]);
  });

  it('stores query parameter descriptions on saved entries', () => {
    const ep = makeEndpoint({
      parameters: [{ name: 'q', in: 'query', required: false, description: 'hint', schema: { type: 'string' } }],
    });
    const rows = catalogEndpointToRequest(ep, servers, { type: 'none' }).savedQueryParams!;
    expect(rows[0]).toMatchObject({ key: 'q', description: 'hint', enabled: true });
  });

  it('prefers schema default before type-based sample', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/d',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: { type: 'string', default: 'fallback' },
        }],
      },
    });
    expect(JSON.parse(catalogEndpointToRequest(ep, servers, { type: 'none' }).body)).toBe('fallback');
  });

  it('samples date-time, date, boolean, and number primitives from schema', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/types',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: {
            type: 'object',
            properties: {
              at: { type: 'string', format: 'date-time' },
              d: { type: 'string', format: 'date' },
              on: { type: 'boolean' },
              n: { type: 'number' },
            },
          },
        }],
      },
    });
    const parsed = JSON.parse(catalogEndpointToRequest(ep, servers, { type: 'none' }).body);
    expect(parsed.at).toBe('2024-01-01T00:00:00Z');
    expect(parsed.d).toBe('2024-01-01');
    expect(parsed.on).toBe(true);
    expect(parsed.n).toBe(0);
  });

  it('uses form-urlencoded body type for form media types', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/form',
      requestBody: {
        required: true,
        contentTypes: [{ mediaType: 'application/x-www-form-urlencoded', schema: { type: 'object' } }],
      },
    });
    const req = catalogEndpointToRequest(ep, servers, { type: 'none' });
    expect(req.bodyType).toBe('form-urlencoded');
    expect(req.body).toBe('');
  });

  it('sets deprecated on catalog meta', () => {
    const req = catalogEndpointToRequest(makeEndpoint({ deprecated: true }), servers, { type: 'none' });
    expect(req.catalogMeta?.deprecated).toBe(true);
  });

  it('samples object properties when type is inferred from properties alone', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/obj',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: {
            properties: { n: { type: 'number' }, flag: { type: 'boolean' } },
          },
        }],
      },
    });
    expect(JSON.parse(catalogEndpointToRequest(ep, servers, { type: 'none' }).body)).toEqual({ n: 0, flag: true });
  });

  it('does not coerce json body when first content type is not json or form', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/raw',
      requestBody: {
        required: false,
        contentTypes: [{
          mediaType: 'text/plain',
          schema: { type: 'string', enum: [], example: 'plain' },
        }],
      },
    });
    const req = catalogEndpointToRequest(ep, servers, { type: 'none' });
    expect(req.bodyType).toBe('none');
    expect(req.body).toBe('');
  });

  it('uses empty enum array as absent and picks string primitive', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/edge',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: { type: 'string', enum: [] },
        }],
      },
    });
    expect(JSON.parse(catalogEndpointToRequest(ep, servers, { type: 'none' }).body)).toBe('string');
  });

  it('falls back for unknown schema shapes to empty object literal', () => {
    const ep = makeEndpoint({
      method: 'POST',
      path: '/fuzz',
      requestBody: {
        required: true,
        contentTypes: [{
          mediaType: 'application/json',
          schema: { type: 'weird-unknown' },
        }],
      },
    });
    expect(JSON.parse(catalogEndpointToRequest(ep, servers, { type: 'none' }).body)).toEqual({});
  });

  it('fills catalog meta tags as empty array when endpoint tags omitted', () => {
    const ep = makeEndpoint({ tags: undefined });
    expect(catalogEndpointToRequest(ep, servers, { type: 'none' }).catalogMeta?.tags).toEqual([]);
  });
});

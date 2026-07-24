import { describe, it, expect } from 'vitest';
import { diffCatalogEntries } from './catalogSpecDiff';
import type { CatalogEntry, CatalogEndpoint } from '../types/catalog';

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'e1',
    name: 'Test API',
    currentVersionId: 'v1',
    versions: [],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
    hostConfig: { strategy: 'inherited' },
    authConfig: { strategy: 'inherited' },
    ...overrides,
  };
}

function makeEp(overrides: Partial<CatalogEndpoint> = {}): CatalogEndpoint {
  return {
    id: 'ep1',
    summary: 'Test',
    method: 'GET',
    path: '/test',
    parameters: [],
    responses: [],
    tags: [],
    ...overrides,
  };
}

describe('diffCatalogEntries', () => {
  it('detects added endpoints', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ method: 'GET', path: '/a' })] });
    const newEntry = makeEntry({
      endpoints: [
        makeEp({ method: 'GET', path: '/a' }),
        makeEp({ method: 'POST', path: '/b' }),
      ],
    });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].method).toBe('POST');
    expect(diff.added[0].path).toBe('/b');
    expect(diff.removed).toHaveLength(0);
    expect(diff.summary.totalAdded).toBe(1);
  });

  it('detects removed endpoints', () => {
    const oldEntry = makeEntry({
      endpoints: [
        makeEp({ method: 'GET', path: '/a' }),
        makeEp({ method: 'DELETE', path: '/b' }),
      ],
    });
    const newEntry = makeEntry({ endpoints: [makeEp({ method: 'GET', path: '/a' })] });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].method).toBe('DELETE');
    expect(diff.removed[0].path).toBe('/b');
    expect(diff.summary.totalRemoved).toBe(1);
  });

  it('detects changed endpoints — summary change', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ summary: 'Old' })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ summary: 'New' })] });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Summary:')]));
  });

  it('detects parameter addition', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp()] });
    const newEntry = makeEntry({
      endpoints: [makeEp({
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }],
      })],
    });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Added parameters')]));
  });

  it('detects parameter removal', () => {
    const oldEntry = makeEntry({
      endpoints: [makeEp({
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }],
      })],
    });
    const newEntry = makeEntry({ endpoints: [makeEp()] });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Removed parameters')]));
  });

  it('detects request body addition', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ method: 'POST' })] });
    const newEntry = makeEntry({
      endpoints: [makeEp({
        method: 'POST',
        requestBody: { required: true, contentTypes: [{ mediaType: 'application/json', schema: { type: 'object' } }] },
      })],
    });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Request body added')]));
  });

  it('detects response code changes', () => {
    const oldEntry = makeEntry({
      endpoints: [makeEp({
        responses: [{ statusCode: '200', description: 'OK' }],
      })],
    });
    const newEntry = makeEntry({
      endpoints: [makeEp({
        responses: [
          { statusCode: '200', description: 'OK' },
          { statusCode: '404', description: 'Not found' },
        ],
      })],
    });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Added response codes: 404')]));
  });

  it('detects deprecation changes', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ deprecated: false })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ deprecated: true })] });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].details).toContain('Marked as deprecated');
  });

  it('returns empty diff for identical entries', () => {
    const entry = makeEntry({ endpoints: [makeEp()] });
    const diff = diffCatalogEntries(entry, entry, '1.0', '1.0');
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('works with endpoints in folders', () => {
    const oldEntry = makeEntry({
      folders: [{
        id: 'f1', name: 'Tag1', endpoints: [makeEp({ method: 'GET', path: '/a' })], folders: [],
      }],
    });
    const newEntry = makeEntry({
      folders: [{
        id: 'f1', name: 'Tag1', endpoints: [
          makeEp({ method: 'GET', path: '/a' }),
          makeEp({ method: 'POST', path: '/a' }),
        ], folders: [],
      }],
    });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].method).toBe('POST');
  });

  it('populates version strings', () => {
    const entry = makeEntry({ endpoints: [makeEp()] });
    const diff = diffCatalogEntries(entry, entry, '1.0.0', '2.0.0');
    expect(diff.fromVersion).toBe('1.0.0');
    expect(diff.toVersion).toBe('2.0.0');
  });

  it('detects description change', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ description: 'Old desc' })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ description: 'New desc' })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toContain('Description changed');
  });

  it('detects un-deprecation', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ deprecated: true })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ deprecated: false })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toContain('No longer deprecated');
  });

  it('detects parameter required change', () => {
    const param = { name: 'id', in: 'path' as const, required: false, schema: { type: 'string' } };
    const oldEntry = makeEntry({ endpoints: [makeEp({ parameters: [param] })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ parameters: [{ ...param, required: true }] })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('required')]));
  });

  it('detects parameter schema change', () => {
    const oldParam = { name: 'id', in: 'path' as const, required: true, schema: { type: 'string' } };
    const newParam = { name: 'id', in: 'path' as const, required: true, schema: { type: 'integer' } };
    const oldEntry = makeEntry({ endpoints: [makeEp({ parameters: [oldParam] })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ parameters: [newParam] })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('type: string → integer')]));
  });

  it('detects request body removal', () => {
    const oldEntry = makeEntry({
      endpoints: [makeEp({
        method: 'POST',
        requestBody: { required: true, contentTypes: [{ mediaType: 'application/json', schema: { type: 'object' } }] },
      })],
    });
    const newEntry = makeEntry({ endpoints: [makeEp({ method: 'POST' })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toContain('Request body removed');
  });

  it('detects request body content type change', () => {
    const oldBody = { required: true, contentTypes: [{ mediaType: 'application/json', schema: { type: 'object' } }] };
    const newBody = { required: true, contentTypes: [{ mediaType: 'application/xml', schema: { type: 'object' } }] };
    const oldEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: oldBody })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: newBody })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([
      expect.stringContaining('Request body content types changed'),
    ]));
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([
      expect.stringContaining('removed: application/json'),
    ]));
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([
      expect.stringContaining('added: application/xml'),
    ]));
  });

  it('detects request body required change', () => {
    const oldBody = { required: true, contentTypes: [{ mediaType: 'application/json', schema: {} }] };
    const newBody = { required: false, contentTypes: [{ mediaType: 'application/json', schema: {} }] };
    const oldEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: oldBody })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: newBody })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Request body required: true → false')]));
  });

  it('detects security changes', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ security: [{ bearerAuth: [] }] })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ security: [{ apiKeyAuth: [] }] })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Security:')]));
  });

  it('detects removed response codes', () => {
    const oldEntry = makeEntry({
      endpoints: [makeEp({ responses: [{ statusCode: '200', description: 'OK' }, { statusCode: '404', description: 'NF' }] })],
    });
    const newEntry = makeEntry({
      endpoints: [makeEp({ responses: [{ statusCode: '200', description: 'OK' }] })],
    });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('Removed response codes: 404')]));
  });

  it('detects metadata changes', () => {
    const oldEntry = makeEntry({ name: 'Old API', servers: [{ url: 'http://old.com', description: '' }] });
    const newEntry = makeEntry({ name: 'New API', servers: [{ url: 'http://new.com', description: '' }] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.metadata).toBeDefined();
    expect(diff.metadata).toEqual(expect.arrayContaining([expect.stringContaining('Title:')]));
    expect(diff.metadata).toEqual(expect.arrayContaining([expect.stringContaining('Servers:')]));
  });

  it('detects request body schema field changes', () => {
    const oldBody = { required: true, contentTypes: [{ mediaType: 'application/json', schema: { type: 'object', properties: { name: { type: 'string' } } } }] };
    const newBody = { required: true, contentTypes: [{ mediaType: 'application/json', schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' } } } }] };
    const oldEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: oldBody })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: newBody })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('added fields: email')]));
  });

  it('detects generic parameter schema change when type is unchanged', () => {
    const oldParam = { name: 'q', in: 'query' as const, required: false, schema: { type: 'string', maxLength: 10 } };
    const newParam = { name: 'q', in: 'query' as const, required: false, schema: { type: 'string', maxLength: 20 } };
    const oldEntry = makeEntry({ endpoints: [makeEp({ parameters: [oldParam] })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ parameters: [newParam] })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('schema changed')]));
  });

  it('detects request body schema removed fields and fallback message', () => {
    const oldBody = {
      required: true,
      contentTypes: [{
        mediaType: 'application/json',
        schema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } } },
      }],
    };
    const newBody = {
      required: true,
      contentTypes: [{
        mediaType: 'application/json',
        schema: { type: 'object', properties: { a: { type: 'string', minLength: 1 }, b: { type: 'number' } } },
      }],
    };
    const oldEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: oldBody })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: newBody })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('body schema changed')]));
  });

  it('detects response description changes including empty fallback text', () => {
    const oldEntry = makeEntry({
      endpoints: [makeEp({ responses: [{ statusCode: '200', description: undefined }] })],
    });
    const newEntry = makeEntry({
      endpoints: [makeEp({ responses: [{ statusCode: '200', description: 'OK' }] })],
    });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([
      expect.stringContaining('Response 200 description: "" → "OK"'),
    ]));
  });

  it('detects metadata description and security scheme changes', () => {
    const oldEntry = makeEntry({
      description: 'old desc',
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } as never },
    });
    const newEntry = makeEntry({
      description: 'new desc',
      securitySchemes: { apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' } as never },
    });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.metadata).toEqual(expect.arrayContaining([
      'API description changed',
      expect.stringContaining('Security schemes:'),
    ]));
  });

  it('covers fallback branches for summary/schema/response/security/server metadata', () => {
    const oldEntry = makeEntry({
      servers: [],
      securitySchemes: {},
      endpoints: [makeEp({
        summary: undefined,
        parameters: [{ name: 'id', in: 'path', required: true, schema: undefined as unknown as { type: string } }],
        requestBody: {
          required: true,
          contentTypes: [{
            mediaType: 'application/json',
            schema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } },
          }],
        },
        responses: [{ statusCode: '200', description: undefined }, { statusCode: '500', description: undefined }],
        security: undefined,
      })],
    });
    const newEntry = makeEntry({
      servers: [{ url: 'https://new.example.com', description: '' }],
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } as never },
      endpoints: [makeEp({
        summary: 'Now has summary',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          contentTypes: [{
            mediaType: 'application/json',
            schema: { type: 'object', properties: { a: { type: 'string' } } },
          }],
        },
        responses: [{ statusCode: '200', description: '' }, { statusCode: '201', description: undefined }],
        security: [{ bearerAuth: [] }],
      })],
    });

    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([
      'Summary: "(none)" → "Now has summary"',
      'Parameter "id" type: unknown → string',
      '  application/json: removed fields: b',
      'Added response codes: 201 (no description)',
      'Removed response codes: 500 (no description)',
      'Response 200 description: "" → ""',
      expect.stringContaining('Security:'),
    ]));
    expect(diff.metadata).toEqual(expect.arrayContaining([
      'Servers: (none) → https://new.example.com',
      expect.stringContaining('Security schemes: (none) → bearerAuth'),
    ]));
  });
});

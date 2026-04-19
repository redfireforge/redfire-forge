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
    expect(diff.changed[0].details).toContain('Summary changed');
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
    expect(diff.changed[0].details).toContain('Request body added');
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
    expect(diff.changed[0].details).toEqual(expect.arrayContaining([expect.stringContaining('schema changed')]));
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
    expect(diff.changed[0].details).toContain('Request body content types changed');
  });

  it('detects request body required change', () => {
    const oldBody = { required: true, contentTypes: [{ mediaType: 'application/json', schema: {} }] };
    const newBody = { required: false, contentTypes: [{ mediaType: 'application/json', schema: {} }] };
    const oldEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: oldBody })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ method: 'POST', requestBody: newBody })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toContain('Request body required changed');
  });

  it('detects security changes', () => {
    const oldEntry = makeEntry({ endpoints: [makeEp({ security: [{ bearerAuth: [] }] })] });
    const newEntry = makeEntry({ endpoints: [makeEp({ security: [{ apiKeyAuth: [] }] })] });
    const diff = diffCatalogEntries(oldEntry, newEntry, '1.0', '2.0');
    expect(diff.changed[0].details).toContain('Security requirements changed');
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
});

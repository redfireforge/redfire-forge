import { describe, it, expect, vi, afterEach } from 'vitest';
import { isPublicationStale, republishAtCurrentVersion } from './publicationDrift';
import type { CatalogEndpoint, CatalogEntry } from '../types/catalog';

function makeEndpoint(overrides: Partial<CatalogEndpoint> = {}): CatalogEndpoint {
  return {
    id: 'ep1',
    summary: 'Get users',
    method: 'GET',
    path: '/users',
    parameters: [],
    responses: [],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'entry1',
    name: 'Test API',
    currentVersionId: 'v2',
    versions: [],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
    hostConfig: { strategy: 'inherited' },
    authConfig: { type: 'none' },
    ...overrides,
  };
}

describe('isPublicationStale', () => {
  it('returns false when endpoint has no publication', () => {
    const ep = makeEndpoint();
    expect(isPublicationStale(ep, 'v1')).toBe(false);
  });

  it('returns false when publishedFromVersionId matches currentVersionId', () => {
    const ep = makeEndpoint({
      workflowPublication: {
        publishedAt: 1000,
        publishedFromVersionId: 'v2',
      },
    });
    expect(isPublicationStale(ep, 'v2')).toBe(false);
  });

  it('returns true when publishedFromVersionId differs from currentVersionId', () => {
    const ep = makeEndpoint({
      workflowPublication: {
        publishedAt: 1000,
        publishedFromVersionId: 'v1',
      },
    });
    expect(isPublicationStale(ep, 'v2')).toBe(true);
  });

  it('returns false when currentVersionId is empty and publication matches', () => {
    const ep = makeEndpoint({
      workflowPublication: {
        publishedAt: 1000,
        publishedFromVersionId: '',
      },
    });
    expect(isPublicationStale(ep, '')).toBe(false);
  });
});

describe('republishAtCurrentVersion', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns undefined for unpublished endpoints', () => {
    const ep = makeEndpoint();
    const entry = makeEntry();
    expect(republishAtCurrentVersion(ep, entry)).toBeUndefined();
  });

  it('updates publishedFromVersionId and publishedAt', () => {
    vi.spyOn(Date, 'now').mockReturnValue(99999);
    const ep = makeEndpoint({
      workflowPublication: {
        publishedAt: 1000,
        publishedFromVersionId: 'v1',
        note: 'original note',
        values: { paramValues: { foo: 'bar' }, headerValues: {} },
      },
    });
    const entry = makeEntry({ currentVersionId: 'v3' });

    const result = republishAtCurrentVersion(ep, entry);

    expect(result).toEqual({
      publishedAt: 99999,
      publishedFromVersionId: 'v3',
      note: 'original note',
      values: { paramValues: { foo: 'bar' }, headerValues: {} },
    });
  });

  it('preserves existing values and note', () => {
    vi.spyOn(Date, 'now').mockReturnValue(50000);
    const ep = makeEndpoint({
      workflowPublication: {
        publishedAt: 1000,
        publishedFromVersionId: 'v1',
        note: 'keep me',
        values: { paramValues: { a: '1' }, headerValues: { b: '2' }, body: '{}' },
      },
    });
    const entry = makeEntry({ currentVersionId: 'v2' });

    const result = republishAtCurrentVersion(ep, entry)!;
    expect(result.note).toBe('keep me');
    expect(result.values).toEqual({ paramValues: { a: '1' }, headerValues: { b: '2' }, body: '{}' });
  });
});

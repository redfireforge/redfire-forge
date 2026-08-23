import { describe, it, expect } from 'vitest';
import type { SpecVersion } from '@shared/types';
import { computeSpecVersionDiff } from './versionDiff';

function makeSV(overrides: Partial<SpecVersion> = {}): SpecVersion {
  return {
    id: 'sv-1',
    catalogVersion: '1.0.0',
    catalogEntryId: 'entry-1',
    catalogEndpointId: 'ep-1',
    importedAt: Date.now(),
    url: 'https://api.com/users',
    method: 'GET',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: '',
    ...overrides,
  };
}

describe('computeSpecVersionDiff', () => {
  it('returns empty array when versions are identical', () => {
    const sv = makeSV();
    expect(computeSpecVersionDiff(sv, { ...sv })).toHaveLength(0);
  });

  it('returns empty array when either version is undefined', () => {
    expect(computeSpecVersionDiff(undefined, makeSV())).toHaveLength(0);
    expect(computeSpecVersionDiff(makeSV(), undefined)).toHaveLength(0);
  });

  it('detects URL change', () => {
    const left = makeSV({ url: 'https://old.com/a' });
    const right = makeSV({ url: 'https://new.com/b' });
    const changes = computeSpecVersionDiff(left, right);
    expect(changes.find(c => c.field === 'URL')).toEqual({
      type: 'modified', field: 'URL', oldValue: 'https://old.com/a', newValue: 'https://new.com/b',
    });
  });

  it('detects method change', () => {
    const left = makeSV({ method: 'GET' });
    const right = makeSV({ method: 'POST' });
    const changes = computeSpecVersionDiff(left, right);
    expect(changes.find(c => c.field === 'Method')).toEqual({
      type: 'modified', field: 'Method', oldValue: 'GET', newValue: 'POST',
    });
  });

  it('detects added header', () => {
    const left = makeSV({ headers: [] });
    const right = makeSV({ headers: [{ key: 'X-New', value: 'val' }] });
    const changes = computeSpecVersionDiff(left, right);
    expect(changes).toContainEqual({ type: 'added', field: 'Header: X-New', newValue: 'val' });
  });

  it('detects removed header', () => {
    const left = makeSV({ headers: [{ key: 'X-Old', value: 'val' }] });
    const right = makeSV({ headers: [] });
    const changes = computeSpecVersionDiff(left, right);
    expect(changes).toContainEqual({ type: 'removed', field: 'Header: X-Old', oldValue: 'val' });
  });

  it('detects modified query param value', () => {
    const left = makeSV({
      savedQueryParams: [{ key: 'q', value: 'old', enabled: true }],
    });
    const right = makeSV({
      savedQueryParams: [{ key: 'q', value: 'new', enabled: true }],
    });
    const changes = computeSpecVersionDiff(left, right);
    expect(changes).toContainEqual({ type: 'modified', field: 'Query: q', oldValue: 'old', newValue: 'new' });
  });

  it('detects added path param', () => {
    const left = makeSV({ savedPathParams: [] });
    const right = makeSV({ savedPathParams: [{ key: 'id', value: '42' }] });
    const changes = computeSpecVersionDiff(left, right);
    expect(changes).toContainEqual({ type: 'added', field: 'Path: id', newValue: '42' });
  });

  it('detects body change', () => {
    const left = makeSV({ body: '{"a":1}' });
    const right = makeSV({ body: '{"a":1,"b":2}' });
    const changes = computeSpecVersionDiff(left, right);
    const bodyChange = changes.find(c => c.field === 'Body');
    expect(bodyChange).toBeDefined();
    expect(bodyChange!.type).toBe('modified');
  });

  it('reports empty body lengths in body diff', () => {
    const left = makeSV({ body: '' });
    const right = makeSV({ body: 'x' });
    const changes = computeSpecVersionDiff(left, right);
    expect(changes.find(c => c.field === 'Body')).toEqual({
      type: 'modified',
      field: 'Body',
      oldValue: '(empty)',
      newValue: '1 chars',
    });
  });

  it('detects modified header value', () => {
    const left = makeSV({ headers: [{ key: 'H', value: 'a' }] });
    const right = makeSV({ headers: [{ key: 'H', value: 'b' }] });
    expect(computeSpecVersionDiff(left, right)).toContainEqual({
      type: 'modified', field: 'Header: H', oldValue: 'a', newValue: 'b',
    });
  });

  it('detects added query param', () => {
    const left = makeSV({ savedQueryParams: [] });
    const right = makeSV({ savedQueryParams: [{ key: 'q', value: '1', enabled: true }] });
    expect(computeSpecVersionDiff(left, right)).toContainEqual({
      type: 'added', field: 'Query: q', newValue: '1',
    });
  });

  it('detects removed query param', () => {
    const left = makeSV({ savedQueryParams: [{ key: 'x', value: 'y', enabled: true }] });
    const right = makeSV({ savedQueryParams: [] });
    expect(computeSpecVersionDiff(left, right)).toContainEqual({
      type: 'removed', field: 'Query: x', oldValue: 'y',
    });
  });

  it('detects removed path param', () => {
    const left = makeSV({ savedPathParams: [{ key: 'pid', value: '1' }] });
    const right = makeSV({ savedPathParams: [] });
    expect(computeSpecVersionDiff(left, right)).toContainEqual({
      type: 'removed', field: 'Path: pid', oldValue: '1',
    });
  });

  it('detects modified path param', () => {
    const left = makeSV({ savedPathParams: [{ key: 'id', value: '1' }] });
    const right = makeSV({ savedPathParams: [{ key: 'id', value: '2' }] });
    expect(computeSpecVersionDiff(left, right)).toContainEqual({
      type: 'modified', field: 'Path: id', oldValue: '1', newValue: '2',
    });
  });

  it('detects body type change', () => {
    const left = makeSV({ bodyType: 'none' });
    const right = makeSV({ bodyType: 'json' });
    expect(computeSpecVersionDiff(left, right)).toContainEqual({
      type: 'modified',
      field: 'Body Type',
      oldValue: 'none',
      newValue: 'json',
    });
  });

  it('shows (none) for undefined body types in diff', () => {
    const left = makeSV({});
    const right = makeSV({ bodyType: 'text' });
    const bt = computeSpecVersionDiff(left, right).find(c => c.field === 'Body Type');
    expect(bt?.oldValue).toBe('(none)');
    expect(bt?.newValue).toBe('text');
  });

  it('treats undefined saved params like empty maps', () => {
    const left = makeSV({ savedQueryParams: undefined, savedPathParams: undefined });
    const right = makeSV({
      savedQueryParams: [{ key: 'a', value: '1', enabled: true }],
      savedPathParams: [{ key: 'id', value: 'x' }],
    });
    const d = computeSpecVersionDiff(left, right);
    expect(d).toContainEqual({ type: 'added', field: 'Query: a', newValue: '1' });
    expect(d).toContainEqual({ type: 'added', field: 'Path: id', newValue: 'x' });
  });

  it('emits both method and URL changes together', () => {
    const d = computeSpecVersionDiff(
      makeSV({ method: 'GET', url: 'https://a.com' }),
      makeSV({ method: 'PATCH', url: 'https://b.com' }),
    );
    expect(d.map(c => c.field)).toEqual(expect.arrayContaining(['Method', 'URL']));
  });

  it('shows both sides empty in body diff when bodies empty strings', () => {
    expect(computeSpecVersionDiff(makeSV({ body: '' }), makeSV({ body: '' }))).toHaveLength(0);
  });
});

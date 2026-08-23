import { describe, it, expect } from 'vitest';
import { resolveNodeSpecVersion, detectNewerVersion } from './resolveNodeSpecVersion';
import type { HttpNodeData } from '../types/workflow';
import type { RequestItem, SpecVersion } from '@shared/types';

function makeSpecVersion(overrides?: Partial<SpecVersion>): SpecVersion {
  return {
    id: 'sv-1',
    url: '/pets',
    method: 'GET',
    headers: [],
    body: '',
    bodyType: 'none' as const,
    bodyForm: [],
    savedQueryParams: [],
    savedPathParams: [],
    catalogVersion: '1.0.0',
    catalogEntryId: 'ce-1',
    catalogEndpointId: 'ep-1',
    importedAt: Date.now(),
    ...overrides,
  };
}

function makeHttpNodeData(overrides?: Partial<HttpNodeData>): HttpNodeData {
  return {
    label: 'Get Pets',
    scenario: {
      id: 's-1',
      name: 'Get Pets',
      method: 'GET',
      url: '/pets',
      headers: [],
      body: '',
      bodyType: 'none',
      bodyForm: [],
      auth: { type: 'none' },
      validation: { mode: 'none', expectedFields: [] },
    },
    specVersionMode: 'latest',
    sourceSpecVersionId: 'sv-1',
    sourceSpecVersionLabel: '1.0.0',
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<RequestItem>): RequestItem {
  return {
    id: 'r-1',
    name: 'Get Pets',
    method: 'GET',
    url: '/pets',
    headers: [],
    body: '',
    bodyType: 'none',
    bodyForm: [],
    auth: { type: 'none' },
    specVersions: [
      makeSpecVersion({ id: 'sv-1', catalogVersion: '1.0.0' }),
      makeSpecVersion({ id: 'sv-2', catalogVersion: '2.0.0', url: '/v2/pets', method: 'POST' }),
    ],
    activeSpecVersionId: 'sv-2',
    ...overrides,
  };
}

describe('resolveNodeSpecVersion', () => {
  it('defaults to latest mode on new workflow node', () => {
    const data = makeHttpNodeData({ specVersionMode: undefined });
    const result = resolveNodeSpecVersion(data, [makeRequest()]);
    expect(result).toBe(data);
  });

  it('pinned mode preserves scenario as-is', () => {
    const data = makeHttpNodeData({ specVersionMode: 'pinned' });
    const result = resolveNodeSpecVersion(data, [makeRequest()]);
    expect(result).toBe(data);
  });

  it('latest mode resolves to activeSpecVersionId', () => {
    const data = makeHttpNodeData({ specVersionMode: 'latest', sourceSpecVersionId: 'sv-1' });
    const requests = [makeRequest({ activeSpecVersionId: 'sv-2' })];
    const result = resolveNodeSpecVersion(data, requests);
    expect(result.scenario.url).toBe('/v2/pets');
    expect(result.scenario.method).toBe('POST');
    expect(result.sourceSpecVersionId).toBe('sv-2');
    expect(result.sourceSpecVersionLabel).toBe('2.0.0');
  });

  it('latest mode returns unchanged when already on active version', () => {
    const data = makeHttpNodeData({ specVersionMode: 'latest', sourceSpecVersionId: 'sv-2' });
    const requests = [makeRequest({ activeSpecVersionId: 'sv-2' })];
    const result = resolveNodeSpecVersion(data, requests);
    expect(result).toBe(data);
  });

  it('returns unchanged when no requests provided', () => {
    const data = makeHttpNodeData({ specVersionMode: 'latest' });
    const result = resolveNodeSpecVersion(data);
    expect(result).toBe(data);
  });

  it('latest mode skips when source id or catalog pointer missing', () => {
    const missingSource = makeHttpNodeData({ specVersionMode: 'latest', sourceSpecVersionId: undefined });
    expect(resolveNodeSpecVersion(missingSource, [makeRequest()])).toBe(missingSource);

    const ghostId = makeHttpNodeData({ specVersionMode: 'latest', sourceSpecVersionId: 'missing' });
    expect(resolveNodeSpecVersion(ghostId, [makeRequest()])).toBe(ghostId);

    const noActive = makeHttpNodeData({ specVersionMode: 'latest' });
    expect(resolveNodeSpecVersion(noActive, [makeRequest({ activeSpecVersionId: undefined })])).toBe(noActive);
  });

  it('falls back when activeSpecVersionId has no backing version row', () => {
    const data = makeHttpNodeData({ specVersionMode: 'latest', sourceSpecVersionId: 'sv-1' });
    const reqs = [
      makeRequest({
        activeSpecVersionId: 'ghost',
        specVersions: [
          makeSpecVersion({ id: 'sv-1', url: '/a' }),
          makeSpecVersion({ id: 'sv-2', url: '/b' }),
        ],
      }),
    ];
    expect(resolveNodeSpecVersion(data, reqs)).toBe(data);
    expect(detectNewerVersion(data, reqs)).toBeUndefined();
  });

  it('inherits scenario bodyForm when active version omits bodyForm array', () => {
    const data = makeHttpNodeData({
      specVersionMode: 'latest',
      sourceSpecVersionId: 'sv-pin',
      scenario: {
        ...makeHttpNodeData().scenario,
        bodyForm: [{ key: 'k', value: 'v', enabled: true }],
      },
    });
    const reqs = [
      makeRequest({
        activeSpecVersionId: 'sv-act',
        specVersions: [
          makeSpecVersion({
            id: 'sv-pin',
            url: '/old',
            method: 'GET',
          }),
          {
            ...makeSpecVersion({
              id: 'sv-act',
              url: '/next',
              method: 'PATCH',
              bodyForm: [],
            }),
            bodyForm: undefined,
          } as SpecVersion,
        ],
      }),
    ];
    const out = resolveNodeSpecVersion(data, reqs);
    expect(out.scenario.bodyForm).toEqual([{ key: 'k', value: 'v', enabled: true }]);
    expect(out.scenario.url).toBe('/next');
  });

  it('inherits scenario fields when spec version omits optional payload pieces', () => {
    const data = makeHttpNodeData({
      scenario: {
        ...makeHttpNodeData().scenario,
        headers: [{ key: 'H', value: '1' }],
        body: 'cached',
        bodyType: 'none',
      },
      sourceSpecVersionId: 'sv-1',
    });
    const reqs = [
      makeRequest({
        activeSpecVersionId: 'sv-3',
        specVersions: [
          makeSpecVersion({ id: 'sv-1' }),
          makeSpecVersion({ id: 'sv-2', url: '/two' }),
          {
            ...makeSpecVersion({ id: 'sv-3', url: '/latest', method: 'PUT', catalogVersion: '3', body: '', headers: [], bodyForm: [], bodyType: undefined }),
            headers: undefined,
            body: undefined,
          } as SpecVersion,
        ],
      }),
    ];

    const result = resolveNodeSpecVersion(data, reqs);
    expect(result.scenario.url).toBe('/latest');
    expect(result.scenario.method).toBe('PUT');
    expect(result.scenario.headers).toEqual([{ key: 'H', value: '1' }]);
    expect(result.scenario.body).toBe('cached');
  });
});

describe('detectNewerVersion', () => {
  it('detects newer version available when pinned', () => {
    const data = makeHttpNodeData({ specVersionMode: 'pinned', sourceSpecVersionId: 'sv-1' });
    const requests = [makeRequest({ activeSpecVersionId: 'sv-2' })];
    const newer = detectNewerVersion(data, requests);
    expect(newer).toBeDefined();
    expect(newer!.id).toBe('sv-2');
    expect(newer!.catalogVersion).toBe('2.0.0');
  });

  it('returns undefined when on active version', () => {
    const data = makeHttpNodeData({ specVersionMode: 'pinned', sourceSpecVersionId: 'sv-2' });
    const requests = [makeRequest({ activeSpecVersionId: 'sv-2' })];
    expect(detectNewerVersion(data, requests)).toBeUndefined();
  });

  it('returns undefined when no sourceSpecVersionId', () => {
    const data = makeHttpNodeData({ sourceSpecVersionId: undefined });
    expect(detectNewerVersion(data, [makeRequest()])).toBeUndefined();
  });

  it('returns undefined when catalog cannot resolve the pinned id', () => {
    const data = makeHttpNodeData({ specVersionMode: 'pinned', sourceSpecVersionId: 'missing' });
    expect(detectNewerVersion(data, [makeRequest()])).toBeUndefined();
  });

  it('returns undefined when active pointers are unavailable', () => {
    expect(detectNewerVersion(
      makeHttpNodeData({ specVersionMode: 'pinned' }),
      [makeRequest({ activeSpecVersionId: undefined })],
    )).toBeUndefined();

    expect(detectNewerVersion(makeHttpNodeData({ specVersionMode: 'pinned' }), [
      makeRequest({ specVersions: [] }),
    ])).toBeUndefined();
  });
});

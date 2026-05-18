import { describe, it, expect } from 'vitest';
import { createScenarioFromRequest, resolveRequestAuth } from './requestToScenario';
import type { PromotionContext } from './requestToScenario';
import type {
  AuthConfig,
  GlobalAuthProfile,
  RequestCollection,
  RequestItem,
} from '../../../shared/types';

const basicAuth: AuthConfig = { type: 'basic', username: 'u', password: 'p' };
const bearerAuth: AuthConfig = { type: 'bearer', token: 'tok123' };

function makeRequest(overrides?: Partial<RequestItem>): RequestItem {
  return {
    id: 'req-1',
    name: 'Get Users',
    method: 'GET',
    url: '/users',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '',
    auth: { type: 'inherit' },
    ...overrides,
  };
}

function makeCollection(overrides?: Partial<RequestCollection>): RequestCollection {
  return {
    id: 'col-1',
    name: 'My API',
    mode: 'multi-env',
    baseUrls: { env1: 'https://api.example.com' },
    requests: [],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<PromotionContext>): PromotionContext {
  return {
    collection: makeCollection(),
    selectedEnvId: 'env1',
    environments: [{ id: 'env1', name: 'DEV' }],
    globalAuthProfiles: [],
    microservices: [],
    ...overrides,
  };
}

describe('createScenarioFromRequest', () => {
  it('converts basic request to scenario with correct fields', () => {
    const req = makeRequest();
    const scenario = createScenarioFromRequest(req, makeContext());

    expect(scenario.name).toBe('Get Users');
    expect(scenario.method).toBe('GET');
    expect(scenario.headers).toEqual([{ key: 'Accept', value: 'application/json' }]);
    expect(scenario.body).toBe('');
    expect(scenario.id).toBeTruthy();
    expect(scenario.id).not.toBe(req.id);
  });

  it('resolves relative URL to absolute using collection baseUrl', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/users' }),
      makeContext(),
    );
    expect(scenario.url).toBe('https://api.example.com/users');
  });

  it('bakes enabled query params into URL', () => {
    const req = makeRequest({
      url: '/search',
      savedQueryParams: [
        { key: 'q', value: 'test', enabled: true },
        { key: 'page', value: '2', enabled: true },
        { key: 'draft', value: 'true', enabled: false },
      ],
    });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.url).toBe('https://api.example.com/search?q=test&page=2');
  });

  it('resolves inherit auth to concrete auth from collection', () => {
    const ctx = makeContext({
      collection: makeCollection({ auth: basicAuth }),
    });
    const scenario = createScenarioFromRequest(
      makeRequest({ auth: { type: 'inherit' } }),
      ctx,
    );
    expect(scenario.auth).toEqual(basicAuth);
  });

  it('sets sourceRequestId for origin badge', () => {
    const req = makeRequest({ id: 'req-42' });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.sourceRequestId).toBe('req-42');
  });

  it('defaults validation to { mode: "none" }', () => {
    const scenario = createScenarioFromRequest(makeRequest(), makeContext());
    expect(scenario.validation).toEqual({ mode: 'none' });
  });

  it('status-200 preset creates correct validation config', () => {
    const scenario = createScenarioFromRequest(
      makeRequest(),
      makeContext(),
      { validationPreset: 'status-200' },
    );
    expect(scenario.validation).toEqual({
      mode: 'selective',
      assertions: [{ type: 'status', expected: '200' }],
    });
  });

  it('handles request without savedQueryParams', () => {
    const req = makeRequest({ savedQueryParams: undefined });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.url).toBe('https://api.example.com/users');
  });

  it('uses inherit auth when authMode is inherit', () => {
    const ctx = makeContext({
      collection: makeCollection({ auth: basicAuth }),
    });
    const scenario = createScenarioFromRequest(
      makeRequest({ auth: { type: 'inherit' } }),
      ctx,
      { authMode: 'inherit' },
    );
    expect(scenario.auth).toEqual({ type: 'inherit' });
  });

  it('sets sourceSpecVersionLabel from active spec version', () => {
    const req = makeRequest({
      specVersions: [
        {
          id: 'sv-1',
          url: '/users',
          method: 'GET',
          headers: [],
          body: '',
          catalogVersion: '1.0.7',
          catalogEntryId: 'e1',
          catalogEndpointId: 'ep1',
          importedAt: Date.now(),
        },
      ],
      activeSpecVersionId: 'sv-1',
    });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.sourceSpecVersionId).toBe('sv-1');
    expect(scenario.sourceSpecVersionLabel).toBe('1.0.7');
  });

  it('resolves path params into URL', () => {
    const req = makeRequest({
      url: '/pets/{petId}/details',
      savedPathParams: [
        { key: 'petId', value: '42' },
      ],
    });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.url).toBe('https://api.example.com/pets/42/details');
  });

  it('keeps absolute URL unchanged', () => {
    const req = makeRequest({ url: 'https://other-api.com/health' });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.url).toBe('https://other-api.com/health');
  });

  it('copies bodyType and bodyForm', () => {
    const req = makeRequest({
      bodyType: 'json',
      body: '{"a":1}',
      bodyForm: [{ key: 'f', value: 'v' }],
    });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.bodyType).toBe('json');
    expect(scenario.body).toBe('{"a":1}');
    expect(scenario.bodyForm).toEqual([{ key: 'f', value: 'v' }]);
  });

  it('uses fallback first base URL when env has no specific base mapping', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: 'relative-path' }),
      makeContext({
        selectedEnvId: undefined,
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: { other: 'https://fallback.example.com/' },
        }),
      }),
    );
    expect(scenario.url).toBe('https://fallback.example.com/relative-path');
  });

  it('prepends slash to relative URL when resolving', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: 'users' }),
      makeContext({
        selectedEnvId: 'env1',
        collection: makeCollection({ mode: 'multi-env', baseUrls: { env1: 'https://api.example.com' } }),
      }),
    );
    expect(scenario.url).toBe('https://api.example.com/users');
  });

  it('stitches microservice base when collection has no resolvable hostname', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/v1/ping' }),
      makeContext({
        selectedEnvId: 'env-ms',
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: {},
          microserviceId: 'svc-linked',
        }),
        environments: [{ id: 'env-ms', name: 'QA' }],
        microservices: [
          { id: 'svc-linked', baseUrls: { 'env-ms': 'https://ms.service.test' }, authProfileIds: {} },
        ],
      }),
    );
    expect(scenario.url).toBe('https://ms.service.test/v1/ping');
  });

  it('matches microservice base URL via app environment name when keys differ', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/x' }),
      makeContext({
        selectedEnvId: 'wb-env',
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: {},
          microserviceId: 'svc-linked',
        }),
        environments: [{ id: 'wb-env', name: 'Staging' }],
        microservices: [
          {
            id: 'svc-linked',
            baseUrls: { 'app-env-id': 'https://staging.ms' },
            authProfileIds: {},
          },
        ],
        appEnvironments: [{ id: 'wb-env', name: 'Staging' }, { id: 'app-env-id', name: 'Staging' }],
      }),
    );
    expect(scenario.url).toBe('https://staging.ms/x');
  });

  it('resolves parent folder from nested folders for URL and inheritance', () => {
    const col = makeCollection({
      folders: [{
        id: 'outer',
        name: 'o',
        requests: [],
        folders: [{
          id: 'inner',
          name: 'i',
          isSubCollection: true,
          baseUrls: { env1: 'https://sub.example.io' },
          selectedEnvId: 'env1',
          requests: [],
        }],
      }],
    });
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/nested' }),
      makeContext({
        collection: col,
        folderId: 'inner',
        environments: [{ id: 'env1', name: 'DEV' }],
      }),
    );
    expect(scenario.url).toBe('https://sub.example.io/nested');
  });

  it('ignores query param rows with blank keys when baking URL', () => {
    const req = makeRequest({
      url: '/q',
      savedQueryParams: [
        { key: '   ', value: 'x', enabled: true },
        { key: 'ok', value: '1', enabled: true },
      ],
    });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.url).toBe('https://api.example.com/q?ok=1');
  });

  it('skips path param substitution when value is empty', () => {
    const req = makeRequest({
      url: '/a/{id}/b',
      savedPathParams: [{ key: 'id', value: '' }],
    });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.url).toBe('https://api.example.com/a/{id}/b');
  });

  it('does not set sourceSpecVersionLabel when active version missing', () => {
    const req = makeRequest({ specVersions: [], activeSpecVersionId: undefined });
    const scenario = createScenarioFromRequest(req, makeContext());
    expect(scenario.sourceSpecVersionLabel).toBeUndefined();
    expect(scenario.sourceSpecVersionId).toBeUndefined();
  });
});

describe('resolveRequestAuth', () => {
  it('returns request auth when it is explicit (not inherit/none)', () => {
    const result = resolveRequestAuth(
      { auth: basicAuth },
      { auth: bearerAuth },
      undefined,
      'env1',
      [],
      [],
      [],
    );
    expect(result).toEqual(basicAuth);
  });

  it('falls back to parent folder auth', () => {
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: { type: 'none' } },
      { auth: bearerAuth },
      'env1',
      [],
      [],
      [],
    );
    expect(result).toEqual(bearerAuth);
  });

  it('falls back to collection per-env auth', () => {
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: { type: 'none' }, authPerEnv: { env1: basicAuth } },
      undefined,
      'env1',
      [],
      [],
      [],
    );
    expect(result).toEqual(basicAuth);
  });

  it('falls back to collection auth', () => {
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: bearerAuth },
      undefined,
      undefined,
      [],
      [],
      [],
    );
    expect(result).toEqual(bearerAuth);
  });

  it('returns none when entire chain has no auth', () => {
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: { type: 'none' } },
      undefined,
      undefined,
      [],
      [],
      [],
    );
    expect(result).toEqual({ type: 'none' });
  });

  it('resolves microservice global auth profile', () => {
    const profile: GlobalAuthProfile = { id: 'gp1', name: 'OAuth', auth: bearerAuth };
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: { type: 'none' }, microserviceId: 'svc-1' },
      undefined,
      'env1',
      [{ id: 'svc-1', authProfileIds: { env1: 'gp1' } }],
      [profile],
      [{ id: 'env1', name: 'DEV' }],
    );
    expect(result).toEqual({ ...bearerAuth, globalProfileId: 'gp1' });
  });

  it('skips parent folder auth when it is inherit or none', () => {
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: basicAuth },
      { auth: { type: 'inherit' } },
      undefined,
      [],
      [],
      [],
    );
    expect(result).toEqual(basicAuth);
  });

  it('skips per-env auth when it is explicitly none', () => {
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: { type: 'none' }, authPerEnv: { env1: { type: 'none' } } },
      undefined,
      'env1',
      [],
      [],
      [],
    );
    expect(result).toEqual({ type: 'none' });
  });

  it('maps global profile via app environment id matching workbench env name', () => {
    const profile: GlobalAuthProfile = { id: 'gp99', name: 'P', auth: basicAuth };
    const result = resolveRequestAuth(
      { auth: { type: 'inherit' } },
      { auth: { type: 'none' }, microserviceId: 'svc-1' },
      undefined,
      'wb-1',
      [{ id: 'svc-1', authProfileIds: { 'app-1': 'gp99' } }],
      [profile],
      [{ id: 'wb-1', name: 'DEV' }],
      [{ id: 'app-1', name: 'DEV' }],
    );
    expect(result).toEqual({ ...basicAuth, globalProfileId: 'gp99' });
  });

  it('does not inherit folder auth typed none', () => {
    expect(
      resolveRequestAuth(
        { auth: { type: 'inherit' } },
        { auth: bearerAuth },
        { auth: { type: 'none' } },
        undefined,
        [],
        [],
        [],
      ),
    ).toEqual(bearerAuth);
  });

  it('treats request typed none as transparent and inherits parent bearer', () => {
    expect(
      resolveRequestAuth(
        { auth: { type: 'none' } },
        { auth: { type: 'none' } },
        { auth: bearerAuth },
        undefined,
        [],
        [],
        [],
      ),
    ).toEqual(bearerAuth);
  });

  it('does not resolve microservice profile when envId is absent', () => {
    expect(
      resolveRequestAuth(
        { auth: { type: 'inherit' } },
        { auth: { type: 'none' }, microserviceId: 'svc-1' },
        undefined,
        undefined,
        [{ id: 'svc-1', authProfileIds: { env1: 'gp1' } }],
        [{ id: 'gp1', name: 'P', auth: basicAuth }],
        [{ id: 'env1', name: 'DEV' }],
      ),
    ).toEqual({ type: 'none' });
  });

  it('skips profile when mapped id is missing in global profiles', () => {
    expect(
      resolveRequestAuth(
        { auth: { type: 'inherit' } },
        { auth: { type: 'none' }, microserviceId: 'svc-1' },
        undefined,
        'env1',
        [{ id: 'svc-1', authProfileIds: { env1: 'missing-profile' } }],
        [],
        [{ id: 'env1', name: 'DEV' }],
      ),
    ).toEqual({ type: 'none' });
  });

  it('falls through when microservice maps env but profile id empty', () => {
    expect(
      resolveRequestAuth(
        { auth: { type: 'inherit' } },
        { auth: { type: 'none' }, microserviceId: 'svc-1' },
        undefined,
        'env1',
        [{ id: 'svc-1', authProfileIds: { env1: '' } }],
        [{ id: 'gp1', name: 'P', auth: basicAuth }],
        [{ id: 'env1', name: 'DEV' }],
      ),
    ).toEqual({ type: 'none' });
  });

  it('uses plain env id for profile lookup when workbench env has no name match', () => {
    const profile: GlobalAuthProfile = { id: 'gp2', name: 'P', auth: bearerAuth };
    expect(
      resolveRequestAuth(
        { auth: { type: 'inherit' } },
        { auth: { type: 'none' }, microserviceId: 'svc-1' },
        undefined,
        'orbit-only',
        [{ id: 'svc-1', authProfileIds: { 'orbit-only': 'gp2' } }],
        [profile],
        [{ id: 'orbit-only', name: 'Orbit' }],
        [],
      ),
    ).toEqual({ ...bearerAuth, globalProfileId: 'gp2' });
  });
});

describe('createScenarioFromRequest branches', () => {
  it('uses explicit request-side auth skipping collection', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ auth: basicAuth }),
      makeContext({
        collection: makeCollection({ auth: bearerAuth }),
      }),
    );
    expect(scenario.auth).toEqual(basicAuth);
  });

  it('extends existing query string when baking saved params', () => {
    const req = makeRequest({
      url: '/r?existing=1',
      savedQueryParams: [{ key: 'n', value: '2', enabled: true }],
    });
    expect(createScenarioFromRequest(req, makeContext()).url).toBe(
      'https://api.example.com/r?n=2',
    );
  });

  it('copies headers array when headers undefined', () => {
    const req = makeRequest({ headers: undefined });
    expect(createScenarioFromRequest(req, makeContext()).headers).toEqual([]);
  });

  it('does not prepend microservice base when resolved URL already absolute', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: 'https://api.example.com/rel' }),
      makeContext({
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: {},
          microserviceId: 'svc-linked',
        }),
        microservices: [
          { id: 'svc-linked', baseUrls: { env1: 'https://wrong.test' }, authProfileIds: {} },
        ],
      }),
    );
    expect(scenario.url).toBe('https://api.example.com/rel');
  });

  it('does not mutate microservice stitching when svc has no baseUrls', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/only' }),
      makeContext({
        selectedEnvId: 'env1',
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: {},
          microserviceId: 'svc-nil',
        }),
        microservices: [{ id: 'svc-nil', authProfileIds: {} }],
      }),
    );
    expect(scenario.url).toBe('/only');
  });

  it('does not mutate when microservice match has empty string base', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/z' }),
      makeContext({
        selectedEnvId: 'env1',
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: {},
          microserviceId: 'svc-linked',
        }),
        microservices: [
          { id: 'svc-linked', baseUrls: { env1: '' }, authProfileIds: {} },
        ],
      }),
    );
    expect(scenario.url).toBe('/z');
  });

  it('does not mutate when svc baseUrls entries are all falsy except lookup falls to first undefined', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/z' }),
      makeContext({
        selectedEnvId: 'missing-env',
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: {},
          microserviceId: 'svc-linked',
        }),
        environments: [{ id: 'missing-env', name: 'Ghost' }],
        microservices: [
          {
            id: 'svc-linked',
            baseUrls: { a: '', b: '' },
            authProfileIds: {},
          },
        ],
      }),
    );
    expect(scenario.url).toBe('/z');
  });

  it('percent-encodes path param values', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({
        url: '/q/{t}',
        savedPathParams: [{ key: 't', value: 'a b' }],
      }),
      makeContext(),
    );
    expect(scenario.url).toBe('https://api.example.com/q/a%20b');
  });

  it('omit bodyForm when request has none', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ bodyForm: undefined }),
      makeContext(),
    );
    expect(scenario.bodyForm).toBeUndefined();
  });

  it('rolls back to the first declared microservice base when env lacks direct mapping', () => {
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/fallback' }),
      makeContext({
        selectedEnvId: 'missing-key',
        environments: [{ id: 'missing-key', name: 'Orphan' }],
        collection: makeCollection({
          mode: 'multi-env',
          baseUrls: {},
          microserviceId: 'svc-linked',
        }),
        microservices: [
          { id: 'svc-linked', baseUrls: { other: 'https://pool.example' }, authProfileIds: {} },
        ],
      }),
    );
    expect(scenario.url).toBe('https://pool.example/fallback');
  });

  it('ignores dangling folder identifiers that are not rooted in collection trees', () => {
    const col = makeCollection({
      folders: [{ id: 'real', name: 'R', requests: [] }],
    });
    const scenario = createScenarioFromRequest(
      makeRequest({ url: '/z' }),
      makeContext({
        collection: col,
        folderId: 'missing-folder',
        selectedEnvId: 'env1',
      }),
    );
    expect(scenario.url).toBe('https://api.example.com/z');
  });
});

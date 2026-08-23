import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthConfig, GlobalAuthProfile } from '@shared/types';

vi.mock('../../engine/tokenManager', () => ({
  acquireOAuth2Token: vi.fn(),
}));

import { acquireOAuth2Token } from '@engine/core/tokenManager';
import {
  resolveAuthForConnect,
  resolveEffectiveAuth,
  describeResolvedAuth,
  appendAuthQueryParams,
} from './wsAuthResolve';

const mockAcquire = vi.mocked(acquireOAuth2Token);

const profiles: GlobalAuthProfile[] = [
  { id: 'p1', name: 'Prod Bearer', auth: { type: 'bearer', token: 'PROFILE_TOKEN' } },
  { id: 'p2', name: 'None Profile', auth: { type: 'none' } },
];

beforeEach(() => {
  mockAcquire.mockReset();
});

describe('resolveEffectiveAuth', () => {
  it('returns null for undefined / none', () => {
    expect(resolveEffectiveAuth(undefined, profiles)).toBeNull();
    expect(resolveEffectiveAuth({ type: 'none' }, profiles)).toBeNull();
  });

  it('returns the auth itself for concrete types', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'abc' };
    expect(resolveEffectiveAuth(auth, profiles)).toBe(auth);
  });

  it('follows inherit via globalProfileId', () => {
    const auth: AuthConfig = { type: 'inherit', globalProfileId: 'p1' };
    expect(resolveEffectiveAuth(auth, profiles)).toEqual({ type: 'bearer', token: 'PROFILE_TOKEN' });
  });

  it('falls back to __globalProfileId for inherit', () => {
    const auth: AuthConfig = { type: 'inherit', __globalProfileId: 'p1' };
    expect(resolveEffectiveAuth(auth, profiles)).toEqual({ type: 'bearer', token: 'PROFILE_TOKEN' });
  });

  it('returns null for inherit with no profile bound', () => {
    expect(resolveEffectiveAuth({ type: 'inherit' }, profiles)).toBeNull();
  });

  it('returns null for inherit pointing at a missing profile', () => {
    expect(resolveEffectiveAuth({ type: 'inherit', globalProfileId: 'gone' }, profiles)).toBeNull();
  });

  it('returns null for inherit pointing at a none-type profile', () => {
    expect(resolveEffectiveAuth({ type: 'inherit', globalProfileId: 'p2' }, profiles)).toBeNull();
  });

  it('returns null (no throw) for inherit pointing at a malformed profile missing auth', () => {
    const malformed = [{ id: 'bad', name: 'Corrupt' } as unknown as GlobalAuthProfile];
    expect(resolveEffectiveAuth({ type: 'inherit', globalProfileId: 'bad' }, malformed)).toBeNull();
  });
});

describe('resolveAuthForConnect — header-based', () => {
  it('returns empty for no auth', async () => {
    expect(await resolveAuthForConnect(undefined, profiles, {})).toEqual({ headers: [], queryParams: [] });
    expect(await resolveAuthForConnect({ type: 'none' }, profiles, {})).toEqual({ headers: [], queryParams: [] });
  });

  it('builds Basic auth header', async () => {
    const res = await resolveAuthForConnect({ type: 'basic', username: 'u', password: 'p' }, profiles, {});
    expect(res.queryParams).toEqual([]);
    expect(res.headers).toEqual([{ key: 'Authorization', value: `Basic ${btoa('u:p')}` }]);
  });

  it('builds Bearer auth header with custom prefix', async () => {
    const res = await resolveAuthForConnect({ type: 'bearer', token: 't', prefix: 'Token' }, profiles, {});
    expect(res.headers).toEqual([{ key: 'Authorization', value: 'Token t' }]);
  });

  it('builds API key header', async () => {
    const res = await resolveAuthForConnect(
      { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'header' },
      profiles,
      {},
    );
    expect(res.headers).toEqual([{ key: 'X-Key', value: 'secret' }]);
    expect(res.queryParams).toEqual([]);
  });

  it('builds API key header when apiKeyIn is unspecified (panel header default)', async () => {
    const res = await resolveAuthForConnect(
      { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret' },
      profiles,
      {},
    );
    expect(res.headers).toEqual([{ key: 'X-Key', value: 'secret' }]);
    expect(res.queryParams).toEqual([]);
  });

  it('returns empty when api key header is incomplete', async () => {
    expect(
      await resolveAuthForConnect({ type: 'apikey', apiKeyName: 'X-Key' }, profiles, {}),
    ).toEqual({ headers: [], queryParams: [] });
    expect(
      await resolveAuthForConnect({ type: 'apikey', apiKeyValue: 'secret' }, profiles, {}),
    ).toEqual({ headers: [], queryParams: [] });
  });

  it('builds digest as Basic fallback header', async () => {
    const res = await resolveAuthForConnect({ type: 'digest', username: 'u', password: 'p' }, profiles, {});
    expect(res.headers).toEqual([{ key: 'Authorization', value: `Basic ${btoa('u:p')}` }]);
  });

  it('resolves inherit to the bound profile auth', async () => {
    const res = await resolveAuthForConnect({ type: 'inherit', globalProfileId: 'p1' }, profiles, {});
    expect(res.headers).toEqual([{ key: 'Authorization', value: 'Bearer PROFILE_TOKEN' }]);
  });
});

describe('resolveAuthForConnect — query-based', () => {
  it('builds API key query param', async () => {
    const res = await resolveAuthForConnect(
      { type: 'apikey', apiKeyName: 'token', apiKeyValue: 'abc', apiKeyIn: 'query' },
      profiles,
      {},
    );
    expect(res.headers).toEqual([]);
    expect(res.queryParams).toEqual([{ key: 'token', value: 'abc' }]);
  });

  it('returns empty when query api key is incomplete', async () => {
    const res = await resolveAuthForConnect(
      { type: 'apikey', apiKeyName: 'token', apiKeyIn: 'query' },
      profiles,
      {},
    );
    expect(res).toEqual({ headers: [], queryParams: [] });
  });
});

describe('resolveAuthForConnect — env var interpolation', () => {
  it('interpolates {{vars}} in bearer token', async () => {
    const res = await resolveAuthForConnect(
      { type: 'bearer', token: '{{API_TOKEN}}' },
      profiles,
      { API_TOKEN: 'resolved-token' },
    );
    expect(res.headers).toEqual([{ key: 'Authorization', value: 'Bearer resolved-token' }]);
  });

  it('interpolates {{vars}} in basic username/password', async () => {
    const res = await resolveAuthForConnect(
      { type: 'basic', username: '{{USER}}', password: '{{PASS}}' },
      profiles,
      { USER: 'alice', PASS: 'secret' },
    );
    expect(res.headers).toEqual([{ key: 'Authorization', value: `Basic ${btoa('alice:secret')}` }]);
  });

  it('interpolates {{vars}} in api key query value', async () => {
    const res = await resolveAuthForConnect(
      { type: 'apikey', apiKeyName: 'k', apiKeyValue: '{{SECRET}}', apiKeyIn: 'query' },
      profiles,
      { SECRET: 'xyz' },
    );
    expect(res.queryParams).toEqual([{ key: 'k', value: 'xyz' }]);
  });
});

describe('resolveAuthForConnect — oauth2', () => {
  it('acquires a token and builds Bearer header', async () => {
    mockAcquire.mockResolvedValue('OAUTH_TOKEN');
    const res = await resolveAuthForConnect(
      { type: 'oauth2', tokenUrl: 'https://auth/token', clientId: 'cid', clientSecret: 'csec' },
      profiles,
      {},
    );
    expect(mockAcquire).toHaveBeenCalledOnce();
    expect(res.headers).toEqual([{ key: 'Authorization', value: 'Bearer OAUTH_TOKEN' }]);
  });

  it('interpolates {{vars}} into oauth2 credentials before acquiring', async () => {
    mockAcquire.mockResolvedValue('OAUTH_TOKEN');
    await resolveAuthForConnect(
      { type: 'oauth2', tokenUrl: '{{TOKEN_URL}}', clientId: '{{CID}}', clientSecret: '{{CSEC}}' },
      profiles,
      { TOKEN_URL: 'https://auth/token', CID: 'cid', CSEC: 'csec' },
    );
    expect(mockAcquire).toHaveBeenCalledWith(
      expect.objectContaining({ tokenUrl: 'https://auth/token', clientId: 'cid', clientSecret: 'csec' }),
    );
  });

  it('returns empty without acquiring when oauth2 config is incomplete', async () => {
    const res = await resolveAuthForConnect({ type: 'oauth2', tokenUrl: 'https://auth/token' }, profiles, {});
    expect(mockAcquire).not.toHaveBeenCalled();
    expect(res).toEqual({ headers: [], queryParams: [] });
  });
});

describe('describeResolvedAuth', () => {
  it('returns null for no auth', () => {
    expect(describeResolvedAuth(undefined, profiles)).toBeNull();
    expect(describeResolvedAuth({ type: 'none' }, profiles)).toBeNull();
  });

  it('describes inherit with no profile', () => {
    expect(describeResolvedAuth({ type: 'inherit' }, profiles)).toBe('Inherit — no profile selected');
  });

  it('masks basic credentials', () => {
    const out = describeResolvedAuth({ type: 'basic', username: 'alice', password: 'longsecret' }, profiles);
    expect(out).toMatch(/^Authorization: Basic /);
    expect(out).not.toContain(btoa('alice:longsecret'));
    expect(out).toContain('…');
  });

  it('does not throw on non-Latin1 basic credentials (btoa would otherwise crash render)', () => {
    const out = describeResolvedAuth({ type: 'basic', username: 'José', password: 'señör' }, profiles);
    expect(out).toMatch(/^Authorization: Basic /);
  });

  it('masks bearer token with prefix', () => {
    const out = describeResolvedAuth({ type: 'bearer', token: 'abcdefghijklmnop', prefix: 'Token' }, profiles);
    expect(out).toBe('Authorization: Token abcd…mnop');
  });

  it('describes api key location', () => {
    expect(
      describeResolvedAuth({ type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'longsecretvalue', apiKeyIn: 'query' }, profiles),
    ).toBe('X-Key (query): long…alue');
    expect(
      describeResolvedAuth({ type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'longsecretvalue', apiKeyIn: 'header' }, profiles),
    ).toBe('X-Key (header): long…alue');
  });

  it('describes oauth2 token source without acquiring', () => {
    expect(
      describeResolvedAuth({ type: 'oauth2', tokenUrl: 'https://auth/token', clientId: 'cid' }, profiles),
    ).toBe('Authorization: Bearer <token from https://auth/token>');
  });

  it('describes inherited profile auth', () => {
    expect(describeResolvedAuth({ type: 'inherit', globalProfileId: 'p1' }, profiles)).toBe(
      'Authorization: Bearer PROF…OKEN',
    );
  });

  it('returns null for incomplete credential fields (guard branches)', () => {
    expect(describeResolvedAuth({ type: 'basic', username: '' }, profiles)).toBeNull();
    expect(describeResolvedAuth({ type: 'bearer', token: '' }, profiles)).toBeNull();
    expect(describeResolvedAuth({ type: 'apikey', apiKeyName: '', apiKeyValue: '' }, profiles)).toBeNull();
  });

  it('describes a digest fallback', () => {
    const out = describeResolvedAuth({ type: 'digest', username: 'alice', password: 'longsecret' }, profiles);
    expect(out).toMatch(/^Authorization: Basic /);
    expect(out).toContain('(digest fallback)');
  });

  it('describes oauth2 as incomplete when token URL / client id are missing', () => {
    expect(describeResolvedAuth({ type: 'oauth2', tokenUrl: '', clientId: '' }, profiles)).toBe(
      'OAuth2 — incomplete configuration',
    );
  });

  it('returns null for an unknown auth type (default branch)', () => {
    expect(describeResolvedAuth({ type: 'weird' } as unknown as AuthConfig, profiles)).toBeNull();
  });
});

describe('appendAuthQueryParams', () => {
  it('returns the url unchanged when there are no params', () => {
    expect(appendAuthQueryParams('wss://host/ws', [])).toBe('wss://host/ws');
  });

  it('appends with ? when the url has no query string', () => {
    expect(appendAuthQueryParams('wss://host/ws', [{ key: 'token', value: 'abc' }])).toBe(
      'wss://host/ws?token=abc',
    );
  });

  it('appends with & when the url already has a query string', () => {
    expect(appendAuthQueryParams('wss://host/ws?x=1', [{ key: 'token', value: 'abc' }])).toBe(
      'wss://host/ws?x=1&token=abc',
    );
  });

  it('url-encodes keys and values and joins multiple params', () => {
    expect(
      appendAuthQueryParams('wss://host/ws', [
        { key: 'a b', value: 'c&d' },
        { key: 'k', value: 'v' },
      ]),
    ).toBe('wss://host/ws?a%20b=c%26d&k=v');
  });
});


import { describe, it, expect } from 'vitest';
import { buildHeaders, buildUrl } from './executor';
import type { Scenario } from '../types';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'http://example.com/api',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildHeaders
// ---------------------------------------------------------------------------
describe('buildHeaders', () => {
  it('returns empty headers for no-auth, no-headers scenario', () => {
    const headers = buildHeaders(makeScenario());
    expect(headers).toEqual({});
  });

  it('includes custom headers', () => {
    const scenario = makeScenario({
      headers: [
        { key: 'X-Custom', value: 'foo' },
        { key: 'Accept', value: 'application/json' },
      ],
    });
    const headers = buildHeaders(scenario);
    expect(headers['X-Custom']).toBe('foo');
    expect(headers['Accept']).toBe('application/json');
  });

  it('skips headers with empty keys', () => {
    const scenario = makeScenario({
      headers: [{ key: '', value: 'ignored' }, { key: 'Keep', value: 'yes' }],
    });
    const headers = buildHeaders(scenario);
    expect(Object.keys(headers)).toEqual(['Keep']);
  });

  it('trims header keys', () => {
    const scenario = makeScenario({
      headers: [{ key: '  X-Trimmed  ', value: 'ok' }],
    });
    const headers = buildHeaders(scenario);
    expect(headers['X-Trimmed']).toBe('ok');
  });

  describe('Basic Auth', () => {
    it('sets Authorization header with base64 credentials', () => {
      const scenario = makeScenario({
        auth: { type: 'basic', username: 'admin', password: 'secret' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBe(`Basic ${btoa('admin:secret')}`);
    });

    it('handles missing password', () => {
      const scenario = makeScenario({
        auth: { type: 'basic', username: 'admin' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBe(`Basic ${btoa('admin:')}`);
    });

    it('skips auth when username is missing', () => {
      const scenario = makeScenario({
        auth: { type: 'basic' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('Bearer Auth', () => {
    it('sets Authorization with Bearer prefix', () => {
      const scenario = makeScenario({
        auth: { type: 'bearer', token: 'my-token' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBe('Bearer my-token');
    });

    it('uses custom prefix', () => {
      const scenario = makeScenario({
        auth: { type: 'bearer', token: 'my-token', prefix: 'Token' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBe('Token my-token');
    });

    it('skips when token is missing', () => {
      const scenario = makeScenario({
        auth: { type: 'bearer' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('API Key Auth', () => {
    it('sets API key as header', () => {
      const scenario = makeScenario({
        auth: { type: 'apikey', apiKeyName: 'X-API-KEY', apiKeyValue: 'abc', apiKeyIn: 'header' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['X-API-KEY']).toBe('abc');
    });

    it('does not set header when apiKeyIn is query', () => {
      const scenario = makeScenario({
        auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'abc', apiKeyIn: 'query' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['key']).toBeUndefined();
    });
  });

  describe('Digest Auth', () => {
    it('falls back to Basic header', () => {
      const scenario = makeScenario({
        auth: { type: 'digest', username: 'user', password: 'pass' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBe(`Basic ${btoa('user:pass')}`);
    });
  });

  describe('OAuth2', () => {
    it('sets Bearer header with provided token', () => {
      const scenario = makeScenario({
        auth: { type: 'oauth2', tokenUrl: 'http://auth.com', clientId: 'c', clientSecret: 's' },
      });
      const headers = buildHeaders(scenario, 'oauth-token-123');
      expect(headers['Authorization']).toBe('Bearer oauth-token-123');
    });

    it('does not set Authorization without token', () => {
      const scenario = makeScenario({
        auth: { type: 'oauth2', tokenUrl: 'http://auth.com', clientId: 'c', clientSecret: 's' },
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('Content-Type auto-detection', () => {
    it('adds Content-Type for scenarios with body', () => {
      const scenario = makeScenario({ body: '{"data":1}' });
      const headers = buildHeaders(scenario);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('does not override explicit Content-Type', () => {
      const scenario = makeScenario({
        body: '<xml>',
        headers: [{ key: 'Content-Type', value: 'text/xml' }],
      });
      const headers = buildHeaders(scenario);
      expect(headers['Content-Type']).toBe('text/xml');
    });

    it('does not add Content-Type when body is empty', () => {
      const scenario = makeScenario({ body: '' });
      const headers = buildHeaders(scenario);
      expect(headers['Content-Type']).toBeUndefined();
    });
  });

  describe('Authorization header override', () => {
    it('skips manual Authorization header when auth type is set', () => {
      const scenario = makeScenario({
        auth: { type: 'bearer', token: 'auto-token' },
        headers: [{ key: 'Authorization', value: 'Manual xyz' }],
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBe('Bearer auto-token');
    });

    it('keeps manual Authorization when auth type is none', () => {
      const scenario = makeScenario({
        auth: { type: 'none' },
        headers: [{ key: 'Authorization', value: 'Custom xyz' }],
      });
      const headers = buildHeaders(scenario);
      expect(headers['Authorization']).toBe('Custom xyz');
    });
  });
});

// ---------------------------------------------------------------------------
// buildUrl
// ---------------------------------------------------------------------------
describe('buildUrl', () => {
  it('returns URL unchanged for non-apikey auth', () => {
    const scenario = makeScenario();
    expect(buildUrl(scenario)).toBe('http://example.com/api');
  });

  it('appends API key as query parameter when apiKeyIn=query', () => {
    const scenario = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'api_key', apiKeyValue: 'secret123', apiKeyIn: 'query' },
    });
    const url = buildUrl(scenario);
    expect(url).toContain('api_key=secret123');
    expect(url.startsWith('http://example.com/api')).toBe(true);
  });

  it('does not modify URL when apiKeyIn=header', () => {
    const scenario = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'val', apiKeyIn: 'header' },
    });
    expect(buildUrl(scenario)).toBe('http://example.com/api');
  });

  it('preserves existing query parameters', () => {
    const scenario = makeScenario({
      url: 'http://example.com/api?existing=1',
      auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'query' },
    });
    const url = buildUrl(scenario);
    expect(url).toContain('existing=1');
    expect(url).toContain('key=val');
  });
});

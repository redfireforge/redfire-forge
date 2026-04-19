import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario, TestConfig } from '../types';
import { buildHeaders, buildUrl, runTest } from './executor';

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' }),
}));

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1', name: 'Test', url: 'https://example.com/api',
    method: 'POST', headers: [], body: '{}',
    auth: { type: 'none' }, validation: { mode: 'none' },
    ...overrides,
  };
}

describe('buildHeaders', () => {
  it('includes user headers', () => {
    const s = makeScenario({ headers: [{ key: 'X-Custom', value: 'val' }] });
    const h = buildHeaders(s);
    expect(h['X-Custom']).toBe('val');
  });

  it('skips empty key headers', () => {
    const s = makeScenario({ headers: [{ key: '', value: 'x' }, { key: 'Valid', value: 'y' }] });
    const h = buildHeaders(s);
    expect(Object.keys(h)).not.toContain('');
    expect(h['Valid']).toBe('y');
  });

  it('skips Authorization header when auth type is not none', () => {
    const s = makeScenario({
      headers: [{ key: 'Authorization', value: 'Bearer old' }],
      auth: { type: 'bearer', token: 'new', prefix: 'Bearer' },
    });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe('Bearer new');
  });

  it('keeps Authorization header when auth type is none', () => {
    const s = makeScenario({
      headers: [{ key: 'Authorization', value: 'Bearer manual' }],
      auth: { type: 'none' },
    });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe('Bearer manual');
  });

  it('sets Basic auth header', () => {
    const s = makeScenario({ auth: { type: 'basic', username: 'user', password: 'pass' } });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe(`Basic ${btoa('user:pass')}`);
  });

  it('sets Bearer auth header', () => {
    const s = makeScenario({ auth: { type: 'bearer', token: 'tok123', prefix: 'Bearer' } });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe('Bearer tok123');
  });

  it('uses custom bearer prefix', () => {
    const s = makeScenario({ auth: { type: 'bearer', token: 'tok', prefix: 'Token' } });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe('Token tok');
  });

  it('defaults to Bearer prefix when none specified', () => {
    const s = makeScenario({ auth: { type: 'bearer', token: 'tok' } });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe('Bearer tok');
  });

  it('sets API Key in header', () => {
    const s = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'X-Api-Key', apiKeyValue: 'key123', apiKeyIn: 'header' },
    });
    const h = buildHeaders(s);
    expect(h['X-Api-Key']).toBe('key123');
  });

  it('does not set API Key in header when apiKeyIn is query', () => {
    const s = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'X-Api-Key', apiKeyValue: 'key123', apiKeyIn: 'query' },
    });
    const h = buildHeaders(s);
    expect(h['X-Api-Key']).toBeUndefined();
  });

  it('sets Digest auth as Basic encoding', () => {
    const s = makeScenario({ auth: { type: 'digest', username: 'u', password: 'p' } });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe(`Basic ${btoa('u:p')}`);
  });

  it('sets OAuth2 Bearer token from provided token', () => {
    const s = makeScenario({ auth: { type: 'oauth2', tokenUrl: 'https://auth.com/token', clientId: 'c', clientSecret: 's' } });
    const h = buildHeaders(s, 'oauth-token-123');
    expect(h['Authorization']).toBe('Bearer oauth-token-123');
  });

  it('sets content type from argument', () => {
    const s = makeScenario({ body: '{}', bodyType: 'json' });
    const h = buildHeaders(s, undefined, 'application/json');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('does not overwrite existing Content-Type header for non-form-data', () => {
    const s = makeScenario({
      headers: [{ key: 'Content-Type', value: 'text/plain' }],
      body: '{}', bodyType: 'json',
    });
    const h = buildHeaders(s, undefined, 'application/json');
    expect(h['Content-Type']).toBe('text/plain');
  });

  it('overwrites Content-Type for form-data', () => {
    const s = makeScenario({
      headers: [{ key: 'Content-Type', value: 'old' }],
      body: 'data', bodyType: 'form-data',
    });
    const h = buildHeaders(s, undefined, 'multipart/form-data; boundary=xxx');
    expect(h['Content-Type']).toBe('multipart/form-data; boundary=xxx');
  });

  it('handles basic auth with no password', () => {
    const s = makeScenario({ auth: { type: 'basic', username: 'user' } });
    const h = buildHeaders(s);
    expect(h['Authorization']).toBe(`Basic ${btoa('user:')}`);
  });
});

describe('buildUrl', () => {
  it('returns url as-is for non-apikey auth', () => {
    const s = makeScenario({ auth: { type: 'none' } });
    expect(buildUrl(s)).toBe('https://example.com/api');
  });

  it('appends API key as query param', () => {
    const s = makeScenario({
      url: 'https://example.com/api',
      auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'query' },
    });
    const result = buildUrl(s);
    expect(result).toContain('key=val');
  });

  it('does not add query param when apiKeyIn is header', () => {
    const s = makeScenario({
      url: 'https://example.com/api',
      auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'header' },
    });
    expect(buildUrl(s)).toBe('https://example.com/api');
  });

  it('preserves existing query params', () => {
    const s = makeScenario({
      url: 'https://example.com/api?existing=1',
      auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'query' },
    });
    const result = buildUrl(s);
    expect(result).toContain('existing=1');
    expect(result).toContain('key=val');
  });
});

describe('runTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
    return {
      concurrency: 1,
      totalTransactions: 2,
      scenarioWeights: [{ scenarioId: 's1', weight: 1 }],
      executionMode: 'sequential',
      ...overrides,
    };
  }

  it('runs test with sequential mode', async () => {
    const s = makeScenario();
    const config = makeConfig();
    const onProgress = vi.fn();
    const results = await runTest(config, [s], onProgress);
    expect(results.length).toBe(2);
    expect(onProgress).toHaveBeenCalled();
  });

  it('runs test with batch mode', async () => {
    const s = makeScenario();
    const config = makeConfig({ executionMode: 'batch', concurrency: 2 });
    const results = await runTest(config, [s], vi.fn());
    expect(results.length).toBe(2);
  });

  it('runs test with pool mode', async () => {
    const s = makeScenario();
    const config = makeConfig({ executionMode: 'pool', concurrency: 2, totalTransactions: 3 });
    const results = await runTest(config, [s], vi.fn());
    expect(results.length).toBe(3);
  });

  it('distributes scenarios by weight', async () => {
    const s1 = makeScenario({ id: 's1', name: 'Scenario1' });
    const s2 = makeScenario({ id: 's2', name: 'Scenario2' });
    const config = makeConfig({
      totalTransactions: 10,
      scenarioWeights: [
        { scenarioId: 's1', weight: 7 },
        { scenarioId: 's2', weight: 3 },
      ],
    });
    const results = await runTest(config, [s1, s2], vi.fn());
    expect(results.length).toBe(10);
    const s1Count = results.filter(r => r.scenarioName === 'Scenario1').length;
    const s2Count = results.filter(r => r.scenarioName === 'Scenario2').length;
    expect(s1Count).toBeGreaterThan(0);
    expect(s2Count).toBeGreaterThan(0);
  });

  it('handles fewer transactions than scenarios', async () => {
    const s1 = makeScenario({ id: 's1' });
    const s2 = makeScenario({ id: 's2' });
    const s3 = makeScenario({ id: 's3' });
    const config = makeConfig({
      totalTransactions: 2,
      scenarioWeights: [
        { scenarioId: 's1', weight: 3 },
        { scenarioId: 's2', weight: 2 },
        { scenarioId: 's3', weight: 1 },
      ],
    });
    const results = await runTest(config, [s1, s2, s3], vi.fn());
    expect(results.length).toBe(2);
  });

  it('applies timeout config', async () => {
    const s = makeScenario();
    const config = makeConfig({ timeoutSec: 5 });
    const results = await runTest(config, [s], vi.fn());
    expect(results.length).toBe(2);
  });

  it('skips zero-weight scenarios', async () => {
    const s1 = makeScenario({ id: 's1', name: 'Active' });
    const s2 = makeScenario({ id: 's2', name: 'Inactive' });
    const config = makeConfig({
      totalTransactions: 3,
      scenarioWeights: [
        { scenarioId: 's1', weight: 1 },
        { scenarioId: 's2', weight: 0 },
      ],
    });
    const results = await runTest(config, [s1, s2], vi.fn());
    expect(results.every(r => r.scenarioName === 'Active')).toBe(true);
  });
});

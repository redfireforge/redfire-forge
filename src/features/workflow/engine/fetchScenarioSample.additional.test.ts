import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario } from '../../../shared/types';
import { fetchScenarioSample } from './fetchScenarioSample';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const mockGetToken = vi.fn();

vi.mock('../../../engine/tokenManager', () => ({
  TokenManager: class MockTokenManager {
    getToken = mockGetToken;
  },
}));

import { httpFetch } from '../../../shared/utils/httpClient';

const mockFetch = vi.mocked(httpFetch);

function buildScenario(partial: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test',
    name: 'Test',
    url: 'https://example.com/api',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...partial,
  };
}

describe('fetchScenarioSample - Additional Coverage', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockGetToken.mockClear();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"data": "value"}',
    });
    mockGetToken.mockResolvedValue(undefined);
  });

  it('applies host override with invalid URL format - falls back to original URL', async () => {
    const scenario = buildScenario({ url: 'not-a-valid-url' });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: true, fetchHostOverride: 'https://override.com' }
    );

    // Should get error because the original URL is still invalid
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('absolute URL');
  });

  it('handles tokenManager.getToken throwing an Error', async () => {
    const scenario = buildScenario({
      auth: {
        type: 'oauth2',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client123',
        clientSecret: 'secret123',
      },
    });

    mockGetToken.mockRejectedValueOnce(new Error('Token fetch failed'));

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe('Token fetch failed');
  });

  it('handles tokenManager.getToken throwing a non-Error value', async () => {
    const scenario = buildScenario({
      auth: {
        type: 'oauth2',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client123',
        clientSecret: 'secret123',
      },
    });

    mockGetToken.mockRejectedValueOnce('String error message');

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe('String error message');
  });

  it('applies host override with malformed override URL - skips override', async () => {
    const scenario = buildScenario({ url: 'https://original.com/api' });

    mockFetch.mockImplementation(async (url) => {
      expect(String(url)).toContain('original.com'); // Should keep original
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
      };
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: true, fetchHostOverride: 'not-a-valid-url' }
    );

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles host override with valid override containing path - extracts protocol and host', async () => {
    const scenario = buildScenario({ url: 'https://original.com:8080/api/test' });

    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      expect(urlStr).toContain('override.com');
      expect(urlStr).toContain('/api/test'); // Path preserved
      expect(urlStr).not.toContain(':8080'); // Port from override
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
      };
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: true, fetchHostOverride: 'https://override.com:9000/' }
    );

    expect(result.ok).toBe(true);
  });

  it('validates OAuth2 missing tokenUrl', async () => {
    const scenario = buildScenario({
      auth: {
        type: 'oauth2',
        clientId: 'client123',
        clientSecret: 'secret123',
      },
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('tokenUrl');
  });

  it('validates OAuth2 missing clientId', async () => {
    const scenario = buildScenario({
      auth: {
        type: 'oauth2',
        tokenUrl: 'https://auth.example.com/token',
        clientSecret: 'secret123',
      },
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('clientId');
  });

  it('validates OAuth2 missing clientSecret', async () => {
    const scenario = buildScenario({
      auth: {
        type: 'oauth2',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client123',
      },
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('clientSecret');
  });

  it('validates OAuth2 with all fields empty strings', async () => {
    const scenario = buildScenario({
      auth: {
        type: 'oauth2',
        tokenUrl: '  ',
        clientId: '  ',
        clientSecret: '  ',
      },
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('OAuth2 is missing');
  });

  it('handles empty fetchHostOverride gracefully', async () => {
    const scenario = buildScenario({ url: 'https://original.com/api' });

    mockFetch.mockImplementation(async (url) => {
      expect(String(url)).toContain('original.com');
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
      };
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: true, fetchHostOverride: '   ' }
    );

    expect(result.ok).toBe(true);
  });

  it('handles HTTP 400+ with empty body (no snippet)', async () => {
    const scenario = buildScenario({ url: 'https://api.example.com/test' });

    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      body: '',
    });

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe('HTTP 500: Internal Server Error');
  });

  it('handles httpFetch throwing a non-Error value', async () => {
    const scenario = buildScenario({ url: 'https://api.example.com/test' });

    mockFetch.mockRejectedValueOnce('network failure string');

    const result = await fetchScenarioSample(
      scenario,
      {},
      '',
      { fetchHostEnabled: false, fetchHostOverride: '' }
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe('network failure string');
  });
});

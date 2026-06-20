import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scenario } from '../../../shared/types';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../engine/tokenManager', () => {
  const getToken = vi.fn().mockResolvedValue(undefined);
  return {
    TokenManager: class {
      getToken = getToken;
    },
  };
});

import { httpFetch } from '../../../shared/utils/httpClient';
import { fetchScenarioSample } from './fetchScenarioSample';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const mockedFetch = vi.mocked(httpFetch);

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario =>
  _makeScenario({
    id: 's1',
    name: 'Test',
    url: '/api/test',
    validation: { mode: 'none' as const, expectedFields: [], excludedPaths: [], assertions: [] },
    ...overrides,
  }) as Scenario;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchScenarioSample', () => {
  it('returns ok:true with pretty-printed body on 200', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      body: '{"key":"value"}', headers: {}, timing: undefined,
    });
    const result = await fetchScenarioSample(
      makeScenario({ url: 'https://example.com/api' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toContain('"key": "value"');
      expect(result.rawBody).toBe('{"key":"value"}');
      expect(result.httpStatus).toBe(200);
    }
  });

  it('returns ok:false when URL is empty', async () => {
    const result = await fetchScenarioSample(
      makeScenario({ url: '' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('URL is required');
  });

  it('returns ok:false when URL is not absolute', async () => {
    const result = await fetchScenarioSample(
      makeScenario({ url: '/relative/path' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('absolute URL');
  });

  it('applies host override when enabled', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      body: '{}', headers: {}, timing: undefined,
    });
    await fetchScenarioSample(
      makeScenario({ url: 'https://original.com/api/test' }),
      {}, '', { fetchHostEnabled: true, fetchHostOverride: 'https://override.com' },
    );
    expect(mockedFetch).toHaveBeenCalled();
    const calledUrl = mockedFetch.mock.calls[0][0];
    expect(calledUrl).toContain('override.com');
  });

  it('does not apply host override when disabled', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      body: '{}', headers: {}, timing: undefined,
    });
    await fetchScenarioSample(
      makeScenario({ url: 'https://original.com/api/test' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: 'https://override.com' },
    );
    const calledUrl = mockedFetch.mock.calls[0][0];
    expect(calledUrl).toContain('original.com');
  });

  it('returns ok:false on HTTP >= 400', async () => {
    mockedFetch.mockResolvedValue({
      status: 404, statusText: 'Not Found',
      body: 'Not found', headers: {}, timing: undefined,
    });
    const result = await fetchScenarioSample(
      makeScenario({ url: 'https://example.com/api' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('HTTP 404');
      expect(result.body).toBe('Not found');
      expect(result.rawBody).toBe('Not found');
    }
  });

  it('returns ok:false on fetch error', async () => {
    mockedFetch.mockResolvedValue({
      status: 0, statusText: '',
      body: '', headers: {}, error: 'Network error', timing: undefined,
    });
    const result = await fetchScenarioSample(
      makeScenario({ url: 'https://example.com/api' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Network error');
  });

  it('returns ok:false on thrown exception', async () => {
    mockedFetch.mockRejectedValue(new Error('connection refused'));
    const result = await fetchScenarioSample(
      makeScenario({ url: 'https://example.com/api' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('connection refused');
  });

  it('uses resolvedBaseUrl when provided', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      body: '{}', headers: {}, timing: undefined,
    });
    await fetchScenarioSample(
      makeScenario({ url: '/api/test' }),
      {}, 'https://base.example.com', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(mockedFetch).toHaveBeenCalled();
    const calledUrl = mockedFetch.mock.calls[0][0];
    expect(calledUrl).toContain('base.example.com');
  });

  it('returns ok:false when OAuth2 is misconfigured', async () => {
    const result = await fetchScenarioSample(
      makeScenario({
        url: 'https://example.com/api',
        auth: { type: 'oauth2' as const, tokenUrl: '', clientId: '', clientSecret: '' },
      }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('OAuth2 is missing');
      expect(result.error).toContain('tokenUrl');
    }
  });

  it('passes through non-JSON body as-is', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      body: '<html>hello</html>', headers: {}, timing: undefined,
    });
    const result = await fetchScenarioSample(
      makeScenario({ url: 'https://example.com/api' }),
      {}, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toBe('<html>hello</html>');
  });

  it('resolves variables in URL from liveVariables', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      body: '{}', headers: {}, timing: undefined,
    });
    await fetchScenarioSample(
      makeScenario({ url: 'https://example.com/{{path}}' }),
      { path: 'users' }, '', { fetchHostEnabled: false, fetchHostOverride: '' },
    );
    const calledUrl = mockedFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/users');
    expect(calledUrl).not.toContain('{{');
  });

  it('handles host override with trailing slash', async () => {
    mockedFetch.mockResolvedValue({
      status: 200, statusText: 'OK',
      body: '{}', headers: {}, timing: undefined,
    });
    await fetchScenarioSample(
      makeScenario({ url: 'https://original.com/api/test' }),
      {}, '', { fetchHostEnabled: true, fetchHostOverride: 'https://override.com/' },
    );
    const calledUrl = mockedFetch.mock.calls[0][0];
    expect(calledUrl).toContain('override.com');
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestFetch } from './useTestFetch';
import type { Scenario, FeatureGroup, GlobalAuthProfile } from '@shared/types';

const mockProxyFetch = vi.fn();
vi.mock('../../../engine/executor', () => ({
  proxyFetch: (...args: unknown[]) => mockProxyFetch(...args),
}));

vi.mock('../../../engine/tokenManager', () => ({
  acquireOAuth2Token: vi.fn().mockResolvedValue('mocked-token'),
}));

const validateMock = vi.hoisted(() => vi.fn(() => []));
const evaluateAssertionsMock = vi.hoisted(() => vi.fn(() => ({ failures: [] as { path: string }[] })));
vi.mock('../../../engine/validator', () => ({
  validate: validateMock,
  evaluateAssertions: evaluateAssertionsMock,
}));

vi.mock('../../../shared/utils/authHeaders', () => ({
  resolveAuthHeaders: vi.fn(() => ({})),
}));

const serializeWithContentTypeMock = vi.hoisted(() => vi.fn((draft: { body?: string }) => ({ body: draft.body || undefined, contentType: 'application/json' })));
const getEffectiveBodyTypeMock = vi.hoisted(() => vi.fn(() => 'json'));

vi.mock('../../../shared/utils/bodySerializer', () => ({
  serializeWithContentType: serializeWithContentTypeMock,
  getEffectiveBodyType: getEffectiveBodyTypeMock,
}));

const jsonEqualMock = vi.hoisted(() => vi.fn(() => false));
vi.mock('../utils/testEditorUtils', () => ({
  jsonEqual: jsonEqualMock,
}));

function createDraft(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test-1',
    name: 'Test',
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

function createOptions(draftOverrides: Partial<Scenario> = {}) {
  const draft = createDraft(draftOverrides);
  const draftRef = { current: draft };
  return {
    draftRef,
    onDraftChange: vi.fn(),
    featureGroups: [] as FeatureGroup[],
    editingFgId: 'fg-1',
    editingScenarioId: 'sc-1',
    editingTestId: 'test-1',
    allAuthProfiles: [] as GlobalAuthProfile[],
    draftId: 'draft-1',
  };
}

describe('useTestFetch hook', () => {

  beforeEach(() => {
    resetAllMocks();
    jsonEqualMock.mockReturnValue(false);
    validateMock.mockReturnValue([]);
    evaluateAssertionsMock.mockReturnValue({ failures: [] });
    serializeWithContentTypeMock.mockImplementation((draft: { body?: string }) => ({ body: draft.body || undefined, contentType: 'application/json' }));
    getEffectiveBodyTypeMock.mockReturnValue('json');
    mockProxyFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      body: '{"users": [{"id": 1}]}',
    });
  });

  describe('initial state', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));
      expect(result.current.fetchingResponse).toBe(false);
      expect(result.current.fetchError).toBeNull();
      expect(result.current.fetchHostOverride).toBe('');
      expect(result.current.fetchHostEnabled).toBe(false);
      expect(result.current.validating).toBe(false);
      expect(result.current.validationResult).toBeNull();
      expect(result.current.pendingFetchResponse).toBeNull();
    });

    it('initializes fetchHostOverride from draft', () => {
      const { result } = renderHook(() =>
        useTestFetch(createOptions({ fetchHostOverride: 'https://staging.api.com', fetchHostEnabled: true }))
      );
      expect(result.current.fetchHostOverride).toBe('https://staging.api.com');
      expect(result.current.fetchHostEnabled).toBe(true);
    });
  });

  describe('resolveEffectiveAuth', () => {
    it('returns none when no auth configured', () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));
      const auth = result.current.resolveEffectiveAuth();
      expect(auth.auth.type).toBe('none');
      expect(auth.source).toBe('none');
    });

    it('returns test auth when configured directly', () => {
      const options = createOptions({ auth: { type: 'bearer', token: 'abc' } });
      const { result } = renderHook(() => useTestFetch(options));
      const auth = result.current.resolveEffectiveAuth();
      expect(auth.auth.type).toBe('bearer');
      expect(auth.source).toBe('test');
    });
  });

  describe('applyFetchUrlOverrides', () => {
    it('returns original URL when host override disabled', () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));
      const url = result.current.applyFetchUrlOverrides('https://api.example.com/users', { type: 'none' });
      expect(url).toBe('https://api.example.com/users');
    });

    it('replaces host when override enabled', () => {
      const options = createOptions({ fetchHostOverride: 'https://staging.api.com', fetchHostEnabled: true });
      const { result } = renderHook(() => useTestFetch(options));
      
      act(() => {
        result.current.setFetchHostEnabled(true);
        result.current.setFetchHostOverride('https://staging.api.com');
      });

      const url = result.current.applyFetchUrlOverrides('https://api.example.com/users', { type: 'none' });
      expect(url).toContain('staging.api.com');
    });

    it('adds apikey to query when apiKeyIn is query', () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));
      const url = result.current.applyFetchUrlOverrides(
        'https://api.example.com/users',
        { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'secret', apiKeyIn: 'query' }
      );
      expect(url).toContain('key=secret');
    });

    it('uses fetch host override base without trailing slash', () => {
      const options = createOptions({ fetchHostOverride: 'https://staging.example.com', fetchHostEnabled: true });
      const { result } = renderHook(() => useTestFetch(options));
      const url = result.current.applyFetchUrlOverrides('https://api.example.com/path?q=1', { type: 'none' });
      expect(url.startsWith('https://staging.example.com/path')).toBe(true);
    });

    it('returns original URL when apikey query injection URL is invalid', () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));
      const bad = 'not-a-valid-url';
      const url = result.current.applyFetchUrlOverrides(bad, {
        type: 'apikey',
        apiKeyName: 'k',
        apiKeyValue: 'v',
        apiKeyIn: 'query',
      });
      expect(url).toBe(bad);
    });
  });

  describe('handleFetchSampleResponse', () => {
    it('sets fetchError for empty URL', async () => {
      const options = createOptions({ url: '' });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError?.message).toBe('URL is required');
    });

    it('fetches and stores response', async () => {
      const onDraftChange = vi.fn();
      const options = createOptions();
      options.onDraftChange = onDraftChange;
      
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(mockProxyFetch).toHaveBeenCalled();
      expect(result.current.fetchError).toBeNull();
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('sets fetchError on network error', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 0,
        statusText: '',
        body: '',
        error: 'Connection refused',
      });

      const { result } = renderHook(() => useTestFetch(createOptions()));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError?.message).toBe('Connection refused');
    });

    it('sets fetchError on HTTP error', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        body: '{"error":"Server Error"}',
      });

      const onDraftChange = vi.fn();
      const { result } = renderHook(() => useTestFetch({ ...createOptions(), onDraftChange }));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError?.message).toBe('HTTP 500: Internal Server Error');
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('sets fetchError on exception', async () => {
      mockProxyFetch.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useTestFetch(createOptions()));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError?.message).toBe('Network timeout');
    });

    it('sets pendingFetchResponse when existing rules present', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
          sampleJson: '{"old":"data"}',
        },
      });

      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.pendingFetchResponse).not.toBeNull();
    });

    it('sets pendingFetchResponse when sample response already exists (no rules)', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [],
          sampleJson: '{"old":"data"}',
        },
      });

      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.pendingFetchResponse).not.toBeNull();
    });

    it('sets fetchError when OAuth2 credentials are incomplete on sample fetch', async () => {
      const options = createOptions({
        auth: {
          type: 'oauth2',
          tokenUrl: '',
          clientId: 'a',
          clientSecret: 'b',
          grantType: 'client_credentials',
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError?.message).toMatch(/OAuth2 missing/i);
      expect(result.current.fetchingResponse).toBe(false);
    });

    it('fetches sample with bearer auth via buildAuthedRequest', async () => {
      const options = createOptions({ auth: { type: 'bearer', token: 'z' } });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(mockProxyFetch).toHaveBeenCalled();
      expect(result.current.fetchError).toBeNull();
    });

    it('skips empty header keys when building request for sample fetch', async () => {
      const options = createOptions({
        headers: [
          { key: '', value: 'ignored' },
          { key: ' ', value: 'ignored2' },
          { key: 'X-Ok', value: 'yes' },
        ],
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      const [, , headersInit] = mockProxyFetch.mock.calls[0];
      expect((headersInit as Record<string, string>)['X-Ok']).toBe('yes');
      expect(Object.keys(headersInit as object)).not.toContain('');
    });

    it('sets multipart content type when body is form-data', async () => {
      getEffectiveBodyTypeMock.mockReturnValue('form-data');
      serializeWithContentTypeMock.mockReturnValue({ body: 'parts', contentType: 'multipart/form-data; boundary=abc' });
      const options = createOptions({ method: 'POST', body: 'x' });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      const [, , headersInit] = mockProxyFetch.mock.calls[0];
      expect((headersInit as Record<string, string>)['Content-Type']).toContain('multipart/form-data');
    });

    it('fetches sample when OAuth2 is fully configured', async () => {
      const options = createOptions({
        auth: {
          type: 'oauth2',
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'id',
          clientSecret: 'sec',
          grantType: 'client_credentials',
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError).toBeNull();
      expect(mockProxyFetch).toHaveBeenCalled();
    });

    it('does not append response version when JSON equals latest snapshot', async () => {
      jsonEqualMock.mockReturnValue(true);
      const body = '{"users":[{"id":1}]}';
      const sampleJsonPretty = JSON.stringify(JSON.parse(body), null, 2);
      const options = createOptions({
        validation: {
          mode: 'full',
          expectedFields: [],
          responseVersions: [{
            id: 'v1',
            timestamp: 1,
            json: sampleJsonPretty,
            validationMode: 'full',
            selectiveMode: 'include',
            expectedFields: [],
            excludedPaths: [],
          }],
          sampleJson: '',
        },
      });
      options.onDraftChange = vi.fn();
      mockProxyFetch.mockResolvedValue({ status: 200, statusText: 'OK', body });

      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      const last = options.onDraftChange.mock.calls.at(-1)?.[0] as Scenario;
      expect(last.validation.responseVersions?.length).toBe(1);
    });
  });

  describe('fetchSampleDataForMapper', () => {
    it('parses non-JSON response body as string', async () => {
      mockProxyFetch.mockResolvedValue({ status: 200, statusText: 'OK', body: 'plain-text' });
      const { result } = renderHook(() => useTestFetch(createOptions()));

      await act(async () => {
        const data = await result.current.fetchSampleDataForMapper();
        expect(data).toBe('plain-text');
      });
    });

    it('throws when URL is empty', async () => {
      const options = createOptions({ url: '   ' });
      const { result } = renderHook(() => useTestFetch(options));

      await expect(act(async () => result.current.fetchSampleDataForMapper())).rejects.toThrow('URL is required');
    });

    it('throws on OAuth2 configuration error', async () => {
      const options = createOptions({
        auth: {
          type: 'oauth2',
          tokenUrl: '',
          clientId: 'a',
          clientSecret: 'b',
          grantType: 'client_credentials',
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await expect(act(async () => result.current.fetchSampleDataForMapper())).rejects.toThrow(/OAuth2 missing/i);
    });

    it('throws on proxy transport error', async () => {
      mockProxyFetch.mockResolvedValue({ status: 0, statusText: '', body: '', error: 'boom' });
      const { result } = renderHook(() => useTestFetch(createOptions()));

      await expect(act(async () => result.current.fetchSampleDataForMapper())).rejects.toThrow('boom');
    });

    it('throws on HTTP error status', async () => {
      mockProxyFetch.mockResolvedValue({ status: 503, statusText: 'Service Unavailable', body: '{}' });
      const { result } = renderHook(() => useTestFetch(createOptions()));

      await expect(act(async () => result.current.fetchSampleDataForMapper())).rejects.toThrow(/HTTP 503/);
    });
  });
  describe('handleValidateResponse', () => {
    it('validates response against rules', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(mockProxyFetch).toHaveBeenCalled();
      expect(result.current.validationResult).not.toBeNull();
    });

    it('fails with empty URL', async () => {
      const options = createOptions({
        url: '',
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(url)');
    });

    it('fails when no rules configured', async () => {
      const options = createOptions({
        validation: { mode: 'selective', expectedFields: [] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(config)');
    });

    it('fails with mode none', async () => {
      const options = createOptions({
        validation: { mode: 'none' },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
    });

    it('fails assertions scope when no assertions configured', async () => {
      const options = createOptions({
        validation: { mode: 'none', assertions: [] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse('assertions');
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(config)');
    });

    it('runs assertion evaluation for assertions-only scope', async () => {
      evaluateAssertionsMock.mockReturnValue({
        failures: [{ path: '$.status', expected: '200', actual: '500' }],
      });
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{}',
        headers: { 'X-Test': 'ok', 'X-Multi': ['a', 'b'] },
      });
      const options = createOptions({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse('assertions');
      });

      expect(evaluateAssertionsMock).toHaveBeenCalled();
      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.verifyScope).toBe('assertions');
      expect(result.current.validationResult?.failures.some((f) => f.path === '$.status')).toBe(true);
    });

    it('aggregates rule failures and assertion failures for scope all', async () => {
      validateMock.mockReturnValue([{ path: '$.rule', expected: 'r', actual: 'x' }] as never);
      evaluateAssertionsMock.mockReturnValue({
        failures: [{ path: '$.assert', expected: 'a', actual: 'b' }],
      });
      const options = createOptions({
        validation: {
          mode: 'full',
          expectedFields: [{ path: '$.rule', op: 'exists' }],
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse('all');
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures.length).toBeGreaterThanOrEqual(2);
    });

    it('fails rules-only scope when validation mode is none', async () => {
      const options = createOptions({
        validation: {
          mode: 'none',
          expectedFields: [{ path: '$.id', op: 'exists' }],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse('rules');
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(mockProxyFetch).not.toHaveBeenCalled();
    });

    it('fails validation when rules scope requested but only assertions exist', async () => {
      const options = createOptions({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse('rules');
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(config)');
    });

    it('fails validation when assertions scope requested but only rules exist', async () => {
      const options = createOptions({
        validation: {
          mode: 'full',
          expectedFields: [{ path: '$.id', op: 'exists' }],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse('assertions');
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(config)');
    });

    it('fails validation when proxy returns HTTP error', async () => {
      mockProxyFetch.mockResolvedValue({ status: 400, statusText: 'Bad Request', body: '{}' });
      const options = createOptions({
        validation: { mode: 'full', expectedFields: [{ path: '$.id', op: 'exists' }] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.httpStatus).toBe(400);
    });

    it('fails validation on transport error from proxy', async () => {
      mockProxyFetch.mockResolvedValue({ status: 0, statusText: '', body: '', error: 'offline' });
      const options = createOptions({
        validation: { mode: 'full', expectedFields: [{ path: '$.id', op: 'exists' }] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(network)');
    });

    it('reports assertion failures from validate()', async () => {
      validateMock.mockReturnValue([{ path: '$.x', expected: '1', actual: '2' }] as never);
      const options = createOptions({
        validation: { mode: 'full', expectedFields: [{ path: '$.x', op: 'exists' }] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures).toHaveLength(1);
    });

    it('returns auth configuration error for incomplete OAuth2 when validating', async () => {
      const options = createOptions({
        auth: {
          type: 'oauth2',
          tokenUrl: '',
          clientId: 'a',
          clientSecret: 'b',
          grantType: 'client_credentials',
        },
        validation: { mode: 'full', expectedFields: [{ path: '$.id', op: 'exists' }] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(auth)');
    });

    it('surfaces exceptions during validate flow', async () => {
      mockProxyFetch.mockRejectedValue(new Error('proxy exploded'));
      const options = createOptions({
        validation: { mode: 'full', expectedFields: [{ path: '$.id', op: 'exists' }] },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleValidateResponse();
      });

      expect(result.current.validationResult?.passed).toBe(false);
      expect(result.current.validationResult?.failures[0].path).toBe('(error)');
    });
  });

});

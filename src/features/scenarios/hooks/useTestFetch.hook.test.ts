/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestFetch } from './useTestFetch';
import type { Scenario, FeatureGroup, GlobalAuthProfile } from '../../../shared/types';

const mockProxyFetch = vi.fn();
vi.mock('../../../engine/executor', () => ({
  proxyFetch: (...args: unknown[]) => mockProxyFetch(...args),
}));

vi.mock('../../../engine/tokenManager', () => ({
  acquireOAuth2Token: vi.fn().mockResolvedValue('mocked-token'),
}));

const validateMock = vi.hoisted(() => vi.fn(() => []));
vi.mock('../../../engine/validator', () => ({
  validate: validateMock,
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
    vi.clearAllMocks();
    jsonEqualMock.mockReturnValue(false);
    validateMock.mockReturnValue([]);
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

    it('returns original URL when fetch host override is malformed', () => {
      const options = createOptions({ fetchHostOverride: 'http://[::', fetchHostEnabled: true });
      const { result } = renderHook(() => useTestFetch(options));
      const url = result.current.applyFetchUrlOverrides('https://api.example.com/z', { type: 'none' });
      expect(url).toBe('https://api.example.com/z');
    });
  });

  describe('handleFetchSampleResponse', () => {
    it('sets fetchError for empty URL', async () => {
      const options = createOptions({ url: '' });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError).toBe('URL is required');
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

      expect(result.current.fetchError).toBe('Connection refused');
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

      expect(result.current.fetchError).toBe('HTTP 500: Internal Server Error');
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('sets fetchError on exception', async () => {
      mockProxyFetch.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useTestFetch(createOptions()));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      expect(result.current.fetchError).toBe('Network timeout');
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

      expect(result.current.fetchError).toMatch(/OAuth2 missing/i);
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

  describe('pending fetch response handlers', () => {
    it('handleFetchKeepRules clears pending and keeps rules', async () => {
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

      act(() => {
        result.current.handleFetchKeepRules();
      });

      expect(result.current.pendingFetchResponse).toBeNull();
      expect(options.onDraftChange).toHaveBeenCalled();
    });

    it('handleFetchReplaceAll clears pending and resets rules', async () => {
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

      act(() => {
        result.current.handleFetchReplaceAll();
      });

      expect(result.current.pendingFetchResponse).toBeNull();
      const call = options.onDraftChange.mock.calls[options.onDraftChange.mock.calls.length - 1][0];
      expect(call.validation.expectedFields).toEqual([]);
    });

    it('handleFetchKeepRules does not push response version when sampleJson is empty', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [{ path: '$.id', op: 'exists' }],
          sampleJson: '',
          responseVersions: [],
        },
      });
      options.onDraftChange = vi.fn();
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });
      act(() => {
        result.current.handleFetchKeepRules();
      });
      const last = options.onDraftChange.mock.calls.at(-1)?.[0] as Scenario;
      expect(last.validation.responseVersions?.length).toBe(0);
    });

    it('handleFetchReplaceAll does not append rulesVersions when draft has no rules', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [{ path: '$.id', op: 'exists' }],
          sampleJson: '{"old":true}',
          responseVersions: [],
          rulesVersions: [],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });
      expect(result.current.pendingFetchResponse).not.toBeNull();
      options.draftRef.current = {
        ...options.draftRef.current,
        validation: {
          ...options.draftRef.current.validation,
          expectedFields: [],
        },
      };
      act(() => {
        result.current.handleFetchReplaceAll();
      });
      const last = options.onDraftChange.mock.calls.at(-1)?.[0] as Scenario;
      expect(last.validation.rulesVersions?.length ?? 0).toBe(0);
    });

    it('handleFetchCancel clears pending without applying draft changes', async () => {
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

      const callCountBefore = options.onDraftChange.mock.calls.length;
      act(() => {
        result.current.handleFetchCancel();
      });

      expect(result.current.pendingFetchResponse).toBeNull();
      expect(options.onDraftChange.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('handleFetchRow', () => {
    it('fetches with auth applied', async () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));

      await act(async () => {
        const response = await result.current.handleFetchRow(
          'https://api.example.com/users/1',
          'GET',
          { Accept: 'application/json' },
        );
        expect(response.status).toBe(200);
        expect(response.sentHeaders).toBeDefined();
      });

      expect(mockProxyFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        'GET',
        expect.objectContaining({ Accept: 'application/json' }),
        undefined,
      );
    });

    it('applies OAuth2 token to handleFetchRow', async () => {
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
        await result.current.handleFetchRow('https://api.example.com/r', 'GET', { Accept: 'application/json' });
      });

      expect(mockProxyFetch).toHaveBeenCalled();
    });

    it('applies non-OAuth2 auth headers in handleFetchRow', async () => {
      const options = createOptions({ auth: { type: 'bearer', token: 'abc' } });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchRow('https://api.example.com/r', 'GET', {});
      });

      expect(mockProxyFetch).toHaveBeenCalled();
    });
  });

  describe('setFetchHostOverride and setFetchHostEnabled', () => {
    it('updates host override', () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));

      act(() => {
        result.current.setFetchHostOverride('https://staging.example.com');
      });

      expect(result.current.fetchHostOverride).toBe('https://staging.example.com');
    });

    it('updates host enabled flag', () => {
      const { result } = renderHook(() => useTestFetch(createOptions()));

      act(() => {
        result.current.setFetchHostEnabled(true);
      });

      expect(result.current.fetchHostEnabled).toBe(true);
    });
  });
});

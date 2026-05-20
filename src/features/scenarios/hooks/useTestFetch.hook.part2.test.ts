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
    vi.clearAllMocks();
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

    it('handleFetchKeepRules refreshes expected values from fetched response', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.users[0].id', expectedValue: '999' }],
          sampleJson: '{"users":[{"id":999}]}',
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

      const last = options.onDraftChange.mock.calls.at(-1)?.[0] as Scenario;
      expect(last.validation.expectedFields?.[0]?.jsonPath).toBe('$.users[0].id');
      expect(last.validation.expectedFields?.[0]?.expectedValue).toBe('1');
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

    it('handleFetchKeepRules preserves rules when pending JSON fails to parse', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: 'keep-me' }],
          sampleJson: '{"old":"data"}',
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      const spy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        throw new SyntaxError('forced');
      });

      act(() => {
        result.current.handleFetchKeepRules();
      });

      spy.mockRestore();

      const last = options.onDraftChange.mock.calls.at(-1)?.[0] as Scenario;
      expect(last.validation.expectedFields?.[0]?.expectedValue).toBe('keep-me');
    });

    it('handleFetchReplaceAll appends rulesVersions when rules existed before replace', async () => {
      const options = createOptions({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
          sampleJson: '{"old":"data"}',
          rulesVersions: [],
        },
      });
      const { result } = renderHook(() => useTestFetch(options));

      await act(async () => {
        await result.current.handleFetchSampleResponse();
      });

      act(() => {
        result.current.handleFetchReplaceAll();
      });

      const last = options.onDraftChange.mock.calls.at(-1)?.[0] as Scenario;
      expect(last.validation.rulesVersions?.length).toBe(1);
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

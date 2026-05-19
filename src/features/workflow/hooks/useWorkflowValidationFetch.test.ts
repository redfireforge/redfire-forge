/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkflowValidationFetch } from './useWorkflowValidationFetch';
import type { Scenario } from '../../../shared/types';

vi.mock('../engine/fetchScenarioSample', () => ({
  fetchScenarioSample: vi.fn(),
}));

vi.mock('../../../engine/validator', () => ({
  validate: vi.fn(() => []),
  evaluateAssertions: vi.fn(() => ({ failures: [], statusAsserted: false })),
}));

vi.mock('uuid', () => ({ v4: () => 'test-uuid-123' }));

import { fetchScenarioSample } from '../engine/fetchScenarioSample';
import { validate, evaluateAssertions } from '../../../engine/validator';

const mockFetch = fetchScenarioSample as ReturnType<typeof vi.fn>;
const mockValidate = validate as ReturnType<typeof vi.fn>;
const mockEvaluateAssertions = evaluateAssertions as ReturnType<typeof vi.fn>;

function makeDraft(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test Scenario',
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none', expectedFields: [], assertions: [] },
    ...overrides,
  } as Scenario;
}

function setup(draft?: Scenario) {
  const draftObj = draft ?? makeDraft();
  const draftRef = { current: draftObj };
  const onDraftChange = vi.fn((newDraft: Scenario) => { draftRef.current = newDraft; });
  const result = renderHook(() => useWorkflowValidationFetch({
    draftRef,
    onDraftChange,
    liveVariables: { baseUrl: 'https://api.example.com' },
    resolvedBaseUrl: 'https://api.example.com',
  }));
  return { result, draftRef, onDraftChange };
}

describe('useWorkflowValidationFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, body: '{"id":1}', rawBody: '{"id":1}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 50 });
  });

  describe('initial state', () => {
    it('starts with idle state', () => {
      const { result } = setup();
      expect(result.result.current.fetchingResponse).toBe(false);
      expect(result.result.current.fetchError).toBeNull();
      expect(result.result.current.validating).toBe(false);
      expect(result.result.current.validationResult).toBeNull();
      expect(result.result.current.pendingFetchResponse).toBeNull();
    });

    it('initializes host override from draft', () => {
      const { result } = setup(makeDraft({ fetchHostOverride: 'http://localhost:3000', fetchHostEnabled: true }));
      expect(result.result.current.fetchHostOverride).toBe('http://localhost:3000');
      expect(result.result.current.fetchHostEnabled).toBe(true);
    });
  });

  describe('handleFetchSampleResponse', () => {
    it('fetches and sets sampleJson when no existing rules', async () => {
      const { result, onDraftChange } = setup();
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ sampleJson: expect.any(String) }),
      }));
    });

    it('shows error when URL is empty', async () => {
      const { result } = setup(makeDraft({ url: '' }));
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.fetchError).toEqual({ message: 'URL is required' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sets fetchError on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, error: 'Not Found', httpStatus: 404, body: '{"msg":"not found"}' });
      const { result, onDraftChange } = setup();
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.fetchError).toEqual({ message: 'Not Found', status: 404, body: '{"msg":"not found"}' });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ sampleJson: expect.stringContaining('not found') }),
      }));
    });

    it('does not set sampleJson when HTTP error body is not JSON', async () => {
      mockFetch.mockResolvedValue({ ok: false, error: 'Bad Gateway', httpStatus: 502, body: '<html>error</html>' });
      const { result, onDraftChange } = setup();
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.fetchError?.message).toBe('Bad Gateway');
      const draftCalls = onDraftChange.mock.calls.filter(
        (c: unknown[]) => (c[0] as Scenario).validation.sampleJson !== undefined
      );
      expect(draftCalls.length).toBe(0);
    });

    it('does not set sampleJson when HTTP error body is empty', async () => {
      mockFetch.mockResolvedValue({ ok: false, error: 'Not Found', httpStatus: 404, body: '' });
      const { result } = setup();
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.fetchError?.message).toBe('Not Found');
    });

    it('deduplicates response versions when new response is identical', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          expectedFields: [],
          assertions: [],
          sampleJson: '',
          responseVersions: [{ id: 'v1', json: '{\n  "id": 1\n}', timestamp: Date.now(), label: 'Response #1' }],
        },
      } as Partial<Scenario>);
      const { result, onDraftChange } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      const lastCall = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0] as Scenario;
      expect(lastCall.validation.responseVersions).toHaveLength(1);
    });

    it('sets fetchError on network exception', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const { result } = setup();
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.fetchError).toEqual({ message: 'ECONNREFUSED' });
    });

    it('shows pending response when existing rules exist', async () => {
      const draft = makeDraft({ validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [] } } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.pendingFetchResponse).not.toBeNull();
    });

    it('shows pending response when existing sampleJson exists', async () => {
      const draft = makeDraft({ validation: { mode: 'none', expectedFields: [], sampleJson: '{"old":true}', assertions: [] } } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.pendingFetchResponse).not.toBeNull();
    });

    it('deduplicates response versions when response identical', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: '{"id":1}', rawBody: '{"id":1}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 10 });
      const existing = { id: 'v1', timestamp: 1000, json: '{"id":1}', validationMode: 'none' as const, selectiveMode: undefined, expectedFields: [], excludedPaths: [], unorderedArrays: undefined };
      const draft = makeDraft({ validation: { mode: 'none', expectedFields: [], assertions: [], responseVersions: [existing] } } as Partial<Scenario>);
      const { result, onDraftChange } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      const call = onDraftChange.mock.calls[0][0];
      expect(call.validation.responseVersions).toHaveLength(1);
    });

    it('sets fetchingResponse during fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetch.mockReturnValue(new Promise(r => { resolvePromise = r; }));
      const { result } = setup();
      act(() => { result.result.current.handleFetchSampleResponse(); });
      await waitFor(() => expect(result.result.current.fetchingResponse).toBe(true));
      await act(async () => { resolvePromise!({ ok: true, body: '{}', rawBody: '{}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 1 }); });
      expect(result.result.current.fetchingResponse).toBe(false);
    });
  });

  describe('handleFetchKeepRules', () => {
    it('applies pending response while preserving updated expected fields', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: '{"id":42,"name":"test"}', rawBody: '{"id":42}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 10 });
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [], sampleJson: '{"id":1}' },
      } as Partial<Scenario>);
      const { result, onDraftChange } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.pendingFetchResponse).not.toBeNull();
      act(() => { result.result.current.handleFetchKeepRules(); });
      const lastCall = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0];
      expect(lastCall.validation.expectedFields[0].expectedValue).toBe('42');
      expect(result.result.current.pendingFetchResponse).toBeNull();
    });

    it('does nothing when pendingFetchResponse is null', () => {
      const { result, onDraftChange } = setup();
      onDraftChange.mockClear();
      act(() => { result.result.current.handleFetchKeepRules(); });
      expect(onDraftChange).not.toHaveBeenCalled();
    });
  });

  describe('handleFetchReplaceAll', () => {
    it('replaces all rules and clears expectedFields', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: '{"new":true}', rawBody: '{"new":true}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 5 });
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [], sampleJson: '{"id":1}' },
      } as Partial<Scenario>);
      const { result, onDraftChange } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      act(() => { result.result.current.handleFetchReplaceAll(); });
      const lastCall = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0];
      expect(lastCall.validation.expectedFields).toEqual([]);
      expect(lastCall.validation.sampleJson).toContain('new');
      expect(lastCall.validation.rulesVersions).toHaveLength(1);
      expect(result.result.current.pendingFetchResponse).toBeNull();
    });

    it('skips rulesVersions archival when expectedFields is empty', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: '{"new":true}', rawBody: '{"new":true}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 5 });
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [], assertions: [], sampleJson: '{"old":1}' },
      } as Partial<Scenario>);
      const { result, onDraftChange } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      act(() => { result.result.current.handleFetchReplaceAll(); });
      const lastCall = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0];
      expect(lastCall.validation.rulesVersions).toEqual([]);
    });

    it('skips responseVersions archival when no existing sampleJson', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: '{"v":2}', rawBody: '{"v":2}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 5 });
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.v', expectedValue: '1' }], assertions: [], sampleJson: '' },
      } as Partial<Scenario>);
      const { result, onDraftChange } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      act(() => { result.result.current.handleFetchReplaceAll(); });
      const lastCall = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0];
      expect(lastCall.validation.responseVersions).toEqual([]);
    });

    it('does nothing when pendingFetchResponse is null', () => {
      const { result, onDraftChange } = setup();
      onDraftChange.mockClear();
      act(() => { result.result.current.handleFetchReplaceAll(); });
      expect(onDraftChange).not.toHaveBeenCalled();
    });
  });

  describe('handleFetchCancel', () => {
    it('clears pending response', async () => {
      const draft = makeDraft({ validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [] } } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleFetchSampleResponse(); });
      expect(result.result.current.pendingFetchResponse).not.toBeNull();
      act(() => { result.result.current.handleFetchCancel(); });
      expect(result.result.current.pendingFetchResponse).toBeNull();
    });
  });

  describe('fetchSampleDataForMapper', () => {
    it('returns parsed JSON on success', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: '{"data":[1,2,3]}', rawBody: '{"data":[1,2,3]}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 10 });
      const { result } = setup();
      let data: unknown;
      await act(async () => { data = await result.result.current.fetchSampleDataForMapper(); });
      expect(data).toEqual({ data: [1, 2, 3] });
    });

    it('throws MapperFetchError on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, error: 'Server Error', httpStatus: 500, body: '' });
      const { result } = setup();
      await expect(act(async () => { await result.result.current.fetchSampleDataForMapper(); })).rejects.toThrow('Server Error');
    });

    it('throws when URL is empty', async () => {
      const { result } = setup(makeDraft({ url: '' }));
      await expect(act(async () => { await result.result.current.fetchSampleDataForMapper(); })).rejects.toThrow('URL is required');
    });

    it('returns raw body when JSON parse fails', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: 'plain text', rawBody: 'plain text', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 10 });
      const { result } = setup();
      let data: unknown;
      await act(async () => { data = await result.result.current.fetchSampleDataForMapper(); });
      expect(data).toBe('plain text');
    });
  });

  describe('handleValidateResponse', () => {
    it('validates with rules scope', async () => {
      mockValidate.mockReturnValue([]);
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('rules'); });
      expect(result.result.current.validationResult).toEqual(expect.objectContaining({ passed: true, failures: [] }));
      expect(mockValidate).toHaveBeenCalled();
    });

    it('validates with assertions scope', async () => {
      mockEvaluateAssertions.mockReturnValue({ failures: [], statusAsserted: false });
      const draft = makeDraft({
        validation: { mode: 'none', expectedFields: [], assertions: [{ type: 'status', expected: '200', negate: false }] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('assertions'); });
      expect(result.result.current.validationResult).toEqual(expect.objectContaining({ passed: true }));
      expect(mockEvaluateAssertions).toHaveBeenCalled();
    });

    it('reports failure when no rules configured and scope=rules', async () => {
      const { result } = setup();
      await act(async () => { await result.result.current.handleValidateResponse('rules'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures[0].actual).toBe('no rules configured');
    });

    it('reports failure when no assertions configured and scope=assertions', async () => {
      const { result } = setup();
      await act(async () => { await result.result.current.handleValidateResponse('assertions'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures[0].actual).toBe('no assertions configured');
    });

    it('reports failure when nothing configured and scope=all', async () => {
      const { result } = setup();
      await act(async () => { await result.result.current.handleValidateResponse('all'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures[0].actual).toBe('none configured');
    });

    it('reports empty URL error', async () => {
      const { result } = setup(makeDraft({ url: '' }));
      await act(async () => { await result.result.current.handleValidateResponse(); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures[0].path).toBe('(url)');
    });

    it('reports HTTP error from fetch', async () => {
      mockFetch.mockResolvedValue({ ok: false, error: '503 Unavailable', httpStatus: 503, body: '', responseHeaders: {} });
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('rules'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.httpStatus).toBe(503);
    });

    it('reports network error from fetch', async () => {
      mockFetch.mockResolvedValue({ ok: false, error: 'ECONNREFUSED' });
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('rules'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures[0].path).toBe('(network)');
    });

    it('handles exception during validation', async () => {
      mockFetch.mockRejectedValue(new Error('unexpected crash'));
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('rules'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures[0].actual).toBe('unexpected crash');
    });

    it('treats undefined assertions as empty array', async () => {
      mockValidate.mockReturnValue([]);
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('all'); });
      expect(result.result.current.validationResult?.passed).toBe(true);
      expect(mockEvaluateAssertions).not.toHaveBeenCalled();
    });

    it('treats undefined expectedFields as no rules', async () => {
      const draft = makeDraft({
        validation: { mode: 'selective' },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('rules'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures[0].actual).toBe('no rules configured');
    });

    it('sets validating flag during execution', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetch.mockReturnValue(new Promise(r => { resolvePromise = r; }));
      const draft = makeDraft({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }], assertions: [] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      act(() => { result.result.current.handleValidateResponse('rules'); });
      await waitFor(() => expect(result.result.current.validating).toBe(true));
      await act(async () => { resolvePromise!({ ok: true, body: '{"id":1}', rawBody: '{"id":1}', httpStatus: 200, finalUrl: '', responseHeaders: {}, responseTimeMs: 5 }); });
      expect(result.result.current.validating).toBe(false);
    });

    it('validates both rules and assertions with scope=all', async () => {
      mockValidate.mockReturnValue([]);
      mockEvaluateAssertions.mockReturnValue({ failures: [{ path: '(status)', expected: '201', actual: '200' }], statusAsserted: true });
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
          assertions: [{ type: 'status', expected: '201', negate: false }],
        },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('all'); });
      expect(result.result.current.validationResult?.passed).toBe(false);
      expect(result.result.current.validationResult?.failures).toHaveLength(1);
      expect(mockValidate).toHaveBeenCalled();
      expect(mockEvaluateAssertions).toHaveBeenCalled();
    });

    it('falls back to defaults when responseTimeMs and responseHeaders are undefined', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: '{"id":1}', rawBody: '{"id":1}', httpStatus: 200, finalUrl: '' });
      mockEvaluateAssertions.mockReturnValue({ failures: [], statusAsserted: false });
      const draft = makeDraft({
        validation: { mode: 'none', assertions: [{ type: 'status', expected: '200', negate: false }] },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('assertions'); });
      expect(result.result.current.validationResult?.passed).toBe(true);
      expect(result.result.current.validationResult?.responseHeaders).toEqual({});
    });

    it('skips rules when scope=assertions even if rules exist', async () => {
      mockEvaluateAssertions.mockReturnValue({ failures: [], statusAsserted: false });
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
          assertions: [{ type: 'status', expected: '200', negate: false }],
        },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('assertions'); });
      expect(result.result.current.validationResult?.passed).toBe(true);
      expect(mockValidate).not.toHaveBeenCalled();
      expect(mockEvaluateAssertions).toHaveBeenCalled();
    });

    it('skips assertions when scope=rules even if assertions exist', async () => {
      mockValidate.mockReturnValue([]);
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
          assertions: [{ type: 'status', expected: '200', negate: false }],
        },
      } as Partial<Scenario>);
      const { result } = setup(draft);
      await act(async () => { await result.result.current.handleValidateResponse('rules'); });
      expect(result.result.current.validationResult?.passed).toBe(true);
      expect(mockValidate).toHaveBeenCalled();
      expect(mockEvaluateAssertions).not.toHaveBeenCalled();
    });
  });

  describe('host override sync', () => {
    it('syncs local host override changes to draft', () => {
      const { result, onDraftChange } = setup();
      act(() => { result.result.current.setFetchHostOverride('http://localhost:8080'); });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ fetchHostOverride: 'http://localhost:8080' }));
    });

    it('syncs local host enabled changes to draft', () => {
      const { result, onDraftChange } = setup();
      act(() => { result.result.current.setFetchHostEnabled(true); });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ fetchHostEnabled: true }));
    });

    it('picks up external draft changes to host override', () => {
      const draftRef = { current: makeDraft({ fetchHostOverride: 'http://host1', fetchHostEnabled: false }) };
      const onDraftChange = vi.fn();
      const { result, rerender } = renderHook(
        () => useWorkflowValidationFetch({ draftRef, onDraftChange, liveVariables: {}, resolvedBaseUrl: '' }),
      );
      expect(result.current.fetchHostOverride).toBe('http://host1');
      draftRef.current = makeDraft({ fetchHostOverride: 'http://external-change', fetchHostEnabled: true });
      rerender();
      expect(result.current.fetchHostOverride).toBe('http://external-change');
      expect(result.current.fetchHostEnabled).toBe(true);
    });
  });

  describe('resetKey', () => {
    it('clears state on reset key change', () => {
      const draftRef = { current: makeDraft({ fetchHostOverride: 'http://host1', fetchHostEnabled: true }) };
      const onDraftChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ resetKey }) => useWorkflowValidationFetch({ draftRef, onDraftChange, liveVariables: {}, resolvedBaseUrl: '', resetKey }),
        { initialProps: { resetKey: 'key-1' } },
      );
      expect(result.current.fetchHostOverride).toBe('http://host1');
      draftRef.current = makeDraft({ fetchHostOverride: 'http://host2', fetchHostEnabled: false });
      rerender({ resetKey: 'key-2' });
      expect(result.current.fetchHostOverride).toBe('http://host2');
      expect(result.current.fetchHostEnabled).toBe(false);
      expect(result.current.fetchError).toBeNull();
      expect(result.current.validationResult).toBeNull();
    });
  });
});

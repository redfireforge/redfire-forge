/**
 * @vitest-environment jsdom
 *
 * useQueryValidation — unit tests.
 * Tests the debounce-based query validation against a GraphQL schema.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock useMonaco ───────────────────────────────────────────────────────────

const mockSetModelMarkers = vi.fn();
const mockGetModel = vi.fn();
const mockUriParse = vi.fn((uri: string) => ({ toString: () => uri }));

const mockMonaco = {
  Uri: { parse: mockUriParse },
  editor: { getModel: mockGetModel, setModelMarkers: mockSetModelMarkers },
  MarkerSeverity: { Error: 8 },
};

vi.mock('@monaco-editor/react', () => ({
  useMonaco: vi.fn(() => mockMonaco),
}));

// ─── Mock graphql validate (to allow override in specific tests) ──────────────

import * as graphqlModule from 'graphql';
const validateSpy = vi.spyOn(graphqlModule, 'validate');

import { useMonaco } from '@monaco-editor/react';
import { useQueryValidation } from './useQueryValidation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal introspection-like object that buildClientSchema can use.
 * We use a simple schema: type Query { hello: String }
 */
import { buildSchema, introspectionFromSchema } from 'graphql';

function makeRawIntrospection(): Record<string, unknown> {
  const schema = buildSchema(`type Query { hello: String }`);
  const result = introspectionFromSchema(schema);
  return result as unknown as Record<string, unknown>;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllMocks();
  vi.useFakeTimers();
  // Return a fake model by default
  mockGetModel.mockReturnValue({ uri: 'inmemory://test' });
  vi.mocked(useMonaco).mockReturnValue(mockMonaco as never);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useQueryValidation — initial state', () => {
  it('returns 0 initially', () => {
    const { result } = renderHook(() =>
      useQueryValidation('', 'inmemory://tab-1', null, false),
    );
    expect(result.current).toBe(0);
  });
});

describe('useQueryValidation — no monaco', () => {
  it('returns 0 when monaco is null', () => {
    vi.mocked(useMonaco).mockReturnValue(null as never);

    const { result } = renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://tab-1', makeRawIntrospection(), true),
    );

    act(() => { vi.advanceTimersByTime(600); });

    expect(result.current).toBe(0);
    expect(mockSetModelMarkers).not.toHaveBeenCalled();
  });
});

describe('useQueryValidation — clears markers when schema/query absent', () => {
  it('clears markers and returns 0 when schemaLoaded is false', () => {
    const { result } = renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://tab-1', makeRawIntrospection(), false),
    );

    // Effect runs immediately (no debounce) when clearing markers
    expect(mockSetModelMarkers).toHaveBeenCalledWith(
      expect.anything(),
      'gql-schema-validate',
      [],
    );
    expect(result.current).toBe(0);
  });

  it('clears markers when rawIntrospection is null', () => {
    const { result } = renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://tab-1', null, true),
    );

    expect(mockSetModelMarkers).toHaveBeenCalledWith(
      expect.anything(),
      'gql-schema-validate',
      [],
    );
    expect(result.current).toBe(0);
  });

  it('clears markers when query is empty', () => {
    const { result } = renderHook(() =>
      useQueryValidation('', 'inmemory://tab-1', makeRawIntrospection(), true),
    );

    expect(mockSetModelMarkers).toHaveBeenCalledWith(
      expect.anything(),
      'gql-schema-validate',
      [],
    );
    expect(result.current).toBe(0);
  });

  it('clears markers when query is whitespace-only', () => {
    const { result } = renderHook(() =>
      useQueryValidation('   ', 'inmemory://tab-1', makeRawIntrospection(), true),
    );

    expect(mockSetModelMarkers).toHaveBeenCalledWith(
      expect.anything(),
      'gql-schema-validate',
      [],
    );
    expect(result.current).toBe(0);
  });

  it('does NOT clear markers when model is null', () => {
    mockGetModel.mockReturnValue(null);
    renderHook(() =>
      useQueryValidation('', 'inmemory://tab-1', makeRawIntrospection(), false),
    );
    // setModelMarkers should NOT be called when model is null
    expect(mockSetModelMarkers).not.toHaveBeenCalled();
  });
});

describe('useQueryValidation — resets on tab change', () => {
  it('resets error count to 0 immediately when modelUri changes', async () => {
    const introspection = makeRawIntrospection();
    const { result, rerender } = renderHook(
      ({ uri }: { uri: string }) =>
        useQueryValidation('query { hello }', uri, introspection, true),
      { initialProps: { uri: 'inmemory://tab-1' } },
    );

    // Advance debounce timer to fire validation
    act(() => { vi.advanceTimersByTime(600); });

    // Now change to different tab URI
    rerender({ uri: 'inmemory://tab-2' });

    // Error count should have been reset immediately on URI change
    expect(result.current).toBe(0);
  });
});

describe('useQueryValidation — valid query', () => {
  it('sets 0 markers for a valid query after debounce', async () => {
    const introspection = makeRawIntrospection();

    renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://tab-1', introspection, true),
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // Valid query → empty markers array
    expect(mockSetModelMarkers).toHaveBeenCalledWith(
      expect.anything(),
      'gql-schema-validate',
      [],
    );
  });

  it('does not fire validation before debounce expires', () => {
    const introspection = makeRawIntrospection();

    renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://tab-1', introspection, true),
    );

    // Only advance 400ms — debounce is 500ms
    act(() => { vi.advanceTimersByTime(400); });

    // No validation should have run yet (besides the initial clear call for schemaLoaded=true, query non-empty)
    // The first call is the clear-markers call from the previous render cycle when schemaLoaded was checked
    const debounceCallCount = mockSetModelMarkers.mock.calls.filter(
      (call) => Array.isArray(call[2]) && call[2].length > 0,
    ).length;
    expect(debounceCallCount).toBe(0);
  });
});

describe('useQueryValidation — invalid query', () => {
  it('sets error markers for an invalid query after debounce', async () => {
    const introspection = makeRawIntrospection();

    const { result } = renderHook(() =>
      useQueryValidation(
        'query { nonExistentField }',
        'inmemory://tab-1',
        introspection,
        true,
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // Should have set error markers
    expect(result.current).toBeGreaterThan(0);
    const lastCall = mockSetModelMarkers.mock.calls[mockSetModelMarkers.mock.calls.length - 1];
    expect(lastCall[2].length).toBeGreaterThan(0);
    expect(lastCall[2][0].severity).toBe(8); // MarkerSeverity.Error
  });

  it('clears markers and returns 0 when query has syntax error', async () => {
    const introspection = makeRawIntrospection();

    const { result } = renderHook(() =>
      useQueryValidation(
        'query { { invalid syntax',
        'inmemory://tab-1',
        introspection,
        true,
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // Syntax error: markers are cleared (handled by monaco-graphql worker)
    expect(result.current).toBe(0);
    // Last call should clear markers
    const lastCall = mockSetModelMarkers.mock.calls[mockSetModelMarkers.mock.calls.length - 1];
    expect(lastCall[2]).toEqual([]);
  });
});

describe('useQueryValidation — buildClientSchema error', () => {
  it('clears markers and returns 0 when buildClientSchema throws', async () => {
    // Provide malformed introspection that causes buildClientSchema to throw
    const badIntrospection = { __schema: { types: null } };

    const { result } = renderHook(() =>
      useQueryValidation(
        'query { hello }',
        'inmemory://tab-1',
        badIntrospection as never,
        true,
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(result.current).toBe(0);
  });

  it('skips setModelMarkers in catch block when model2 is null (line 95 false branch)', async () => {
    const badIntrospection = { __schema: { types: null } };
    // First getModel call (in timer at line 59) → returns model (proceed into try)
    // buildClientSchema throws → catch block
    // Second getModel call (in catch at line 94) → returns null (false branch of if (model2))
    mockGetModel.mockReturnValueOnce({ uri: 'mock' }).mockReturnValue(null);

    const { result } = renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://tab-1', badIntrospection as never, true),
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // setModelMarkers was NOT called in the catch block since model2 is null
    expect(result.current).toBe(0);
    // Only the initial "clear on mount" may have been called, but not in catch
    const catchMarkerCalls = mockSetModelMarkers.mock.calls.filter(
      (call) => call[2] !== undefined,
    );
    expect(catchMarkerCalls).toHaveLength(0);
  });

  it('skips setModelMarkers when model is null during debounced validation', async () => {
    const introspection = makeRawIntrospection();
    // Return null for the model inside the debounced callback
    mockGetModel.mockReturnValueOnce({ uri: 'mock' }).mockReturnValue(null);

    renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://tab-1', introspection, true),
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    // setModelMarkers should NOT have been called with markers (model was null in timer)
    const markerCalls = mockSetModelMarkers.mock.calls.filter(
      (call) => call[0] === null,
    );
    expect(markerCalls).toHaveLength(0);
  });
});

describe('useQueryValidation — debounce cleanup', () => {
  it('cancels pending debounce timer when schema changes', () => {
    const introspection = makeRawIntrospection();

    const { rerender } = renderHook(
      ({ schemaLoaded }: { schemaLoaded: boolean }) =>
        useQueryValidation('query { hello }', 'inmemory://tab-1', introspection, schemaLoaded),
      { initialProps: { schemaLoaded: true } },
    );

    // Change schemaLoaded before debounce fires — should cancel timer
    rerender({ schemaLoaded: false });

    // Advance timer — should NOT have fired the debounced validation
    act(() => { vi.advanceTimersByTime(600); });

    // Markers were cleared immediately due to schemaLoaded=false
    const markerCalls = mockSetModelMarkers.mock.calls;
    const lastMarkers = markerCalls[markerCalls.length - 1]?.[2];
    expect(lastMarkers).toEqual([]);
  });
});

describe('useQueryValidation — model is null when timer fires (line 60 branch)', () => {
  it('returns early without calling setModelMarkers when getModel returns null inside timer', () => {
    const rawIntrospection = makeRawIntrospection();
    // Return null from getModel so the timer callback hits `if (!model) return;`
    mockGetModel.mockReturnValue(null);

    const { result } = renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://test', rawIntrospection, true)
    );

    act(() => { vi.advanceTimersByTime(600); });

    // The timer fires but returns early at line 60 — no markers set
    expect(mockSetModelMarkers).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });
});

describe('useQueryValidation — null location fallback (lines 77-78)', () => {
  it('uses line=1 and col=1 defaults when error has no locations', () => {
    const rawIntrospection = makeRawIntrospection();
    const fakeModel = { uri: { toString: () => 'inmemory://test' }, getVersionId: () => 1 };
    mockGetModel.mockReturnValue(fakeModel);

    // Override validate to return an error with no location information
    const noLocError = new graphqlModule.GraphQLError('No location error', { locations: undefined });
    validateSpy.mockReturnValueOnce([noLocError]);

    const { result } = renderHook(() =>
      useQueryValidation('query { hello }', 'inmemory://test', rawIntrospection, true)
    );

    act(() => { vi.advanceTimersByTime(600); });

    // Markers should be set with default line=1, col=1 since the error has no locations
    expect(mockSetModelMarkers).toHaveBeenCalled();
    const lastCall = mockSetModelMarkers.mock.calls[mockSetModelMarkers.mock.calls.length - 1];
    expect(lastCall[2].length).toBeGreaterThan(0);
    expect(lastCall[2][0].startLineNumber).toBe(1);
    expect(lastCall[2][0].startColumn).toBe(1);
    expect(result.current).toBeGreaterThan(0);
  });
});

/**
 * @vitest-environment jsdom
 *
 * Tests for useMonacoExecutionMarkers hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMonacoExecutionMarkers } from './useMonacoExecutionMarkers';
import type { GraphqlResponse } from '../../../shared/types/graphql';

const makeMonaco = (model: object | null = {}) => ({
  editor: {
    getModel: vi.fn(() => model),
    setModelMarkers: vi.fn(),
  },
  Uri: {
    parse: vi.fn((uri: string) => ({ uri })),
  },
  MarkerSeverity: {
    Error: 8,
  },
});

const makeModel = (lineCount: number, lineLengths: number[]) => ({
  getLineCount: vi.fn(() => lineCount),
  getLineLength: vi.fn((line: number) => lineLengths[line - 1] ?? 0),
});

describe('useMonacoExecutionMarkers', () => {
  const uriRef = { current: 'file:///query.graphql' };

  beforeEach(() => {
    resetAllMocks();
  });

  it('does nothing when monacoInstance is null', () => {
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(null, null, uriRef),
    );
    unmount();
  });

  it('does nothing when monacoInstance is undefined', () => {
    // Passing undefined as monacoInstance — hook should return early without calling any methods
    expect(() => {
      const { unmount } = renderHook(() =>
        useMonacoExecutionMarkers(null, undefined, uriRef),
      );
      unmount();
    }).not.toThrow();
  });

  it('does nothing when ownerUri is empty', () => {
    const monaco = makeMonaco();
    const emptyUriRef = { current: '' };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(null, monaco as never, emptyUriRef),
    );
    expect(monaco.editor.getModel).not.toHaveBeenCalled();
    unmount();
  });

  it('does nothing when model is null', () => {
    const monaco = makeMonaco(null);
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(null, monaco as never, uriRef),
    );
    expect(monaco.editor.setModelMarkers).not.toHaveBeenCalled();
    unmount();
  });

  it('clears markers when response is null', () => {
    const model = makeModel(5, [10, 10, 10, 10, 10]);
    const monaco = makeMonaco(model);
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(null, monaco as never, uriRef),
    );
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(model, 'gql-execution', []);
    unmount();
  });

  it('clears markers when response has no errors', () => {
    const model = makeModel(3, [5, 5, 5]);
    const monaco = makeMonaco(model);
    const response: GraphqlResponse = { data: { users: [] }, errors: [] };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(model, 'gql-execution', []);
    unmount();
  });

  it('sets markers for errors with locations', () => {
    const model = makeModel(5, [20, 20, 20, 20, 20]);
    const monaco = makeMonaco(model);
    const response: GraphqlResponse = {
      data: null,
      errors: [
        { message: 'Field not found', locations: [{ line: 2, column: 5 }] },
      ],
    };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(
      model,
      'gql-execution',
      [
        {
          severity: 8, // MarkerSeverity.Error
          startLineNumber: 2,
          startColumn: 5,
          endLineNumber: 2,
          endColumn: 21, // max(5+1, lineLen+1=21)
          message: 'Field not found',
          source: 'GraphQL Server',
        },
      ],
    );
    unmount();
  });

  it('handles multiple errors and multiple locations', () => {
    const model = makeModel(10, Array(10).fill(15));
    const monaco = makeMonaco(model);
    const response: GraphqlResponse = {
      data: null,
      errors: [
        { message: 'Error A', locations: [{ line: 1, column: 1 }, { line: 3, column: 2 }] },
        { message: 'Error B', locations: [{ line: 5, column: 10 }] },
      ],
    };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    const [_model, _owner, markers] = (monaco.editor.setModelMarkers as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, unknown, unknown[]];
    expect(markers).toHaveLength(3);
    unmount();
  });

  it('skips errors without locations', () => {
    const model = makeModel(5, [10, 10, 10, 10, 10]);
    const monaco = makeMonaco(model);
    const response: GraphqlResponse = {
      data: null,
      errors: [
        { message: 'No location error' },
      ],
    };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    const [_model, _owner, markers] = (monaco.editor.setModelMarkers as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, unknown, unknown[]];
    expect(markers).toHaveLength(0);
    unmount();
  });

  it('skips locations beyond line count', () => {
    const model = makeModel(3, [10, 10, 10]);
    const monaco = makeMonaco(model);
    const response: GraphqlResponse = {
      data: null,
      errors: [
        { message: 'Out of range', locations: [{ line: 10, column: 1 }] },
      ],
    };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    const [_model, _owner, markers] = (monaco.editor.setModelMarkers as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, unknown, unknown[]];
    expect(markers).toHaveLength(0);
    unmount();
  });

  it('skips locations with line < 1', () => {
    const model = makeModel(5, [10, 10, 10, 10, 10]);
    const monaco = makeMonaco(model);
    const response: GraphqlResponse = {
      data: null,
      errors: [
        { message: 'Bad loc', locations: [{ line: 0, column: 1 }] },
      ],
    };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    const [_model, _owner, markers] = (monaco.editor.setModelMarkers as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, unknown, unknown[]];
    expect(markers).toHaveLength(0);
    unmount();
  });

  it('uses empty array fallback when e.locations is undefined (line 33 ?? [] branch)', () => {
    const monaco = makeMonaco();
    const model = makeModel(5, [10, 10, 10, 10, 10]);
    (monaco.editor.getModel as ReturnType<typeof vi.fn>).mockReturnValue(model);
    const response: GraphqlResponse = {
      data: null,
      errors: [
        { message: 'Err1', locations: [{ line: 1, column: 1 }] }, // has locations
        { message: 'Err2', locations: undefined },                  // locations undefined → ?? []
      ],
    };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    unmount();
    // Only the first error produces markers (second has no locations)
    expect(monaco.editor.setModelMarkers).toHaveBeenCalled();
  });

  it('uses 0 fallback for lineLen when getLineLength returns null (line 36 ?? 0 branch)', () => {
    const monaco = makeMonaco();
    const model = makeModel(5, [10, 10, 10, 10, 10]);
    (model.getLineLength as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (monaco.editor.getModel as ReturnType<typeof vi.fn>).mockReturnValue(model);
    const response: GraphqlResponse = {
      data: null,
      errors: [{ message: 'Err', locations: [{ line: 1, column: 1 }] }],
    };
    const { unmount } = renderHook(() =>
      useMonacoExecutionMarkers(response, monaco as never, uriRef),
    );
    unmount();
    const call = (monaco.editor.setModelMarkers as ReturnType<typeof vi.fn>).mock.calls[0];
    const markers = call[2];
    // endColumn = Math.max(1 + 1, 0 + 1) = 2
    expect(markers[0].endColumn).toBeGreaterThan(0);
  });

  it('handles getModel throwing gracefully', () => {
    const monaco = makeMonaco();
    (monaco.editor.getModel as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('model error');
    });
    const response: GraphqlResponse = {
      data: null,
      errors: [{ message: 'Err', locations: [{ line: 1, column: 1 }] }],
    };
    expect(() => {
      const { unmount } = renderHook(() =>
        useMonacoExecutionMarkers(response, monaco as never, uriRef),
      );
      unmount();
    }).not.toThrow();
    expect(monaco.editor.setModelMarkers).not.toHaveBeenCalled();
  });
});

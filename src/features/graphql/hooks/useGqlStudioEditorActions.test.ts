/**
 * @vitest-environment jsdom
 *
 * useGqlStudioEditorActions — unit tests.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGqlStudioEditorActions } from './useGqlStudioEditorActions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('graphql')>();
  return {
    ...actual,
    parse: vi.fn((s: string) => actual.parse(s)),
    print: vi.fn((ast: unknown) => actual.print(ast as Parameters<typeof actual.print>[0])),
  };
});

import { parse as gqlParse, print as gqlPrint } from 'graphql';
const mockParse = vi.mocked(gqlParse);
const mockPrint = vi.mocked(gqlPrint);

beforeEach(() => { vi.clearAllMocks(); });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useGqlStudioEditorActions', () => {
  it('initialises with no toast and no prettify error', () => {
    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: '', onQueryChange })
    );
    expect(result.current.prettifyError).toBe(false);
    expect(result.current.insertToast).toBeNull();
    expect(result.current.editorMountRef.current).toBeNull();
  });

  it('handlePrettify does nothing for empty query', () => {
    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: '   ', onQueryChange })
    );
    act(() => { result.current.handlePrettify(); });
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it('handlePrettify formats the query and calls onQueryChange', () => {
    const formatted = 'query {\n  hello\n}';
    mockParse.mockReturnValueOnce({} as never);
    mockPrint.mockReturnValueOnce(formatted);

    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: 'query{hello}', onQueryChange })
    );
    act(() => { result.current.handlePrettify(); });
    expect(onQueryChange).toHaveBeenCalledWith(formatted);
  });

  it('handlePrettify does not call onQueryChange when already formatted', () => {
    const query = 'query {\n  hello\n}';
    mockParse.mockReturnValueOnce({} as never);
    mockPrint.mockReturnValueOnce(query); // returns same as input

    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: query, onQueryChange })
    );
    act(() => { result.current.handlePrettify(); });
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it('handlePrettify calls editor.setValue when editor is mounted', () => {
    const formatted = 'query {\n  hello\n}';
    mockParse.mockReturnValueOnce({} as never);
    mockPrint.mockReturnValueOnce(formatted);

    const setValue    = vi.fn();
    const fakeEditor  = { setValue } as never;
    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: 'query{hello}', onQueryChange })
    );
    act(() => { result.current.editorMountRef.current = fakeEditor; });
    act(() => { result.current.handlePrettify(); });
    expect(setValue).toHaveBeenCalledWith(formatted);
    expect(onQueryChange).toHaveBeenCalledWith(formatted);
  });

  it('handlePrettify sets prettifyError on parse failure', async () => {
    vi.useFakeTimers();
    mockParse.mockImplementationOnce(() => { throw new Error('Syntax error'); });

    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: 'invalid{', onQueryChange })
    );
    act(() => { result.current.handlePrettify(); });
    expect(result.current.prettifyError).toBe(true);

    // Error clears after 1000ms
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current.prettifyError).toBe(false);
    vi.useRealTimers();
  });

  it('handleInsertField shows "Editor not ready" toast when editor is null', async () => {
    vi.useFakeTimers();
    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: '', onQueryChange })
    );
    act(() => { result.current.handleInsertField('id', 'String', false); });
    expect(result.current.insertToast).toBe('Editor not ready');

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.insertToast).toBeNull();
    vi.useRealTimers();
  });

  it('handleInsertField inserts text at cursor and shows toast', async () => {
    vi.useFakeTimers();
    const applyEdits  = vi.fn();
    const setPosition = vi.fn();
    const focus       = vi.fn();
    const fakeModel   = { applyEdits } as never;
    const fakeEditor  = {
      getModel:    () => fakeModel,
      getPosition: () => ({ lineNumber: 1, column: 1 }),
      setPosition,
      focus,
    } as never;

    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: '', onQueryChange })
    );
    act(() => { result.current.editorMountRef.current = fakeEditor; });
    act(() => { result.current.handleInsertField('name', 'String', false); });

    expect(applyEdits).toHaveBeenCalledWith([
      expect.objectContaining({ text: 'name' }),
    ]);
    expect(result.current.insertToast).toBe('Inserted: name');
    expect(focus).toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.insertToast).toBeNull();
    vi.useRealTimers();
  });

  it('handleInsertField appends () for fields with args', () => {
    const applyEdits  = vi.fn();
    const fakeModel   = { applyEdits } as never;
    const fakeEditor  = {
      getModel:    () => fakeModel,
      getPosition: () => ({ lineNumber: 1, column: 5 }),
      setPosition: vi.fn(),
      focus:       vi.fn(),
    } as never;

    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: '', onQueryChange })
    );
    act(() => { result.current.editorMountRef.current = fakeEditor; });
    act(() => { result.current.handleInsertField('user', 'User', true); });

    expect(applyEdits).toHaveBeenCalledWith([
      expect.objectContaining({ text: 'user()' }),
    ]);
  });

  it('returns early from handleInsertField when model or position is null', () => {
    const fakeEditor = {
      getModel:    () => null,
      getPosition: () => null,
    } as never;

    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlStudioEditorActions({ activeQuery: '', onQueryChange })
    );
    act(() => { result.current.editorMountRef.current = fakeEditor; });
    // Should not throw
    act(() => { result.current.handleInsertField('id', 'ID', false); });
    expect(result.current.insertToast).toBeNull();
  });
});

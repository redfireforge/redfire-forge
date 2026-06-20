/**
 * @vitest-environment jsdom
 *
 * Tests for useGqlItemLoaders hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGqlItemLoaders } from './useGqlItemLoaders';
import type { GraphqlCollectionItem, GraphqlHistoryItem } from '../../../shared/types/graphql';

const makeItem = (id: string, query: string, variables = ''): GraphqlCollectionItem => ({
  id,
  collectionId: 'col1',
  operation: { id, query, variables, operationType: 'query' },
  sortOrder: 0,
  isPinned: false,
  folderId: null,
  tags: [],
});

const makeHistItem = (id: string, query: string, variables = ''): GraphqlHistoryItem => ({
  id,
  connectionId: 'https://example.com',
  timestamp: Date.now(),
  latencyMs: 100,
  operation: { id, query, variables, operationType: 'query' },
  response: '{}',
});

const buildArgs = (overrides: Partial<Parameters<typeof useGqlItemLoaders>[0]> = {}) => {
  const editorMountRef = { current: { setValue: vi.fn() } };
  const onQueryChange = vi.fn();
  const onVariablesChange = vi.fn();
  const onSetActivityTab = vi.fn();
  const onSetBuilderMode = vi.fn();
  const handleExecuteRef = { current: vi.fn() };
  return {
    editorMountRef,
    onQueryChange,
    onVariablesChange,
    onSetActivityTab,
    onSetBuilderMode,
    handleExecuteRef,
    collectionTrees: [] as Array<{ items: GraphqlCollectionItem[] }>,
    ...overrides,
  };
};

describe('useGqlItemLoaders', () => {
  let rafMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock requestAnimationFrame to execute synchronously in tests
    rafMock = vi.fn((cb: FrameRequestCallback) => { cb(0); return 0; });
    vi.stubGlobal('requestAnimationFrame', rafMock);
  });

  describe('handleLoadCollectionItem', () => {
    it('sets editor value and calls onQueryChange', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const item = makeItem('1', 'query { foo }');
      result.current.handleLoadCollectionItem(item);
      expect(args.editorMountRef.current?.setValue).toHaveBeenCalledWith('query { foo }');
      expect(args.onQueryChange).toHaveBeenCalledWith('query { foo }');
    });

    it('calls onVariablesChange when item has non-empty variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const item = makeItem('1', 'query { foo }', '{"id":"1"}');
      result.current.handleLoadCollectionItem(item);
      expect(args.onVariablesChange).toHaveBeenCalledWith('{"id":"1"}');
    });

    it('does not call onVariablesChange for empty variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const item = makeItem('1', 'query { foo }', '');
      result.current.handleLoadCollectionItem(item);
      expect(args.onVariablesChange).not.toHaveBeenCalled();
    });

    it('does not call onVariablesChange for whitespace-only variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const item = makeItem('1', 'query { foo }', '   ');
      result.current.handleLoadCollectionItem(item);
      expect(args.onVariablesChange).not.toHaveBeenCalled();
    });

    it('does not call onVariablesChange for "{}" variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const item = makeItem('1', 'query { foo }', '{}');
      result.current.handleLoadCollectionItem(item);
      expect(args.onVariablesChange).not.toHaveBeenCalled();
    });

    it('works when editorMountRef.current is null', () => {
      const args = buildArgs({ editorMountRef: { current: null } });
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const item = makeItem('1', 'query { foo }');
      expect(() => result.current.handleLoadCollectionItem(item)).not.toThrow();
      expect(args.onQueryChange).toHaveBeenCalledWith('query { foo }');
    });
  });

  describe('handleOpenCollectionItem', () => {
    it('finds item by id across trees and loads it', () => {
      const item = makeItem('item-42', 'query { bar }');
      const args = buildArgs({
        collectionTrees: [{ items: [item] }],
      });
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleOpenCollectionItem('item-42');
      expect(args.onQueryChange).toHaveBeenCalledWith('query { bar }');
      expect(args.onSetActivityTab).toHaveBeenCalledWith('collections');
    });

    it('finds item in later trees when not in first tree', () => {
      const item1 = makeItem('first', 'query { a }');
      const item2 = makeItem('second', 'query { b }');
      const args = buildArgs({
        collectionTrees: [{ items: [item1] }, { items: [item2] }],
      });
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleOpenCollectionItem('second');
      expect(args.onQueryChange).toHaveBeenCalledWith('query { b }');
    });

    it('does nothing when item not found', () => {
      const args = buildArgs({ collectionTrees: [{ items: [makeItem('x', 'query { a }')] }] });
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleOpenCollectionItem('not-found');
      expect(args.onQueryChange).not.toHaveBeenCalled();
      expect(args.onSetActivityTab).not.toHaveBeenCalled();
    });

    it('does nothing when collection trees are empty', () => {
      const args = buildArgs({ collectionTrees: [] });
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleOpenCollectionItem('any-id');
      expect(args.onQueryChange).not.toHaveBeenCalled();
    });
  });

  describe('handleLoadHistoryItem', () => {
    it('sets editor value and calls onQueryChange', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const histItem = makeHistItem('1', 'query { history }');
      result.current.handleLoadHistoryItem(histItem);
      expect(args.editorMountRef.current?.setValue).toHaveBeenCalledWith('query { history }');
      expect(args.onQueryChange).toHaveBeenCalledWith('query { history }');
    });

    it('calls onVariablesChange for non-empty history variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const histItem = makeHistItem('1', 'query { x }', '{"n":3}');
      result.current.handleLoadHistoryItem(histItem);
      expect(args.onVariablesChange).toHaveBeenCalledWith('{"n":3}');
    });

    it('does not call onVariablesChange for empty history variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const histItem = makeHistItem('1', 'query { x }', '');
      result.current.handleLoadHistoryItem(histItem);
      expect(args.onVariablesChange).not.toHaveBeenCalled();
    });

    it('works when editorMountRef.current is null', () => {
      const args = buildArgs({ editorMountRef: { current: null } });
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const histItem = makeHistItem('1', 'query { hist }');
      expect(() => result.current.handleLoadHistoryItem(histItem)).not.toThrow();
    });
  });

  describe('handleRunHistoryItem', () => {
    it('loads the history item and schedules execute via RAF', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const histItem = makeHistItem('1', 'query { run }');
      result.current.handleRunHistoryItem(histItem);
      expect(args.onQueryChange).toHaveBeenCalledWith('query { run }');
      expect(rafMock).toHaveBeenCalled();
      expect(args.handleExecuteRef.current).toHaveBeenCalled();
    });

    it('also sets variables before executing', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      const histItem = makeHistItem('1', 'query { run }', '{"x":1}');
      result.current.handleRunHistoryItem(histItem);
      expect(args.onVariablesChange).toHaveBeenCalledWith('{"x":1}');
      expect(args.handleExecuteRef.current).toHaveBeenCalled();
    });
  });

  describe('handleEditInEditor', () => {
    it('sets query, handles variables, and exits builder mode', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleEditInEditor('query { edited }', '{"x":1}');
      expect(args.onQueryChange).toHaveBeenCalledWith('query { edited }');
      expect(args.onVariablesChange).toHaveBeenCalledWith('{"x":1}');
      expect(args.onSetBuilderMode).toHaveBeenCalledWith(false);
    });

    it('sets editor value via ref', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleEditInEditor('query { x }', '');
      expect(args.editorMountRef.current?.setValue).toHaveBeenCalledWith('query { x }');
    });

    it('does not call onVariablesChange for empty variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleEditInEditor('query { x }', '');
      expect(args.onVariablesChange).not.toHaveBeenCalled();
    });

    it('does not call onVariablesChange for "{}" variables', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleEditInEditor('query { x }', '{}');
      expect(args.onVariablesChange).not.toHaveBeenCalled();
    });
  });

  describe('handleBuilderExecute', () => {
    it('sets query, variables, exits builder mode, and schedules execute', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleBuilderExecute('query { build }', '{"k":"v"}');
      expect(args.onQueryChange).toHaveBeenCalledWith('query { build }');
      expect(args.onVariablesChange).toHaveBeenCalledWith('{"k":"v"}');
      expect(args.onSetBuilderMode).toHaveBeenCalledWith(false);
      expect(rafMock).toHaveBeenCalled();
      expect(args.handleExecuteRef.current).toHaveBeenCalled();
    });

    it('does not call onVariablesChange when variables is "{}"', () => {
      const args = buildArgs();
      const { result } = renderHook(() => useGqlItemLoaders(args));
      result.current.handleBuilderExecute('query { build }', '{}');
      expect(args.onVariablesChange).not.toHaveBeenCalled();
    });
  });
});

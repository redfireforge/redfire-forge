/**
 * useGqlItemLoaders — handlers for loading / running collection items and
 * history items into the GraphQL Studio editor.
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useCallback } from 'react';
import type { GraphqlCollectionItem, GraphqlHistoryItem } from '../../../shared/types/graphql';

interface GqlItemLoadersArgs {
  editorMountRef: React.MutableRefObject<{ setValue: (v: string) => void } | null>;
  onQueryChange: (q: string) => void;
  onVariablesChange: (v: string) => void;
  onSetActivityTab: (tab: string) => void;
  onSetBuilderMode: (v: boolean) => void;
  handleExecuteRef: React.MutableRefObject<() => void>;
  collectionTrees: Array<{ items: GraphqlCollectionItem[] }>;
}

export interface GqlItemLoadersResult {
  handleLoadCollectionItem: (item: GraphqlCollectionItem) => void;
  handleOpenCollectionItem: (itemId: string) => void;
  handleLoadHistoryItem: (histItem: GraphqlHistoryItem) => void;
  handleRunHistoryItem: (histItem: GraphqlHistoryItem) => void;
  handleEditInEditor: (sdl: string, variablesJson: string) => void;
  handleBuilderExecute: (sdl: string, variablesJson: string) => void;
}

export function useGqlItemLoaders({
  editorMountRef,
  onQueryChange,
  onVariablesChange,
  onSetActivityTab,
  onSetBuilderMode,
  handleExecuteRef,
  collectionTrees,
}: GqlItemLoadersArgs): GqlItemLoadersResult {
  const handleLoadCollectionItem = useCallback((item: GraphqlCollectionItem) => {
    if (editorMountRef.current) editorMountRef.current.setValue(item.operation.query);
    onQueryChange(item.operation.query);
    if (item.operation.variables && item.operation.variables.trim() && item.operation.variables.trim() !== '{}') {
      onVariablesChange(item.operation.variables);
    }
  }, [editorMountRef, onQueryChange, onVariablesChange]);

  const handleOpenCollectionItem = useCallback((itemId: string) => {
    for (const tree of collectionTrees) {
      const item = tree.items.find((i) => i.id === itemId);
      if (item) {
        handleLoadCollectionItem(item);
        onSetActivityTab('collections');
        return;
      }
    }
  }, [collectionTrees, handleLoadCollectionItem, onSetActivityTab]);

  const handleLoadHistoryItem = useCallback((histItem: GraphqlHistoryItem) => {
    if (editorMountRef.current) editorMountRef.current.setValue(histItem.operation.query);
    onQueryChange(histItem.operation.query);
    if (histItem.operation.variables && histItem.operation.variables.trim() && histItem.operation.variables.trim() !== '{}') {
      onVariablesChange(histItem.operation.variables);
    }
  }, [editorMountRef, onQueryChange, onVariablesChange]);

  const handleRunHistoryItem = useCallback((histItem: GraphqlHistoryItem) => {
    if (editorMountRef.current) editorMountRef.current.setValue(histItem.operation.query);
    onQueryChange(histItem.operation.query);
    if (histItem.operation.variables && histItem.operation.variables.trim() && histItem.operation.variables.trim() !== '{}') {
      onVariablesChange(histItem.operation.variables);
    }
    requestAnimationFrame(() => { handleExecuteRef.current(); });
  }, [editorMountRef, onQueryChange, onVariablesChange, handleExecuteRef]);

  const handleEditInEditor = useCallback(
    (sdl: string, variablesJson: string) => {
      if (editorMountRef.current) editorMountRef.current.setValue(sdl);
      onQueryChange(sdl);
      if (variablesJson && variablesJson !== '{}') onVariablesChange(variablesJson);
      onSetBuilderMode(false);
    },
    [onQueryChange, onVariablesChange, editorMountRef, onSetBuilderMode],
  );

  const handleBuilderExecute = useCallback(
    (sdl: string, variablesJson: string) => {
      if (editorMountRef.current) editorMountRef.current.setValue(sdl);
      onQueryChange(sdl);
      if (variablesJson && variablesJson !== '{}') onVariablesChange(variablesJson);
      onSetBuilderMode(false);
      requestAnimationFrame(() => { handleExecuteRef.current(); });
    },
    [onQueryChange, onVariablesChange, editorMountRef, onSetBuilderMode, handleExecuteRef],
  );

  return {
    handleLoadCollectionItem,
    handleOpenCollectionItem,
    handleLoadHistoryItem,
    handleRunHistoryItem,
    handleEditInEditor,
    handleBuilderExecute,
  };
}

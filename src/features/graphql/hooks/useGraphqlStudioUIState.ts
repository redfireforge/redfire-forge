/**
 * useGraphqlStudioUIState.ts
 *
 * Extracts UI state management from GraphqlStudioPage.
 * Manages: builderMode, bottomTab, rightView, fileEntries, uploadProgress visibility.
 * This reduces GraphqlStudioPage's responsibility from 978 lines to ~650 by separating
 * concerns: orchestration (page-level) vs presentation (UI state).
 */

import { useCallback, useState } from 'react';
import type { FileEntry } from '../utils/multipartBuilder';
import type { BottomPanelTabExtended, RightPaneView } from '../graphqlStudioPageTypes';

export interface GraphqlStudioUIState {
  bottomTab: BottomPanelTabExtended;
  setBottomTab: (tab: BottomPanelTabExtended) => void;
  rightView: RightPaneView;
  setRightView: (view: RightPaneView) => void;
  fileEntries: FileEntry[];
  setFileEntries: (entries: FileEntry[]) => void;
  builderMode: boolean;
  setBuilderMode: (mode: boolean) => void;
  focusAuthPanel: () => void;
}

/**
 * Custom hook to manage GraphQL Studio UI state.
 * Centralizes state declarations and provides focused callback for auth panel access.
 */
export function useGraphqlStudioUIState(): GraphqlStudioUIState {
  const [bottomTab, setBottomTab] = useState<BottomPanelTabExtended>('variables');
  const [rightView, setRightView] = useState<RightPaneView>('response');
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [builderMode, setBuilderMode] = useState(false);

  const focusAuthPanel = useCallback(() => {
    setBuilderMode(false);
    setBottomTab('auth');
  }, []);

  return {
    bottomTab,
    setBottomTab,
    rightView,
    setRightView,
    fileEntries,
    setFileEntries,
    builderMode,
    setBuilderMode,
    focusAuthPanel,
  };
}

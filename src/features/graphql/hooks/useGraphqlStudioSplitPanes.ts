/**
 * useGraphqlStudioSplitPanes.ts
 *
 * Extracts split pane configuration and state from GraphqlStudioPage.
 * Manages: editor/response split, activity sidebar, bottom panel resizing.
 * Reduces GraphqlStudioPage complexity by centralizing layout state.
 */

import { useRef } from 'react';
import { useSplitPaneResize } from '../../../shared/hooks/useSplitPaneResize';
import { useVerticalSplitPaneResize } from '../../../shared/hooks/useVerticalSplitPaneResize';
import type { SplitPaneDividerProps } from '../../../shared/hooks/useSplitPaneResize';
import type { VerticalSplitPaneDividerProps } from '../../../shared/hooks/useVerticalSplitPaneResize';

export interface GraphqlStudioSplitPanes {
  gqlSplitRef: React.RefObject<HTMLDivElement | null>;
  gqlActivitySplitRef: React.RefObject<HTMLDivElement | null>;
  gqlLeftPaneRef: React.RefObject<HTMLDivElement | null>;
  editorPaneWidth: number;
  gqlPaneDividerProps: SplitPaneDividerProps;
  activityPanelWidth: number;
  activityDividerProps: SplitPaneDividerProps;
  bottomPanelHeight: number;
  bottomPanelDividerProps: VerticalSplitPaneDividerProps;
}

/**
 * Custom hook to manage all split pane configurations for GraphQL Studio.
 * Consolidates three separate split pane resize hooks with their refs.
 */
export function useGraphqlStudioSplitPanes(): GraphqlStudioSplitPanes {
  const gqlSplitRef = useRef<HTMLDivElement>(null);
  const gqlActivitySplitRef = useRef<HTMLDivElement>(null);
  const gqlLeftPaneRef = useRef<HTMLDivElement>(null);

  const { width: editorPaneWidth, dividerProps: gqlPaneDividerProps } = useSplitPaneResize({
    storageKey: 'redfire-gql-split-v1',
    defaultWidth: 640,
    minWidth: 320,
    minOppositeWidth: 300,
    containerRef: gqlSplitRef,
    label: 'Resize editor and response panes',
  });

  const { width: activityPanelWidth, dividerProps: activityDividerProps } = useSplitPaneResize({
    storageKey: 'redfire-gql-activity-split-v1',
    defaultWidth: 320,
    minWidth: 240,
    minOppositeWidth: 480,
    maxWidthRatio: 0.42,
    containerRef: gqlActivitySplitRef,
    label: 'Resize activity sidebar',
  });

  const { height: bottomPanelHeight, dividerProps: bottomPanelDividerProps } = useVerticalSplitPaneResize({
    storageKey: 'redfire-gql-bottom-panel-height-v3',
    defaultHeight: 320,
    minHeight: 80,
    minOppositeHeight: 120,
    containerRef: gqlLeftPaneRef,
    label: 'Resize editor and bottom panel',
  });

  return {
    gqlSplitRef,
    gqlActivitySplitRef,
    gqlLeftPaneRef,
    editorPaneWidth,
    gqlPaneDividerProps,
    activityPanelWidth,
    activityDividerProps,
    bottomPanelHeight,
    bottomPanelDividerProps,
  };
}

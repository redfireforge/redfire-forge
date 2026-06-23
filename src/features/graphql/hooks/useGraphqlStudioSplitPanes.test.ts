/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGraphqlStudioSplitPanes } from './useGraphqlStudioSplitPanes';

interface MockHorizontalArgs {
  storageKey: string;
  defaultWidth: number;
  label: string;
}

interface MockVerticalArgs {
  storageKey: string;
  defaultHeight: number;
  label: string;
}

// Mock the split pane hooks
vi.mock('../../../shared/hooks/useSplitPaneResize', () => ({
  useSplitPaneResize: ({ storageKey: _storageKey, defaultWidth, label }: MockHorizontalArgs) => ({
    width: defaultWidth,
    dividerProps: { role: 'separator', 'data-label': label },
  }),
}));

vi.mock('../../../shared/hooks/useVerticalSplitPaneResize', () => ({
  useVerticalSplitPaneResize: ({ storageKey: _storageKey, defaultHeight, label }: MockVerticalArgs) => ({
    height: defaultHeight,
    dividerProps: { role: 'separator', 'data-label': label },
  }),
}));

describe('useGraphqlStudioSplitPanes', () => {
  it('initializes all split pane refs', () => {
    const { result } = renderHook(() => useGraphqlStudioSplitPanes());

    expect(result.current.gqlSplitRef).toBeDefined();
    expect(result.current.gqlActivitySplitRef).toBeDefined();
    expect(result.current.gqlLeftPaneRef).toBeDefined();
  });

  it('returns default widths and heights', () => {
    const { result } = renderHook(() => useGraphqlStudioSplitPanes());

    expect(result.current.editorPaneWidth).toBe(640);
    expect(result.current.activityPanelWidth).toBe(320);
    expect(result.current.bottomPanelHeight).toBe(320);
  });

  it('provides divider props for all split panes', () => {
    const { result } = renderHook(() => useGraphqlStudioSplitPanes());

    expect(result.current.gqlPaneDividerProps).toBeDefined();
    expect(result.current.activityDividerProps).toBeDefined();
    expect(result.current.bottomPanelDividerProps).toBeDefined();
  });

  it('exposes mutable refs for DOM attachment', () => {
    const { result } = renderHook(() => useGraphqlStudioSplitPanes());

    // Refs start as null but are mutable objects
    expect(result.current.gqlSplitRef.current).toBeNull();
    
    // Simulate attaching a DOM element
    const div = document.createElement('div');
    result.current.gqlSplitRef.current = div;
    expect(result.current.gqlSplitRef.current).toBe(div);
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlStudioBatchAdvSettings } from './useGraphqlStudioBatchAdvSettings';

const baseInput = () => ({
  advSettingsOpen: false,
  advSettings: { batchEnabled: true },
  handleAdvSettingsChange: vi.fn(),
  setAdvSettingsOpen: vi.fn(),
  batchTabOverrides: new Map<string, boolean>(),
  activeBatchGroupKey: 'group-1',
  setBatchTabOverrides: vi.fn(),
  handleSetActiveBatchGroup: vi.fn(),
  batchGroups: [{ key: 'group-1', displayLabel: 'Group 1', resolvedEndpoint: 'http://x/graphql', tabIds: ['t1'] }],
  batchedTabIdsSet: new Set(['t1']),
  handleToggleBatch: vi.fn(),
  tabs: [{ id: 't1' } as never],
  profiles: [],
  endpoint: 'http://x/graphql',
  pageDefaultEndpointResolved: 'http://x/graphql',
  activeDemoLessonId: null,
  activeBatchGroup: { displayLabel: 'Group 1' },
  effectiveBatchedTabs: [{ id: 't1' } as never],
});

describe('useGraphqlStudioBatchAdvSettings', () => {
  it('saves advanced settings and closes the panel', () => {
    const input = baseInput();
    const { result } = renderHook(() => useGraphqlStudioBatchAdvSettings(input));
    act(() => { result.current.handleAdvSettingsSave({ batchEnabled: false } as never); });
    expect(input.handleAdvSettingsChange).toHaveBeenCalled();
    expect(input.setAdvSettingsOpen).toHaveBeenCalledWith(false);
  });

  it('restores batch overrides on cancel', () => {
    const input = baseInput();
    const overrides = new Map([['t1', true]]);
    const { result, rerender } = renderHook(
      (props) => useGraphqlStudioBatchAdvSettings(props),
      { initialProps: { ...input, advSettingsOpen: true, batchTabOverrides: overrides } },
    );
    rerender({ ...input, advSettingsOpen: true, batchTabOverrides: overrides });
    act(() => { result.current.handleAdvSettingsCancel(); });
    expect(input.setBatchTabOverrides).toHaveBeenCalled();
    expect(input.setAdvSettingsOpen).toHaveBeenCalledWith(false);
  });

  it('restores active batch group key on cancel when snapshot has groupKey', () => {
    const input = baseInput();
    const originalOverrides = new Map([['t1', true]]);
    const { result, rerender } = renderHook(
      (props) => useGraphqlStudioBatchAdvSettings(props),
      {
        initialProps: {
          ...input,
          advSettingsOpen: true,
          batchTabOverrides: originalOverrides,
          activeBatchGroupKey: 'group-1',
        },
      },
    );
    rerender({
      ...input,
      advSettingsOpen: true,
      batchTabOverrides: new Map([['t1', false], ['t2', true]]),
      activeBatchGroupKey: 'group-2',
    });
    act(() => { result.current.handleAdvSettingsCancel(); });
    expect(input.setBatchTabOverrides).toHaveBeenCalledWith(originalOverrides);
    expect(input.handleSetActiveBatchGroup).toHaveBeenCalledWith('group-1');
    expect(input.setAdvSettingsOpen).toHaveBeenCalledWith(false);
  });

  it('cancel without snapshot only closes the panel', () => {
    const input = baseInput();
    const { result } = renderHook(() => useGraphqlStudioBatchAdvSettings(input));
    act(() => { result.current.handleAdvSettingsCancel(); });
    expect(input.setBatchTabOverrides).not.toHaveBeenCalled();
    expect(input.handleSetActiveBatchGroup).not.toHaveBeenCalled();
    expect(input.setAdvSettingsOpen).toHaveBeenCalledWith(false);
  });

  it('captures snapshot when panel opens', () => {
    const input = baseInput();
    const openOverrides = new Map([['t1', true]]);
    const { result, rerender } = renderHook(
      (props) => useGraphqlStudioBatchAdvSettings(props),
      { initialProps: { ...input, advSettingsOpen: false, batchTabOverrides: openOverrides } },
    );
    rerender({
      ...input,
      advSettingsOpen: true,
      batchTabOverrides: openOverrides,
      activeBatchGroupKey: 'group-1',
    });
    rerender({
      ...input,
      advSettingsOpen: true,
      batchTabOverrides: new Map([['t1', false]]),
      activeBatchGroupKey: 'group-2',
    });
    act(() => { result.current.handleAdvSettingsCancel(); });
    expect(input.setBatchTabOverrides).toHaveBeenCalledWith(openOverrides);
    expect(input.handleSetActiveBatchGroup).toHaveBeenCalledWith('group-1');
  });

  it('does not re-snapshot while panel stays open', () => {
    const input = baseInput();
    const firstOverrides = new Map([['t1', true]]);
    const { result, rerender } = renderHook(
      (props) => useGraphqlStudioBatchAdvSettings(props),
      { initialProps: { ...input, advSettingsOpen: true, batchTabOverrides: firstOverrides } },
    );
    rerender({
      ...input,
      advSettingsOpen: true,
      batchTabOverrides: new Map([['t2', true]]),
      activeBatchGroupKey: 'group-2',
    });
    act(() => { result.current.handleAdvSettingsCancel(); });
    expect(input.setBatchTabOverrides).toHaveBeenCalledWith(firstOverrides);
    expect(input.handleSetActiveBatchGroup).toHaveBeenCalledWith('group-1');
  });

  it('builds batch summary label when batch is enabled', () => {
    const { result } = renderHook(() => useGraphqlStudioBatchAdvSettings(baseInput()));
    expect(result.current.batchSummaryLabel).toBe('Group 1 · 1 selected');
  });

  it('returns null batch summary label when batch is disabled', () => {
    const input = { ...baseInput(), advSettings: { batchEnabled: false } };
    const { result } = renderHook(() => useGraphqlStudioBatchAdvSettings(input));
    expect(result.current.batchSummaryLabel).toBeNull();
  });

  it('returns null batch summary label when activeBatchGroup is missing', () => {
    const input = { ...baseInput(), activeBatchGroup: null };
    const { result } = renderHook(() => useGraphqlStudioBatchAdvSettings(input));
    expect(result.current.batchSummaryLabel).toBeNull();
  });

  it('exposes batchSettingsProps with demo lesson flag', () => {
    const input = { ...baseInput(), activeDemoLessonId: 'gql-first-query' };
    const { result } = renderHook(() => useGraphqlStudioBatchAdvSettings(input));
    expect(result.current.batchSettingsProps.demoLessonActive).toBe(true);
    expect(result.current.batchSettingsProps.pageDefaultEndpoint).toBe('http://x/graphql');
    expect(result.current.batchSettingsProps.groups).toEqual(input.batchGroups);
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMapperRepairActions } from './useMapperRepairActions';
import type { MapperRepairIssue } from '../ValidationRepairPanel';
import type { Mapping } from '../types';

function makeIssue(overrides: Partial<MapperRepairIssue> = {}): MapperRepairIssue {
  return {
    id: 'issue-1',
    mappingId: 'm1',
    sourcePath: '$.src',
    targetPath: '$.tgt',
    sourceId: 'src-1',
    kind: 'type-mismatch',
    message: 'type mismatch',
    severity: 'warning',
    ...overrides,
  };
}

function makeMappings(): Mapping[] {
  return [
    { id: 'm1', sourcePath: '$.src', sourceId: 'src-1', targetPath: '$.tgt' },
    { id: 'm2', sourcePath: '$.a', sourceId: 'src-1', targetPath: '$.b' },
  ];
}

function setup(overrides = {}) {
  const setMappings = vi.fn();
  const updateMapping = vi.fn();
  const selectMapping = vi.fn();
  const setSelectedIds = vi.fn();
  const setFocusRegion = vi.fn();
  const setBulkSourceId = vi.fn();
  const setBulkSourcePath = vi.fn();
  const setBulkTargetPath = vi.fn();
  const setLineFocusNode = vi.fn();
  const setToast = vi.fn();
  const focusNodeByPath = vi.fn(() => false);

  const params = {
    diagnostics: { issues: [makeIssue()], resolved: 1, unresolved: 0, lastComputedAt: Date.now() },
    mappings: makeMappings(),
    activeSourceId: 'src-1',
    bulkSourcePath: null as string | null,
    bulkSourceId: null as string | null,
    bulkTargetPath: null as string | null,
    showMappingLines: true,
    nodeFocusMode: false,
    setMappings,
    updateMapping,
    selectMapping,
    setSelectedIds,
    setFocusRegion,
    setBulkSourceId,
    setBulkSourcePath,
    setBulkTargetPath,
    setLineFocusNode,
    setToast,
    focusNodeByPath,
    ...overrides,
  };

  const result = renderHook(() => useMapperRepairActions(params));
  return {
    ...result,
    mocks: {
      setMappings,
      updateMapping,
      selectMapping,
      setSelectedIds,
      setFocusRegion,
      setBulkSourceId,
      setBulkSourcePath,
      setBulkTargetPath,
      setLineFocusNode,
      setToast,
      focusNodeByPath,
    },
  };
}

describe('useMapperRepairActions', () => {
  it('returns visible issues (all initially visible)', () => {
    const { result } = setup();
    expect(result.current.visibleRepairIssues).toHaveLength(1);
  });

  it('handleIgnoreRepairIssue hides the issue', () => {
    const { result } = setup();
    act(() => result.current.handleIgnoreRepairIssue(makeIssue()));
    expect(result.current.visibleRepairIssues).toHaveLength(0);
  });

  it('clearIgnoredRepairIssues restores hidden issues', () => {
    const { result } = setup();
    act(() => result.current.handleIgnoreRepairIssue(makeIssue()));
    expect(result.current.visibleRepairIssues).toHaveLength(0);
    act(() => result.current.clearIgnoredRepairIssues());
    expect(result.current.visibleRepairIssues).toHaveLength(1);
  });

  it('handleFixRepairIssue applies suggested fix', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleFixRepairIssue(makeIssue({ suggestedFixExpression: '$toString($.src)' })));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', { expression: '$toString($.src)' });
    expect(mocks.setToast).toHaveBeenCalledWith('Applied suggested fix');
  });

  it('handleFixRepairIssue toasts when no fix available', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleFixRepairIssue(makeIssue({ suggestedFixExpression: undefined })));
    expect(mocks.updateMapping).not.toHaveBeenCalled();
    expect(mocks.setToast).toHaveBeenCalledWith('No automatic fix available for this issue');
  });

  it('handleFixRepairIssue changes operator and clears operatorValue when suggestedOperator is set', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleFixRepairIssue(makeIssue({ suggestedOperator: 'equals' })));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', { operator: 'equals', operatorValue: undefined });
    expect(mocks.setToast).toHaveBeenCalledWith('Changed operator to "equals"');
  });

  it('handleReplaceRepairIssue toasts if mapping not found', () => {
    const { result, mocks } = setup({ mappings: [] });
    act(() => result.current.handleReplaceRepairIssue(makeIssue()));
    expect(mocks.setToast).toHaveBeenCalledWith('Issue mapping is no longer available');
  });

  it('handleReplaceRepairIssue handles duplicate-target kind', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: '$.a', sourceId: 'src-1', targetPath: '$.tgt' },
      { id: 'm2', sourcePath: '$.b', sourceId: 'src-1', targetPath: '$.tgt' },
    ];
    const { result, mocks } = setup({ mappings });
    act(() => result.current.handleReplaceRepairIssue(makeIssue({ kind: 'duplicate-target' })));
    expect(mocks.setMappings).toHaveBeenCalled();
    const newMappings = mocks.setMappings.mock.calls[0][0] as Mapping[];
    expect(newMappings).toHaveLength(1);
    expect(newMappings[0].id).toBe('m1');
  });

  it('handleReplaceRepairIssue toasts if no duplicates found', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleReplaceRepairIssue(makeIssue({ kind: 'duplicate-target' })));
    expect(mocks.setToast).toHaveBeenCalledWith('No duplicate mappings found to replace');
  });

  it('handleReplaceRepairIssue requires selection when not duplicate-target', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleReplaceRepairIssue(makeIssue()));
    expect(mocks.setToast).toHaveBeenCalledWith('Select source/target nodes first, then use Replace');
  });

  it('handleReplaceRepairIssue replaces source and target from selections', () => {
    const { result, mocks } = setup({
      bulkSourcePath: '$.newSrc',
      bulkSourceId: 'src-2',
      bulkTargetPath: '$.newTgt',
    });
    act(() => result.current.handleReplaceRepairIssue(makeIssue()));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', {
      sourcePath: '$.newSrc',
      sourceId: 'src-2',
      expression: undefined,
      targetPath: '$.newTgt',
    });
  });

  it('handleReplaceRepairIssue replaces only target when source matches', () => {
    const { result, mocks } = setup({
      bulkSourcePath: '$.src',
      bulkSourceId: 'src-1',
      bulkTargetPath: '$.newTgt',
    });
    act(() => result.current.handleReplaceRepairIssue(makeIssue()));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', { targetPath: '$.newTgt' });
  });

  it('handleOpenRepairIssue focuses the mapping', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleOpenRepairIssue(makeIssue()));
    expect(mocks.selectMapping).toHaveBeenCalledWith('m1');
    expect(mocks.setSelectedIds).toHaveBeenCalled();
    expect(mocks.setFocusRegion).toHaveBeenCalledWith('target');
    expect(mocks.setBulkTargetPath).toHaveBeenCalledWith('$.tgt');
    expect(mocks.setBulkSourceId).toHaveBeenCalledWith('src-1');
    expect(mocks.setBulkSourcePath).toHaveBeenCalledWith('$.src');
    expect(mocks.focusNodeByPath).toHaveBeenCalledWith('$.tgt', 'target');
    expect(mocks.setToast).toHaveBeenCalledWith(
      expect.stringContaining('Selected mapping for tgt'),
    );
  });

  it('handleOpenRepairIssue opens the tree node when present', () => {
    const focusNodeByPath = vi.fn((path: string, region: string) => path === '$.tgt' && region === 'target');
    const { result, mocks } = setup({ focusNodeByPath });
    act(() => result.current.handleOpenRepairIssue(makeIssue()));
    expect(focusNodeByPath).toHaveBeenCalledWith('$.tgt', 'target');
    expect(mocks.setToast).toHaveBeenCalledWith('Opened target node: tgt');
  });

  it('handleOpenRepairIssue explains missing-target when node is absent', () => {
    const { result, mocks } = setup({
      focusNodeByPath: vi.fn(() => false),
    });
    act(() => result.current.handleOpenRepairIssue(makeIssue({ kind: 'missing-target' })));
    expect(mocks.setToast).toHaveBeenCalledWith(
      expect.stringContaining('is not in the target tree'),
    );
  });

  it('handleOpenRepairIssue prefers source for unresolved-path', () => {
    const focusNodeByPath = vi.fn((path: string, region: string) => path === '$.src' && region === 'source');
    const { result, mocks } = setup({ focusNodeByPath });
    act(() => result.current.handleOpenRepairIssue(makeIssue({ kind: 'unresolved-path' })));
    expect(focusNodeByPath).toHaveBeenNthCalledWith(1, '$.src', 'source');
    expect(mocks.setToast).toHaveBeenCalledWith('Opened source node: src');
  });

  it('handleOpenRepairIssue sets line focus in node focus mode', () => {
    const { result, mocks } = setup({ showMappingLines: false, nodeFocusMode: true });
    act(() => result.current.handleOpenRepairIssue(makeIssue()));
    expect(mocks.setLineFocusNode).toHaveBeenCalledWith({ region: 'target', path: '$.tgt' });
  });

  it('handleOpenRepairIssue does not set line focus when mapping lines shown', () => {
    const { result, mocks } = setup({ showMappingLines: true, nodeFocusMode: true });
    act(() => result.current.handleOpenRepairIssue(makeIssue()));
    expect(mocks.setLineFocusNode).not.toHaveBeenCalled();
  });

  it('handleReplaceRepairIssue clears expression for type-mismatch when replacing from source selection only', () => {
    const { result, mocks } = setup({
      bulkSourcePath: '$.replacement',
      bulkSourceId: 'src-2',
      bulkTargetPath: null,
      mappings: [
        { id: 'm1', sourcePath: '$.src', sourceId: 'src-1', targetPath: '$.tgt', expression: '$foo' },
      ],
    });
    act(() => result.current.handleReplaceRepairIssue(makeIssue({ kind: 'type-mismatch' })));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', {
      sourcePath: '$.replacement',
      sourceId: 'src-2',
      expression: undefined,
    });
  });

  it('handleReplaceRepairIssue updates only target when target bulk differs and source unchanged', () => {
    const { result, mocks } = setup({
      bulkSourcePath: '$.src',
      bulkSourceId: 'src-1',
      bulkTargetPath: '$.otherTgt',
    });
    act(() => result.current.handleReplaceRepairIssue(makeIssue({ kind: 'type-mismatch' })));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', { targetPath: '$.otherTgt' });
  });

  it('handleOpenRepairIssue skips bulk source when issue sourceId differs from active source', () => {
    const { result, mocks } = setup({ activeSourceId: 'src-active' });
    act(() => result.current.handleOpenRepairIssue(makeIssue({ sourceId: 'other-src' })));
    expect(mocks.setBulkTargetPath).toHaveBeenCalledWith('$.tgt');
    expect(mocks.setBulkSourceId).not.toHaveBeenCalled();
    expect(mocks.setBulkSourcePath).not.toHaveBeenCalled();
  });

  it('handleReplaceRepairIssue uses activeSourceId when mapping has no sourceId', () => {
    const mappings = [
      { id: 'm1', sourcePath: '$.src', targetPath: '$.tgt' },
    ] as Mapping[];
    const { result, mocks } = setup({
      mappings,
      activeSourceId: 'src-1',
      bulkSourcePath: '$.picked',
      bulkSourceId: 'src-1',
    });
    act(() => result.current.handleReplaceRepairIssue(makeIssue({ kind: 'type-mismatch' })));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', {
      sourcePath: '$.picked',
      sourceId: 'src-1',
      expression: undefined,
    });
  });

  it('handleReplaceRepairIssue keeps expression when source replace is not type-mismatch', () => {
    const { result, mocks } = setup({
      bulkSourcePath: '$.replacement',
      bulkSourceId: 'src-2',
      bulkTargetPath: null,
      mappings: [
        {
          id: 'm1',
          sourcePath: '$.src',
          sourceId: 'src-1',
          targetPath: '$.tgt',
          expression: '$keepMe',
        },
      ],
    });
    act(() => result.current.handleReplaceRepairIssue(makeIssue({ kind: 'missing-target' })));
    expect(mocks.updateMapping).toHaveBeenCalledWith('m1', {
      sourcePath: '$.replacement',
      sourceId: 'src-2',
    });
  });

  it('handleOpenRepairIssue hydrates bulk source when issue.sourceId is empty (falls back to active)', () => {
    const { result, mocks } = setup({ activeSourceId: 'src-1' });
    act(() => result.current.handleOpenRepairIssue(makeIssue({ sourceId: '' })));
    expect(mocks.setBulkSourceId).toHaveBeenCalledWith('src-1');
    expect(mocks.setBulkSourcePath).toHaveBeenCalledWith('$.src');
  });
});

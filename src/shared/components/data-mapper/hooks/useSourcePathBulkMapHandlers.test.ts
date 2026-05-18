/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useSourcePathBulkMapHandlers } from './useSourcePathBulkMapHandlers';
import type { Mapping } from '../types';

function renderBulkHandlers(opts: {
  mappings?: Mapping[];
  initialSelection?: Set<string>;
}) {
  const handleMapFilteredFields = vi.fn();
  const removeMappings = vi.fn();
  const { mappings = [], initialSelection = new Set<string>() } = opts;

  const { result } = renderHook(() => {
    const [selectedSourcePaths, setSelectedSourcePaths] = useState(initialSelection);
    const { handleMapSelectedFields, handleUnmapSelectedFields } = useSourcePathBulkMapHandlers({
      handleMapFilteredFields,
      setSelectedSourcePaths,
      mappings,
      removeMappings,
    });
    return {
      selectedSourcePaths,
      handleMapSelectedFields,
      handleUnmapSelectedFields,
    };
  });

  return { result, handleMapFilteredFields, removeMappings };
}

describe('useSourcePathBulkMapHandlers', () => {
  it('handleMapSelectedFields forwards paths and sourceId then clears selection', () => {
    const sel = new Set(['a', 'b']);
    const { result, handleMapFilteredFields } = renderBulkHandlers({ initialSelection: sel });

    expect(result.current.selectedSourcePaths.size).toBe(2);

    act(() => {
      result.current.handleMapSelectedFields(['x', 'y'], 'src-1');
    });

    expect(handleMapFilteredFields).toHaveBeenCalledTimes(1);
    expect(handleMapFilteredFields).toHaveBeenCalledWith(['x', 'y'], 'src-1');
    expect(result.current.selectedSourcePaths.size).toBe(0);
  });

  it('handleMapSelectedFields still invokes map and clears selection when paths array is empty', () => {
    const sel = new Set(['only-selection']);
    const { result, handleMapFilteredFields } = renderBulkHandlers({ initialSelection: sel });

    act(() => {
      result.current.handleMapSelectedFields([], 's1');
    });

    expect(handleMapFilteredFields).toHaveBeenCalledWith([], 's1');
    expect(result.current.selectedSourcePaths.size).toBe(0);
  });

  it('handleUnmapSelectedFields removes mappings whose sourcePath normalizes to selected paths', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'user.name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'user.age', sourceId: 's1', targetPath: 'userAge' },
    ];
    const sel = new Set(['ignored-until-unmap']);
    const { result, removeMappings } = renderBulkHandlers({ mappings, initialSelection: sel });

    act(() => {
      result.current.handleUnmapSelectedFields(['$.user.name']);
    });

    expect(removeMappings).toHaveBeenCalledTimes(1);
    expect(removeMappings).toHaveBeenCalledWith(['m1']);
    expect(result.current.selectedSourcePaths.size).toBe(0);
  });

  it('handleUnmapSelectedFields removes every mapping matching any normalized path', () => {
    const mappings: Mapping[] = [
      { id: 'a', sourcePath: 'foo', sourceId: 's1', targetPath: 'a' },
      { id: 'b', sourcePath: 'bar', sourceId: 's1', targetPath: 'b' },
      { id: 'c', sourcePath: 'baz', sourceId: 's1', targetPath: 'c' },
    ];
    const { result, removeMappings } = renderBulkHandlers({ mappings });

    act(() => {
      result.current.handleUnmapSelectedFields(['foo', '$.baz']);
    });

    expect(removeMappings).toHaveBeenCalledWith(expect.arrayContaining(['a', 'c']));
    expect(removeMappings.mock.calls[0][0]).toHaveLength(2);
  });

  it('handleUnmapSelectedFields does not call removeMappings when no paths match', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'only.here', sourceId: 's1', targetPath: 't' },
    ];
    const sel = new Set(['x']);
    const { result, removeMappings } = renderBulkHandlers({ mappings, initialSelection: sel });

    act(() => {
      result.current.handleUnmapSelectedFields(['other.path']);
    });

    expect(removeMappings).not.toHaveBeenCalled();
    expect(result.current.selectedSourcePaths.size).toBe(0);
  });

  it('handleUnmapSelectedFields does not call removeMappings when paths is empty', () => {
    const mappings: Mapping[] = [{ id: 'm1', sourcePath: 'x', sourceId: 's1', targetPath: 'y' }];
    const { result, removeMappings } = renderBulkHandlers({ mappings });

    act(() => {
      result.current.handleUnmapSelectedFields([]);
    });

    expect(removeMappings).not.toHaveBeenCalled();
    expect(result.current.selectedSourcePaths.size).toBe(0);
  });

  it('handleUnmapSelectedFields clears selection even when mappings array is empty', () => {
    const sel = new Set(['p']);
    const { result, removeMappings } = renderBulkHandlers({
      mappings: [],
      initialSelection: sel,
    });

    act(() => {
      result.current.handleUnmapSelectedFields(['anything']);
    });

    expect(removeMappings).not.toHaveBeenCalled();
    expect(result.current.selectedSourcePaths.size).toBe(0);
  });
});

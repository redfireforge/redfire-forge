/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataMapperDrop } from './useDataMapperDrop';
import type { MapperTarget, Mapping } from '../types';
import type { PatternPropagationPreview } from '../utils/patternPropagation';

const sourceSample = {
  outer: {
    childA: 10,
    childB: 20,
    childC: 30,
  },
};

interface DropHookOpts {
  effectiveTarget?: MapperTarget;
  getEffectiveSourceData?: ReturnType<typeof vi.fn>;
  selectedSourcePaths?: Set<string>;
  selectedMappingId?: string | null;
  autoMapDefaultOperator?: Mapping['operator'];
  setMappings?: ReturnType<typeof vi.fn>;
  setToast?: ReturnType<typeof vi.fn>;
  setSelectedSourcePaths?: ReturnType<typeof vi.fn>;
  selectMapping?: ReturnType<typeof vi.fn>;
  setBulkSourcePath?: ReturnType<typeof vi.fn>;
  setBulkSourceId?: ReturnType<typeof vi.fn>;
  setBulkTargetPath?: ReturnType<typeof vi.fn>;
}

function mkDeps(mappings: Mapping[], opts: DropHookOpts = {}) {
  const setMappings = opts.setMappings ?? vi.fn();
  const setToast = opts.setToast ?? vi.fn();

  const defaultTarget = {
    label: 'Target',
    sampleData: JSON.stringify({
      outer: {
        childA: 0,
        childB: 0,
        childC: 0,
      },
    }),
    fields: [
      { path: 'outer.childA', label: '' },
      { path: 'outer.childB', label: '' },
      { path: 'outer.childC', label: '' },
    ],
  } satisfies MapperTarget;

  return {
    mappings,
    activeSourceId: 'src1',
    selectedMappingId: opts.selectedMappingId ?? null,
    getEffectiveSourceData:
      opts.getEffectiveSourceData
      ?? vi.fn().mockReturnValue(sourceSample),
    effectiveTarget: opts.effectiveTarget ?? defaultTarget,
    setMappings,
    setToast,
    setSelectedSourcePaths: opts.setSelectedSourcePaths ?? vi.fn(),
    setSelectedIds: vi.fn(),
    selectMapping: opts.selectMapping ?? vi.fn(),
    selectedSourcePaths: opts.selectedSourcePaths ?? new Set<string>(),
    setBulkSourcePath: opts.setBulkSourcePath ?? vi.fn(),
    setBulkSourceId: opts.setBulkSourceId ?? vi.fn(),
    setBulkTargetPath: opts.setBulkTargetPath ?? vi.fn(),
    ...(opts.autoMapDefaultOperator != null ? { autoMapDefaultOperator: opts.autoMapDefaultOperator } : {}),
  };
}

describe('useDataMapperDrop', () => {
  it('memoizes subtree trees derived from identical samples across renders', () => {
    const stableDeps = mkDeps([]);
    const { result, rerender } = renderHook(
      ({ d }: { d: ReturnType<typeof mkDeps> }) => useDataMapperDrop(d),
      {
        initialProps: { d: stableDeps },
      },
    );
    const first = result.current.sourceTreeForDrop;
    rerender({ d: stableDeps });
    expect(result.current.sourceTreeForDrop).toBe(first);
  });

  it('drops propagation leaves when resolving source produces null samples', () => {
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        getEffectiveSourceData: vi.fn().mockReturnValue(null),
        effectiveTarget: { label: 'empty' },
      })),
    );
    expect(result.current.sourceLeafPathsForPropagation).toEqual([]);
    expect(result.current.targetLeafPathsForPropagation).toEqual([]);
  });

  it('returns undefined suggestion when stringify fails while parsing resolver output', () => {
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        getEffectiveSourceData: vi.fn().mockReturnValue('not-json:{'),
      })),
    );
    expect(
      result.current.suggestDropExpression('outer.childA', 'src1', 'outer.childA'),
    ).toBeUndefined();
  });

  it('returns undefined coercion hints when resolver samples are absent', () => {
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        getEffectiveSourceData: vi.fn().mockReturnValue(undefined),
      })),
    );
    expect(
      result.current.suggestDropExpression('outer.childA', 'src1', 'outer.childA'),
    ).toBeUndefined();
  });

  it('suppresses coercion when inferred paths already satisfy typed targets', () => {
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        effectiveTarget: {
          label: 'tgt',
          sampleData: JSON.stringify(sourceSample.outer),
          fields: [{ path: 'childA', label: '', type: 'number' }],
        },
        getEffectiveSourceData: vi.fn().mockReturnValue(sourceSample),
      })),
    );
    expect(
      result.current.suggestDropExpression('outer.childB', 'src1', 'outer.childB'),
    ).toBeUndefined();
  });

  it('applies subtree plans when planners emit matching pairs', () => {
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setMappings })));

    act(() => {
      result.current.prepareSubtreeDropPlanRef.current = () => ({
        pairs: [{ sourcePath: 'outer.childA', targetPath: 'outer.childA' }],
      });
      result.current.handleDrop('outer', 'outer', 'src1');
    });

    expect(setMappings).toHaveBeenCalled();
    expect(result.current.draggedSourceRef.current).toBeNull();
  });

  it('summarizes subtree merges that simultaneously insert and update siblings', () => {
    const setToast = vi.fn();
    const setMappings = vi.fn();
    const legacy = {
      id: 'legacy',
      sourceId: 'src1',
      sourcePath: 'outer.shadow',
      targetPath: 'outer.childB',
    } satisfies Mapping;

    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([legacy], { setToast, setMappings })),
    );

    act(() => {
      result.current.prepareSubtreeDropPlanRef.current = () => ({
        pairs: [
          { sourcePath: 'outer.childC', targetPath: 'outer.childC' },
          { sourcePath: 'outer.childB', targetPath: 'outer.childB' },
        ],
      });
      result.current.handleDrop('outer', 'outer', 'src1');
    });

    expect(setMappings).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith('Mapped 2 fields (1 new, 1 updated)');
    expect(result.current.draggedSourceRef.current).toBeNull();
  });

  it('falls back to literal upserts for object drops lacking planners', () => {
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setMappings })),
    );

    expect(result.current.prepareSubtreeDropPlanRef.current).toBeNull();

    act(() => {
      result.current.handleDrop('outer', 'outer', 'src1');
    });

    expect(setMappings).toHaveBeenCalled();
  });

  it('warns subtree drops that cannot reconcile child nodes', () => {
    const setToast = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setToast })));

    act(() => {
      result.current.prepareSubtreeDropPlanRef.current = () => ({ pairs: [] });
      result.current.handleDrop('outer', 'outer', 'src1');
    });

    expect(setToast).toHaveBeenCalledWith('No matching child fields found for object drop');
    expect(result.current.draggedSourceRef.current).toBeNull();
  });

  it('shows no-change toast when subtree merges see fully resolved targets', () => {
    const setToast = vi.fn();
    const existing = {
      id: 'prior',
      sourceId: 'src1',
      sourcePath: 'outer.childA',
      targetPath: 'outer.childA',
    } satisfies Mapping;
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([existing], { setToast })));

    act(() => {
      result.current.prepareSubtreeDropPlanRef.current = () => ({
        pairs: [{ sourcePath: 'outer.childA', targetPath: 'outer.childA' }],
      });
      result.current.handleDrop('outer', 'outer', 'src1');
    });

    expect(setToast).toHaveBeenCalledWith('No changes - matching targets already mapped');
  });

  it('fans out multi-selection drops across compatible leaves', () => {
    const setMappings = vi.fn();
    const setToast = vi.fn();
    const setSelectedSourcePaths = vi.fn();

    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        setMappings,
        setToast,
        setSelectedSourcePaths,
        selectedSourcePaths: new Set(['outer.childA', 'outer.childB']),
      })),
    );

    act(() => {
      result.current.handleDrop('outer.childA', 'outer.childA', 'src1');
    });

    expect(setMappings).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith(expect.stringMatching(/^Mapped\b/));
    expect(setSelectedSourcePaths).toHaveBeenCalledWith(new Set<string>());
    expect(result.current.draggedSourceRef.current).toBeNull();
  });

  it('delegates solitary drops without bulk merge when multisets omit the dragged leaf', () => {
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        setMappings,
        selectedSourcePaths: new Set(['outer.childA', 'outer.childB']),
      })),
    );

    act(() => {
      result.current.handleDrop('outer.childC', 'outer.childC', 'src1');
    });

    expect(setMappings).toHaveBeenCalled();
  });

  it('notifies callers when stacked drops cannot occupy any target', () => {
    const alreadyMappedLeaf = {
      id: 'dup',
      sourceId: 'src1',
      sourcePath: 'outer.childA',
      targetPath: 'outer.childA',
    } satisfies Mapping;
    const blockedSibling = {
      id: 'block',
      sourceId: 'src1',
      sourcePath: 'outer.childZ',
      targetPath: 'outer.childB',
    } satisfies Mapping;
    const setToast = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([alreadyMappedLeaf, blockedSibling], {
        setToast,
        selectedSourcePaths: new Set(['outer.childA', 'outer.childB']),
      })),
    );

    act(() => {
      result.current.handleDrop('outer.childA', 'outer.childA', 'src1');
    });

    expect(setToast).toHaveBeenCalledWith('No new mappings - targets already mapped or no matches');
  });

  it('drops single primitives without subtree planners attached', () => {
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setMappings })));

    act(() => {
      result.current.handleDrop('outer.childC', 'outer.childC', 'src1');
    });

    expect(setMappings).toHaveBeenCalled();
  });

  it('avoids redundant redraws when solitary drops repeat existing bindings', () => {
    const setMappings = vi.fn();
    const baseline = {
      id: 'steady',
      sourceId: 'src1',
      sourcePath: 'outer.childA',
      targetPath: 'outer.childA',
    } satisfies Mapping;

    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([baseline], { setMappings })),
    );

    act(() => {
      result.current.handleDrop('outer.childA', 'outer.childA', 'src1');
    });

    expect(setMappings).not.toHaveBeenCalled();
  });

  it('maps filtered sibling paths when target slots stay free', () => {
    const setToast = vi.fn();
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setMappings, setToast })),
    );

    act(() => {
      result.current.handleMapFilteredFields(
        ['outer.childA', 'outer.childC'],
        'src1',
      );
    });

    expect(setMappings).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith('Mapped 2 fields');
  });

  it('uses singular toast copy for single-entry batch maps', () => {
    const setToast = vi.fn();
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setMappings, setToast })),
    );

    act(() => {
      result.current.handleMapFilteredFields(['outer.childA'], 'src1');
    });

    expect(setToast).toHaveBeenCalledWith('Mapped 1 field');
  });

  it('reuses operator defaults when mapper injects normalized rows', () => {
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        setMappings,
        autoMapDefaultOperator: 'regex',
      })),
    );

    act(() => {
      result.current.handleMapFilteredFields(['outer.childA'], 'src1');
    });

    expect(setMappings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ operator: 'regex' }),
      ]),
    );
  });

  it('does nothing when callers pass an empty filtered field list', () => {
    const setToast = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setToast })),
    );

    act(() => {
      result.current.handleMapFilteredFields([], 'src1');
    });

    expect(setToast).not.toHaveBeenCalled();
  });

  it('reports when filtered auto-map targets are already mirrored', () => {
    const setToast = vi.fn();
    const duplicate = {
      id: 'already',
      sourceId: 'src1',
      sourcePath: 'outer.childC',
      targetPath: 'outer.childC',
    } satisfies Mapping;

    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([duplicate], { setToast })),
    );

    act(() => {
      result.current.handleMapFilteredFields(['outer.childC'], 'src1');
    });

    expect(setToast).toHaveBeenCalledWith('All filtered fields are already mapped');
  });

  it('guides preview propagation when nothing is anchored', () => {
    const setToast = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setToast })),
    );

    act(() => {
      result.current.handlePreviewPropagation();
    });

    expect(setToast).toHaveBeenCalledWith('Select an indexed mapping first');
  });

  it('rejects previews when anchored ids evaporate mid-session', () => {
    const setToast = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        setToast,
        selectedMappingId: 'missing',
      })),
    );

    act(() => {
      result.current.handlePreviewPropagation();
    });

    expect(setToast).toHaveBeenCalledWith('Selected mapping is no longer available');
  });

  it('signals when anchors cannot propagate patterns', () => {
    const setToast = vi.fn();
    const simple = {
      id: 'no-index',
      sourceId: 'src1',
      sourcePath: 'outer.childA',
      targetPath: 'outer.childA',
    } satisfies Mapping;
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([simple], {
        selectedMappingId: 'no-index',
        setToast,
      })),
    );

    act(() => {
      result.current.handlePreviewPropagation();
    });

    expect(setToast).toHaveBeenCalledWith('Selected mapping is not eligible for index propagation');
  });

  it('derives coercion hints once inferred types collide with constrained targets', () => {
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        effectiveTarget: {
          label: 'tgt',
          sampleData: JSON.stringify(sourceSample.outer),
          fields: [{ path: 'outer.childA', label: '', type: 'string' }],
        },
        getEffectiveSourceData: vi.fn().mockReturnValue(sourceSample),
      })),
    );

    expect(result.current.suggestDropExpression('outer.childA', 'src1', 'outer.childA')).toContain('$toString');
  });

  it('parses string resolver payloads before inferring coercion hints', () => {
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        effectiveTarget: {
          label: 't',
          sampleData: '{"outer":{"childA":"","childB":"","childC":""}}',
          fields: [{ path: 'outer.childA', label: '', type: 'boolean' }],
        },
        getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify(sourceSample)),
      })),
    );

    expect(result.current.suggestDropExpression('outer.childA', 'src1', 'outer.childA')).toBeDefined();
  });

  it('skips coercion when target paths lack metadata for resolution', () => {
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        effectiveTarget: {
          label: 'sparse',
          sampleData: '{"outer":{"childA":0,"childB":0,"childC":0}}',
          fields: [{ path: 'outer.childA', label: '' }],
        },
        getEffectiveSourceData: vi.fn().mockReturnValue({
          outer: {
            ...sourceSample.outer,
            shadowOnlyField: true,
          },
        }),
      })),
    );

    expect(
      result.current.suggestDropExpression('outer.shadowOnlyField', 'src1', 'outer.unknownLeaf'),
    ).toBeUndefined();
  });

  it('records drag lifecycle metadata for downstream consumers', () => {
    const selectMapping = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { selectMapping })),
    );

    act(() => {
      result.current.handleDragStart('outer.childA', 'src1');
    });

    expect(selectMapping).toHaveBeenCalledWith(null);
    expect(result.current.getDraggedSource()).toEqual({ path: 'outer.childA', sourceId: 'src1' });

    act(() => {
      result.current.handleSourceDragEnd();
    });

    expect(result.current.getDraggedSource()).toBeNull();
  });

  it('forwards bulk selection intents to coordinating setters', () => {
    const setBulkSourcePath = vi.fn();
    const setBulkSourceId = vi.fn();
    const setBulkTargetPath = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], {
        setBulkSourcePath,
        setBulkSourceId,
        setBulkTargetPath,
      })),
    );

    act(() => {
      result.current.handleSelectSourceNode('deep.path', 'src9');
      result.current.handleSelectTargetNode('other.path');
    });

    expect(setBulkSourcePath).toHaveBeenCalledWith('deep.path');
    expect(setBulkSourceId).toHaveBeenCalledWith('src9');
    expect(setBulkTargetPath).toHaveBeenCalledWith('other.path');
  });

  it('captures previews for anchored indexed paths', () => {
    const sourceDoc = JSON.stringify({ orders: [{ id: 'a' }, { id: 'b' }] });
    const targetDoc = JSON.stringify({ mirrored: [{ id: '' }, { id: '' }] });

    const anchor = {
      id: 'idx',
      sourceId: 'src1',
      sourcePath: 'orders[0].id',
      targetPath: 'mirrored[0].id',
    } satisfies Mapping;

    const parsedSource = JSON.parse(sourceDoc);
    const setMappings = vi.fn();
    const setToast = vi.fn();

    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([anchor], {
        setMappings,
        setToast,
        effectiveTarget: { label: 't', sampleData: targetDoc },
        getEffectiveSourceData: vi.fn().mockReturnValue(parsedSource),
        selectedMappingId: 'idx',
      })),
    );

    act(() => {
      result.current.handlePreviewPropagation();
    });

    expect(result.current.propagationPreview?.rows?.length ?? 0).toBeGreaterThan(0);

    act(() => {
      result.current.handleApplyPropagation();
    });

    expect(setMappings).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith(expect.stringContaining('Propagated pattern'));
    expect(result.current.propagationPreview).toBeNull();
  });

  it('scores propagated substitutions against prior targets as updates', () => {
    const setMappings = vi.fn();
    const setToast = vi.fn();
    const prior = {
      id: 'occ',
      sourceId: 'src1',
      sourcePath: 'outer.childZ',
      targetPath: 'outer.childB',
    } satisfies Mapping;

    const staged: PatternPropagationPreview = {
      anchorMappingId: 'anchor',
      anchorSourcePath: 'outer.childZ',
      anchorTargetPath: 'outer.childB',
      sourceId: 'src1',
      insertedCount: 0,
      updatedCount: 1,
      unchangedCount: 0,
      missingSourceCount: 2,
      rows: [
        {
          action: 'update',
          targetPath: 'outer.childB',
          sourcePath: 'outer.childC',
          projectedExpression: '$toString($.outer.childC)',
        },
      ],
    };

    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([prior], { setMappings, setToast })),
    );

    act(() => {
      result.current.setPropagationPreview(staged);
    });

    act(() => {
      result.current.handleApplyPropagation();
    });

    expect(setMappings).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith('Propagated pattern (0 new, 1 updated, 2 skipped)');
    expect(result.current.propagationPreview).toBeNull();
  });

  it('ignores propagated updates when persisted tuples already satisfy the projection', () => {
    const setToast = vi.fn();
    const setMappings = vi.fn();
    const prior = {
      id: 'steady',
      sourceId: 'src1',
      sourcePath: 'outer.childA',
      targetPath: 'outer.childB',
    } satisfies Mapping;

    const preview: PatternPropagationPreview = {
      anchorMappingId: 'noop-update',
      anchorSourcePath: 'outer.childZ',
      anchorTargetPath: 'outer.childZ',
      sourceId: 'src1',
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 1,
      missingSourceCount: 0,
      rows: [
        {
          action: 'update',
          targetPath: 'outer.childB',
          sourcePath: 'outer.childA',
          projectedExpression: undefined,
        },
      ],
    };

    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([prior], { setToast, setMappings })),
    );

    act(() => {
      result.current.setPropagationPreview(preview);
    });

    act(() => {
      result.current.handleApplyPropagation();
    });

    expect(setMappings).not.toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith('No changes - propagated mappings already up to date');
    expect(result.current.propagationPreview).toBeNull();
  });

  it('closes previews when propagated rows introduce no deltas', () => {
    const setToast = vi.fn();
    const { result } = renderHook(() => useDataMapperDrop(mkDeps([], { setToast })));

    const stagnantPreview: PatternPropagationPreview = {
      anchorMappingId: 'anchor',
      anchorSourcePath: 'outer.childA',
      anchorTargetPath: 'outer.childA',
      sourceId: 'src1',
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 1,
      missingSourceCount: 0,
      rows: [
        {
          targetPath: 'outer.childA',
          sourcePath: 'outer.childB',
          action: 'unchanged',
        },
      ],
    };

    act(() => {
      result.current.setPropagationPreview(stagnantPreview);
    });

    act(() => {
      result.current.handleApplyPropagation();
    });

    expect(setToast).toHaveBeenCalledWith('No changes - propagated mappings already up to date');
    expect(result.current.propagationPreview).toBeNull();
  });

  it('ignores propagation application when previews are inactive', () => {
    const setMappings = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperDrop(mkDeps([], { setMappings })),
    );

    act(() => {
      result.current.handleApplyPropagation();
    });

    expect(setMappings).not.toHaveBeenCalled();
    expect(result.current.propagationPreview).toBeNull();
  });
});

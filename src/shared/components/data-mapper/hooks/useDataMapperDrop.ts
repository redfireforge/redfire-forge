import { useCallback, useMemo, useRef, useState } from 'react';
import type { Mapping } from '../types';
import type { FieldOperator } from '../../../types';
import type { PatternPropagationPreview } from '../utils/patternPropagation';
import { buildPatternPropagationPreview } from '../utils/patternPropagation';
import { upsertTargetMapping, bulkDropMappings } from '../utils/dropMapping';
import { parseSampleToTree, buildTargetTree } from '../utils/mapperTreeBuilders';
import { normalizeMapperPath } from '../utils/pathNormalization';
import {
  findNodeByPath,
  applyDropPairs,
  buildDropSummary,
} from '../utils/subtreeMapping';
import { getAllLeafPaths } from '../../../utils/jsonTreeModel';
import { getByPath } from '../../../utils/jsonPath';
import {
  inferType,
  resolveTargetType,
  suggestTypeFixExpression,
  typesCompatible,
} from '../utils/typeMismatch';
import type { MapperTarget } from '../types';

export type PrepareSubtreeDropPlanFn = (sourcePath: string, targetPath: string) => { pairs: Array<{ sourcePath: string; targetPath: string }> };

interface UseDataMapperDropDeps {
  mappings: Mapping[];
  activeSourceId: string;
  selectedMappingId: string | null;
  getEffectiveSourceData: (sourceId: string) => unknown;
  effectiveTarget: MapperTarget;
  setMappings: (m: Mapping[]) => void;
  setToast: (msg: string) => void;
  setSelectedSourcePaths: (s: Set<string>) => void;
  setSelectedIds: (s: Set<string>) => void;
  selectMapping: (id: string | null) => void;
  selectedSourcePaths: Set<string>;
  setBulkSourcePath: (p: string | null) => void;
  setBulkSourceId: (p: string | null) => void;
  setBulkTargetPath: (p: string | null) => void;
  autoMapDefaultOperator?: FieldOperator;
}

export function useDataMapperDrop({
  mappings,
  activeSourceId,
  selectedMappingId,
  getEffectiveSourceData,
  effectiveTarget,
  setMappings,
  setToast,
  setSelectedSourcePaths,
  setSelectedIds,
  selectMapping,
  selectedSourcePaths,
    setBulkSourcePath,
    setBulkSourceId,
    setBulkTargetPath,
    autoMapDefaultOperator,
  }: UseDataMapperDropDeps) {
  const draggedSourceRef = useRef<{ path: string; sourceId: string } | null>(null);
  const prepareSubtreeDropPlanRef = useRef<PrepareSubtreeDropPlanFn | null>(null);
  const [propagationPreview, setPropagationPreview] = useState<PatternPropagationPreview | null>(null);

  const suggestDropExpression = useCallback((sourcePath: string, sourceId: string, targetPath: string): string | undefined => {
    const sourceData = getEffectiveSourceData(sourceId);
    if (sourceData == null) return undefined;

    let parsedSource: unknown;
    try {
      parsedSource = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
    } catch {
      return undefined;
    }

    const sourceVal = getByPath(parsedSource, sourcePath);
    if (sourceVal === undefined) return undefined;
    const sourceType = inferType(sourceVal);

    const targetType = resolveTargetType(targetPath, effectiveTarget);
    if (!targetType || typesCompatible(sourceType, targetType)) return undefined;

    return suggestTypeFixExpression(sourceType, targetType, sourcePath);
  }, [getEffectiveSourceData, effectiveTarget]);

  const sourceTreeForDrop = useMemo(
    () => parseSampleToTree(getEffectiveSourceData(activeSourceId)),
    [getEffectiveSourceData, activeSourceId],
  );

  const targetTreeForDrop = useMemo(
    () => buildTargetTree(effectiveTarget).tree,
    [effectiveTarget],
  );

  const sourceLeafPathsForPropagation = useMemo(
    () => sourceTreeForDrop ? getAllLeafPaths(sourceTreeForDrop).filter((path) => path.length > 0) : [],
    [sourceTreeForDrop],
  );
  const targetLeafPathsForPropagation = useMemo(
    () => targetTreeForDrop ? getAllLeafPaths(targetTreeForDrop).filter((path) => path.length > 0) : [],
    [targetTreeForDrop],
  );

  const handleSelectSourceNode = useCallback((path: string, _sourceId: string) => {
    setBulkSourcePath(path);
    setBulkSourceId(_sourceId);
  }, [setBulkSourcePath, setBulkSourceId]);

  const handleSelectTargetNode = useCallback((path: string) => {
    setBulkTargetPath(path);
  }, [setBulkTargetPath]);

  const handleMapFilteredFields = useCallback(
    (paths: string[], sourceId: string) => {
      if (paths.length === 0) return;
      const existingTargets = new Set(
        mappings.map((m) => normalizeMapperPath(m.targetPath)),
      );
      const newMappings: Mapping[] = paths
        .filter((p) => !existingTargets.has(normalizeMapperPath(p)))
        .map((p, i) => ({
          id: `map-${Date.now()}-${i}`,
          sourceId,
          sourcePath: p,
          targetPath: p,
          ...(autoMapDefaultOperator ? { operator: autoMapDefaultOperator } : {}),
        }));
      if (newMappings.length === 0) {
        setToast('All filtered fields are already mapped');
        return;
      }
      setMappings([...mappings, ...newMappings]);
      setToast(`Mapped ${newMappings.length} field${newMappings.length !== 1 ? 's' : ''}`);
    },
    [mappings, setMappings, setToast, autoMapDefaultOperator],
  );

  const handleDrop = useCallback(
    (targetPath: string, sourcePath: string, sourceId: string) => {
      if (selectedSourcePaths.size > 1 && selectedSourcePaths.has(sourcePath)) {
        const { nextMappings, appliedCount } = bulkDropMappings(
          mappings,
          Array.from(selectedSourcePaths),
          sourcePath,
          targetPath,
          sourceId,
          effectiveTarget.fields?.map((f) => f.path) ?? [],
          suggestDropExpression,
        );
        if (appliedCount > 0) {
          setMappings(nextMappings);
          setToast(`Mapped ${appliedCount} field${appliedCount !== 1 ? 's' : ''}`);
        } else {
          setToast('No new mappings - targets already mapped or no matches');
        }
        setSelectedSourcePaths(new Set());
        draggedSourceRef.current = null;
        return;
      }

      const sourceNode = sourceTreeForDrop ? findNodeByPath(sourceTreeForDrop, sourcePath) : null;
      const targetNode = targetTreeForDrop ? findNodeByPath(targetTreeForDrop, targetPath) : null;
      const sourceHasChildren = !!(sourceNode?.children && sourceNode.children.length > 0);
      const targetHasChildren = !!(targetNode?.children && targetNode.children.length > 0);

      if (sourceHasChildren && targetHasChildren && prepareSubtreeDropPlanRef.current) {
        const { pairs: plannedPairs } = prepareSubtreeDropPlanRef.current(
          sourcePath,
          targetPath,
        );

        if (plannedPairs.length === 0) {
          setToast('No matching child fields found for object drop');
          draggedSourceRef.current = null;
          return;
        }

        const { nextMappings, insertedCount, updatedCount, unchangedCount } = applyDropPairs(
          mappings,
          plannedPairs,
          sourceId,
          suggestDropExpression,
        );
        const changedCount = insertedCount + updatedCount;

        if (changedCount > 0) {
          setMappings(nextMappings);
          setToast(buildDropSummary(changedCount, insertedCount, updatedCount));
        } else if (unchangedCount > 0) {
          setToast('No changes - matching targets already mapped');
        }
        draggedSourceRef.current = null;
        return;
      }

      const suggestedExpression = suggestDropExpression(sourcePath, sourceId, targetPath);
      const applied = upsertTargetMapping(mappings, sourcePath, sourceId, targetPath, suggestedExpression);
      if (applied.changed) {
        setMappings(applied.next);
      }
      draggedSourceRef.current = null;
    },
    [mappings, selectedSourcePaths, setMappings, effectiveTarget.fields, suggestDropExpression, sourceTreeForDrop, targetTreeForDrop, setSelectedSourcePaths, setToast],
  );

  const handlePreviewPropagation = useCallback(() => {
    if (!selectedMappingId) {
      setToast('Select an indexed mapping first');
      return;
    }
    const anchorMapping = mappings.find((mapping) => mapping.id === selectedMappingId);
    if (!anchorMapping) {
      setToast('Selected mapping is no longer available');
      return;
    }
    const preview = buildPatternPropagationPreview(
      anchorMapping,
      mappings,
      sourceLeafPathsForPropagation,
      targetLeafPathsForPropagation,
      activeSourceId,
    );
    if (!preview) {
      setToast('Selected mapping is not eligible for index propagation');
      return;
    }
    setPropagationPreview(preview);
  }, [
    selectedMappingId,
    mappings,
    activeSourceId,
    sourceLeafPathsForPropagation,
    targetLeafPathsForPropagation,
    setToast,
  ]);

  const handleApplyPropagation = useCallback(() => {
    if (!propagationPreview) return;
    let nextMappings = [...mappings];
    let insertedCount = 0;
    let updatedCount = 0;

    const actionableRows = propagationPreview.rows.filter(
      (row) => row.action === 'new' || row.action === 'update',
    );
    for (const row of actionableRows) {
      const hadTargetMapping = nextMappings.some(
        (mapping) => normalizeMapperPath(mapping.targetPath) === row.targetPath,
      );
      const applied = upsertTargetMapping(
        nextMappings,
        row.sourcePath,
        propagationPreview.sourceId,
        row.targetPath,
        row.projectedExpression,
      );
      if (!applied.changed) continue;
      nextMappings = applied.next;
      if (hadTargetMapping) {
        updatedCount += 1;
      } else {
        insertedCount += 1;
      }
    }

    const changedCount = insertedCount + updatedCount;
    if (changedCount === 0) {
      setToast('No changes - propagated mappings already up to date');
      setPropagationPreview(null);
      return;
    }

    setMappings(nextMappings);
    setPropagationPreview(null);
    setToast(
      `Propagated pattern (${insertedCount} new, ${updatedCount} updated, ${propagationPreview.missingSourceCount} skipped)`,
    );
  }, [propagationPreview, setMappings, mappings, setToast]);

  const handleDragStart = useCallback((path: string, sourceId: string) => {
    selectMapping(null);
    setSelectedIds(new Set());
    draggedSourceRef.current = { path, sourceId };
  }, [selectMapping, setSelectedIds]);

  const handleSourceDragEnd = useCallback(() => {
    draggedSourceRef.current = null;
  }, []);

  const getDraggedSource = useCallback(() => draggedSourceRef.current, []);

  return {
    draggedSourceRef,
    prepareSubtreeDropPlanRef,
    propagationPreview,
    setPropagationPreview,
    suggestDropExpression,
    sourceTreeForDrop,
    targetTreeForDrop,
    sourceLeafPathsForPropagation,
    targetLeafPathsForPropagation,
    handleSelectSourceNode,
    handleSelectTargetNode,
    handleMapFilteredFields,
    handleDrop,
    handlePreviewPropagation,
    handleApplyPropagation,
    handleDragStart,
    handleSourceDragEnd,
    getDraggedSource,
  };
}

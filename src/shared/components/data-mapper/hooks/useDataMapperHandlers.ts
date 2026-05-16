import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Mapping, FieldOperator } from '../types';
import type { PatternPropagationPreview } from '../utils/patternPropagation';
import type { InferredMapping } from '../utils/exampleInference';

interface UseDataMapperHandlersDeps {
  mappings: Mapping[];
  activeSourceId: string;
  clearAll: () => void;
  selectMapping: (id: string | null) => void;
  updateMapping: (id: string, patch: Partial<Mapping>) => void;
  setMappings: (m: Mapping[]) => void;
  setSelectedIds: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedSourcePaths: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setBulkSourcePath: (p: string | null) => void;
  setBulkSourceId: (p: string | null) => void;
  setBulkTargetPath: (p: string | null) => void;
  setPropagationPreview: (p: PatternPropagationPreview | null) => void;
  setLineFocusNode: (node: { region: 'source' | 'target'; path: string } | null) => void;
  setEditingMappingId: (id: string | null) => void;
  setTargetResetSignal: (fn: (value: number | null) => number | null) => void;
  setToast: (msg: string | null) => void;
  resetDraggedSource: () => void;
}

export function useDataMapperHandlers({
  mappings,
  activeSourceId,
  clearAll,
  selectMapping,
  updateMapping,
  setMappings,
  setSelectedIds,
  setSelectedSourcePaths,
  setBulkSourcePath,
  setBulkSourceId,
  setBulkTargetPath,
  setPropagationPreview,
  setLineFocusNode,
  setEditingMappingId,
  setTargetResetSignal,
  setToast,
    resetDraggedSource,
  }: UseDataMapperHandlersDeps) {
  const handleEditExpression = useCallback((mappingId: string) => {
    setEditingMappingId(mappingId);
  }, [setEditingMappingId]);

  const handleClearAllMappings = useCallback(() => {
    clearAll();
    selectMapping(null);
    setSelectedIds(new Set());
    setSelectedSourcePaths(new Set());
    setBulkSourcePath(null);
    setBulkSourceId(null);
    setBulkTargetPath(null);
    setPropagationPreview(null);
    setLineFocusNode(null);
    resetDraggedSource();
    setTargetResetSignal((value) => (value ?? 0) + 1);
    setToast('Cleared all mappings');
  }, [clearAll, selectMapping, setSelectedIds, setSelectedSourcePaths, setBulkSourcePath, setBulkSourceId, setBulkTargetPath, setPropagationPreview, setLineFocusNode, resetDraggedSource, setTargetResetSignal, setToast]);

  const handleSaveExpression = useCallback((mappingId: string, expression: string) => {
    updateMapping(mappingId, { expression });
    setEditingMappingId(null);
  }, [updateMapping, setEditingMappingId]);

  const handleQuickFix = useCallback((mappingId: string, suggestedExpression: string) => {
    updateMapping(mappingId, { expression: suggestedExpression });
  }, [updateMapping]);

  const handleApplySuggestion = useCallback((mappingId: string, expression: string) => {
    updateMapping(mappingId, { expression });
    setToast('Expression applied');
  }, [updateMapping, setToast]);

  const handleUpdateMappingOperator = useCallback((mappingId: string, operator: FieldOperator | undefined, operatorValue: string | undefined) => {
    updateMapping(mappingId, { operator, operatorValue });
  }, [updateMapping]);

  const handleToggleMappingNegate = useCallback((mappingId: string) => {
    const m = mappings.find((mm: Mapping) => mm.id === mappingId);
    updateMapping(mappingId, { negate: m?.negate ? undefined : true });
  }, [mappings, updateMapping]);

  const handleExampleInferenceApply = useCallback((inferred: InferredMapping[]) => {
    const newMappings: Mapping[] = inferred.map((r) => ({
      id: uuidv4(),
      sourcePath: r.sourcePath,
      sourceId: activeSourceId,
      targetPath: r.targetPath,
      isPending: true,
      ...(r.expression ? { expression: r.expression } : {}),
    }));
    const existingTargets = new Set(mappings.map((m) => m.targetPath));
    const deduped = newMappings.filter((m) => !existingTargets.has(m.targetPath));
    if (deduped.length === 0) {
      setToast('No new mappings — all targets already mapped');
      return;
    }
    setMappings([...mappings, ...deduped]);
    setToast(`${deduped.length} mapping${deduped.length !== 1 ? 's' : ''} inferred from examples`);
  }, [activeSourceId, mappings, setMappings, setToast]);

  const handleToggleSelectMapping = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedIds]);

  const handleToggleSourcePath = useCallback((path: string) => {
    setSelectedSourcePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, [setSelectedSourcePaths]);

  return {
    handleEditExpression,
    handleClearAllMappings,
    handleSaveExpression,
    handleQuickFix,
    handleApplySuggestion,
    handleUpdateMappingOperator,
    handleToggleMappingNegate,
    handleExampleInferenceApply,
    handleToggleSelectMapping,
    handleToggleSourcePath,
  };
}

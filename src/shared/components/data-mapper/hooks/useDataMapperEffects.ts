import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { MapperAdapter, Mapping } from '../types';
import { buildJsonTree, getAllLeafPaths } from '../../../utils/jsonTreeModel';
import { savePattern } from '../utils/mappingPatterns';
import { detectTypeMismatches } from '../utils/typeMismatch';
import { suggestExpressionsForAll } from '../utils/expressionSuggestions';
import { normalizeMapperPath } from '../utils/pathNormalization';
import type { MapperTarget } from '../types';
import type { PatternPropagationPreview } from '../utils/patternPropagation';

interface UseDataMapperEffectsDeps {
  adapter: MapperAdapter;
  mappings: Mapping[];
  activeSourceId: string;
  getEffectiveSourceData: (sourceId: string) => unknown;
  effectiveTarget: MapperTarget;
  setSourceSample: (sourceId: string, data: unknown) => void;
  setSelectedSourcePaths: (s: Set<string>) => void;
  setSelectedIds: (s: Set<string>) => void;
  setBulkSourcePath: (p: string | null) => void;
  setBulkSourceId: (p: string | null) => void;
  setBulkTargetPath: (p: string | null) => void;
  setPropagationPreview: (p: PatternPropagationPreview | null) => void;
  propagationPreview: PatternPropagationPreview | null;
  resetDraggedSource: () => void;
  showMappingLines: boolean;
  nodeFocusMode: boolean;
  setLineFocusNode: (node: { region: 'source' | 'target'; path: string } | null) => void;
  setAdvancedControlsOpen: (open: boolean) => void;
  previousMappingCountRef: React.RefObject<number>;
  sourceSampleOverrides: Record<string, unknown>;
}

export function useDataMapperEffects({
  adapter,
  mappings,
  activeSourceId,
  getEffectiveSourceData,
  effectiveTarget,
  setSourceSample,
  setSelectedSourcePaths,
  setSelectedIds,
  setBulkSourcePath,
  setBulkSourceId,
  setBulkTargetPath,
  setPropagationPreview,
    propagationPreview,
    resetDraggedSource,
    showMappingLines,
  nodeFocusMode,
  setLineFocusNode,
  setAdvancedControlsOpen,
  previousMappingCountRef,
  sourceSampleOverrides,
}: UseDataMapperEffectsDeps) {
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setFetchError(null);
    setSelectedSourcePaths(new Set());
    setSelectedIds(new Set());
    setBulkSourcePath(null);
    setBulkSourceId(null);
    setBulkTargetPath(null);
    setPropagationPreview(null);
    resetDraggedSource();
    setLineFocusNode(null);
  }, [activeSourceId, setSelectedSourcePaths, setSelectedIds, setBulkSourcePath, setBulkSourceId, setBulkTargetPath, setPropagationPreview, resetDraggedSource, setLineFocusNode]);

  useEffect(() => {
    if (showMappingLines) setLineFocusNode(null);
  }, [showMappingLines, setLineFocusNode]);

  useEffect(() => {
    if (!propagationPreview) return;
    const anchorStillExists = mappings.some((mapping) => mapping.id === propagationPreview.anchorMappingId);
    if (!anchorStillExists) {
      setPropagationPreview(null);
    }
  }, [propagationPreview, mappings, setPropagationPreview]);

  useEffect(() => {
    if (!nodeFocusMode) setLineFocusNode(null);
  }, [nodeFocusMode, setLineFocusNode]);

  useEffect(() => {
    const previousCount = previousMappingCountRef.current;
    if (previousCount! < 8 && mappings.length >= 8) {
      setAdvancedControlsOpen(false);
    }
    (previousMappingCountRef as React.MutableRefObject<number>).current = mappings.length;
  }, [mappings.length, previousMappingCountRef, setAdvancedControlsOpen]);

  const patternSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const confirmedMappings = mappings.filter((m) => !m.isPending);
    if (confirmedMappings.length === 0 || !adapter.contextId) return;
    if (patternSaveTimerRef.current) clearTimeout(patternSaveTimerRef.current);
    patternSaveTimerRef.current = setTimeout(() => {
      try {
        const sourceData = getEffectiveSourceData(activeSourceId);
        const targetData = adapter.target.sampleData;
        if (sourceData == null || targetData == null) return;
        const parsedSrc = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
        const parsedTgt = typeof targetData === 'string' ? JSON.parse(targetData) : targetData;
        const srcTree = buildJsonTree(parsedSrc, '', '');
        const tgtTree = buildJsonTree(parsedTgt, '', '');
        const srcPaths = getAllLeafPaths(srcTree);
        const tgtPaths = getAllLeafPaths(tgtTree);
        savePattern(adapter.contextId!, srcPaths, tgtPaths, confirmedMappings);
      } catch { /* ignore save errors */ }
    }, 2000);
    return () => { if (patternSaveTimerRef.current) clearTimeout(patternSaveTimerRef.current); };
  }, [mappings, adapter.contextId, adapter.target.sampleData, getEffectiveSourceData, activeSourceId]);

  const activeSourceIdRef = useRef(activeSourceId);
  activeSourceIdRef.current = activeSourceId;

  const handleFetchSample = useCallback(async () => {
    if (!adapter.fetchSampleData) return;
    const requestedSourceId = activeSourceIdRef.current;
    setFetchError(null);
    try {
      const data = await adapter.fetchSampleData();
      if (data != null && activeSourceIdRef.current === requestedSourceId) {
        setSourceSample(requestedSourceId, data);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch sample data');
    }
  }, [adapter, setSourceSample]);

  const effectiveSources = useMemo(() => {
    return adapter.sources.map((s) => ({
      ...s,
      sampleData: sourceSampleOverrides[s.id] ?? s.sampleData,
    }));
  }, [adapter.sources, sourceSampleOverrides]);

  const typeMismatches = useMemo(
    () => detectTypeMismatches(mappings, effectiveSources, effectiveTarget, activeSourceId),
    [mappings, effectiveSources, effectiveTarget, activeSourceId],
  );

  const mismatchIds = useMemo(
    () => new Set(typeMismatches.map((m) => m.mappingId)),
    [typeMismatches],
  );

  const expressionSuggestions = useMemo(
    () => suggestExpressionsForAll(mappings, effectiveSources, effectiveTarget),
    [mappings, effectiveSources, effectiveTarget],
  );

  const mappedSourcePaths = useMemo(
    () => new Set(
      mappings
        .filter((m) => (m.sourceId || activeSourceId) === activeSourceId)
        .map((m) => normalizeMapperPath(m.sourcePath)),
    ),
    [mappings, activeSourceId],
  );

  return {
    fetchError,
    setFetchError,
    handleFetchSample,
    effectiveSources,
    typeMismatches,
    mismatchIds,
    expressionSuggestions,
    mappedSourcePaths,
  };
}

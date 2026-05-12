import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { MapperAdapter, Mapping } from './types';
import { useMapperState } from './hooks/useMapperState';
import { useConnectionLines, useLayoutTick } from './hooks/useConnectionLines';
import { computeAutoMapCandidates } from './utils/autoMapAlgorithm';
import type { AutoMapCandidate } from './utils/autoMapAlgorithm';
import {
  detectTypeMismatches,
  inferType,
  resolveTargetType,
  suggestTypeFixExpression,
  typesCompatible,
} from './utils/typeMismatch';
import { detectArrayMappings } from './utils/arrayMapping';
import type { ArrayLineKind } from './hooks/useConnectionLines';
import { buildJsonTree, getAllLeafPaths } from '../../utils/jsonTreeModel';
import { getByPath } from '../../utils/jsonPath';
import { savePattern, loadPattern, patternToSuggestions } from './utils/mappingPatterns';
import type { PatternEntry } from './utils/mappingPatterns';
import SourcePanel from './SourcePanel';
import TargetPanel from './TargetPanel';
import MappingCanvas from './MappingCanvas';
import MapperToolbar from './MapperToolbar';
import type { MapperGallerySample } from './utils/gallerySamples';
import ExpressionEditorModal from './ExpressionEditorModal';
import PreviewBar from './PreviewBar';
import CodeView from './CodeView';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import '../../../styles/data-mapper.css';
import '../../../styles/data-mapper-expression.css';

import type { DriftIndicator } from './SourceTreeNode';
import type { MappingTrace } from './utils/mappingTrace';
import { formatTraceValue, isTraceError } from './utils/mappingTrace';
import { suggestExpressionsForAll } from './utils/expressionSuggestions';
import ExampleInferenceModal from './ExampleInferenceModal';
import ErrorPopover from './ErrorPopover';
import type { InferredMapping } from './utils/exampleInference';
import { useDebugOverlay } from './hooks/useDebugOverlay';
import MappingHealthDashboard from './MappingHealthDashboard';
import { buildTreeFromFields } from './utils/targetTreeBuilder';
import type { RepairSuggestion } from './utils/schemaRepair';
import MapperFooter from './MapperFooter';
import { useTargetFields } from './hooks/useTargetFields';
import { usePanelResize } from './hooks/usePanelResize';
import { useMapperKeyboard } from './hooks/useMapperKeyboard';
import { useMappingOverlay } from './hooks/useMappingOverlay';
import { upsertTargetMapping, bulkDropMappings } from './utils/dropMapping';

interface DataMapperProps<TOutput = unknown> {
  adapter: MapperAdapter<TOutput>;
  initialData?: TOutput;
  onChange?: (mappings: Mapping[]) => void;
  onSourceSampleChange?: (overrides: Record<string, unknown>) => void;
  height?: number | string;
  driftMap?: Map<string, DriftIndicator>;
  driftMappingIds?: Map<string, 'warning' | 'breaking'>;
  repairTick?: number;
  repairedMappingsRef?: React.RefObject<Mapping[]>;
  traceData?: MappingTrace[];
  repairSuggestions?: Map<string, RepairSuggestion[]>;
  onApplyRepair?: (mappingId: string, suggestion: RepairSuggestion) => void;
  onShowDrift?: () => void;
}

type LineFocusNode = { region: 'source' | 'target'; path: string } | null;

export default function DataMapper<TOutput = unknown>({
  adapter,
  initialData,
  onChange,
  onSourceSampleChange,
  height = 500,
  driftMap,
  driftMappingIds,
  repairTick,
  repairedMappingsRef,
  traceData,
  repairSuggestions,
  onApplyRepair,
  onShowDrift,
}: DataMapperProps<TOutput>) {
  const initialMappings = useMemo(() => {
    if (!initialData) return [];
    try {
      return adapter.deserialize(initialData);
    } catch {
      return [];
    }
  }, [adapter, initialData]);

  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showMappingLines, setShowMappingLines] = useState(true);
  const [nodeFocusMode, setNodeFocusMode] = useState(false);
  const [lineFocusNode, setLineFocusNode] = useState<LineFocusNode>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedSourcePaths, setSelectedSourcePaths] = useState<Set<string>>(new Set());
  const sourceSearchRef = useRef<HTMLInputElement | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);
  const draggedSourceRef = useRef<{ path: string; sourceId: string } | null>(null);
  const autoMapScoresRef = useRef<Map<string, number>>(new Map());
  const patternMappingIdsRef = useRef<Set<string>>(new Set());

  const {
    state,
    removeMapping,
    removeMappings,
    updateMapping,
    clearAll,
    selectMapping,
    setActiveSource,
    setSourceSample,
    setMappings,
    acceptPending,
    rejectPending,
    acceptAllPending,
    rejectAllPending,
    replaceMappingsFromProps,
    undo,
    redo,
    canUndo,
    canRedo,
    hasPending,
  } = useMapperState({
    initialMappings,
    initialSourceId: adapter.sources[0]?.id ?? '',
  });

  const prevInitialDataRef = useRef(initialData);
  const prevAdapterRef = useRef(adapter);
  useEffect(() => {
    if (prevInitialDataRef.current === initialData && prevAdapterRef.current === adapter) return;
    prevInitialDataRef.current = initialData;
    prevAdapterRef.current = adapter;
    try {
      replaceMappingsFromProps(initialData ? adapter.deserialize(initialData) : []);
    } catch {
      replaceMappingsFromProps([]);
    }
  }, [initialData, adapter, replaceMappingsFromProps]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const layoutTick = useLayoutTick(containerRef);
  const [showCodeView, setShowCodeView] = useState(false);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  const { focusRegion, focusedPath, setFocusRegion, handleTreeKeyDown } = useKeyboardNavigation({
    containerRef,
    disabled: !!editingMappingId,
  });

  const {
    effectiveTarget,
    targetFetchError,
    handleAddCustomField,
    handleRemoveCustomField,
    handleUpdateCustomField,
    handleFetchTargetSchema,
    handlePasteTargetSample,
    handleReorderTargetField,
    handleTargetFieldDragStart,
    handleTargetFieldDragEnd,
    getDraggedTargetFieldPath,
  } = useTargetFields({
    adapter,
    mappings: state.mappings,
    removeMappings,
    updateMapping,
  });

  const { sourcePanelWidth, targetPanelWidth, canvasWidth, handleResizeStart } = usePanelResize(containerRef);

  const prevRepairTickRef = useRef(repairTick ?? 0);
  const skipNextOnChangeRef = useRef(false);

  useEffect(() => {
    const tick = repairTick ?? 0;
    if (tick !== prevRepairTickRef.current) {
      prevRepairTickRef.current = tick;
      if (repairedMappingsRef?.current) {
        const repaired = repairedMappingsRef.current;
        skipNextOnChangeRef.current = true;
        setMappings(repaired);
        onChange?.(repaired);
      }
      return;
    }
    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      return;
    }
    onChange?.(state.mappings);
  }, [repairTick, repairedMappingsRef, setMappings, state.mappings, onChange]);

  useEffect(() => {
    onSourceSampleChange?.(state.sourceSampleOverrides);
  }, [state.sourceSampleOverrides, onSourceSampleChange]);

  useEffect(() => {
    const currentIds = new Set(state.mappings.map((m) => m.id));
    for (const id of autoMapScoresRef.current.keys()) {
      if (!currentIds.has(id)) autoMapScoresRef.current.delete(id);
    }
    for (const id of patternMappingIdsRef.current) {
      if (!currentIds.has(id)) patternMappingIdsRef.current.delete(id);
    }
  }, [state.mappings]);

  const getEffectiveSourceData = useCallback((sourceId: string): unknown => {
    return state.sourceSampleOverrides[sourceId]
      ?? adapter.sources.find((s) => s.id === sourceId)?.sampleData;
  }, [state.sourceSampleOverrides, adapter.sources]);

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

  const handleDrop = useCallback(
    (targetPath: string, sourcePath: string, sourceId: string) => {
      if (selectedSourcePaths.size > 1 && selectedSourcePaths.has(sourcePath)) {
        const { nextMappings, appliedCount } = bulkDropMappings(
          state.mappings,
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
          setToast('No new mappings — targets already mapped or no matches');
        }
        setSelectedSourcePaths(new Set());
        draggedSourceRef.current = null;
        return;
      }

      const suggestedExpression = suggestDropExpression(sourcePath, sourceId, targetPath);
      const applied = upsertTargetMapping(state.mappings, sourcePath, sourceId, targetPath, suggestedExpression);
      if (applied.changed) {
        setMappings(applied.next);
      }
      draggedSourceRef.current = null;
    },
    [state.mappings, selectedSourcePaths, setMappings, effectiveTarget.fields, suggestDropExpression],
  );

  const handleDragStart = useCallback((path: string, sourceId: string) => {
    selectMapping(null);
    setSelectedIds(new Set());
    draggedSourceRef.current = { path, sourceId };
  }, [selectMapping]);

  const handleSourceDragEnd = useCallback(() => {
    draggedSourceRef.current = null;
  }, []);

  const getDraggedSource = useCallback(() => draggedSourceRef.current, []);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentMappingIds = useMemo(
    () => new Set(state.mappings.map((m) => m.id)),
    [state.mappings],
  );

  const {
    debugMode, setDebugMode,
    errorPopover, setErrorPopover, errorPopoverRef,
    traceByMappingId, hasTraceData,
    handleShowErrorDetail, traceErrorCount,
    sourceTraceOverlay, targetTraceOverlay,
  } = useDebugOverlay({ traceData, currentMappingIds, activeSourceId: state.activeSourceId });

  useEffect(() => {
    setFetchError(null);
    setSelectedSourcePaths(new Set());
    setSelectedIds(new Set());
    draggedSourceRef.current = null;
    setLineFocusNode(null);
  }, [state.activeSourceId]);

  useEffect(() => {
    if (showMappingLines) setLineFocusNode(null);
  }, [showMappingLines]);

  useEffect(() => {
    if (!nodeFocusMode) setLineFocusNode(null);
  }, [nodeFocusMode]);

  const patternSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const confirmedMappings = state.mappings.filter((m) => !m.isPending);
    if (confirmedMappings.length === 0 || !adapter.contextId) return;
    if (patternSaveTimerRef.current) clearTimeout(patternSaveTimerRef.current);
    patternSaveTimerRef.current = setTimeout(() => {
      try {
        const sourceData = getEffectiveSourceData(state.activeSourceId);
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
  }, [state.mappings, adapter.contextId, adapter.target.sampleData, getEffectiveSourceData, state.activeSourceId]);

  const activeSourceIdRef = useRef(state.activeSourceId);
  activeSourceIdRef.current = state.activeSourceId;

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
      sampleData: state.sourceSampleOverrides[s.id] ?? s.sampleData,
    }));
  }, [adapter.sources, state.sourceSampleOverrides]);

  const typeMismatches = useMemo(
    () => detectTypeMismatches(state.mappings, effectiveSources, effectiveTarget, state.activeSourceId),
    [state.mappings, effectiveSources, effectiveTarget, state.activeSourceId],
  );

  const mismatchIds = useMemo(
    () => new Set(typeMismatches.map((m) => m.mappingId)),
    [typeMismatches],
  );

  const expressionSuggestions = useMemo(
    () => suggestExpressionsForAll(state.mappings, effectiveSources, effectiveTarget),
    [state.mappings, effectiveSources, effectiveTarget],
  );

  const mappedSourcePaths = useMemo(
    () => new Set(
      state.mappings
        .filter((m) => (m.sourceId || state.activeSourceId) === state.activeSourceId)
        .map((m) => m.sourcePath.startsWith('$.') ? m.sourcePath.slice(2) : m.sourcePath),
    ),
    [state.mappings, state.activeSourceId],
  );

  const mappingResolution = useMemo(() => {
    const normalizePath = (path: string) => path.replace(/^\$\.?/, '');

    const sourcePathsById = new Map<string, Set<string>>();
    for (const source of effectiveSources) {
      const paths = new Set<string>();
      if (source.sampleData != null) {
        try {
          const parsed = typeof source.sampleData === 'string'
            ? JSON.parse(source.sampleData)
            : source.sampleData;
          const tree = buildJsonTree(parsed, '', '');
          for (const path of getAllLeafPaths(tree)) {
            paths.add(normalizePath(path));
          }
        } catch {
          // Keep empty set when sample cannot be parsed.
        }
      }
      sourcePathsById.set(source.id, paths);
    }

    const targetPaths = new Set<string>();
    if (effectiveTarget.sampleData != null) {
      try {
        const parsed = typeof effectiveTarget.sampleData === 'string'
          ? JSON.parse(effectiveTarget.sampleData)
          : effectiveTarget.sampleData;
        const tree = buildJsonTree(parsed, '', '');
        for (const path of getAllLeafPaths(tree)) {
          targetPaths.add(normalizePath(path));
        }
      } catch {
        // Keep empty set when target sample cannot be parsed.
      }
    } else if (effectiveTarget.fields && effectiveTarget.fields.length > 0) {
      for (const field of effectiveTarget.fields) {
        targetPaths.add(normalizePath(field.path));
      }
    }

    let unresolved = 0;
    for (const mapping of state.mappings) {
      const sourceId = mapping.sourceId || state.activeSourceId;
      const sourcePath = normalizePath(mapping.sourcePath);
      const targetPath = normalizePath(mapping.targetPath);
      const sourceSet = sourcePathsById.get(sourceId);
      const sourceMissing = !sourceSet || sourceSet.size === 0 || !sourceSet.has(sourcePath);
      const targetMissing = targetPaths.size === 0 || !targetPaths.has(targetPath);
      if (sourceMissing || targetMissing) unresolved += 1;
    }

    return {
      unresolved,
      resolved: Math.max(state.mappings.length - unresolved, 0),
    };
  }, [state.mappings, state.activeSourceId, effectiveSources, effectiveTarget.sampleData, effectiveTarget.fields]);

  const arrayMappingInfos = useMemo(
    () => detectArrayMappings(state.mappings, effectiveSources, effectiveTarget, state.activeSourceId),
    [state.mappings, effectiveSources, effectiveTarget, state.activeSourceId],
  );

  const arrayInfoMap = useMemo(() => {
    const map = new Map<string, { kind: ArrayLineKind; label?: string }>();
    for (const info of arrayMappingInfos) {
      map.set(info.mappingId, { kind: info.kind, label: info.label });
    }
    return map;
  }, [arrayMappingInfos]);

  const { lines: rawLines, containerHeight } = useConnectionLines(state.mappings, containerRef, layoutTick, mismatchIds, arrayInfoMap);

  const lines = useMemo(() => {
    return rawLines.map((line) => {
      let updated = line;
      const score = autoMapScoresRef.current.get(line.mappingId);
      if (score != null) updated = { ...updated, confidenceScore: score };
      if (patternMappingIdsRef.current.has(line.mappingId)) updated = { ...updated, isFromPattern: true };
      if (driftMappingIds && driftMappingIds.size > 0) {
        const severity = driftMappingIds.get(line.mappingId);
        if (severity) updated = { ...updated, driftSeverity: severity };
      }
      if (debugMode && traceByMappingId) {
        const trace = traceByMappingId.get(line.mappingId);
        if (trace) {
          updated = {
            ...updated,
            traceValue: formatTraceValue(trace.targetValue, 20),
            traceError: isTraceError(trace),
          };
        }
      }
      return updated;
    });
  }, [rawLines, driftMappingIds, debugMode, traceByMappingId]);

  const visibleLines = useMemo(() => {
    if (showMappingLines) return lines;
    if (!nodeFocusMode || !lineFocusNode) return [];
    const normalizePath = (path: string) => path.replace(/^\$\.?/, '');
    const fp = normalizePath(lineFocusNode.path);
    if (lineFocusNode.region === 'source') {
      return lines.filter((line) => normalizePath(line.sourcePath) === fp);
    }
    return lines.filter((line) => normalizePath(line.targetPath) === fp);
  }, [lines, showMappingLines, nodeFocusMode, lineFocusNode]);

  const mappedTargetValueOverlay = useMappingOverlay(
    state.mappings,
    state.activeSourceId,
    effectiveSources,
    adapter.customFunctions,
  );

  const autoMapCandidates = useMemo<AutoMapCandidate[]>(() => {
    const sourceData = getEffectiveSourceData(state.activeSourceId);
    const targetData = adapter.target.sampleData;
    if (sourceData == null || targetData == null) return [];
    try {
      const parsedSource = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
      const parsedTarget = typeof targetData === 'string' ? JSON.parse(targetData) : targetData;
      const srcTree = buildJsonTree(parsedSource, '', '');
      const tgtTree = buildJsonTree(parsedTarget, '', '');
      return computeAutoMapCandidates(srcTree, tgtTree, state.mappings, {
        sourceData: parsedSource, targetData: parsedTarget,
      });
    } catch {
      return [];
    }
  }, [getEffectiveSourceData, adapter.target.sampleData, state.activeSourceId, state.mappings]);

  const autoMapCandidateCount = useMemo(
    () => autoMapCandidates.filter((c) => c.score >= confidenceThreshold).length,
    [autoMapCandidates, confidenceThreshold],
  );

  const handleLoadGallerySample = useCallback((sample: MapperGallerySample) => {
    const adapterSourceIds = new Set(adapter.sources.map((s) => s.id));
    for (const sampleSrc of sample.sources) {
      if (sampleSrc.sampleData == null) continue;
      const targetId = adapterSourceIds.has(sampleSrc.id)
        ? sampleSrc.id
        : adapter.sources[0]?.id ?? state.activeSourceId;
      setSourceSample(targetId, sampleSrc.sampleData);
    }
    setMappings(sample.mappings);
    setSelectedIds(new Set());
    setSelectedSourcePaths(new Set());
    setToast(`Loaded sample: ${sample.name}`);
  }, [adapter.sources, state.activeSourceId, setSourceSample, setMappings]);

  const handleAutoMap = useCallback(() => {
    const filtered = autoMapCandidates.filter((c) => c.score >= confidenceThreshold);
    const allNew: Mapping[] = [];

    try {
      const sourceData = getEffectiveSourceData(state.activeSourceId);
      const targetData = adapter.target.sampleData;
      if (sourceData != null && targetData != null && adapter.contextId) {
        const parsedSrc = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
        const parsedTgt = typeof targetData === 'string' ? JSON.parse(targetData) : targetData;
        const srcTree = buildJsonTree(parsedSrc, '', '');
        const tgtTree = buildJsonTree(parsedTgt, '', '');
        const srcPaths = getAllLeafPaths(srcTree);
        const tgtPaths = getAllLeafPaths(tgtTree);
        const pattern = loadPattern(adapter.contextId, srcPaths, tgtPaths);
        if (pattern) {
          const currentSrcPaths = new Set(srcPaths);
          const currentTgtPaths = new Set(tgtPaths);
          const combined = [...state.mappings, ...allNew];
          const suggestions: PatternEntry[] = patternToSuggestions(pattern, currentSrcPaths, currentTgtPaths, combined);
          const mappedTargets = new Set(combined.map((m) => m.targetPath));
          const mappedSources = new Set(combined.map((m) => m.sourcePath));
          const filteredTargets = new Set(filtered.map((c) => c.targetPath));
          for (const s of suggestions) {
            if (mappedTargets.has(s.targetPath) || filteredTargets.has(s.targetPath)) continue;
            if (mappedSources.has(s.sourcePath)) continue;
            const m: Mapping = {
              id: uuidv4(),
              sourcePath: s.sourcePath,
              sourceId: state.activeSourceId,
              targetPath: s.targetPath,
              isPending: true,
              ...(s.expression ? { expression: s.expression } : {}),
            };
            allNew.push(m);
            patternMappingIdsRef.current.add(m.id);
            autoMapScoresRef.current.set(m.id, 95);
            mappedTargets.add(s.targetPath);
            mappedSources.add(s.sourcePath);
          }
        }
      }
    } catch { /* ignore pattern load errors */ }

    const patternTargets = new Set(allNew.map((m) => m.targetPath));
    for (let i = 0; i < filtered.length; i++) {
      if (patternTargets.has(filtered[i].targetPath)) continue;
      const m: Mapping = {
        id: uuidv4(),
        sourcePath: filtered[i].sourcePath,
        sourceId: state.activeSourceId,
        targetPath: filtered[i].targetPath,
        isAutoMapped: true,
        isPending: true,
      };
      allNew.push(m);
      autoMapScoresRef.current.set(m.id, filtered[i].score);
    }

    if (allNew.length === 0) return;
    setMappings([...state.mappings, ...allNew]);
    const patternCount = [...patternMappingIdsRef.current].filter((id) => allNew.some((m) => m.id === id)).length;
    const autoCount = allNew.length - patternCount;
    const parts: string[] = [];
    if (autoCount > 0) parts.push(`${autoCount} auto-mapped`);
    if (patternCount > 0) parts.push(`${patternCount} from patterns`);
    setToast(parts.join(', '));
  }, [autoMapCandidates, confidenceThreshold, state.activeSourceId, state.mappings, setMappings, getEffectiveSourceData, adapter.target.sampleData, adapter.contextId]);

  const handleEditExpression = useCallback((mappingId: string) => {
    setEditingMappingId(mappingId);
  }, []);

  const handleSaveExpression = useCallback((mappingId: string, expression: string) => {
    updateMapping(mappingId, { expression });
    setEditingMappingId(null);
  }, [updateMapping]);

  const handleQuickFix = useCallback((mappingId: string, suggestedExpression: string) => {
    updateMapping(mappingId, { expression: suggestedExpression });
  }, [updateMapping]);

  const handleApplySuggestion = useCallback((mappingId: string, expression: string) => {
    updateMapping(mappingId, { expression });
    setToast('Expression applied');
  }, [updateMapping]);

  const handleExampleInferenceApply = useCallback((inferred: InferredMapping[]) => {
    const newMappings: Mapping[] = inferred.map((r) => ({
      id: uuidv4(),
      sourcePath: r.sourcePath,
      sourceId: state.activeSourceId,
      targetPath: r.targetPath,
      isPending: true,
      ...(r.expression ? { expression: r.expression } : {}),
    }));
    const existingTargets = new Set(state.mappings.map((m) => m.targetPath));
    const deduped = newMappings.filter((m) => !existingTargets.has(m.targetPath));
    if (deduped.length === 0) {
      setToast('No new mappings — all targets already mapped');
      return;
    }
    setMappings([...state.mappings, ...deduped]);
    setToast(`${deduped.length} mapping${deduped.length !== 1 ? 's' : ''} inferred from examples`);
  }, [state.activeSourceId, state.mappings, setMappings]);

  const handleToggleSelectMapping = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSourcePath = useCallback((path: string) => {
    setSelectedSourcePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectedArrayInfo = useMemo(() => {
    if (!state.selectedMappingId) return null;
    return arrayMappingInfos.find((i) => i.mappingId === state.selectedMappingId) ?? null;
  }, [state.selectedMappingId, arrayMappingInfos]);

  const healthTargetTree = useMemo(() => {
    if (effectiveTarget.sampleData != null) {
      try {
        const data = typeof effectiveTarget.sampleData === 'string'
          ? JSON.parse(effectiveTarget.sampleData) : effectiveTarget.sampleData;
        return buildJsonTree(data, '', '');
      } catch { return null; }
    }
    if (effectiveTarget.fields && effectiveTarget.fields.length > 0) {
      return buildTreeFromFields(effectiveTarget.fields);
    }
    return null;
  }, [effectiveTarget.sampleData, effectiveTarget.fields]);

  const editingMapping = useMemo(
    () => editingMappingId ? state.mappings.find((m) => m.id === editingMappingId) ?? null : null,
    [editingMappingId, state.mappings],
  );

  useMapperKeyboard({
    undo,
    redo,
    selectedMappingId: state.selectedMappingId,
    removeMapping,
    removeMappings,
    selectMapping,
    editingMappingId,
    selectedIds,
    setSelectedIds,
    sourceSearchRef,
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleTreeNodeClickForLineFocus = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (showMappingLines || !nodeFocusMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
    const node = target.closest('.dm-tree-node[data-path]') as HTMLElement | null;
    if (!node) return;
    const path = node.getAttribute('data-path');
    if (!path) return;
    const region = node.closest('.dm-panel--source')
      ? 'source'
      : node.closest('.dm-panel--target')
        ? 'target'
        : null;
    if (!region) return;
    setLineFocusNode((prev) => {
      if (prev?.region === region && prev.path === path) return null;
      return { region, path };
    });
  }, [showMappingLines, nodeFocusMode]);

  return (
    <div className="dm-container" ref={containerRef} style={{ height }}>
      <MapperToolbar
        onAutoMap={handleAutoMap}
        onClearAll={clearAll}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        mappingCount={state.mappings.length}
        resolvedCount={mappingResolution.resolved}
        unresolvedCount={mappingResolution.unresolved}
        autoMapCount={autoMapCandidateCount}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((p) => !p)}
        hasPending={hasPending}
        onAcceptAllPending={acceptAllPending}
        onRejectAllPending={rejectAllPending}
        contextId={adapter.contextId}
        mappings={state.mappings}
        onLoadProfile={(m: Mapping[]) => { setMappings(m); setSelectedIds(new Set()); setSelectedSourcePaths(new Set()); }}
        showCodeView={showCodeView}
        onToggleCodeView={() => setShowCodeView((p) => !p)}
        onLoadGallerySample={handleLoadGallerySample}
        hasTraceData={hasTraceData}
        debugMode={debugMode}
        onToggleDebugMode={() => setDebugMode((d) => !d)}
        traceErrorCount={traceErrorCount}
        confidenceThreshold={confidenceThreshold}
        onConfidenceThresholdChange={setConfidenceThreshold}
        onLearnFromExamples={() => setShowExampleModal(true)}
        showMappingLines={showMappingLines}
        onToggleMappingLines={() => setShowMappingLines((s) => !s)}
        nodeFocusMode={nodeFocusMode}
        onToggleNodeFocusMode={() => setNodeFocusMode((s) => !s)}
        compactMode={compactMode}
        onToggleCompactMode={() => setCompactMode((mode) => !mode)}
      />
      {debugMode && hasTraceData && (
        <div className="dm-debug-bar" role="status" aria-live="polite">
          <span className="dm-debug-bar-label">Debug Overlay</span>
          <span className="dm-debug-bar-stats">
            {traceByMappingId!.size} trace{traceByMappingId!.size !== 1 ? 's' : ''}
            {traceErrorCount > 0 && (
              <span className="dm-debug-bar-errors"> · {traceErrorCount} error{traceErrorCount !== 1 ? 's' : ''}</span>
            )}
          </span>
        </div>
      )}
      <MappingHealthDashboard
        mappings={state.mappings}
        targetTree={healthTargetTree}
        driftMappingIds={driftMappingIds}
        typeMismatchCount={typeMismatches.length}
        onShowDrift={onShowDrift}
      />
      <div className="dm-body" onClickCapture={handleTreeNodeClickForLineFocus}>
        <div className="dm-panel-wrapper" style={sourcePanelWidth ? { width: sourcePanelWidth, flex: 'none' } : undefined}>
          <SourcePanel
            sources={effectiveSources}
            activeSourceId={state.activeSourceId}
            sourceSampleOverrides={state.sourceSampleOverrides}
            onSourceChange={setActiveSource}
            onDragStart={handleDragStart}
            onDragEnd={handleSourceDragEnd}
            onSourceSampleChange={setSourceSample}
            onFetchSample={adapter.fetchSampleData ? handleFetchSample : undefined}
            canFetch={!!adapter.fetchSampleData}
            fetchError={fetchError}
            searchInputRef={sourceSearchRef}
            selectedSourcePaths={selectedSourcePaths}
            onToggleSourcePath={handleToggleSourcePath}
            isFocusRegion={focusRegion === 'source'}
            focusedPath={focusRegion === 'source' ? focusedPath : null}
            onFocus={() => setFocusRegion('source')}
            onTreeKeyDown={handleTreeKeyDown}
            driftMap={driftMap}
            traceOverlay={sourceTraceOverlay}
            mappedPaths={mappedSourcePaths}
          />
        </div>
        <div
          className="dm-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize source panel"
          onMouseDown={(e) => handleResizeStart('source', e)}
        />
        <div className="dm-canvas-wrapper" style={{ width: canvasWidth, flex: 'none' }}>
          <MappingCanvas
            lines={visibleLines}
            width={canvasWidth}
            height={containerHeight || 400}
            selectedMappingId={state.selectedMappingId}
            selectedMappingIds={selectedIds}
            onSelectMapping={(id) => { selectMapping(id); setSelectedIds(new Set()); }}
            onToggleSelectMapping={handleToggleSelectMapping}
            onRemoveMapping={removeMapping}
            onEditExpression={handleEditExpression}
            onAcceptPending={acceptPending}
            onRejectPending={rejectPending}
            debugMode={debugMode}
            traceByMappingId={traceByMappingId}
            onShowErrorDetail={handleShowErrorDetail}
            expressionSuggestions={expressionSuggestions}
            onApplySuggestion={handleApplySuggestion}
            repairSuggestions={repairSuggestions}
            onApplyRepair={onApplyRepair}
          />
        </div>
        <div
          className="dm-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize target panel"
          onMouseDown={(e) => handleResizeStart('target', e)}
        />
        <div className="dm-panel-wrapper" style={targetPanelWidth ? { width: targetPanelWidth, flex: 'none' } : undefined}>
          <TargetPanel
            target={effectiveTarget}
            mappings={state.mappings}
            onDrop={handleDrop}
            selectedMappingId={state.selectedMappingId}
            onSelectMapping={(id) => { selectMapping(id); setSelectedIds(new Set()); }}
            onEditExpression={handleEditExpression}
            typeMismatches={typeMismatches}
            onQuickFix={handleQuickFix}
            onRemoveMapping={removeMapping}
            isFocusRegion={focusRegion === 'target'}
            focusedPath={focusRegion === 'target' ? focusedPath : null}
            onFocus={() => setFocusRegion('target')}
            onTreeKeyDown={handleTreeKeyDown}
            traceOverlay={debugMode ? targetTraceOverlay : mappedTargetValueOverlay}
            onAddCustomField={effectiveTarget.allowCustomFields ? handleAddCustomField : undefined}
            onRemoveCustomField={handleRemoveCustomField}
            onUpdateCustomField={handleUpdateCustomField}
            onFetchTargetSchema={adapter.fetchTargetSchema ? handleFetchTargetSchema : undefined}
            canFetchTarget={!!adapter.fetchTargetSchema}
            targetFetchError={targetFetchError}
            onPasteTargetSample={handlePasteTargetSample}
            onReorderField={effectiveTarget.sampleData == null ? handleReorderTargetField : undefined}
            onTargetFieldDragStart={handleTargetFieldDragStart}
            onTargetFieldDragEnd={handleTargetFieldDragEnd}
            getDraggedSource={getDraggedSource}
            getDraggedTargetFieldPath={getDraggedTargetFieldPath}
            resolvedMappingCount={mappingResolution.resolved}
            unresolvedMappingCount={mappingResolution.unresolved}
          />
        </div>
      </div>
      {selectedArrayInfo && (
        <div className="dm-array-suggestion-bar" role="status" aria-live="polite">
          <span className="dm-array-suggestion-label">
            {selectedArrayInfo.kind === 'loop'
              ? '∞ Array → Array: elements will be mapped one-to-one'
              : selectedArrayInfo.kind === 'aggregate'
                ? 'Σ Array → Scalar: needs an aggregation expression'
                : '⤑ Scalar → Array: value will be wrapped in an array'}
          </span>
          {selectedArrayInfo.suggestedExpression && (
            <button
              className="dm-array-suggestion-apply"
              onClick={() => {
                if (state.selectedMappingId && selectedArrayInfo.suggestedExpression) {
                  updateMapping(state.selectedMappingId, { expression: selectedArrayInfo.suggestedExpression });
                }
              }}
            >
              Apply: {selectedArrayInfo.suggestedExpression}
            </button>
          )}
        </div>
      )}
      {showCodeView && (
        <CodeView mappings={state.mappings} />
      )}
      {showPreview && (
        <PreviewBar
          mappings={state.mappings}
          sources={effectiveSources}
          activeSourceId={state.activeSourceId}
          targetSampleData={effectiveTarget.sampleData}
          customFunctions={adapter.customFunctions}
        />
      )}
      {editingMapping && (
        <ExpressionEditorModal
          mapping={editingMapping}
          sources={effectiveSources}
          activeSourceId={state.activeSourceId}
          customFunctions={adapter.customFunctions}
          onSave={handleSaveExpression}
          onCancel={() => setEditingMappingId(null)}
        />
      )}
      {toast && (
        <div className="dm-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      {errorPopover && (
        <ErrorPopover
          ref={errorPopoverRef}
          data={errorPopover.data}
          y={errorPopover.y}
          onClose={() => setErrorPopover(null)}
        />
      )}
      <MapperFooter
        mappings={state.mappings}
        arrayMappingInfos={arrayMappingInfos}
        typeMismatches={typeMismatches}
        resolvedCount={mappingResolution.resolved}
        unresolvedCount={mappingResolution.unresolved}
        compactMode={compactMode}
      />
      {showExampleModal && (
        <ExampleInferenceModal
          onClose={() => setShowExampleModal(false)}
          onApply={handleExampleInferenceApply}
        />
      )}
    </div>
  );
}

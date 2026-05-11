import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { MapperAdapter, Mapping } from './types';
import { useMapperState } from './hooks/useMapperState';
import { useConnectionLines, useLayoutTick } from './hooks/useConnectionLines';
import { computeAutoMapCandidates } from './utils/autoMapAlgorithm';
import type { AutoMapCandidate } from './utils/autoMapAlgorithm';
import { detectTypeMismatches } from './utils/typeMismatch';
import { detectArrayMappings } from './utils/arrayMapping';
import type { ArrayLineKind } from './hooks/useConnectionLines';
import { buildJsonTree, getAllLeafPaths } from '../../utils/jsonTreeModel';
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

interface DataMapperProps<TOutput = unknown> {
  adapter: MapperAdapter<TOutput>;
  initialData?: TOutput;
  onChange?: (mappings: Mapping[]) => void;
  onSourceSampleChange?: (overrides: Record<string, unknown>) => void;
  height?: number | string;
  driftMap?: Map<string, DriftIndicator>;
  driftMappingIds?: Map<string, 'warning' | 'breaking'>;
  /** Incremented when parent applies a repair — triggers re-read of currentMappingsRef. */
  repairTick?: number;
  /** Ref providing repaired mappings after a repair is applied. */
  repairedMappingsRef?: React.RefObject<Mapping[]>;
  /** Runtime mapping traces for debug overlay (Phase 9B). */
  traceData?: MappingTrace[];
}

const CANVAS_WIDTH = 120;

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
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedSourcePaths, setSelectedSourcePaths] = useState<Set<string>>(new Set());
  const sourceSearchRef = useRef<HTMLInputElement | null>(null);
  const [sourcePanelWidth, setSourcePanelWidth] = useState<number | null>(null);
  const [targetPanelWidth, setTargetPanelWidth] = useState<number | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);
  const autoMapScoresRef = useRef<Map<string, number>>(new Map());
  const patternMappingIdsRef = useRef<Set<string>>(new Set());

  const {
    state,
    addMapping,
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

  const { focusRegion, focusedPath, setFocusRegion, handleTreeKeyDown } = useKeyboardNavigation({
    containerRef,
    disabled: !!editingMappingId,
  });

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

  const handleDrop = useCallback(
    (targetPath: string, sourcePath: string, sourceId: string) => {
      // Bulk drop: map the dragged source to the actual drop target,
      // then auto-map remaining selections by matching source leaf name → target leaf name
      if (selectedSourcePaths.size > 0 && selectedSourcePaths.has(sourcePath)) {
        const paths = Array.from(selectedSourcePaths);
        const existingTargets = new Set(state.mappings.map((m) => m.targetPath));

        // Build target leaf-name lookup for name-based matching
        const targetLeafPaths = adapter.target.fields?.map((f) => f.path) ?? [];
        const targetByLeaf = new Map<string, string>();
        for (const tp of targetLeafPaths) {
          const leaf = tp.split('.').pop()?.toLowerCase() ?? '';
          if (leaf && !targetByLeaf.has(leaf)) targetByLeaf.set(leaf, tp);
        }

        const newMappings: Mapping[] = [];
        for (const sp of paths) {
          let tp: string;
          if (sp === sourcePath) {
            tp = targetPath;
          } else {
            const leaf = sp.split('.').pop()?.toLowerCase() ?? '';
            const matched = leaf ? targetByLeaf.get(leaf) : undefined;
            if (!matched) continue;
            tp = matched;
          }
          if (existingTargets.has(tp)) continue;
          newMappings.push({ id: uuidv4(), sourcePath: sp, sourceId, targetPath: tp });
          existingTargets.add(tp);
        }
        if (newMappings.length > 0) {
          setMappings([...state.mappings, ...newMappings]);
          setToast(`Mapped ${newMappings.length} field${newMappings.length !== 1 ? 's' : ''}`);
        } else {
          setToast('No new mappings — targets already mapped or no matches');
        }
        setSelectedSourcePaths(new Set());
        return;
      }

      const existing = state.mappings.find((m) => m.targetPath === targetPath);
      if (existing) {
        removeMapping(existing.id);
      }
      addMapping({
        id: uuidv4(),
        sourcePath,
        sourceId,
        targetPath,
      });
    },
    [state.mappings, addMapping, removeMapping, selectedSourcePaths, setMappings, adapter.target],
  );

  const handleDragStart = useCallback(() => {
    selectMapping(null);
  }, [selectMapping]);

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
  }, [state.activeSourceId]);

  // Pattern learning: save confirmed mappings for future suggestions
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

  const effectiveSources: typeof adapter.sources = useMemo(() => {
    return adapter.sources.map((s) => ({
      ...s,
      sampleData: state.sourceSampleOverrides[s.id] ?? s.sampleData,
    }));
  }, [adapter.sources, state.sourceSampleOverrides]);

  const typeMismatches = useMemo(
    () => detectTypeMismatches(state.mappings, effectiveSources, adapter.target, state.activeSourceId),
    [state.mappings, effectiveSources, adapter.target, state.activeSourceId],
  );

  const mismatchIds = useMemo(
    () => new Set(typeMismatches.map((m) => m.mappingId)),
    [typeMismatches],
  );

  const expressionSuggestions = useMemo(
    () => suggestExpressionsForAll(state.mappings, effectiveSources, adapter.target),
    [state.mappings, effectiveSources, adapter.target],
  );

  const mappedSourcePaths = useMemo(
    () => new Set(
      state.mappings
        .filter((m) => (m.sourceId || state.activeSourceId) === state.activeSourceId)
        .map((m) => m.sourcePath.startsWith('$.') ? m.sourcePath.slice(2) : m.sourcePath),
    ),
    [state.mappings, state.activeSourceId],
  );

  const arrayMappingInfos = useMemo(
    () => detectArrayMappings(state.mappings, effectiveSources, adapter.target, state.activeSourceId),
    [state.mappings, effectiveSources, adapter.target, state.activeSourceId],
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

    // Load pattern suggestions first
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

    // Add name/semantic-based auto-map candidates
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
    const filtered = newMappings.filter((m) => !existingTargets.has(m.targetPath));
    if (filtered.length === 0) {
      setToast('No new mappings — all targets already mapped');
      return;
    }
    setMappings([...state.mappings, ...filtered]);
    setToast(`${filtered.length} mapping${filtered.length !== 1 ? 's' : ''} inferred from examples`);
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

  const footerStats = useMemo(() => {
    const expressionCount = state.mappings.filter((m) => !!m.expression).length;
    let loopCount = 0;
    let aggregateCount = 0;
    for (const info of arrayMappingInfos) {
      if (info.kind === 'loop') loopCount++;
      else if (info.kind === 'aggregate') aggregateCount++;
    }
    return {
      mapped: state.mappings.length,
      expressions: expressionCount,
      loops: loopCount,
      aggregates: aggregateCount,
      mismatches: typeMismatches.length,
    };
  }, [state.mappings, arrayMappingInfos, typeMismatches]);

  const editingMapping = useMemo(
    () => editingMappingId ? state.mappings.find((m) => m.id === editingMappingId) ?? null : null,
    [editingMappingId, state.mappings],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingMappingId) return;
      if (document.querySelector('.dm-expr-overlay') || document.querySelector('.dm-diff-overlay')) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (isEditable) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (isEditable) return;
        if (selectedIds.size > 0) {
          e.preventDefault();
          removeMappings(Array.from(selectedIds));
          setSelectedIds(new Set());
          return;
        }
        if (state.selectedMappingId) {
          e.preventDefault();
          removeMapping(state.selectedMappingId);
          return;
        }
      }
      if (e.key === 'Escape' && state.selectedMappingId) {
        if (isEditable) return;
        e.preventDefault();
        selectMapping(null);
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        if (isEditable) return;
        e.preventDefault();
        sourceSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, state.selectedMappingId, removeMapping, removeMappings, selectMapping, editingMappingId, selectedIds]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { resizeCleanupRef.current?.(); };
  }, []);

  const handleResizeStart = useCallback(
    (side: 'source' | 'target', e: React.MouseEvent) => {
      e.preventDefault();
      resizeCleanupRef.current?.();
      const startX = e.clientX;
      const body = containerRef.current?.querySelector('.dm-body') as HTMLElement | null;
      if (!body) return;
      const bodyRect = body.getBoundingClientRect();
      const startSourceW = sourcePanelWidth ?? bodyRect.width * 0.38;
      const startTargetW = targetPanelWidth ?? bodyRect.width * 0.38;
      const MIN_PANEL = 150;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        if (side === 'source') {
          const newW = Math.max(MIN_PANEL, Math.min(bodyRect.width - MIN_PANEL - CANVAS_WIDTH, startSourceW + delta));
          setSourcePanelWidth(newW);
        } else {
          const newW = Math.max(MIN_PANEL, Math.min(bodyRect.width - MIN_PANEL - CANVAS_WIDTH, startTargetW - delta));
          setTargetPanelWidth(newW);
        }
      };
      const cleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        resizeCleanupRef.current = null;
      };
      const onUp = () => { cleanup(); };
      resizeCleanupRef.current = cleanup;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [sourcePanelWidth, targetPanelWidth],
  );

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
      <div className="dm-body">
        <div className="dm-panel-wrapper" style={sourcePanelWidth ? { width: sourcePanelWidth, flex: 'none' } : undefined}>
          <SourcePanel
            sources={effectiveSources}
            activeSourceId={state.activeSourceId}
            sourceSampleOverrides={state.sourceSampleOverrides}
            onSourceChange={setActiveSource}
            onDragStart={handleDragStart}
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
        <div className="dm-canvas-wrapper">
          <MappingCanvas
            lines={lines}
            width={CANVAS_WIDTH}
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
            target={adapter.target}
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
            traceOverlay={targetTraceOverlay}
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
          targetSampleData={adapter.target.sampleData}
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
      <div className="dm-stats-footer" role="status">
        <div className="dm-stats-counters">
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--mapped">{footerStats.mapped}</span> mapped
          </span>
          {footerStats.expressions > 0 && (
            <span className="dm-stat">
              <span className="dm-stat-value dm-stat-value--expression">{footerStats.expressions}</span> expression{footerStats.expressions !== 1 ? 's' : ''}
            </span>
          )}
          {footerStats.loops > 0 && (
            <span className="dm-stat">
              <span className="dm-stat-value dm-stat-value--loop">{footerStats.loops}</span> loop{footerStats.loops !== 1 ? 's' : ''}
            </span>
          )}
          {footerStats.aggregates > 0 && (
            <span className="dm-stat">
              <span className="dm-stat-value dm-stat-value--aggregate">{footerStats.aggregates}</span> aggregate{footerStats.aggregates !== 1 ? 's' : ''}
            </span>
          )}
          {footerStats.mismatches > 0 && (
            <span className="dm-stat">
              <span className="dm-stat-value dm-stat-value--mismatch">{footerStats.mismatches}</span> mismatch{footerStats.mismatches !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <div className="dm-stats-shortcuts">
          <span className="dm-shortcut"><kbd className="dm-kbd">/</kbd> Search</span>
          <span className="dm-shortcut"><kbd className="dm-kbd">⌫</kbd> Delete</span>
          <span className="dm-shortcut"><kbd className="dm-kbd">⌘Z</kbd> Undo</span>
          <span className="dm-shortcut"><kbd className="dm-kbd">Tab</kbd> Switch panel</span>
        </div>
      </div>
      {showExampleModal && (
        <ExampleInferenceModal
          onClose={() => setShowExampleModal(false)}
          onApply={handleExampleInferenceApply}
        />
      )}
    </div>
  );
}

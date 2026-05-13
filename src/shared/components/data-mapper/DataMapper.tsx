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
import MappingTableView from './MappingTableView';
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
import ValidationRepairPanel, { type MapperRepairIssue } from './ValidationRepairPanel';
import { buildTreeFromFields } from './utils/targetTreeBuilder';
import type { RepairSuggestion } from './utils/schemaRepair';
import MapperFooter from './MapperFooter';
import { useTargetFields } from './hooks/useTargetFields';
import { usePanelResize } from './hooks/usePanelResize';
import { useMapperKeyboard } from './hooks/useMapperKeyboard';
import { useMappingOverlay } from './hooks/useMappingOverlay';
import { upsertTargetMapping, bulkDropMappings } from './utils/dropMapping';
import {
  isMapperPathWithin,
  isSameMapperPath,
  normalizeMapperPath,
} from './utils/pathNormalization';
import {
  buildPatternPropagationPreview,
  type PatternPropagationPreview,
} from './utils/patternPropagation';
import { applyProfileDelta } from './utils/mappingProfiles';
import {
  findNodeByPath,
  collectLeafPathsFromNode,
  getArrayParentPath,
  buildRelativePairs,
  applyDropPairs,
  buildDropSummary,
  type PathPair,
} from './utils/subtreeMapping';
import { useMappingDiagnostics } from './hooks/useMappingDiagnostics';

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
  unorderedDefault?: boolean;
  onToggleUnorderedArray?: (arrayPath: string) => void;
  hideAdvanced?: boolean;
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
  unorderedDefault,
  onToggleUnorderedArray,
  hideAdvanced = false,
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
  const [bottomUtilityMode, setBottomUtilityMode] = useState<'none' | 'code' | 'preview' | 'table'>('none');
  const [showMappingLines, setShowMappingLines] = useState(true);
  const [nodeFocusMode, setNodeFocusMode] = useState(false);
  const [lineFocusNode, setLineFocusNode] = useState<LineFocusNode>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedSourcePaths, setSelectedSourcePaths] = useState<Set<string>>(new Set());
  const [bulkSourcePath, setBulkSourcePath] = useState<string | null>(null);
  const [bulkSourceId, setBulkSourceId] = useState<string | null>(null);
  const [bulkTargetPath, setBulkTargetPath] = useState<string | null>(null);
  const [propagationPreview, setPropagationPreview] = useState<PatternPropagationPreview | null>(null);
  const [ignoredRepairIssueIds, setIgnoredRepairIssueIds] = useState<Set<string>>(new Set());
  const [targetResetSignal, setTargetResetSignal] = useState<number | null>(null);
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
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const showCodeView = bottomUtilityMode === 'code';
  const showPreview = bottomUtilityMode === 'preview';

  const handleTogglePreview = useCallback(() => {
    setBottomUtilityMode((mode) => (mode === 'preview' ? 'none' : 'preview'));
  }, []);

  const handleToggleCodeView = useCallback(() => {
    setBottomUtilityMode((mode) => (mode === 'code' ? 'none' : 'code'));
  }, []);

  const handleToggleTableView = useCallback(() => {
    setBottomUtilityMode((mode) => (mode === 'table' ? 'none' : 'table'));
  }, []);

  const [advancedControlsOpen, setAdvancedControlsOpen] = useState(() => initialMappings.length < 8);
  const previousMappingCountRef = useRef(initialMappings.length);

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

  useEffect(() => {
    setIgnoredRepairIssueIds(new Set());
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

  const sourceTreeForDrop = useMemo(() => {
    const sourceData = getEffectiveSourceData(state.activeSourceId);
    if (sourceData == null) return null;
    try {
      const parsedSource = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
      return buildJsonTree(parsedSource, '', '');
    } catch {
      return null;
    }
  }, [getEffectiveSourceData, state.activeSourceId]);

  const targetTreeForDrop = useMemo(() => {
    if (effectiveTarget.sampleData != null) {
      try {
        const parsedTarget = typeof effectiveTarget.sampleData === 'string'
          ? JSON.parse(effectiveTarget.sampleData)
          : effectiveTarget.sampleData;
        return buildJsonTree(parsedTarget, '', '');
      } catch {
        return null;
      }
    }
    if ((effectiveTarget.fields?.length ?? 0) > 0) {
      return buildTreeFromFields(effectiveTarget.fields!);
    }
    return null;
  }, [effectiveTarget.sampleData, effectiveTarget.fields]);

  const sourceLeafPathsForPropagation = useMemo(
    () => sourceTreeForDrop ? getAllLeafPaths(sourceTreeForDrop).filter((path) => path.length > 0) : [],
    [sourceTreeForDrop],
  );
  const targetLeafPathsForPropagation = useMemo(
    () => targetTreeForDrop ? getAllLeafPaths(targetTreeForDrop).filter((path) => path.length > 0) : [],
    [targetTreeForDrop],
  );

  const prepareSubtreeDropPlan = useCallback(
    (
      sourcePath: string,
      targetPath: string,
      options?: { expandArraySiblings?: boolean },
    ): { pairs: PathPair[]; usedArraySiblingExpansion: boolean; canExpandAcrossSiblings: boolean } => {
      const sourceNode = sourceTreeForDrop ? findNodeByPath(sourceTreeForDrop, sourcePath) : null;
      const targetNode = targetTreeForDrop ? findNodeByPath(targetTreeForDrop, targetPath) : null;
      if (!sourceNode || !targetNode) {
        return { pairs: [], usedArraySiblingExpansion: false, canExpandAcrossSiblings: false };
      }

      let sourceBaseNode = sourceNode;
      let targetBaseNode = targetNode;
      let sourceBasePath = sourcePath;
      let targetBasePath = targetPath;
      let canExpandAcrossSiblings = false;
      let usedArraySiblingExpansion = false;

      const sourceArrayParentPath = getArrayParentPath(sourcePath);
      const targetArrayParentPath = getArrayParentPath(targetPath);
      if (sourceArrayParentPath && targetArrayParentPath && sourceTreeForDrop && targetTreeForDrop) {
        const sourceArrayNode = findNodeByPath(sourceTreeForDrop, sourceArrayParentPath);
        const targetArrayNode = findNodeByPath(targetTreeForDrop, targetArrayParentPath);
        canExpandAcrossSiblings = !!(
          sourceArrayNode?.children?.length
          && targetArrayNode?.children?.length
        );
        if (options?.expandArraySiblings && canExpandAcrossSiblings) {
          sourceBaseNode = sourceArrayNode!;
          targetBaseNode = targetArrayNode!;
          sourceBasePath = sourceArrayParentPath;
          targetBasePath = targetArrayParentPath;
          usedArraySiblingExpansion = true;
        }
      }

      const pairs = buildRelativePairs(
        collectLeafPathsFromNode(sourceBaseNode),
        collectLeafPathsFromNode(targetBaseNode),
        sourceBasePath,
        targetBasePath,
      );

      return { pairs, usedArraySiblingExpansion, canExpandAcrossSiblings };
    },
    [sourceTreeForDrop, targetTreeForDrop],
  );

  const handleSelectSourceNode = useCallback((path: string, sourceId: string) => {
    setBulkSourcePath(path);
    setBulkSourceId(sourceId);
  }, []);

  const handleSelectTargetNode = useCallback((path: string) => {
    setBulkTargetPath(path);
  }, []);

  const handleMapFilteredFields = useCallback(
    (paths: string[], sourceId: string) => {
      if (paths.length === 0) return;
      const existingTargets = new Set(
        state.mappings.map((m) => normalizeMapperPath(m.targetPath)),
      );
      const newMappings = paths
        .filter((p) => !existingTargets.has(normalizeMapperPath(p)))
        .map((p, i) => ({
          id: `map-${Date.now()}-${i}`,
          sourceId,
          sourcePath: p,
          targetPath: p,
        }));
      if (newMappings.length === 0) {
        setToast('All filtered fields are already mapped');
        return;
      }
      setMappings([...state.mappings, ...newMappings]);
      setToast(`Mapped ${newMappings.length} field${newMappings.length !== 1 ? 's' : ''}`);
    },
    [state.mappings, setMappings, setToast],
  );

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

      if (sourceHasChildren && targetHasChildren) {
        const { pairs: plannedPairs } = prepareSubtreeDropPlan(
          sourcePath,
          targetPath,
        );

        if (plannedPairs.length === 0) {
          setToast('No matching child fields found for object drop');
          draggedSourceRef.current = null;
          return;
        }

        const { nextMappings, insertedCount, updatedCount, unchangedCount } = applyDropPairs(
          state.mappings,
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
      const applied = upsertTargetMapping(state.mappings, sourcePath, sourceId, targetPath, suggestedExpression);
      if (applied.changed) {
        setMappings(applied.next);
      }
      draggedSourceRef.current = null;
    },
    [state.mappings, selectedSourcePaths, setMappings, effectiveTarget.fields, suggestDropExpression, sourceTreeForDrop, targetTreeForDrop, prepareSubtreeDropPlan],
  );

  const handlePreviewPropagation = useCallback(() => {
    if (!state.selectedMappingId) {
      setToast('Select an indexed mapping first');
      return;
    }
    const anchorMapping = state.mappings.find((mapping) => mapping.id === state.selectedMappingId);
    if (!anchorMapping) {
      setToast('Selected mapping is no longer available');
      return;
    }
    const preview = buildPatternPropagationPreview(
      anchorMapping,
      state.mappings,
      sourceLeafPathsForPropagation,
      targetLeafPathsForPropagation,
      state.activeSourceId,
    );
    if (!preview) {
      setToast('Selected mapping is not eligible for index propagation');
      return;
    }
    setPropagationPreview(preview);
  }, [
    state.selectedMappingId,
    state.mappings,
    state.activeSourceId,
    sourceLeafPathsForPropagation,
    targetLeafPathsForPropagation,
  ]);

  const handleApplyPropagation = useCallback(() => {
    if (!propagationPreview) return;
    let nextMappings = [...state.mappings];
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
  }, [propagationPreview, setMappings, state.mappings]);

  const handleMapSubtree = useCallback(() => {
    if (!bulkSourcePath || !bulkTargetPath || !bulkSourceId) {
      setToast('Select source and target nodes first');
      return;
    }
    const { pairs } = prepareSubtreeDropPlan(bulkSourcePath, bulkTargetPath);
    if (pairs.length === 0) {
      setToast('No matching child fields found for selected subtree');
      return;
    }
    const { nextMappings, insertedCount, updatedCount, unchangedCount } = applyDropPairs(
      state.mappings,
      pairs,
      bulkSourceId,
      suggestDropExpression,
    );
    const changedCount = insertedCount + updatedCount;
    if (changedCount > 0) {
      setMappings(nextMappings);
      setToast(buildDropSummary(changedCount, insertedCount, updatedCount));
      return;
    }
    if (unchangedCount > 0) {
      setToast('No changes - matching targets already mapped');
    }
  }, [bulkSourcePath, bulkTargetPath, bulkSourceId, prepareSubtreeDropPlan, state.mappings, suggestDropExpression, setMappings]);

  const handleMapSiblingSubtrees = useCallback(() => {
    if (!bulkSourcePath || !bulkTargetPath || !bulkSourceId) {
      setToast('Select source and target nodes first');
      return;
    }
    const plan = prepareSubtreeDropPlan(bulkSourcePath, bulkTargetPath, { expandArraySiblings: true });
    if (!plan.canExpandAcrossSiblings) {
      setToast('Select matching array index nodes to map siblings');
      return;
    }
    if (plan.pairs.length === 0) {
      setToast('No matching sibling fields found');
      return;
    }
    const { nextMappings, insertedCount, updatedCount, unchangedCount } = applyDropPairs(
      state.mappings,
      plan.pairs,
      bulkSourceId,
      suggestDropExpression,
    );
    const changedCount = insertedCount + updatedCount;
    if (changedCount > 0) {
      setMappings(nextMappings);
      setToast(
        buildDropSummary(changedCount, insertedCount, updatedCount, {
          scopeSuffix: 'across array siblings',
        }),
      );
      return;
    }
    if (unchangedCount > 0) {
      setToast('No changes - matching targets already mapped');
    }
  }, [bulkSourcePath, bulkTargetPath, bulkSourceId, prepareSubtreeDropPlan, state.mappings, suggestDropExpression, setMappings]);

  const handleClearTargetSubtree = useCallback(() => {
    if (!bulkTargetPath) {
      setToast('Select a target node to clear');
      return;
    }
    const nextMappings = state.mappings.filter((m) => !isMapperPathWithin(m.targetPath, bulkTargetPath));
    const clearedCount = state.mappings.length - nextMappings.length;
    if (clearedCount === 0) {
      setToast('No mappings found in selected target subtree');
      return;
    }
    setMappings(nextMappings);
    setToast(`Cleared ${clearedCount} mapping${clearedCount !== 1 ? 's' : ''} in target subtree`);
  }, [bulkTargetPath, state.mappings, setMappings]);

  const handleReplaceTargetSubtree = useCallback(() => {
    if (!bulkSourcePath || !bulkTargetPath || !bulkSourceId) {
      setToast('Select source and target nodes first');
      return;
    }
    const { pairs } = prepareSubtreeDropPlan(bulkSourcePath, bulkTargetPath);
    if (pairs.length === 0) {
      setToast('No matching child fields found for selected subtree');
      return;
    }
    const remainingMappings = state.mappings.filter((m) => !isMapperPathWithin(m.targetPath, bulkTargetPath));
    const clearedCount = state.mappings.length - remainingMappings.length;
    const { nextMappings, insertedCount, updatedCount } = applyDropPairs(
      remainingMappings,
      pairs,
      bulkSourceId,
      suggestDropExpression,
    );
    const changedCount = insertedCount + updatedCount;
    if (changedCount === 0 && clearedCount === 0) {
      setToast('No changes - selected subtree already matches');
      return;
    }
    setMappings(nextMappings);
    setToast(
      `Replaced subtree with ${changedCount} mapping${changedCount !== 1 ? 's' : ''} (${clearedCount} cleared)`,
    );
  }, [bulkSourcePath, bulkTargetPath, bulkSourceId, prepareSubtreeDropPlan, state.mappings, suggestDropExpression, setMappings]);

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
    setBulkSourcePath(null);
    setBulkSourceId(null);
    setBulkTargetPath(null);
    setPropagationPreview(null);
    draggedSourceRef.current = null;
    setLineFocusNode(null);
  }, [state.activeSourceId]);

  useEffect(() => {
    if (showMappingLines) setLineFocusNode(null);
  }, [showMappingLines]);

  useEffect(() => {
    if (!propagationPreview) return;
    const anchorStillExists = state.mappings.some((mapping) => mapping.id === propagationPreview.anchorMappingId);
    if (!anchorStillExists) {
      setPropagationPreview(null);
    }
  }, [propagationPreview, state.mappings]);

  useEffect(() => {
    if (!nodeFocusMode) setLineFocusNode(null);
  }, [nodeFocusMode]);

  useEffect(() => {
    const previousCount = previousMappingCountRef.current;
    if (previousCount < 8 && state.mappings.length >= 8) {
      setAdvancedControlsOpen(false);
    }
    previousMappingCountRef.current = state.mappings.length;
  }, [state.mappings.length]);

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
        .map((m) => normalizeMapperPath(m.sourcePath)),
    ),
    [state.mappings, state.activeSourceId],
  );

  const mappingDiagnostics = useMappingDiagnostics(
    state.mappings,
    state.activeSourceId,
    effectiveSources,
    effectiveTarget,
    typeMismatches,
  );

  const mappingResolution = useMemo(
    () => ({
      unresolved: mappingDiagnostics.unresolved,
      resolved: mappingDiagnostics.resolved,
    }),
    [mappingDiagnostics.unresolved, mappingDiagnostics.resolved],
  );

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
    const fp = normalizeMapperPath(lineFocusNode.path);
    if (lineFocusNode.region === 'source') {
      return lines.filter((line) => normalizeMapperPath(line.sourcePath) === fp);
    }
    return lines.filter((line) => normalizeMapperPath(line.targetPath) === fp);
  }, [lines, showMappingLines, nodeFocusMode, lineFocusNode]);

  const mappedTargetValueOverlay = useMappingOverlay(
    state.mappings,
    state.activeSourceId,
    effectiveSources,
    adapter.customFunctions,
  );

  const buildTargetTreeForAutoMap = useCallback(() => {
    if (effectiveTarget.sampleData != null) {
      try {
        const parsedTarget = typeof effectiveTarget.sampleData === 'string'
          ? JSON.parse(effectiveTarget.sampleData)
          : effectiveTarget.sampleData;
        return {
          tree: buildJsonTree(parsedTarget, '', ''),
          targetData: parsedTarget,
        };
      } catch {
        return { tree: null, targetData: undefined as unknown };
      }
    }
    if ((effectiveTarget.fields?.length ?? 0) > 0) {
      return {
        tree: buildTreeFromFields(effectiveTarget.fields!),
        targetData: undefined as unknown,
      };
    }
    return { tree: null, targetData: undefined as unknown };
  }, [effectiveTarget.sampleData, effectiveTarget.fields]);

  const autoMapCandidates = useMemo<AutoMapCandidate[]>(() => {
    const sourceData = getEffectiveSourceData(state.activeSourceId);
    if (sourceData == null) return [];
    try {
      const parsedSource = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
      const srcTree = buildJsonTree(parsedSource, '', '');
      const { tree: tgtTree, targetData } = buildTargetTreeForAutoMap();
      if (!tgtTree) return [];
      return computeAutoMapCandidates(srcTree, tgtTree, state.mappings, {
        sourceData: parsedSource,
        targetData,
      });
    } catch {
      return [];
    }
  }, [getEffectiveSourceData, state.activeSourceId, state.mappings, buildTargetTreeForAutoMap]);

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

  const handleApplyProfileDelta = useCallback((profileMappings: Mapping[]) => {
    const result = applyProfileDelta(state.mappings, profileMappings, uuidv4);
    const changedCount = result.insertedCount + result.updatedCount;
    if (changedCount === 0) {
      setToast('Profile delta already up to date');
      return;
    }
    setMappings(result.mappings);
    setSelectedIds(new Set());
    setSelectedSourcePaths(new Set());
    setToast(
      `Applied profile delta (${result.insertedCount} new, ${result.updatedCount} updated, ${result.unchangedCount} unchanged)`,
    );
  }, [state.mappings, setMappings]);

  const handleAutoMap = useCallback(() => {
    const filtered = autoMapCandidates.filter((c) => c.score >= confidenceThreshold);
    const allNew: Mapping[] = [];

    try {
      const sourceData = getEffectiveSourceData(state.activeSourceId);
      if (sourceData != null && adapter.contextId) {
        const parsedSrc = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
        const srcTree = buildJsonTree(parsedSrc, '', '');
        const { tree: tgtTree } = buildTargetTreeForAutoMap();
        if (tgtTree) {
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
  }, [autoMapCandidates, confidenceThreshold, state.activeSourceId, state.mappings, setMappings, getEffectiveSourceData, adapter.contextId, buildTargetTreeForAutoMap]);

  const handleEditExpression = useCallback((mappingId: string) => {
    setEditingMappingId(mappingId);
  }, []);

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
    draggedSourceRef.current = null;
    setTargetResetSignal((value) => (value ?? 0) + 1);
    setToast('Cleared all mappings');
  }, [clearAll, selectMapping]);

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

  const handleToggleCompactMode = useCallback(() => {
    setCompactMode((mode) => {
      const nextMode = !mode;
      if (nextMode) {
        setAdvancedControlsOpen(false);
      }
      return nextMode;
    });
  }, []);

  const hasBulkSourceAndTarget = !!(
    bulkSourcePath
    && bulkTargetPath
    && bulkSourceId
    && bulkSourceId === state.activeSourceId
  );
  const canMapSiblingSubtrees = useMemo(() => {
    if (!hasBulkSourceAndTarget || !bulkSourcePath || !bulkTargetPath) return false;
    return getArrayParentPath(bulkSourcePath) != null && getArrayParentPath(bulkTargetPath) != null;
  }, [hasBulkSourceAndTarget, bulkSourcePath, bulkTargetPath]);
  const selectedMapping = useMemo(
    () => state.selectedMappingId
      ? state.mappings.find((mapping) => mapping.id === state.selectedMappingId) ?? null
      : null,
    [state.selectedMappingId, state.mappings],
  );
  const canPreviewPropagation = sourceLeafPathsForPropagation.length > 0
    && targetLeafPathsForPropagation.length > 0;

  const visibleRepairIssues = useMemo(
    () => mappingDiagnostics.issues.filter((issue) => !ignoredRepairIssueIds.has(issue.id)),
    [mappingDiagnostics.issues, ignoredRepairIssueIds],
  );

  const handleFixRepairIssue = useCallback((issue: MapperRepairIssue) => {
    if (!issue.suggestedFixExpression) {
      setToast('No automatic fix available for this issue');
      return;
    }
    updateMapping(issue.mappingId, { expression: issue.suggestedFixExpression });
    setToast('Applied suggested fix');
  }, [updateMapping]);

  const handleReplaceRepairIssue = useCallback((issue: MapperRepairIssue) => {
    const mapping = state.mappings.find((item) => item.id === issue.mappingId);
    if (!mapping) {
      setToast('Issue mapping is no longer available');
      return;
    }

    if (issue.kind === 'duplicate-target') {
      const normalizedTargetPath = normalizeMapperPath(mapping.targetPath);
      const nextMappings = state.mappings.filter(
        (item) => normalizeMapperPath(item.targetPath) !== normalizedTargetPath || item.id === mapping.id,
      );
      const removed = state.mappings.length - nextMappings.length;
      if (removed <= 0) {
        setToast('No duplicate mappings found to replace');
        return;
      }
      setMappings(nextMappings);
      setToast(`Replaced duplicate target mapping (${removed} removed)`);
      return;
    }

    const mappingSourceId = mapping.sourceId || state.activeSourceId;
    const sourceSelected = !!bulkSourcePath
      && !!bulkSourceId
      && (
        bulkSourceId !== mappingSourceId
        || !isSameMapperPath(bulkSourcePath, mapping.sourcePath)
      );
    const targetSelected = !!bulkTargetPath && !isSameMapperPath(bulkTargetPath, mapping.targetPath);

    if (!sourceSelected && !targetSelected) {
      setToast('Select source/target nodes first, then use Replace');
      return;
    }

    const changes: Partial<Omit<Mapping, 'id'>> = {};
    if (sourceSelected) {
      changes.sourcePath = bulkSourcePath!;
      changes.sourceId = bulkSourceId!;
      if (issue.kind === 'type-mismatch') {
        // Source replacement should re-evaluate type compatibility from raw path.
        changes.expression = undefined;
      }
    }
    if (targetSelected) {
      changes.targetPath = bulkTargetPath!;
    }

    updateMapping(mapping.id, changes);
    setToast('Replaced mapping from current selection');
  }, [
    state.mappings,
    state.activeSourceId,
    bulkSourcePath,
    bulkSourceId,
    bulkTargetPath,
    setMappings,
    updateMapping,
  ]);

  const handleIgnoreRepairIssue = useCallback((issue: MapperRepairIssue) => {
    setIgnoredRepairIssueIds((prev) => {
      const next = new Set(prev);
      next.add(issue.id);
      return next;
    });
  }, []);

  const handleOpenRepairIssue = useCallback((issue: MapperRepairIssue) => {
    selectMapping(issue.mappingId);
    setSelectedIds(new Set([issue.mappingId]));
    setFocusRegion('target');
    setBulkTargetPath(issue.targetPath);

    const issueSourceId = issue.sourceId || state.activeSourceId;
    if (issueSourceId === state.activeSourceId) {
      setBulkSourceId(issueSourceId);
      setBulkSourcePath(issue.sourcePath);
    }

    if (!showMappingLines && nodeFocusMode) {
      setLineFocusNode({ region: 'target', path: issue.targetPath });
    }
    setToast(`Focused ${normalizeMapperPath(issue.targetPath)}`);
  }, [selectMapping, setFocusRegion, state.activeSourceId, showMappingLines, nodeFocusMode]);

  return (
    <div className="dm-container" ref={containerRef} style={{ height }}>
      <MapperToolbar
        onAutoMap={handleAutoMap}
        onClearAll={handleClearAllMappings}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        mappingCount={state.mappings.length}
        resolvedCount={mappingResolution.resolved}
        unresolvedCount={mappingResolution.unresolved}
        autoMapCount={autoMapCandidateCount}
        showPreview={showPreview}
        onTogglePreview={handleTogglePreview}
        hasPending={hasPending}
        onAcceptAllPending={acceptAllPending}
        onRejectAllPending={rejectAllPending}
        contextId={adapter.contextId}
        mappings={state.mappings}
        onLoadProfile={hideAdvanced ? undefined : (m: Mapping[]) => { setMappings(m); setSelectedIds(new Set()); setSelectedSourcePaths(new Set()); }}
        onApplyProfileDelta={hideAdvanced ? undefined : handleApplyProfileDelta}
        showCodeView={showCodeView}
        onToggleCodeView={handleToggleCodeView}
        showTableView={bottomUtilityMode === 'table'}
        onToggleTableView={handleToggleTableView}
        onLoadGallerySample={hideAdvanced ? undefined : handleLoadGallerySample}
        hasTraceData={hasTraceData}
        debugMode={debugMode}
        onToggleDebugMode={() => setDebugMode((d) => !d)}
        traceErrorCount={traceErrorCount}
        confidenceThreshold={confidenceThreshold}
        onConfidenceThresholdChange={hideAdvanced ? undefined : setConfidenceThreshold}
        onLearnFromExamples={hideAdvanced ? undefined : () => setShowExampleModal(true)}
        showMappingLines={showMappingLines}
        onToggleMappingLines={() => setShowMappingLines((s) => !s)}
        nodeFocusMode={nodeFocusMode}
        onToggleNodeFocusMode={() => setNodeFocusMode((s) => !s)}
        compactMode={compactMode}
        onToggleCompactMode={handleToggleCompactMode}
        advancedOpen={advancedControlsOpen}
        onAdvancedOpenChange={setAdvancedControlsOpen}
      />
      <div className="dm-bulk-actions-bar" role="group" aria-label="Bulk mapping actions">
        <span className="dm-bulk-selection">
          Source: <strong>{bulkSourcePath ? normalizeMapperPath(bulkSourcePath) : 'none'}</strong>
        </span>
        <span className="dm-bulk-selection">
          Target: <strong>{bulkTargetPath ? normalizeMapperPath(bulkTargetPath) : 'none'}</strong>
        </span>
        <button
          type="button"
          className="dm-bulk-action-btn"
          onClick={handleMapSubtree}
          disabled={!hasBulkSourceAndTarget}
          title="Map selected source subtree to selected target subtree"
        >
          Map subtree
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn"
          onClick={handleMapSiblingSubtrees}
          disabled={!hasBulkSourceAndTarget || !canMapSiblingSubtrees}
          title="Map all matching array siblings for selected index nodes"
        >
          Map siblings
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn dm-bulk-action-btn--danger"
          onClick={handleClearTargetSubtree}
          disabled={!bulkTargetPath}
          title="Clear mappings under selected target subtree"
        >
          Clear subtree
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn dm-bulk-action-btn--primary"
          onClick={handleReplaceTargetSubtree}
          disabled={!hasBulkSourceAndTarget || !bulkTargetPath}
          title="Clear and replace selected target subtree"
        >
          Replace subtree
        </button>
        <button
          type="button"
          className="dm-bulk-action-btn"
          onClick={handlePreviewPropagation}
          disabled={!canPreviewPropagation}
          title="Preview pattern propagation from selected mapping"
        >
          Preview propagate
        </button>
        <span className="dm-bulk-selection dm-bulk-selection--inline">
          Anchor mapping: <strong>{selectedMapping ? normalizeMapperPath(selectedMapping.targetPath) : 'none'}</strong>
        </span>
      </div>
      {propagationPreview && (
        <div className="dm-propagation-preview" role="region" aria-label="Pattern propagation preview">
          <div className="dm-propagation-preview-head">
            <span className="dm-propagation-preview-title">
              Propagation preview from <strong>{propagationPreview.anchorTargetPath}</strong>
            </span>
            <button
              type="button"
              className="dm-propagation-preview-close"
              onClick={() => setPropagationPreview(null)}
              aria-label="Close propagation preview"
            >
              Close
            </button>
          </div>
          <div className="dm-propagation-preview-stats">
            {propagationPreview.insertedCount} new · {propagationPreview.updatedCount} updated · {propagationPreview.unchangedCount} unchanged · {propagationPreview.missingSourceCount} skipped
          </div>
          <div className="dm-propagation-preview-rows">
            {propagationPreview.rows.slice(0, 12).map((row) => (
              <div key={row.targetPath} className={`dm-propagation-preview-row dm-propagation-preview-row--${row.action}`}>
                <span className="dm-propagation-preview-action">{row.action}</span>
                <span className="dm-propagation-preview-path">{row.targetPath}</span>
                <span className="dm-propagation-preview-arrow">←</span>
                <span className="dm-propagation-preview-path">{row.sourcePath}</span>
              </div>
            ))}
            {propagationPreview.rows.length > 12 && (
              <div className="dm-propagation-preview-more">
                +{propagationPreview.rows.length - 12} more rows
              </div>
            )}
          </div>
          <div className="dm-propagation-preview-actions">
            <button
              type="button"
              className="dm-bulk-action-btn dm-bulk-action-btn--primary"
              onClick={handleApplyPropagation}
              disabled={(propagationPreview.insertedCount + propagationPreview.updatedCount) === 0}
            >
              Apply propagation
            </button>
            <button
              type="button"
              className="dm-bulk-action-btn"
              onClick={() => setPropagationPreview(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
      <ValidationRepairPanel
        issues={visibleRepairIssues}
        onFix={handleFixRepairIssue}
        onReplace={handleReplaceRepairIssue}
        onIgnoreOnce={handleIgnoreRepairIssue}
        onOpenNode={handleOpenRepairIssue}
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
            onNodeSelect={handleSelectSourceNode}
            selectedNodePath={bulkSourceId === state.activeSourceId ? bulkSourcePath : null}
            selectedSourcePaths={selectedSourcePaths}
            onToggleSourcePath={handleToggleSourcePath}
            isFocusRegion={focusRegion === 'source'}
            focusedPath={focusRegion === 'source' ? focusedPath : null}
            onFocus={() => setFocusRegion('source')}
            onTreeKeyDown={handleTreeKeyDown}
            driftMap={driftMap}
            traceOverlay={sourceTraceOverlay}
            mappedPaths={mappedSourcePaths}
            onMapFilteredFields={handleMapFilteredFields}
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
            totalMappingCount={state.mappings.length}
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
            onNodeSelect={handleSelectTargetNode}
            selectedNodePath={bulkTargetPath}
            resolvedMappingCount={mappingResolution.resolved}
            unresolvedMappingCount={mappingResolution.unresolved}
            resetViewSignal={targetResetSignal}
            unorderedDefault={unorderedDefault}
            onToggleUnorderedArray={onToggleUnorderedArray}
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
      {bottomUtilityMode !== 'none' && (
        <div className={`dm-bottom-utility-dock dm-bottom-utility-dock--${bottomUtilityMode}`}>
          {bottomUtilityMode === 'code' ? (
            <CodeView
              mappings={state.mappings}
              sources={effectiveSources}
              activeSourceId={state.activeSourceId}
              targetSampleData={effectiveTarget.sampleData}
              customFunctions={adapter.customFunctions}
              debugMode={debugMode}
              traceByMappingId={traceByMappingId}
            />
          ) : bottomUtilityMode === 'table' ? (
            <MappingTableView
              mappings={state.mappings}
              sources={effectiveSources}
              activeSourceId={state.activeSourceId}
              onRemoveMapping={removeMapping}
              onSelectMapping={(id) => { selectMapping(id); setSelectedIds(new Set()); }}
              selectedMappingId={state.selectedMappingId}
            />
          ) : (
            <PreviewBar
              mappings={state.mappings}
              sources={effectiveSources}
              activeSourceId={state.activeSourceId}
              targetSampleData={effectiveTarget.sampleData}
              customFunctions={adapter.customFunctions}
            />
          )}
        </div>
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

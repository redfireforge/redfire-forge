import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { MapperAdapter, Mapping } from './types';
import { useMapperState } from './hooks/useMapperState';
import { useConnectionLines, useLayoutTick } from './hooks/useConnectionLines';
import { computeAutoMapCandidates, candidatesToMappings } from './utils/autoMapAlgorithm';
import { detectTypeMismatches } from './utils/typeMismatch';
import { buildJsonTree } from '../../utils/jsonTreeModel';
import SourcePanel from './SourcePanel';
import TargetPanel from './TargetPanel';
import MappingCanvas from './MappingCanvas';
import MapperToolbar from './MapperToolbar';
import ExpressionEditorModal from './ExpressionEditorModal';
import PreviewBar from './PreviewBar';
import '../../../styles/data-mapper.css';
import '../../../styles/data-mapper-expression.css';

interface DataMapperProps<TOutput = unknown> {
  adapter: MapperAdapter<TOutput>;
  initialData?: TOutput;
  onChange?: (mappings: Mapping[]) => void;
  height?: number | string;
}

const CANVAS_WIDTH = 120;

export default function DataMapper<TOutput = unknown>({
  adapter,
  initialData,
  onChange,
  height = 500,
}: DataMapperProps<TOutput>) {
  const initialMappings = useMemo(
    () => (initialData ? adapter.deserialize(initialData) : []),
    [adapter, initialData],
  );

  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const sourceSearchRef = useRef<HTMLInputElement | null>(null);
  const [sourcePanelWidth, setSourcePanelWidth] = useState<number | null>(null);
  const [targetPanelWidth, setTargetPanelWidth] = useState<number | null>(null);

  const {
    state,
    addMapping,
    removeMapping,
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
    setMappings(initialData ? adapter.deserialize(initialData) : []);
  }, [initialData, adapter, setMappings]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const layoutTick = useLayoutTick(containerRef);

  useEffect(() => {
    onChange?.(state.mappings);
  }, [state.mappings, onChange]);

  const getEffectiveSourceData = useCallback((sourceId: string): unknown => {
    return state.sourceSampleOverrides[sourceId]
      ?? adapter.sources.find((s) => s.id === sourceId)?.sampleData;
  }, [state.sourceSampleOverrides, adapter.sources]);

  const handleDrop = useCallback(
    (targetPath: string, sourcePath: string, sourceId: string) => {
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
    [state.mappings, addMapping, removeMapping],
  );

  const handleDragStart = useCallback(() => {
    selectMapping(null);
  }, [selectMapping]);

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setFetchError(null);
  }, [state.activeSourceId]);

  const handleFetchSample = useCallback(async () => {
    if (!adapter.fetchSampleData) return;
    setFetchError(null);
    try {
      const data = await adapter.fetchSampleData();
      if (data != null) {
        setSourceSample(state.activeSourceId, data);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch sample data');
    }
  }, [adapter, state.activeSourceId, setSourceSample]);

  const effectiveSources: typeof adapter.sources = useMemo(() => {
    return adapter.sources.map((s) => ({
      ...s,
      sampleData: state.sourceSampleOverrides[s.id] ?? s.sampleData,
    }));
  }, [adapter.sources, state.sourceSampleOverrides]);

  const typeMismatches = useMemo(
    () => detectTypeMismatches(state.mappings, effectiveSources, adapter.target),
    [state.mappings, effectiveSources, adapter.target],
  );

  const mismatchIds = useMemo(
    () => new Set(typeMismatches.map((m) => m.mappingId)),
    [typeMismatches],
  );

  const { lines, containerHeight } = useConnectionLines(state.mappings, containerRef, layoutTick, mismatchIds);

  const autoMapCandidateCount = useMemo(() => {
    const sourceData = getEffectiveSourceData(state.activeSourceId);
    const targetData = adapter.target.sampleData;
    if (!sourceData || !targetData) return 0;
    try {
      const srcTree = buildJsonTree(
        typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData,
        '', '',
      );
      const tgtTree = buildJsonTree(
        typeof targetData === 'string' ? JSON.parse(targetData) : targetData,
        '', '',
      );
      return computeAutoMapCandidates(srcTree, tgtTree, state.mappings).length;
    } catch {
      return 0;
    }
  }, [getEffectiveSourceData, adapter.target.sampleData, state.activeSourceId, state.mappings]);

  const handleAutoMap = useCallback(() => {
    const sourceData = getEffectiveSourceData(state.activeSourceId);
    const targetData = adapter.target.sampleData;
    if (!sourceData || !targetData) return;
    try {
      const srcTree = buildJsonTree(
        typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData,
        '', '',
      );
      const tgtTree = buildJsonTree(
        typeof targetData === 'string' ? JSON.parse(targetData) : targetData,
        '', '',
      );
      const candidates = computeAutoMapCandidates(srcTree, tgtTree, state.mappings);
      if (candidates.length === 0) return;
      const newMappings = candidatesToMappings(candidates, state.activeSourceId)
        .map((m) => ({ ...m, isPending: true }));
      setMappings([...state.mappings, ...newMappings]);
      setToast(`Auto-mapped ${newMappings.length} field${newMappings.length !== 1 ? 's' : ''}`);
    } catch { /* ignore */ }
  }, [getEffectiveSourceData, adapter.target.sampleData, state.activeSourceId, state.mappings, setMappings]);

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

  const editingMapping = useMemo(
    () => editingMappingId ? state.mappings.find((m) => m.id === editingMappingId) ?? null : null,
    [editingMappingId, state.mappings],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingMappingId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (isEditable) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedMappingId) {
        if (isEditable) return;
        e.preventDefault();
        removeMapping(state.selectedMappingId);
        return;
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
  }, [undo, redo, state.selectedMappingId, removeMapping, selectMapping, editingMappingId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleResizeStart = useCallback(
    (side: 'source' | 'target', e: React.MouseEvent) => {
      e.preventDefault();
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
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
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
      />
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
          />
        </div>
        <div
          className="dm-resize-handle"
          onMouseDown={(e) => handleResizeStart('source', e)}
        />
        <div className="dm-canvas-wrapper">
          <MappingCanvas
            lines={lines}
            width={CANVAS_WIDTH}
            height={containerHeight || 400}
            selectedMappingId={state.selectedMappingId}
            onSelectMapping={selectMapping}
            onRemoveMapping={removeMapping}
            onEditExpression={handleEditExpression}
            onAcceptPending={acceptPending}
            onRejectPending={rejectPending}
          />
        </div>
        <div
          className="dm-resize-handle"
          onMouseDown={(e) => handleResizeStart('target', e)}
        />
        <div className="dm-panel-wrapper" style={targetPanelWidth ? { width: targetPanelWidth, flex: 'none' } : undefined}>
          <TargetPanel
            target={adapter.target}
            mappings={state.mappings}
            onDrop={handleDrop}
            selectedMappingId={state.selectedMappingId}
            onSelectMapping={selectMapping}
            onEditExpression={handleEditExpression}
            typeMismatches={typeMismatches}
            onQuickFix={handleQuickFix}
            onRemoveMapping={removeMapping}
          />
        </div>
      </div>
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
    </div>
  );
}

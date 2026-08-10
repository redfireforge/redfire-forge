import { useState, useCallback, useMemo, useEffect } from 'react';
import { CustomSelect } from '../CustomSelect';
import type { MapperSource, FetchErrorDetail } from './types';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { FocusRegion } from './hooks/useKeyboardNavigation';
import type { DriftIndicator } from './SourceTreeNode';
import type { TraceValueOverlay } from './types';
import { buildJsonTree } from '../../utils/jsonTreeModel';
import { normalizeMapperPath } from './utils/pathNormalization';
import SourceTreeNode from './SourceTreeNode';
import FetchErrorBanner from './FetchErrorBanner';

interface SourcePanelProps {
  sources: MapperSource[];
  activeSourceId: string;
  sourceSampleOverrides: Record<string, unknown>;
  onSourceChange: (sourceId: string) => void;
  onDragStart: (path: string, sourceId: string, type?: string) => void;
  onDragEnd?: () => void;
  onSourceSampleChange: (sourceId: string, data: unknown) => void;
  onFetchSample?: () => Promise<void>;
  canFetch?: boolean;
  fetchError?: FetchErrorDetail | null;
  onNodeSelect?: (path: string, sourceId: string) => void;
  selectedNodePath?: string | null;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  selectedSourcePaths?: Set<string>;
  onToggleSourcePath?: (path: string) => void;
  isFocusRegion?: boolean;
  focusedPath?: string | null;
  onFocus?: () => void;
  onTreeKeyDown?: (
    e: React.KeyboardEvent,
    region: FocusRegion,
    expandedPaths: Set<string>,
    onToggle: (path: string) => void,
  ) => void;
  driftMap?: Map<string, DriftIndicator>;
  traceOverlay?: Map<string, TraceValueOverlay>;
  mappedPaths?: Set<string>;
  onMapFilteredFields?: (paths: string[], sourceId: string) => void;
  onMapSelectedFields?: (paths: string[], sourceId: string) => void;
  onUnmapSelectedFields?: (paths: string[]) => void;
  highlightedPaths?: Set<string> | null;
}

export default function SourcePanel({
  sources,
  activeSourceId,
  sourceSampleOverrides,
  onSourceChange,
  onDragStart,
  onDragEnd,
  onSourceSampleChange,
  onFetchSample,
  canFetch = false,
  fetchError,
  onNodeSelect,
  selectedNodePath,
  searchInputRef,
  selectedSourcePaths,
  onToggleSourcePath,
  isFocusRegion,
  focusedPath,
  onFocus,
  onTreeKeyDown,
  driftMap,
  traceOverlay,
  mappedPaths,
  onMapFilteredFields,
  onMapSelectedFields,
  onUnmapSelectedFields,
  highlightedPaths,
}: SourcePanelProps) {
  const [search, setSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['__root__']));
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    setPasteMode(false);
    setPasteText('');
    setPasteError(null);
  }, [activeSourceId]);

  const activeSource = sources.find((s) => s.id === activeSourceId) ?? sources[0];

  const effectiveSampleData = sourceSampleOverrides[activeSourceId] ?? activeSource?.sampleData;

  const tree: JsonTreeNode | null = useMemo(() => {
    if (effectiveSampleData == null) return null;
    try {
      const data = typeof effectiveSampleData === 'string'
        ? JSON.parse(effectiveSampleData)
        : effectiveSampleData;
      return buildJsonTree(data, '', '');
    } catch {
      return null;
    }
  }, [effectiveSampleData]);

  const leafPaths = useMemo(() => {
    if (!tree) return [] as string[];
    const leaves: string[] = [];
    const collect = (node: JsonTreeNode) => {
      if (!node.children || node.children.length === 0) {
        leaves.push(node.path);
        return;
      }
      node.children.forEach(collect);
    };
    collect(tree);
    return leaves;
  }, [tree]);

  const mappedLeafCount = useMemo(() => {
    if (!mappedPaths || mappedPaths.size === 0) return 0;
    let count = 0;
    for (const path of leafPaths) {
      if (mappedPaths.has(normalizeMapperPath(path))) count += 1;
    }
    return count;
  }, [leafPaths, mappedPaths]);

  const unmappedLeafCount = useMemo(
    () => Math.max(leafPaths.length - mappedLeafCount, 0),
    [leafPaths.length, mappedLeafCount],
  );

  useEffect(() => {
    if (!tree) {
      setExpandedPaths(new Set(['__root__']));
      return;
    }
    const all = new Set<string>();
    const collect = (node: JsonTreeNode) => {
      all.add(node.path || '__root__');
      node.children?.forEach(collect);
    };
    collect(tree);
    setExpandedPaths(all);
  }, [tree]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (!tree) return;
    const all = new Set<string>();
    const collect = (node: JsonTreeNode) => {
      all.add(node.path || '__root__');
      node.children?.forEach(collect);
    };
    collect(tree);
    setExpandedPaths(all);
  }, [tree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set(['__root__']));
  }, []);

  const handlePasteSubmit = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) { setPasteError('Paste some JSON'); return; }
    try {
      const parsed = JSON.parse(trimmed);
      onSourceSampleChange(activeSourceId, parsed);
      setPasteError(null);
      setPasteMode(false);
      setPasteText('');
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [pasteText, activeSourceId, onSourceSampleChange]);

  const handleFetchSample = useCallback(async () => {
    if (!onFetchSample) return;
    setFetching(true);
    try {
      await onFetchSample();
    } finally {
      setFetching(false);
    }
  }, [onFetchSample]);

  const filteredUnmappedLeaves = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return leafPaths.filter((p) => {
      if (search && !p.toLowerCase().includes(lowerSearch)) return false;
      const isMapped = mappedPaths?.has(normalizeMapperPath(p)) ?? false;
      if (mappingFilter === 'mapped') return false;
      if (mappingFilter === 'unmapped' && isMapped) return false;
      if (mappingFilter === 'all' && isMapped) return false;
      return true;
    });
  }, [leafPaths, search, mappingFilter, mappedPaths]);

  const handleMapFiltered = useCallback(() => {
    if (!onMapFilteredFields || filteredUnmappedLeaves.length === 0) return;
    onMapFilteredFields(filteredUnmappedLeaves, activeSourceId);
  }, [onMapFilteredFields, filteredUnmappedLeaves, activeSourceId]);

  const selectedCount = selectedSourcePaths?.size ?? 0;

  const selectedMappedCount = useMemo(() => {
    if (!selectedSourcePaths || selectedSourcePaths.size === 0 || !mappedPaths) return 0;
    let count = 0;
    for (const p of selectedSourcePaths) {
      if (mappedPaths.has(normalizeMapperPath(p))) count += 1;
    }
    return count;
  }, [selectedSourcePaths, mappedPaths]);

  const handleMapSelected = useCallback(() => {
    if (!onMapSelectedFields || !selectedSourcePaths || selectedSourcePaths.size === 0) return;
    onMapSelectedFields(Array.from(selectedSourcePaths), activeSourceId);
  }, [onMapSelectedFields, selectedSourcePaths, activeSourceId]);

  const handleUnmapSelected = useCallback(() => {
    if (!onUnmapSelectedFields || !selectedSourcePaths || selectedSourcePaths.size === 0) return;
    onUnmapSelectedFields(Array.from(selectedSourcePaths));
  }, [onUnmapSelectedFields, selectedSourcePaths]);

  const togglePasteMode = useCallback(() => {
    setPasteMode((prev) => !prev);
    setPasteError(null);
    if (!pasteMode && effectiveSampleData) {
      try {
        const data = typeof effectiveSampleData === 'string'
          ? JSON.parse(effectiveSampleData)
          : effectiveSampleData;
        setPasteText(JSON.stringify(data, null, 2));
      } catch {
        setPasteText('');
      }
    }
  }, [pasteMode, effectiveSampleData]);

  return (
    <div
      className={`dm-panel dm-panel--source ${isFocusRegion ? 'dm-panel--focused' : ''}`}
      onFocus={onFocus}
    >
      <div className="dm-panel-header">
        <span className="dm-panel-title">Source</span>
        {!pasteMode && selectedCount > 0 && selectedMappedCount > 0 && onUnmapSelectedFields && (
          <button
            className="dm-map-filtered-btn dm-map-filtered-btn--header dm-map-filtered-btn--unmap"
            onClick={handleUnmapSelected}
            aria-label={`Unmap ${selectedMappedCount} selected fields`}
          >
            Unmap ({selectedMappedCount})
          </button>
        )}
        {!pasteMode && selectedCount > 0 && selectedCount > selectedMappedCount && onMapSelectedFields && (
          <button
            className="dm-map-filtered-btn dm-map-filtered-btn--header dm-map-filtered-btn--selected"
            onClick={handleMapSelected}
            aria-label={`Map ${selectedCount - selectedMappedCount} selected fields`}
          >
            Map ({selectedCount - selectedMappedCount})
          </button>
        )}
        {!pasteMode && selectedCount === 0 && filteredUnmappedLeaves.length > 0 && onMapFilteredFields && (
          <button
            className="dm-map-filtered-btn dm-map-filtered-btn--header"
            onClick={handleMapFiltered}
            aria-label={`Map ${filteredUnmappedLeaves.length} filtered fields`}
          >
            Map {search || mappingFilter !== 'all' ? 'filtered' : 'all'} ({filteredUnmappedLeaves.length})
          </button>
        )}
        <div className="dm-panel-actions">
          <button
            className={`dm-btn-icon ${pasteMode ? 'dm-btn-icon--active' : ''}`}
            onClick={togglePasteMode}
            aria-label={pasteMode ? 'Show tree view' : 'Paste JSON'}
            aria-pressed={pasteMode}
          >
            {pasteMode ? 'Tree' : 'JSON'}
          </button>
          {canFetch && (
            <button
              className="dm-btn-icon"
              onClick={handleFetchSample}
              disabled={fetching}
              aria-label="Fetch live sample"
            >
              {fetching ? '…' : '↻'}
            </button>
          )}
          {!pasteMode && (
            <>
              <button className="dm-btn-icon" onClick={handleExpandAll} aria-label="Expand all">⊞</button>
              <button className="dm-btn-icon" onClick={handleCollapseAll} aria-label="Collapse all">⊟</button>
            </>
          )}
        </div>
      </div>

      {sources.length > 1 && (
        <div className="dm-source-tabs" role="tablist" aria-label="Source data tabs">
          {sources.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === activeSourceId}
              className={`dm-source-tab ${s.id === activeSourceId ? 'dm-source-tab--active' : ''}`}
              onClick={() => onSourceChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {pasteMode ? (
        <div className="dm-paste-container">
          <textarea
            className="dm-paste-textarea"
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPasteError(null); }}
            placeholder='Paste JSON here, e.g. {"name": "Alice", "age": 30}'
            aria-label="Paste JSON sample"
            aria-invalid={!!pasteError}
            spellCheck={false}
          />
          {pasteError && <div className="dm-paste-error" role="alert">{pasteError}</div>}
          <div className="dm-paste-actions">
            <button className="dm-paste-btn dm-paste-btn--apply" onClick={handlePasteSubmit}>
              Apply
            </button>
            <button className="dm-paste-btn dm-paste-btn--cancel" onClick={() => { setPasteMode(false); setPasteError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="dm-search-bar">
            <input
              ref={searchInputRef}
              type="text"
              className="dm-search-input"
              placeholder="Search fields…"
              aria-label="Search source fields"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="dm-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
            )}
            <CustomSelect
              className="dm-filter-select"
              aria-label="Filter source fields"
              value={mappingFilter}
              onChange={(v) => setMappingFilter(v as 'all' | 'mapped' | 'unmapped')}
              options={[
                { value: 'all', label: 'All' },
                { value: 'mapped', label: 'Mapped' },
                { value: 'unmapped', label: 'Unmapped' },
              ]}
            />
            <span className="dm-filter-count" aria-live="polite">
              {mappedLeafCount} mapped / {unmappedLeafCount} unmapped
            </span>
          </div>
          {fetchError && <FetchErrorBanner error={fetchError} />}

          <div
            className="dm-tree-container"
            role="group"
            tabIndex={isFocusRegion ? 0 : -1}
            onKeyDown={onTreeKeyDown ? (e) => onTreeKeyDown(e, 'source', expandedPaths, handleToggle) : undefined}
          >
            {tree ? (
              <SourceTreeNode
                node={tree}
                depth={0}
                search={search}
                mappingFilter={mappingFilter}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                sourceId={activeSourceId}
                onNodeSelect={onNodeSelect}
                selectedNodePath={selectedNodePath}
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
                selectedPaths={selectedSourcePaths}
                onToggleSelect={onToggleSourcePath}
                focusedPath={focusedPath}
                driftMap={driftMap}
                traceOverlay={traceOverlay}
                mappedPaths={mappedPaths}
                highlightedPaths={highlightedPaths}
              />
            ) : (
              <div className="dm-empty-state dm-empty-state--guided">
                <div className="dm-empty-state-title">No sample data yet.</div>
                <div className="dm-empty-state-help">
                  Add source data first so fields can be mapped.
                </div>
                <div className="dm-empty-state-actions">
                  <button
                    type="button"
                    className="dm-empty-action-btn dm-empty-action-btn--primary"
                    onClick={() => setPasteMode(true)}
                  >
                    Paste JSON
                  </button>
                  {canFetch && onFetchSample && (
                    <button
                      type="button"
                      className="dm-empty-action-btn"
                      onClick={handleFetchSample}
                      disabled={fetching}
                      aria-label="Fetch live sample"
                    >
                      {fetching ? 'Fetching…' : 'Fetch sample'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

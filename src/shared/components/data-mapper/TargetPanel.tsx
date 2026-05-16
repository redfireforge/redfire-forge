import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { MapperTarget, Mapping, TargetField, TargetFieldOrigin, AdapterCapabilities, FieldOperator, FetchErrorDetail } from './types';
import type { Assertion } from '../../types';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { FocusRegion } from './hooks/useKeyboardNavigation';
import type { TypeMismatch } from './utils/typeMismatch';
import type { TraceValueOverlay } from './types';
import { buildJsonTree } from '../../utils/jsonTreeModel';
import { buildTreeFromFields, collectAllPaths } from './utils/targetTreeBuilder';
import { normalizeMapperPath } from './utils/pathNormalization';
import { stripJsonPathPrefix } from '../../utils/jsonPath';
import { flashTreeNode } from './utils/targetTreeHelpers';
import TargetTreeNode from './TargetTreeNode';
import AddFieldRow from './AddFieldRow';
import LocationGroupPanel from './LocationGroupPanel';
import FetchErrorBanner from './FetchErrorBanner';

const SOURCE_TEXT_PREFIX = 'mapper-source:';

interface TargetPanelProps {
  target: MapperTarget;
  mappings: Mapping[];
  onDrop: (targetPath: string, sourcePath: string, sourceId: string) => void;
  selectedMappingId: string | null;
  onSelectMapping: (id: string | null) => void;
  onEditExpression?: (mappingId: string) => void;
  typeMismatches?: TypeMismatch[];
  onQuickFix?: (mappingId: string, suggestedExpression: string) => void;
  onRemoveMapping?: (id: string) => void;
  isFocusRegion?: boolean;
  focusedPath?: string | null;
  onFocus?: () => void;
  onTreeKeyDown?: (
    e: React.KeyboardEvent,
    region: FocusRegion,
    expandedPaths: Set<string>,
    onToggle: (path: string) => void,
  ) => void;
  traceOverlay?: Map<string, TraceValueOverlay>;
  onAddCustomField?: (field: TargetField) => void;
  onRemoveCustomField?: (path: string) => void;
  onUpdateCustomField?: (oldPath: string, updated: TargetField) => void;
  onFetchTargetSchema?: () => Promise<void>;
  canFetchTarget?: boolean;
  targetFetchError?: FetchErrorDetail | null;
  onPasteTargetSample?: (data: unknown) => void;
  onReorderField?: (dragPath: string, dropPath: string) => void;
  onTargetFieldDragStart?: (path: string) => void;
  onTargetFieldDragEnd?: () => void;
  getDraggedSource?: () => { path: string; sourceId: string } | null;
  getDraggedTargetFieldPath?: () => string | null;
  onNodeSelect?: (path: string) => void;
  selectedNodePath?: string | null;
  resolvedMappingCount?: number;
  unresolvedMappingCount?: number;
  resetViewSignal?: number | null;
  unorderedDefault?: boolean;
  onToggleUnorderedArray?: (arrayPath: string) => void;
  capabilities?: Required<AdapterCapabilities>;
  onUpdateMappingOperator?: (mappingId: string, operator: FieldOperator | undefined, operatorValue: string | undefined) => void;
  onToggleMappingNegate?: (mappingId: string) => void;
  nodeStatusMap?: Map<string, 'pass' | 'fail'>;
  fieldVerifyResults?: Map<string, { passed: boolean; actual?: string; expected?: string; matchContext?: string }>;
  onAddArrayAssertion?: (arrayPath: string, assertionType: 'length' | 'contains' | 'each' | 'subset') => void;
  onUpdateArrayAssertion?: (index: number, patch: Partial<Assertion>) => void;
  onRemoveArrayAssertion?: (index: number) => void;
  arrayAssertions?: Assertion[];
  assertionVerifyMap?: Map<number, { passed: boolean; actual?: string; expected?: string }>;
  filterFailedSignal?: number | null;
  highlightedPaths?: Set<string> | null;
  onRemapDrop?: (newTargetPath: string, mappingId: string) => void;
  onRemapDragStart?: (mappingId: string) => void;
  onRemapDragEnd?: () => void;
  getDraggedRemapId?: () => string | null;
  scrollToPathSignal?: { path: string; tick: number } | null;
}

export default function TargetPanel({
  target,
  mappings,
  onDrop,
  selectedMappingId,
  onSelectMapping,
  onEditExpression,
  typeMismatches,
  onQuickFix,
  onRemoveMapping,
  isFocusRegion,
  focusedPath,
  onFocus,
  onTreeKeyDown,
  traceOverlay,
  onAddCustomField,
  onRemoveCustomField,
  onUpdateCustomField,
  onFetchTargetSchema,
  canFetchTarget = false,
  targetFetchError,
  onPasteTargetSample,
  onReorderField,
  onTargetFieldDragStart,
  onTargetFieldDragEnd,
  getDraggedSource,
  getDraggedTargetFieldPath,
  onNodeSelect,
  selectedNodePath,
  resolvedMappingCount,
  unresolvedMappingCount,
  resetViewSignal,
  unorderedDefault,
  onToggleUnorderedArray,
  capabilities,
  onUpdateMappingOperator,
  onToggleMappingNegate,
  nodeStatusMap,
  fieldVerifyResults,
  onAddArrayAssertion,
  onUpdateArrayAssertion,
  onRemoveArrayAssertion,
  arrayAssertions,
  assertionVerifyMap,
  filterFailedSignal,
  highlightedPaths,
  onRemapDrop,
  onRemapDragStart,
  onRemapDragEnd,
  getDraggedRemapId,
  scrollToPathSignal,
}: TargetPanelProps) {
  const [search, setSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped' | 'passed' | 'failed'>('all');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['__root__']));
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const treeSource: 'sampleData' | 'fields' | null = target.sampleData != null
    ? 'sampleData'
    : (target.fields && target.fields.length > 0 ? 'fields' : null);

  const tree: JsonTreeNode | null = useMemo(() => {
    if (target.sampleData != null) {
      try {
        const data = typeof target.sampleData === 'string'
          ? JSON.parse(target.sampleData)
          : target.sampleData;
        return buildJsonTree(data, '', '');
      } catch {
        return null;
      }
    }
    if (target.fields && target.fields.length > 0) {
      return buildTreeFromFields(target.fields);
    }
    return null;
  }, [target.sampleData, target.fields]);

  useEffect(() => {
    if (resetViewSignal == null) return;
    setExpandedPaths(tree ? collectAllPaths(tree) : new Set(['__root__']));
    setSearch('');
    setMappingFilter('all');
    setPasteMode(false);
    setPasteError(null);
  }, [resetViewSignal, tree]);

  useEffect(() => {
    if (filterFailedSignal == null) return;
    setMappingFilter('failed');
  }, [filterFailedSignal]);

  const fieldsSignature = useMemo(
    () => (target.fields ?? [])
      .map((field) => `${field.path}:${field.type ?? 'string'}:${field.origin ?? 'adapter'}`)
      .sort()
      .join('|'),
    [target.fields],
  );
  const lastFieldsSignatureRef = useRef<string>('');
  useEffect(() => {
    if (treeSource === 'fields' && tree && fieldsSignature !== lastFieldsSignatureRef.current) {
      lastFieldsSignatureRef.current = fieldsSignature;
      setExpandedPaths(collectAllPaths(tree));
    }
  }, [treeSource, tree, fieldsSignature]);

  const sampleSignature = useMemo(() => {
    if (target.sampleData == null) return '';
    try {
      return typeof target.sampleData === 'string'
        ? target.sampleData.slice(0, 200)
        : JSON.stringify(target.sampleData).slice(0, 200);
    } catch { return ''; }
  }, [target.sampleData]);
  const lastSampleSignatureRef = useRef<string>('');
  useEffect(() => {
    if (treeSource === 'sampleData' && tree && sampleSignature && sampleSignature !== lastSampleSignatureRef.current) {
      lastSampleSignatureRef.current = sampleSignature;
      setExpandedPaths(collectAllPaths(tree));
    }
  }, [treeSource, tree, sampleSignature]);

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

  const treeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollToPathSignal) return;
    const { path } = scrollToPathSignal;
    const stripped = stripJsonPathPrefix(path);
    const segments = stripped.replace(/\[(\d+)\]/g, '.$1').split('.');
    const ancestorPaths: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      const seg = segments.slice(0, i);
      ancestorPaths.push(seg.join('.').replace(/\.(\d+)/g, '[$1]'));
    }
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (const p of ancestorPaths) next.add(p);
      return next;
    });
    requestAnimationFrame(() => {
      const container = treeContainerRef.current;
      if (!container) return;
      const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape : (s: string) => s;
      const el =
        container.querySelector(`[data-path="${esc(stripped)}"]`) ??
        container.querySelector(`[data-path="${esc(path)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashTreeNode(el);
      }
    });
  }, [scrollToPathSignal]);

  const handleFetch = useCallback(async () => {
    if (!onFetchTargetSchema) return;
    setFetching(true);
    try {
      await onFetchTargetSchema();
    } catch {
      // Error state handled by parent via targetFetchError prop
    } finally {
      setFetching(false);
    }
  }, [onFetchTargetSchema]);

  const handlePasteSubmit = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) { setPasteError('Paste some JSON'); return; }
    try {
      const parsed = JSON.parse(trimmed);
      onPasteTargetSample?.(parsed);
      setPasteError(null);
      setPasteMode(false);
      setPasteText('');
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [pasteText, onPasteTargetSample]);

  const togglePasteMode = useCallback(() => {
    setPasteMode((prev) => !prev);
    setPasteError(null);
    if (!pasteMode && target.sampleData) {
      try {
        const data = typeof target.sampleData === 'string'
          ? JSON.parse(target.sampleData)
          : target.sampleData;
        setPasteText(JSON.stringify(data, null, 2));
      } catch {
        setPasteText('');
      }
    }
  }, [pasteMode, target.sampleData]);

  const fieldOrigins = useMemo(() => {
    const map = new Map<string, TargetFieldOrigin>();
    if (target.fields) {
      for (const f of target.fields) {
        map.set(f.path, f.origin ?? 'adapter');
      }
    }
    return map;
  }, [target.fields]);

  const existingPaths = useMemo(() => {
    const paths = new Set<string>();
    if (target.fields) {
      for (const f of target.fields) paths.add(f.path);
    }
    return paths;
  }, [target.fields]);

  const hasLocationGroups = useMemo(
    () => !!(target.fields?.some(f => f.location)),
    [target.fields],
  );
  const canReorderFields = treeSource === 'fields' && !!onReorderField;

  const resolvedMappedCount = resolvedMappingCount ?? mappings.length;
  const unresolvedMappedCount = unresolvedMappingCount ?? Math.max(mappings.length - resolvedMappedCount, 0);

  const mappedTargetPaths = useMemo(() => {
    const mapped = new Set<string>();
    for (const mapping of mappings) {
      mapped.add(normalizeMapperPath(mapping.targetPath));
    }
    return mapped;
  }, [mappings]);

  const verifyFilteredPaths = useMemo((): Set<string> | null => {
    if (mappingFilter === 'passed' && nodeStatusMap) {
      const passed = new Set<string>();
      for (const [path, status] of nodeStatusMap) {
        if (status === 'pass') passed.add(normalizeMapperPath(path));
      }
      if (assertionVerifyMap && arrayAssertions) {
        for (const [idx, result] of assertionVerifyMap) {
          if (result.passed) {
            const a = arrayAssertions[idx];
            const jp = a && 'jsonPath' in a ? a.jsonPath : undefined;
            if (jp) passed.add(normalizeMapperPath(jp));
          }
        }
      }
      return passed;
    }
    if (mappingFilter === 'failed' && nodeStatusMap) {
      const failed = new Set<string>();
      for (const [path, status] of nodeStatusMap) {
        if (status === 'fail') failed.add(normalizeMapperPath(path));
      }
      if (assertionVerifyMap && arrayAssertions) {
        for (const [idx, result] of assertionVerifyMap) {
          if (!result.passed) {
            const a = arrayAssertions[idx];
            const jp = a && 'jsonPath' in a ? a.jsonPath : undefined;
            if (jp) failed.add(normalizeMapperPath(jp));
          }
        }
      }
      return failed;
    }
    return null;
  }, [mappingFilter, nodeStatusMap, assertionVerifyMap, arrayAssertions]);

  const effectiveFilter = useMemo((): 'all' | 'mapped' | 'unmapped' => {
    if (mappingFilter === 'passed' || mappingFilter === 'failed') return 'mapped';
    return mappingFilter;
  }, [mappingFilter]);

  const activeVerifyFilter = (mappingFilter === 'passed' || mappingFilter === 'failed') ? mappingFilter : null;

  const effectiveMappedPaths = useMemo(() => {
    if (verifyFilteredPaths !== null) return verifyFilteredPaths;
    return mappedTargetPaths;
  }, [verifyFilteredPaths, mappedTargetPaths]);

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
    let count = 0;
    for (const path of leafPaths) {
      if (mappedTargetPaths.has(normalizeMapperPath(path))) {
        count += 1;
      }
    }
    return count;
  }, [leafPaths, mappedTargetPaths]);

  const unmappedLeafCount = useMemo(
    () => Math.max(leafPaths.length - mappedLeafCount, 0),
    [leafPaths.length, mappedLeafCount],
  );

  const extractDraggedSource = useCallback((e: React.DragEvent): { path: string; sourceId: string } | null => {
    const parsePayload = (raw: string): { path: string; sourceId: string } | null => {
      if (!raw) return null;
      const cleaned = raw.startsWith(SOURCE_TEXT_PREFIX) ? raw.slice(SOURCE_TEXT_PREFIX.length) : raw;
      try {
        const parsed = JSON.parse(cleaned) as { path?: unknown; sourceId?: unknown };
        if (typeof parsed.path === 'string' && typeof parsed.sourceId === 'string') {
          return { path: parsed.path, sourceId: parsed.sourceId };
        }
      } catch {
        // ignore invalid payload
      }
      return null;
    };

    const customMime = parsePayload(e.dataTransfer.getData('application/mapper-source'));
    if (customMime) return customMime;
    const textPayload = parsePayload(e.dataTransfer.getData('text/plain'));
    if (textPayload) return textPayload;
    return getDraggedSource?.() ?? null;
  }, [getDraggedSource]);

  const createUniquePath = useCallback((basePath: string): string => {
    const base = basePath.trim() || 'field';
    if (!existingPaths.has(base)) return base;
    let index = 2;
    let candidate = `${base}_${index}`;
    while (existingPaths.has(candidate)) {
      index += 1;
      candidate = `${base}_${index}`;
    }
    return candidate;
  }, [existingPaths]);

  const handleEmptyStateDragOver = useCallback((e: React.DragEvent) => {
    if (!target.allowCustomFields || !onAddCustomField) return;
    const dragged = extractDraggedSource(e);
    if (!dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
  }, [target.allowCustomFields, onAddCustomField, extractDraggedSource]);

  const handleEmptyStateDrop = useCallback((e: React.DragEvent) => {
    if (!target.allowCustomFields || !onAddCustomField) return;
    const dragged = extractDraggedSource(e);
    if (!dragged) return;
    e.preventDefault();
    const targetPath = createUniquePath(dragged.path);
    onAddCustomField({
      path: targetPath,
      label: targetPath.includes('.') ? targetPath.split('.').pop()! : targetPath,
      type: 'string',
      origin: 'custom',
    });
    onDrop(targetPath, dragged.path, dragged.sourceId);
  }, [target.allowCustomFields, onAddCustomField, extractDraggedSource, createUniquePath, onDrop]);

  return (
    <div
      className={`dm-panel dm-panel--target ${isFocusRegion ? 'dm-panel--focused' : ''}`}
      onFocus={onFocus}
    >
      <div className="dm-panel-header">
        <span className="dm-panel-title">Target</span>
        {treeSource === 'fields' && !pasteMode && (
          <span className="dm-schema-source-badge" title="Tree built from field definitions">fields</span>
        )}
        {(resolvedMappedCount > 0 || unresolvedMappedCount > 0) && !pasteMode && treeSource !== null && (
          <span className="dm-mapped-count-badge">
            {resolvedMappedCount > 0 ? `${resolvedMappedCount} mapped` : '0 mapped'}
            {unresolvedMappedCount > 0 ? ` · ${unresolvedMappedCount} unresolved` : ''}
          </span>
        )}
        <div className="dm-panel-actions">
          {onPasteTargetSample && (
            <button
              className={`dm-btn-icon ${pasteMode ? 'dm-btn-icon--active' : ''}`}
              onClick={togglePasteMode}
              aria-label={pasteMode ? 'Show tree view' : 'Paste JSON'}
              aria-pressed={pasteMode}
            >
              {pasteMode ? 'Tree' : 'JSON'}
            </button>
          )}
          {canFetchTarget && (
            <button
              className="dm-btn-icon"
              onClick={handleFetch}
              disabled={fetching}
              aria-label="Fetch target schema"
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

      {pasteMode ? (
        <div className="dm-paste-container">
          <textarea
            className="dm-paste-textarea"
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPasteError(null); }}
            placeholder='Paste JSON here, e.g. {"name": "Alice", "age": 30}'
            aria-label="Paste target JSON"
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
              type="text"
              className="dm-search-input"
              placeholder="Search fields…"
              aria-label="Search target fields"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="dm-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
            )}
            <select
              className="dm-filter-select"
              aria-label="Filter target fields"
              value={mappingFilter}
              onChange={(e) => setMappingFilter(e.target.value as 'all' | 'mapped' | 'unmapped' | 'passed' | 'failed')}
            >
              <option value="all">All</option>
              <option value="mapped">Mapped</option>
              <option value="unmapped">Unmapped</option>
              {nodeStatusMap && (
                <>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                </>
              )}
            </select>
            <span className="dm-filter-count" aria-live="polite">
              {mappedLeafCount} mapped / {unmappedLeafCount} unmapped
            </span>
          </div>

          {targetFetchError && <FetchErrorBanner error={targetFetchError} />}

          <div
            className="dm-tree-container"
            ref={treeContainerRef}
            role="group"
            tabIndex={isFocusRegion ? 0 : -1}
            onKeyDown={onTreeKeyDown ? (e) => onTreeKeyDown(e, 'target', expandedPaths, handleToggle) : undefined}
          >
            {hasLocationGroups && target.fields ? (
              <LocationGroupPanel
                fields={target.fields}
                mappings={mappings}
                onDrop={onDrop}
                search={search}
                mappingFilter={effectiveFilter}
                mappedTargetPaths={effectiveMappedPaths}
                onNodeSelect={onNodeSelect}
                selectedNodePath={selectedNodePath}
                selectedMappingId={selectedMappingId}
                onSelectMapping={onSelectMapping}
                onEditExpression={onEditExpression}
                typeMismatches={typeMismatches}
                onQuickFix={onQuickFix}
                onRemoveMapping={onRemoveMapping}
                focusedPath={focusedPath}
                traceOverlay={traceOverlay}
                fieldOrigins={fieldOrigins}
                onRemoveCustomField={onRemoveCustomField}
                onUpdateCustomField={onUpdateCustomField}
                onAddCustomField={onAddCustomField}
                allowCustomFields={target.allowCustomFields}
                existingPaths={existingPaths}
                onReorderField={canReorderFields ? onReorderField : undefined}
                onTargetFieldDragStart={onTargetFieldDragStart}
                onTargetFieldDragEnd={onTargetFieldDragEnd}
                getDraggedSource={getDraggedSource}
                getDraggedTargetFieldPath={getDraggedTargetFieldPath}
                resetViewSignal={resetViewSignal}
                unorderedDefault={unorderedDefault}
                onToggleUnorderedArray={onToggleUnorderedArray}
                capabilities={capabilities}
                onUpdateMappingOperator={onUpdateMappingOperator}
                onToggleMappingNegate={onToggleMappingNegate}
                nodeStatusMap={nodeStatusMap}
                fieldVerifyResults={fieldVerifyResults}
                onAddArrayAssertion={onAddArrayAssertion}
                onUpdateArrayAssertion={onUpdateArrayAssertion}
                onRemoveArrayAssertion={onRemoveArrayAssertion}
                arrayAssertions={arrayAssertions}
                assertionVerifyMap={assertionVerifyMap}
                onRemapDrop={onRemapDrop}
                onRemapDragStart={onRemapDragStart}
                onRemapDragEnd={onRemapDragEnd}
                getDraggedRemapId={getDraggedRemapId}
              />
            ) : tree ? (
              <TargetTreeNode
                node={tree}
                depth={0}
                search={search}
                mappingFilter={effectiveFilter}
                verifyFilter={activeVerifyFilter}
                mappedTargetPaths={effectiveMappedPaths}
                onNodeSelect={onNodeSelect}
                selectedNodePath={selectedNodePath}
                mappings={mappings}
                onDrop={onDrop}
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
                selectedMappingId={selectedMappingId}
                onSelectMapping={onSelectMapping}
                onEditExpression={onEditExpression}
                typeMismatches={typeMismatches}
                onQuickFix={onQuickFix}
                onRemoveMapping={onRemoveMapping}
                focusedPath={focusedPath}
                traceOverlay={traceOverlay}
                fieldOrigins={fieldOrigins}
                onRemoveCustomField={onRemoveCustomField}
                onUpdateCustomField={onUpdateCustomField}
                onReorderField={canReorderFields ? onReorderField : undefined}
                onTargetFieldDragStart={onTargetFieldDragStart}
                onTargetFieldDragEnd={onTargetFieldDragEnd}
                getDraggedSource={getDraggedSource}
                getDraggedTargetFieldPath={getDraggedTargetFieldPath}
                unorderedDefault={unorderedDefault}
                onToggleUnorderedArray={onToggleUnorderedArray}
                capabilities={capabilities}
                onUpdateMappingOperator={onUpdateMappingOperator}
                onToggleMappingNegate={onToggleMappingNegate}
                nodeStatusMap={nodeStatusMap}
                fieldVerifyResults={fieldVerifyResults}
                onAddArrayAssertion={onAddArrayAssertion}
                onUpdateArrayAssertion={onUpdateArrayAssertion}
                onRemoveArrayAssertion={onRemoveArrayAssertion}
                arrayAssertions={arrayAssertions}
                assertionVerifyMap={assertionVerifyMap}
                highlightedPaths={highlightedPaths}
                onRemapDrop={onRemapDrop}
                onRemapDragStart={onRemapDragStart}
                onRemapDragEnd={onRemapDragEnd}
                getDraggedRemapId={getDraggedRemapId}
              />
            ) : (
              <div
                className="dm-empty-state dm-empty-state--guided"
                onDragOver={handleEmptyStateDragOver}
                onDrop={handleEmptyStateDrop}
              >
                <div className="dm-empty-state-title">No target schema yet.</div>
                <div className="dm-empty-state-help">
                  Define destination fields before creating mappings.
                </div>
                {target.allowCustomFields && onAddCustomField && (
                  <div className="dm-empty-state-help">
                    Drag a source field here to create a target field and map it.
                  </div>
                )}
                <div className="dm-empty-state-actions">
                  {onPasteTargetSample && (
                    <button
                      type="button"
                      className="dm-empty-action-btn dm-empty-action-btn--primary"
                      onClick={() => setPasteMode(true)}
                    >
                      Paste JSON
                    </button>
                  )}
                  {canFetchTarget && onFetchTargetSchema && (
                    <button
                      type="button"
                      className="dm-empty-action-btn"
                      onClick={handleFetch}
                      disabled={fetching}
                    >
                      {fetching ? 'Fetching…' : 'Fetch schema'}
                    </button>
                  )}
                </div>
              </div>
            )}
            {!hasLocationGroups && target.allowCustomFields && onAddCustomField && (
              <AddFieldRow
                existingPaths={existingPaths}
                onAdd={onAddCustomField}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { MapperTarget, Mapping, TargetField, TargetFieldOrigin } from './types';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { FocusRegion } from './hooks/useKeyboardNavigation';
import type { TypeMismatch } from './utils/typeMismatch';
import type { TraceValueOverlay } from './types';
import { buildJsonTree } from '../../utils/jsonTreeModel';
import { buildTreeFromFields, collectAllPaths } from './utils/targetTreeBuilder';
import TargetTreeNode from './TargetTreeNode';
import AddFieldRow from './AddFieldRow';
import LocationGroupPanel from './LocationGroupPanel';

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
  targetFetchError?: string | null;
  onPasteTargetSample?: (data: unknown) => void;
  onReorderField?: (dragPath: string, dropPath: string) => void;
  onTargetFieldDragStart?: (path: string) => void;
  onTargetFieldDragEnd?: () => void;
  getDraggedSource?: () => { path: string; sourceId: string } | null;
  getDraggedTargetFieldPath?: () => string | null;
  resolvedMappingCount?: number;
  unresolvedMappingCount?: number;
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
  resolvedMappingCount,
  unresolvedMappingCount,
}: TargetPanelProps) {
  const [search, setSearch] = useState('');
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

  const lastFieldsTreeRef = useRef<JsonTreeNode | null>(null);
  useEffect(() => {
    if (treeSource === 'fields' && tree && tree !== lastFieldsTreeRef.current) {
      lastFieldsTreeRef.current = tree;
      setExpandedPaths(collectAllPaths(tree));
    }
  }, [treeSource, tree]);

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

  const handleFetch = useCallback(async () => {
    if (!onFetchTargetSchema) return;
    setFetching(true);
    try {
      await onFetchTargetSchema();
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
          </div>

          {targetFetchError && <div className="dm-paste-error" role="alert">{targetFetchError}</div>}

          <div
            className="dm-tree-container"
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
              />
            ) : tree ? (
              <TargetTreeNode
                node={tree}
                depth={0}
                search={search}
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
              />
            ) : (
              <div className="dm-empty-state dm-empty-state--guided">
                <div className="dm-empty-state-title">No target schema yet.</div>
                <div className="dm-empty-state-help">
                  Define destination fields before creating mappings.
                </div>
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

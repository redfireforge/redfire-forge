import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping, TargetField, TargetFieldOrigin } from './types';
import type { TypeMismatch } from './utils/typeMismatch';
import { normalizeMapperPath } from './utils/pathNormalization';
const SOURCE_TEXT_PREFIX = 'mapper-source:';
const TARGET_FIELD_TEXT_PREFIX = 'mapper-target-field:';

const TYPE_LABELS: Record<string, string> = {
  object: 'obj',
  array: 'arr',
  string: 'str',
  number: 'num',
  boolean: 'bool',
  null: 'null',
};

import type { TraceValueOverlay } from './types';

interface TargetTreeNodeProps {
  node: JsonTreeNode;
  depth: number;
  search: string;
  mappingFilter?: 'all' | 'mapped' | 'unmapped';
  mappedTargetPaths?: Set<string>;
  onNodeSelect?: (path: string) => void;
  selectedNodePath?: string | null;
  mappings: Mapping[];
  onDrop: (targetPath: string, sourcePath: string, sourceId: string) => void;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedMappingId: string | null;
  onSelectMapping: (id: string | null) => void;
  onEditExpression?: (mappingId: string) => void;
  typeMismatches?: TypeMismatch[];
  onQuickFix?: (mappingId: string, suggestedExpression: string) => void;
  onRemoveMapping?: (id: string) => void;
  focusedPath?: string | null;
  traceOverlay?: Map<string, TraceValueOverlay>;
  fieldOrigins?: Map<string, TargetFieldOrigin>;
  onRemoveCustomField?: (path: string) => void;
  onUpdateCustomField?: (oldPath: string, updated: TargetField) => void;
  onReorderField?: (dragPath: string, dropPath: string) => void;
  onTargetFieldDragStart?: (path: string) => void;
  onTargetFieldDragEnd?: () => void;
  getDraggedSource?: () => { path: string; sourceId: string } | null;
  getDraggedTargetFieldPath?: () => string | null;
  unorderedDefault?: boolean;
  onToggleUnorderedArray?: (arrayPath: string) => void;
}

function matchesSearchTerm(node: JsonTreeNode, lower: string): boolean {
  if (!lower) return true;
  if (node.key.toLowerCase().includes(lower)) return true;
  if (node.path.toLowerCase().includes(lower)) return true;
  if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
  return false;
}

function matchesFilter(path: string, mappingFilter: 'all' | 'mapped' | 'unmapped', mappedTargetPaths?: Set<string>): boolean {
  if (mappingFilter === 'all') return true;
  const normalizedPath = normalizeMapperPath(path);
  const isMapped = mappedTargetPaths?.has(normalizedPath) ?? false;
  return mappingFilter === 'mapped' ? isMapped : !isMapped;
}

function matchesNodeVisibility(
  node: JsonTreeNode,
  search: string,
  mappingFilter: 'all' | 'mapped' | 'unmapped',
  mappedTargetPaths?: Set<string>,
): boolean {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const lower = search.toLowerCase();
  const searchMatch = matchesSearchTerm(node, lower);

  if (!hasChildren) {
    return searchMatch && matchesFilter(node.path, mappingFilter, mappedTargetPaths);
  }

  const childMatch = node.children!.some((child) => matchesNodeVisibility(child, search, mappingFilter, mappedTargetPaths));
  if (mappingFilter === 'all') {
    return searchMatch || childMatch;
  }
  return childMatch;
}

function formatNodeDisplayKey(node: JsonTreeNode): string {
  const raw = node.key || '(root)';
  if (!/^\[(\d+|\*)\]$/.test(raw)) return raw;
  const normalizedPath = normalizeMapperPath(node.path);
  const match = normalizedPath.match(/(?:^|\.)([^.[\]]+\[(?:\d+|\*)\])$/);
  return match?.[1] ?? raw;
}

export default function TargetTreeNode({
  node,
  depth,
  search,
  mappingFilter = 'all',
  mappedTargetPaths,
  onNodeSelect,
  selectedNodePath,
  mappings,
  onDrop,
  expandedPaths,
  onToggle,
  selectedMappingId,
  onSelectMapping,
  onEditExpression,
  typeMismatches,
  onQuickFix,
  onRemoveMapping,
  focusedPath,
  traceOverlay,
  fieldOrigins,
  onRemoveCustomField,
  onUpdateCustomField,
  onReorderField,
  onTargetFieldDragStart,
  onTargetFieldDragEnd,
  getDraggedSource,
  getDraggedTargetFieldPath,
  unorderedDefault,
  onToggleUnorderedArray,
}: TargetTreeNodeProps) {
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedPaths.has(node.path || '__root__');
  const isLeaf = !hasChildren;
  const origin = fieldOrigins?.get(node.path);
  const isCustomOrFetched = origin === 'custom' || origin === 'fetched';
  const normalizedNodePath = useMemo(() => normalizeMapperPath(node.path), [node.path]);

  const mapping = useMemo(
    () => mappings.find((m) => normalizeMapperPath(m.targetPath) === normalizedNodePath),
    [mappings, normalizedNodePath],
  );

  const mismatch = useMemo(
    () => mapping && typeMismatches
      ? typeMismatches.find((m) => m.mappingId === mapping.id) : undefined,
    [mapping, typeMismatches],
  );

  const isVisible = useMemo(
    () => matchesNodeVisibility(node, search, mappingFilter, mappedTargetPaths),
    [node, search, mappingFilter, mappedTargetPaths],
  );

  const handleFieldDragStart = useCallback((e: React.DragEvent) => {
    if (!isLeaf || !onReorderField || !node.path) return;
    onTargetFieldDragStart?.(node.path);
    e.dataTransfer.effectAllowed = 'move';
    const payload = JSON.stringify({ kind: 'target-field', path: node.path });
    if (typeof e.dataTransfer.setData === 'function') {
      e.dataTransfer.setData('application/mapper-target-field', payload);
      // Keep text fallback for WebKit drag/drop compatibility.
      e.dataTransfer.setData('text/plain', `${TARGET_FIELD_TEXT_PREFIX}${payload}`);
    }
  }, [isLeaf, onReorderField, node.path, onTargetFieldDragStart]);

  const handleFieldDragEnd = useCallback(() => {
    onTargetFieldDragEnd?.();
  }, [onTargetFieldDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!node.path) return;
    e.preventDefault();
    const activeTargetPath = getDraggedTargetFieldPath?.();
    const hasSourceDrag = !!getDraggedSource?.();
    e.dataTransfer.dropEffect = activeTargetPath && isLeaf && !hasSourceDrag ? 'move' : 'link';
    setDragOver(true);
  }, [isLeaf, node.path, getDraggedTargetFieldPath, getDraggedSource]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!node.path) return;
    e.preventDefault();
    setDragOver(true);
  }, [node.path]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!node.path) return;
      const getDragData = (type: string): string => {
        if (typeof e.dataTransfer.getData !== 'function') return '';
        try {
          return e.dataTransfer.getData(type) ?? '';
        } catch {
          return '';
        }
      };

      const parseJsonPayload = (raw: string): unknown => {
        if (!raw) return null;
        const cleaned = raw.startsWith(SOURCE_TEXT_PREFIX)
          ? raw.slice(SOURCE_TEXT_PREFIX.length)
          : raw.startsWith(TARGET_FIELD_TEXT_PREFIX)
            ? raw.slice(TARGET_FIELD_TEXT_PREFIX.length)
            : raw;
        try {
          return JSON.parse(cleaned);
        } catch {
          return null;
        }
      };

      try {
        const targetFieldRaw = getDragData('application/mapper-target-field') || getDragData('text/plain');
        const targetFieldData = parseJsonPayload(targetFieldRaw) as { kind?: string; path?: string } | null;
        const fallbackTargetPath = getDraggedSource?.() ? null : (getDraggedTargetFieldPath?.() ?? null);
        const dragPath = targetFieldData?.kind === 'target-field' && typeof targetFieldData.path === 'string'
          ? targetFieldData.path
          : fallbackTargetPath;
        if (
          isLeaf
          && !!onReorderField
          && typeof dragPath === 'string'
          && dragPath !== node.path
        ) {
          onReorderField?.(dragPath, node.path);
          onTargetFieldDragEnd?.();
          return;
        }
      } catch { /* not a target-field reorder drop */ }
      try {
        const sourceRaw = getDragData('application/mapper-source') || getDragData('text/plain');
        const data = parseJsonPayload(sourceRaw) as { path?: string; sourceId?: string } | null;
        const fallbackSource = getDraggedSource?.() ?? null;
        const dropSourcePath = typeof data?.path === 'string' ? data.path : fallbackSource?.path;
        const dropSourceId = typeof data?.sourceId === 'string' ? data.sourceId : fallbackSource?.sourceId;
        if (typeof dropSourcePath === 'string' && typeof dropSourceId === 'string') {
          onDrop(node.path, dropSourcePath, dropSourceId);
          onTargetFieldDragEnd?.();
        }
      } catch { /* ignore invalid drag data */ }
    },
    [node.path, onDrop, isLeaf, onReorderField, getDraggedSource, getDraggedTargetFieldPath, onTargetFieldDragEnd],
  );

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const handleStartRename = useCallback(() => {
    if (!isCustomOrFetched || !onUpdateCustomField) return;
    setRenameValue(node.path);
    setRenaming(true);
  }, [isCustomOrFetched, onUpdateCustomField, node.path]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.path) {
      setRenaming(false);
      return;
    }
    onUpdateCustomField?.(node.path, {
      path: trimmed,
      label: trimmed.includes('.') ? trimmed.split('.').pop()! : trimmed,
      type: node.type,
      origin: origin ?? 'custom',
    });
    setRenaming(false);
  }, [renameValue, node.path, node.type, origin, onUpdateCustomField]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setRenaming(false);
    }
  }, [handleRenameSubmit]);

  const handleDoubleClick = useCallback(() => {
    if (mapping && onEditExpression) {
      onEditExpression(mapping.id);
    } else if (isCustomOrFetched && !mapping && onUpdateCustomField) {
      handleStartRename();
    }
  }, [mapping, onEditExpression, isCustomOrFetched, onUpdateCustomField, handleStartRename]);

  if (!isVisible) return null;

  const isMapped = !!mapping || (mappedTargetPaths?.has(normalizedNodePath) ?? false);
  const isSelected = mapping?.id === selectedMappingId && !!selectedMappingId;
  const isBulkSelected = selectedNodePath === node.path;
  const isFocused = focusedPath === node.path;
  const traceVal = traceOverlay?.get(node.path);
  const displayKey = formatNodeDisplayKey(node);
  const nodePathTitle = normalizedNodePath ? `Path: ${normalizedNodePath}` : '(root)';

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--target ${isLeaf ? 'dm-tree-node--leaf' : ''} ${isLeaf && onReorderField ? 'dm-tree-node--reorderable' : ''} ${isMapped ? 'dm-tree-node--mapped' : ''} ${dragOver ? 'dm-tree-node--drag-over' : ''} ${isSelected ? 'dm-tree-node--selected' : ''} ${isBulkSelected ? 'dm-tree-node--bulk-selected' : ''} ${isFocused ? 'dm-tree-node--focused' : ''} ${isCustomOrFetched ? 'dm-tree-node--custom' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        draggable={isLeaf && !!onReorderField}
        onDragStart={isLeaf && onReorderField ? handleFieldDragStart : undefined}
        onDragEnd={isLeaf && onReorderField ? handleFieldDragEnd : undefined}
        onClick={() => {
          onNodeSelect?.(node.path);
          if (mapping) onSelectMapping(isSelected ? null : mapping.id);
        }}
        onDoubleClick={handleDoubleClick}
        data-path={node.path}
      >
        {hasChildren ? (
          <button
            className="dm-tree-toggle"
            onClick={(e) => { e.stopPropagation(); onToggle(node.path || '__root__'); }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            <span className={`dm-chevron ${isExpanded ? 'dm-chevron--open' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="dm-tree-toggle dm-tree-toggle--spacer" />
        )}
        <span className={`dm-type-pill dm-type-pill--${node.type}`}>{TYPE_LABELS[node.type] ?? '?'}</span>
        {renaming ? (
          <input
            ref={renameInputRef}
            className="dm-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            aria-label="Rename field"
          />
        ) : (
          <span className="dm-node-key" title={nodePathTitle}>{displayKey}</span>
        )}
        {!isMapped && !renaming && node.value != null && String(node.value) !== '' && (
          <span className="dm-default-value" title={`Default: ${String(node.value)}`}>
            = {String(node.value).length > 20 ? String(node.value).slice(0, 19) + '…' : String(node.value)}
          </span>
        )}
        {origin === 'custom' && !renaming && (
          <span className="dm-origin-badge dm-origin-badge--custom" title="Custom field">custom</span>
        )}
        {origin === 'fetched' && !renaming && (
          <span className="dm-origin-badge dm-origin-badge--fetched" title="Fetched from API">fetched</span>
        )}
        {isMapped && (
          <span className="dm-mapped-badge">
            {mapping!.expression ? (
              <>
                <span className="dm-mapped-fx-pill">fx</span>
                <span className="dm-mapped-src-ref" title={mapping!.expression}>{mapping!.sourcePath}</span>
              </>
            ) : (
              <>
                <span className="dm-mapped-arrow">←</span>
                <span className="dm-mapped-src-ref" title={mapping!.sourcePath}>{mapping!.sourcePath}</span>
              </>
            )}
          </span>
        )}
        {node.type === 'array' && onToggleUnorderedArray && (() => {
          const isUnordered = unorderedDefault ?? false;
          return (
            <button
              type="button"
              className={`dm-order-badge ${isUnordered ? 'dm-order-badge--unordered' : 'dm-order-badge--ordered'}`}
              title={isUnordered ? 'Unordered: items matched by value (click for ordered)' : 'Ordered: items matched by index (click for unordered)'}
              onClick={(e) => { e.stopPropagation(); onToggleUnorderedArray(node.path); }}
            >
              {isUnordered ? '⟳ unordered' : '↕ ordered'}
            </button>
          );
        })()}
        {mismatch && (
          mismatch.suggestedFix && onQuickFix ? (
            <button
              type="button"
              className={`dm-mismatch-badge dm-mismatch--${mismatch.severity}`}
              aria-label={`${mismatch.message}. Click to apply fix.`}
              onClick={(e) => { e.stopPropagation(); onQuickFix(mismatch.mappingId, mismatch.suggestedFix!); }}
            >
              {mismatch.severity === 'warning' ? '⚠' : 'ℹ'}
            </button>
          ) : (
            <span
              className={`dm-mismatch-badge dm-mismatch--${mismatch.severity}`}
              title={mismatch.message}
              aria-label={mismatch.message}
            >
              {mismatch.severity === 'warning' ? '⚠' : 'ℹ'}
            </span>
          )
        )}
        {traceVal && (
          <span
            className={`dm-trace-value ${traceVal.isError ? 'dm-trace-value--error' : 'dm-trace-value--ok'}`}
            title={traceVal.value}
          >
            = {traceVal.value.length > 20 ? traceVal.value.slice(0, 19) + '…' : traceVal.value}
          </span>
        )}
        {isMapped && mapping && onRemoveMapping && (
          <button
            className="dm-inline-remove"
            aria-label={`Remove mapping for ${node.key}`}
            onClick={(e) => { e.stopPropagation(); onRemoveMapping(mapping.id); }}
          >
            ✕
          </button>
        )}
        {isCustomOrFetched && !isMapped && onRemoveCustomField && (
          <button
            className="dm-inline-remove dm-inline-remove--field"
            aria-label={`Remove custom field ${node.key}`}
            onClick={(e) => { e.stopPropagation(); onRemoveCustomField(node.path); }}
          >
            ✕
          </button>
        )}
        {isLeaf && !isMapped && !isCustomOrFetched && (
          <span className="dm-drop-zone-hint">Drop here</span>
        )}
        {isLeaf && !isMapped && isCustomOrFetched && !renaming && (
          <span className="dm-drop-zone-hint">Drop here</span>
        )}
        {hasChildren && !isExpanded && (
          <span className="dm-node-count">{node.children!.length}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="dm-tree-children">
          {node.children!.map((child) => (
            <TargetTreeNode
              key={child.path || child.key}
              node={child}
              depth={depth + 1}
              search={search}
              mappingFilter={mappingFilter}
              mappedTargetPaths={mappedTargetPaths}
              onNodeSelect={onNodeSelect}
              selectedNodePath={selectedNodePath}
              mappings={mappings}
              onDrop={onDrop}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
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
              onReorderField={onReorderField}
              onTargetFieldDragStart={onTargetFieldDragStart}
              onTargetFieldDragEnd={onTargetFieldDragEnd}
              getDraggedSource={getDraggedSource}
              getDraggedTargetFieldPath={getDraggedTargetFieldPath}
              unorderedDefault={unorderedDefault}
              onToggleUnorderedArray={onToggleUnorderedArray}
            />
          ))}
        </div>
      )}
    </div>
  );
}

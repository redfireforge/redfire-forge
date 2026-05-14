import { useCallback, useMemo } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { DriftSeverity } from './utils/schemaDrift';
import { normalizeMapperPath } from './utils/pathNormalization';

const TYPE_LABELS: Record<string, string> = {
  object: 'obj',
  array: 'arr',
  string: 'str',
  number: 'num',
  boolean: 'bool',
  null: 'null',
};

export type DriftIndicator = { severity: DriftSeverity; label: string };

import type { TraceValueOverlay } from './types';
export type { TraceValueOverlay };

interface SourceTreeNodeProps {
  node: JsonTreeNode;
  depth: number;
  search: string;
  mappingFilter?: 'all' | 'mapped' | 'unmapped';
  onDragStart: (path: string, sourceId: string) => void;
  onDragEnd?: () => void;
  sourceId: string;
  onNodeSelect?: (path: string, sourceId: string) => void;
  selectedNodePath?: string | null;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPaths?: Set<string>;
  onToggleSelect?: (path: string) => void;
  focusedPath?: string | null;
  driftMap?: Map<string, DriftIndicator>;
  traceOverlay?: Map<string, TraceValueOverlay>;
  mappedPaths?: Set<string>;
  highlightedPaths?: Set<string> | null;
}

function matchesSearchTerm(node: JsonTreeNode, lower: string): boolean {
  if (!lower) return true;
  if (node.key.toLowerCase().includes(lower)) return true;
  if (node.path.toLowerCase().includes(lower)) return true;
  if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
  return false;
}

function matchesFilter(path: string, mappingFilter: 'all' | 'mapped' | 'unmapped', mappedPaths?: Set<string>): boolean {
  if (mappingFilter === 'all') return true;
  const isMapped = mappedPaths?.has(normalizeMapperPath(path)) ?? false;
  return mappingFilter === 'mapped' ? isMapped : !isMapped;
}

function matchesNodeVisibility(
  node: JsonTreeNode,
  search: string,
  mappingFilter: 'all' | 'mapped' | 'unmapped',
  mappedPaths?: Set<string>,
): boolean {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const lower = search.toLowerCase();
  const searchMatch = matchesSearchTerm(node, lower);

  if (!hasChildren) {
    return searchMatch && matchesFilter(node.path, mappingFilter, mappedPaths);
  }

  const childMatch = node.children!.some((child) => matchesNodeVisibility(child, search, mappingFilter, mappedPaths));
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

export default function SourceTreeNode({
  node,
  depth,
  search,
  mappingFilter = 'all',
  onDragStart,
  onDragEnd,
  sourceId,
  onNodeSelect,
  selectedNodePath,
  expandedPaths,
  onToggle,
  selectedPaths,
  onToggleSelect,
  focusedPath,
  driftMap,
  traceOverlay,
  mappedPaths,
  highlightedPaths,
}: SourceTreeNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedPaths.has(node.path || '__root__');

  const isVisible = useMemo(
    () => matchesNodeVisibility(node, search, mappingFilter, mappedPaths),
    [node, search, mappingFilter, mappedPaths],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const payload = JSON.stringify({ kind: 'source-field', path: node.path, sourceId });
      e.dataTransfer.setData('application/mapper-source', payload);
      // WKWebView/Safari can strip custom mime types; keep a text/plain fallback.
      e.dataTransfer.setData('text/plain', `mapper-source:${payload}`);
      e.dataTransfer.effectAllowed = 'link';
      onDragStart(node.path, sourceId);
    },
    [node.path, sourceId, onDragStart],
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  const isLeaf = !hasChildren;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onNodeSelect?.(node.path, sourceId);
      if (!isLeaf || !onToggleSelect) return;
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onToggleSelect(node.path);
      }
    },
    [isLeaf, onToggleSelect, node.path, onNodeSelect, sourceId],
  );

  if (!isVisible) return null;

  const isSelected = isLeaf && (selectedPaths?.has(node.path) ?? false);
  const isMapped = isLeaf && (mappedPaths?.has(node.path) ?? false);
  const isBulkSelected = selectedNodePath === node.path;
  const isFocused = focusedPath === node.path;
  const drift = driftMap?.get(node.path)
    ?? driftMap?.get(node.path.replace(/\.?\[(\d+|\*)\]/g, '.[*]'));
  const canDrag = !!node.path && drift?.severity !== 'breaking';
  const traceVal = traceOverlay?.get(node.path);
  const isHoverHighlighted = isLeaf && (highlightedPaths?.has(normalizeMapperPath(node.path)) ?? false);
  const valueStr = isLeaf && node.type !== 'null' ? String(node.value ?? '') : '';
  const truncValue = valueStr.length > 40 ? valueStr.slice(0, 40) + '…' : valueStr;
  const displayKey = formatNodeDisplayKey(node);
  const nodePathTitle = node.path ? `Path: ${normalizeMapperPath(node.path)}` : '(root)';

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--source ${isLeaf ? 'dm-tree-node--leaf' : ''} ${isMapped ? 'dm-tree-node--mapped' : ''} ${isSelected ? 'dm-tree-node--selected' : ''} ${isBulkSelected ? 'dm-tree-node--bulk-selected' : ''} ${isFocused ? 'dm-tree-node--focused' : ''} ${drift ? `dm-tree-node--drift-${drift.severity}` : ''} ${isHoverHighlighted ? 'dm-tree-node--hover-highlight' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        draggable={canDrag}
        onDragStart={canDrag ? handleDragStart : undefined}
        onDragEnd={canDrag ? handleDragEnd : undefined}
        onClick={handleClick}
        data-path={node.path}
        title={drift?.label}
      >
        {hasChildren ? (
          <button
            className="dm-tree-toggle"
            onClick={() => onToggle(node.path || '__root__')}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            <span className={`dm-chevron ${isExpanded ? 'dm-chevron--open' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="dm-tree-toggle dm-tree-toggle--spacer" />
        )}
        <span className={`dm-type-pill dm-type-pill--${node.type}`}>{TYPE_LABELS[node.type] ?? '?'}</span>
        <span
          className={`dm-node-key ${drift?.severity === 'breaking' ? 'dm-node-key--removed' : ''}`}
          title={nodePathTitle}
        >
          {displayKey}
        </span>
        {drift && (
          <span className={`dm-drift-badge dm-drift-badge--${drift.severity}`} aria-label={drift.label}>
            {drift.severity === 'info' ? '●' : drift.severity === 'warning' ? '⚠' : '✕'}
          </span>
        )}
        {isLeaf && truncValue && !traceVal && (
          <span className="dm-node-sample-value" title={valueStr}>{truncValue}</span>
        )}
        {traceVal && (
          <span
            className={`dm-trace-value ${traceVal.isError ? 'dm-trace-value--error' : 'dm-trace-value--ok'}`}
            title={traceVal.value}
          >
            {traceVal.value.length > 24 ? traceVal.value.slice(0, 23) + '…' : traceVal.value}
          </span>
        )}
        {hasChildren && !isExpanded && (
          <span className="dm-node-count">{node.children!.length}</span>
        )}
        {canDrag && <span className="dm-drag-handle" aria-hidden="true" title="Drag to map">⠿</span>}
      </div>
      {hasChildren && isExpanded && (
        <div className="dm-tree-children">
          {node.children!.map((child) => (
            <SourceTreeNode
              key={child.path || child.key}
              node={child}
              depth={depth + 1}
              search={search}
              mappingFilter={mappingFilter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              sourceId={sourceId}
              onNodeSelect={onNodeSelect}
              selectedNodePath={selectedNodePath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              selectedPaths={selectedPaths}
              onToggleSelect={onToggleSelect}
              focusedPath={focusedPath}
              driftMap={driftMap}
              traceOverlay={traceOverlay}
              mappedPaths={mappedPaths}
              highlightedPaths={highlightedPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useCallback, useMemo } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { DriftSeverity } from './utils/schemaDrift';

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
  onDragStart: (path: string, sourceId: string) => void;
  sourceId: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPaths?: Set<string>;
  onToggleSelect?: (path: string) => void;
  focusedPath?: string | null;
  driftMap?: Map<string, DriftIndicator>;
  traceOverlay?: Map<string, TraceValueOverlay>;
  mappedPaths?: Set<string>;
}

function matchesSearch(node: JsonTreeNode, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  if (node.key.toLowerCase().includes(lower)) return true;
  if (node.path.toLowerCase().includes(lower)) return true;
  if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
  if (node.children) return node.children.some((c) => matchesSearch(c, term));
  return false;
}

export default function SourceTreeNode({
  node,
  depth,
  search,
  onDragStart,
  sourceId,
  expandedPaths,
  onToggle,
  selectedPaths,
  onToggleSelect,
  focusedPath,
  driftMap,
  traceOverlay,
  mappedPaths,
}: SourceTreeNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedPaths.has(node.path || '__root__');

  const isVisible = useMemo(() => matchesSearch(node, search), [node, search]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/mapper-source', JSON.stringify({ path: node.path, sourceId }));
      e.dataTransfer.effectAllowed = 'link';
      onDragStart(node.path, sourceId);
    },
    [node.path, sourceId, onDragStart],
  );

  const isLeaf = !hasChildren;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isLeaf || !onToggleSelect) return;
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onToggleSelect(node.path);
      }
    },
    [isLeaf, onToggleSelect, node.path],
  );

  if (!isVisible) return null;

  const isSelected = isLeaf && (selectedPaths?.has(node.path) ?? false);
  const isMapped = isLeaf && (mappedPaths?.has(node.path) ?? false);
  const isFocused = focusedPath === node.path;
  const drift = driftMap?.get(node.path)
    ?? driftMap?.get(node.path.replace(/\.?\[(\d+|\*)\]/g, '.[*]'));
  const traceVal = traceOverlay?.get(node.path);
  const valueStr = isLeaf && node.type !== 'null' ? String(node.value ?? '') : '';
  const truncValue = valueStr.length > 40 ? valueStr.slice(0, 40) + '…' : valueStr;

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--source ${isLeaf ? 'dm-tree-node--leaf' : ''} ${isMapped ? 'dm-tree-node--mapped' : ''} ${isSelected ? 'dm-tree-node--selected' : ''} ${isFocused ? 'dm-tree-node--focused' : ''} ${drift ? `dm-tree-node--drift-${drift.severity}` : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        draggable={isLeaf && drift?.severity !== 'breaking'}
        onDragStart={isLeaf && drift?.severity !== 'breaking' ? handleDragStart : undefined}
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
        <span className={`dm-node-key ${drift?.severity === 'breaking' ? 'dm-node-key--removed' : ''}`}>{node.key || '(root)'}</span>
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
        {isLeaf && <span className="dm-drag-handle" aria-hidden="true" title="Drag to map">⠿</span>}
      </div>
      {hasChildren && isExpanded && (
        <div className="dm-tree-children">
          {node.children!.map((child) => (
            <SourceTreeNode
              key={child.path || child.key}
              node={child}
              depth={depth + 1}
              search={search}
              onDragStart={onDragStart}
              sourceId={sourceId}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              selectedPaths={selectedPaths}
              onToggleSelect={onToggleSelect}
              focusedPath={focusedPath}
              driftMap={driftMap}
              traceOverlay={traceOverlay}
              mappedPaths={mappedPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}

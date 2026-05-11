import { useCallback, useMemo } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';

const TYPE_ICONS: Record<string, string> = {
  object: '{ }',
  array: '[ ]',
  string: 'Aa',
  number: '#',
  boolean: '◉',
  null: '∅',
};

interface SourceTreeNodeProps {
  node: JsonTreeNode;
  depth: number;
  search: string;
  onDragStart: (path: string, sourceId: string) => void;
  sourceId: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
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

  if (!isVisible) return null;

  const isLeaf = !hasChildren;
  const valueStr = isLeaf && node.type !== 'null' ? String(node.value ?? '') : '';
  const truncValue = valueStr.length > 40 ? valueStr.slice(0, 40) + '…' : valueStr;

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--source ${isLeaf ? 'dm-tree-node--leaf' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        draggable={isLeaf}
        onDragStart={isLeaf ? handleDragStart : undefined}
        data-path={node.path}
      >
        {hasChildren ? (
          <button
            className="dm-tree-toggle"
            onClick={() => onToggle(node.path || '__root__')}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className={`dm-chevron ${isExpanded ? 'dm-chevron--open' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="dm-tree-toggle dm-tree-toggle--spacer" />
        )}
        <span className={`dm-type-badge dm-type--${node.type}`}>{TYPE_ICONS[node.type] ?? '?'}</span>
        <span className="dm-node-key">{node.key || '(root)'}</span>
        {isLeaf && truncValue && (
          <span className="dm-node-value" title={valueStr}>{truncValue}</span>
        )}
        {hasChildren && !isExpanded && (
          <span className="dm-node-count">{node.children!.length}</span>
        )}
        {isLeaf && <span className="dm-drag-handle" title="Drag to map">⠿</span>}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

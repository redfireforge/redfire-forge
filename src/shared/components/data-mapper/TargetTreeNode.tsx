import { useState, useCallback, useMemo } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping } from './types';
import type { TypeMismatch } from './utils/typeMismatch';

const TYPE_ICONS: Record<string, string> = {
  object: '{ }',
  array: '[ ]',
  string: 'Aa',
  number: '#',
  boolean: '◉',
  null: '∅',
};

interface TargetTreeNodeProps {
  node: JsonTreeNode;
  depth: number;
  search: string;
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

export default function TargetTreeNode({
  node,
  depth,
  search,
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
}: TargetTreeNodeProps) {
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedPaths.has(node.path || '__root__');
  const isLeaf = !hasChildren;

  const mapping = useMemo(
    () => mappings.find((m) => m.targetPath === node.path),
    [mappings, node.path],
  );

  const mismatch = useMemo(
    () => mapping && typeMismatches
      ? typeMismatches.find((m) => m.mappingId === mapping.id) : undefined,
    [mapping, typeMismatches],
  );

  const isVisible = useMemo(() => matchesSearch(node, search), [node, search]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isLeaf) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    setDragOver(true);
  }, [isLeaf]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!isLeaf) return;
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/mapper-source'));
        if (typeof data.path === 'string' && typeof data.sourceId === 'string') {
          onDrop(node.path, data.path, data.sourceId);
        }
      } catch { /* ignore invalid drag data */ }
    },
    [node.path, onDrop, isLeaf],
  );

  if (!isVisible) return null;

  const isMapped = !!mapping;
  const isSelected = mapping?.id === selectedMappingId && !!selectedMappingId;

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--target ${isLeaf ? 'dm-tree-node--leaf' : ''} ${isMapped ? 'dm-tree-node--mapped' : ''} ${dragOver ? 'dm-tree-node--drag-over' : ''} ${isSelected ? 'dm-tree-node--selected' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={mapping ? () => onSelectMapping(isSelected ? null : mapping.id) : undefined}
        onDoubleClick={mapping && onEditExpression ? () => onEditExpression(mapping.id) : undefined}
        data-path={node.path}
      >
        {hasChildren ? (
          <button
            className="dm-tree-toggle"
            onClick={(e) => { e.stopPropagation(); onToggle(node.path || '__root__'); }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className={`dm-chevron ${isExpanded ? 'dm-chevron--open' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="dm-tree-toggle dm-tree-toggle--spacer" />
        )}
        <span className={`dm-type-badge dm-type--${node.type}`}>{TYPE_ICONS[node.type] ?? '?'}</span>
        <span className="dm-node-key">{node.key || '(root)'}</span>
        {isMapped && (
          <span className="dm-mapped-indicator" title={`← ${mapping.sourcePath}`}>
            {mapping.expression ? 'fx' : '←'} {mapping.sourcePath}
          </span>
        )}
        {mismatch && (
          <span
            className={`dm-mismatch-badge dm-mismatch--${mismatch.severity}`}
            title={mismatch.message}
            onClick={mismatch.suggestedFix && onQuickFix
              ? (e) => { e.stopPropagation(); onQuickFix(mismatch.mappingId, mismatch.suggestedFix!); }
              : undefined}
            style={mismatch.suggestedFix && onQuickFix ? { cursor: 'pointer' } : undefined}
          >
            {mismatch.severity === 'warning' ? '⚠' : 'ℹ'}
          </span>
        )}
        {isMapped && onRemoveMapping && (
          <button
            className="dm-inline-remove"
            title="Remove mapping"
            onClick={(e) => { e.stopPropagation(); onRemoveMapping(mapping.id); }}
          >
            ✕
          </button>
        )}
        {isLeaf && !isMapped && (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

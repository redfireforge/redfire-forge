import { useState, useCallback, useMemo } from 'react';
import type { MapperTarget, Mapping } from './types';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { TypeMismatch } from './utils/typeMismatch';
import { buildJsonTree } from '../../utils/jsonTreeModel';
import TargetTreeNode from './TargetTreeNode';

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
}: TargetPanelProps) {
  const [search, setSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['__root__']));

  const tree: JsonTreeNode | null = useMemo(() => {
    if (!target.sampleData) return null;
    try {
      const data = typeof target.sampleData === 'string'
        ? JSON.parse(target.sampleData)
        : target.sampleData;
      return buildJsonTree(data, '', '');
    } catch {
      return null;
    }
  }, [target.sampleData]);

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

  const mappedCount = mappings.length;

  return (
    <div className="dm-panel dm-panel--target">
      <div className="dm-panel-header">
        <span className="dm-panel-title">Target</span>
        {mappedCount > 0 && <span className="dm-mapped-badge">{mappedCount} mapped</span>}
        <div className="dm-panel-actions">
          <button className="dm-btn-icon" onClick={handleExpandAll} title="Expand all">⊞</button>
          <button className="dm-btn-icon" onClick={handleCollapseAll} title="Collapse all">⊟</button>
        </div>
      </div>

      <div className="dm-search-bar">
        <input
          type="text"
          className="dm-search-input"
          placeholder="Search fields…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="dm-search-clear" onClick={() => setSearch('')}>×</button>
        )}
      </div>

      <div className="dm-tree-container">
        {tree ? (
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
          />
        ) : (
          <div className="dm-empty-state">
            No target schema.
            <br />
            Define target fields or paste sample JSON.
          </div>
        )}
      </div>
    </div>
  );
}

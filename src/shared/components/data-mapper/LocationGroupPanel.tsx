import { useState, useCallback, useMemo } from 'react';
import type { TargetField, TargetFieldLocation, Mapping, TargetFieldOrigin } from './types';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { TypeMismatch } from './utils/typeMismatch';
import type { TraceValueOverlay } from './types';
import { buildTreeFromFields } from './utils/targetTreeBuilder';
import TargetTreeNode from './TargetTreeNode';
import AddFieldRow from './AddFieldRow';

const LOCATION_META: Record<TargetFieldLocation, { icon: string; label: string; accent: string }> = {
  path:     { icon: '📍', label: 'Path',    accent: 'dm-loc-group--path' },
  query:    { icon: '❓', label: 'Query',   accent: 'dm-loc-group--query' },
  header:   { icon: '📋', label: 'Headers', accent: 'dm-loc-group--header' },
  body:     { icon: '📦', label: 'Body',    accent: 'dm-loc-group--body' },
  bodyForm: { icon: '📝', label: 'Form',    accent: 'dm-loc-group--form' },
};

const LOCATION_ORDER: TargetFieldLocation[] = ['path', 'query', 'header', 'body', 'bodyForm'];

interface LocationGroupPanelProps {
  fields: TargetField[];
  mappings: Mapping[];
  onDrop: (targetPath: string, sourcePath: string, sourceId: string) => void;
  search: string;
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
  onAddCustomField?: (field: TargetField) => void;
  allowCustomFields?: boolean;
  existingPaths: Set<string>;
  onReorderField?: (dragPath: string, dropPath: string) => void;
  onTargetFieldDragStart?: (path: string) => void;
  onTargetFieldDragEnd?: () => void;
  getDraggedSource?: () => { path: string; sourceId: string } | null;
  getDraggedTargetFieldPath?: () => string | null;
}

interface GroupData {
  location: TargetFieldLocation;
  fields: TargetField[];
  tree: JsonTreeNode;
}

export default function LocationGroupPanel({
  fields,
  mappings,
  onDrop,
  search,
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
  onAddCustomField,
  allowCustomFields,
  existingPaths,
  onReorderField,
  onTargetFieldDragStart,
  onTargetFieldDragEnd,
  getDraggedSource,
  getDraggedTargetFieldPath,
}: LocationGroupPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TargetFieldLocation>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['__root__']));

  const groups = useMemo<GroupData[]>(() => {
    const grouped = new Map<TargetFieldLocation, TargetField[]>();
    for (const f of fields) {
      if (!f.location) continue;
      if (!grouped.has(f.location)) grouped.set(f.location, []);
      grouped.get(f.location)!.push(f);
    }
    const result: GroupData[] = [];
    for (const loc of LOCATION_ORDER) {
      const locFields = grouped.get(loc);
      if (!locFields?.length) continue;
      const tree = buildTreeFromFields(locFields);
      result.push({ location: loc, fields: locFields, tree });
    }
    return result;
  }, [fields]);

  const ungroupedFields = useMemo(
    () => fields.filter(f => !f.location),
    [fields],
  );

  const ungroupedTree = useMemo(
    () => ungroupedFields.length > 0 ? buildTreeFromFields(ungroupedFields) : null,
    [ungroupedFields],
  );

  const toggleGroup = useCallback((loc: TargetFieldLocation) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  }, []);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const renderGroup = (group: GroupData) => {
    const meta = LOCATION_META[group.location];
    const isCollapsed = collapsedGroups.has(group.location);

    return (
      <div key={group.location} className={`dm-loc-group ${meta.accent}`}>
        <button
          className="dm-loc-group-header"
          onClick={() => toggleGroup(group.location)}
          aria-expanded={!isCollapsed}
          aria-label={`${meta.label} section`}
        >
          <span className="dm-loc-group-chevron">{isCollapsed ? '▶' : '▼'}</span>
          <span className="dm-loc-group-icon">{meta.icon}</span>
          <span className="dm-loc-group-label">{meta.label}</span>
          <span className="dm-loc-group-count">{group.fields.length}</span>
        </button>
        {!isCollapsed && (
          <div className="dm-loc-group-body">
            <TargetTreeNode
              node={group.tree}
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
              onReorderField={onReorderField}
              onTargetFieldDragStart={onTargetFieldDragStart}
              onTargetFieldDragEnd={onTargetFieldDragEnd}
              getDraggedSource={getDraggedSource}
              getDraggedTargetFieldPath={getDraggedTargetFieldPath}
            />
            {allowCustomFields && onAddCustomField && (
              <AddFieldRow
                existingPaths={existingPaths}
                onAdd={onAddCustomField}
                location={group.location}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dm-loc-groups">
      {groups.map(renderGroup)}
      {ungroupedTree && (
        <div className="dm-loc-group dm-loc-group--general">
          <button
            className="dm-loc-group-header"
            onClick={() => toggleGroup('body' as TargetFieldLocation)}
            aria-expanded={true}
            aria-label="Fields section"
          >
            <span className="dm-loc-group-chevron">▼</span>
            <span className="dm-loc-group-icon">📄</span>
            <span className="dm-loc-group-label">Fields</span>
            <span className="dm-loc-group-count">{ungroupedFields.length}</span>
          </button>
          <div className="dm-loc-group-body">
            <TargetTreeNode
              node={ungroupedTree}
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
              onReorderField={onReorderField}
              onTargetFieldDragStart={onTargetFieldDragStart}
              onTargetFieldDragEnd={onTargetFieldDragEnd}
              getDraggedSource={getDraggedSource}
              getDraggedTargetFieldPath={getDraggedTargetFieldPath}
            />
          </div>
        </div>
      )}
      {groups.length === 0 && ungroupedFields.length === 0 && (
        <div className="dm-empty-state">No target fields.</div>
      )}
    </div>
  );
}

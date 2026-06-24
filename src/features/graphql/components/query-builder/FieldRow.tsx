import { memo, useCallback } from 'react';
import type { GraphqlFieldNode, GraphqlTypeNode } from '../../../../shared/types/graphql';
import type { BuilderState, FieldPath } from '../../hooks/useGraphqlQueryBuilder';
import { isLeafType, stripTypeModifiers } from '../../utils/queryBuilderGenerator';
import { ArgInput } from './ArgInput';

export interface FieldRowProps {
  field:           GraphqlFieldNode;
  path:            FieldPath;
  depth:           number;
  state:           BuilderState;
  types:           GraphqlTypeNode[];
  onToggle:        (path: FieldPath) => void;
  onToggleExpand:  (path: FieldPath) => void;
  onSelectAll:     (paths: FieldPath[]) => void;
  onDeselectAll:   (paths: FieldPath[]) => void;
  onSetArg:        (fieldPath: FieldPath, argName: string, value: string) => void;
  allLeafPaths:    (typeName: string, prefix: string, visited?: Set<string>) => string[];
}

export const FieldRow = memo(function FieldRow({
  field, path, depth, state, types,
  onToggle, onToggleExpand, onSelectAll, onDeselectAll, onSetArg, allLeafPaths,
}: FieldRowProps) {
  const isLeaf     = isLeafType(field.type, types);
  const fieldType  = stripTypeModifiers(field.type);
  const isExpanded = !isLeaf && state.expandedPaths.has(path);

  const isSelected = state.selectedFields[path] === true;

  const hasSelectedDescendants = !isLeaf && !isSelected &&
    Object.keys(state.selectedFields).some(
      (k) => state.selectedFields[k] && k.startsWith(path + '.'),
    );

  const isFullySelected = !isLeaf && !isSelected && hasSelectedDescendants && (() => {
    const leaves = allLeafPaths(fieldType, path);
    return leaves.length > 0 && leaves.every((lp) => state.selectedFields[lp] === true);
  })();

  const childType = !isLeaf ? types.find((t) => t.name === fieldType) : null;

  const handleObjectToggle = useCallback(() => {
    if (isLeaf) {
      onToggle(path);
      return;
    }
    if (isSelected || hasSelectedDescendants) {
      const toRemove = Object.keys(state.selectedFields).filter(
        (k) => state.selectedFields[k] && (k === path || k.startsWith(path + '.')),
      );
      onDeselectAll(toRemove);
    } else {
      const leaves = allLeafPaths(fieldType, path);
      if (leaves.length > 0) {
        onSelectAll(leaves);
        if (!isExpanded) onToggleExpand(path);
      } else {
        onToggle(path);
      }
    }
  }, [isLeaf, isSelected, isExpanded, hasSelectedDescendants, path, fieldType, state.selectedFields,
      onToggle, onSelectAll, onDeselectAll, onToggleExpand, allLeafPaths]);

  const typeNode   = types.find((t) => t.name === fieldType) ?? null;
  const typeBadge  = typeNode
    ? typeNode.kind === 'ENUM'      ? 'E'
    : typeNode.kind === 'INTERFACE' ? 'I'
    : typeNode.kind === 'UNION'     ? 'U'
    : isLeaf                        ? null
    : 'O'
    : null;
  const typeBadgeCls = typeNode
    ? typeNode.kind === 'ENUM'      ? 'gql-qb-type-badge--enum'
    : typeNode.kind === 'INTERFACE' ? 'gql-qb-type-badge--interface'
    : typeNode.kind === 'UNION'     ? 'gql-qb-type-badge--union'
    : isLeaf                        ? ''
    : 'gql-qb-type-badge--object'
    : '';

  const hasArgs    = (field.args?.length ?? 0) > 0;
  const showArgs   = (isSelected || hasSelectedDescendants) && hasArgs;

  const effectivelySelected = isSelected || isFullySelected;

  const checkboxCls = effectivelySelected
    ? 'gql-qb-check--checked'
    : hasSelectedDescendants ? 'gql-qb-check--partial' : '';

  return (
    <div className="gql-qb-field-block">
      <div
        className={`gql-qb-field-row${effectivelySelected || hasSelectedDescendants ? ' gql-qb-field-row--selected' : ''}${field.isDeprecated ? ' gql-qb-field-row--deprecated' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {!isLeaf ? (
          <button
            type="button"
            className={`gql-qb-expand-btn${isExpanded ? ' gql-qb-expand-btn--open' : ''}`}
            onClick={() => onToggleExpand(path)}
            aria-label={isExpanded ? `Collapse ${field.name}` : `Expand ${field.name}`}
            aria-expanded={isExpanded}
            tabIndex={0}
          >›</button>
        ) : (
          <span className="gql-qb-expand-spacer" aria-hidden="true" />
        )}

        <button
          type="button"
          className={`gql-qb-check ${checkboxCls}`}
          onClick={handleObjectToggle}
          aria-label={`${effectivelySelected || hasSelectedDescendants ? 'Deselect' : 'Select'} ${field.name}`}
          aria-checked={effectivelySelected ? true : hasSelectedDescendants ? 'mixed' : false}
          role="checkbox"
        >
          {effectivelySelected && (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <polyline points="1.5,5 4,7.5 8.5,2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {hasSelectedDescendants && !effectivelySelected && (
            <span className="gql-qb-check-dash" aria-hidden="true">−</span>
          )}
        </button>

        <span className={`gql-qb-field-name${field.isDeprecated ? ' gql-qb-field-name--deprecated' : ''}`}>
          {field.name}
        </span>

        {typeBadge && (
          <span className={`gql-qb-type-badge ${typeBadgeCls}`} title={fieldType}>
            {typeBadge}
          </span>
        )}

        <span className="gql-qb-type-tag" title={field.type}>{field.type}</span>

        {hasArgs && (
          <span
            className="gql-qb-has-args"
            title={`${field.args!.length} argument${field.args!.length > 1 ? 's' : ''}: ${field.args!.map(a => a.name).join(', ')}`}
            aria-label={`${field.args!.length} argument${field.args!.length > 1 ? 's' : ''}`}
          >
            {field.args!.length} arg{field.args!.length > 1 ? 's' : ''}
          </span>
        )}

        {field.isDeprecated && (
          <span
            className="gql-qb-deprecated-tag"
            title={field.deprecationReason ?? 'Deprecated'}
            aria-label={`Deprecated${field.deprecationReason ? `: ${field.deprecationReason}` : ''}`}
          >
            @deprecated
          </span>
        )}

        {field.description && (
          <span className="gql-qb-field-desc" title={field.description}>
            {field.description.slice(0, 60)}{field.description.length > 60 ? '…' : ''}
          </span>
        )}
      </div>

      {showArgs && (
        <div className="gql-qb-args-block" style={{ paddingLeft: `${8 + depth * 16 + 40}px` }}>
          <div className="gql-qb-args-label">Arguments</div>
          {field.args!.map((arg) => (
            <ArgInput
              key={arg.name}
              fieldPath={path}
              argName={arg.name}
              argType={arg.type}
              value={state.argValues[path]?.[arg.name] ?? ''}
              types={types}
              onChange={(v) => onSetArg(path, arg.name, v)}
            />
          ))}
        </div>
      )}

      {isExpanded && childType?.fields && (
        <div className="gql-qb-children">
          {childType.fields.map((childField) => (
            <FieldRow
              key={childField.name}
              field={childField}
              path={`${path}.${childField.name}`}
              depth={depth + 1}
              state={state}
              types={types}
              onToggle={onToggle}
              onToggleExpand={onToggleExpand}
              onSelectAll={onSelectAll}
              onDeselectAll={onDeselectAll}
              onSetArg={onSetArg}
              allLeafPaths={allLeafPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
});

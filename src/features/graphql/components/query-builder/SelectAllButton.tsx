import { memo, useCallback, useMemo } from 'react';
import type { GraphqlTypeNode } from '@shared/types/graphql';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';
import { isLeafType, stripTypeModifiers } from '../../utils/queryBuilderGenerator';

export interface SelectAllButtonProps {
  rootType:      GraphqlTypeNode;
  state:         BuilderState;
  types:         GraphqlTypeNode[];
  allLeafPaths:  (typeName: string, prefix: string, visited?: Set<string>) => string[];
  onSelectAll:   (paths: string[]) => void;
  onDeselectAll: (paths: string[]) => void;
}

export const SelectAllButton = memo(function SelectAllButton({
  rootType, state, types, allLeafPaths, onSelectAll, onDeselectAll,
}: SelectAllButtonProps) {
  const allLeaves = useMemo(() => {
    const leaves: string[] = [];
    for (const field of rootType.fields ?? []) {
      const leaf = isLeafType(field.type, types);
      if (leaf) {
        leaves.push(field.name);
      } else {
        const fieldType = stripTypeModifiers(field.type);
        leaves.push(...allLeafPaths(fieldType, field.name));
      }
    }
    return leaves;
  }, [rootType, types, allLeafPaths]);

  const selectedCount = useMemo(
    () => allLeaves.filter((p) => state.selectedFields[p] === true).length,
    [allLeaves, state.selectedFields],
  );

  const allSelected  = selectedCount === allLeaves.length && allLeaves.length > 0;
  const label = allSelected ? 'Deselect all' : 'Select all';

  const handleClick = useCallback(() => {
    if (allSelected) {
      onDeselectAll(allLeaves);
    } else {
      onSelectAll(allLeaves);
    }
  }, [allSelected, allLeaves, onSelectAll, onDeselectAll]);

  if (allLeaves.length === 0) return null;

  return (
    <button
      type="button"
      className={`gql-qb-select-all-btn${allSelected ? ' gql-qb-select-all-btn--active' : ''}`}
      onClick={handleClick}
      title={label}
      aria-label={label}
      data-testid="gql-qb-select-all"
    >
      {label}
    </button>
  );
});

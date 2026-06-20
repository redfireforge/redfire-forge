import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GraphqlSchemaInfo } from '../../../../shared/types/graphql';
import type { BuilderState, FieldPath } from '../../hooks/useGraphqlQueryBuilder';
import {
  findType,
  getAncestorPaths,
  getRootTypeName,
  isLeafType,
  searchFields,
  stripTypeModifiers,
} from '../../utils/queryBuilderGenerator';
import { FieldRow } from './FieldRow';
import { SelectAllButton } from './SelectAllButton';

const OP_TYPE_LABEL: Record<'query' | 'mutation' | 'subscription', string> = {
  query:        'Query',
  mutation:     'Mutation',
  subscription: 'Subscription',
};

export interface FieldTreeProps {
  schemaInfo:     GraphqlSchemaInfo | null;
  state:          BuilderState;
  onToggle:       (path: FieldPath) => void;
  onToggleExpand: (path: FieldPath) => void;
  onSelectAll:    (paths: FieldPath[]) => void;
  onDeselectAll:  (paths: FieldPath[]) => void;
  onSetArg:       (fieldPath: FieldPath, argName: string, value: string) => void;
  onSetSearch:    (q: string) => void;
  onSearchExpand: (paths: string[]) => void;
}

export function FieldTree({
  schemaInfo, state, onToggle, onToggleExpand,
  onSelectAll, onDeselectAll, onSetArg, onSetSearch, onSearchExpand,
}: FieldTreeProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  const types        = useMemo(() => schemaInfo?.types ?? [], [schemaInfo]);
  const rootTypeName = schemaInfo
    ? getRootTypeName(state.operationType, schemaInfo)
    : null;
  const rootType     = rootTypeName ? findType(rootTypeName, types) : null;

  const allLeafPaths = useCallback(
    (typeName: string, prefix: string, visited = new Set<string>()): string[] => {
      if (visited.has(typeName)) return [];
      visited.add(typeName);
      const type = types.find((t) => t.name === typeName);
      if (!type?.fields) return [];
      const paths: string[] = [];
      for (const f of type.fields) {
        const fPath = `${prefix}.${f.name}`;
        if (isLeafType(f.type, types)) {
          paths.push(fPath);
        } else {
          const childTypeName = stripTypeModifiers(f.type);
          paths.push(...allLeafPaths(childTypeName, fPath, new Set(visited)));
        }
      }
      return paths;
    },
    [types],
  );

  const searchResults = useMemo(() => {
    if (!state.searchQuery.trim() || !rootTypeName) return [];
    return searchFields(state.searchQuery, rootTypeName, types, 5).slice(0, 30);
  }, [state.searchQuery, rootTypeName, types]);

  const handleSearchKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSetSearch('');
        searchRef.current?.blur();
      }
    },
    [onSetSearch],
  );

  const handleSearchResultClick = useCallback(
    (result: ReturnType<typeof searchFields>[0]) => {
      onSetSearch('');
      const ancestors = getAncestorPaths(result.path);
      onSearchExpand(ancestors);
    },
    [onSetSearch, onSearchExpand],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const inBuilder = document.querySelector('.gql-qb-field-tree');
        if (inBuilder) {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!schemaInfo) {
    return (
      <div className="gql-qb-field-tree">
        <div className="gql-qb-no-schema">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>No schema loaded.</p>
          <p>Use the <strong>Introspect</strong> button in the connection bar to load a schema.</p>
        </div>
      </div>
    );
  }

  if (!rootType?.fields?.length) {
    const rootName = rootTypeName ?? OP_TYPE_LABEL[state.operationType];
    return (
      <div className="gql-qb-field-tree">
        <div className="gql-qb-no-schema">
          <p>No <strong>{rootName}</strong> type found in this schema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gql-qb-field-tree" data-testid="gql-qb-field-tree">
      <div className="gql-qb-search-bar">
        <svg className="gql-qb-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={searchRef}
          type="text"
          className="gql-qb-search-input"
          placeholder="Search fields…  ⌘K"
          value={state.searchQuery}
          onChange={(e) => onSetSearch(e.target.value)}
          onKeyDown={handleSearchKey}
          aria-label="Search schema fields"
          data-testid="gql-qb-search"
        />
        {state.searchQuery && (
          <button
            type="button"
            className="gql-qb-search-clear"
            onClick={() => onSetSearch('')}
            aria-label="Clear search"
          >×</button>
        )}
      </div>

      <div className="gql-qb-tree-type-header">
        <span className="gql-qb-tree-type-name">{rootTypeName}</span>
        <span className="gql-qb-tree-type-kind">root type</span>
        <span className="gql-qb-tree-field-count">{rootType.fields.length} fields</span>
        <SelectAllButton
          rootType={rootType}
          state={state}
          types={types}
          allLeafPaths={allLeafPaths}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
        />
      </div>

      {state.searchQuery.trim() && (
        <div className="gql-qb-search-results" data-testid="gql-qb-search-results">
          {searchResults.length === 0 ? (
            <div className="gql-qb-search-empty">No fields match "{state.searchQuery}"</div>
          ) : (
            <>
              <div className="gql-qb-search-results-header">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                <span className="gql-qb-search-esc-hint">Esc to clear</span>
              </div>
              {searchResults.map((r) => (
                <button
                  key={r.path}
                  type="button"
                  className="gql-qb-search-result"
                  onClick={() => handleSearchResultClick(r)}
                  data-testid={`gql-qb-sr-${r.path}`}
                >
                  <span className="gql-qb-sr-path">{r.path}</span>
                  <span className="gql-qb-sr-type">{r.fieldType}</span>
                  {r.description && (
                    <span className="gql-qb-sr-desc">{r.description.slice(0, 60)}</span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {!state.searchQuery.trim() && (
        <div className="gql-qb-tree-body">
          {rootType.fields.map((field) => (
            <FieldRow
              key={field.name}
              field={field}
              path={field.name}
              depth={0}
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
}

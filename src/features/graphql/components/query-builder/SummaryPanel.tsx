import React, { useCallback, useMemo, useState } from 'react';
import type { GraphqlSchemaInfo } from '../../../../shared/types/graphql';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';
import {
  findType,
  getAncestorPaths,
  getRootTypeName,
  searchFields,
  stripTypeModifiers,
} from '../../utils/queryBuilderGenerator';

export interface SummaryPanelProps {
  selectedCount:  number;
  maxDepth:       number;
  argsCount:      number;
  variablesCount: number;
  schemaInfo:     GraphqlSchemaInfo | null;
  state:          BuilderState;
  onSetSearch:    (q: string) => void;
  onSearchExpand: (paths: string[]) => void;
}

export function SummaryPanel({
  selectedCount, maxDepth, argsCount, variablesCount,
  schemaInfo, state, onSetSearch, onSearchExpand,
}: SummaryPanelProps) {
  const [pathSearch, setPathSearch]   = useState('');
  const [pathResults, setPathResults] = useState<ReturnType<typeof searchFields>>([]);

  const types        = useMemo(() => schemaInfo?.types ?? [], [schemaInfo]);
  const rootTypeName = schemaInfo ? getRootTypeName(state.operationType, schemaInfo) : null;

  const estimatedComplexity = useMemo(() => {
    if (!schemaInfo || selectedCount === 0) return 0;
    const selectedPaths = Object.keys(state.selectedFields).filter((k) => state.selectedFields[k]);
    let cost = 0;
    for (const path of selectedPaths) {
      cost += 1;
      const segments = path.split('.');
      let currentTypeName = rootTypeName ?? 'Query';
      for (const seg of segments) {
        const parentType = findType(currentTypeName, types);
        if (!parentType?.fields) break;
        const field = parentType.fields.find((f) => f.name === seg);
        if (!field) break;
        if (field.type.includes('[')) cost += 2;
        currentTypeName = stripTypeModifiers(field.type);
      }
    }
    return cost;
  }, [schemaInfo, selectedCount, state.selectedFields, types, rootTypeName]);

  const complexityCls = estimatedComplexity > 150 ? 'gql-qb-summary-value--danger'
    : estimatedComplexity > 80  ? 'gql-qb-summary-value--warn'
    : '';

  const handlePathSearch = useCallback((q: string) => {
    setPathSearch(q);
    if (!q.trim() || !rootTypeName) {
      setPathResults([]);
      return;
    }
    const results = searchFields(q, rootTypeName, types, 6).slice(0, 10);
    setPathResults(results);
  }, [rootTypeName, types]);

  const handlePathClick = useCallback(
    (result: ReturnType<typeof searchFields>[0]) => {
      setPathSearch('');
      setPathResults([]);
      const ancestors = getAncestorPaths(result.path);
      onSearchExpand(ancestors);
      onSetSearch(result.fieldName);
    },
    [onSearchExpand, onSetSearch],
  );

  return (
    <div className="gql-qb-summary" data-testid="gql-qb-summary">
      <div className="gql-qb-summary-section">
        <h3 className="gql-qb-summary-title">Selection Summary</h3>
        <div className="gql-qb-summary-grid">
          <div className="gql-qb-summary-row">
            <span className="gql-qb-summary-label">Selected fields</span>
            <span className="gql-qb-summary-value">{selectedCount}</span>
          </div>
          <div className="gql-qb-summary-row">
            <span className="gql-qb-summary-label">Nested depth</span>
            <span className="gql-qb-summary-value">{maxDepth}</span>
          </div>
          <div className="gql-qb-summary-row">
            <span className="gql-qb-summary-label">Arguments</span>
            <span className="gql-qb-summary-value">{argsCount}</span>
          </div>
          <div className="gql-qb-summary-row">
            <span className="gql-qb-summary-label">Variables</span>
            <span className="gql-qb-summary-value">{variablesCount}</span>
          </div>
          {estimatedComplexity > 0 && (
            <div className="gql-qb-summary-row">
              <span className="gql-qb-summary-label">Est. complexity</span>
              <span className={`gql-qb-summary-value ${complexityCls}`} title="Estimated query complexity score">{estimatedComplexity}</span>
            </div>
          )}
        </div>
      </div>

      <div className="gql-qb-summary-section">
        <h3 className="gql-qb-summary-title">Find Field Path</h3>
        <p className="gql-qb-summary-hint">Find how to reach any field from root</p>
        <input
          type="text"
          className="gql-qb-summary-search"
          placeholder="Field name…"
          value={pathSearch}
          onChange={(e) => handlePathSearch(e.target.value)}
          aria-label="Find field path"
          data-testid="gql-qb-path-search"
        />
        {pathResults.length > 0 && (
          <div className="gql-qb-path-results">
            {pathResults.map((r) => (
              <button
                key={r.path}
                type="button"
                className="gql-qb-path-result"
                onClick={() => handlePathClick(r)}
                title={`Navigate to: ${r.path}`}
              >
                <span className="gql-qb-pr-path">
                  {r.path.split('.').map((seg, i, arr) => (
                    <React.Fragment key={i}>
                      <span className={i === arr.length - 1 ? 'gql-qb-pr-leaf' : 'gql-qb-pr-seg'}>
                        {seg}
                      </span>
                      {i < arr.length - 1 && <span className="gql-qb-pr-sep"> › </span>}
                    </React.Fragment>
                  ))}
                </span>
                <span className="gql-qb-pr-type">{r.fieldType}</span>
              </button>
            ))}
          </div>
        )}
        {pathSearch.trim() && pathResults.length === 0 && (
          <div className="gql-qb-path-empty">No paths found for "{pathSearch}"</div>
        )}
      </div>

      <div className="gql-qb-summary-section gql-qb-kbd-section">
        <h3 className="gql-qb-summary-title">Keyboard Shortcuts</h3>
        <div className="gql-qb-kbd-list">
          {[
            { key: '⌘K',    desc: 'Focus search' },
            { key: 'Space', desc: 'Toggle field' },
            { key: '→',     desc: 'Expand type' },
            { key: '←',     desc: 'Collapse type' },
            { key: '⌘↵',   desc: 'Execute query' },
            { key: 'Esc',   desc: 'Clear search' },
          ].map(({ key, desc }) => (
            <div key={key} className="gql-qb-kbd-row">
              <kbd className="gql-qb-kbd">{key}</kbd>
              <span className="gql-qb-kbd-desc">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

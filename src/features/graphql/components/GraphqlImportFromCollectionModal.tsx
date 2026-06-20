/**
 * GraphqlImportFromCollectionModal — pick a saved GraphQL Studio collection item
 * and import its operation into a workflow query/mutation node config panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlQueryNodeData } from '../../workflow/types/workflow';
import { useGraphqlCollections } from '../hooks/useGraphqlCollections';
import { readConnectionProfiles } from '../utils/connectionProfileStorage';
import {
  flattenCollectionImportEntries,
  filterImportEntriesBySearch,
  resolveImportPatchForItem,
  type WorkflowGraphqlImportNodeType,
} from '../utils/collectionItemImport';

export interface GraphqlImportFromCollectionModalProps {
  nodeType: WorkflowGraphqlImportNodeType;
  onImport: (patch: Partial<GraphqlQueryNodeData>) => void;
  onCancel: () => void;
}

function operationBadge(opType: string): string {
  if (opType === 'mutation') return 'M';
  if (opType === 'subscription') return 'S';
  return 'Q';
}

export default function GraphqlImportFromCollectionModal({
  nodeType,
  onImport,
  onCancel,
}: GraphqlImportFromCollectionModalProps) {
  const collections = useGraphqlCollections();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const allEntries = useMemo(
    () => flattenCollectionImportEntries(collections.trees, nodeType),
    [collections.trees, nodeType],
  );

  const filteredEntries = useMemo(
    () => filterImportEntriesBySearch(allEntries, searchQuery),
    [allEntries, searchQuery],
  );

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedItemId && !filteredEntries.some((e) => e.item.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [filteredEntries, selectedItemId]);

  const handleImport = useCallback(async () => {
    const entry = filteredEntries.find((e) => e.item.id === selectedItemId)
      ?? allEntries.find((e) => e.item.id === selectedItemId);
    if (!entry) return;

    setImporting(true);
    try {
      const profiles = await readConnectionProfiles();
      const patch = await resolveImportPatchForItem(entry.item, profiles);
      onImport(patch);
    } finally {
      setImporting(false);
    }
  }, [allEntries, filteredEntries, onImport, selectedItemId]);

  const nodeLabel = nodeType === 'graphqlMutation' ? 'mutation' : 'query';
  const hasCollections = collections.trees.length > 0;
  const hasMatchingItems = allEntries.length > 0;

  return (
    <div
      className="gql-wf-import-col-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import from Collections"
      data-testid="gql-wf-import-col-modal"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter' && selectedItemId && !importing) {
          e.preventDefault();
          void handleImport();
        }
      }}
    >
      <div className="gql-wf-import-col-panel">
        <div className="gql-wf-import-col-header">
          <h3 className="gql-wf-import-col-title">Import from Collections</h3>
          <div className="gql-wf-import-col-search">
            <input
              ref={searchRef}
              type="search"
              className="gql-wf-import-col-search-input"
              placeholder="Search operations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search saved operations"
              data-testid="gql-wf-import-col-search"
            />
            {searchQuery.trim() && (
              <span className="gql-wf-import-col-search-count" data-testid="gql-wf-import-col-search-count">
                {filteredEntries.length}/{allEntries.length}
              </span>
            )}
          </div>
        </div>

        <div className="gql-wf-import-col-body" data-testid="gql-wf-import-col-body">
          {collections.loading ? (
            <div className="gql-wf-import-col-loading" aria-label="Loading collections">
              <div className="gql-history-spinner" aria-hidden="true" />
            </div>
          ) : !hasCollections ? (
            <p className="gql-wf-import-col-empty" data-testid="gql-wf-import-col-empty">
              No collections yet. Open GraphQL Studio, save an operation to a collection, then return here.
            </p>
          ) : !hasMatchingItems ? (
            <p className="gql-wf-import-col-empty" data-testid="gql-wf-import-col-empty">
              {`No saved ${nodeLabel} operations found. Save a ${nodeLabel} in GraphQL Studio first.`}
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="gql-wf-import-col-empty" data-testid="gql-wf-import-col-empty">
              No operations match your search.
            </p>
          ) : (
            <ul className="gql-wf-import-col-list" role="listbox" aria-label="Saved operations">
              {filteredEntries.map(({ item, collectionName }) => {
                const selected = selectedItemId === item.id;
                const opType = item.operation.operationType;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`gql-wf-import-col-item${selected ? ' gql-wf-import-col-item--selected' : ''}`}
                      onClick={() => setSelectedItemId(item.id)}
                      data-testid="gql-wf-import-col-item"
                      data-item-id={item.id}
                    >
                      <span className={`gql-history-badge gql-history-badge--${opType}`}>
                        {operationBadge(opType)}
                      </span>
                      <span className="gql-wf-import-col-item-text">
                        <span className="gql-wf-import-col-item-name">{item.name}</span>
                        <span className="gql-wf-import-col-item-collection">{collectionName}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="gql-wf-import-col-footer">
          <button
            type="button"
            className="gql-wf-import-col-btn gql-wf-import-col-btn--cancel"
            onClick={onCancel}
            data-testid="gql-wf-import-col-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="gql-wf-import-col-btn gql-wf-import-col-btn--import"
            onClick={() => { void handleImport(); }}
            disabled={!selectedItemId || importing || !hasMatchingItems}
            data-testid="gql-wf-import-col-import"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

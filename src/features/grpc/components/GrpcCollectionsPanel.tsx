import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { GrpcCallResult } from '../../../shared/grpc/contracts';
import type { GrpcCollectionV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import { buildGrpcCollectionServiceMethodTree } from '../utils/grpcCollectionTree';
import {
  formatGrpcCallTypeBadge,
  grpcCallTypeBadgeModifier,
} from '../utils/grpcExplorerUtils';
import { GrpcSavedRequestDetail } from './GrpcSavedRequestDetail';
import type { UseGrpcCollectionsResult } from '../hooks/useGrpcCollections';

export interface GrpcCollectionsPanelProps {
  collections: UseGrpcCollectionsResult;
  selectedSavedId: string | null;
  onSelectSaved: (saved: GrpcSavedRequest, collectionId: string) => void;
  grpcurlForSaved: (saved: GrpcSavedRequest) => string;
  onOpenInStudio: (saved: GrpcSavedRequest, collectionId: string) => void;
  onCompareSchema?: (saved: GrpcSavedRequest, collectionId: string) => void;
  onRunLoadTest?: (saved: GrpcSavedRequest, collectionId: string) => void;
  onCopyGrpcurl: (command: string) => void;
  onSavedDeleted?: (savedId: string) => void;
  lastUnaryResult?: GrpcCallResult;
  activeTab?: GrpcStudioTabState;
  openInStudioDisabled?: boolean;
  openInStudioTitle?: string;
  compareSchemaDisabled?: boolean;
  compareSchemaTitle?: string;
  runLoadTestDisabled?: boolean;
  runLoadTestTitle?: string;
}

function matchesSearch(saved: GrpcSavedRequest, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    saved.name,
    saved.service,
    saved.method,
    saved.target ?? '',
  ].join(' ').toLowerCase().includes(needle);
}

export function GrpcCollectionsPanel({
  collections,
  selectedSavedId,
  onSelectSaved,
  grpcurlForSaved,
  onOpenInStudio,
  onCompareSchema,
  onRunLoadTest,
  onCopyGrpcurl,
  onSavedDeleted,
  lastUnaryResult,
  activeTab,
  openInStudioDisabled = false,
  openInStudioTitle = 'Open in Studio',
  compareSchemaDisabled = false,
  compareSchemaTitle = 'Compare schema',
  runLoadTestDisabled = false,
  runLoadTestTitle = 'Run load test',
}: GrpcCollectionsPanelProps) {
  const [search, setSearch] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedSavedId) return;
    for (const collection of collections.collections) {
      if (collection.savedRequests.some((saved) => saved.id === selectedSavedId)) {
        setExpandedCollections((prev) => {
          if (prev.has(collection.id)) return prev;
          const next = new Set(prev);
          next.add(collection.id);
          return next;
        });
        break;
      }
    }
  }, [selectedSavedId, collections.collections]);

  const selectedSaved = useMemo(() => {
    for (const collection of collections.collections) {
      const found = collection.savedRequests.find((saved) => saved.id === selectedSavedId);
      if (found) return { saved: found, collectionId: collection.id };
    }
    return null;
  }, [collections.collections, selectedSavedId]);

  const toggleCollection = (collectionId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const handleNewCollection = async () => {
    const name = window.prompt('Collection name');
    if (!name?.trim()) return;
    try {
      const created = await collections.addCollection(name.trim());
      setExpandedCollections((prev) => new Set(prev).add(created.id));
    } catch {
      /* error surfaced via collections.lastMutationError */
    }
  };

  const handleExportCollections = async () => {
    try {
      const exported = await collections.exportCollections();
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `redfire-grpc-collections-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      /* mutation error is surfaced via hook state */
    }
  };

  const handleImportCollectionsFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const mode = window.confirm('Import mode: OK = Merge into existing collections, Cancel = Replace all collections.')
        ? 'merge'
        : 'replace';
      await collections.importCollections(parsed, mode);
    } catch {
      /* mutation error is surfaced via hook state */
    }
  };

  const renderCollection = (collection: GrpcCollectionV1) => {
    const tree = buildGrpcCollectionServiceMethodTree(collection);
    const expanded = expandedCollections.has(collection.id);
    const visibleCount = tree.services.reduce(
      (count, service) => count + service.methods.reduce(
        (inner, method) => inner + method.savedRequests.filter((saved) => matchesSearch(saved, search)).length,
        0,
      ),
      0,
    );

    return (
      <div key={collection.id} className="grpc-collection-group" data-testid={`grpc-collection-group-${collection.id}`}>
        <button
          type="button"
          className="grpc-collection-group__header"
          onClick={() => toggleCollection(collection.id)}
        >
          <span className="grpc-collection-group__icon" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <span className="grpc-collection-group__name">{collection.name}</span>
          <span className="grpc-collection-group__count">{visibleCount}</span>
        </button>
        {expanded && (
          <div className="grpc-collection-group__body">
            {tree.services.map((serviceNode) => (
              <div key={serviceNode.service} className="grpc-collection-service">
                <div className="grpc-collection-service__header">{serviceNode.service}</div>
                {serviceNode.methods.flatMap((methodNode) => methodNode.savedRequests
                  .filter((saved) => matchesSearch(saved, search))
                  .map((saved) => (
                    <button
                      key={saved.id}
                      type="button"
                      className={`grpc-collection-saved${selectedSavedId === saved.id ? ' grpc-collection-saved--active' : ''}`}
                      data-testid={`grpc-collection-saved-${saved.id}`}
                      onClick={() => onSelectSaved(saved, collection.id)}
                    >
                      <span className={`grpc-method-badge ${grpcCallTypeBadgeModifier(saved.callType)}`}>
                        {formatGrpcCallTypeBadge(saved.callType)}
                      </span>
                      <span className="grpc-collection-saved__name">{saved.name}</span>
                    </button>
                  )))}
              </div>
            ))}
            {visibleCount === 0 && (
              <p className="grpc-collection-group__empty">No saved requests match your search.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grpc-collections-layout" data-testid="grpc-collections-panel">
      {collections.lastMutationError && (
        <p className="grpc-panel-action-error" role="alert" data-testid="grpc-collections-mutation-error">
          {collections.lastMutationError}
        </p>
      )}
      <aside className="grpc-collections-sidebar">
        <div className="grpc-collections-sidebar__header">
          <span className="grpc-collections-sidebar__title">
            Collections ({collections.collections.length})
          </span>
          <div className="grpc-collections-sidebar__actions">
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--xs"
              data-testid="grpc-collections-export-btn"
              onClick={() => { void handleExportCollections(); }}
            >
              Export
            </button>
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--xs"
              data-testid="grpc-collections-import-btn"
              onClick={() => {
                importInputRef.current?.click();
              }}
            >
              Import
            </button>
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--xs"
              data-testid="grpc-collections-new-btn"
              onClick={() => { void handleNewCollection(); }}
              aria-label="New collection"
            >
              +
            </button>
          </div>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          data-testid="grpc-collections-import-input"
          style={{ display: 'none' }}
          onChange={(event) => { void handleImportCollectionsFile(event); }}
        />
        <div className="grpc-collections-search">
          <input
            type="search"
            className="grpc-collections-search__input"
            data-testid="grpc-collections-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search requests…"
            aria-label="Search saved requests"
          />
        </div>
        <div className="grpc-collections-tree" data-testid="grpc-collections-tree">
          {collections.loading && <p className="grpc-collections-sidebar__hint">Loading…</p>}
          {!collections.loading && collections.collections.length === 0 && (
            <p className="grpc-collections-sidebar__hint">Create a collection to save requests.</p>
          )}
          {collections.collections.map(renderCollection)}
        </div>
      </aside>
      <GrpcSavedRequestDetail
        saved={selectedSaved?.saved ?? null}
        grpcurlCommand={selectedSaved ? grpcurlForSaved(selectedSaved.saved) : ''}
        lastUnaryResult={lastUnaryResult}
        openInStudioDisabled={openInStudioDisabled}
        openInStudioTitle={openInStudioTitle}
        compareSchemaDisabled={compareSchemaDisabled}
        compareSchemaTitle={compareSchemaTitle}
        runLoadTestDisabled={runLoadTestDisabled}
        runLoadTestTitle={runLoadTestTitle}
        onOpenInStudio={() => selectedSaved && onOpenInStudio(selectedSaved.saved, selectedSaved.collectionId)}
        onCompareSchema={onCompareSchema
          ? () => selectedSaved && onCompareSchema(selectedSaved.saved, selectedSaved.collectionId)
          : undefined}
        onRunLoadTest={onRunLoadTest
          ? () => selectedSaved && onRunLoadTest(selectedSaved.saved, selectedSaved.collectionId)
          : undefined}
        onCopyGrpcurl={() => selectedSaved && onCopyGrpcurl(grpcurlForSaved(selectedSaved.saved))}
        streamMessages={activeTab?.streamMessages}
        streamLifecycle={activeTab?.streamLifecycle}
        streamError={activeTab?.streamError}
        streamComparisonEligible={Boolean(
          selectedSaved
          && activeTab
          && activeTab.service === selectedSaved.saved.service
          && activeTab.method === selectedSaved.saved.method
          && (!selectedSaved.saved.descriptorKey || activeTab.descriptorKey === selectedSaved.saved.descriptorKey),
        )}
        onDuplicate={() => {
          if (!selectedSaved) return;
          collections.clearLastMutationError();
          void collections.duplicateSavedRequest(selectedSaved.collectionId, selectedSaved.saved.id)
            .then((copy) => onSelectSaved(copy, selectedSaved.collectionId))
            .catch(() => {});
        }}
        onDelete={() => {
          if (!selectedSaved) return;
          const deletedId = selectedSaved.saved.id;
          collections.clearLastMutationError();
          void collections.deleteSavedRequest(selectedSaved.collectionId, deletedId)
            .then(() => onSavedDeleted?.(deletedId))
            .catch(() => {});
        }}
        onUpdateResponseBaseline={(baseline) => {
          if (!selectedSaved) return;
          collections.clearLastMutationError();
          void collections.updateSavedRequest(selectedSaved.collectionId, selectedSaved.saved.id, {
            responseBaseline: baseline,
          }).catch(() => {});
        }}
        onClearResponseBaseline={() => {
          if (!selectedSaved) return;
          collections.clearLastMutationError();
          void collections.updateSavedRequest(selectedSaved.collectionId, selectedSaved.saved.id, {
            responseBaseline: undefined,
          }).catch(() => {});
        }}
      />
    </div>
  );
}

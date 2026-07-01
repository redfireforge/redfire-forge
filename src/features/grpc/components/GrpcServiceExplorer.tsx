import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { GrpcDescriptorLoadState } from '../grpcStudioTypes';
import {
  countDescriptorMethods,
  countGrpcExplorerMethods,
  filterGrpcExplorerTree,
  formatDescriptorSourceLabel,
  formatGrpcCallTypeBadge,
  grpcCallTypeBadgeModifier,
  serviceExplorerIconVariant,
  serviceExplorerInitial,
  serviceExplorerShortName,
  slugifyGrpcExplorerId,
} from '../utils/grpcExplorerUtils';

export interface GrpcServiceExplorerProps {
  loadState: GrpcDescriptorLoadState;
  descriptor?: import('../../../shared/grpc/contracts').GrpcDescriptor;
  errorMessage?: string;
  selectedService?: string;
  selectedMethod?: string;
  expandedServiceIds: string[];
  canReflect: boolean;
  onReflect: () => void;
  onManageSchemas: () => void;
  onSelectMethod: (serviceFullName: string, methodName: string) => void;
  onToggleServiceExpanded: (serviceFullName: string) => void;
}

export function GrpcServiceExplorer({
  loadState,
  descriptor,
  errorMessage,
  selectedService,
  selectedMethod,
  expandedServiceIds,
  canReflect,
  onReflect,
  onManageSchemas,
  onSelectMethod,
  onToggleServiceExpanded,
}: GrpcServiceExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const previousDescriptorKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const nextKey = descriptor?.key;
    if (previousDescriptorKeyRef.current !== nextKey) {
      setSearchQuery('');
      previousDescriptorKeyRef.current = nextKey;
    }
  }, [descriptor?.key]);

  const filteredNodes = useMemo(
    () => (descriptor ? filterGrpcExplorerTree(descriptor, searchQuery) : []),
    [descriptor, searchQuery],
  );

  const visibleMethodCount = useMemo(
    () => countGrpcExplorerMethods(filteredNodes),
    [filteredNodes],
  );

  const totalMethodCount = useMemo(
    () => (descriptor ? countDescriptorMethods(descriptor) : 0),
    [descriptor],
  );

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const reflecting = loadState === 'loading';
  const isSearchActive = searchQuery.trim().length > 0;
  const descriptorLoading = loadState === 'loading';
  const showExplorerTree = Boolean(
    descriptor && (loadState === 'loaded' || loadState === 'loading' || loadState === 'error'),
  );

  return (
    <aside className="grpc-service-explorer" data-testid="grpc-service-explorer">
      <header className="grpc-service-explorer-header">
        <h3 className="grpc-service-explorer-title">Services</h3>
        <div className="grpc-explorer-header-actions">
          <button
            type="button"
            className="grpc-manage-schemas-btn grpc-manage-schemas-btn--header"
            data-testid="grpc-manage-schemas-btn"
            onClick={onManageSchemas}
            disabled={descriptorLoading}
            aria-label="Manage schemas — upload proto files or protoset"
            title="Upload proto files or protoset"
          >
            ⚙
          </button>
          <button
            type="button"
            className="grpc-reflect-btn"
            data-testid="grpc-reflect-btn"
            onClick={onReflect}
            disabled={!canReflect || reflecting}
            aria-label="Load services from server reflection"
            title="Refresh reflection"
          >
            {reflecting ? '…' : '⟳'}
          </button>
        </div>
      </header>

      {descriptor && (
        <div className="grpc-explorer-search-row">
          <span className="grpc-explorer-search-icon" aria-hidden="true">⌕</span>
          <input
            className="grpc-explorer-search"
            data-testid="grpc-explorer-search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Filter methods…"
            spellCheck={false}
          />
        </div>
      )}

      <div className="grpc-explorer-body">
        {loadState === 'idle' && !descriptor && (
          <div className="grpc-explorer-empty-card" data-testid="grpc-explorer-idle">
            <p className="grpc-explorer-empty-title">No services loaded</p>
            <p className="grpc-explorer-empty-copy">
              Set a valid target above, then load the service tree from server reflection or upload schemas manually.
            </p>
            <div className="grpc-explorer-empty-actions">
              <button
                type="button"
                className="grpc-explorer-empty-btn grpc-explorer-empty-btn--primary"
                data-testid="grpc-explorer-idle-reflect"
                onClick={onReflect}
                disabled={!canReflect || reflecting}
              >
                {reflecting ? 'Reflecting…' : 'Reflect services'}
              </button>
              <button
                type="button"
                className="grpc-explorer-empty-btn"
                data-testid="grpc-explorer-idle-schemas"
                onClick={onManageSchemas}
                disabled={descriptorLoading}
              >
                Manage schemas
              </button>
            </div>
          </div>
        )}

        {loadState === 'loading' && !descriptor && (
          <p className="grpc-explorer-empty" data-testid="grpc-explorer-loading">
            Loading descriptor…
          </p>
        )}

        {loadState === 'error' && (
          <p className="grpc-explorer-error" data-testid="grpc-explorer-error">
            {errorMessage ?? 'Failed to load descriptor'}
          </p>
        )}

        {showExplorerTree && (
          <div className="grpc-explorer-tree" data-testid="grpc-explorer-tree" role="tree">
            {filteredNodes.length === 0 ? (
              <p className="grpc-explorer-empty">No services match your filter.</p>
            ) : (
              filteredNodes.map(({ service, methods }) => {
                const expanded = isSearchActive || expandedServiceIds.includes(service.fullName);
                const serviceSlug = slugifyGrpcExplorerId(service.fullName);
                const iconVariant = serviceExplorerIconVariant(service.fullName);
                return (
                  <div key={service.fullName} className="grpc-explorer-service" role="treeitem" aria-expanded={expanded}>
                    <button
                      type="button"
                      className={`grpc-explorer-service-btn${expanded ? ' grpc-explorer-service-btn--open' : ''}`}
                      data-testid={`grpc-service-${serviceSlug}`}
                      onClick={() => onToggleServiceExpanded(service.fullName)}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${service.fullName}`}
                    >
                      <span className={`grpc-explorer-svc-icon grpc-explorer-svc-icon--${iconVariant}`}>
                        {serviceExplorerInitial(service.fullName)}
                      </span>
                      <span className="grpc-explorer-chevron">{expanded ? '▾' : '▸'}</span>
                      <span className="grpc-explorer-service-name">
                        {serviceExplorerShortName(service.fullName)}
                      </span>
                      <span className="grpc-explorer-service-count" data-testid={`grpc-service-count-${serviceSlug}`}>
                        {methods.length}
                      </span>
                    </button>
                    {expanded && (
                      <ul className="grpc-explorer-method-list" role="group">
                        {methods.map((method) => {
                          const selected = selectedService === service.fullName && selectedMethod === method.name;
                          const methodSlug = slugifyGrpcExplorerId(`${service.fullName}-${method.name}`);
                          return (
                            <li key={method.name}>
                              <button
                                type="button"
                                className={`grpc-explorer-method-btn${selected ? ' grpc-explorer-method-btn--selected' : ''}`}
                                data-testid={`grpc-method-${methodSlug}`}
                                onClick={() => onSelectMethod(service.fullName, method.name)}
                                aria-selected={selected}
                              >
                                <span
                                  className={`grpc-method-badge ${grpcCallTypeBadgeModifier(method.callType)}`}
                                  title={method.callType}
                                >
                                  {formatGrpcCallTypeBadge(method.callType)}
                                </span>
                                <span className="grpc-explorer-method-name">{method.name}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {descriptor && (
        <footer className="grpc-explorer-footer" data-testid="grpc-explorer-footer">
          <div className="grpc-explorer-info-row">
            <span>Source:</span>
            <span className="grpc-explorer-chip grpc-explorer-chip--success" data-testid="grpc-explorer-source">
              ● {formatDescriptorSourceLabel(descriptor.source)}
            </span>
          </div>
          <div className="grpc-explorer-info-row">
            <span>Services:</span>
            <strong data-testid="grpc-explorer-service-total">{descriptor.services.length}</strong>
          </div>
          <div className="grpc-explorer-info-row">
            <span>Methods:</span>
            <strong data-testid="grpc-explorer-method-total">
              {isSearchActive ? `${visibleMethodCount} / ${totalMethodCount}` : totalMethodCount}
            </strong>
          </div>
          <button
            type="button"
            className="grpc-manage-schemas-btn"
            data-testid="grpc-manage-schemas-btn-footer"
            onClick={onManageSchemas}
            disabled={descriptorLoading}
            aria-label="Manage schemas — upload proto files or protoset"
          >
            ⚙ Manage Schemas
          </button>
        </footer>
      )}
    </aside>
  );
}

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { PublishedEndpointItem, StatusFilter } from '../utils/publishedEndpointAggregator';
import { filterPublishedEndpoints } from '../utils/publishedEndpointAggregator';
import { scanWorkflowsForCatalogRef, type AffectedWorkflowInfo } from '../utils/workflowExposureScanner';
import { SWAGGER_METHOD_COLORS } from '../../../shared/constants/httpMethodColors';
import type { PublishPermission } from '../hooks/usePublishPermission';
import type { WorkflowPreviewEntry } from '../../../shared/utils/workflowPreviewStorage';

interface PreviewDisplayItem {
  entryId: string;
  entryName: string;
  endpointId: string;
  method: string;
  path: string;
  summary: string;
  addedAt: number;
}

interface Props {
  items: PublishedEndpointItem[];
  /** User-local preview endpoints for the "Previews" filter. */
  previewItems?: WorkflowPreviewEntry[];
  onUnpublish: (entryId: string, endpointId: string) => void;
  onBulkUnpublish?: (ids: Array<{ entryId: string; endpointId: string }>) => void;
  onRepublish?: (entryId: string, endpointId: string) => void;
  onBulkRepublish?: (ids: Array<{ entryId: string; endpointId: string }>) => void;
  /** Promote a preview endpoint to Published. */
  onPromotePreview?: (entryId: string, endpointId: string) => void;
  /** Remove a preview endpoint. */
  onRemovePreview?: (entryId: string, endpointId: string) => void;
  onViewInCatalog: (entryId: string, endpointId: string) => void;
  /** Access control for unpublish/republish actions. */
  publishPermission?: PublishPermission;
}

function compositeKey(entryId: string, endpointId: string) {
  return `${entryId}::${endpointId}`;
}

export default function PublishedEndpointsPanel({ items, previewItems, onUnpublish, onBulkUnpublish, onRepublish, onBulkRepublish, onPromotePreview, onRemovePreview, onViewInCatalog, publishPermission }: Props) {
  type PanelFilter = StatusFilter | 'preview';
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PanelFilter>('all');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [usageKey, setUsageKey] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<AffectedWorkflowInfo[] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showingPreview = statusFilter === 'preview';
  const pubStatusFilter: StatusFilter = showingPreview ? 'all' : statusFilter;

  const filtered = useMemo(
    () => showingPreview ? [] : filterPublishedEndpoints(items, query, pubStatusFilter),
    [items, query, pubStatusFilter, showingPreview],
  );

  const previewDisplay = useMemo<PreviewDisplayItem[]>(() => {
    if (!showingPreview || !previewItems?.length) return [];
    const q = query.toLowerCase().trim();
    return previewItems
      .map(p => ({
        entryId: p.entryId, entryName: p.entryName, endpointId: p.endpointId,
        method: p.method.toUpperCase(), path: p.path, summary: p.summary || p.path, addedAt: p.addedAt,
      }))
      .filter(p => !q || p.method.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) || p.entryName.toLowerCase().includes(q));
  }, [showingPreview, previewItems, query]);

  const staleCount = useMemo(() => items.filter(i => i.isStale).length, [items]);
  const currentCount = items.length - staleCount;
  const previewCount = previewItems?.length ?? 0;

  useEffect(() => {
    setSelectedKeys(prev => {
      const validKeys = new Set(filtered.map(i => compositeKey(i.entryId, i.endpointId)));
      const next = new Set<string>();
      for (const k of prev) {
        if (validKeys.has(k)) next.add(k);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const toggleSelect = useCallback((entryId: string, endpointId: string) => {
    const k = compositeKey(entryId, endpointId);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedKeys.size === filtered.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filtered.map(i => compositeKey(i.entryId, i.endpointId))));
    }
  }, [selectedKeys.size, filtered]);

  const handleBulkUnpublish = useCallback(() => {
    const targets = filtered.filter(item => selectedKeys.has(compositeKey(item.entryId, item.endpointId)));
    if (onBulkUnpublish) {
      onBulkUnpublish(targets.map(t => ({ entryId: t.entryId, endpointId: t.endpointId })));
    } else {
      for (const item of targets) {
        onUnpublish(item.entryId, item.endpointId);
      }
    }
    setSelectedKeys(new Set());
  }, [filtered, selectedKeys, onUnpublish, onBulkUnpublish]);

  const usageKeyRef = useRef(usageKey);
  usageKeyRef.current = usageKey;

  const handleViewUsage = useCallback((entryId: string, endpointId: string) => {
    const key = compositeKey(entryId, endpointId);
    if (usageKey === key) {
      setUsageKey(null);
      setUsageData(null);
      setOpenMenuId(null);
      usageKeyRef.current = null;
      return;
    }
    setUsageLoading(true);
    setUsageKey(key);
    usageKeyRef.current = key;
    setUsageData(null);
    setOpenMenuId(null);
    scanWorkflowsForCatalogRef(entryId, endpointId).then(affected => {
      if (usageKeyRef.current !== key) return;
      setUsageData(affected);
      setUsageLoading(false);
    });
  }, [usageKey]);

  const handleBulkRepublish = useCallback(() => {
    const staleItems = items.filter(i => i.isStale);
    if (onBulkRepublish) {
      onBulkRepublish(staleItems.map(t => ({ entryId: t.entryId, endpointId: t.endpointId })));
    } else if (onRepublish) {
      for (const item of staleItems) {
        onRepublish(item.entryId, item.endpointId);
      }
    }
  }, [items, onRepublish, onBulkRepublish]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (items.length === 0 && previewCount === 0) {
    return (
      <div className="pub-panel" data-testid="published-endpoints-panel">
        <div className="pub-empty">
          <div className="pub-empty-icon">📋</div>
          <div className="pub-empty-title">No Published Endpoints</div>
          <div className="pub-empty-desc">
            Endpoints published to the Workflow Designer will appear here.
            Go to the <strong>Endpoints</strong> tab and set an endpoint's workflow exposure to <strong>Published</strong>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pub-panel" data-testid="published-endpoints-panel">
      {/* ── Toolbar ─────────────────────────────── */}
      <div className="pub-toolbar">
        <input
          type="text"
          className="pub-search"
          placeholder="Search by method, path, summary, or API name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          data-testid="pub-search"
        />
        <div className="pub-filter-pills">
          <button
            className={`pub-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
            data-testid="pub-filter-all"
          >
            All ({items.length + previewCount})
          </button>
          <button
            className={`pub-pill ${statusFilter === 'current' ? 'active' : ''}`}
            onClick={() => setStatusFilter('current')}
            data-testid="pub-filter-current"
          >
            Current ({currentCount})
          </button>
          <button
            className={`pub-pill pub-pill-stale ${statusFilter === 'stale' ? 'active' : ''}`}
            onClick={() => setStatusFilter('stale')}
            data-testid="pub-filter-stale"
          >
            Stale ({staleCount})
          </button>
          {previewCount > 0 && (
            <button
              className={`pub-pill pub-pill-preview ${statusFilter === 'preview' ? 'active' : ''}`}
              onClick={() => setStatusFilter('preview')}
              data-testid="pub-filter-preview"
            >
              Previews ({previewCount})
            </button>
          )}
        </div>
        {selectedKeys.size > 0 && (publishPermission?.canUnpublish ?? true) && (
          <button
            className="pub-bulk-btn"
            onClick={handleBulkUnpublish}
            data-testid="pub-bulk-unpublish"
          >
            Unpublish {selectedKeys.size} selected
          </button>
        )}
        {staleCount > 0 && (publishPermission?.canRepublish ?? true) && (
          <button
            className="pub-bulk-btn pub-bulk-republish"
            onClick={handleBulkRepublish}
            data-testid="pub-bulk-republish"
          >
            Republish All Stale ({staleCount})
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────── */}
      {showingPreview ? (
        <div className="pub-table-wrap">
          <table className="pub-table" data-testid="pub-preview-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>API</th>
                <th>Added</th>
                <th className="pub-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {previewDisplay.map(item => {
                const key = compositeKey(item.entryId, item.endpointId);
                const methodColor = SWAGGER_METHOD_COLORS[item.method] ?? '#888';
                return (
                  <tr key={key} data-testid="pub-preview-row">
                    <td>
                      <span className="pub-method" style={{ background: methodColor }}>{item.method}</span>
                    </td>
                    <td className="pub-path-cell">
                      <span className="pub-path">{item.path}</span>
                      {item.summary !== item.path && (
                        <span className="pub-summary">{item.summary}</span>
                      )}
                    </td>
                    <td className="pub-api-name">{item.entryName}</td>
                    <td className="pub-date">{formatDate(item.addedAt)}</td>
                    <td className="pub-actions-cell">
                      <button
                        className="pub-actions-btn"
                        onClick={() => setOpenMenuId(openMenuId === key ? null : key)}
                        data-testid="pub-preview-actions-btn"
                        aria-label={`Actions for ${item.method} ${item.path}`}
                      >
                        ⋮
                      </button>
                      {openMenuId === key && (
                        <div className="pub-actions-menu" ref={menuRef} data-testid="pub-preview-actions-menu">
                          <button
                            className="pub-action-item"
                            onClick={() => { onViewInCatalog(item.entryId, item.endpointId); setOpenMenuId(null); }}
                            data-testid="pub-preview-action-view"
                          >
                            <span className="pub-action-icon">↗</span>
                            <span className="pub-action-label">View in Catalog</span>
                          </button>
                          {onPromotePreview && (publishPermission?.canPublish ?? true) && (
                            <>
                              <div className="pub-action-divider" />
                              <button
                                className="pub-action-item pub-action-promote"
                                onClick={() => { onPromotePreview(item.entryId, item.endpointId); setOpenMenuId(null); }}
                                data-testid="pub-preview-action-promote"
                              >
                                <span className="pub-action-icon">⬆</span>
                                <span className="pub-action-label">Promote to Published</span>
                              </button>
                            </>
                          )}
                          {onRemovePreview && (
                            <>
                              <div className="pub-action-divider" />
                              <button
                                className="pub-action-item pub-action-danger"
                                onClick={() => { onRemovePreview(item.entryId, item.endpointId); setOpenMenuId(null); }}
                                data-testid="pub-preview-action-remove"
                              >
                                <span className="pub-action-icon">✕</span>
                                <span className="pub-action-label">Remove Preview</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {previewDisplay.length === 0 && previewCount > 0 && (
            <div className="pub-no-results">No previews match the search query.</div>
          )}
        </div>
      ) : (
      <div className="pub-table-wrap">
        <table className="pub-table" data-testid="pub-table">
          <thead>
            <tr>
              <th className="pub-th-check">
                <input
                  type="checkbox"
                  checked={selectedKeys.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  data-testid="pub-select-all"
                />
              </th>
              <th>Method</th>
              <th>Path</th>
              <th>API</th>
              <th>Published</th>
              <th>Status</th>
              <th className="pub-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const key = compositeKey(item.entryId, item.endpointId);
              const methodColor = SWAGGER_METHOD_COLORS[item.method] ?? '#888';
              return (
                <React.Fragment key={key}>
                <tr className={selectedKeys.has(key) ? 'pub-row-selected' : ''} data-testid="pub-row">
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => toggleSelect(item.entryId, item.endpointId)}
                    />
                  </td>
                  <td>
                    <span className="pub-method" style={{ background: methodColor }}>{item.method}</span>
                  </td>
                  <td className="pub-path-cell">
                    <span className="pub-path">{item.path}</span>
                    {item.summary !== item.path && (
                      <span className="pub-summary">{item.summary}</span>
                    )}
                  </td>
                  <td className="pub-api-name">{item.entryName}</td>
                  <td className="pub-date">{formatDate(item.publication.publishedAt)}</td>
                  <td>
                    {item.isStale ? (
                      <span className="pub-status pub-status-stale" data-testid="pub-status-stale">Stale</span>
                    ) : (
                      <span className="pub-status pub-status-current" data-testid="pub-status-current">Current</span>
                    )}
                  </td>
                  <td className="pub-actions-cell">
                    <button
                      className="pub-actions-btn"
                      onClick={() => setOpenMenuId(openMenuId === key ? null : key)}
                      data-testid="pub-actions-btn"
                      aria-label={`Actions for ${item.method} ${item.path}`}
                    >
                      ⋮
                    </button>
                    {openMenuId === key && (
                      <div className="pub-actions-menu" ref={menuRef} data-testid="pub-actions-menu">
                        <button
                          className="pub-action-item"
                          onClick={() => { onViewInCatalog(item.entryId, item.endpointId); setOpenMenuId(null); }}
                          data-testid="pub-action-view"
                        >
                          <span className="pub-action-icon">↗</span>
                          <span className="pub-action-label">View in Catalog</span>
                        </button>
                        <button
                          className="pub-action-item"
                          onClick={() => handleViewUsage(item.entryId, item.endpointId)}
                          data-testid="pub-action-usage"
                        >
                          <span className="pub-action-icon">{usageKey === key ? '◇' : '◈'}</span>
                          <span className="pub-action-label">{usageKey === key ? 'Hide Usage' : 'View Usage'}</span>
                        </button>
                        {item.isStale && onRepublish && (publishPermission?.canRepublish ?? true) && (
                          <>
                            <div className="pub-action-divider" />
                            <button
                              className="pub-action-item pub-action-republish"
                              onClick={() => { onRepublish(item.entryId, item.endpointId); setOpenMenuId(null); }}
                              data-testid="pub-action-republish"
                            >
                              <span className="pub-action-icon">↻</span>
                              <span className="pub-action-label">Republish at current version</span>
                            </button>
                          </>
                        )}
                        {(publishPermission?.canUnpublish ?? true) && (
                          <>
                            <div className="pub-action-divider" />
                            <button
                              className="pub-action-item pub-action-danger"
                              onClick={() => { onUnpublish(item.entryId, item.endpointId); setOpenMenuId(null); }}
                              data-testid="pub-action-unpublish"
                            >
                              <span className="pub-action-icon">⊘</span>
                              <span className="pub-action-label">Unpublish</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {usageKey === key && (
                  <tr className="pub-usage-row" data-testid="pub-usage-row">
                    <td colSpan={7}>
                      <div className="pub-usage-content">
                        {usageLoading && <span className="pub-usage-loading">Loading…</span>}
                        {!usageLoading && usageData && usageData.length === 0 && (
                          <span className="pub-usage-empty" data-testid="pub-usage-empty">No workflows reference this endpoint.</span>
                        )}
                        {!usageLoading && usageData && usageData.length > 0 && (
                          <div className="pub-usage-list" data-testid="pub-usage-list">
                            <span className="pub-usage-label">
                              Referenced by {usageData.length} workflow{usageData.length > 1 ? 's' : ''}
                              {' '}({usageData.reduce((n, w) => n + w.nodeIds.length, 0)} node{usageData.reduce((n, w) => n + w.nodeIds.length, 0) > 1 ? 's' : ''})
                            </span>
                            <ul className="pub-usage-workflows">
                              {usageData.map(w => (
                                <li key={w.workflowId} data-testid="pub-usage-workflow">
                                  <strong>{w.workflowName}</strong> — {w.nodeIds.length} node{w.nodeIds.length > 1 ? 's' : ''}
                                  {w.nodeLabels.length > 0 && <span className="pub-usage-nodes"> ({w.nodeLabels.join(', ')})</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && items.length > 0 && (
          <div className="pub-no-results">No endpoints match the current filter.</div>
        )}
      </div>
      )}

      {/* ── Note about stale ──────────────────── */}
      {staleCount > 0 && (
        <div className="pub-stale-hint" data-testid="pub-stale-hint">
          {staleCount} endpoint{staleCount > 1 ? 's' : ''} published from an older spec version.
          Use the ⋮ menu to republish at the current version.
        </div>
      )}
    </div>
  );
}

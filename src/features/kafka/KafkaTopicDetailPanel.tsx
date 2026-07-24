import { useCallback, useState, useMemo } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import KafkaMessageDetailModal from './KafkaMessageDetailModal';
import type { KafkaTopicDetail } from './useTopicExplorer';
import type { UseTopicMessageBrowserReturn } from './useTopicMessageBrowser';
import type { TimeWindow } from './useTopicMessageBrowser';
import { valuePreview, exportResultSet } from './kafkaMessageStudioUtils';
import type { KafkaUiSafeError } from '../../shared/kafka/kafkaClient';

type DetailTab = 'messages' | 'partitions' | 'groups' | 'config';

interface KafkaTopicDetailPanelProps {
  detail: KafkaTopicDetail | null;
  loading: boolean;
  error: KafkaUiSafeError | null;
  browser: UseTopicMessageBrowserReturn;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  const n = parseInt(ts, 10);
  if (isNaN(n) || n <= 0) return '—';
  const d = new Date(n);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function stateColor(state: string): string {
  const s = state.toLowerCase();
  if (s === 'stable') return 'kafka-cg-state-green';
  if (s.includes('rebalance') || s.includes('completing')) return 'kafka-cg-state-amber';
  return 'kafka-cg-state-grey';
}

export function KafkaTopicDetailPanel({ detail, loading, error, browser }: KafkaTopicDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('messages');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleConsume = useCallback(() => { void browser.consumeOnce(); }, [browser]);
  const handleLoadMore = useCallback(() => { void browser.loadMore(); }, [browser]);
  const handleExport = useCallback(() => {
    if (browser.result) void exportResultSet(browser.result, detail?.name ?? 'topic');
  }, [browser.result, detail?.name]);

  const handleCloseDetail = useCallback(() => {
    browser.selectMessage(null);
  }, [browser]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (browser.draft.keyEquals?.trim()) count++;
    if (browser.draft.headerMatch?.trim()) count++;
    if (browser.draft.jsonPath?.trim()) count++;
    if (browser.draft.bodyContains?.trim()) count++;
    return count;
  }, [browser.draft.keyEquals, browser.draft.headerMatch, browser.draft.jsonPath, browser.draft.bodyContains]);

  if (loading) {
    return (
      <div className="kafka-explorer-detail-card">
        <div className="kafka-explorer-detail-loading">Loading topic details…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kafka-explorer-detail-card">
        <div className="kafka-ms-inline-error">{error.message}</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="kafka-explorer-detail-card">
        <div className="kafka-explorer-detail-empty">Select a topic to view details</div>
      </div>
    );
  }

  const totalMessages = detail.partitions.reduce((sum, p) => sum + p.messageCount, 0);

  return (
    <div className="kafka-explorer-detail-card">
      <div className="kafka-explorer-detail-header">
        <span className="kafka-explorer-detail-title">{detail.name}</span>
        <span className={`kafka-topic-health-badge kafka-topic-health-${detail.healthStatus}`}>
          {detail.healthStatus === 'healthy' ? '● OK' : detail.healthStatus === 'degraded' ? '⚠ Warn' : '? Unknown'}
        </span>
      </div>

      <div className="kafka-explorer-detail-tabs" data-testid="detail-tabs">
        {(['messages', 'partitions', 'groups', 'config'] as DetailTab[]).map((t) => (
          <button
            key={t}
            className={`kafka-explorer-detail-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            data-testid={`detail-tab-${t}`}
          >
            {t === 'messages' ? 'Messages' : t === 'partitions' ? 'Partitions' : t === 'groups' ? 'Consumer Groups' : 'Config'}
          </button>
        ))}
      </div>

      <div className="kafka-explorer-detail-body">
        {tab === 'messages' && (
          <div data-testid="detail-messages-tab" className="td-messages-tab">
            {/* ── Metrics ── */}
            <div className="kafka-explorer-metrics-row">
              <div className="kafka-explorer-metric-box">
                <span className="kafka-explorer-metric-label">Partitions</span>
                <span className="kafka-explorer-metric-value">{detail.partitionCount}</span>
              </div>
              <div className="kafka-explorer-metric-box">
                <span className="kafka-explorer-metric-label">Replication</span>
                <span className="kafka-explorer-metric-value">{detail.replicationFactor}</span>
              </div>
              <div className="kafka-explorer-metric-box">
                <span className="kafka-explorer-metric-label">Total Messages</span>
                <span className="kafka-explorer-metric-value">{formatNumber(totalMessages)}</span>
              </div>
              <div className="kafka-explorer-metric-box">
                <span className="kafka-explorer-metric-label">Consumer Groups</span>
                <span className="kafka-explorer-metric-value">{detail.consumerGroups.length}</span>
              </div>
            </div>

            {/* ── Compact browse toolbar ── */}
            <div className="td-browse-bar">
              <CustomSelect
                value={browser.draft.timeWindow}
                onChange={(v) => browser.setDraft({ timeWindow: v as TimeWindow })}
                options={[
                  { value: 'latest', label: 'Latest' },
                  { value: 'last-1h', label: 'Last 1h' },
                  { value: 'last-24h', label: 'Last 24h' },
                  { value: 'earliest', label: 'Earliest' },
                ]}
                aria-label="Time Window"
              />
              <CustomSelect
                value={browser.draft.partition}
                onChange={(v) => browser.setDraft({ partition: v })}
                options={[
                  { value: '', label: 'Partition: Any' },
                  ...detail.partitions.map((p) => ({
                    value: String(p.partitionId),
                    label: `Partition ${p.partitionId}`,
                  })),
                ]}
                aria-label="Partition"
              />
              <CustomSelect
                value={browser.draft.sortOrder}
                onChange={(v) => browser.setDraft({ sortOrder: v as 'asc' | 'desc' })}
                data-testid="detail-sort-order"
                options={[
                  { value: 'asc', label: 'Oldest first' },
                  { value: 'desc', label: 'Newest first' },
                ]}
                aria-label="Sort Order"
              />
              <div className="td-max-wrap">
                <span className="td-max-label">Max</span>
                <input
                  type="text"
                  className="td-max-input"
                  value={browser.draft.maxMessages}
                  onChange={(e) => browser.setDraft({ maxMessages: e.target.value })}
                  title="Max messages to consume"
                  aria-label="Max messages"
                />
              </div>
              <button
                type="button"
                className={`td-filter-toggle${filtersOpen ? ' td-filter-toggle--open' : ''}${activeFilterCount > 0 ? ' td-filter-toggle--active' : ''}`}
                onClick={() => setFiltersOpen((o) => !o)}
                title={filtersOpen ? 'Hide filters' : 'Show filters'}
                aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
              >
                ⫧ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>

            {/* ── Collapsible filter section ── */}
            {filtersOpen && (
              <div className="td-filter-section">
                <div className="td-filter-grid">
                  <div className="td-filter-field">
                    <label>Key</label>
                    <input type="text" placeholder="exact key" value={browser.draft.keyEquals} onChange={(e) => browser.setDraft({ keyEquals: e.target.value })} />
                  </div>
                  <div className="td-filter-field">
                    <label>Header</label>
                    <input type="text" placeholder="key=value" value={browser.draft.headerMatch} onChange={(e) => browser.setDraft({ headerMatch: e.target.value })} data-testid="detail-header-match" />
                  </div>
                  <div className="td-filter-field">
                    <label>JSONPath</label>
                    <input type="text" placeholder="$.store.name" value={browser.draft.jsonPath} onChange={(e) => browser.setDraft({ jsonPath: e.target.value })} data-testid="detail-jsonpath" />
                  </div>
                  <div className="td-filter-field">
                    <label>Expected</label>
                    <input type="text" placeholder="expected value" value={browser.draft.jsonPathEquals} onChange={(e) => browser.setDraft({ jsonPathEquals: e.target.value })} data-testid="detail-jsonpath-expected" />
                  </div>
                  <div className="td-filter-field td-filter-field--wide">
                    <label>Body contains</label>
                    <input type="text" placeholder="search text in body" value={browser.draft.bodyContains} onChange={(e) => browser.setDraft({ bodyContains: e.target.value })} data-testid="detail-body-contains" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Action row ── */}
            <div className="td-action-row">
              <button className="kafka-ms-primary-btn" disabled={browser.loading} onClick={handleConsume} data-testid="detail-consume-btn">
                {browser.loading ? 'Consuming…' : 'Consume Once'}
              </button>
              {browser.result !== null && (
                <>
                  <button className="kafka-ms-secondary-btn" onClick={handleExport} disabled={browser.messageCount === 0}>Export</button>
                  <button className="kafka-ms-ghost-btn" onClick={browser.clearResult}>Clear</button>
                </>
              )}
              {browser.result !== null && !browser.error && (
                <span className="td-result-summary">
                  {browser.messageCount} message{browser.messageCount !== 1 ? 's' : ''}
                  {browser.timedOut && <span className="kafka-ms-timed-out-badge">timed out</span>}
                </span>
              )}
            </div>

            {browser.error && (
              <div className="kafka-ms-inline-error">{browser.error.message}</div>
            )}

            {/* ── Results table ── */}
            {browser.result !== null && !browser.error && (
              <div className="kafka-ms-results-zone" data-testid="detail-results">
                {browser.messageCount === 0 ? (
                  <p className="kafka-ms-empty-state">No messages received</p>
                ) : (
                  <div className="kafka-ms-results-table-wrap">
                    <table className="kafka-ms-results-table">
                      <thead>
                        <tr><th>#</th><th>Offset</th><th>Partition</th><th>Timestamp</th><th>Key</th><th>Value</th></tr>
                      </thead>
                      <tbody>
                        {browser.result.map((row, idx) => (
                          <tr
                            key={`${row.partition}-${row.offset}`}
                            className={browser.selectedIndex === idx ? 'selected' : ''}
                            onClick={() => browser.selectMessage(browser.selectedIndex === idx ? null : idx)}
                            style={{ cursor: 'pointer' }}
                            data-testid={`detail-row-${idx}`}
                          >
                            <td>{idx + 1}</td>
                            <td>{row.offset}</td>
                            <td>{row.partition}</td>
                            <td>{formatTimestamp(row.timestamp)}</td>
                            <td>{row.key ?? '—'}</td>
                            <td>{valuePreview(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {browser.hasMore && (
                      <div className="kafka-ms-load-more-row" data-testid="detail-load-more-row">
                        <button
                          className="kafka-ms-secondary-btn"
                          onClick={handleLoadMore}
                          disabled={browser.loadMoreLoading}
                          data-testid="detail-load-more-btn"
                        >
                          {browser.loadMoreLoading ? 'Loading…' : 'Load More'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {browser.selectedMessage && (
              <KafkaMessageDetailModal
                message={browser.selectedMessage}
                onClose={handleCloseDetail}
              />
            )}
          </div>
        )}

        {tab === 'partitions' && (
          <div data-testid="detail-partitions-tab">
            <table className="kafka-partition-table">
              <thead>
                <tr><th>Partition</th><th>Leader</th><th>Replicas</th><th>ISR</th><th>Earliest</th><th>Latest</th><th>Messages</th></tr>
              </thead>
              <tbody>
                {detail.partitions.map((p) => (
                  <tr key={p.partitionId}>
                    <td>{p.partitionId}</td>
                    <td>{p.leader}</td>
                    <td>{p.replicas.join(', ')}</td>
                    <td>
                      <span className={`kafka-isr-fraction ${p.isr.length < p.replicas.length ? 'kafka-isr-amber' : ''}`}>
                        {p.isr.length} / {p.replicas.length}
                      </span>
                    </td>
                    <td>{p.earliestOffset}</td>
                    <td>{p.latestOffset}</td>
                    <td>{formatNumber(p.messageCount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}><strong>Total</strong></td>
                  <td><strong>{formatNumber(totalMessages)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === 'groups' && (
          <div data-testid="detail-groups-tab">
            {detail.consumerGroups.length === 0 ? (
              <p className="kafka-ms-empty-state">No consumer groups found for this topic.</p>
            ) : (
              <table className="kafka-consumer-group-table">
                <thead>
                  <tr><th>Group ID</th><th>State</th><th>Total Lag</th></tr>
                </thead>
                <tbody>
                  {detail.consumerGroups.map((g) => (
                    <tr key={g.groupId}>
                      <td>{g.groupId}</td>
                      <td><span className={`kafka-cg-state-badge ${stateColor(g.state)}`}>{g.state}</span></td>
                      <td className={g.totalLag > 0 ? 'kafka-lag-amber' : 'kafka-lag-green'}>{formatNumber(g.totalLag)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'config' && (
          <div data-testid="detail-config-tab">
            {Object.keys(detail.config).length === 0 ? (
              <p className="kafka-ms-empty-state">No configuration data available.</p>
            ) : (
              <table className="kafka-config-table">
                <thead><tr><th>Config Key</th><th>Value</th></tr></thead>
                <tbody>
                  {Object.entries(detail.config).map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

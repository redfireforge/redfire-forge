import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KafkaTopicDetail } from './useTopicExplorer';
import type { UseTopicMessageBrowserReturn } from './useTopicMessageBrowser';
import type { TimeWindow } from './useTopicMessageBrowser';
import type { KafkaConsumeResultRow } from './types';
import { valuePreview, exportResultSet } from './kafkaMessageStudioUtils';
import type { KafkaUiSafeError } from '../../shared/kafka/kafkaClient';

type DetailTab = 'messages' | 'partitions' | 'groups' | 'config';

interface KafkaTopicDetailPanelProps {
  detail: KafkaTopicDetail | null;
  loading: boolean;
  error: KafkaUiSafeError | null;
  browser: UseTopicMessageBrowserReturn;
}

interface TimeWindowOption {
  value: TimeWindow;
  label: string;
}

interface DetailDropdownOption<T extends string> {
  value: T;
  label: string;
}

type DetailDropdownKey = 'time-window' | 'partition' | 'sort-order';

const TIME_WINDOW_OPTIONS: TimeWindowOption[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'last-1h', label: 'Last 1 Hour' },
  { value: 'last-24h', label: 'Last 24 Hours' },
  { value: 'earliest', label: 'Earliest' },
];

const SORT_ORDER_OPTIONS: DetailDropdownOption<'asc' | 'desc'>[] = [
  { value: 'asc', label: 'Oldest First' },
  { value: 'desc', label: 'Newest First' },
];

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
  const [openDropdown, setOpenDropdown] = useState<DetailDropdownKey | null>(null);

  useEffect(() => {
    if (!openDropdown) return;

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.kafka-ms-detail-filter-dropdown')) {
        setOpenDropdown(null);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdown(null);
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openDropdown]);

  const selectedTimeWindow = useMemo(
    () => TIME_WINDOW_OPTIONS.find((option) => option.value === browser.draft.timeWindow) ?? TIME_WINDOW_OPTIONS[0],
    [browser.draft.timeWindow],
  );

  const partitionList = detail?.partitions ?? [];

  const partitionOptions = useMemo<DetailDropdownOption<string>[]>(() => {
    return [
      { value: '', label: 'Any' },
      ...partitionList.map((p) => ({ value: String(p.partitionId), label: String(p.partitionId) })),
    ];
  }, [partitionList]);

  const selectedPartition = useMemo(
    () => partitionOptions.find((option) => option.value === browser.draft.partition) ?? partitionOptions[0],
    [partitionOptions, browser.draft.partition],
  );

  const selectedSortOrder = useMemo(
    () => SORT_ORDER_OPTIONS.find((option) => option.value === browser.draft.sortOrder) ?? SORT_ORDER_OPTIONS[0],
    [browser.draft.sortOrder],
  );

  const handleConsume = useCallback(() => { void browser.consumeOnce(); }, [browser]);
  const handleLoadMore = useCallback(() => { void browser.loadMore(); }, [browser]);
  const handleExport = useCallback(() => {
    if (browser.result) void exportResultSet(browser.result, detail?.name ?? 'topic');
  }, [browser.result, detail?.name]);

  const handleCopyKey = useCallback((msg: KafkaConsumeResultRow) => {
    if (msg.key) void navigator.clipboard.writeText(msg.key);
  }, []);

  const handleCopyPayload = useCallback((msg: KafkaConsumeResultRow) => {
    void navigator.clipboard.writeText(msg.value);
  }, []);

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
          <div data-testid="detail-messages-tab">
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

            <div className="kafka-ms-field-grid">
              <div className="kafka-ms-field">
                <label>Time Window</label>
                <div className="kafka-explorer-filter-dropdown kafka-ms-detail-filter-dropdown">
                  <button
                    type="button"
                    className="kafka-explorer-filter-trigger kafka-ms-detail-filter-trigger"
                    onClick={() => setOpenDropdown((open) => (open === 'time-window' ? null : 'time-window'))}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'time-window'}
                    data-testid="detail-time-window-trigger"
                  >
                    <span>{selectedTimeWindow.label}</span>
                    <span className="kafka-explorer-filter-chevron" aria-hidden>▾</span>
                  </button>

                  {openDropdown === 'time-window' && (
                    <div className="kafka-explorer-filter-menu" role="listbox" aria-label="time window options">
                      {TIME_WINDOW_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`kafka-explorer-filter-option${option.value === browser.draft.timeWindow ? ' active' : ''}`}
                          role="option"
                          aria-selected={option.value === browser.draft.timeWindow}
                          onClick={() => {
                            browser.setDraft({ timeWindow: option.value });
                            setOpenDropdown(null);
                          }}
                          data-testid={`detail-time-window-opt-${option.value}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="kafka-ms-field">
                <label>Partition</label>
                <div className="kafka-explorer-filter-dropdown kafka-ms-detail-filter-dropdown">
                  <button
                    type="button"
                    className="kafka-explorer-filter-trigger kafka-ms-detail-filter-trigger"
                    onClick={() => setOpenDropdown((open) => (open === 'partition' ? null : 'partition'))}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'partition'}
                    data-testid="detail-partition-trigger"
                  >
                    <span>{selectedPartition.label}</span>
                    <span className="kafka-explorer-filter-chevron" aria-hidden>▾</span>
                  </button>

                  {openDropdown === 'partition' && (
                    <div className="kafka-explorer-filter-menu" role="listbox" aria-label="partition options">
                      {partitionOptions.map((option) => (
                        <button
                          key={option.value || '__any'}
                          type="button"
                          className={`kafka-explorer-filter-option${option.value === browser.draft.partition ? ' active' : ''}`}
                          role="option"
                          aria-selected={option.value === browser.draft.partition}
                          onClick={() => {
                            browser.setDraft({ partition: option.value });
                            setOpenDropdown(null);
                          }}
                          data-testid={`detail-partition-opt-${option.value || 'any'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="kafka-ms-field-grid">
              <div className="kafka-ms-field">
                <label>Key Match</label>
                <input type="text" placeholder="exact key" value={browser.draft.keyEquals} onChange={(e) => browser.setDraft({ keyEquals: e.target.value })} />
              </div>
              <div className="kafka-ms-field">
                <label>Header Match</label>
                <input type="text" placeholder="key=value" value={browser.draft.headerMatch} onChange={(e) => browser.setDraft({ headerMatch: e.target.value })} data-testid="detail-header-match" />
              </div>
            </div>
            <div className="kafka-ms-field-grid">
              <div className="kafka-ms-field">
                <label>JSONPath</label>
                <input type="text" placeholder="$.store.name" value={browser.draft.jsonPath} onChange={(e) => browser.setDraft({ jsonPath: e.target.value })} data-testid="detail-jsonpath" />
              </div>
              <div className="kafka-ms-field">
                <label>JSONPath Expected</label>
                <input type="text" placeholder="expected value" value={browser.draft.jsonPathEquals} onChange={(e) => browser.setDraft({ jsonPathEquals: e.target.value })} data-testid="detail-jsonpath-expected" />
              </div>
            </div>
            <div className="kafka-ms-field-grid">
              <div className="kafka-ms-field">
                <label>Max Messages</label>
                <input type="text" value={browser.draft.maxMessages} onChange={(e) => browser.setDraft({ maxMessages: e.target.value })} />
              </div>
              <div className="kafka-ms-field">
                <label>Sort Order</label>
                <div className="kafka-explorer-filter-dropdown kafka-ms-detail-filter-dropdown">
                  <button
                    type="button"
                    className="kafka-explorer-filter-trigger kafka-ms-detail-filter-trigger"
                    onClick={() => setOpenDropdown((open) => (open === 'sort-order' ? null : 'sort-order'))}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'sort-order'}
                    data-testid="detail-sort-order-trigger"
                  >
                    <span>{selectedSortOrder.label}</span>
                    <span className="kafka-explorer-filter-chevron" aria-hidden>▾</span>
                  </button>

                  {openDropdown === 'sort-order' && (
                    <div className="kafka-explorer-filter-menu" role="listbox" aria-label="sort order options">
                      {SORT_ORDER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`kafka-explorer-filter-option${option.value === browser.draft.sortOrder ? ' active' : ''}`}
                          role="option"
                          aria-selected={option.value === browser.draft.sortOrder}
                          onClick={() => {
                            browser.setDraft({ sortOrder: option.value });
                            setOpenDropdown(null);
                          }}
                          data-testid={`detail-sort-order-opt-${option.value}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="kafka-ms-action-row">
              <button className="kafka-ms-primary-btn" disabled={browser.loading} onClick={handleConsume} data-testid="detail-consume-btn">
                {browser.loading ? 'Consuming…' : 'Consume Once'}
              </button>
              {browser.result !== null && (
                <>
                  <button className="kafka-ms-secondary-btn" onClick={handleExport} disabled={browser.messageCount === 0}>Export</button>
                  <button className="kafka-ms-ghost-btn" onClick={browser.clearResult}>Clear</button>
                </>
              )}
            </div>

            {browser.error && (
              <div className="kafka-ms-inline-error">{browser.error.message}</div>
            )}

            {browser.result !== null && !browser.error && (
              <div className="kafka-ms-results-zone" data-testid="detail-results">
                <div className="kafka-ms-results-header">
                  <span className="kafka-ms-results-count">
                    {browser.messageCount} message{browser.messageCount !== 1 ? 's' : ''}
                  </span>
                  {browser.timedOut && <span className="kafka-ms-timed-out-badge">timed out</span>}
                </div>
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
              <div className="kafka-ms-detail-pane" data-testid="detail-msg-pane">
                <div className="kafka-ms-detail-actions">
                  <button className="kafka-ms-ghost-btn" onClick={() => handleCopyKey(browser.selectedMessage!)} disabled={!browser.selectedMessage.key}>Copy Key</button>
                  <button className="kafka-ms-ghost-btn" onClick={() => handleCopyPayload(browser.selectedMessage!)}>Copy Value</button>
                  <button className="kafka-ms-ghost-btn" onClick={() => browser.selectMessage(null)} aria-label="Close detail">✕</button>
                </div>
                <pre className="kafka-ms-detail-body">
                  {(() => { try { return JSON.stringify(JSON.parse(browser.selectedMessage.value), null, 2); } catch { return browser.selectedMessage.value; } })()}
                </pre>
                {browser.selectedMessage.headers && Object.keys(browser.selectedMessage.headers).length > 0 && (
                  <table className="kafka-ms-detail-headers">
                    <thead><tr><th>Header Key</th><th>Header Value</th></tr></thead>
                    <tbody>
                      {Object.entries(browser.selectedMessage.headers).map(([k, v]) => (
                        <tr key={k}><td>{k}</td><td>{v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeKafkaClusterConfig } from '../../shared/kafka/kafkaConfig';
import { saveJsonFile } from '../../shared/utils/fileSaver';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import {
  clusterIdFromName,
  defaultClusterDraft,
  draftFromCluster,
  hasDraftErrors,
  type KafkaClusterDraft,
  type KafkaClusterDraftErrors,
  validateKafkaClusterDraft,
} from './kafkaClusterForm';
import KafkaDiagnosticBanner from './KafkaDiagnosticBanner';
import {
  buildTlsConfig,
  formatBrokers,
  formatSecurityProfile,
  getClusterStatus,
  toDiagnosticBannerData,
  parseOptionalTimeoutMs,
} from './kafkaSettingsUtils';

const EMPTY_ERRORS: KafkaClusterDraftErrors = {};

interface KafkaSettingsPageProps {
  kafkaState: UseKafkaStateReturn;
}

export default function KafkaSettingsPage({ kafkaState }: KafkaSettingsPageProps) {
  const {
    loaded,
    clusters,
    selectedClusterId,
    selectedCluster,
    connection,
    lastError,
    lastErrorDetail,
    autoConnectOnStartup,
    setAutoConnectOnStartup,
    topics,
    topicsLoading,
    topicsError,
    includeInternalTopics,
    setIncludeInternalTopics,
    setSelectedClusterId,
    upsertCluster,
    removeCluster,
    clearError,
    connectSelectedCluster,
    disconnectActiveCluster,
    refreshConnectionStatus,
    refreshTopics,
    testSelectedClusterConnection,
  } = kafkaState;
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
  const [isCreateClusterIdCustomized, setIsCreateClusterIdCustomized] = useState(false);
  const [draft, setDraft] = useState<KafkaClusterDraft>(() => defaultClusterDraft());
  const [draftErrors, setDraftErrors] = useState<KafkaClusterDraftErrors>(EMPTY_ERRORS);
  const [pendingDeleteClusterId, setPendingDeleteClusterId] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState('');
  const [topicDomainFilter, setTopicDomainFilter] = useState('all');
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const resetTopicFilter = () => setTopicFilter('');

  const handleExport = async () => {
    const date = new Date().toISOString().slice(0, 10);
    await saveJsonFile(
      { version: 1, exportedAt: Date.now(), clusters },
      `kafka-clusters-${date}.json`,
    );
  };

  const handleImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(reader.result as string);
        const rawClusters: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as Record<string, unknown>)?.clusters)
            ? ((parsed as Record<string, unknown>).clusters as unknown[])
            : [];
        let imported = 0;
        let skipped = 0;
        for (const raw of rawClusters) {
          const cluster = normalizeKafkaClusterConfig(raw);
          if (cluster) {
            upsertCluster(cluster);
            imported++;
          } else {
            skipped++;
          }
        }
        const msg =
          `Imported ${imported} cluster${imported !== 1 ? 's' : ''}` +
          (skipped > 0 ? `, ${skipped} skipped (invalid)` : '') + '.';
        setImportFeedback({ type: 'success', message: msg });
      } catch {
        setImportFeedback({ type: 'error', message: 'Import failed: invalid JSON file.' });
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.onerror = () => {
      setImportFeedback({ type: 'error', message: 'Import failed: could not read file.' });
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    setTopicFilter('');
    setTopicDomainFilter('all');
  }, [selectedClusterId]);

  const connectionSummary = useMemo(() => {
    if (!loaded) {
      return 'Loading Kafka workspace state...';
    }

    if (connection.state === 'connected') {
      return `Connected${connection.clusterId ? ` to ${connection.clusterId}` : ''}`;
    }

    if (connection.state === 'testing') {
      return 'Testing connection...';
    }

    if (connection.state === 'error') {
      return connection.lastError ?? 'Connection check failed';
    }

    return 'Disconnected';
  }, [loaded, connection]);

  const selectCluster = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    resetTopicFilter();
  };

  const selectedClusterSecuritySummary = useMemo(
    () => (selectedCluster ? formatSecurityProfile(selectedCluster) : null),
    [selectedCluster],
  );
  const hasStartupError = loaded && clusters.length === 0 && !!lastError && !lastErrorDetail;
  const canBrowseTopics = loaded
    && !!selectedClusterId
    && connection.state === 'connected'
    && connection.clusterId === selectedClusterId;
  const filteredTopics = useMemo(() => {
    const normalizedFilter = topicFilter.trim().toLowerCase();
    const byDomain = topicDomainFilter === 'all'
      ? topics
      : topics.filter((topic) => topic.name.toLowerCase().startsWith(`${topicDomainFilter.toLowerCase()}.`));
    if (!normalizedFilter) {
      return byDomain;
    }
    return byDomain.filter((topic) => topic.name.toLowerCase().includes(normalizedFilter));
  }, [topicFilter, topicDomainFilter, topics]);

  const topicDomainChips = useMemo(() => {
    const domains = new Set<string>();
    for (const topic of topics) {
      const [firstSegment] = topic.name.split('.', 1);
      if (firstSegment && firstSegment !== '__consumer_offsets') {
        domains.add(firstSegment);
      }
      if (domains.size >= 6) {
        break;
      }
    }
    return ['all', ...domains];
  }, [topics]);

  const canRunConnectionAction = loaded && !!selectedClusterId && editorMode == null;
  const canDisconnect = loaded && connection.state !== 'disconnected' && connection.state !== 'testing';

  const startCreate = () => {
    const created = defaultClusterDraft();
    setDraft(created);
    setEditorMode('create');
    setEditingClusterId(null);
    setIsCreateClusterIdCustomized(false);
    setPendingDeleteClusterId(null);
    setDraftErrors(EMPTY_ERRORS);
  };

  const startEdit = (clusterId: string) => {
    const cluster = clusters.find((item) => item.clusterId === clusterId);
    if (!cluster) {
      return;
    }
    setDraft(draftFromCluster(cluster));
    setEditorMode('edit');
    setEditingClusterId(clusterId);
    setIsCreateClusterIdCustomized(false);
    setPendingDeleteClusterId(null);
    setDraftErrors(EMPTY_ERRORS);
    selectCluster(clusterId);
  };

  const cancelEditor = () => {
    setEditorMode(null);
    setEditingClusterId(null);
    setIsCreateClusterIdCustomized(false);
    setPendingDeleteClusterId(null);
    setDraftErrors(EMPTY_ERRORS);
  };

  const saveDraft = () => {
    const errors = validateKafkaClusterDraft(draft, clusters, editorMode === 'edit' ? editingClusterId : null);
    setDraftErrors(errors);
    if (hasDraftErrors(errors)) {
      return;
    }

    const existing = editorMode === 'edit'
      ? clusters.find((cluster) => cluster.clusterId === editingClusterId)
      : undefined;
    const nextClusterId = draft.clusterId.trim();
    const now = Date.now();
    const cleanedBrokers = [...new Set(draft.brokers.map((broker) => broker.trim()).filter(Boolean))];

    if (editorMode === 'edit' && editingClusterId && editingClusterId !== nextClusterId) {
      removeCluster(editingClusterId);
    }

    upsertCluster({
      clusterId: nextClusterId,
      name: draft.name.trim(),
      clientId: draft.clientId.trim(),
      brokers: cleanedBrokers,
      connectionTimeoutMs: parseOptionalTimeoutMs(draft.connectionTimeoutMs),
      requestTimeoutMs: parseOptionalTimeoutMs(draft.requestTimeoutMs),
      auth: draft.authMode === 'none'
        ? { mode: 'none' }
        : {
            mode: draft.authMode,
            username: draft.authUsername.trim(),
            password: draft.authPassword.trim(),
          },
      tls: buildTlsConfig(draft),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    selectCluster(nextClusterId);
    setEditorMode(null);
    setEditingClusterId(null);
    setIsCreateClusterIdCustomized(false);
    setPendingDeleteClusterId(null);
    setDraftErrors(EMPTY_ERRORS);
  };

  const updateDraft = (updates: Partial<KafkaClusterDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setDraftErrors(EMPTY_ERRORS);
  };

  const updateBroker = (idx: number, value: string) => {
    setDraft((prev) => {
      const brokers = [...prev.brokers];
      brokers[idx] = value;
      return { ...prev, brokers };
    });
    setDraftErrors(EMPTY_ERRORS);
  };

  const addBrokerRow = () => {
    setDraft((prev) => ({ ...prev, brokers: [...prev.brokers, ''] }));
    setDraftErrors(EMPTY_ERRORS);
  };

  const removeBrokerRow = (idx: number) => {
    setDraft((prev) => {
      const brokers = prev.brokers.filter((_, itemIdx) => itemIdx !== idx);
      return { ...prev, brokers };
    });
    setDraftErrors(EMPTY_ERRORS);
  };

  const confirmDelete = () => {
    if (!editingClusterId) {
      return;
    }
    removeCluster(editingClusterId);
    setPendingDeleteClusterId(null);
    setEditorMode(null);
    setEditingClusterId(null);
    setIsCreateClusterIdCustomized(false);
    setDraftErrors(EMPTY_ERRORS);
  };

  return (
    <div className="settings-page kafka-settings-page" data-testid="kafka-settings-page">
      <div className="settings-page-header">
        <h2>Kafka Cluster Studio</h2>
        <p className="settings-section-desc">
          Configure broker profiles, manage connections, and browse live topics from one place.
        </p>
      </div>

      <div className="kafka-settings-content">
        {/* ── Studio grid: cluster panel (left) + editor panel (right) ── */}
        <div className="kafka-studio-grid">

          {/* ── LEFT: Cluster panel ── */}
          <section className="kafka-shell-card kafka-cluster-panel" aria-live="polite">
            <div className="kafka-shell-card-header">
              <div className="kafka-shell-card-title-row">
                <h3>Clusters</h3>
                <span className={`kafka-status-badge state-${connection.state}`}>{connection.state}</span>
              </div>
              <small className="kafka-section-subtitle">Saved profiles · fast switch · live health</small>
            </div>

            {loaded && (
              <div className="kafka-cluster-toolbar" data-testid="kafka-cluster-toolbar">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void handleExport()}
                  disabled={clusters.length === 0}
                  title="Export all cluster configs to a JSON file"
                  data-testid="kafka-export-btn"
                >
                  ↓ Export
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => importInputRef.current?.click()}
                  title="Import cluster configs from a JSON file"
                  data-testid="kafka-import-btn"
                >
                  ↑ Import
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportChange}
                  aria-hidden="true"
                />
                {clusters.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={startCreate}
                    data-testid="kafka-add-cluster-btn"
                  >
                    + New
                  </button>
                )}
              </div>
            )}

            {/* Import feedback */}
            {importFeedback && (
              <div
                className={`kafka-import-feedback kafka-import-feedback--${importFeedback.type}`}
                data-testid="kafka-import-feedback"
              >
                <span>{importFeedback.message}</span>
                <button
                  type="button"
                  className="kafka-import-feedback-dismiss"
                  onClick={() => setImportFeedback(null)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            {/* Loading */}
            {!loaded && (
              <p className="settings-section-desc kafka-panel-state" data-testid="kafka-settings-loading">
                Reading saved Kafka clusters and connection status.
              </p>
            )}

            {/* Startup error */}
            {hasStartupError && (
              <div className="kafka-shell-error kafka-panel-state" data-testid="kafka-settings-error">
                <strong>Unable to load Kafka settings</strong>
                <p>{lastError}</p>
              </div>
            )}

            {/* Empty state */}
            {loaded && clusters.length === 0 && !hasStartupError && (
              <div className="kafka-panel-state kafka-empty-state" data-testid="kafka-settings-empty">
                <p className="kafka-empty-title">No clusters configured yet</p>
                <p className="settings-section-desc">Add your first Kafka cluster to enable topic browsing and workflow integration.</p>
                <div className="kafka-shell-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={startCreate}
                    data-testid="kafka-empty-create-btn"
                  >
                    Create First Cluster
                  </button>
                </div>
              </div>
            )}

            {/* Cluster list */}
            {loaded && clusters.length > 0 && (
              <div className="kafka-cluster-shell-list" data-testid="kafka-settings-list">
                {clusters.map((cluster) => {
                  const isSelected = cluster.clusterId === selectedClusterId;
                  const clusterStatus = getClusterStatus(
                    cluster.clusterId,
                    selectedClusterId,
                    connection.state,
                    connection.clusterId,
                  );
                  return (
                    <div
                      key={cluster.clusterId}
                      className={`kafka-cluster-card ${isSelected ? 'selected' : ''}`}
                      data-testid={`kafka-cluster-card-${cluster.clusterId}`}
                    >
                      <button
                        type="button"
                        className="kafka-cluster-shell-row"
                        onClick={() => selectCluster(cluster.clusterId)}
                      >
                        <span className="kafka-cluster-shell-head">
                          <span className="kafka-cluster-shell-name">{cluster.name}</span>
                          <span className={`kafka-cluster-item-status kind-${clusterStatus.kind}`}>{clusterStatus.label}</span>
                        </span>
                        <span className="kafka-cluster-shell-meta">{formatBrokers(cluster.brokers)}</span>
                        <span className="kafka-cluster-shell-security-line">{formatSecurityProfile(cluster)}</span>
                      </button>
                      <div className="kafka-cluster-card-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => startEdit(cluster.clusterId)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected cluster hint */}
            {selectedCluster && (
              <div className="kafka-selected-cluster-hint" data-testid="kafka-selected-cluster-security">
                <span>Selected: <strong>{selectedCluster.name}</strong></span>
                <span className="kafka-inline-separator">•</span>
                <span>{selectedClusterSecuritySummary}</span>
              </div>
            )}

            {/* Diagnostic banner */}
            {lastErrorDetail && (
              <KafkaDiagnosticBanner
                detail={toDiagnosticBannerData(lastErrorDetail)}
                testId="kafka-diagnostic-banner"
              />
            )}

            {/* Connection controls — only shown when clusters exist */}
            {loaded && clusters.length > 0 && (
              <>
                <p className="kafka-shell-summary">{connectionSummary}</p>

                <div className="kafka-shell-actions">
                  <button
                    type="button"
                    className="btn btn-sm kafka-btn-soft-blue"
                    onClick={() => void testSelectedClusterConnection()}
                    disabled={!canRunConnectionAction || connection.state === 'testing'}
                  >
                    Test Connection
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void connectSelectedCluster()}
                    disabled={!canRunConnectionAction || connection.state === 'testing' || (connection.state === 'connected' && connection.clusterId === selectedClusterId)}
                  >
                    Connect
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void disconnectActiveCluster()}
                    disabled={!canDisconnect}
                  >
                    Disconnect
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void refreshConnectionStatus({ force: true })}
                    disabled={!loaded || !selectedClusterId}
                  >
                    Refresh Status
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={clearError}
                    disabled={!lastError}
                  >
                    Clear Error
                  </button>
                </div>

                <div className="kafka-shell-preferences">
                  <label className="kafka-editor-checkbox" data-testid="kafka-auto-connect-toggle">
                    <input
                      type="checkbox"
                      checked={autoConnectOnStartup}
                      onChange={(event) => setAutoConnectOnStartup(event.target.checked)}
                    />
                    Auto-connect the selected cluster on startup
                  </label>
                  <span className="kafka-shell-preferences-note">
                    Restores the saved cluster selection and attempts a connection once when Kafka settings load.
                  </span>
                </div>
              </>
            )}
          </section>

          {/* ── RIGHT: Editor panel ── */}
          <section className="kafka-shell-card kafka-editor-panel" data-testid={loaded ? 'kafka-cluster-editor' : undefined}>
            {!loaded ? (
              <p className="settings-section-desc">Loading cluster configuration...</p>
            ) : (
              <>
                <div className="kafka-shell-card-header kafka-editor-header">
                  <div>
                    <h3>{editorMode === 'edit' ? 'Edit Cluster' : 'Create Cluster'}</h3>
                    {editorMode && (
                      <small className="kafka-section-subtitle">
                        {editorMode === 'edit'
                          ? 'Update connection settings, auth, and TLS'
                          : 'Configure a new Kafka connection profile'}
                      </small>
                    )}
                  </div>
                  {editorMode && (
                    <button type="button" className="btn btn-sm" onClick={cancelEditor}>
                      Cancel
                    </button>
                  )}
                </div>

                {!editorMode && (
                  <p className="settings-section-desc kafka-editor-placeholder">
                    Select a saved cluster and click Edit, or click New Cluster to start configuring one.
                  </p>
                )}

                {editorMode && (
                  <div className="kafka-editor-grid">
                    <div className="kafka-editor-field">
                      <label htmlFor="kafka-cluster-name">Cluster Name</label>
                      <input
                        id="kafka-cluster-name"
                        value={draft.name}
                        onChange={(event) => {
                          const nextName = event.target.value;
                          const nextId = clusterIdFromName(nextName);
                          updateDraft({
                            name: nextName,
                            clusterId: editorMode === 'create' && !isCreateClusterIdCustomized ? (nextId || draft.clusterId) : draft.clusterId,
                          });
                        }}
                        placeholder="Local Dev Kafka"
                      />
                      {draftErrors.name && <div className="kafka-editor-error">{draftErrors.name}</div>}
                    </div>

                    <div className="kafka-editor-field">
                      <label htmlFor="kafka-cluster-id">Cluster ID</label>
                      <input
                        id="kafka-cluster-id"
                        value={draft.clusterId}
                        onChange={(event) => {
                          if (editorMode === 'create') setIsCreateClusterIdCustomized(true);
                          updateDraft({ clusterId: event.target.value.trim() });
                        }}
                        placeholder="local-dev-kafka"
                      />
                      {draftErrors.clusterId && <div className="kafka-editor-error">{draftErrors.clusterId}</div>}
                    </div>

                    <div className="kafka-editor-field kafka-editor-field-full">
                      <label htmlFor="kafka-client-id">Client ID</label>
                      <input
                        id="kafka-client-id"
                        value={draft.clientId}
                        onChange={(event) => updateDraft({ clientId: event.target.value })}
                        placeholder="redfireforge-local"
                      />
                      {draftErrors.clientId && <div className="kafka-editor-error">{draftErrors.clientId}</div>}
                    </div>

                    <div className="kafka-editor-field">
                      <label htmlFor="kafka-connection-timeout">Connection Timeout (ms)</label>
                      <input
                        id="kafka-connection-timeout"
                        inputMode="numeric"
                        value={draft.connectionTimeoutMs}
                        onChange={(event) => updateDraft({ connectionTimeoutMs: event.target.value })}
                        placeholder="10000"
                      />
                      {draftErrors.connectionTimeoutMs && <div className="kafka-editor-error">{draftErrors.connectionTimeoutMs}</div>}
                    </div>

                    <div className="kafka-editor-field">
                      <label htmlFor="kafka-request-timeout">Request Timeout (ms)</label>
                      <input
                        id="kafka-request-timeout"
                        inputMode="numeric"
                        value={draft.requestTimeoutMs}
                        onChange={(event) => updateDraft({ requestTimeoutMs: event.target.value })}
                        placeholder="10000"
                      />
                      {draftErrors.requestTimeoutMs && <div className="kafka-editor-error">{draftErrors.requestTimeoutMs}</div>}
                    </div>

                    {/* Bootstrap Brokers subcard */}
                    <div className="kafka-editor-field kafka-editor-field-full">
                      <div className="kafka-subcard">
                        <div className="kafka-subcard-header">
                          <span className="kafka-subcard-title">Bootstrap Brokers</span>
                          <button type="button" className="btn btn-sm" onClick={addBrokerRow}>
                            Add Broker
                          </button>
                        </div>
                        <div className="kafka-editor-brokers-list">
                          {draft.brokers.map((broker, idx) => (
                            <div className="kafka-editor-broker-row" key={idx}>
                              <input
                                aria-label={`Broker ${idx + 1}`}
                                value={broker}
                                onChange={(event) => updateBroker(idx, event.target.value)}
                                placeholder="127.0.0.1:19092"
                              />
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => removeBrokerRow(idx)}
                                disabled={draft.brokers.length <= 1}
                              >
                                Remove
                              </button>
                              {draftErrors.brokerRows?.[idx] && <div className="kafka-editor-error">{draftErrors.brokerRows[idx]}</div>}
                            </div>
                          ))}
                        </div>
                        {draftErrors.brokers && <div className="kafka-editor-error">{draftErrors.brokers}</div>}
                      </div>
                    </div>

                    {/* Authentication subcard */}
                    <div className="kafka-editor-field kafka-editor-field-full">
                      <div className="kafka-subcard">
                        <div className="kafka-subcard-header">
                          <span className="kafka-subcard-title">Authentication</span>
                          <span className="kafka-editor-section-note">PLAINTEXT, SASL/PLAIN, and SCRAM supported.</span>
                        </div>
                        <div className="kafka-editor-field">
                          <label htmlFor="kafka-auth-mode">Authentication</label>
                          <select
                            id="kafka-auth-mode"
                            value={draft.authMode}
                            onChange={(event) => updateDraft({ authMode: event.target.value as KafkaClusterDraft['authMode'] })}
                          >
                            <option value="none">No authentication</option>
                            <option value="plain">SASL / PLAIN</option>
                            <option value="scram-sha-256">SCRAM-SHA-256</option>
                            <option value="scram-sha-512">SCRAM-SHA-512</option>
                          </select>
                        </div>
                        {draft.authMode !== 'none' && (
                          <div className="kafka-subcard-fields">
                            <div className="kafka-editor-field">
                              <label htmlFor="kafka-auth-username">Username</label>
                              <input
                                id="kafka-auth-username"
                                value={draft.authUsername}
                                onChange={(event) => updateDraft({ authUsername: event.target.value })}
                                placeholder="kafka-user"
                              />
                              {draftErrors.authUsername && <div className="kafka-editor-error">{draftErrors.authUsername}</div>}
                            </div>
                            <div className="kafka-editor-field">
                              <label htmlFor="kafka-auth-password">Password</label>
                              <input
                                id="kafka-auth-password"
                                type="password"
                                value={draft.authPassword}
                                onChange={(event) => updateDraft({ authPassword: event.target.value })}
                                placeholder="Enter broker password"
                              />
                              {draftErrors.authPassword && <div className="kafka-editor-error">{draftErrors.authPassword}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TLS subcard */}
                    <div className="kafka-editor-field kafka-editor-field-full">
                      <div className="kafka-subcard">
                        <div className="kafka-subcard-header">
                          <span className="kafka-subcard-title">TLS / SSL</span>
                          <span className="kafka-editor-section-note">Enable for secure broker connections.</span>
                        </div>
                        <div className="kafka-editor-toggle-row">
                          <label className="kafka-editor-checkbox">
                            <input
                              type="checkbox"
                              checked={draft.tlsEnabled}
                              onChange={(event) => updateDraft({ tlsEnabled: event.target.checked })}
                            />
                            Enable TLS
                          </label>
                          <label className="kafka-editor-checkbox">
                            <input
                              type="checkbox"
                              checked={draft.tlsRejectUnauthorized}
                              onChange={(event) => updateDraft({ tlsRejectUnauthorized: event.target.checked })}
                              disabled={!draft.tlsEnabled}
                            />
                            Verify server certificate
                          </label>
                        </div>
                        {draft.tlsEnabled && (
                          <div className="kafka-subcard-fields">
                            <div className="kafka-editor-field kafka-editor-field-full">
                              <label htmlFor="kafka-tls-server-name">TLS Server Name</label>
                              <input
                                id="kafka-tls-server-name"
                                value={draft.tlsServerName}
                                onChange={(event) => updateDraft({ tlsServerName: event.target.value })}
                                placeholder="kafka.local"
                              />
                            </div>
                            <div className="kafka-editor-field kafka-editor-field-full">
                              <label htmlFor="kafka-tls-ca">CA PEM</label>
                              <textarea
                                id="kafka-tls-ca"
                                value={draft.tlsCaPem}
                                onChange={(event) => updateDraft({ tlsCaPem: event.target.value })}
                                placeholder="-----BEGIN CERTIFICATE-----"
                                rows={4}
                              />
                            </div>
                            <div className="kafka-editor-field kafka-editor-field-full">
                              <label htmlFor="kafka-tls-cert">Client Certificate PEM</label>
                              <textarea
                                id="kafka-tls-cert"
                                value={draft.tlsCertPem}
                                onChange={(event) => updateDraft({ tlsCertPem: event.target.value })}
                                placeholder="-----BEGIN CERTIFICATE-----"
                                rows={4}
                              />
                              {draftErrors.tlsCertPem && <div className="kafka-editor-error">{draftErrors.tlsCertPem}</div>}
                            </div>
                            <div className="kafka-editor-field kafka-editor-field-full">
                              <label htmlFor="kafka-tls-key">Client Private Key PEM</label>
                              <textarea
                                id="kafka-tls-key"
                                value={draft.tlsKeyPem}
                                onChange={(event) => updateDraft({ tlsKeyPem: event.target.value })}
                                placeholder="-----BEGIN PRIVATE KEY-----"
                                rows={4}
                              />
                              {draftErrors.tlsKeyPem && <div className="kafka-editor-error">{draftErrors.tlsKeyPem}</div>}
                            </div>
                            <div className="kafka-editor-field kafka-editor-field-full">
                              <label htmlFor="kafka-tls-passphrase">Key Passphrase</label>
                              <input
                                id="kafka-tls-passphrase"
                                type="password"
                                value={draft.tlsPassphrase}
                                onChange={(event) => updateDraft({ tlsPassphrase: event.target.value })}
                                placeholder="Optional key passphrase"
                              />
                              {draftErrors.tlsPassphrase && <div className="kafka-editor-error">{draftErrors.tlsPassphrase}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="kafka-editor-footer">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={saveDraft}
                        data-testid="kafka-save-cluster-btn"
                      >
                        Save Cluster
                      </button>
                      {editorMode === 'edit' && (
                        <>
                          {!pendingDeleteClusterId && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => setPendingDeleteClusterId(editingClusterId)}
                            >
                              Delete Cluster
                            </button>
                          )}
                          {pendingDeleteClusterId && (
                            <div className="kafka-delete-confirm" data-testid="kafka-delete-confirm">
                              <span>Delete this cluster?</span>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={confirmDelete}
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => setPendingDeleteClusterId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* ── Topic Explorer ── */}
        <section className="kafka-shell-card" data-testid="kafka-topic-browser">
          <div className="kafka-shell-card-header">
            <div>
              <h3>Topic Explorer</h3>
              <div className="kafka-topic-context-row" aria-hidden="true">
                <span className="kafka-topic-context-chip">Kafka / Topics</span>
                <span className="kafka-topic-context-chip">
                  Cluster: {selectedCluster?.name ?? selectedClusterId ?? 'Not selected'}
                </span>
              </div>
            </div>
            <div className="kafka-topic-browser-actions">
              <label className="kafka-editor-checkbox">
                <input
                  type="checkbox"
                  checked={includeInternalTopics}
                  onChange={(event) => setIncludeInternalTopics(event.target.checked)}
                  disabled={!canBrowseTopics && topics.length === 0}
                />
                Include internal topics
              </label>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void refreshTopics()}
                disabled={!canBrowseTopics || topicsLoading}
              >
                Refresh Topics
              </button>
            </div>
          </div>

          <div className="kafka-topic-browser-filter-row">
            <input
              aria-label="Search Topics"
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              placeholder="Search topics, prefixes, domains, tags"
              disabled={!canBrowseTopics || topicsLoading}
            />
          </div>

          {canBrowseTopics && !topicsLoading && topics.length > 0 && (
            <div className="kafka-topic-chipbar" data-testid="kafka-topic-chipbar">
              {topicDomainChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={`kafka-topic-chip ${topicDomainFilter === chip ? 'active' : ''}`}
                  onClick={() => setTopicDomainFilter(chip)}
                >
                  {chip === 'all' ? 'All Topics' : chip}
                </button>
              ))}
            </div>
          )}

          {!selectedClusterId && (
            <p className="settings-section-desc kafka-topic-browser-state" data-testid="kafka-topics-idle">
              Select a saved cluster to browse topics.
            </p>
          )}

          {selectedClusterId && !canBrowseTopics && (
            <p className="settings-section-desc kafka-topic-browser-state" data-testid="kafka-topics-disconnected">
              Connect the selected cluster to browse topics and verify startup restoration behavior.
            </p>
          )}

          {canBrowseTopics && topicsLoading && (
            <p className="settings-section-desc kafka-topic-browser-state" data-testid="kafka-topics-loading">
              Loading topics from {selectedCluster?.name ?? selectedClusterId}...
            </p>
          )}

          {canBrowseTopics && topicsError && !topicsLoading && (
            <KafkaDiagnosticBanner
              detail={toDiagnosticBannerData(topicsError)}
              testId="kafka-topics-error"
            />
          )}

          {canBrowseTopics && !topicsLoading && !topicsError && (
            <>
              <div className="kafka-topic-browser-summary" data-testid="kafka-topic-summary">
                <span>{filteredTopics.length} of {topics.length} topic{topics.length === 1 ? '' : 's'} shown</span>
                <span>{includeInternalTopics ? 'Including internal topics' : 'Internal topics hidden'}</span>
              </div>

              {filteredTopics.length === 0 ? (
                <p className="settings-section-desc kafka-topic-browser-state" data-testid="kafka-topics-empty">
                  {topics.length === 0
                    ? 'No topics were returned for this cluster.'
                    : 'No topics match the current filter.'}
                </p>
              ) : (
                <table className="kafka-topic-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Partitions</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTopics.map((topic) => (
                      <tr key={topic.name} data-testid={`kafka-topic-${topic.name}`}>
                        <td>
                          <div className="kafka-topic-row-main">
                            <strong>{topic.name}</strong>
                            <span className="kafka-topic-row-meta">{topic.isInternal ? 'Broker-managed' : 'Application topic'}</span>
                          </div>
                        </td>
                        <td><span className="count-badge">{topic.partitions}</span></td>
                        <td><span className="kafka-topic-kind-badge">{topic.isInternal ? 'Internal' : 'App'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}


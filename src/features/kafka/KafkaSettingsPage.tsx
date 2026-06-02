import { useEffect, useMemo, useState } from 'react';
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
  const resetTopicFilter = () => setTopicFilter('');

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
        <h2>Kafka Settings</h2>
      </div>

      <div className="settings-content kafka-settings-content">
        <section className="kafka-shell-card" aria-live="polite">
          <div className="kafka-shell-card-header">
            <div>
              <h3>Kafka Cluster Studio</h3>
              <p className="settings-section-desc">
                Secure Kafka profile setup and live topic browsing are active. Configure startup restore behavior here and inspect broker topics from the selected cluster.
              </p>
            </div>
            <span className={`kafka-status-badge state-${connection.state}`}>
              {connection.state}
            </span>
          </div>
          <div className="kafka-studio-hero">
            <div className="kafka-studio-hero-copy">
              <h4>Connection-first Kafka workflow for developers and testers</h4>
              <p>
                Keep cluster configuration, diagnostics, startup behavior, and topic exploration in one place so profile edits and broker feedback stay tightly connected.
              </p>
            </div>
            <div className="kafka-studio-hero-note" data-testid="kafka-studio-hero-note">
              <strong>Design intent</strong>
              Mirror the Cluster Studio and Topic Explorer mockups while preserving existing RedfireForge settings patterns.
            </div>
          </div>
          <p className="kafka-shell-summary">{connectionSummary}</p>

          {selectedCluster && (
            <div className="kafka-selected-cluster-hint" data-testid="kafka-selected-cluster-security">
              Selected: <strong>{selectedCluster.name}</strong> <span className="kafka-inline-separator">•</span> {selectedClusterSecuritySummary}
            </div>
          )}

          {lastErrorDetail && (
            <KafkaDiagnosticBanner
              detail={toDiagnosticBannerData(lastErrorDetail)}
              testId="kafka-diagnostic-banner"
            />
          )}

          <div className="kafka-shell-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
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
        </section>

        <section className="kafka-shell-card" data-testid="kafka-topic-browser">
          <div className="kafka-shell-card-header">
            <div>
              <h3>Kafka Topic Explorer</h3>
              <p className="settings-section-desc">
                Browse live broker topics for the selected cluster, filter by name, and verify startup restoration against real metadata.
              </p>
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
                <div className="kafka-topic-browser-list">
                  <div className="kafka-topic-browser-list-head" aria-hidden="true">
                    <span>Topic</span>
                    <span>Type</span>
                    <span>Partitions</span>
                  </div>
                  {filteredTopics.map((topic) => (
                    <div className="kafka-topic-row" key={topic.name} data-testid={`kafka-topic-${topic.name}`}>
                      <div className="kafka-topic-row-main">
                        <strong>{topic.name}</strong>
                        <span className="kafka-topic-row-meta">{topic.isInternal ? 'Broker-managed' : 'Application'}</span>
                      </div>
                      <span className="kafka-topic-kind-badge">{topic.isInternal ? 'Internal' : 'App'}</span>
                      <span className="count-badge">{topic.partitions} partition{topic.partitions === 1 ? '' : 's'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {!loaded && (
          <section className="kafka-shell-card">
            <h3>Loading</h3>
            <p className="settings-section-desc" data-testid="kafka-settings-loading">
              Reading saved Kafka clusters and connection status.
            </p>
          </section>
        )}

        {hasStartupError && (
          <section className="kafka-shell-card kafka-shell-error" data-testid="kafka-settings-error">
            <h3>Unable to load Kafka settings</h3>
            <p>{lastError}</p>
          </section>
        )}

        {loaded && clusters.length === 0 && !hasStartupError && (
          <section className="kafka-shell-card" data-testid="kafka-settings-empty">
            <h3>No clusters configured yet</h3>
            <p className="settings-section-desc">
              Add and configure your first Kafka cluster, including auth, TLS, and timeout settings.
            </p>
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
          </section>
        )}

        {loaded && clusters.length > 0 && (
          <section className="kafka-shell-card" data-testid="kafka-settings-list">
            <div className="kafka-shell-card-header">
              <h3>Saved Clusters</h3>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={startCreate}
                data-testid="kafka-add-cluster-btn"
              >
                New Cluster
              </button>
            </div>
            <div className="kafka-cluster-shell-list">
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
                      <span className="kafka-cluster-shell-id">{cluster.clusterId}</span>
                    </button>
                    <div className="kafka-cluster-shell-security" aria-hidden="true">
                      {formatSecurityProfile(cluster)}
                    </div>
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

            {selectedCluster && (
              <div className="kafka-selected-cluster-hint">
                Selected: <strong>{selectedCluster.name}</strong>
              </div>
            )}
          </section>
        )}

        {loaded && (
          <section className="kafka-shell-card" data-testid="kafka-cluster-editor">
            <div className="kafka-shell-card-header">
              <h3>{editorMode === 'edit' ? 'Edit Cluster' : 'Create Cluster'}</h3>
              {editorMode && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={cancelEditor}
                >
                  Cancel
                </button>
              )}
            </div>

            {!editorMode && (
              <p className="settings-section-desc">Select a saved cluster and click Edit, or click New Cluster to start configuring one.</p>
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
                      if (editorMode === 'create') {
                        setIsCreateClusterIdCustomized(true);
                      }
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

                <div className="kafka-editor-field kafka-editor-field-full">
                  <div className="kafka-editor-section-header">
                    <label htmlFor="kafka-auth-mode">Authentication</label>
                    <span className="kafka-editor-section-note">Plaintext, SASL/PLAIN, and SCRAM profiles are supported in this phase.</span>
                  </div>
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
                  <>
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
                  </>
                )}

                <div className="kafka-editor-field kafka-editor-field-full">
                  <div className="kafka-editor-section-header">
                    <label>TLS</label>
                    <span className="kafka-editor-section-note">Enable CA/cert/key fields for secure local Docker or broker-managed certificates.</span>
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
                </div>

                {draft.tlsEnabled && (
                  <>
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
                  </>
                )}

                <div className="kafka-editor-field kafka-editor-field-full">
                  <div className="kafka-editor-brokers-header">
                    <label>Bootstrap Brokers</label>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={addBrokerRow}
                    >
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
          </section>
        )}
      </div>
    </div>
  );
}

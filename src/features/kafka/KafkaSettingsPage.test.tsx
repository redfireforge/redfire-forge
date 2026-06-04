/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import type { RenderResult } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import KafkaSettingsPage from './KafkaSettingsPage';

type KafkaState = UseKafkaStateReturn;

function makeState(overrides: Partial<KafkaState> = {}): KafkaState {
  return {
    loaded: true,
    clusters: [],
    selectedClusterId: null,
    selectedCluster: null,
    connection: { state: 'disconnected' },
    lastError: null,
    lastErrorDetail: null,
    statusPollFailureStreak: 0,
    autoConnectOnStartup: false,
    setAutoConnectOnStartup: vi.fn(),
    topics: [],
    topicsLoading: false,
    topicsError: null,
    includeInternalTopics: false,
    setIncludeInternalTopics: vi.fn(),
    setSelectedClusterId: vi.fn(),
    upsertCluster: vi.fn(),
    removeCluster: vi.fn(),
    replaceClusters: vi.fn(),
    connectSelectedCluster: vi.fn(),
    disconnectActiveCluster: vi.fn(),
    testSelectedClusterConnection: vi.fn(),
    refreshConnectionStatus: vi.fn().mockResolvedValue(undefined),
    refreshTopics: vi.fn().mockResolvedValue(undefined),
    setConnectionState: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  } as KafkaState;
}

const CLUSTER_A = {
  clusterId: 'cluster-a',
  name: 'Cluster A',
  clientId: 'redfireforge-a',
  brokers: ['127.0.0.1:19092'],
  auth: { mode: 'none' as const },
  tls: { enabled: false, rejectUnauthorized: true },
  createdAt: 1,
  updatedAt: 1,
};

const CLUSTER_B = {
  ...CLUSTER_A,
  clusterId: 'cluster-b',
  name: 'Cluster B',
  clientId: 'redfireforge-b',
  brokers: ['127.0.0.1:19093'],
};

const SECURE_CLUSTER = {
  ...CLUSTER_A,
  clusterId: 'secure-cluster',
  name: 'Secure Cluster',
  auth: { mode: 'scram-sha-512' as const, username: 'svc-user', password: 'svc-pass' },
  tls: {
    enabled: true,
    rejectUnauthorized: false,
    serverName: 'kafka.local',
    caPem: 'ca-pem',
    certPem: 'cert-pem',
    keyPem: 'key-pem',
    passphrase: 'secret',
  },
  connectionTimeoutMs: 5000,
  requestTimeoutMs: 9000,
};

function renderPage(state: KafkaState): RenderResult {
  return render(<KafkaSettingsPage kafkaState={state} />);
}

function rerenderPage(rerender: RenderResult['rerender'], state: KafkaState) {
  rerender(<KafkaSettingsPage kafkaState={state} />);
}

describe('KafkaSettingsPage', () => {
  it('renders loading shell when kafka state is not loaded', () => {
    renderPage(makeState({ loaded: false }));

    expect(screen.getByTestId('kafka-settings-loading')).toBeTruthy();
    expect(screen.getByText('Reading saved Kafka clusters and connection status.')).toBeTruthy();
  });

  it('renders error shell when loading completed with error and no clusters', () => {
    renderPage(makeState({
      lastError: 'storage read failed',
    }));

    expect(screen.getByTestId('kafka-settings-error')).toBeTruthy();
    expect(screen.getByText('storage read failed')).toBeTruthy();
  });

  it('keeps runtime validation errors out of the startup error shell when no clusters exist', () => {
    renderPage(makeState({
      lastError: 'No Kafka cluster is selected',
      lastErrorDetail: {
        kind: 'validation',
        code: 'KAFKA_NO_CLUSTER_SELECTED',
        message: 'No Kafka cluster is selected',
        retryable: false,
      },
    }));

    expect(screen.queryByTestId('kafka-settings-error')).toBeNull();
    expect(screen.getByTestId('kafka-settings-empty')).toBeTruthy();
    expect(screen.getByTestId('kafka-diagnostic-banner').textContent).toContain('Configuration issue');
  });

  it('renders empty shell when there are no clusters and no error', () => {
    renderPage(makeState());

    expect(screen.getByTestId('kafka-settings-empty')).toBeTruthy();
    expect(screen.getByText('No clusters configured yet')).toBeTruthy();
    expect(screen.getByTestId('kafka-empty-create-btn')).toBeTruthy();
  });

  it('opens create editor from the empty shell call to action', async () => {
    const user = userEvent.setup();

    renderPage(makeState());

    await user.click(screen.getByTestId('kafka-empty-create-btn'));

    expect(screen.getByText('Create Cluster')).toBeTruthy();
  });

  it('renders cluster list and allows selecting a cluster', async () => {
    const user = userEvent.setup();
    const setSelectedClusterId = vi.fn();

    renderPage(makeState({
      clusters: [{
        ...CLUSTER_A,
        brokers: ['127.0.0.1:19092', '127.0.0.1:19093', '127.0.0.1:19094'],
      }],
      selectedClusterId: 'cluster-a',
      selectedCluster: {
        ...CLUSTER_A,
        brokers: ['127.0.0.1:19092', '127.0.0.1:19093', '127.0.0.1:19094'],
      },
      setSelectedClusterId,
      connection: {
        state: 'connected',
        clusterId: 'cluster-a',
      },
    }));

    expect(screen.getByTestId('kafka-settings-list')).toBeTruthy();
    expect(screen.getByText('Connected to cluster-a')).toBeTruthy();
    expect(screen.getByText('127.0.0.1:19092, 127.0.0.1:19093, +1 more')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Cluster A/i }));
    expect(setSelectedClusterId).toHaveBeenCalledWith('cluster-a');
  });

  it('shows the topic-browser idle state when no cluster is selected', () => {
    renderPage(makeState());

    expect(screen.getByTestId('kafka-topic-browser')).toBeTruthy();
    expect(screen.getByTestId('kafka-topics-idle')).toBeTruthy();
  });

  it('renders connected topic browser results and filters topics locally', async () => {
    const user = userEvent.setup();
    const setAutoConnectOnStartup = vi.fn();
    const setIncludeInternalTopics = vi.fn();
    const refreshTopics = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'connected', clusterId: 'cluster-a' },
      autoConnectOnStartup: true,
      setAutoConnectOnStartup,
      includeInternalTopics: true,
      setIncludeInternalTopics,
      refreshTopics,
      topics: [
        { name: 'orders.created', partitions: 3, isInternal: false },
        { name: '__consumer_offsets', partitions: 50, isInternal: true },
      ],
    }));

    expect(screen.getByTestId('kafka-topic-orders.created')).toBeTruthy();
    expect(screen.getByTestId('kafka-topic-__consumer_offsets')).toBeTruthy();
    expect(screen.getByTestId('kafka-topic-summary').textContent).toContain('2 of 2 topics shown');

    await user.click(screen.getByLabelText('Auto-connect the selected cluster on startup'));
    await user.click(screen.getByLabelText('Include internal topics'));
    await user.click(screen.getByRole('button', { name: 'Refresh Topics' }));
    await user.type(screen.getByLabelText('Search Topics'), 'orders');

    expect(setAutoConnectOnStartup).toHaveBeenCalledWith(false);
    expect(setIncludeInternalTopics).toHaveBeenCalledWith(false);
    expect(refreshTopics).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('kafka-topic-orders.created')).toBeTruthy();
    expect(screen.queryByTestId('kafka-topic-__consumer_offsets')).toBeNull();
    expect(screen.getByTestId('kafka-topic-summary').textContent).toContain('1 of 2 topics shown');
  });

  it('resets topic filter when switching clusters from the saved cluster list', async () => {
    const user = userEvent.setup();
    const setSelectedClusterId = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A, CLUSTER_B],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'connected', clusterId: 'cluster-a' },
      setSelectedClusterId,
      topics: [
        { name: 'orders.created', partitions: 3, isInternal: false },
      ],
    }));

    const searchInput = screen.getByLabelText('Search Topics') as HTMLInputElement;
    await user.type(searchInput, 'orders');
    expect(searchInput.value).toBe('orders');

    await user.click(screen.getByRole('button', { name: /Cluster B/i }));

    expect(setSelectedClusterId).toHaveBeenCalledWith('cluster-b');
    expect(searchInput.value).toBe('');
  });

  it('resets topic filter when selected cluster changes externally', async () => {
    const user = userEvent.setup();

    const { rerender } = renderPage(makeState({
      clusters: [CLUSTER_A, CLUSTER_B],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'connected', clusterId: 'cluster-a' },
      topics: [{ name: 'orders.created', partitions: 3, isInternal: false }],
    }));
    const searchInput = screen.getByLabelText('Search Topics') as HTMLInputElement;

    await user.type(searchInput, 'orders');
    expect(searchInput.value).toBe('orders');

    rerenderPage(rerender, makeState({
      clusters: [CLUSTER_A, CLUSTER_B],
      selectedClusterId: 'cluster-b',
      selectedCluster: CLUSTER_B,
      connection: { state: 'connected', clusterId: 'cluster-b' },
      topics: [{ name: 'payments.authorized', partitions: 2, isInternal: false }],
    }));
    expect((screen.getByLabelText('Search Topics') as HTMLInputElement).value).toBe('');
  });

  it('shows topic-browser disconnected, loading, error, and empty states', () => {
    const { rerender } = renderPage(makeState());

    rerenderPage(rerender, makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
    }));
    expect(screen.getByTestId('kafka-topics-disconnected')).toBeTruthy();

    rerenderPage(rerender, makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'connected', clusterId: 'cluster-a' },
      topicsLoading: true,
    }));
    expect(screen.getByTestId('kafka-topics-loading')).toBeTruthy();

    rerenderPage(rerender, makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'connected', clusterId: 'cluster-a' },
      topicsError: {
        kind: 'server',
        code: 'KAFKA_TOPICS_FAILED',
        message: 'topic metadata request failed',
        retryable: true,
      },
    }));
    expect(screen.getByTestId('kafka-topics-error').textContent).toContain('topic metadata request failed');

    rerenderPage(rerender, makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'connected', clusterId: 'cluster-a' },
      topics: [],
    }));
    expect(screen.getByTestId('kafka-topics-empty')).toBeTruthy();
  });

  it('opens create editor from New Cluster and validates empty broker row', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      upsertCluster,
    }));

    await user.click(screen.getByTestId('kafka-add-cluster-btn'));
    expect(screen.getByText('Create Cluster')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add Broker' }));
    await user.clear(screen.getByLabelText('Broker 2'));
    await user.click(screen.getByTestId('kafka-save-cluster-btn'));

    expect(screen.getByText('Broker host:port is required')).toBeTruthy();
    expect(upsertCluster).not.toHaveBeenCalled();
  });

  it('cancels the editor and returns to the helper state', async () => {
    const user = userEvent.setup();

    renderPage(makeState({
      clusters: [CLUSTER_A],
    }));

    await user.click(screen.getByTestId('kafka-add-cluster-btn'));
    expect(screen.getByText('Create Cluster')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Select a saved cluster and click Edit, or click New Cluster to start configuring one.')).toBeTruthy();
  });

  it('shows testing and error summaries and triggers shell actions', async () => {
    const user = userEvent.setup();
    const clearError = vi.fn();
    const connectSelectedCluster = vi.fn();
    const disconnectActiveCluster = vi.fn();
    const testSelectedClusterConnection = vi.fn();
    const refreshConnectionStatus = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderPage(makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'connected', clusterId: 'cluster-a' },
      lastError: 'temporary failure',
      lastErrorDetail: {
        kind: 'network',
        code: 'KAFKA_NETWORK_ERROR',
        message: 'broker refused the connection',
        retryable: true,
      },
      clearError,
      connectSelectedCluster,
      disconnectActiveCluster,
      refreshConnectionStatus,
      testSelectedClusterConnection,
    }));

  expect(screen.getByText('Connected to cluster-a')).toBeTruthy();
  expect(screen.getByTestId('kafka-selected-cluster-security').textContent).toContain('No authentication');
  expect(screen.getByTestId('kafka-diagnostic-banner').textContent).toContain('Network / broker reachability issue');
  expect(screen.getByTestId('kafka-diagnostic-banner').textContent).toContain('KAFKA_NETWORK_ERROR');
    await user.click(screen.getByRole('button', { name: 'Test Connection' }));
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await user.click(screen.getByRole('button', { name: 'Refresh Status' }));
    await user.click(screen.getByRole('button', { name: 'Clear Error' }));

    expect(testSelectedClusterConnection).toHaveBeenCalledTimes(1);
    expect(disconnectActiveCluster).toHaveBeenCalledTimes(1);
    expect(refreshConnectionStatus).toHaveBeenCalledWith({ force: true });
    expect(clearError).toHaveBeenCalledTimes(1);

    rerenderPage(rerender, makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      connection: { state: 'testing', clusterId: 'cluster-a' },
    }));
    expect(screen.getByText('Testing connection...')).toBeTruthy();
  });

  it('saves auth, TLS, and timeout fields when creating a secure cluster', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      upsertCluster,
    }));

    await user.click(screen.getByTestId('kafka-add-cluster-btn'));
    await user.clear(screen.getByLabelText('Cluster Name'));
    await user.type(screen.getByLabelText('Cluster Name'), 'Secure Local Cluster');
    await user.type(screen.getByLabelText('Connection Timeout (ms)'), '5000');
    await user.type(screen.getByLabelText('Request Timeout (ms)'), '9000');
    await user.selectOptions(screen.getByLabelText('Authentication'), 'scram-sha-512');
    await user.type(screen.getByLabelText('Username'), 'svc-user');
    await user.type(screen.getByLabelText('Password'), 'svc-pass');
    await user.click(screen.getByLabelText('Enable TLS'));
    await user.click(screen.getByLabelText('Verify server certificate'));
    await user.type(screen.getByLabelText('TLS Server Name'), 'kafka.local');
    await user.type(screen.getByLabelText('CA PEM'), 'ca-pem');
    await user.type(screen.getByLabelText('Client Certificate PEM'), 'cert-pem');
    await user.type(screen.getByLabelText('Client Private Key PEM'), 'key-pem');
    await user.type(screen.getByLabelText('Key Passphrase'), 'secret');

    await user.click(screen.getByTestId('kafka-save-cluster-btn'));

    expect(upsertCluster).toHaveBeenCalledWith(expect.objectContaining({
      clusterId: 'secure-local-cluster',
      connectionTimeoutMs: 5000,
      requestTimeoutMs: 9000,
      auth: {
        mode: 'scram-sha-512',
        username: 'svc-user',
        password: 'svc-pass',
      },
      tls: {
        enabled: true,
        rejectUnauthorized: false,
        serverName: 'kafka.local',
        caPem: 'ca-pem',
        certPem: 'cert-pem',
        keyPem: 'key-pem',
        passphrase: 'secret',
      },
    }));
  });

  it('shows secure cluster fields when editing an existing secure profile', async () => {
    const user = userEvent.setup();

    renderPage(makeState({
      clusters: [SECURE_CLUSTER],
      selectedClusterId: 'secure-cluster',
      selectedCluster: SECURE_CLUSTER,
    }));

    expect(screen.getByTestId('kafka-selected-cluster-security').textContent).toContain('SCRAM-SHA-512');
    expect(screen.getByTestId('kafka-selected-cluster-security').textContent).toContain('TLS without cert verification');

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect((screen.getByLabelText('Authentication') as HTMLSelectElement).value).toBe('scram-sha-512');
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('svc-user');
    expect((screen.getByLabelText('TLS Server Name') as HTMLInputElement).value).toBe('kafka.local');
    expect((screen.getByLabelText('Connection Timeout (ms)') as HTMLInputElement).value).toBe('5000');
  });

  it('clears persisted TLS material when TLS is disabled before save', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();

    renderPage(makeState({
      clusters: [SECURE_CLUSTER],
      selectedClusterId: 'secure-cluster',
      selectedCluster: SECURE_CLUSTER,
      upsertCluster,
    }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByLabelText('Enable TLS'));
    await user.click(screen.getByTestId('kafka-save-cluster-btn'));

    expect(upsertCluster).toHaveBeenCalledWith(expect.objectContaining({
      tls: {
        enabled: false,
        rejectUnauthorized: true,
      },
    }));
  });

  it('shows Phase 3C validation messages for secure field combinations', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      upsertCluster,
    }));

    await user.click(screen.getByTestId('kafka-add-cluster-btn'));
    await user.selectOptions(screen.getByLabelText('Authentication'), 'plain');
    await user.click(screen.getByLabelText('Enable TLS'));
    await user.type(screen.getByLabelText('Client Certificate PEM'), 'cert-only');
    await user.type(screen.getByLabelText('Key Passphrase'), 'secret');
    await user.clear(screen.getByLabelText('Connection Timeout (ms)'));
    await user.type(screen.getByLabelText('Connection Timeout (ms)'), 'abc');
    await user.clear(screen.getByLabelText('Request Timeout (ms)'));
    await user.type(screen.getByLabelText('Request Timeout (ms)'), '0');

    await user.click(screen.getByTestId('kafka-save-cluster-btn'));

    expect(screen.getByText('Username is required for authenticated modes')).toBeTruthy();
    expect(screen.getByText('Password is required for authenticated modes')).toBeTruthy();
    expect(screen.getAllByText('Certificate and private key must be provided together')).toHaveLength(2);
    expect(screen.getByText('Passphrase requires a TLS private key')).toBeTruthy();
    expect(screen.getByText('Must be a whole number of milliseconds')).toBeTruthy();
    expect(screen.getByText('Must be at least 1 millisecond')).toBeTruthy();
    expect(upsertCluster).not.toHaveBeenCalled();
  });

  it('creates a cluster, updates client id, and removes an extra broker row before save', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();
    const setSelectedClusterId = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      upsertCluster,
      setSelectedClusterId,
    }));

    await user.click(screen.getByTestId('kafka-add-cluster-btn'));
    await user.clear(screen.getByLabelText('Cluster Name'));
    await user.type(screen.getByLabelText('Cluster Name'), 'QA Cluster');
    await user.clear(screen.getByLabelText('Client ID'));
    await user.type(screen.getByLabelText('Client ID'), 'qa-client');
    await user.click(screen.getByRole('button', { name: 'Add Broker' }));
    await user.type(screen.getByLabelText('Broker 2'), '127.0.0.1:29092');
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]!);
    await user.click(screen.getByTestId('kafka-save-cluster-btn'));

    expect(upsertCluster).toHaveBeenCalledWith(expect.objectContaining({
      clusterId: 'qa-cluster',
      name: 'QA Cluster',
      clientId: 'qa-client',
      brokers: ['127.0.0.1:19092'],
    }));
    expect(setSelectedClusterId).toHaveBeenCalledWith('qa-cluster');
    expect(screen.getByText('Select a saved cluster and click Edit, or click New Cluster to start configuring one.')).toBeTruthy();
  });

  it('preserves a custom cluster id in create mode after later name edits', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      upsertCluster,
    }));

    await user.click(screen.getByTestId('kafka-add-cluster-btn'));

    const clusterIdInput = screen.getByLabelText('Cluster ID');
    await user.clear(clusterIdInput);
    await user.type(clusterIdInput, 'custom-cluster-id');

    const nameInput = screen.getByLabelText('Cluster Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed New Cluster');

    expect((screen.getByLabelText('Cluster ID') as HTMLInputElement).value).toBe('custom-cluster-id');

    await user.click(screen.getByTestId('kafka-save-cluster-btn'));
    expect(upsertCluster).toHaveBeenCalledWith(expect.objectContaining({
      clusterId: 'custom-cluster-id',
      name: 'Renamed New Cluster',
    }));
  });

  it('edits a selected cluster and saves updated broker', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      upsertCluster,
    }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Edit Cluster')).toBeTruthy();

    const brokerInput = screen.getByLabelText('Broker 1');
    await user.clear(brokerInput);
    await user.type(brokerInput, 'kafka.example.com:9092');

    await user.click(screen.getByTestId('kafka-save-cluster-btn'));

    expect(upsertCluster).toHaveBeenCalledTimes(1);
    expect(upsertCluster.mock.calls[0]?.[0]?.clusterId).toBe('cluster-a');
    expect(upsertCluster.mock.calls[0]?.[0]?.name).toBe('Cluster A');
    expect(upsertCluster.mock.calls[0]?.[0]?.brokers).toEqual(['kafka.example.com:9092']);
  });

  it('does not auto-change cluster id from name in edit mode', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      upsertCluster,
    }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Cluster Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Cluster');

    const clusterIdInput = screen.getByLabelText('Cluster ID');
    expect((clusterIdInput as HTMLInputElement).value).toBe('cluster-a');

    await user.click(screen.getByTestId('kafka-save-cluster-btn'));
    expect(upsertCluster).toHaveBeenCalledTimes(1);
    expect(upsertCluster.mock.calls[0]?.[0]?.clusterId).toBe('cluster-a');
    expect(upsertCluster.mock.calls[0]?.[0]?.name).toBe('Renamed Cluster');
  });

  it('removes old cluster id when id is explicitly renamed in edit mode', async () => {
    const user = userEvent.setup();
    const upsertCluster = vi.fn();
    const removeCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      upsertCluster,
      removeCluster,
    }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const clusterIdInput = screen.getByLabelText('Cluster ID');
    await user.clear(clusterIdInput);
    await user.type(clusterIdInput, 'cluster-renamed');
    await user.click(screen.getByTestId('kafka-save-cluster-btn'));

    expect(removeCluster).toHaveBeenCalledWith('cluster-a');
    expect(upsertCluster).toHaveBeenCalledTimes(1);
    expect(upsertCluster.mock.calls[0]?.[0]?.clusterId).toBe('cluster-renamed');
  });

  it('shows and confirms delete flow from edit mode', async () => {
    const user = userEvent.setup();
    const removeCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      removeCluster,
    }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete Cluster' }));
    expect(screen.getByTestId('kafka-delete-confirm')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    expect(removeCluster).toHaveBeenCalledWith('cluster-a');
  });

  it('cancels delete confirmation without removing the cluster', async () => {
    const user = userEvent.setup();
    const removeCluster = vi.fn();

    renderPage(makeState({
      clusters: [CLUSTER_A],
      selectedClusterId: 'cluster-a',
      selectedCluster: CLUSTER_A,
      removeCluster,
    }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete Cluster' }));
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[1]!);

    expect(screen.queryByTestId('kafka-delete-confirm')).toBeNull();
    expect(removeCluster).not.toHaveBeenCalled();
  });
});

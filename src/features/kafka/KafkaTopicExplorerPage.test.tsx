/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { selectOption, isCustomSelectDisabled } from '../../test-utils/customSelectHelper';
import { KafkaTopicExplorerPage } from './KafkaTopicExplorerPage';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import * as kafkaClient from '../../shared/kafka/kafkaClient';

vi.mock('../../shared/kafka/kafkaClient', async (importOriginal) => {
  const actual = await importOriginal<typeof kafkaClient>();
  return {
    ...actual,
    dispatchKafkaOperation: vi.fn(),
  };
});

const mockDispatch = vi.mocked(kafkaClient.dispatchKafkaOperation);

function makeKafkaState(overrides?: Partial<UseKafkaStateReturn>): UseKafkaStateReturn {
  return {
    loaded: true,
    clusters: [{ clusterId: 'c1', name: 'Local', clientId: 'rf', brokers: ['localhost:9092'] } as never],
    selectedClusterId: 'c1',
    selectedCluster: null,
    connection: { state: 'connected', clusterId: 'c1' },
    topics: [
      { name: 'orders.created', partitions: 3, isInternal: false },
      { name: 'orders.updated', partitions: 6, isInternal: false },
      { name: 'payments.settled', partitions: 12, isInternal: false },
    ],
    topicsLoading: false,
    topicsError: null,
    includeInternalTopics: false,
    lastError: null,
    lastErrorDetail: null,
    statusPollFailureStreak: 0,
    autoConnectOnStartup: false,
    setAutoConnectOnStartup: vi.fn(),
    setIncludeInternalTopics: vi.fn(),
    setSelectedClusterId: vi.fn(),
    upsertCluster: vi.fn(),
    removeCluster: vi.fn(),
    replaceClusters: vi.fn(),
    connectSelectedCluster: vi.fn(),
    disconnectActiveCluster: vi.fn(),
    testSelectedClusterConnection: vi.fn(),
    refreshConnectionStatus: vi.fn(),
    refreshTopics: vi.fn(),
    setConnectionState: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  } as unknown as UseKafkaStateReturn;
}

function topicDetail(name: string) {
  return {
    name,
    partitionCount: 3,
    replicationFactor: 3,
    isInternal: false,
    partitions: [{
      partitionId: 0,
      leader: 1,
      replicas: [1, 2, 3],
      isr: [1, 2, 3],
      earliestOffset: '0',
      latestOffset: '100',
      messageCount: 50,
    }],
    consumerGroups: [],
    config: { 'retention.ms': '604800000' },
    healthStatus: 'healthy' as const,
  };
}

describe('KafkaTopicExplorerPage', () => {
  beforeEach(() => {
    resetAllMocks();
    mockDispatch.mockImplementation((op: string, body: Record<string, unknown>) => {
      if (op === 'topic-detail') {
        return Promise.resolve({
          ok: true,
          data: topicDetail(String(body.topicName)),
        });
      }
      return Promise.resolve({ ok: true, data: { messages: [] } });
    });
  });

  it('renders KafkaStudioGuard when not connected', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState({
          connection: { state: 'disconnected' },
        })}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Cluster is not connected')).toBeTruthy();
    expect(screen.queryByTestId('topic-explorer-page')).toBeNull();
  });

  it('renders topic list when connected', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByTestId('topic-explorer-page')).toBeTruthy();
    expect(screen.getByTestId('topic-row-orders.created')).toBeTruthy();
    expect(screen.getByTestId('topic-row-payments.settled')).toBeTruthy();
  });

  it('topic search filters list', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('topic-search'), { target: { value: 'payment' } });

    expect(screen.getByTestId('topic-row-payments.settled')).toBeTruthy();
    expect(screen.queryByTestId('topic-row-orders.created')).toBeNull();
    expect(screen.queryByTestId('topic-row-orders.updated')).toBeNull();
  });

  it('clicking a row opens detail panel', async () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith('topic-detail', expect.objectContaining({
        topicName: 'orders.created',
      }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('detail-tabs')).toBeTruthy();
      expect(screen.getByTestId('detail-messages-tab')).toBeTruthy();
    });
  });

  it('shows loading when kafka settings not loaded', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState({ loaded: false })}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Loading Kafka settings…')).toBeTruthy();
  });

  it('health and partition filters narrow the list', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    selectOption(screen.getByTestId('partition-filter'), '1–4');
    expect(screen.getByTestId('topic-row-orders.created')).toBeTruthy();
    expect(screen.queryByTestId('topic-row-orders.updated')).toBeNull();
  });

  it('domain chip click filters by prefix', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'orders' }));
    expect(screen.getByTestId('topic-row-orders.created')).toBeTruthy();
    expect(screen.queryByTestId('topic-row-payments.settled')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'orders' }));
    expect(screen.getByTestId('topic-row-payments.settled')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByTestId('topic-row-payments.settled')).toBeTruthy();
  });

  it('clicking selected row again deselects topic', async () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    await waitFor(() => expect(screen.getByTestId('detail-tabs')).toBeTruthy());

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    expect(screen.queryByTestId('detail-tabs')).toBeNull();
  });

  it('Recently Active and Lagging Consumers chips filter loaded topics', async () => {
    mockDispatch.mockImplementation((op: string, body: Record<string, unknown>) => {
      if (op === 'topic-detail') {
        const name = String(body.topicName);
        if (name === 'orders.created') {
          return Promise.resolve({
            ok: true,
            data: {
              ...topicDetail(name),
              partitions: [{ partitionId: 0, leader: 1, replicas: [1], isr: [1], earliestOffset: '0', latestOffset: '10', messageCount: 100 }],
              consumerGroups: [{ groupId: 'g1', state: 'Stable', totalLag: 50 }],
            },
          });
        }
        return Promise.resolve({
          ok: true,
          data: {
            ...topicDetail(name),
            partitions: [{ partitionId: 0, leader: 1, replicas: [1], isr: [1], earliestOffset: '0', latestOffset: '0', messageCount: 0 }],
            consumerGroups: [],
          },
        });
      }
      return Promise.resolve({ ok: true, data: { messages: [] } });
    });

    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    fireEvent.click(screen.getByTestId('topic-row-payments.settled'));
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Recently Active' }));
    expect(screen.getByTestId('topic-row-orders.created')).toBeTruthy();
    expect(screen.queryByTestId('topic-row-payments.settled')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Lagging Consumers' }));
    expect(screen.getByTestId('topic-row-orders.created')).toBeTruthy();
    expect(screen.queryByTestId('topic-row-orders.updated')).toBeNull();
  });

  it('internal toggle and retention filter work', async () => {
    const state = makeKafkaState({
      topics: [
        { name: 'orders.created', partitions: 3, isInternal: false },
        { name: '__consumer_offsets', partitions: 50, isInternal: true },
      ],
    });
    render(
      <KafkaTopicExplorerPage
        kafkaState={state}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    const internalLabel = screen.getByText('Internal').closest('label')!;
    fireEvent.click(internalLabel.querySelector('input')!);
    expect(screen.getByTestId('topic-row-__consumer_offsets')).toBeTruthy();

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    await waitFor(() => expect(isCustomSelectDisabled(screen.getByTestId('health-filter'))).toBe(false));

    selectOption(screen.getByTestId('health-filter'), 'Healthy');
    expect(screen.getByTestId('topic-row-orders.created')).toBeTruthy();

    selectOption(screen.getByTestId('retention-filter'), '1–7 days');
    expect(screen.getByTestId('topic-row-orders.created')).toBeTruthy();
  });

  it('shows empty state when no topics match filters', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('topic-search'), { target: { value: 'nonexistent-topic-xyz' } });
    expect(screen.getByText('No topics match the current filters')).toBeTruthy();
  });

  it('table row shows cached health badges after detail load', async () => {
    mockDispatch.mockImplementation((op: string, body: Record<string, unknown>) => {
      if (op === 'topic-detail') {
        const name = String(body.topicName);
        const status = name === 'payments.settled' ? 'degraded' : name === 'orders.updated' ? 'unknown' : 'healthy';
        return Promise.resolve({ ok: true, data: { ...topicDetail(name), healthStatus: status } });
      }
      return Promise.resolve({ ok: true, data: { messages: [] } });
    });

    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    fireEvent.click(screen.getByTestId('topic-row-orders.updated'));
    fireEvent.click(screen.getByTestId('topic-row-payments.settled'));

    await waitFor(() => {
      const row = screen.getByTestId('topic-row-orders.created');
      expect(row.textContent).toContain('● OK');
    });
    expect(screen.getByTestId('topic-row-payments.settled').textContent).toContain('⚠ Warn');
    expect(screen.getByTestId('topic-row-orders.updated').textContent).toContain('?');
  });

  it('special chips toggle off restores full list', async () => {
    mockDispatch.mockResolvedValue({
      ok: true,
      data: {
        ...topicDetail('orders.created'),
        partitions: [{ partitionId: 0, leader: 1, replicas: [1], isr: [1], earliestOffset: '0', latestOffset: '1', messageCount: 1 }],
      },
    });

    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    // Wait for the detail to load and render (not just dispatch call)
    await waitFor(() => {
      expect(screen.getByTestId('topic-row-orders.created').textContent).toContain('● OK');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Recently Active' }));
    expect(screen.queryByTestId('topic-row-payments.settled')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Recently Active' }));
    expect(screen.getByTestId('topic-row-payments.settled')).toBeTruthy();
  });

  it('domain chips render', () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    const chipbar = screen.getByTestId('domain-chips');
    expect(chipbar.textContent).toContain('orders');
    expect(chipbar.textContent).toContain('payments');
    expect(chipbar.textContent).toContain('Recently Active');
    expect(chipbar.textContent).toContain('Lagging Consumers');
  });

  it('health/retention filters and special chips disabled until detail loaded', async () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    const healthFilter = screen.getByTestId('health-filter');
    const retentionFilter = screen.getByTestId('retention-filter');
    const activeChip = screen.getByRole('button', { name: /Recently Active/ });
    const laggingChip = screen.getByRole('button', { name: /Lagging Consumers/ });

    expect(isCustomSelectDisabled(healthFilter)).toBe(true);
    expect(isCustomSelectDisabled(retentionFilter)).toBe(true);
    expect(activeChip).toHaveProperty('disabled', true);
    expect(laggingChip).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith('topic-detail', expect.anything()));

    await waitFor(() => {
      expect(isCustomSelectDisabled(healthFilter)).toBe(false);
      expect(isCustomSelectDisabled(retentionFilter)).toBe(false);
    });
  });

  it('renders traffic in K and M units once details are cached', async () => {
    mockDispatch.mockImplementation((op: string, body: Record<string, unknown>) => {
      if (op === 'topic-detail') {
        const name = String(body.topicName);
        const messageCount = name === 'orders.created' ? 1500 : 1_250_000;
        return Promise.resolve({
          ok: true,
          data: {
            ...topicDetail(name),
            partitions: [{ partitionId: 0, leader: 1, replicas: [1], isr: [1], earliestOffset: '0', latestOffset: '10', messageCount }],
          },
        });
      }
      return Promise.resolve({ ok: true, data: { messages: [] } });
    });

    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    await waitFor(() => expect(screen.getByTestId('topic-row-orders.created').textContent).toContain('1.5K'));

    fireEvent.click(screen.getByTestId('topic-row-orders.updated'));
    await waitFor(() => expect(screen.getByTestId('topic-row-orders.updated').textContent).toContain('1.3M'));
  });

  it('collapse button toggles collapsed layout and label/title states', async () => {
    render(
      <KafkaTopicExplorerPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('topic-row-orders.created'));
    await waitFor(() => expect(screen.getByTestId('topic-list-collapse-btn')).toBeTruthy());

    const page = screen.getByTestId('topic-explorer-page');
    const collapseBtn = screen.getByTestId('topic-list-collapse-btn') as HTMLButtonElement;

    expect(page.className).not.toContain('kafka-explorer-layout--collapsed');
    expect(collapseBtn.getAttribute('title')).toBe('Collapse topic list');

    fireEvent.click(collapseBtn);

    expect(page.className).toContain('kafka-explorer-layout--collapsed');
    expect(screen.getByText('Topics')).toBeTruthy();
    expect(page.querySelector('.kafka-explorer-collapsed-topic')?.textContent).toBe('orders.created');
    expect(collapseBtn.getAttribute('title')).toBe('Expand topic list');
    expect(collapseBtn.getAttribute('aria-label')).toBe('Expand topic list');

    fireEvent.click(collapseBtn);
    expect(page.className).not.toContain('kafka-explorer-layout--collapsed');
    expect(collapseBtn.getAttribute('title')).toBe('Collapse topic list');
  });
});

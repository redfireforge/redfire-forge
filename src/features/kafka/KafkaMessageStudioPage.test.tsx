/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KafkaMessageStudioPage } from './KafkaMessageStudioPage';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';

function makeKafkaState(overrides?: Partial<UseKafkaStateReturn>): UseKafkaStateReturn {
  return {
    loaded: true,
    clusters: [],
    connection: { state: 'connected', clusterId: 'cluster-a' },
    selectedClusterId: 'cluster-a',
    selectedCluster: null,
    topics: [],
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
    refreshConnectionStatus: vi.fn().mockResolvedValue(undefined),
    refreshTopics: vi.fn().mockResolvedValue(undefined),
    setConnectionState: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  } as unknown as UseKafkaStateReturn;
}

describe('KafkaMessageStudioPage', () => {
  it('shows loading state when not loaded', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState({ loaded: false })}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Loading Kafka settings…')).toBeTruthy();
  });

  it('shows guard when disconnected', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState({
          loaded: true,
          clusters: [],
          connection: { state: 'disconnected' },
        })}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    // Guard should render — no clusters configured
    expect(screen.getByText('No clusters configured')).toBeTruthy();
  });

  it('shows guard when state=error', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState({
          loaded: true,
          clusters: [{ clusterId: 'c', name: 'C', clientId: 'rf', brokers: ['localhost:9092'] } as never],
          connection: { state: 'error', lastError: 'Auth failed' },
        })}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Cluster connection error')).toBeTruthy();
  });

  it('shows guard when state=testing', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState({
          loaded: true,
          clusters: [{ clusterId: 'c', name: 'C', clientId: 'rf', brokers: ['localhost:9092'] } as never],
          connection: { state: 'testing' },
        })}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Connecting to cluster…')).toBeTruthy();
  });

  it('shows tab bar with Publish Studio and Consume Studio tabs when connected', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Publish Studio' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consume Studio' })).toBeTruthy();
  });

  it('defaults to Publish Studio tab and shows publish panel', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    // Publish Studio tab is active by default → KafkaPublishStudio is rendered
    expect(screen.getByRole('button', { name: 'Publish Studio' }).className).toContain('active');
    expect(screen.getByText('Publish')).toBeTruthy();
  });

  it('switches to Consume Studio when tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Consume Studio' }));
    expect(screen.getByRole('button', { name: 'Consume Studio' }).className).toContain('active');
    expect(screen.getByText('Consume')).toBeTruthy();
  });

  it('passes onNavigateToKafkaSettings to guard', () => {
    const onNav = vi.fn();
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState({ loaded: true, clusters: [], connection: { state: 'disconnected' } })}
        onNavigateToKafkaSettings={onNav}
      />,
    );
    // Action button should be present in guard
    expect(screen.getByTestId('guard-action-btn')).toBeTruthy();
  });
});

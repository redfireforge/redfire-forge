/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KafkaMessageStudioPage } from './KafkaMessageStudioPage';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';

vi.mock('./KafkaTopicExplorerPage', () => ({
  KafkaTopicExplorerContent: () => <div data-testid="topic-explorer-page">Topic Explorer Content</div>,
  KafkaTopicExplorerPage: () => <div>Topic Explorer Page</div>,
}));
vi.mock('./KafkaSchemaRegistryPage', () => ({
  KafkaSchemaRegistryContent: () => <div data-testid="schema-registry-page">Schema Registry Content</div>,
  KafkaSchemaRegistryPage: () => <div>Schema Registry Page</div>,
}));

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

  it('shows tab bar with all four tabs when connected', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consume' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Topics' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schema Registry' })).toBeTruthy();
  });

  it('defaults to Publish tab and shows publish panel', () => {
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Publish' }).className).toContain('active');
  });

  it('switches to Consume when tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Consume' }));
    expect(screen.getByRole('button', { name: 'Consume' }).className).toContain('active');
  });

  it('switches to Topics tab and renders topic explorer content', async () => {
    const user = userEvent.setup();
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Topics' }));
    expect(screen.getByRole('button', { name: 'Topics' }).className).toContain('active');
    expect(screen.getByTestId('topic-explorer-page')).toBeTruthy();
  });

  it('switches to Schema Registry tab and renders schema content', async () => {
    const user = userEvent.setup();
    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Schema Registry' }));
    expect(screen.getByRole('button', { name: 'Schema Registry' }).className).toContain('active');
    expect(screen.getByTestId('schema-registry-page')).toBeTruthy();
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

  it('shows template error banner when useKafkaTemplates has an error', async () => {
    // Mock useKafkaTemplates to return an error
    const mockTemplateModule = await import('../../app/hooks/useKafkaTemplates');
    const spy = vi.spyOn(mockTemplateModule, 'useKafkaTemplates').mockReturnValue({
      publishTemplates: [],
      consumeTemplates: [],
      templatesLoading: false,
      templateError: 'QuotaExceededError',
      savePublishTemplate: vi.fn(),
      loadPublishTemplate: vi.fn().mockReturnValue(null),
      deletePublishTemplate: vi.fn(),
      saveConsumeTemplate: vi.fn(),
      loadConsumeTemplate: vi.fn().mockReturnValue(null),
      deleteConsumeTemplate: vi.fn(),
    });

    render(
      <KafkaMessageStudioPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
      />,
    );
    expect(screen.getByTestId('template-error').textContent).toContain('QuotaExceededError');
    spy.mockRestore();
  });

  it('handleSavePublishTemplate calls savePublishTemplate on templates', async () => {
    const mockTemplateModule = await import('../../app/hooks/useKafkaTemplates');
    const savePublish = vi.fn().mockResolvedValue(undefined);
    const spy = vi.spyOn(mockTemplateModule, 'useKafkaTemplates').mockReturnValue({
      publishTemplates: [],
      consumeTemplates: [],
      templatesLoading: false,
      templateError: null,
      savePublishTemplate: savePublish,
      loadPublishTemplate: vi.fn().mockReturnValue(null),
      deletePublishTemplate: vi.fn().mockResolvedValue(undefined),
      saveConsumeTemplate: vi.fn().mockResolvedValue(undefined),
      loadConsumeTemplate: vi.fn().mockReturnValue(null),
      deleteConsumeTemplate: vi.fn().mockResolvedValue(undefined),
    });

    render(<KafkaMessageStudioPage kafkaState={makeKafkaState()} onNavigateToKafkaSettings={vi.fn()} />);
    // Open publish template save input and type a name
    fireEvent.click(screen.getByTitle('Save current settings as a template'));
    fireEvent.change(screen.getByPlaceholderText('Template name'), { target: { value: 'Integration Preset' } });
    fireEvent.click(screen.getByText('✓'));
    await waitFor(() => expect(savePublish).toHaveBeenCalledWith('Integration Preset', expect.any(Object)));
    spy.mockRestore();
  });

  it('handleLoadPublishTemplate applies loaded draft to studio', async () => {
    const mockTemplateModule = await import('../../app/hooks/useKafkaTemplates');
    const loadPublish = vi.fn().mockReturnValue({
      topic: 'loaded-topic', key: '', partition: '', acks: -1, timeoutMs: '', headers: [], body: '{}',
    });
    const spy = vi.spyOn(mockTemplateModule, 'useKafkaTemplates').mockReturnValue({
      publishTemplates: [{ id: 'p1', name: 'Preset A', createdAt: '2026-01-01', draft: {
        topic: 'loaded-topic', key: '', partition: '', acks: -1 as const, timeoutMs: '', headers: [], body: '{}',
      } }],
      consumeTemplates: [],
      templatesLoading: false,
      templateError: null,
      savePublishTemplate: vi.fn().mockResolvedValue(undefined),
      loadPublishTemplate: loadPublish,
      deletePublishTemplate: vi.fn().mockResolvedValue(undefined),
      saveConsumeTemplate: vi.fn().mockResolvedValue(undefined),
      loadConsumeTemplate: vi.fn().mockReturnValue(null),
      deleteConsumeTemplate: vi.fn().mockResolvedValue(undefined),
    });

    render(<KafkaMessageStudioPage kafkaState={makeKafkaState()} onNavigateToKafkaSettings={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Load a saved template'));
    fireEvent.click(screen.getByText('Preset A'));
    await waitFor(() => expect(loadPublish).toHaveBeenCalledWith('p1'));
    spy.mockRestore();
  });

  it('handleSaveConsumeTemplate calls saveConsumeTemplate on templates', async () => {
    const mockTemplateModule = await import('../../app/hooks/useKafkaTemplates');
    const saveConsume = vi.fn().mockResolvedValue(undefined);
    const spy = vi.spyOn(mockTemplateModule, 'useKafkaTemplates').mockReturnValue({
      publishTemplates: [],
      consumeTemplates: [],
      templatesLoading: false,
      templateError: null,
      savePublishTemplate: vi.fn().mockResolvedValue(undefined),
      loadPublishTemplate: vi.fn().mockReturnValue(null),
      deletePublishTemplate: vi.fn().mockResolvedValue(undefined),
      saveConsumeTemplate: saveConsume,
      loadConsumeTemplate: vi.fn().mockReturnValue(null),
      deleteConsumeTemplate: vi.fn().mockResolvedValue(undefined),
    });

    const user = userEvent.setup();
    render(<KafkaMessageStudioPage kafkaState={makeKafkaState()} onNavigateToKafkaSettings={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Consume' }));
    fireEvent.click(screen.getByTitle('Save current settings as a template'));
    fireEvent.change(screen.getByPlaceholderText('Template name'), { target: { value: 'Consume Preset' } });
    fireEvent.click(screen.getByText('✓'));
    await waitFor(() => expect(saveConsume).toHaveBeenCalledWith('Consume Preset', expect.any(Object)));
    spy.mockRestore();
  });

  it('handleLoadConsumeTemplate applies loaded draft to studio', async () => {
    const mockTemplateModule = await import('../../app/hooks/useKafkaTemplates');
    const loadConsume = vi.fn().mockReturnValue({
      topic: 'events.v2', groupId: 'my-group', startPosition: 'earliest' as const,
      timeoutMs: '5000', maxMessages: '10', keyEquals: '', headerMatch: '', jsonPath: '', jsonPathEquals: '',
    });
    const spy = vi.spyOn(mockTemplateModule, 'useKafkaTemplates').mockReturnValue({
      publishTemplates: [],
      consumeTemplates: [{ id: 'c1', name: 'Consume A', createdAt: '2026-01-01', draft: {
        topic: 'events.v2', groupId: 'my-group', startPosition: 'earliest' as const,
        timeoutMs: '5000', maxMessages: '10', keyEquals: '', headerMatch: '', jsonPath: '', jsonPathEquals: '',
      } }],
      templatesLoading: false,
      templateError: null,
      savePublishTemplate: vi.fn().mockResolvedValue(undefined),
      loadPublishTemplate: vi.fn().mockReturnValue(null),
      deletePublishTemplate: vi.fn().mockResolvedValue(undefined),
      saveConsumeTemplate: vi.fn().mockResolvedValue(undefined),
      loadConsumeTemplate: loadConsume,
      deleteConsumeTemplate: vi.fn().mockResolvedValue(undefined),
    });

    const user = userEvent.setup();
    render(<KafkaMessageStudioPage kafkaState={makeKafkaState()} onNavigateToKafkaSettings={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Consume' }));
    fireEvent.click(screen.getByTitle('Load a saved template'));
    fireEvent.click(screen.getByText('Consume A'));
    await waitFor(() => expect(loadConsume).toHaveBeenCalledWith('c1'));
    spy.mockRestore();
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '@test-utils/customSelectHelper';
import { KafkaSchemaRegistryPage } from './KafkaSchemaRegistryPage';
import type { UseKafkaStateReturn } from '@app/hooks/useKafkaState';

function makeKafkaState(overrides?: Partial<UseKafkaStateReturn>): UseKafkaStateReturn {
  return {
    loaded: true,
    clusters: [{ clusterId: 'c1', name: 'Local', brokers: 'localhost:9092', authMode: 'none' }],
    selectedClusterId: 'c1',
    selectedCluster: null,
    connection: { state: 'connected', clusterId: 'c1' },
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
    refreshConnectionStatus: vi.fn(),
    refreshTopics: vi.fn(),
    setConnectionState: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  } as unknown as UseKafkaStateReturn;
}

async function connectAndLoad(mockDispatch: ReturnType<typeof vi.fn>) {
  fireEvent.change(screen.getByTestId('registry-url-input'), {
    target: { value: 'http://localhost:8085' },
  });
  fireEvent.click(screen.getByTestId('registry-connect-btn'));
  await waitFor(() => {
    expect(mockDispatch).toHaveBeenCalledWith('schema-subjects', expect.anything());
  });
}

async function selectSubjectAndWaitForSchema(name: string) {
  fireEvent.click(screen.getByTestId(`subject-row-${name}`));
  await waitFor(() => {
    expect(screen.getByTestId('schema-content')).toBeTruthy();
  });
}

describe('KafkaSchemaRegistryPage', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAllMocks();
    mockDispatch = vi.fn();
  });

  it('renders schema registry content even when cluster is disconnected', () => {
    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState({ connection: { state: 'disconnected' } as never })}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    // Schema Registry doesn't require a Kafka broker connection
    expect(screen.getByTestId('schema-registry-page')).toBeTruthy();
  });

  it('renders URL prompt when connected but URL blank', () => {
    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    expect(screen.getByTestId('url-prompt')).toBeTruthy();
    expect(screen.getByText('Enter a Schema Registry URL to begin browsing.')).toBeTruthy();
    expect(screen.getByTestId('registry-connect-btn').hasAttribute('disabled')).toBe(true);
  });

  it('subject list renders after load', async () => {
    mockDispatch.mockResolvedValueOnce({
      data: { subjects: ['orders.created-value', 'payments.settled-value'] },
    });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);

    await waitFor(() => {
      expect(screen.getByTestId('subject-table')).toBeTruthy();
    });

    expect(screen.getByText('orders.created-value')).toBeTruthy();
    expect(screen.getByText('payments.settled-value')).toBeTruthy();
    expect(screen.getByText('2 of 2 subjects')).toBeTruthy();
  });

  it('clicking subject populates detail panel', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['orders.created-value'] } })
      .mockResolvedValueOnce({ data: { subject: 'orders.created-value', versions: [1, 2] } })
      .mockResolvedValueOnce({
        data: {
          subject: 'orders.created-value',
          version: 2,
          id: 5,
          schema: '{"type":"record","name":"OrderCreated","fields":[]}',
          schemaType: 'AVRO',
        },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);

    await waitFor(() => {
      expect(screen.getByText('orders.created-value')).toBeTruthy();
    });

    await selectSubjectAndWaitForSchema('orders.created-value');

    expect(screen.getByTestId('schema-detail-panel')).toBeTruthy();
    expect(screen.getByTestId('version-select')).toBeTruthy();
  });

  it('version dropdown switches schema content', async () => {
    const schemaV1 = '{"type":"record","name":"V1","fields":[]}';
    const schemaV2 = '{"type":"record","name":"V2","fields":[{"name":"id","type":"int"}]}';

    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['s1'] } })
      .mockResolvedValueOnce({ data: { subject: 's1', versions: [1, 2] } })
      .mockResolvedValueOnce({
        data: { subject: 's1', version: 2, id: 2, schema: schemaV2, schemaType: 'AVRO' },
      })
      .mockResolvedValueOnce({
        data: { subject: 's1', version: 1, id: 1, schema: schemaV1, schemaType: 'AVRO' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('s1')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('s1');

    expect(screen.getByTestId('schema-content').textContent).toContain('V2');

    selectOption(screen.getByTestId('version-select'), 'v1');

    await waitFor(() => {
      expect(screen.getByTestId('schema-content').textContent).toContain('V1');
    });
  });

  it('[Copy Schema] copies raw schema string to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['s1'] } })
      .mockResolvedValueOnce({ data: { subject: 's1', versions: [1] } })
      .mockResolvedValueOnce({
        data: { subject: 's1', version: 1, id: 1, schema: '{"type":"record","name":"CopyMe","fields":[]}', schemaType: 'AVRO' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('s1')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('s1');

    fireEvent.click(screen.getByTestId('copy-schema-btn'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('{"type":"record","name":"CopyMe","fields":[]}');
    });
  });

  it('[Export] triggers download with correct filename', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const appendSpy = vi.spyOn(document.body, 'appendChild');

    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['my.subject'] } })
      .mockResolvedValueOnce({ data: { subject: 'my.subject', versions: [3] } })
      .mockResolvedValueOnce({
        data: { subject: 'my.subject', version: 3, id: 10, schema: '{"type":"record"}', schemaType: 'AVRO' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('my.subject')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('my.subject');

    fireEvent.click(screen.getByTestId('export-schema-btn'));

    const anchor = appendSpy.mock.calls.find(([el]) => (el as HTMLElement).tagName === 'A');
    expect(anchor).toBeDefined();
    const a = anchor![0] as HTMLAnchorElement;
    expect(a.download).toBe('my.subject-v3.json');

    appendSpy.mockRestore();
  });

  it('[Export] uses .proto extension for Protobuf schemas', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const appendSpy = vi.spyOn(document.body, 'appendChild');

    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['proto-subj'] } })
      .mockResolvedValueOnce({ data: { subject: 'proto-subj', versions: [1] } })
      .mockResolvedValueOnce({
        data: { subject: 'proto-subj', version: 1, id: 7, schema: 'syntax = "proto3";', schemaType: 'PROTOBUF' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('proto-subj')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('proto-subj');

    fireEvent.click(screen.getByTestId('export-schema-btn'));

    const anchor = appendSpy.mock.calls.find(([el]) => (el as HTMLElement).tagName === 'A');
    expect(anchor).toBeDefined();
    const a = anchor![0] as HTMLAnchorElement;
    expect(a.download).toBe('proto-subj-v1.proto');

    appendSpy.mockRestore();
  });

  it('format badge shows "Avro" when schemaType is AVRO', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['avro-subj'] } })
      .mockResolvedValueOnce({ data: { subject: 'avro-subj', versions: [1] } })
      .mockResolvedValueOnce({
        data: { subject: 'avro-subj', version: 1, id: 1, schema: '{"type":"record"}', schemaType: 'AVRO' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('avro-subj')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('avro-subj');

    expect(screen.getByTestId('detail-format-badge').textContent).toBe('Avro');
  });

  it('format badge shows "Protobuf" when schemaType is PROTOBUF', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['pb'] } })
      .mockResolvedValueOnce({ data: { subject: 'pb', versions: [1] } })
      .mockResolvedValueOnce({
        data: { subject: 'pb', version: 1, id: 1, schema: 'syntax = "proto3";', schemaType: 'PROTOBUF' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('pb')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('pb');

    expect(screen.getByTestId('detail-format-badge').textContent).toBe('Protobuf');
  });

  it('format badge shows "JSON Schema" when schemaType is JSON', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['js'] } })
      .mockResolvedValueOnce({ data: { subject: 'js', versions: [1] } })
      .mockResolvedValueOnce({
        data: { subject: 'js', version: 1, id: 1, schema: '{"$schema":"http://json-schema.org/draft-07/schema#"}', schemaType: 'JSON' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('js')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('js');

    expect(screen.getByTestId('detail-format-badge').textContent).toBe('JSON Schema');
  });

  it('format badge fallback for empty schemaType with non-JSON content', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['unknown-fmt'] } })
      .mockResolvedValueOnce({ data: { subject: 'unknown-fmt', versions: [1] } })
      .mockResolvedValueOnce({
        data: { subject: 'unknown-fmt', version: 1, id: 1, schema: 'syntax = "proto3";', schemaType: '' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('unknown-fmt')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('unknown-fmt');

    // Empty schemaType + non-JSON content → content-sniffing fallback detects protobuf
    expect(screen.getByTestId('detail-format-badge').textContent).toBe('Protobuf');
  });

  it('shows loading state when kafkaState.loaded is false', () => {
    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState({ loaded: false })}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );
    expect(screen.getByText('Loading Kafka settings…')).toBeTruthy();
  });

  it('shows subjects error banner when subjects fetch fails', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('Connection refused'));

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    fireEvent.change(screen.getByTestId('registry-url-input'), {
      target: { value: 'http://localhost:8085' },
    });
    fireEvent.click(screen.getByTestId('registry-connect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('subjects-error').textContent).toContain('Connection refused');
    });
  });

  it('updates auth username when typed', async () => {
    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );
    const userInput = screen.getByTestId('registry-auth-user');
    fireEvent.change(userInput, { target: { value: 'admin' } });
    expect((userInput as HTMLInputElement).value).toBe('admin');
  });

  it('updates auth password when typed', async () => {
    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );
    const passInput = screen.getByTestId('registry-auth-pass');
    fireEvent.change(passInput, { target: { value: 'secret' } });
    expect((passInput as HTMLInputElement).value).toBe('secret');
  });

  it('prettyPrintSchema returns raw string when JSON parse throws', async () => {
    // Trigger prettyPrintSchema with a bad JSON Avro-like schema
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['bad-json'] } })
      .mockResolvedValueOnce({ data: { subject: 'bad-json', versions: [1] } })
      .mockResolvedValueOnce({
        data: { subject: 'bad-json', version: 1, id: 1, schema: 'not-valid-json}', schemaType: 'AVRO' },
      });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('bad-json')).toBeTruthy(); });
    await selectSubjectAndWaitForSchema('bad-json');
    // Raw schema returned as-is when JSON.parse fails
    expect(screen.getByTestId('schema-content').textContent).toContain('not-valid-json}');
  });

  it('shows "No subjects match the filter" when filter excludes all subjects', async () => {
    // Covers line 182: reg.subjects.length > 0 but filteredSubjects.length === 0
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['orders.v1', 'payments.v1'] } });

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('orders.v1')).toBeTruthy(); });

    // Apply a filter that matches nothing
    fireEvent.change(screen.getByTestId('subject-filter'), {
      target: { value: 'zzz-no-match' },
    });

    await waitFor(() => {
      expect(screen.getByText('No subjects match the filter')).toBeTruthy();
    });
  });

  it('shows versions error banner when versions fetch fails', async () => {
    // Covers the `{reg.versionsError && <div data-testid="versions-error">}` branch
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['orders.v1'] } })
      .mockRejectedValueOnce(new Error('version fetch error'));

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('orders.v1')).toBeTruthy(); });
    fireEvent.click(screen.getByTestId('subject-row-orders.v1'));

    await waitFor(() => {
      expect(screen.getByTestId('versions-error')).toBeTruthy();
    });
  });

  it('shows schema error banner when schema detail fetch fails', async () => {
    // Covers the `{reg.schemaError && <div data-testid="schema-error">}` branch
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['orders.v1'] } })
      .mockResolvedValueOnce({ data: { subject: 'orders.v1', versions: [1, 2] } })
      .mockRejectedValueOnce(new Error('schema fetch error'));

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('orders.v1')).toBeTruthy(); });
    fireEvent.click(screen.getByTestId('subject-row-orders.v1'));

    await waitFor(() => {
      expect(screen.getByTestId('schema-error')).toBeTruthy();
    });
  });

  it('version select value uses empty string when selectedVersion is null', async () => {
    // Covers the `reg.selectedVersion ?? ""` null-coalescing fallback (line 245)
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['topic-v1'] } })
      .mockResolvedValueOnce({ data: { subject: 'topic-v1', versions: [] } }); // empty versions

    render(
      <KafkaSchemaRegistryPage
        kafkaState={makeKafkaState()}
        onNavigateToKafkaSettings={vi.fn()}
        deps={{ dispatch: mockDispatch }}
      />,
    );

    await connectAndLoad(mockDispatch);
    await waitFor(() => { expect(screen.getByText('topic-v1')).toBeTruthy(); });
    fireEvent.click(screen.getByTestId('subject-row-topic-v1'));

    // Version list loaded but is empty → selectedVersion is null → select value = ''
    await waitFor(() => {
      expect(getCustomSelectValue(screen.getByTestId('version-select'))).toBe('');
    });
  });
});

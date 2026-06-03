/**
 * @vitest-environment jsdom
 * Phase 10C — Unit tests for KafkaSchemaConfigSection
 */

import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import KafkaSchemaConfigSection from './KafkaSchemaConfigSection';
import type { KafkaSchemaConfig } from '../../../../shared/kafka/kafkaClient';
import * as kafkaClientModule from '../../../../shared/kafka/kafkaClient';

// ── Mock dispatchKafkaOperation ──────────────────────────────────────────────

vi.mock('../../../../shared/kafka/kafkaClient', async (importOriginal) => {
  const actual = await importOriginal<typeof kafkaClientModule>();
  return { ...actual, dispatchKafkaOperation: vi.fn() };
});

const mockDispatch = vi.mocked(kafkaClientModule.dispatchKafkaOperation);

// ── Helpers ──────────────────────────────────────────────────────────────────

function Host({
  initial = undefined,
  topic = 'orders',
}: {
  initial?: KafkaSchemaConfig;
  topic?: string;
}) {
  const [value, setValue] = useState<KafkaSchemaConfig | undefined>(initial);
  return (
    <div>
      <KafkaSchemaConfigSection value={value} onChange={setValue} topic={topic} />
      <pre data-testid="output">{JSON.stringify(value)}</pre>
    </div>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('KafkaSchemaConfigSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toggle checkbox', () => {
    render(<Host />);
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('shows no fields when disabled (default)', () => {
    render(<Host />);
    expect(screen.queryByPlaceholderText(/http:\/\/schema-registry/)).toBeNull();
  });

  it('shows fields when enabled via toggle', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByPlaceholderText(/http:\/\/schema-registry/)).toBeTruthy();
  });

  it('sets schemaConfig with default avro format when enabled', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('checkbox'));
    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output).toMatchObject({ format: 'avro', registryUrl: '' });
  });

  it('sets schemaConfig to undefined when disabled', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://localhost:8081', format: 'avro' };
    render(<Host initial={initial} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByTestId('output').textContent).toBe('');
  });

  it('updates registryUrl field', () => {
    const initial: KafkaSchemaConfig = { registryUrl: '', format: 'avro' };
    render(<Host initial={initial} />);
    fireEvent.change(screen.getByPlaceholderText(/http:\/\/schema-registry/), {
      target: { value: 'http://registry:8081' },
    });
    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.registryUrl).toBe('http://registry:8081');
  });

  it('updates format field', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    render(<Host initial={initial} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'protobuf' } });
    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.format).toBe('protobuf');
  });

  it('renders topic-derived subject placeholder', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    render(<Host initial={initial} topic="my-topic" />);
    expect(screen.getByPlaceholderText('my-topic-value (default)')).toBeTruthy();
  });

  it('loads subjects from registry when ↓ button is clicked', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-subjects',
      data: { subjects: ['orders-value', 'payments-value'] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);
    const buttons = screen.getAllByRole('button');
    // First ↓ button is for subjects, second is for versions
    const subjectBtn = buttons.find((b) => b.textContent === '↓' && b.title?.includes('ubject'));
    fireEvent.click(subjectBtn!);

    await waitFor(() => {
      expect(screen.getByText('orders-value')).toBeTruthy();
    });
    expect(mockDispatch).toHaveBeenCalledWith('schema-subjects', expect.anything());
  });

  it('shows subjects error on dispatch failure', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    mockDispatch.mockRejectedValueOnce(new Error('registry down'));

    render(<Host initial={initial} />);
    const buttons = screen.getAllByRole('button');
    const subjectBtn = buttons.find((b) => b.title?.includes('ubject'));
    fireEvent.click(subjectBtn!);

    await waitFor(() => {
      expect(screen.getByText(/registry down/i)).toBeTruthy();
    });
  });

  it('stores username/password in auth when typed', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    render(<Host initial={initial} />);

    fireEvent.change(screen.getByPlaceholderText('schema-user'), { target: { value: 'alice' } });
    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.auth?.username).toBe('alice');
  });

  it('clears auth when username and password are both empty', () => {
    const initial: KafkaSchemaConfig = {
      registryUrl: 'http://r:8081',
      format: 'avro',
      auth: { username: 'alice', password: 'secret' },
    };
    render(<Host initial={initial} />);

    fireEvent.change(screen.getByPlaceholderText('schema-user'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('secret'), { target: { value: '' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.auth).toBeUndefined();
  });

  it('loads versions from registry when ↓ button is clicked for version', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-versions',
      data: { subject: 'orders-value', versions: [1, 2, 3] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);
    const buttons = screen.getAllByRole('button');
    const versionBtn = buttons.find((b) => b.textContent === '↓' && b.title?.includes('ersion'));
    fireEvent.click(versionBtn!);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });
    expect(mockDispatch).toHaveBeenCalledWith('schema-versions', expect.anything());
  });

  it('shows versions error on dispatch failure', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockRejectedValueOnce(new Error('registry unreachable'));

    render(<Host initial={initial} />);
    const buttons = screen.getAllByRole('button');
    const versionBtn = buttons.find((b) => b.title?.includes('ersion'));
    fireEvent.click(versionBtn!);

    await waitFor(() => {
      expect(screen.getByText(/registry unreachable/i)).toBeTruthy();
    });
  });
});

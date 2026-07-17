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
    resetAllMocks();
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
    expect(screen.getByPlaceholderText('my-topic-value')).toBeTruthy();
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

    fireEvent.change(screen.getByTestId('schema-username'), { target: { value: 'alice' } });
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

    fireEvent.change(screen.getByTestId('schema-username'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('schema-password'), { target: { value: '' } });

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

  it('updates subject input field by typing', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    render(<Host initial={initial} />);

    const subjectInput = screen.getByPlaceholderText('orders-value');
    fireEvent.change(subjectInput, { target: { value: 'my-topic-value' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.subject).toBe('my-topic-value');
  });

  it('clears subject when input is cleared', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'existing' };
    render(<Host initial={initial} />);

    const subjectInput = screen.getByDisplayValue('existing');
    fireEvent.change(subjectInput, { target: { value: '' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.subject).toBeUndefined();
  });

  it('updates version number input by typing', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    render(<Host initial={initial} />);

    const versionInput = screen.getByPlaceholderText('latest');
    fireEvent.change(versionInput, { target: { value: '5' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.version).toBe(5);
  });

  it('clears version when version input is cleared', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', version: 3 };
    render(<Host initial={initial} />);

    const versionInput = screen.getByDisplayValue('3');
    fireEvent.change(versionInput, { target: { value: '' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.version).toBeUndefined();
  });

  it('selects a subject from the loaded dropdown and patches subject', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-subjects',
      data: { subjects: ['orders-value', 'payments-value'] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);

    const subjectBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ubject'));
    fireEvent.click(subjectBtn!);

    await waitFor(() => {
      expect(screen.getByText('orders-value')).toBeTruthy();
    });

    // Select 'payments-value' from the dropdown
    const select = screen.getAllByRole('listbox')[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'payments-value' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.subject).toBe('payments-value');
  });

  it('clears subject when (default) option selected from subject dropdown', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-subjects',
      data: { subjects: ['orders-value'] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);

    const subjectBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ubject'));
    fireEvent.click(subjectBtn!);

    await waitFor(() => {
      expect(screen.getByText('orders-value')).toBeTruthy();
    });

    const select = screen.getAllByRole('listbox')[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.subject).toBeUndefined();
  });

  it('selects a version from the loaded dropdown and patches version', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-versions',
      data: { subject: 'orders-value', versions: [1, 2, 3] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);

    const versionBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ersion'));
    fireEvent.click(versionBtn!);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeTruthy();
    });

    const listboxes = screen.getAllByRole('listbox');
    const versionSelect = listboxes[listboxes.length - 1] as HTMLSelectElement;
    fireEvent.change(versionSelect, { target: { value: '2' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.version).toBe(2);
  });

  it('clears version when (latest) option selected from version dropdown', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value', version: 3 };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-versions',
      data: { subject: 'orders-value', versions: [1, 2, 3] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);

    const versionBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ersion'));
    fireEvent.click(versionBtn!);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeTruthy();
    });

    const listboxes = screen.getAllByRole('listbox');
    const versionSelect = listboxes[listboxes.length - 1] as HTMLSelectElement;
    fireEvent.change(versionSelect, { target: { value: '' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.version).toBeUndefined();
  });
});

// ─── Additional branch coverage ───────────────────────────────────────────────

describe('KafkaSchemaConfigSection — additional branch coverage', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('subject toggle: hides subject list when button clicked a second time (subjects.length > 0 branch)', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-subjects',
      data: { subjects: ['orders-value', 'payments-value'] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);

    const btns = screen.getAllByRole('button');
    const subjectBtn = btns.find((b) => b.title?.includes('subject'));
    // First click: load subjects
    fireEvent.click(subjectBtn!);
    await waitFor(() => expect(screen.getByText('orders-value')).toBeTruthy());

    // Second click: hide subjects (subjects.length > 0 → setSubjects([]))
    fireEvent.click(subjectBtn!);
    await waitFor(() => expect(screen.queryByText('orders-value')).toBeNull());
  });

  it('subject select option with empty value → clears subject and defaults to topic-name-value', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-subjects',
      data: { subjects: ['orders-value'] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);

    const btns = screen.getAllByRole('button');
    const subjectBtn = btns.find((b) => b.title?.includes('subject'));
    fireEvent.click(subjectBtn!);
    await waitFor(() => expect(screen.getByText('orders-value')).toBeTruthy());

    // Select the default (empty) option — clears subject
    const listboxes = screen.getAllByRole('listbox');
    fireEvent.change(listboxes[0] as HTMLSelectElement, { target: { value: '' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.subject).toBeUndefined();
  });

  it('subjects default option shows "topic-value" when no topic prop', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-subjects',
      data: { subjects: ['a-value'] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    // Render with empty topic
    render(<Host initial={initial} topic="" />);

    const btns = screen.getAllByRole('button');
    const subjectBtn = btns.find((b) => b.title?.includes('subject'));
    fireEvent.click(subjectBtn!);
    await waitFor(() => expect(screen.getByText('a-value')).toBeTruthy());

    // Default option text includes 'topic-value' fallback
    expect(screen.getByText('(default — topic-value)')).toBeTruthy();
  });

  it('version toggle: hides version list when button clicked a second time', async () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-versions',
      data: { subject: 'orders-value', versions: [1, 2, 3] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);

    const btns = screen.getAllByRole('button');
    const versionBtn = btns.find((b) => b.title?.includes('ersion'));
    // First click: load versions
    fireEvent.click(versionBtn!);
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());

    // Second click: hide versions (versions.length > 0 → setVersions([]))
    fireEvent.click(versionBtn!);
    await waitFor(() => expect(screen.queryByText('3')).toBeNull());
  });

  it('subject input change with empty string clears subject to undefined', () => {
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    render(<Host initial={initial} />);

    const subjectInput = screen.getAllByRole('textbox').find(
      (i) => (i as HTMLInputElement).placeholder?.includes('value'),
    );
    fireEvent.change(subjectInput!, { target: { value: '' } });

    const output = JSON.parse(screen.getByTestId('output').textContent!);
    expect(output.subject).toBeUndefined();
  });

  it('loadSubjects: early-return when registryUrl is empty (button is disabled but fireEvent still fires)', async () => {
    // Covers the `if (!value?.registryUrl?.trim()) return;` branch in loadSubjects
    const initial: KafkaSchemaConfig = { registryUrl: '', format: 'avro' };
    render(<Host initial={initial} topic="orders" />);

    const btn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('title')?.includes('Load subjects'),
    );
    // In jsdom, fireEvent.click fires even on a disabled button — but since
    // registryUrl is empty, loadSubjects should early-return without calling dispatch
    fireEvent.click(btn!);

    // dispatch must NOT have been called
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('loadVersions: early-return when subject is empty and topic is also empty', async () => {
    // Covers the `if (!subject) return;` branch in loadVersions
    // registryUrl is set so the button is enabled, but subject + topic are both empty
    const initial: KafkaSchemaConfig = { registryUrl: 'http://reg:8081', format: 'avro' };
    render(<Host initial={initial} topic="" />);

    const btn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('title')?.includes('Load versions'),
    );
    fireEvent.click(btn!);

    // dispatch must NOT have been called because derived subject is ''
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('loadSubjects: uses empty array fallback when envelope.data.subjects is undefined', async () => {
    // Covers the `envelope.data?.subjects ?? []` null-coalescing fallback (line 91)
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-subjects',
      data: {}, // no subjects key → subjects is undefined → ?? [] fires
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);
    const subjectBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ubject'));
    fireEvent.click(subjectBtn!);

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith('schema-subjects', expect.anything()));
    // subjects list is empty (fallback [] was used) — the subject select has no data options
    // (only the default empty option from the format select or similar)
    expect(screen.queryByTestId('subject-option')).toBeNull();
  });

  it('loadSubjects: catch uses fallback message when thrown value is not an Error', async () => {
    // Covers the `err instanceof Error ? ... : 'Failed to load subjects'` false branch (line 93)
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro' };
    mockDispatch.mockRejectedValueOnce('non-error string thrown');

    render(<Host initial={initial} />);
    const subjectBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ubject'));
    fireEvent.click(subjectBtn!);

    await waitFor(() => expect(screen.getByText('Failed to load subjects')).toBeTruthy());
  });

  it('loadVersions: catch uses fallback message when thrown value is not an Error', async () => {
    // Covers the `err instanceof Error ? ... : 'Failed to load versions'` false branch
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockRejectedValueOnce({ code: 42 }); // non-Error object

    render(<Host initial={initial} />);
    const versionBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ersion'));
    fireEvent.click(versionBtn!);

    await waitFor(() => expect(screen.getByText('Failed to load versions')).toBeTruthy());
  });

  it('loadVersions: uses empty array fallback when envelope.data.versions is undefined', async () => {
    // Covers the `envelope.data?.versions ?? []` null-coalescing fallback
    const initial: KafkaSchemaConfig = { registryUrl: 'http://r:8081', format: 'avro', subject: 'orders-value' };
    mockDispatch.mockResolvedValueOnce({
      ok: true,
      op: 'schema-versions',
      data: {}, // no versions key → versions is undefined → ?? [] fires
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    render(<Host initial={initial} />);
    const versionBtn = screen.getAllByRole('button').find((b) => b.title?.includes('ersion'));
    fireEvent.click(versionBtn!);

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith('schema-versions', expect.anything()));
    // no versions rendered
    expect(screen.queryByTestId('version-select')).toBeNull();
  });

  it('handleToggle disable clears subjects/versions/errors state when subjects were loaded', async () => {
    // Covers the setSubjects([]), setVersions([]), setSubjectsError(null), setVersionsError(null)
    // branches inside handleToggle(false) when subjects/versions are non-empty
    mockDispatch.mockResolvedValueOnce({
      ok: true, data: { subjects: ['s1', 's2'] },
    } as Awaited<ReturnType<typeof kafkaClientModule.dispatchKafkaOperation>>);

    const initial: KafkaSchemaConfig = { registryUrl: 'http://reg:8081', format: 'avro' };
    render(<Host initial={initial} topic="orders" />);

    // Load subjects first
    const loadBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('title')?.includes('Load subjects'),
    );
    fireEvent.click(loadBtn!);
    await waitFor(() => expect(screen.getByText('s1')).toBeTruthy());

    // Now uncheck the toggle to disable → handleToggle(false) clears subjects state
    fireEvent.click(screen.getByRole('checkbox'));

    // schema config is cleared
    expect(screen.getByTestId('output').textContent).toBe('');
  });
});

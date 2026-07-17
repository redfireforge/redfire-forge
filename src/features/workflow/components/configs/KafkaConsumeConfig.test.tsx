/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import KafkaConsumeConfig from './KafkaConsumeConfig';
import type { KafkaConsumeNodeData } from '../../types/workflow';

vi.mock('../expression/InsertVarField');

function makeData(overrides: Partial<KafkaConsumeNodeData> = {}): KafkaConsumeNodeData {
  return {
    label: 'Kafka Consume',
    clusterId: 'cluster-a',
    topic: 'orders',
    ...overrides,
  } as KafkaConsumeNodeData;
}

function Host({ initial = makeData() }: { initial?: KafkaConsumeNodeData }) {
  const [data, setData] = useState(initial);
  return <KafkaConsumeConfig data={data} onChange={setData} onRequestVariableInsert={vi.fn()} variableHints={[{ ref: 'token', label: 'Token' }]} />;
}

describe('KafkaConsumeConfig', () => {
  it('updates the draft when fields change', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('Kafka Consume'), { target: { value: 'Kafka Reader' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Kafka Reader' }));
  });

  it('updates clusterId and topic fields', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('cluster-a'), { target: { value: 'cluster-b' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clusterId: 'cluster-b' }));

    fireEvent.change(screen.getByDisplayValue('orders'), { target: { value: 'payments' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ topic: 'payments' }));
  });

  it('updates timeoutMs when number input changes', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByPlaceholderText('30000'), { target: { value: '5000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
  });

  it('sets timeoutMs to undefined when cleared', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData({ timeoutMs: 5000 })} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));
  });

  it('updates maxMessages when number input changes', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxMessages: 10 }));
  });

  it('sets maxMessages to undefined when cleared', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData({ maxMessages: 5 })} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxMessages: undefined }));
  });

  it('updates start position dropdown', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('Latest'), { target: { value: 'earliest' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ startPosition: 'earliest' }));
  });

  it('adds header filter rows', () => {
    render(<Host />);

    fireEvent.click(screen.getAllByRole('button', { name: '+ Add' })[0]);
    expect(screen.getAllByPlaceholderText('Header name')).toHaveLength(1);
  });

  it('updates header filter key', () => {
    render(<Host initial={makeData({ headerFilters: [{ id: 'h1', key: 'x-req', value: 'abc', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('x-req'), { target: { value: 'x-trace' } });
    expect(screen.getByDisplayValue('x-trace')).toBeTruthy();
  });

  it('toggles header filter enabled', () => {
    render(<Host initial={makeData({ headerFilters: [{ id: 'h1', key: 'x', value: 'y', enabled: true }] })} />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('removes header filter row', () => {
    render(<Host initial={makeData({ headerFilters: [{ id: 'h1', key: 'x-key', value: 'val', enabled: true }] })} />);

    expect(screen.getByDisplayValue('x-key')).toBeTruthy();
    const removeBtn = screen.getAllByRole('button', { name: '×' })[0];
    fireEvent.click(removeBtn);
    expect(screen.queryByDisplayValue('x-key')).toBeNull();
  });

  it('adds JSONPath filter rows', () => {
    render(<Host />);

    fireEvent.click(screen.getAllByRole('button', { name: '+ Add' })[1]);
    expect(screen.getByPlaceholderText('$.payload.id')).toBeTruthy();
  });

  it('updates JSONPath filter jsonPath', () => {
    render(<Host initial={makeData({ jsonPathFilters: [{ id: 'j1', jsonPath: '$.id', expectedValue: '42', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('$.id'), { target: { value: '$.status' } });
    expect(screen.getByDisplayValue('$.status')).toBeTruthy();
  });

  it('toggles JSONPath filter enabled', () => {
    render(<Host initial={makeData({ jsonPathFilters: [{ id: 'j1', jsonPath: '$.id', expectedValue: '1', enabled: true }] })} />);

    const checkboxes = screen.getAllByRole('checkbox');
    const check = checkboxes[0];
    fireEvent.click(check);
    expect((check as HTMLInputElement).checked).toBe(false);
  });

  it('removes JSONPath filter row', () => {
    render(<Host initial={makeData({ jsonPathFilters: [{ id: 'j1', jsonPath: '$.order', expectedValue: '5', enabled: true }] })} />);

    expect(screen.getByDisplayValue('$.order')).toBeTruthy();
    const removeBtn = screen.getAllByRole('button', { name: '×' })[0];
    fireEvent.click(removeBtn);
    expect(screen.queryByDisplayValue('$.order')).toBeNull();
  });

  it('adds output binding rows', () => {
    render(<Host />);

    fireEvent.click(screen.getAllByRole('button', { name: '+ Add' })[2]);
    expect(screen.getByPlaceholderText('targetVariable')).toBeTruthy();
  });

  it('updates output binding source', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'topic', targetVariable: 'myVar', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('topic'), { target: { value: 'partition' } });
    expect(screen.getByDisplayValue('partition')).toBeTruthy();
  });

  it('updates output binding targetVariable', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'topic', targetVariable: 'myVar', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('myVar'), { target: { value: 'kafkaTopic' } });
    expect(screen.getByDisplayValue('kafkaTopic')).toBeTruthy();
  });

  it('toggles output binding enabled', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'key', targetVariable: 'kv', enabled: true }] })} />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('removes output binding row', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'offset', targetVariable: 'off', enabled: true }] })} />);

    expect(screen.getByDisplayValue('off')).toBeTruthy();
    const removeBtn = screen.getAllByRole('button', { name: '×' })[0];
    fireEvent.click(removeBtn);
    expect(screen.queryByDisplayValue('off')).toBeNull();
  });

  it('reveals load-test fields when synthetic mode is selected', () => {
    render(<Host />);

    fireEvent.change(screen.getByDisplayValue('Wait for real'), { target: { value: 'synthetic-inject' } });
    expect(screen.getByLabelText('Mock Payload')).toBeTruthy();
    expect(screen.getByLabelText('Synthetic Delay (ms)')).toBeTruthy();
    expect(screen.getByLabelText('Synthetic Jitter (ms)')).toBeTruthy();
  });

  it('shows mock payload textarea in auto-resume mode', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'auto-resume' } })} />);
    expect(screen.getByLabelText('Mock Payload')).toBeTruthy();
    expect(screen.queryByLabelText('Synthetic Delay (ms)')).toBeNull();
  });

  it('hides mock payload textarea in wait-for-real mode', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'wait-for-real' } })} />);
    expect(screen.queryByLabelText('Mock Payload')).toBeNull();
  });

  it('updates mock payload when valid JSON is typed', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'auto-resume', mockPayload: { key: 'val' } } })} />);

    const textarea = screen.getByLabelText('Mock Payload');
    fireEvent.change(textarea, { target: { value: '{"status":"ok"}' } });
    // Component re-formats valid JSON via JSON.stringify(…, null, 2)
    expect((textarea as HTMLTextAreaElement).value).toBe('{\n  "status": "ok"\n}');
  });

  it('keeps text draft when invalid JSON is typed in mock payload', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'synthetic-inject' } })} />);

    const textarea = screen.getByLabelText('Mock Payload');
    fireEvent.change(textarea, { target: { value: '{invalid' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('{invalid');
  });

  it('updates synthetic delay', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'synthetic-inject', syntheticDelayMs: 500 } })} />);

    fireEvent.change(screen.getByLabelText('Synthetic Delay (ms)'), { target: { value: '1000' } });
    expect((screen.getByLabelText('Synthetic Delay (ms)') as HTMLInputElement).value).toBe('1000');
  });

  it('clears synthetic delay when input is emptied', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'synthetic-inject', syntheticDelayMs: 500 } })} />);

    fireEvent.change(screen.getByLabelText('Synthetic Delay (ms)'), { target: { value: '' } });
    expect((screen.getByLabelText('Synthetic Delay (ms)') as HTMLInputElement).value).toBe('');
  });

  it('updates synthetic jitter', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'synthetic-inject', syntheticJitterMs: 100 } })} />);

    fireEvent.change(screen.getByLabelText('Synthetic Jitter (ms)'), { target: { value: '200' } });
    expect((screen.getByLabelText('Synthetic Jitter (ms)') as HTMLInputElement).value).toBe('200');
  });

  it('switches load test mode to auto-resume', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('Wait for real'), { target: { value: 'auto-resume' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      loadTestBehavior: expect.objectContaining({ mode: 'auto-resume' }),
    }));
  });

  it('inserts snippet into header filter value via onInsert callback', () => {
    render(<Host initial={makeData({ headerFilters: [{ id: 'h1', key: 'x', value: 'base-', enabled: true }] })} />);

    const applyBtns = screen.getAllByTestId('insert-var-apply');
    // Index 0 = keyRegex, Index 1 = header row value
    fireEvent.click(applyBtns[1]);
    expect(screen.getByDisplayValue('base-{{snippet}}')).toBeTruthy();
  });

  it('inserts snippet into JSONPath filter expectedValue via onInsert callback', () => {
    render(<Host initial={makeData({ jsonPathFilters: [{ id: 'j1', jsonPath: '$.id', expectedValue: 'val-', enabled: true }] })} />);

    const applyBtns = screen.getAllByTestId('insert-var-apply');
    // Index 0 = keyRegex, Index 1 = jsonPath row expectedValue
    fireEvent.click(applyBtns[1]);
    expect(screen.getByDisplayValue('val-{{snippet}}')).toBeTruthy();
  });

  it('inserts snippet into keyRegex via onInsert callback', () => {
    render(<Host initial={makeData({ keyRegex: 'prefix-' })} />);

    const applyBtns = screen.getAllByTestId('insert-var-apply');
    // Index 0 = keyRegex
    fireEvent.click(applyBtns[0]);
    expect(screen.getByDisplayValue('prefix-{{snippet}}')).toBeTruthy();
  });

  it('renders the Enable Schema Registry section', () => {
    render(<Host />);
    expect(screen.getByText('Enable Schema Registry')).toBeTruthy();
  });

  it('passes schemaConfig to onChange when schema registry is enabled', () => {
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    // The schema registry checkbox is the last checkbox in the form (no filter/binding rows by default)
    const schemaCheckbox = screen.getAllByRole('checkbox').at(-1) as HTMLInputElement;
    fireEvent.click(schemaCheckbox);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ schemaConfig: { registryUrl: '', format: 'avro' } }),
    );
  });

  it('updates keyRegex via ExpressionInput onChange', () => {
    // Covers line 104: onChange={(value) => update({ keyRegex: value })}
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const keyRegexInput = screen.getByPlaceholderText('Optional regex filter') as HTMLInputElement;
    fireEvent.change(keyRegexInput, { target: { value: 'order-.*' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keyRegex: 'order-.*' }));
  });

  it('updates header filter value via ExpressionInput onChange', () => {
    // Covers line 130: onChange={(value) => headerCrud.update(index, { value })}
    const onChange = vi.fn();
    render(<KafkaConsumeConfig
      data={makeData({ headerFilters: [{ id: 'h1', key: 'x-type', value: 'old', enabled: true }] })}
      onChange={onChange} variableHints={[]} />
    );
    const valueInput = screen.getByPlaceholderText('Value') as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: 'new-val' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ headerFilters: expect.arrayContaining([expect.objectContaining({ value: 'new-val' })]) }),
    );
  });

  it('updates jsonPath expectedValue via ExpressionInput onChange', () => {
    // Covers line 162: onChange={(value) => jsonPathCrud.update(index, { expectedValue: value })}
    const onChange = vi.fn();
    render(<KafkaConsumeConfig
      data={makeData({ jsonPathFilters: [{ id: 'j1', jsonPath: '$.id', expectedValue: 'old', enabled: true }] })}
      onChange={onChange} variableHints={[]} />
    );
    const expInput = screen.getByPlaceholderText('Expected value') as HTMLInputElement;
    fireEvent.change(expInput, { target: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ jsonPathFilters: expect.arrayContaining([expect.objectContaining({ expectedValue: '99' })]) }),
    );
  });

  it('inserts snippet into jsonPath expectedValue when expectedValue is undefined (null-coalescing fallback)', () => {
    // Covers the `row.expectedValue ?? ''` null-coalescing false branch (lines 157, 160)
    render(<Host initial={makeData({ jsonPathFilters: [{ id: 'j1', jsonPath: '$.id', expectedValue: undefined, enabled: true }] })} />);

    const applyBtns = screen.getAllByTestId('insert-var-apply');
    // Index 0 = keyRegex, Index 1 = jsonPath row expectedValue
    fireEvent.click(applyBtns[1]);
    // expectedValue was undefined → '' + '{{snippet}}' = '{{snippet}}'
    expect(screen.getByDisplayValue('{{snippet}}')).toBeTruthy();
  });

  it('clears synthetic jitter when jitter input is emptied', () => {
    // Covers the `e.target.value === '' ? undefined : Number(...)` empty-string branch
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'synthetic-inject', syntheticJitterMs: 100 } })} />);
    fireEvent.change(screen.getByLabelText('Synthetic Jitter (ms)'), { target: { value: '' } });
    expect((screen.getByLabelText('Synthetic Jitter (ms)') as HTMLInputElement).value).toBe('');
  });

  it('shows empty string in jitter input when syntheticJitterMs is undefined', () => {
    // Covers the `syntheticJitterMs ?? ''` null-coalescing false branch (line 240)
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'synthetic-inject', syntheticJitterMs: undefined } })} />);
    const jitter = screen.getByLabelText('Synthetic Jitter (ms)') as HTMLInputElement;
    expect(jitter.value).toBe('');
  });

  it('handleMockPayloadChange: ignores parsed JSON when it is an array (not object)', () => {
    // Covers the `!Array.isArray(parsed)` false branch — array JSON is not spread to bindings
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'auto-resume', mockPayload: null } })} />);
    const textarea = screen.getByLabelText('Mock Payload') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '[1,2,3]' } });
    // Array value is valid JSON but not an object → no crash, text stays
    expect(textarea.value).toBe('[1,2,3]');
  });

  it('handleMockPayloadChange: ignores parsed JSON when it is a primitive (number)', () => {
    // Covers the `typeof parsed === "object"` false branch
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'auto-resume', mockPayload: null } })} />);
    const textarea = screen.getByLabelText('Mock Payload') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '42' } });
    // Primitive is valid JSON but typeof is "number" not "object"
    expect(textarea.value).toBe('42');
  });

  it('passes topic as empty string to KafkaSchemaConfigSection when topic is undefined', () => {
    // Covers the `data.topic ?? ''` null-coalescing false branch
    const onChange = vi.fn();
    render(<KafkaConsumeConfig data={makeData({ topic: undefined })} onChange={onChange} variableHints={[]} />);
    expect(screen.getByText('Enable Schema Registry')).toBeTruthy();
  });
});

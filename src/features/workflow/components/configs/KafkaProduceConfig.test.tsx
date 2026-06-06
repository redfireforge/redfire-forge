/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import KafkaProduceConfig from './KafkaProduceConfig';
import type { KafkaProduceNodeData } from '../../types/workflow';

vi.mock('../expression/InsertVarField');

function makeData(overrides: Partial<KafkaProduceNodeData> = {}): KafkaProduceNodeData {
  return {
    label: 'Kafka Produce',
    clusterId: 'cluster-a',
    topic: 'orders',
    ...overrides,
  } as KafkaProduceNodeData;
}

function Host({ initial = makeData() }: { initial?: KafkaProduceNodeData }) {
  const [data, setData] = useState(initial);
  return <KafkaProduceConfig data={data} onChange={setData} onRequestVariableInsert={vi.fn()} variableHints={[{ ref: 'token', label: 'Token' }]} />;
}

describe('KafkaProduceConfig', () => {
  it('updates the draft when fields change', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('Kafka Produce'), { target: { value: 'Kafka Publish' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Kafka Publish' }));
  });

  it('updates clusterId', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('cluster-a'), { target: { value: 'cluster-b' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clusterId: 'cluster-b' }));
  });

  it('updates topic', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('orders'), { target: { value: 'payments' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ topic: 'payments' }));
  });

  it('updates partition when number input changes', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Optional'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ partition: 2 }));
  });

  it('sets partition to undefined when cleared', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData({ partition: 3 })} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ partition: undefined }));
  });

  it('updates ack mode dropdown', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('All'), { target: { value: 'leader' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ackMode: 'leader' }));
  });

  it('updates timeoutMs when number input changes', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '5000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
  });

  it('sets timeoutMs to undefined when cleared', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData({ timeoutMs: 10000 })} onChange={onChange} variableHints={[]} />);

    fireEvent.change(screen.getByDisplayValue('10000'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));
  });

  it('adds header and binding rows', () => {
    render(<Host />);

    fireEvent.click(screen.getByRole('button', { name: '+ Add Header' }));
    expect(screen.getAllByPlaceholderText('Header name')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '+ Add Binding' }));
    expect(screen.getAllByPlaceholderText('targetVariable')).toHaveLength(1);
  });

  it('updates header row key', () => {
    render(<Host initial={makeData({ headers: [{ id: 'h1', key: 'x-trace', value: 'abc', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('x-trace'), { target: { value: 'x-request-id' } });
    expect(screen.getByDisplayValue('x-request-id')).toBeTruthy();
  });

  it('updates header row value', () => {
    render(<Host initial={makeData({ headers: [{ id: 'h1', key: 'x-key', value: 'old-val', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('old-val'), { target: { value: 'new-val' } });
    expect(screen.getByDisplayValue('new-val')).toBeTruthy();
  });

  it('toggles header row enabled', () => {
    render(<Host initial={makeData({ headers: [{ id: 'h1', key: 'x', value: 'y', enabled: true }] })} />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('removes header row', () => {
    render(<Host initial={makeData({ headers: [{ id: 'h1', key: 'x-remove-me', value: 'val', enabled: true }] })} />);

    expect(screen.getByDisplayValue('x-remove-me')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '×' })[0]);
    expect(screen.queryByDisplayValue('x-remove-me')).toBeNull();
  });

  it('renders Body Template label and updates body on change', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData({ bodyTemplate: '{"msg":"hi"}' })} onChange={onChange} variableHints={[]} />);

    expect(screen.getByText('Body Template')).toBeDefined();

    fireEvent.change(screen.getByDisplayValue('{"msg":"hi"}'), { target: { value: '{"msg":"bye"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bodyTemplate: '{"msg":"bye"}' }));
  });

  it('updates output binding source', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'topic', targetVariable: 'myVar', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('topic'), { target: { value: 'offset' } });
    expect(screen.getByDisplayValue('offset')).toBeTruthy();
  });

  it('updates output binding targetVariable', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'key', targetVariable: 'myVar', enabled: true }] })} />);

    fireEvent.change(screen.getByDisplayValue('myVar'), { target: { value: 'msgKey' } });
    expect(screen.getByDisplayValue('msgKey')).toBeTruthy();
  });

  it('toggles output binding enabled', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'partition', targetVariable: 'p', enabled: true }] })} />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('removes output binding row', () => {
    render(<Host initial={makeData({ outputBindings: [{ id: 'b1', source: 'timestamp', targetVariable: 'ts', enabled: true }] })} />);

    expect(screen.getByDisplayValue('ts')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '×' })[0]);
    expect(screen.queryByDisplayValue('ts')).toBeNull();
  });

  it('inserts snippet into keyTemplate via onInsert callback', () => {
    render(<Host initial={makeData({ keyTemplate: 'prefix-' })} />);

    const applyBtns = screen.getAllByTestId('insert-var-apply');
    fireEvent.click(applyBtns[0]);
    expect(screen.getByDisplayValue('prefix-{{snippet}}')).toBeTruthy();
  });

  it('inserts snippet into header value via onInsert callback', () => {
    render(<Host initial={makeData({ headers: [{ id: 'h1', key: 'x-key', value: 'base-', enabled: true }] })} />);

    // First insert-var-apply is for keyTemplate, second is for the header row value
    const applyBtns = screen.getAllByTestId('insert-var-apply');
    fireEvent.click(applyBtns[1]);
    expect(screen.getByDisplayValue('base-{{snippet}}')).toBeTruthy();
  });

  it('inserts snippet into bodyTemplate via onInsert callback', () => {
    render(<Host initial={makeData({ bodyTemplate: 'payload-' })} />);

    const applyBtns = screen.getAllByTestId('insert-var-apply');
    // keyTemplate insert is first, bodyTemplate is second (no headers in this case)
    fireEvent.click(applyBtns[1]);
    // After insert, bodyTemplate becomes 'payload-{{snippet}}'
    expect((screen.getByDisplayValue('payload-{{snippet}}') as HTMLTextAreaElement).value).toBe('payload-{{snippet}}');
  });

  it('renders the Enable Schema Registry section', () => {
    render(<Host />);
    expect(screen.getByText('Enable Schema Registry')).toBeTruthy();
  });

  it('updates keyTemplate via ExpressionInput onChange', () => {
    // Covers line 73: onChange={(value) => update({ keyTemplate: value })}
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData({ keyTemplate: 'old-key' })} onChange={onChange} variableHints={[]} />);

    // The keyTemplate input has placeholder "e.g. {{orderId}}"
    const keyInput = screen.getByPlaceholderText('e.g. {{orderId}}') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'new-key' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ keyTemplate: 'new-key' }),
    );
  });

  it('passes schemaConfig to onChange when schema registry is enabled', () => {
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData()} onChange={onChange} variableHints={[]} />);

    // The schema registry checkbox is the last checkbox in the form (no header/binding rows by default)
    const schemaCheckbox = screen.getAllByRole('checkbox').at(-1) as HTMLInputElement;
    fireEvent.click(schemaCheckbox);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ schemaConfig: { registryUrl: '', format: 'avro' } }),
    );
  });

  it('onInsert for keyTemplate uses empty string fallback when keyTemplate is undefined', () => {
    // Covers the `data.keyTemplate ?? ''` null-coalescing false branch (line 69)
    render(<Host initial={makeData({ keyTemplate: undefined })} />);
    const applyBtns = screen.getAllByTestId('insert-var-apply');
    fireEvent.click(applyBtns[0]); // first InsertVarField is keyTemplate
    // keyTemplate was undefined → `${'' }${'{{snippet}}'}` = '{{snippet}}'
    expect(screen.getByDisplayValue('{{snippet}}')).toBeTruthy();
  });

  it('onInsert for bodyTemplate uses empty string fallback when bodyTemplate is undefined', () => {
    // Covers the `data.bodyTemplate ?? ''` null-coalescing false branch (line 132)
    render(<Host initial={makeData({ bodyTemplate: undefined })} />);
    const applyBtns = screen.getAllByTestId('insert-var-apply');
    // keyTemplate insert is index 0, bodyTemplate is index 1 (no headers)
    fireEvent.click(applyBtns[1]);
    // bodyTemplate was undefined → '' + '{{snippet}}'
    expect((screen.getByDisplayValue('{{snippet}}') as HTMLTextAreaElement).value).toBe('{{snippet}}');
  });

  it('passes topic as empty string to KafkaSchemaConfigSection when topic is undefined', () => {
    // Covers the `data.topic ?? ''` null-coalescing false branch (line 189)
    const onChange = vi.fn();
    render(<KafkaProduceConfig data={makeData({ topic: undefined })} onChange={onChange} variableHints={[]} />);
    // Component renders without crash — topic ?? '' evaluates to ''
    expect(screen.getByText('Enable Schema Registry')).toBeTruthy();
  });
});

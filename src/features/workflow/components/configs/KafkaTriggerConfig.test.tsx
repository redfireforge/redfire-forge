/**
 * @vitest-environment jsdom
 * Unit tests for KafkaTriggerConfig
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../../test-utils/customSelectHelper';
import KafkaTriggerConfig from './KafkaTriggerConfig';
import type { KafkaTriggerNodeData } from '../../types/workflow';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../expression/InsertVarField');
vi.mock('../expression/AvailableVariables');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<KafkaTriggerNodeData> = {}): KafkaTriggerNodeData {
  return {
    label: 'Kafka Trigger',
    clusterId: 'cluster-a',
    topic: 'orders.created',
    ...overrides,
  } as KafkaTriggerNodeData;
}

/** Stateful host so fireEvent changes actually reflect in re-renders */
function Host({ initial = makeData() }: { initial?: KafkaTriggerNodeData }) {
  const [data, setData] = useState(initial);
  return (
    <KafkaTriggerConfig
      data={data}
      onChange={setData}
      onRequestVariableInsert={vi.fn()}
      variableHints={[{ ref: 'orderId', label: 'Order ID' }]}
    />
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KafkaTriggerConfig', () => {
  // ── Root element ──────────────────────────────────────────────────────────
  it('renders with data-testid="kafka-trigger-config"', () => {
    render(<Host />);
    expect(screen.getByTestId('kafka-trigger-config')).toBeTruthy();
  });

  it('renders AvailableVariables', () => {
    render(<Host />);
    expect(screen.getByTestId('available-variables')).toBeTruthy();
  });

  // ── Label ─────────────────────────────────────────────────────────────────
  it('renders label input with current value', () => {
    render(<Host initial={makeData({ label: 'My Trigger' })} />);
    expect(screen.getByDisplayValue('My Trigger')).toBeTruthy();
  });

  it('calls onChange when label changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    fireEvent.change(screen.getByDisplayValue('Kafka Trigger'), { target: { value: 'Order Trigger' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Order Trigger' }));
  });

  // ── Cluster ID ────────────────────────────────────────────────────────────
  it('calls onChange when clusterId changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    fireEvent.change(screen.getByDisplayValue('cluster-a'), { target: { value: 'cluster-b' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clusterId: 'cluster-b' }));
  });

  // ── Topic ─────────────────────────────────────────────────────────────────
  it('calls onChange when topic changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    fireEvent.change(screen.getByDisplayValue('orders.created'), { target: { value: 'payments.created' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ topic: 'payments.created' }));
  });

  // ── Consumer Group ID ─────────────────────────────────────────────────────
  it('calls onChange when consumerGroupId is set', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const input = screen.getByPlaceholderText('Auto-derived from workflow + node ID');
    fireEvent.change(input, { target: { value: 'my-group' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ consumerGroupId: 'my-group' }));
  });

  it('sets consumerGroupId to undefined when cleared', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData({ consumerGroupId: 'g1' })} onChange={onChange} variableHints={[]} />);
    const input = screen.getByDisplayValue('g1');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ consumerGroupId: undefined }));
  });

  // ── Offset policy ─────────────────────────────────────────────────────────
  it('renders offset policy select defaulting to latest', () => {
    const { container } = render(<Host />);
    expect(getCustomSelectValue(container)).toBe('Latest (no replay)');
  });

  it('calls onChange when offset policy changes', () => {
    const onChange = vi.fn();
    const { container } = render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    selectOption(container, 'Earliest (replay all)');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ startPosition: 'earliest' }));
  });

  // ── Key Regex ─────────────────────────────────────────────────────────────
  it('calls onChange when keyRegex changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const input = screen.getByPlaceholderText('Optional regex filter on message key');
    fireEvent.change(input, { target: { value: '^order-.*' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keyRegex: '^order-.*' }));
  });

  it('appends inserted snippet to keyRegex', () => {
    const onChange = vi.fn();
    render(
      <KafkaTriggerConfig data={makeData({ keyRegex: '^' })} onChange={onChange} variableHints={[]} />,
    );
    // first InsertVarField wraps keyRegex
    fireEvent.click(screen.getAllByTestId('insert-var-apply')[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keyRegex: '^{{snippet}}' }));
  });

  // ── Max Concurrent Runs ───────────────────────────────────────────────────
  it('calls onChange when maxConcurrentRuns is set', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const input = screen.getByPlaceholderText('10');
    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxConcurrentRuns: 5 }));
  });

  it('sets maxConcurrentRuns to undefined when cleared', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData({ maxConcurrentRuns: 5 })} onChange={onChange} variableHints={[]} />);
    const input = screen.getByDisplayValue('5');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxConcurrentRuns: undefined }));
  });

  // ── Header Filters ────────────────────────────────────────────────────────
  it('adds a new header filter row', () => {
    render(<Host />);
    fireEvent.click(screen.getAllByText('+ Add')[0]);
    expect(screen.getByPlaceholderText('Header name')).toBeTruthy();
  });

  it('updates header filter key', () => {
    render(
      <Host
        initial={makeData({
          headerFilters: [{ id: 'h1', key: 'X-Src', value: '', enabled: true }],
        })}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('X-Src'), { target: { value: 'X-Region' } });
    expect(screen.getByDisplayValue('X-Region')).toBeTruthy();
  });

  it('updates header filter enabled checkbox', () => {
    render(
      <Host
        initial={makeData({
          headerFilters: [{ id: 'h1', key: 'X-Src', value: '', enabled: true }],
        })}
      />,
    );
    const checkbox = screen.getAllByRole('checkbox')[0];
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('removes a header filter row', () => {
    render(
      <Host
        initial={makeData({
          headerFilters: [{ id: 'h1', key: 'X-Src', value: '', enabled: true }],
        })}
      />,
    );
    expect(screen.getByDisplayValue('X-Src')).toBeTruthy();
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByDisplayValue('X-Src')).toBeNull();
  });

  it('appends snippet to header filter value via InsertVarField', () => {
    const onChange = vi.fn();
    render(
      <KafkaTriggerConfig
        data={makeData({ headerFilters: [{ id: 'h1', key: 'X-Src', value: 'prefix-', enabled: true }] })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    // InsertVarField buttons: index 0 = keyRegex, index 1 = first header value
    fireEvent.click(screen.getAllByTestId('insert-var-apply')[1]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        headerFilters: [expect.objectContaining({ value: 'prefix-{{snippet}}' })],
      }),
    );
  });

  // ── JSONPath Filters ──────────────────────────────────────────────────────
  it('adds a new JSONPath filter row', () => {
    render(<Host />);
    fireEvent.click(screen.getAllByText('+ Add')[1]);
    expect(screen.getByPlaceholderText('$.payload.type')).toBeTruthy();
  });

  it('updates JSONPath filter path and enabled state', () => {
    render(
      <Host
        initial={makeData({
          jsonPathFilters: [{ id: 'j1', jsonPath: '$.type', expectedValue: 'order', enabled: true }],
        })}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('$.type'), { target: { value: '$.status' } });
    expect(screen.getByDisplayValue('$.status')).toBeTruthy();
  });

  it('updates JSONPath filter enabled checkbox', () => {
    render(
      <Host
        initial={makeData({
          jsonPathFilters: [{ id: 'j1', jsonPath: '$.type', expectedValue: 'order', enabled: true }],
        })}
      />,
    );
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('removes a JSONPath filter row', () => {
    render(
      <Host
        initial={makeData({
          jsonPathFilters: [{ id: 'j1', jsonPath: '$.type', expectedValue: 'order', enabled: true }],
        })}
      />,
    );
    expect(screen.getByDisplayValue('$.type')).toBeTruthy();
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByDisplayValue('$.type')).toBeNull();
  });

  it('appends snippet to JSONPath filter expectedValue via InsertVarField', () => {
    const onChange = vi.fn();
    render(
      <KafkaTriggerConfig
        data={makeData({
          jsonPathFilters: [{ id: 'j1', jsonPath: '$.type', expectedValue: 'val-', enabled: true }],
        })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    // InsertVarField buttons: 0 = keyRegex, 1 = first jsonPath expectedValue
    fireEvent.click(screen.getAllByTestId('insert-var-apply')[1]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPathFilters: [expect.objectContaining({ expectedValue: 'val-{{snippet}}' })],
      }),
    );
  });

  // ── Extract Variables ─────────────────────────────────────────────────────
  it('adds a new extract variable row', () => {
    render(<Host />);
    fireEvent.click(screen.getAllByText('+ Add')[2]);
    expect(screen.getByPlaceholderText('Variable name')).toBeTruthy();
    expect(screen.getByPlaceholderText('$.field.path')).toBeTruthy();
  });

  it('updates extract variable name', () => {
    render(
      <Host
        initial={makeData({
          extractVariables: [{ name: 'orderId', jsonPath: '$.orderId' }],
        })}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('orderId'), { target: { value: 'customerId' } });
    expect(screen.getByDisplayValue('customerId')).toBeTruthy();
  });

  it('updates extract variable jsonPath', () => {
    render(
      <Host
        initial={makeData({
          extractVariables: [{ name: 'orderId', jsonPath: '$.orderId' }],
        })}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('$.orderId'), { target: { value: '$.customerId' } });
    expect(screen.getByDisplayValue('$.customerId')).toBeTruthy();
  });

  it('removes an extract variable row', () => {
    render(
      <Host
        initial={makeData({
          extractVariables: [{ name: 'orderId', jsonPath: '$.orderId' }],
        })}
      />,
    );
    expect(screen.getByDisplayValue('orderId')).toBeTruthy();
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByDisplayValue('orderId')).toBeNull();
  });

  // ── Sample Payload / Key / Headers ────────────────────────────────────────
  it('calls onChange when samplePayload changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const ta = screen.getByPlaceholderText(/orderId.*order-123/s);
    fireEvent.change(ta, { target: { value: '{"id":"x"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ samplePayload: '{"id":"x"}' }));
  });

  it('sets samplePayload to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaTriggerConfig
        data={makeData({ samplePayload: '{"id":"x"}' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    const ta = screen.getByDisplayValue('{"id":"x"}');
    fireEvent.change(ta, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ samplePayload: undefined }));
  });

  it('calls onChange when sampleKey changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const input = screen.getByPlaceholderText('Optional key (e.g. order-123)');
    fireEvent.change(input, { target: { value: 'key-001' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleKey: 'key-001' }));
  });

  it('sets sampleKey to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaTriggerConfig
        data={makeData({ sampleKey: 'key-001' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('key-001'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleKey: undefined }));
  });

  it('calls onChange when sampleHeaders changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const ta = screen.getByPlaceholderText('{"X-Source": "test", "X-Region": "us-east"}');
    fireEvent.change(ta, { target: { value: '{"X-Region":"eu"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleHeaders: '{"X-Region":"eu"}' }));
  });

  it('sets sampleHeaders to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaTriggerConfig
        data={makeData({ sampleHeaders: '{"X-Region":"eu"}' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('{"X-Region":"eu"}'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleHeaders: undefined }));
  });

  // ── Notes ─────────────────────────────────────────────────────────────────
  it('calls onChange when notes changes', () => {
    const onChange = vi.fn();
    render(<KafkaTriggerConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const ta = screen.getByPlaceholderText('Optional description for this trigger');
    fireEvent.change(ta, { target: { value: 'Listens for order events' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Listens for order events' }));
  });

  // ── Combined stateful render ──────────────────────────────────────────────
  it('full stateful render: add header + jsonpath + extract variable', () => {
    render(<Host />);

    // Add header filter
    fireEvent.click(screen.getAllByText('+ Add')[0]);
    const headerKey = screen.getByPlaceholderText('Header name');
    fireEvent.change(headerKey, { target: { value: 'X-Env' } });

    // Add JSONPath filter
    fireEvent.click(screen.getAllByText('+ Add')[1]);
    const jsonPathInput = screen.getByPlaceholderText('$.payload.type');
    fireEvent.change(jsonPathInput, { target: { value: '$.status' } });

    // Add extract variable
    fireEvent.click(screen.getAllByText('+ Add')[2]);
    const varName = screen.getByPlaceholderText('Variable name');
    fireEvent.change(varName, { target: { value: 'status' } });

    expect(screen.getByDisplayValue('X-Env')).toBeTruthy();
    expect(screen.getByDisplayValue('$.status')).toBeTruthy();
    expect(screen.getByDisplayValue('status')).toBeTruthy();
  });

  // ── Two rows of each: verify remove correct row ───────────────────────────
  it('removes the correct header filter when multiple rows exist', () => {
    render(
      <Host
        initial={makeData({
          headerFilters: [
            { id: 'h1', key: 'X-First', value: '', enabled: true },
            { id: 'h2', key: 'X-Second', value: '', enabled: true },
          ],
        })}
      />,
    );
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByDisplayValue('X-First')).toBeNull();
    expect(screen.getByDisplayValue('X-Second')).toBeTruthy();
  });

  it('removes the correct JSONPath filter when multiple rows exist', () => {
    render(
      <Host
        initial={makeData({
          jsonPathFilters: [
            { id: 'j1', jsonPath: '$.first', expectedValue: '', enabled: true },
            { id: 'j2', jsonPath: '$.second', expectedValue: '', enabled: true },
          ],
        })}
      />,
    );
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByDisplayValue('$.first')).toBeNull();
    expect(screen.getByDisplayValue('$.second')).toBeTruthy();
  });

  it('removes the correct extract variable when multiple rows exist', () => {
    render(
      <Host
        initial={makeData({
          extractVariables: [
            { name: 'varA', jsonPath: '$.a' },
            { name: 'varB', jsonPath: '$.b' },
          ],
        })}
      />,
    );
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByDisplayValue('varA')).toBeNull();
    expect(screen.getByDisplayValue('varB')).toBeTruthy();
  });

  // ── variableHints rendered in AvailableVariables ───────────────────────────
  it('renders without variableHints prop', () => {
    render(<KafkaTriggerConfig data={makeData()} onChange={vi.fn()} variableHints={[]} />);
    expect(screen.getByTestId('available-variables')).toBeTruthy();
  });

  // ── within for multi-section removal disambiguation ───────────────────────
  it('can have header and JSONPath remove buttons coexist', () => {
    render(
      <Host
        initial={makeData({
          headerFilters: [{ id: 'h1', key: 'hk', value: '', enabled: true }],
          jsonPathFilters: [{ id: 'j1', jsonPath: '$.jp', expectedValue: '', enabled: true }],
        })}
      />,
    );
    // Both × buttons present
    const removeButtons = screen.getAllByText('×');
    expect(removeButtons).toHaveLength(2);
  });
});

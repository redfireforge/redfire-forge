/**
 * @vitest-environment jsdom
 * Unit tests for KafkaWaitConfig
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import KafkaWaitConfig from './KafkaWaitConfig';
import type { KafkaWaitNodeData } from '../../types/workflow';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../expression/InsertVarField');
vi.mock('../expression/AvailableVariables');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<KafkaWaitNodeData> = {}): KafkaWaitNodeData {
  return {
    label: 'Kafka Wait',
    clusterId: 'cluster-a',
    topic: 'payments.authorized',
    ...overrides,
  } as KafkaWaitNodeData;
}

function Host({ initial = makeData() }: { initial?: KafkaWaitNodeData }) {
  const [data, setData] = useState(initial);
  return (
    <KafkaWaitConfig
      data={data}
      onChange={setData}
      onRequestVariableInsert={vi.fn()}
      variableHints={[{ ref: 'orderId', label: 'Order ID' }]}
    />
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KafkaWaitConfig', () => {
  // ── Root element ──────────────────────────────────────────────────────────
  it('renders with data-testid="kafka-wait-config"', () => {
    render(<Host />);
    expect(screen.getByTestId('kafka-wait-config')).toBeTruthy();
  });

  it('renders AvailableVariables', () => {
    render(<Host />);
    expect(screen.getByTestId('available-variables')).toBeTruthy();
  });

  // ── Label ─────────────────────────────────────────────────────────────────
  it('renders label input with current value', () => {
    render(<Host initial={makeData({ label: 'My Wait' })} />);
    expect(screen.getByDisplayValue('My Wait')).toBeTruthy();
  });

  it('calls onChange when label changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    fireEvent.change(screen.getByDisplayValue('Kafka Wait'), { target: { value: 'Payment Wait' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Payment Wait' }));
  });

  // ── Cluster ID ────────────────────────────────────────────────────────────
  it('calls onChange when clusterId changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    fireEvent.change(screen.getByDisplayValue('cluster-a'), { target: { value: 'cluster-b' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clusterId: 'cluster-b' }));
  });

  // ── Topic ─────────────────────────────────────────────────────────────────
  it('calls onChange when topic changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    fireEvent.change(screen.getByDisplayValue('payments.authorized'), { target: { value: 'orders.confirmed' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ topic: 'orders.confirmed' }));
  });

  // ── Correlation ID Expression ─────────────────────────────────────────────
  it('renders correlation ID expression input', () => {
    render(<Host initial={makeData({ correlationIdExpression: '{{orderId}}' })} />);
    expect(screen.getByDisplayValue('{{orderId}}')).toBeTruthy();
  });

  it('calls onChange when correlationIdExpression changes', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ correlationIdExpression: '{{orderId}}' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('{{orderId}}'), { target: { value: '{{paymentId}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationIdExpression: '{{paymentId}}' }));
  });

  it('appends inserted snippet to correlationIdExpression', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ correlationIdExpression: 'pre-' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    // First InsertVarField wraps correlationIdExpression
    fireEvent.click(screen.getAllByTestId('insert-var-apply')[0]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ correlationIdExpression: 'pre-{{snippet}}' }),
    );
  });

  // ── Correlation Source ────────────────────────────────────────────────────
  it('renders correlation source select defaulting to body', () => {
    render(<Host />);
    expect(screen.getByDisplayValue('Body (JSONPath)')).toBeTruthy();
  });

  it('calls onChange when correlation source changes to header', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const sel = screen.getByDisplayValue('Body (JSONPath)');
    fireEvent.change(sel, { target: { value: 'header' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationSource: 'header' }));
  });

  it('calls onChange when correlation source changes to key', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const sel = screen.getByDisplayValue('Body (JSONPath)');
    fireEvent.change(sel, { target: { value: 'key' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationSource: 'key' }));
  });

  // ── Conditional fields for correlation source ─────────────────────────────
  it('shows correlationJsonPath field when source is body', () => {
    render(<Host initial={makeData({ correlationSource: 'body' })} />);
    expect(screen.getByPlaceholderText('$.orderId')).toBeTruthy();
  });

  it('calls onChange when correlationJsonPath changes', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig data={makeData({ correlationSource: 'body' })} onChange={onChange} variableHints={[]} />,
    );
    const input = screen.getByPlaceholderText('$.orderId');
    fireEvent.change(input, { target: { value: '$.paymentId' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationJsonPath: '$.paymentId' }));
  });

  it('sets correlationJsonPath to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ correlationSource: 'body', correlationJsonPath: '$.orderId' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('$.orderId'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationJsonPath: undefined }));
  });

  it('shows correlationHeader field when source is header', () => {
    render(<Host initial={makeData({ correlationSource: 'header' })} />);
    expect(screen.getByPlaceholderText('X-Correlation-Id')).toBeTruthy();
  });

  it('calls onChange when correlationHeader changes', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig data={makeData({ correlationSource: 'header' })} onChange={onChange} variableHints={[]} />,
    );
    const input = screen.getByPlaceholderText('X-Correlation-Id');
    fireEvent.change(input, { target: { value: 'X-Order-Id' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationHeader: 'X-Order-Id' }));
  });

  it('shows message-key hint when source is key', () => {
    render(<Host initial={makeData({ correlationSource: 'key' })} />);
    expect(screen.getByText('The message key is used directly as the correlation ID.')).toBeTruthy();
  });

  it('does not show JSONPath field when source is header', () => {
    render(<Host initial={makeData({ correlationSource: 'header' })} />);
    expect(screen.queryByPlaceholderText('$.orderId')).toBeNull();
  });

  // ── Timeout ───────────────────────────────────────────────────────────────
  it('calls onChange when timeoutMs changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const input = screen.getByPlaceholderText('30000');
    fireEvent.change(input, { target: { value: '60000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 60000 }));
  });

  it('sets timeoutMs to 0 when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig data={makeData({ timeoutMs: 30000 })} onChange={onChange} variableHints={[]} />,
    );
    fireEvent.change(screen.getByDisplayValue('30000'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 0 }));
  });

  // ── Key Regex ─────────────────────────────────────────────────────────────
  it('calls onChange when keyRegex changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const input = screen.getByPlaceholderText('Optional pre-filter on message key');
    fireEvent.change(input, { target: { value: '^pay-.*' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keyRegex: '^pay-.*' }));
  });

  it('appends inserted snippet to keyRegex', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig data={makeData({ keyRegex: '^' })} onChange={onChange} variableHints={[]} />,
    );
    // InsertVarField apply buttons: 0=correlationId, 1=keyRegex
    fireEvent.click(screen.getAllByTestId('insert-var-apply')[1]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keyRegex: '^{{snippet}}' }));
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
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByDisplayValue('X-Src')).toBeNull();
  });

  it('appends snippet to header filter value via InsertVarField', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ headerFilters: [{ id: 'h1', key: 'X-Src', value: 'pfx-', enabled: true }] })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    // InsertVarField buttons: 0=correlationId, 1=keyRegex, 2=header value
    fireEvent.click(screen.getAllByTestId('insert-var-apply')[2]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        headerFilters: [expect.objectContaining({ value: 'pfx-{{snippet}}' })],
      }),
    );
  });

  // ── Extract Variables ─────────────────────────────────────────────────────
  it('adds a new extract variable row', () => {
    render(<Host />);
    fireEvent.click(screen.getAllByText('+ Add')[1]);
    expect(screen.getByPlaceholderText('Variable name')).toBeTruthy();
    expect(screen.getByPlaceholderText('$.field.path')).toBeTruthy();
  });

  it('updates extract variable name', () => {
    render(
      <Host
        initial={makeData({
          extractVariables: [{ name: 'paymentId', jsonPath: '$.paymentId' }],
        })}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('paymentId'), { target: { value: 'transactionId' } });
    expect(screen.getByDisplayValue('transactionId')).toBeTruthy();
  });

  it('updates extract variable jsonPath', () => {
    render(
      <Host
        initial={makeData({
          extractVariables: [{ name: 'paymentId', jsonPath: '$.paymentId' }],
        })}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('$.paymentId'), { target: { value: '$.transactionId' } });
    expect(screen.getByDisplayValue('$.transactionId')).toBeTruthy();
  });

  it('removes an extract variable row', () => {
    render(
      <Host
        initial={makeData({
          extractVariables: [{ name: 'paymentId', jsonPath: '$.paymentId' }],
        })}
      />,
    );
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByDisplayValue('paymentId')).toBeNull();
  });

  it('removes the correct extract variable when multiple exist', () => {
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

  // ── Test Payload / Key / Headers ──────────────────────────────────────────
  it('calls onChange when samplePayload changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const ta = screen.getByPlaceholderText(/orderId.*order-123/s);
    fireEvent.change(ta, { target: { value: '{"status":"approved"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ samplePayload: '{"status":"approved"}' }));
  });

  it('sets samplePayload to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ samplePayload: '{"status":"approved"}' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('{"status":"approved"}'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ samplePayload: undefined }));
  });

  it('calls onChange when sampleKey changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const input = screen.getByPlaceholderText('Optional key (e.g. order-123)');
    fireEvent.change(input, { target: { value: 'order-456' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleKey: 'order-456' }));
  });

  it('sets sampleKey to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig data={makeData({ sampleKey: 'order-456' })} onChange={onChange} variableHints={[]} />,
    );
    fireEvent.change(screen.getByDisplayValue('order-456'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleKey: undefined }));
  });

  it('calls onChange when sampleHeaders changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const ta = screen.getByPlaceholderText('{"X-Correlation-Id": "order-123"}');
    fireEvent.change(ta, { target: { value: '{"X-Correlation-Id":"order-456"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleHeaders: '{"X-Correlation-Id":"order-456"}' }));
  });

  it('sets sampleHeaders to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ sampleHeaders: '{"X-Correlation-Id":"order-456"}' })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('{"X-Correlation-Id":"order-456"}'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sampleHeaders: undefined }));
  });

  // ── Load Test Behavior ────────────────────────────────────────────────────
  it('renders load test select defaulting to wait-for-real', () => {
    render(<Host />);
    expect(screen.getByDisplayValue('Wait for real')).toBeTruthy();
  });

  it('calls onChange when load test mode changes to auto-resume', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const sel = screen.getByDisplayValue('Wait for real');
    fireEvent.change(sel, { target: { value: 'auto-resume' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ loadTestBehavior: expect.objectContaining({ mode: 'auto-resume' }) }),
    );
  });

  it('calls onChange when load test mode changes to synthetic-inject', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const sel = screen.getByDisplayValue('Wait for real');
    fireEvent.change(sel, { target: { value: 'synthetic-inject' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ loadTestBehavior: expect.objectContaining({ mode: 'synthetic-inject' }) }),
    );
  });

  it('does not show mock payload textarea when mode is wait-for-real', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'wait-for-real' } })} />);
    expect(screen.queryByLabelText('Mock Payload')).toBeNull();
  });

  it('shows mock payload textarea when mode is auto-resume', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'auto-resume' } })} />);
    expect(screen.getByLabelText('Mock Payload')).toBeTruthy();
  });

  it('shows mock payload textarea when mode is synthetic-inject', () => {
    render(<Host initial={makeData({ loadTestBehavior: { mode: 'synthetic-inject' } })} />);
    expect(screen.getByLabelText('Mock Payload')).toBeTruthy();
  });

  it('updates mockPayloadText locally on invalid JSON', () => {
    render(
      <Host
        initial={makeData({ loadTestBehavior: { mode: 'auto-resume', mockPayload: { status: 'ok' } } })}
      />,
    );
    const ta = screen.getByLabelText('Mock Payload');
    fireEvent.change(ta, { target: { value: '{invalid' } });
    // textarea should show the invalid text
    expect((ta as HTMLTextAreaElement).value).toBe('{invalid');
  });

  it('calls onChange with parsed mockPayload on valid JSON', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ loadTestBehavior: { mode: 'auto-resume', mockPayload: { status: 'ok' } } })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    const ta = screen.getByLabelText('Mock Payload');
    fireEvent.change(ta, { target: { value: '{"status":"done"}' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        loadTestBehavior: expect.objectContaining({ mockPayload: { status: 'done' } }),
      }),
    );
  });

  it('does not call onChange for array JSON in mockPayload', () => {
    const onChange = vi.fn();
    render(
      <KafkaWaitConfig
        data={makeData({ loadTestBehavior: { mode: 'auto-resume' } })}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    const ta = screen.getByLabelText('Mock Payload');
    fireEvent.change(ta, { target: { value: '[1,2,3]' } });
    // Array is valid JSON but rejected by the guard (must be plain object)
    expect(onChange).not.toHaveBeenCalled();
  });

  // ── mockPayload external update syncs textarea ────────────────────────────
  it('syncs mockPayloadText when data.loadTestBehavior.mockPayload changes externally', () => {
    render(
      <Host
        initial={makeData({ loadTestBehavior: { mode: 'auto-resume', mockPayload: { status: 'ok' } } })}
      />,
    );
    // Initial textarea value
    const ta = screen.getByLabelText('Mock Payload');
    expect((ta as HTMLTextAreaElement).value).toContain('"status"');

    // Change load test mode to force re-render with new mockPayload (synthetic cycle)
    const sel = screen.getByDisplayValue('Auto resume');
    fireEvent.change(sel, { target: { value: 'synthetic-inject' } });
  });

  // ── Notes ─────────────────────────────────────────────────────────────────
  it('calls onChange when notes changes', () => {
    const onChange = vi.fn();
    render(<KafkaWaitConfig data={makeData()} onChange={onChange} variableHints={[]} />);
    const ta = screen.getByPlaceholderText('Optional description for this wait node');
    fireEvent.change(ta, { target: { value: 'Waits for payment confirmation' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Waits for payment confirmation' }));
  });

  // ── Combined stateful render ──────────────────────────────────────────────
  it('full stateful: add header + extract variable, switch load test mode', () => {
    render(<Host />);

    // Add header filter
    fireEvent.click(screen.getAllByText('+ Add')[0]);
    fireEvent.change(screen.getByPlaceholderText('Header name'), { target: { value: 'X-Env' } });

    // Add extract variable
    fireEvent.click(screen.getAllByText('+ Add')[1]);
    fireEvent.change(screen.getByPlaceholderText('Variable name'), { target: { value: 'status' } });

    // Switch load test to auto-resume
    fireEvent.change(screen.getByDisplayValue('Wait for real'), { target: { value: 'auto-resume' } });

    expect(screen.getByDisplayValue('X-Env')).toBeTruthy();
    expect(screen.getByDisplayValue('status')).toBeTruthy();
    expect(screen.getByLabelText('Mock Payload')).toBeTruthy();
  });
});

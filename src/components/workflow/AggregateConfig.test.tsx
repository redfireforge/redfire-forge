/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import AggregateConfig from './AggregateConfig';
import type { AggregateNodeData } from '../../types/workflow';

function makeData(overrides: Partial<AggregateNodeData> = {}): AggregateNodeData {
  return {
    label: 'Test Aggregate',
    mappings: [],
    ...overrides,
  } as AggregateNodeData;
}

describe('AggregateConfig', () => {
  it('renders label input', () => {
    const onChange = vi.fn();
    render(<AggregateConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByDisplayValue('Test Aggregate')).toBeTruthy();
  });

  it('adds mapping when + Add Mapping is clicked', () => {
    const onChange = vi.fn();
    render(<AggregateConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Mapping'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mappings: [expect.objectContaining({ sourceExpression: '', targetVariable: '', strategy: 'concat' })],
    }));
  });

  it('renders existing mappings', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('{{item}}')).toBeTruthy();
    expect(screen.getByDisplayValue('result')).toBeTruthy();
  });

  it('updates mapping source expression', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{item}}'), { target: { value: '{{newItem}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mappings: [expect.objectContaining({ sourceExpression: '{{newItem}}' })],
    }));
  });

  it('changes strategy', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    const { container } = render(<AggregateConfig data={data} onChange={onChange} />);
    const strategySelect = container.querySelector('.wf-aggregate-mapping-strategy') as HTMLSelectElement;
    fireEvent.change(strategySelect, { target: { value: 'sum' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mappings: [expect.objectContaining({ strategy: 'sum' })],
    }));
  });

  it('shows custom expression input when strategy is custom', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'custom', customExpression: '$.total' }],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('$.total')).toBeTruthy();
  });

  it('removes mapping', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mappings: [] }));
  });

  it('moves mapping', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [
        { id: 'm1', sourceExpression: 'first', targetVariable: 'r1', strategy: 'concat' },
        { id: 'm2', sourceExpression: 'second', targetVariable: 'r2', strategy: 'sum' },
      ],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    const moveDownBtns = screen.getAllByTitle('Move down');
    fireEvent.click(moveDownBtns[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mappings: [expect.objectContaining({ id: 'm2' }), expect.objectContaining({ id: 'm1' })],
    }));
  });

  it('updates label', () => {
    const onChange = vi.fn();
    render(<AggregateConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Test Aggregate'), { target: { value: 'New Label' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'New Label' }));
  });

  it('updates custom expression', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'custom', customExpression: '$.total' }],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('$.total'), { target: { value: '$.sum' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mappings: [expect.objectContaining({ customExpression: '$.sum' })],
    }));
  });

  it('updates target variable', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('result'), { target: { value: 'output' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mappings: [expect.objectContaining({ targetVariable: 'output' })],
    }));
  });

  it('moves mapping up', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [
        { id: 'm1', sourceExpression: 'first', targetVariable: 'r1', strategy: 'concat' },
        { id: 'm2', sourceExpression: 'second', targetVariable: 'r2', strategy: 'sum' },
      ],
    });
    render(<AggregateConfig data={data} onChange={onChange} />);
    const moveUpBtns = screen.getAllByTitle('Move up');
    fireEvent.click(moveUpBtns[1]); // move second item up
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mappings: [expect.objectContaining({ id: 'm2' }), expect.objectContaining({ id: 'm1' })],
    }));
  });

  it('disables move buttons at boundaries', () => {
    const onChange = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: 'only', targetVariable: 'r1', strategy: 'concat' }],
    });
    const { container } = render(<AggregateConfig data={data} onChange={onChange} />);
    const moveUp = container.querySelector('button[title="Move up"]') as HTMLButtonElement;
    const moveDown = container.querySelector('button[title="Move down"]') as HTMLButtonElement;
    expect(moveUp.disabled).toBe(true);
    expect(moveDown.disabled).toBe(true);
  });

  it('handles undefined mappings gracefully', () => {
    const onChange = vi.fn();
    const data = { label: 'No Mappings' } as AggregateNodeData;
    const { container } = render(<AggregateConfig data={data} onChange={onChange} />);
    expect(container.querySelectorAll('.wf-aggregate-mapping-row').length).toBe(0);
  });

  it('does not render Insert button when onRequestVariableInsert is not provided', () => {
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    render(<AggregateConfig data={data} onChange={vi.fn()} />);
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders Insert button when onRequestVariableInsert is provided', () => {
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    render(<AggregateConfig data={data} onChange={vi.fn()} onRequestVariableInsert={vi.fn()} />);
    expect(screen.getByText('Insert…')).toBeTruthy();
  });

  it('calls onRequestVariableInsert when Insert button is clicked', () => {
    const onRequest = vi.fn();
    const data = makeData({
      mappings: [{ id: 'm1', sourceExpression: '{{item}}', targetVariable: 'result', strategy: 'concat' }],
    });
    render(<AggregateConfig data={data} onChange={vi.fn()} onRequestVariableInsert={onRequest} />);
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalled();
  });

  it('renders Available Variables section when variableHints are provided', () => {
    const hints = [{ ref: 'item', label: 'item (latest)' }];
    render(<AggregateConfig data={makeData()} onChange={vi.fn()} variableHints={hints} />);
    expect(screen.getByText(/Available variables/)).toBeTruthy();
  });
});

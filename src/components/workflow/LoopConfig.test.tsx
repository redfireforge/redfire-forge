/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import LoopConfig from './LoopConfig';
import type { LoopNodeData } from '../../types/workflow';

function makeData(overrides: Partial<LoopNodeData> = {}): LoopNodeData {
  return {
    label: 'Test Loop',
    mode: 'count',
    count: 5,
    maxIterations: 100,
    ...overrides,
  } as LoopNodeData;
}

describe('LoopConfig', () => {
  it('renders label input', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByDisplayValue('Test Loop')).toBeTruthy();
  });

  it('renders mode selector with count selected', () => {
    const onChange = vi.fn();
    const { container } = render(<LoopConfig data={makeData()} onChange={onChange} />);
    const modeSelect = container.querySelector('select') as HTMLSelectElement;
    expect(modeSelect.value).toBe('count');
  });

  it('renders iterations input in count mode', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('updates label', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Test Loop'), { target: { value: 'My Loop' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'My Loop' }));
  });

  it('updates mode', () => {
    const onChange = vi.fn();
    const { container } = render(<LoopConfig data={makeData()} onChange={onChange} />);
    const modeSelect = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'forEach' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'forEach' }));
  });

  it('renders forEach fields when mode is forEach', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('{{items}}')).toBeTruthy();
    expect(screen.getByDisplayValue('item')).toBeTruthy();
  });

  it('renders while fields when mode is while', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    render(<LoopConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('{{status}}')).toBeTruthy();
    expect(screen.getByDisplayValue('200')).toBeTruthy();
  });

  it('updates max iterations', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    const maxInput = screen.getByDisplayValue('100');
    fireEvent.change(maxInput, { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxIterations: 50 }));
  });

  it('updates count', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ count: 10 }));
  });

  it('updates count expression', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    const exprInput = screen.getByPlaceholderText('e.g. {{retryCount}} (overrides fixed count)');
    fireEvent.change(exprInput, { target: { value: '{{n}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ countExpression: '{{n}}' }));
  });

  it('updates index variable in count mode', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData({ indexVariable: 'i' })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('i'), { target: { value: 'idx' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ indexVariable: 'idx' }));
  });

  it('updates source expression in forEach mode', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{items}}'), { target: { value: '{{data}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceExpression: '{{data}}' }));
  });

  it('updates item variable in forEach mode', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('item'), { target: { value: 'row' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ itemVariable: 'row' }));
  });

  it('updates index variable in forEach mode', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('i'), { target: { value: 'idx' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ indexVariable: 'idx' }));
  });

  it('updates whileLeft operand', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{status}}'), { target: { value: '{{code}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileLeft: '{{code}}' }));
  });

  it('updates while operator', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    const { container } = render(<LoopConfig data={data} onChange={onChange} />);
    // The operator select is the second select (first is mode)
    const selects = container.querySelectorAll('select');
    const opSelect = selects[1] as HTMLSelectElement;
    fireEvent.change(opSelect, { target: { value: '!=' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileOperator: '!=' }));
  });

  it('updates whileRight operand', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('200'), { target: { value: '404' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileRight: '404' }));
  });
});

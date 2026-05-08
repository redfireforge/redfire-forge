/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import IterationPicker from './IterationPicker';
import type { WorkflowIterationTrace } from '../../../shared/types';

afterEach(cleanup);

function makeIter(passed: boolean, durationMs: number): WorkflowIterationTrace {
  return {
    iterationIndex: 0,
    passed,
    durationMs,
    nodeResults: {},
    events: [],
  };
}

const passIter = makeIter(true, 100);
const failIter = makeIter(false, 500);
const slowIter = makeIter(true, 2000);

const iterations: WorkflowIterationTrace[] = [
  passIter,     // #1 pass 100ms
  failIter,     // #2 fail 500ms
  makeIter(true, 150),  // #3 pass 150ms
  makeIter(true, 200),  // #4 pass 200ms
  makeIter(false, 300), // #5 fail 300ms
  makeIter(true, 120),  // #6 pass 120ms
  makeIter(true, 180),  // #7 pass 180ms
  makeIter(true, 130),  // #8 pass 130ms
  makeIter(true, 160),  // #9 pass 160ms
  slowIter,     // #10 pass 2000ms (definitely in p95)
];

describe('IterationPicker', () => {
  it('renders toggle button with Aggregate label when no selection', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    expect(screen.getByTestId('iter-picker-toggle').textContent).toMatch(/Aggregate/);
  });

  it('renders toggle button with iteration info when iteration selected', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={1} onSelect={onSelect} failedCount={2} />);
    expect(screen.getByTestId('iter-picker-toggle').textContent).toMatch(/#2.*✗.*500ms/);
  });

  it('opens dropdown on toggle click', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    expect(screen.queryByTestId('iter-picker-dropdown')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    expect(screen.getByTestId('iter-picker-dropdown')).toBeInTheDocument();
  });

  it('shows all filter tabs with counts', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    expect(screen.getByTestId('iter-filter-all').textContent).toMatch(/All \(10\)/);
    expect(screen.getByTestId('iter-filter-failed').textContent).toMatch(/Failed \(2\)/);
    expect(screen.getByTestId('iter-filter-slowest')).toBeInTheDocument();
  });

  it('filters to show only failed iterations', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    fireEvent.click(screen.getByTestId('iter-filter-failed'));
    expect(screen.getByTestId('iter-picker-item-1')).toBeInTheDocument(); // #2
    expect(screen.getByTestId('iter-picker-item-4')).toBeInTheDocument(); // #5
    expect(screen.queryByTestId('iter-picker-item-0')).not.toBeInTheDocument(); // #1 not shown
    expect(screen.queryByTestId('iter-picker-item-2')).not.toBeInTheDocument(); // #3 not shown
  });

  it('disables failed filter when failedCount is 0', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={0} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    expect(screen.getByTestId('iter-filter-failed')).toBeDisabled();
  });

  it('selects an iteration and closes dropdown', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    fireEvent.click(screen.getByTestId('iter-picker-item-1'));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.queryByTestId('iter-picker-dropdown')).not.toBeInTheDocument();
  });

  it('selects aggregate view', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={3} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    fireEvent.click(screen.getByTestId('iter-picker-aggregate'));
    expect(onSelect).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId('iter-picker-dropdown')).not.toBeInTheDocument();
  });

  it('jump input filters to specific iteration', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    const jumpInput = screen.getByTestId('iter-picker-jump');
    fireEvent.change(jumpInput, { target: { value: '5' } });
    expect(screen.getByTestId('iter-picker-item-4')).toBeInTheDocument(); // #5
    expect(screen.queryByTestId('iter-picker-item-0')).not.toBeInTheDocument(); // #1 hidden
  });

  it('jump input Enter selects single match', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    const jumpInput = screen.getByTestId('iter-picker-jump');
    fireEvent.change(jumpInput, { target: { value: '3' } });
    fireEvent.keyDown(jumpInput, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('jump input Escape closes dropdown', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    const jumpInput = screen.getByTestId('iter-picker-jump');
    fireEvent.keyDown(jumpInput, { key: 'Escape' });
    expect(screen.queryByTestId('iter-picker-dropdown')).not.toBeInTheDocument();
  });

  it('shows empty state when no match found', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    const jumpInput = screen.getByTestId('iter-picker-jump');
    fireEvent.change(jumpInput, { target: { value: '99' } });
    expect(screen.getByTestId('iter-picker-empty')).toBeInTheDocument();
    expect(screen.getByTestId('iter-picker-empty').textContent).toMatch(/No iteration #99/);
  });

  it('closes dropdown when clicking outside', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    expect(screen.getByTestId('iter-picker-dropdown')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('iter-picker-dropdown')).not.toBeInTheDocument();
  });

  it('filters to show only slowest iterations (p95+)', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    fireEvent.click(screen.getByTestId('iter-filter-slowest'));
    expect(screen.getByTestId('iter-picker-item-9')).toBeInTheDocument(); // #10 (2000ms, above p95)
    expect(screen.queryByTestId('iter-picker-item-0')).not.toBeInTheDocument(); // #1 (100ms, not slow)
  });

  it('shows slow badge on p95 outlier iteration', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    const item10 = screen.getByTestId('iter-picker-item-9');
    expect(item10.textContent).toMatch(/slow/);
  });

  it('highlights selected iteration in list', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={3} onSelect={onSelect} failedCount={2} />);
    fireEvent.click(screen.getByTestId('iter-picker-toggle'));
    expect(screen.getByTestId('iter-picker-item-3')).toHaveClass('selected');
    expect(screen.getByTestId('iter-picker-item-0')).not.toHaveClass('selected');
  });

  it('applies pass/fail CSS class on toggle button', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<IterationPicker iterations={iterations} selectedIteration={0} onSelect={onSelect} failedCount={2} />);
    expect(screen.getByTestId('iter-picker-toggle')).toHaveClass('pass');
    rerender(<IterationPicker iterations={iterations} selectedIteration={1} onSelect={onSelect} failedCount={2} />);
    expect(screen.getByTestId('iter-picker-toggle')).toHaveClass('fail');
  });

  it('toggle button shows aggregate class when no selection', () => {
    const onSelect = vi.fn();
    render(<IterationPicker iterations={iterations} selectedIteration={undefined} onSelect={onSelect} failedCount={2} />);
    expect(screen.getByTestId('iter-picker-toggle')).toHaveClass('aggregate');
  });
});

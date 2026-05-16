/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpressionDebugDetailModal from './ExpressionDebugDetailModal';
import type { EvalStep } from './utils/expressionStepDebugger';

const makeStep = (overrides: Partial<EvalStep> = {}): EvalStep => ({
  label: 'Test Step',
  expression: '$sum($.values)',
  displayValue: '42',
  error: false,
  ...overrides,
});

describe('ExpressionDebugDetailModal', () => {
  it('renders step label, expression, and result', () => {
    render(<ExpressionDebugDetailModal step={makeStep()} onClose={vi.fn()} />);
    expect(screen.getByText('Test Step')).toBeInTheDocument();
    expect(screen.getByText('$sum($.values)')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Result')).toBeInTheDocument();
  });

  it('shows Error label when step has error', () => {
    render(
      <ExpressionDebugDetailModal
        step={makeStep({ error: true, displayValue: 'Unexpected token' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Unexpected token')).toBeInTheDocument();
  });

  it('pretty-prints JSON display values', () => {
    render(
      <ExpressionDebugDetailModal
        step={makeStep({ displayValue: '{"a":1}' })}
        onClose={vi.fn()}
      />,
    );
    const resultPre = document.querySelectorAll('.dm-expr-detail-code')[1];
    expect(resultPre?.textContent).toContain('"a": 1');
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<ExpressionDebugDetailModal step={makeStep()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();
    render(<ExpressionDebugDetailModal step={makeStep()} onClose={onClose} />);
    fireEvent.click(screen.getByText('$sum($.values)'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<ExpressionDebugDetailModal step={makeStep()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ExpressionDebugDetailModal step={makeStep()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports dragging the header', () => {
    render(<ExpressionDebugDetailModal step={makeStep()} onClose={vi.fn()} />);
    const header = document.querySelector('.dm-expr-detail-header')!;
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 120 });
    fireEvent.mouseUp(window);
    const modal = document.querySelector('.dm-expr-detail-modal') as HTMLElement;
    expect(modal.style.transform).toBe('translate(50px, 20px)');
  });

  it('ignores drag when clicking a button inside the header', () => {
    render(<ExpressionDebugDetailModal step={makeStep()} onClose={vi.fn()} />);
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.mouseDown(closeBtn, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 120 });
    fireEvent.mouseUp(window);
    const modal = document.querySelector('.dm-expr-detail-modal') as HTMLElement;
    expect(modal.style.transform).toBe('');
  });

  it('applies error CSS class when step has error', () => {
    render(
      <ExpressionDebugDetailModal
        step={makeStep({ error: true, displayValue: 'fail' })}
        onClose={vi.fn()}
      />,
    );
    const pre = document.querySelectorAll('.dm-expr-detail-code')[1];
    expect(pre?.classList.contains('dm-expr-detail-code--error')).toBe(true);
  });

  it('applies result CSS class when step succeeds', () => {
    render(
      <ExpressionDebugDetailModal step={makeStep()} onClose={vi.fn()} />,
    );
    const pre = document.querySelectorAll('.dm-expr-detail-code')[1];
    expect(pre?.classList.contains('dm-expr-detail-code--result')).toBe(true);
  });
});

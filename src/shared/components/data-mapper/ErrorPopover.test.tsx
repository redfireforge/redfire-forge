/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorPopover from './ErrorPopover';
import type { ErrorDetailData } from './MappingCanvas';

const baseData: ErrorDetailData = {
  mappingId: 'm1',
  sourcePath: 'user.name',
  targetPath: 'userName',
  sourceValue: 'Alice',
  targetValue: 'undefined',
};

describe('ErrorPopover', () => {
  it('renders source and target paths', () => {
    const { container } = render(
      <ErrorPopover data={baseData} y={100} onClose={vi.fn()} />,
    );
    expect(container.textContent).toContain('user.name');
    expect(container.textContent).toContain('userName');
  });

  it('renders source and target values', () => {
    const { container } = render(
      <ErrorPopover data={baseData} y={100} onClose={vi.fn()} />,
    );
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('undefined');
  });

  it('renders expression when provided', () => {
    const data = { ...baseData, expression: '$broken($.name)' };
    const { container } = render(
      <ErrorPopover data={data} y={100} onClose={vi.fn()} />,
    );
    expect(container.textContent).toContain('$broken($.name)');
  });

  it('omits expression row when not provided', () => {
    const { container } = render(
      <ErrorPopover data={baseData} y={100} onClose={vi.fn()} />,
    );
    expect(container.textContent).not.toContain('Expression:');
  });

  it('renders error message when provided', () => {
    const data = { ...baseData, error: 'Unknown function' };
    const { container } = render(
      <ErrorPopover data={data} y={100} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.dm-error-popover-error')!.textContent).toContain('Unknown function');
  });

  it('applies error class for undefined target value', () => {
    const { container } = render(
      <ErrorPopover data={baseData} y={100} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.dm-error-popover-value--error')).toBeTruthy();
  });

  it('does not apply error class for non-undefined target value', () => {
    const data = { ...baseData, targetValue: 'valid' };
    const { container } = render(
      <ErrorPopover data={data} y={100} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.dm-error-popover-value--error')).toBeNull();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ErrorPopover data={baseData} y={100} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('positions at specified y coordinate', () => {
    const { container } = render(
      <ErrorPopover data={baseData} y={250} onClose={vi.fn()} />,
    );
    const popover = container.querySelector('.dm-error-popover') as HTMLElement;
    expect(popover.style.top).toBe('250px');
  });

  it('has dialog role and accessible label', () => {
    const { container } = render(
      <ErrorPopover data={baseData} y={100} onClose={vi.fn()} />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-label')).toBe('Error details');
  });
});

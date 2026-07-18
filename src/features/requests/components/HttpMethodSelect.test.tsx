/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HttpMethodSelect } from './HttpMethodSelect';

describe('HttpMethodSelect', () => {
  it('opens and selects POST', () => {
    const onChange = vi.fn();
    render(<HttpMethodSelect value="GET" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /GET/i }));
    fireEvent.click(screen.getByRole('option', { name: /POST/i }));

    expect(onChange).toHaveBeenCalledWith('POST');
  });

  it('supports keyboard navigation and escape close', () => {
    const onChange = vi.fn();
    render(<HttpMethodSelect value="POST" onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: /POST/i });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(onChange).toHaveBeenNthCalledWith(1, 'PUT');
    expect(onChange).toHaveBeenNthCalledWith(2, 'GET');
  });

  it('closes on outside click', () => {
    const onChange = vi.fn();
    render(<HttpMethodSelect value="GET" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /GET/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('repositions dropdown upward when viewport would overflow', () => {
    const onChange = vi.fn();
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      top: 0,
      right: 120,
      bottom: 999,
      left: 0,
      toJSON: () => ({}),
    });

    render(<HttpMethodSelect value="GET" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /GET/i }));

    const dropdown = screen.getByRole('listbox') as HTMLDivElement;
    expect(dropdown.style.bottom).toBe('100%');
    expect(dropdown.style.top).toBe('auto');

    spy.mockRestore();
  });
});

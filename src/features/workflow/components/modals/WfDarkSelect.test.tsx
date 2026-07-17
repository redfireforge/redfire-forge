/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WfDarkSelect from './WfDarkSelect';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
];

describe('WfDarkSelect', () => {
  it('opens a dark menu and selects an option', () => {
    const onChange = vi.fn();
    render(<WfDarkSelect value="a" options={options} onChange={onChange} aria-label="Pick" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bravo' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<WfDarkSelect value="a" options={options} onChange={vi.fn()} aria-label="Pick" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('handles outside click close and ignores inside mousedown', () => {
    render(<WfDarkSelect value="a" options={options} onChange={vi.fn()} aria-label="Pick" />);
    const trigger = screen.getByRole('button', { name: 'Pick' });

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.mouseDown(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('supports empty options fallback and custom root class', () => {
    render(
      <WfDarkSelect
        value="missing"
        options={[]}
        onChange={vi.fn()}
        aria-label="Empty"
        className="extra-class"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Empty' });
    expect(trigger.textContent).toBe('');
    expect(trigger.closest('[data-testid="wf-dark-select"]')?.className).toContain('extra-class');
  });

  it('repositions menu on resize and scroll', () => {
    render(<WfDarkSelect value="a" options={options} onChange={vi.fn()} aria-label="Pick" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));

    fireEvent(window, new Event('resize'));
    fireEvent(window, new Event('scroll'));

    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});

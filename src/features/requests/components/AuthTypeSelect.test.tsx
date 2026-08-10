/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthTypeSelect } from './AuthTypeSelect';

describe('AuthTypeSelect', () => {
  it('opens the dropdown and selects Bearer Token', () => {
    const onChange = vi.fn();
    render(<AuthTypeSelect value="none" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /No Auth/i }));
    fireEvent.click(screen.getByRole('option', { name: /Bearer Token/i }));

    expect(onChange).toHaveBeenCalledWith('bearer');
  });

  it('supports keyboard navigation when open', () => {
    const onChange = vi.fn();
    render(<AuthTypeSelect value="none" onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: /No Auth/i });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(onChange).toHaveBeenCalledWith('bearer');
  });

  it('shows global profile option when enabled', () => {
    const onChange = vi.fn();
    render(<AuthTypeSelect value="none" onChange={onChange} showGlobalProfile />);

    fireEvent.click(screen.getByRole('button', { name: /No Auth/i }));
    expect(screen.getByRole('option', { name: /Global Auth Profile/i })).toBeInTheDocument();
  });

  it('falls back to the first option when value is unknown', () => {
    const onChange = vi.fn();
    render(<AuthTypeSelect value="unknown-auth" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Inherit from Collection/i })).toBeInTheDocument();
  });

  it('handles ArrowUp and Space keyboard branches', () => {
    const onChange = vi.fn();
    render(<AuthTypeSelect value="none" onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: /No Auth/i });
    fireEvent.keyDown(trigger, { key: ' ' });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });

    expect(onChange).toHaveBeenCalledWith('inherit');
  });

  it('closes on Escape and outside click', () => {
    const onChange = vi.fn();
    render(<AuthTypeSelect value="none" onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: /No Auth/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('repositions dropdown upward when it would overflow viewport', () => {
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

    render(<AuthTypeSelect value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /No Auth/i }));

    const dropdown = screen.getByRole('listbox') as HTMLDivElement;
    expect(dropdown.style.bottom).toBe('100%');
    expect(dropdown.style.top).toBe('auto');

    spy.mockRestore();
  });
});

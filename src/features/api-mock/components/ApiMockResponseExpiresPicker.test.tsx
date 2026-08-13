/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseExpiresPicker } from './ApiMockResponseExpiresPicker';

describe('ApiMockResponseExpiresPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows not-set label and relative shortcuts', () => {
    const onChange = vi.fn();
    render(<ApiMockResponseExpiresPicker value={undefined} onChange={onChange} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('1 hour from now'));
    expect(onChange).toHaveBeenCalledWith('2026-08-12T16:30:00.000Z');

    fireEvent.click(screen.getByTitle('24 hours from now'));
    expect(onChange).toHaveBeenLastCalledWith('2026-08-13T15:30:00.000Z');

    fireEvent.click(screen.getByTitle('7 days from now'));
    expect(onChange).toHaveBeenLastCalledWith('2026-08-19T15:30:00.000Z');
  });

  it('formats display value and supports manual edit commit', () => {
    const onChange = vi.fn();
    render(<ApiMockResponseExpiresPicker value="2026-12-25T09:15:00.000Z" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Dec 25, 2026/i })).toBeInTheDocument();
    expect(screen.getByTitle('Clear expiry')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dec 25, 2026/i }));
    const input = screen.getByPlaceholderText('YYYY-MM-DDTHH:MM');
    fireEvent.change(input, { target: { value: '2026-12-31T23:59' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(new Date('2026-12-31T23:59').toISOString());

    fireEvent.click(screen.getByRole('button', { name: /Dec 25, 2026/i }));
    fireEvent.change(screen.getByPlaceholderText('YYYY-MM-DDTHH:MM'), { target: { value: '' } });
    fireEvent.blur(screen.getByPlaceholderText('YYYY-MM-DDTHH:MM'));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('cancels edit on escape and ignores invalid draft', () => {
    const onChange = vi.fn();
    render(<ApiMockResponseExpiresPicker value="2026-08-01T10:00:00.000Z" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Aug 1, 2026/i }));
    const input = screen.getByPlaceholderText('YYYY-MM-DDTHH:MM');
    fireEvent.change(input, { target: { value: 'not-a-date' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Aug 1, 2026/i }));
    fireEvent.change(screen.getByPlaceholderText('YYYY-MM-DDTHH:MM'), { target: { value: '2026-09-01T08:00' } });
    fireEvent.keyDown(screen.getByPlaceholderText('YYYY-MM-DDTHH:MM'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: /Aug 1, 2026/i })).toBeInTheDocument();
  });

  it('clears expiry from the action bar', () => {
    const onChange = vi.fn();
    render(<ApiMockResponseExpiresPicker value="2026-08-01T10:00:00.000Z" onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Clear expiry'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

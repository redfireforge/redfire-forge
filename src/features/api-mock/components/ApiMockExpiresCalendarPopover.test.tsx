/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockExpiresCalendarPopover } from './ApiMockExpiresCalendarPopover';

describe('ApiMockExpiresCalendarPopover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 14, 16, 2));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the selected day and time', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <ApiMockExpiresCalendarPopover
        value={new Date(2026, 7, 14, 16, 2).toISOString()}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('August 20, 2026'));
    fireEvent.change(screen.getByTestId('api-mock-expires-cal-hour'), { target: { value: '9' } });
    fireEvent.change(screen.getByTestId('api-mock-expires-cal-minute'), { target: { value: '45' } });
    fireEvent.click(screen.getByTestId('api-mock-expires-cal-apply'));
    expect(onApply).toHaveBeenCalledWith(new Date(2026, 7, 20, 9, 45).toISOString());
  });

  it('navigates months, jumps to today, clears, and closes on Escape', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockExpiresCalendarPopover value={undefined} onApply={onApply} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('api-mock-expires-cal-next'));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-expires-cal-prev'));
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-expires-cal-today'));
    expect(screen.getByLabelText('August 14, 2026')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('api-mock-expires-cal-clear'));
    expect(onApply).toHaveBeenCalledWith(undefined);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

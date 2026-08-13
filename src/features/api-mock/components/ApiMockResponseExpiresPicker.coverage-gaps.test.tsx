/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseExpiresPicker } from './ApiMockResponseExpiresPicker';

describe('ApiMockResponseExpiresPicker coverage gaps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles invalid and empty iso values in display and edit draft', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ApiMockResponseExpiresPicker value="not-a-date" onChange={onChange} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();

    rerender(<ApiMockResponseExpiresPicker value="" onChange={onChange} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();

    const iso = '2026-08-01T10:00:00.000Z';
    rerender(<ApiMockResponseExpiresPicker value={iso} onChange={onChange} />);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0);
      return 0;
    });
    fireEvent.click(screen.getByRole('button', { name: /Aug 1, 2026/i }));
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const expectedDraft = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(screen.getByDisplayValue(expectedDraft)).toBeInTheDocument();
  });

  it('ignores whitespace-only draft on commit', () => {
    const onChange = vi.fn();
    render(<ApiMockResponseExpiresPicker value="2026-08-01T10:00:00.000Z" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Aug 1, 2026/i }));
    fireEvent.change(screen.getByPlaceholderText('YYYY-MM-DDTHH:MM'), { target: { value: '   ' } });
    fireEvent.blur(screen.getByPlaceholderText('YYYY-MM-DDTHH:MM'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

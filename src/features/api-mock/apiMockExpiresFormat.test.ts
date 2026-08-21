import { describe, expect, it, vi } from 'vitest';
import { commitLocalDatetime, formatEligibilitySummary, formatExpiresDisplay, formatTimingSpread, toDatetimeLocal } from './apiMockExpiresFormat';

describe('apiMockExpiresFormat', () => {
  it('formats local datetime and display strings, and ignores empty or invalid ISO', () => {
    expect(toDatetimeLocal()).toBe('');
    expect(toDatetimeLocal('not-a-date')).toBe('');
    expect(formatExpiresDisplay()).toBe('');
    expect(formatExpiresDisplay('nope')).toBe('');

    const iso = new Date(2026, 11, 25, 9, 15).toISOString();
    expect(toDatetimeLocal(iso)).toBe('2026-12-25T09:15');
    expect(formatExpiresDisplay(iso)).toBe('Dec 25, 2026  09:15');
  });

  it('commits a local datetime, clears blanks, and ignores invalid drafts', () => {
    const onChange = vi.fn();
    commitLocalDatetime('  ', onChange);
    expect(onChange).toHaveBeenCalledWith(undefined);
    commitLocalDatetime('not-a-date', onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    commitLocalDatetime('2026-09-15T18:30', onChange);
    expect(onChange).toHaveBeenLastCalledWith(new Date('2026-09-15T18:30').toISOString());
  });

  it('summarises delay spread and eligibility, including an unparseable expiry', () => {
    expect(formatTimingSpread(800, 200)).toBe('800±200 ms');
    expect(formatEligibilitySummary({
      delayMs: 0, jitterMs: 0, maxMatches: undefined, probability: undefined,
    })).toBe('Unlimited matches · Never expires · Always eligible');
    expect(formatEligibilitySummary({
      delayMs: 0, jitterMs: 0, maxMatches: 1, probability: 0.5, expiresAt: '2026-12-01T12:00:00.000Z',
    })).toMatch(/Limit 1/);
    expect(formatEligibilitySummary({
      delayMs: 0, jitterMs: 0, maxMatches: 1, probability: 1, expiresAt: 'not-a-date',
    })).toBe('Limit 1 · Expires not-a-date · Always eligible');
  });
});

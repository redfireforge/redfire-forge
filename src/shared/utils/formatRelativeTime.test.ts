import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime, formatTimestamp, formatTimeWithSeconds, formatDurationCompactMs } from './formatRelativeTime';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "just now" for timestamps less than 1 minute ago', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    expect(formatRelativeTime(1000000)).toBe('just now');
    expect(formatRelativeTime(999970)).toBe('just now'); // 30ms ago
  });

  it('returns minutes ago for timestamps 1-59 minutes ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 60000)).toBe('1m ago');
    expect(formatRelativeTime(now - 5 * 60000)).toBe('5m ago');
    expect(formatRelativeTime(now - 59 * 60000)).toBe('59m ago');
  });

  it('returns hours ago for timestamps 1-23 hours ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 60 * 60000)).toBe('1h ago');
    expect(formatRelativeTime(now - 12 * 60 * 60000)).toBe('12h ago');
    expect(formatRelativeTime(now - 23 * 60 * 60000)).toBe('23h ago');
  });

  it('returns days ago for timestamps 1-6 days ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 24 * 60 * 60000)).toBe('1d ago');
    expect(formatRelativeTime(now - 6 * 24 * 60 * 60000)).toBe('6d ago');
  });

  it('returns days ago for >7 days when no fallback provided', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 10 * 24 * 60 * 60000)).toBe('10d ago');
    expect(formatRelativeTime(now - 30 * 24 * 60 * 60000)).toBe('30d ago');
  });

  it('calls fallback for >7 days when fallback provided', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const ts = now - 10 * 24 * 60 * 60000;
    const fallback = vi.fn().mockReturnValue('Jan 1');
    expect(formatRelativeTime(ts, fallback)).toBe('Jan 1');
    expect(fallback).toHaveBeenCalledWith(ts);
  });

  it('does not call fallback for <7 days even when provided', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const fallback = vi.fn();
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60000, fallback)).toBe('3d ago');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('supports run-history style wording when options passed', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 30_000, undefined, { minuteFormat: 'long', justNow: 'title' })).toBe('Just now');
    expect(formatRelativeTime(now - 5 * 60000, undefined, { minuteFormat: 'long', justNow: 'title' })).toBe('5 min ago');
  });
});

describe('formatTimestamp', () => {
  it('formats a timestamp as a short locale string', () => {
    // Use a fixed timestamp: Jan 15, 2024, 14:30:00 UTC
    const ts = new Date('2024-01-15T14:30:00Z').getTime();
    const result = formatTimestamp(ts);
    // The exact format depends on locale, but it should contain month and day
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should contain "Jan" and "15" in most locales
    expect(result).toMatch(/Jan/i);
    expect(result).toContain('15');
  });

  it('returns a string for edge-case timestamps', () => {
    expect(typeof formatTimestamp(0)).toBe('string');
    expect(typeof formatTimestamp(Date.now())).toBe('string');
  });
});

describe('formatTimeWithSeconds', () => {
  it('returns a locale time string with seconds', () => {
    const ts = new Date('2024-06-15T10:30:45Z').getTime();
    const result = formatTimeWithSeconds(ts);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('handles epoch zero', () => {
    expect(typeof formatTimeWithSeconds(0)).toBe('string');
  });
});

describe('formatDurationCompactMs', () => {
  it('formats sub-second durations as milliseconds', () => {
    expect(formatDurationCompactMs(0)).toBe('0ms');
    expect(formatDurationCompactMs(42)).toBe('42ms');
    expect(formatDurationCompactMs(999)).toBe('999ms');
  });

  it('formats 1000+ as seconds with one decimal', () => {
    expect(formatDurationCompactMs(1000)).toBe('1.0s');
    expect(formatDurationCompactMs(1500)).toBe('1.5s');
    expect(formatDurationCompactMs(12345)).toBe('12.3s');
  });
});

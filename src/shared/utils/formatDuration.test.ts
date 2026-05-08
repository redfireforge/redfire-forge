import { describe, it, expect } from 'vitest';
import formatDurationMsDefault, { formatDurationMs } from './formatDuration';

describe('formatDurationMs', () => {
  it('exports default same as named', () => {
    expect(formatDurationMsDefault).toBe(formatDurationMs);
  });

  it('returns em dash for undefined and null', () => {
    expect(formatDurationMs(undefined)).toBe('—');
    expect(formatDurationMs(null)).toBe('—');
  });

  it('returns <1ms for values in [0, 1)', () => {
    expect(formatDurationMs(0)).toBe('<1ms');
    expect(formatDurationMs(0.3)).toBe('<1ms');
    expect(formatDurationMs(0.99)).toBe('<1ms');
  });

  it('rounds milliseconds for [1, 1000)', () => {
    expect(formatDurationMs(1)).toBe('1ms');
    expect(formatDurationMs(42)).toBe('42ms');
    expect(formatDurationMs(999)).toBe('999ms');
    expect(formatDurationMs(999.4)).toBe('999ms');
    expect(formatDurationMs(999.6)).toBe('1000ms');
    expect(formatDurationMs(999.999)).toBe('1000ms');
  });

  it('formats seconds with two decimals at 1000ms and above', () => {
    expect(formatDurationMs(1000)).toBe('1.00s');
    expect(formatDurationMs(1500)).toBe('1.50s');
    expect(formatDurationMs(60000)).toBe('60.00s');
    expect(formatDurationMs(1234.56)).toBe('1.23s');
  });

  it('treats values below 1 as <1ms including negative durations', () => {
    expect(formatDurationMs(-0.5)).toBe('<1ms');
    expect(formatDurationMs(-5)).toBe('<1ms');
    expect(formatDurationMs(-1500)).toBe('<1ms');
  });
});

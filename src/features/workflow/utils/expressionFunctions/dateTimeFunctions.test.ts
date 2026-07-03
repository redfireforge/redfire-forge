import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dateTimeFunctions } from './dateTimeFunctions';

function fn(name: string) {
  const f = dateTimeFunctions.find((x) => x.name === name);
  if (!f) throw new Error(`missing ${name}`);
  return f.evaluate;
}

describe('dateTimeFunctions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('$now returns ISO string for frozen time', () => {
    expect(fn('$now')()).toBe('2024-06-01T12:00:00.000Z');
  });

  it('$timestamp returns ms for frozen time', () => {
    expect(fn('$timestamp')()).toBe(new Date('2024-06-01T12:00:00.000Z').getTime());
  });

  it('$toIso parses numeric ms', () => {
    expect(fn('$toIso')(1705312200000)).toContain('2024-01-15');
  });

  it('$toIso parses date string', () => {
    expect(fn('$toIso')('2024-01-15T10:30:00.000Z')).toBe('2024-01-15T10:30:00.000Z');
  });

  it('$toIso returns empty string on invalid date', () => {
    expect(fn('$toIso')('not-a-date')).toBe('');
  });

  it('$formatDate uses default pattern', () => {
    expect(fn('$formatDate')('2024-03-05T00:00:00.000Z')).toBe('2024-03-05');
  });

  it('$formatDate accepts numeric timestamp input', () => {
    const ts = Date.parse('2024-03-05T08:09:10.000Z');
    expect(fn('$formatDate')(ts, 'YYYY/MM/DD HH:mm:ss')).toBe('2024/03/05 08:09:10');
  });

  it('$formatDate applies custom tokens', () => {
    expect(fn('$formatDate')('2024-03-05T08:09:10.000Z', 'YYYY/MM/DD HH:mm:ss')).toBe('2024/03/05 08:09:10');
  });

  it('$formatDate returns empty for invalid date', () => {
    expect(fn('$formatDate')('invalid')).toBe('');
  });

  it('$formatDate catches errors from bad format path', () => {
    const evaluate = fn('$formatDate');
    vi.spyOn(Date.prototype, 'getUTCFullYear').mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(evaluate('2024-01-01')).toBe('');
  });

  it('$diffMs subtracts date2 from date1', () => {
    expect(fn('$diffMs')('2024-01-16', '2024-01-15')).toBe(86400000);
  });

  it('$diffMs handles numeric timestamps', () => {
    const d1 = Date.parse('2024-01-16T00:00:00.000Z');
    const d2 = Date.parse('2024-01-15T00:00:00.000Z');
    expect(fn('$diffMs')(d1, d2)).toBe(86400000);
  });

  it('$addDays shifts local date', () => {
    const out = fn('$addDays')('2024-01-15T00:00:00.000Z', 7);
    expect(out).toContain('2024-01-22');
  });

  it('$addDays accepts numeric timestamp input', () => {
    const ts = Date.parse('2024-01-15T00:00:00.000Z');
    const out = fn('$addDays')(ts, 1);
    expect(out).toContain('2024-01-16');
  });

  it('$addDays catches errors', () => {
    vi.spyOn(Date.prototype, 'setDate').mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(fn('$addDays')('2024-01-15', 1)).toBe('');
  });

  it('$addHours shifts time', () => {
    const out = fn('$addHours')('2024-01-15T10:00:00.000Z', 3);
    expect(out).toContain('13:00:00');
  });

  it('$addHours accepts numeric timestamp input', () => {
    const ts = Date.parse('2024-01-15T10:00:00.000Z');
    const out = fn('$addHours')(ts, 2);
    expect(out).toContain('12:00:00');
  });

  it('$addHours catches errors', () => {
    vi.spyOn(Date.prototype, 'setTime').mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(fn('$addHours')('2024-01-15', 1)).toBe('');
  });

  it('$epoch returns ms or 0', () => {
    expect(fn('$epoch')('2024-01-15T10:30:00.000Z')).toBe(new Date('2024-01-15T10:30:00.000Z').getTime());
    expect(fn('$epoch')('not a date')).toBe(0);
  });
});

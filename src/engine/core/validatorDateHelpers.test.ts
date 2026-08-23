import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveDate, toDayString, truncateToUnit } from './validatorDateHelpers';

describe('validatorDateHelpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:34:56.789Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolveDate returns fixed date for fixed references', () => {
    expect(resolveDate({ kind: 'fixed', iso: '2024-01-31T22:15:00.000Z' })).toBe('2024-01-31');
  });

  it('resolveDate returns UTC day string for today/utc', () => {
    expect(resolveDate({ kind: 'today', timezone: 'utc' })).toBe('2026-07-18');
  });

  it('resolveDate returns local day string for today/local', () => {
    expect(resolveDate({ kind: 'today', timezone: 'local' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('toDayString parses yyyy-mm-dd prefix from string', () => {
    expect(toDayString('2026-07-18T12:34:56.789Z')).toBe('2026-07-18');
    expect(toDayString('not-a-date')).toBeNull();
  });

  it('toDayString converts epoch numbers to UTC day strings', () => {
    expect(toDayString(Date.UTC(2026, 6, 18, 10, 0, 0))).toBe('2026-07-18');
  });

  it('toDayString returns null for unsupported value types', () => {
    expect(toDayString(undefined)).toBeNull();
    expect(toDayString({})).toBeNull();
  });

  it('truncateToUnit handles each supported precision', () => {
    const d = new Date('2026-07-18T12:34:56.789Z');
    expect(truncateToUnit(d, 'millisecond')).toBe(d.getTime());
    expect(truncateToUnit(d, 'second')).toBe(Math.floor(d.getTime() / 1000));
    expect(truncateToUnit(d, 'minute')).toBe(Math.floor(d.getTime() / 60000));
    expect(truncateToUnit(d, 'hour')).toBe(Math.floor(d.getTime() / 3600000));
    expect(truncateToUnit(d, 'day')).toBe(Math.floor(d.getTime() / 86400000));
  });
});

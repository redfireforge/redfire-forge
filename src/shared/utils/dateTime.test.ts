import { describe, expect, it } from 'vitest';
import { nowFilenameTimestamp, toFilenameTimestamp, utcDateStamp } from './dateTime';

describe('utcDateStamp', () => {
  it('returns YYYY-MM-DD in UTC', () => {
    expect(utcDateStamp(new Date('2026-07-07T21:22:23.456Z'))).toBe('2026-07-07');
  });
});

describe('toFilenameTimestamp', () => {
  it('replaces colon and dot separators', () => {
    expect(toFilenameTimestamp('2026-07-07T21:22:23.456Z')).toBe('2026-07-07T21-22-23-456Z');
  });

  it('can omit milliseconds while preserving seconds', () => {
    expect(toFilenameTimestamp('2026-07-07T21:22:23.456Z', { includeMilliseconds: false })).toBe('2026-07-07T21-22-23');
  });
});

describe('nowFilenameTimestamp', () => {
  it('returns a filename-safe timestamp string', () => {
    const value = nowFilenameTimestamp();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
  });
});

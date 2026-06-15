import { describe, expect, it } from 'vitest';
import {
  VALID_AUTH_TYPES,
  clampInt,
  sanitizeAuthConfig,
  sanitizeKeyValueEntries,
} from './persistSanitizers';

describe('VALID_AUTH_TYPES', () => {
  it('includes all supported auth type strings', () => {
    expect(VALID_AUTH_TYPES.has('none')).toBe(true);
    expect(VALID_AUTH_TYPES.has('inherit')).toBe(true);
    expect(VALID_AUTH_TYPES.has('basic')).toBe(true);
    expect(VALID_AUTH_TYPES.has('bearer')).toBe(true);
    expect(VALID_AUTH_TYPES.has('apikey')).toBe(true);
    expect(VALID_AUTH_TYPES.has('digest')).toBe(true);
    expect(VALID_AUTH_TYPES.has('oauth2')).toBe(true);
    expect(VALID_AUTH_TYPES.has('weird')).toBe(false);
  });
});

describe('sanitizeKeyValueEntries', () => {
  it('returns empty array for non-array input', () => {
    expect(sanitizeKeyValueEntries(null)).toEqual([]);
    expect(sanitizeKeyValueEntries('bad')).toEqual([]);
    expect(sanitizeKeyValueEntries({ key: 'a' })).toEqual([]);
  });

  it('drops non-object entries and coerces bad fields', () => {
    expect(
      sanitizeKeyValueEntries([
        { key: 'Authorization', value: 'Bearer t', enabled: false },
        { key: 123, value: 456, enabled: 'yes' },
        'not-an-object',
        null,
      ]),
    ).toEqual([
      { key: 'Authorization', value: 'Bearer t', enabled: false },
      { key: '', value: '', enabled: true },
    ]);
  });

  it('defaults missing fields on partial entries', () => {
    expect(sanitizeKeyValueEntries([{ key: 'A' }, { value: 'b', enabled: false }])).toEqual([
      { key: 'A', value: '', enabled: true },
      { key: '', value: 'b', enabled: false },
    ]);
  });
});

describe('sanitizeAuthConfig', () => {
  it('returns undefined for missing or invalid values', () => {
    expect(sanitizeAuthConfig(undefined)).toBeUndefined();
    expect(sanitizeAuthConfig(null)).toBeUndefined();
    expect(sanitizeAuthConfig('nope')).toBeUndefined();
    expect(sanitizeAuthConfig({ type: 'weird' })).toBeUndefined();
  });

  it('preserves a valid auth config object', () => {
    const auth = { type: 'bearer', token: 't' };
    expect(sanitizeAuthConfig(auth)).toEqual(auth);
  });

  it('accepts all VALID_AUTH_TYPES', () => {
    for (const type of VALID_AUTH_TYPES) {
      expect(sanitizeAuthConfig({ type })).toEqual({ type });
    }
  });
});

describe('clampInt', () => {
  it('returns fallback for non-finite or non-number values', () => {
    expect(clampInt(NaN, 1, 10, 5)).toBe(5);
    expect(clampInt(Infinity, 1, 10, 5)).toBe(5);
    expect(clampInt('5', 1, 10, 5)).toBe(5);
    expect(clampInt(undefined, 1, 10, 5)).toBe(5);
  });

  it('clamps values into range and rounds', () => {
    expect(clampInt(999, 1, 50, 5)).toBe(50);
    expect(clampInt(10, 500, 60000, 3000)).toBe(500);
    expect(clampInt(4.7, 1, 10, 5)).toBe(5);
  });

  it('passes through in-range integers', () => {
    expect(clampInt(7, 0, 1000, 3)).toBe(7);
    expect(clampInt(1.5, 1, 50, 5)).toBe(2);
  });
});

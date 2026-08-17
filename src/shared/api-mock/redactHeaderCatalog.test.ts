import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import {
  defaultRedactHeaderList,
  formatRedactHeaderList,
  groupRedactHeaders,
  isRedactHeaderSelected,
  parseRedactHeaderList,
  REDACT_HEADER_CATALOG,
  redactHeaderDefaultEntry,
  titleCaseHeader,
  toggleRedactHeader,
} from './redactHeaderCatalog';

describe('redactHeaderCatalog', () => {
  it('title-cases hyphenated header names for unlabeled defaults', () => {
    expect(titleCaseHeader('x-custom-header')).toBe('X-Custom-Header');
    expect(titleCaseHeader('')).toBe('');
    expect(titleCaseHeader('-secret')).toBe('-Secret');
    expect(redactHeaderDefaultEntry('x-unknown')).toEqual({
      name: 'x-unknown',
      label: 'X-Unknown',
      group: 'default',
      detail: 'Default journal redaction header',
    });
    expect(redactHeaderDefaultEntry('authorization').label).toBe('Authorization');
  });

  it('includes every shipped default header before the extra common names', () => {
    const names = REDACT_HEADER_CATALOG.map(entry => entry.name);
    expect(names.slice(0, DEFAULT_SETTINGS.redaction.headerNames.length))
      .toEqual(DEFAULT_SETTINGS.redaction.headerNames);
    expect(names).toContain('x-csrf-token');
    expect(names).toContain('x-amz-security-token');
    expect(new Set(names).size).toBe(names.length);
  });

  it('parses comma-separated names, trimming and de-duplicating case-insensitively', () => {
    expect(parseRedactHeaderList(' Authorization, cookie,AUTHORIZATION,  ')).toEqual([
      'authorization',
      'cookie',
    ]);
    expect(parseRedactHeaderList('')).toEqual([]);
  });

  it('formats a list back to lowercase comma-separated names', () => {
    expect(formatRedactHeaderList(['Authorization', ' Cookie ', 'authorization'])).toBe(
      'authorization, cookie',
    );
  });

  it('toggles a catalog name in or out of the typed list and keeps custom names', () => {
    expect(toggleRedactHeader('authorization', 'Cookie')).toBe('authorization, cookie');
    expect(toggleRedactHeader('authorization, cookie', 'AUTHORIZATION')).toBe('cookie');
    expect(toggleRedactHeader('x-custom', 'x-csrf-token')).toBe('x-custom, x-csrf-token');
    expect(toggleRedactHeader('authorization', '  ')).toBe('authorization');
  });

  it('reports selection and restores the shipped default list', () => {
    expect(isRedactHeaderSelected('Authorization, Cookie', 'cookie')).toBe(true);
    expect(isRedactHeaderSelected('authorization', 'x-csrf-token')).toBe(false);
    expect(defaultRedactHeaderList()).toBe(DEFAULT_SETTINGS.redaction.headerNames.join(', '));
  });

  it('groups catalog entries into shipped defaults and also-common', () => {
    const groups = groupRedactHeaders();
    expect(groups.map(g => g.group)).toEqual(['default', 'common']);
    expect(groups[0].entries.map(e => e.name)).toEqual(DEFAULT_SETTINGS.redaction.headerNames);
    expect(groups[1].entries.some(e => e.name === 'x-access-token')).toBe(true);
    expect(groupRedactHeaders([])).toEqual([]);
  });
});

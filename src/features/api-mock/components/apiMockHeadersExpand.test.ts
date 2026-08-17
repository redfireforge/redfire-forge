import { beforeEach, describe, expect, it } from 'vitest';
import {
  countNamedHeaderRows,
  createHeaderDraftRow,
  findHeaderRowMatches,
  headerRowsToText,
  headerTextToRows,
  resetHeaderDraftRowIds,
} from './apiMockHeadersExpand';

describe('apiMockHeadersExpand', () => {
  beforeEach(() => {
    resetHeaderDraftRowIds();
  });

  it('parses raw lines, keeps name-only rows, and skips blanks', () => {
    const rows = headerTextToRows('authorization: Bearer tok\n\nInvalidHeader\nx-tenant: acme-eu');
    expect(rows).toEqual([
      { id: 'hdr-1', name: 'authorization', value: 'Bearer tok' },
      { id: 'hdr-2', name: 'InvalidHeader', value: '' },
      { id: 'hdr-3', name: 'x-tenant', value: 'acme-eu' },
    ]);
  });

  it('opens an empty table with one blank row', () => {
    expect(headerTextToRows('')).toEqual([{ id: 'hdr-1', name: '', value: '' }]);
    resetHeaderDraftRowIds();
    expect(headerTextToRows('   \n  ')).toEqual([{ id: 'hdr-1', name: '', value: '' }]);
  });

  it('serializes named rows and drops blanks', () => {
    expect(headerRowsToText([
      createHeaderDraftRow('X-Tenant', 'acme-eu'),
      createHeaderDraftRow('', 'ignored'),
      createHeaderDraftRow('cookie', 'sid=s-2048'),
    ])).toBe('X-Tenant: acme-eu\ncookie: sid=s-2048');
  });

  it('counts named rows and finds case-insensitive matches', () => {
    const rows = headerTextToRows('X-Tenant: acme-eu\nAuthorization: Bearer tok');
    expect(countNamedHeaderRows(rows)).toBe(2);
    expect(countNamedHeaderRows([{ id: 'x', name: '  ', value: '1' }])).toBe(0);
    expect(findHeaderRowMatches(rows, 'tenant')).toEqual([0]);
    expect(findHeaderRowMatches(rows, 'BEARER')).toEqual([1]);
    expect(findHeaderRowMatches(rows, '  ')).toEqual([]);
    expect(findHeaderRowMatches(rows, '')).toEqual([]);
  });
});

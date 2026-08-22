import { describe, expect, it } from 'vitest';
import {
  CONTENT_TYPE_PRESETS,
  COOKIE_FLAG_HELP,
  COOKIE_SAMESITE_OPTIONS,
  CUSTOM_CONTENT_TYPE,
  FAULT_CARDS,
  HTTP_STATUS_CATALOG,
  QUICK_STATUSES,
  STATUS_REASONS,
  kindFromContentType,
} from './apiMockResponseEditorConstants';

describe('apiMockResponseEditorConstants', () => {
  it('exports fault cards and content presets', () => {
    expect(FAULT_CARDS.map(c => c.id)).toEqual(['none', 'timeout', 'reset', 'dribble', 'close', 'malformed']);
    expect(FAULT_CARDS.find(c => c.id === 'timeout')?.description).toMatch(/connection/i);
    expect(CONTENT_TYPE_PRESETS).toContain('application/json');
    expect(CUSTOM_CONTENT_TYPE).toBe('__custom__');
    expect(QUICK_STATUSES).toContain(404);
    expect(STATUS_REASONS[200]).toBe('OK');
    expect(STATUS_REASONS[504]).toBe('Gateway Timeout');
  });

  it('documents cookie flag meanings', () => {
    expect(COOKIE_FLAG_HELP.map(h => h.term)).toEqual([
      'HttpOnly', 'Secure', 'SameSite=Strict', 'SameSite=Lax', 'SameSite=None',
    ]);
    expect(COOKIE_FLAG_HELP.every(h => h.meaning.length > 12)).toBe(true);
    expect(COOKIE_SAMESITE_OPTIONS.map(o => o.value)).toEqual(['Strict', 'Lax', 'None']);
    expect(COOKIE_SAMESITE_OPTIONS.every(o => o.detail.length > 8)).toBe(true);
  });

  it('HTTP_STATUS_CATALOG covers all five ranges with no duplicate codes', () => {
    expect(HTTP_STATUS_CATALOG).toHaveLength(5);
    const allCodes = HTTP_STATUS_CATALOG.flatMap(c => c.entries.map(e => e.code));
    expect(allCodes.length).toBeGreaterThanOrEqual(50);
    expect(new Set(allCodes).size).toBe(allCodes.length);
    for (const cat of HTTP_STATUS_CATALOG) {
      for (const entry of cat.entries) {
        expect(entry.reason.length).toBeGreaterThan(0);
        expect(entry.description.length).toBeGreaterThan(10);
      }
    }
  });

  it('maps Content-Type strings onto body kinds', () => {
    expect(kindFromContentType('application/json')).toBe('json');
    expect(kindFromContentType('application/problem+json')).toBe('json');
    expect(kindFromContentType('text/html')).toBe('html');
    expect(kindFromContentType('application/xml')).toBe('xml');
    expect(kindFromContentType('application/octet-stream')).toBe('binary_base64');
    expect(kindFromContentType('text/plain')).toBe('text');
    expect(kindFromContentType('text/csv')).toBe('text');
    expect(kindFromContentType(undefined)).toBe('text');
    expect(kindFromContentType('image/png')).toBe('text');
  });
});

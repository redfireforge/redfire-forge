import { describe, it, expect } from 'vitest';
import { formatBytes, toErrorMessage, snapshot } from './helpers';

describe('formatBytes', () => {
  it('formats small values as bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes from 1024 upward', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes from 1024^2 upward', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(10485760)).toBe('10.00 MB');
  });
});

describe('toErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('extracts message from TypeError', () => {
    expect(toErrorMessage(new TypeError('bad type'))).toBe('bad type');
  });

  it('converts string to string', () => {
    expect(toErrorMessage('plain string')).toBe('plain string');
  });

  it('converts number to string', () => {
    expect(toErrorMessage(42)).toBe('42');
  });

  it('converts null to string', () => {
    expect(toErrorMessage(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(toErrorMessage(undefined)).toBe('undefined');
  });

  it('converts object to string', () => {
    expect(toErrorMessage({ code: 500 })).toBe('[object Object]');
  });
});

describe('snapshot', () => {
  it('deep-clones a plain object', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = snapshot(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
  });

  it('deep-clones an array', () => {
    const original = [1, [2, 3], { x: 4 }];
    const cloned = snapshot(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[1]).not.toBe(original[1]);
  });

  it('handles primitive values', () => {
    expect(snapshot(42)).toBe(42);
    expect(snapshot('hello')).toBe('hello');
    expect(snapshot(true)).toBe(true);
    expect(snapshot(null)).toBe(null);
  });

  it('drops functions and undefined values', () => {
    const original = { a: 1, fn: () => {}, b: undefined };
    const cloned = snapshot(original);
    expect(cloned).toEqual({ a: 1 });
    expect('fn' in cloned).toBe(false);
    expect('b' in cloned).toBe(false);
  });

  it('produces independent copy (mutations do not propagate)', () => {
    const original = { items: [{ name: 'A' }] };
    const cloned = snapshot(original);
    cloned.items[0].name = 'B';
    expect(original.items[0].name).toBe('A');
  });

  it('handles deeply nested structures', () => {
    const original = { a: { b: { c: { d: { e: 'deep' } } } } };
    const cloned = snapshot(original);
    expect(cloned.a.b.c.d.e).toBe('deep');
    expect(cloned.a.b.c.d).not.toBe(original.a.b.c.d);
  });

  it('handles empty objects and arrays', () => {
    expect(snapshot({})).toEqual({});
    expect(snapshot([])).toEqual([]);
  });
});

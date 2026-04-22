import { describe, it, expect } from 'vitest';
import { formatBytes, toErrorMessage } from './helpers';

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

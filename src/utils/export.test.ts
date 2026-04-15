import { describe, it, expect } from 'vitest';
import { escapeCsv } from './export';

describe('escapeCsv', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsv('ok')).toBe('ok');
    expect(escapeCsv('')).toBe('');
  });

  it('wraps and doubles quotes when value contains comma', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
  });

  it('wraps and escapes embedded double quotes', () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps values that contain newlines', () => {
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
  });
});

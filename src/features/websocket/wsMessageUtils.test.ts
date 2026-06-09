import { describe, it, expect } from 'vitest';
import { isValidJson, prettyJson, tokenizeJson, buildHexDump, buildHexDumpLines, isValidWsUrl, byteLength, isValidBase64, resolveEnvVars, formatTimeAgo, buildBinaryPreview, formatWsTimestamp } from './wsMessageUtils';

describe('isValidJson', () => {
  it('returns true for valid JSON object', () => {
    expect(isValidJson('{"a":1}')).toBe(true);
  });

  it('returns true for valid JSON array', () => {
    expect(isValidJson('[1,2,3]')).toBe(true);
  });

  it('returns false for invalid JSON', () => {
    expect(isValidJson('not json')).toBe(false);
  });

  it('returns true for JSON primitives', () => {
    expect(isValidJson('"hello"')).toBe(true);
    expect(isValidJson('42')).toBe(true);
    expect(isValidJson('true')).toBe(true);
    expect(isValidJson('null')).toBe(true);
  });
});

describe('prettyJson', () => {
  it('formats compact JSON with indentation', () => {
    const result = prettyJson('{"a":1,"b":2}');
    expect(result).toContain('\n');
    expect(result).toContain('  "a"');
  });

  it('returns original string for invalid JSON', () => {
    expect(prettyJson('not json')).toBe('not json');
  });
});

describe('tokenizeJson', () => {
  it('tokenizes a simple JSON object', () => {
    const tokens = tokenizeJson('{"key":"value"}');
    const types = tokens.map(t => t.type);
    expect(types).toContain('key');
    expect(types).toContain('string');
    expect(types).toContain('punct');
  });

  it('tokenizes numbers, booleans, and null', () => {
    const tokens = tokenizeJson('{"n":42,"b":true,"x":null}');
    const types = tokens.map(t => t.type);
    expect(types).toContain('number');
    expect(types).toContain('bool');
    expect(types).toContain('null');
  });

  it('returns empty array for empty string', () => {
    expect(tokenizeJson('')).toHaveLength(0);
  });
});

describe('buildHexDump', () => {
  it('produces hex dump for ASCII text', () => {
    const result = buildHexDump('Hello');
    expect(result).toContain('48 65 6c 6c 6f');
    expect(result).toContain('|Hello');
  });

  it('handles empty string', () => {
    const result = buildHexDump('');
    expect(result).toBe('(empty)');
  });

  it('replaces non-printable chars with dots in ASCII column', () => {
    const result = buildHexDump('\x01\x02\x03');
    expect(result).toContain('|...');
  });

  it('pads short lines with spaces', () => {
    const result = buildHexDump('AB');
    // Should have hex offset + hex bytes + ASCII column
    expect(result).toContain('00000000');
    expect(result).toContain('|AB');
  });
});

describe('isValidWsUrl', () => {
  it('returns true for ws:// URL', () => {
    expect(isValidWsUrl('ws://localhost:8080')).toBe(true);
  });

  it('returns true for wss:// URL', () => {
    expect(isValidWsUrl('wss://example.com/ws')).toBe(true);
  });

  it('returns true with leading/trailing whitespace', () => {
    expect(isValidWsUrl('  ws://localhost  ')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isValidWsUrl('WS://localhost')).toBe(true);
    expect(isValidWsUrl('WSS://example.com')).toBe(true);
  });

  it('returns false for http URLs', () => {
    expect(isValidWsUrl('http://example.com')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidWsUrl('')).toBe(false);
  });
});

describe('byteLength', () => {
  it('returns correct length for ASCII', () => {
    expect(byteLength('hello')).toBe(5);
  });

  it('returns correct length for multi-byte characters', () => {
    expect(byteLength('こんにちは')).toBe(15);
  });

  it('returns 0 for empty string', () => {
    expect(byteLength('')).toBe(0);
  });

  it('returns correct length for emoji', () => {
    expect(byteLength('😀')).toBe(4);
  });
});

describe('isValidBase64', () => {
  it('returns true for valid base64', () => {
    expect(isValidBase64('SGVsbG8=')).toBe(true);
  });

  it('returns true for base64 without padding', () => {
    expect(isValidBase64('SGVsbG8')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidBase64('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isValidBase64('   ')).toBe(false);
  });

  it('returns false for invalid base64', () => {
    expect(isValidBase64('!!!invalid!!!')).toBe(false);
  });

  it('trims whitespace before checking', () => {
    expect(isValidBase64('  SGVsbG8=  ')).toBe(true);
  });
});

describe('resolveEnvVars', () => {
  it('replaces known variables', () => {
    expect(resolveEnvVars('ws://{{host}}:{{port}}/ws', { host: 'localhost', port: '8080' }))
      .toBe('ws://localhost:8080/ws');
  });

  it('leaves unknown variables as-is', () => {
    expect(resolveEnvVars('ws://{{host}}', {})).toBe('ws://{{host}}');
  });

  it('trims variable keys', () => {
    expect(resolveEnvVars('ws://{{ host }}', { host: 'localhost' })).toBe('ws://localhost');
  });

  it('handles strings with no variables', () => {
    expect(resolveEnvVars('ws://localhost', { host: 'x' })).toBe('ws://localhost');
  });

  it('handles empty string', () => {
    expect(resolveEnvVars('', {})).toBe('');
  });

  it('handles multiple occurrences of same variable', () => {
    expect(resolveEnvVars('{{x}}-{{x}}', { x: 'a' })).toBe('a-a');
  });
});

describe('formatTimeAgo', () => {
  it('returns "just now" for timestamps < 60 seconds ago', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('just now');
  });

  it('returns minutes for timestamps 1-59 minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours for timestamps 1-23 hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago');
  });

  it('returns days for timestamps 1-29 days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeDaysAgo)).toBe('3d ago');
  });

  it('returns locale date string for timestamps >= 30 days ago', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatTimeAgo(sixtyDaysAgo);
    expect(result).not.toContain('ago');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns raw string for invalid dates', () => {
    expect(formatTimeAgo('not-a-date')).toBe('not-a-date');
  });
});

describe('formatWsTimestamp', () => {
  it('formats ISO timestamp to HH:mm:ss.SSS', () => {
    // Use a known date: 2025-01-15T14:30:45.123Z
    const d = new Date(2025, 0, 15, 14, 30, 45, 123);
    expect(formatWsTimestamp(d.toISOString())).toBe('14:30:45.123');
  });

  it('pads single-digit values', () => {
    const d = new Date(2025, 0, 1, 1, 2, 3, 4);
    expect(formatWsTimestamp(d.toISOString())).toBe('01:02:03.004');
  });

  it('returns raw string for invalid input', () => {
    expect(formatWsTimestamp('not-a-date')).toBe('not-a-date');
  });
});

describe('buildBinaryPreview', () => {
  it('shows hex preview for valid base64 data', () => {
    // "Hello" = SGVsbG8=
    const result = buildBinaryPreview('SGVsbG8=', 5);
    expect(result).toContain('[5 bytes]');
    expect(result).toContain('0x48');
  });

  it('falls back to TextEncoder for invalid base64', () => {
    const result = buildBinaryPreview('Hello', 5);
    expect(result).toContain('[5 bytes]');
  });

  it('truncates hex display to 8 bytes with ellipsis', () => {
    // 10 bytes of base64
    const data = btoa('1234567890');
    const result = buildBinaryPreview(data, 10);
    expect(result).toContain('...');
    expect(result).toContain('[10 bytes]');
  });

  it('shows all bytes when <= 8', () => {
    const data = btoa('AB');
    const result = buildBinaryPreview(data, 2);
    expect(result).not.toContain('...');
    expect(result).toContain('[2 bytes]');
  });

  it('uses byteCount=0 to fall back to actual length', () => {
    const data = btoa('Hi');
    const result = buildBinaryPreview(data, 0);
    expect(result).toContain('[2 bytes]');
  });
});

describe('buildHexDumpLines', () => {
  it('produces one line for <= 16 bytes', () => {
    const lines = buildHexDumpLines('Hello');
    expect(lines).toHaveLength(1);
    expect(lines[0].offset).toBe('00000000');
    expect(lines[0].ascii).toContain('Hello');
  });

  it('produces multiple lines for > 16 bytes', () => {
    const lines = buildHexDumpLines('1234567890ABCDEF-extra');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1].offset).toBe('00000010');
  });

  it('replaces control chars with dots in ASCII', () => {
    const lines = buildHexDumpLines('\x01\x1f');
    expect(lines[0].ascii).toContain('..');
  });

  it('keeps printable ASCII chars', () => {
    const lines = buildHexDumpLines(' ~');
    expect(lines[0].ascii).toContain(' ~');
  });

  it('pads incomplete rows', () => {
    const lines = buildHexDumpLines('AB');
    // hexLeft should contain the actual hex values followed by padding
    expect(lines[0].hexLeft).toContain('41');
    expect(lines[0].hexLeft).toContain('42');
    // ASCII should show the characters
    expect(lines[0].ascii.trim()).toContain('AB');
  });

  it('returns empty array for empty string', () => {
    expect(buildHexDumpLines('')).toHaveLength(0);
  });
});

describe('tokenizeJson — edge cases', () => {
  it('handles escaped quotes in strings', () => {
    const tokens = tokenizeJson('{"key":"val\\"ue"}');
    const strings = tokens.filter(t => t.type === 'string');
    expect(strings.length).toBeGreaterThanOrEqual(1);
  });

  it('handles scientific notation numbers', () => {
    const tokens = tokenizeJson('{"n":1.5e+10}');
    const nums = tokens.filter(t => t.type === 'number');
    expect(nums).toHaveLength(1);
    expect(nums[0].text).toBe('1.5e+10');
  });

  it('handles negative numbers', () => {
    const tokens = tokenizeJson('{"n":-42}');
    const nums = tokens.filter(t => t.type === 'number');
    expect(nums).toHaveLength(1);
    expect(nums[0].text).toBe('-42');
  });

  it('handles nested objects and arrays', () => {
    const tokens = tokenizeJson('{"a":{"b":[1,2]}}');
    const puncts = tokens.filter(t => t.type === 'punct');
    expect(puncts.length).toBeGreaterThan(4);
  });
});

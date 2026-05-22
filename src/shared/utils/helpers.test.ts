import { describe, it, expect, vi } from 'vitest';
import {
  formatBytes,
  toErrorMessage,
  humanizeError,
  snapshot,
  prettyJson,
  mergeById,
  deepClone,
  formatJson,
  truncate,
  escapeRegExp,
  parseJsonOrRaw,
  isValidJson,
  minifyJson,
} from './helpers';

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

  it('walks error cause chain', () => {
    const root = new Error('getaddrinfo ENOTFOUND example.com');
    (root as NodeJS.ErrnoException).code = 'ENOTFOUND';
    const mid = new Error('fetch failed', { cause: root });
    const top = new Error('request to https://example.com failed', { cause: mid });
    expect(toErrorMessage(top)).toBe('request to https://example.com failed — fetch failed — getaddrinfo ENOTFOUND example.com [ENOTFOUND]');
  });

  it('includes errno code when present', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:443');
    (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';
    expect(toErrorMessage(err)).toBe('connect ECONNREFUSED 127.0.0.1:443 [ECONNREFUSED]');
  });

  it('omits bracketed code when Error has no errno code', () => {
    expect(toErrorMessage(new Error('plain'))).toBe('plain');
  });

  it('formats bigint as string for non-Error values', () => {
    expect(toErrorMessage(1n)).toBe('1');
  });

  it('handles circular cause gracefully', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    // Manually create circular cause
    (a as unknown as { cause: Error }).cause = b;
    expect(toErrorMessage(b)).toBe('b — a');
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

describe('humanizeError', () => {
  it('humanizes ENOTFOUND with hostname', () => {
    const msg = 'fetch failed — getaddrinfo ENOTFOUND api.example.com [ENOTFOUND]';
    const result = humanizeError(msg);
    expect(result).toContain('Server not found');
    expect(result).toContain('api.example.com');
    expect(result).toContain('VPN');
    expect(result).toContain('↳');
  });

  it('humanizes ECONNREFUSED', () => {
    const msg = 'connect ECONNREFUSED 127.0.0.1:443 [ECONNREFUSED]';
    const result = humanizeError(msg);
    expect(result).toContain('Connection refused');
    expect(result).toContain('server may be down');
  });

  it('humanizes ETIMEDOUT', () => {
    const msg = 'connect ETIMEDOUT 10.0.0.1:443 [ETIMEDOUT]';
    const result = humanizeError(msg);
    expect(result).toContain('timed out');
    expect(result).toContain('network or firewall');
  });

  it('humanizes ECONNRESET', () => {
    const msg = 'read ECONNRESET [ECONNRESET]';
    const result = humanizeError(msg);
    expect(result).toContain('reset');
    expect(result).toContain('dropped');
  });

  it('humanizes ECONNRESET with extracted host', () => {
    const msg = 'read ECONNRESET gateway.example.net extra context';
    const result = humanizeError(msg);
    expect(result).toContain('Connection was reset');
    expect(result).toContain('gateway.example.net');
  });

  it('humanizes SSL certificate expired', () => {
    const result = humanizeError('CERT_HAS_EXPIRED');
    expect(result).toContain('SSL certificate has expired');
  });

  it('humanizes self-signed certificate', () => {
    const result = humanizeError('DEPTH_ZERO_SELF_SIGNED_CERT');
    expect(result).toContain('self-signed');
  });

  it('humanizes OAuth2 with nested ENOTFOUND', () => {
    const msg = 'OAuth2 token request failed: fetch failed — getaddrinfo ENOTFOUND auth.example.com [ENOTFOUND]';
    const result = humanizeError(msg);
    expect(result).toContain('Authentication failed');
    expect(result).toContain('Server not found');
    expect(result).toContain('auth.example.com');
  });

  it('humanizes generic fetch failed', () => {
    const result = humanizeError('fetch failed');
    expect(result).toContain('Network request failed');
    expect(result).toContain('connection or VPN');
  });

  it('does not use generic fetch-failed mapping when ENOTFOUND is present', () => {
    const msg = 'fetch failed — getaddrinfo ENOTFOUND x [ENOTFOUND]';
    const result = humanizeError(msg);
    expect(result).toContain('Server not found');
    expect(result).not.toMatch(/Network request failed/);
  });

  it('extracts host from connect <code> <host> when errno token is only in brackets (fallback regex)', () => {
    const msg = 'connect EPIPE srv.example.test [ECONNREFUSED]';
    const result = humanizeError(msg);
    expect(result).toContain('Connection refused');
    expect(result).toContain('srv.example.test');
  });

  it('extracts host from getaddrinfo form when first errno regex does not match host', () => {
    const msg = 'getaddrinfo EBADF api.fallback.com [ENOTFOUND]';
    const result = humanizeError(msg);
    expect(result).toContain('Server not found');
    expect(result).toContain('api.fallback.com');
  });

  it('humanizes ECONNABORTED', () => {
    const result = humanizeError('ECONNABORTED: request timeout');
    expect(result).toContain('Connection was aborted');
  });

  it('humanizes CERT_ALTNAME_INVALID', () => {
    const result = humanizeError('Hostname/IP does not match certificate');
    expect(result).toContain('SSL certificate does not match');
  });

  it('humanizes UNABLE_TO_VERIFY_LEAF_SIGNATURE', () => {
    const result = humanizeError('unable_to_verify_leaf_signature');
    expect(result).toContain('could not be verified');
  });

  it('humanizes EPROTO / SSL routines', () => {
    const result = humanizeError('SSL routines::wrong version number');
    expect(result).toContain('SSL/TLS protocol error');
  });

  it('humanizes EPROTO without ssl routines token', () => {
    const result = humanizeError('EPROTO: invalid protocol');
    expect(result).toContain('SSL/TLS protocol error');
  });

  it('humanizes HTTP status codes like 404, 500', () => {
    const result = humanizeError('404 Not Found');
    expect(result).toBe('404 Not Found');
  });

  it('humanizes HTTP status when leading whitespace is trimmed for matching', () => {
    expect(humanizeError('  418 I\'m a teapot')).toBe('  418 I\'m a teapot');
  });

  it('humanizes 500 status code', () => {
    const result = humanizeError('500 Internal Server Error');
    expect(result).toBe('500 Internal Server Error');
  });

  it('humanizes OAuth2 with non-nested cause', () => {
    const result = humanizeError('OAuth2 token request failed: something unknown');
    expect(result).toContain('Authentication failed');
    expect(result).toContain('could not obtain an access token');
  });

  it('humanizes ENOTFOUND without hostname', () => {
    const result = humanizeError('ENOTFOUND');
    expect(result).toContain('Server not found');
  });

  it('humanizes ECONNREFUSED without hostname', () => {
    const result = humanizeError('ECONNREFUSED');
    expect(result).toContain('Connection refused');
  });

  it('humanizes ETIMEDOUT without hostname', () => {
    const result = humanizeError('ETIMEDOUT');
    expect(result).toContain('timed out');
  });

  it('humanizes ECONNRESET without hostname', () => {
    const result = humanizeError('ECONNRESET');
    expect(result).toContain('reset');
  });

  it('humanizes certificate has expired text', () => {
    const result = humanizeError('certificate has expired');
    expect(result).toContain('SSL certificate has expired');
  });

  it('humanizes self_signed_cert', () => {
    const result = humanizeError('self_signed_cert_in_chain');
    expect(result).toContain('self-signed');
  });

  it('passes through unrecognized errors unchanged', () => {
    expect(humanizeError('Some unknown error')).toBe('Some unknown error');
  });

  it('handles empty string', () => {
    expect(humanizeError('')).toBe('');
  });

  it('humanizes HTTP 0 with CORS', () => {
    const result = humanizeError('CORS error: Access-Control-Allow-Origin missing');
    expect(result).toContain('Cross-origin');
  });

  it('humanizes CORS via access-control-allow-origin substring', () => {
    const result = humanizeError('blocked by CORS policy (no access-control-allow-origin header)');
    expect(result).toContain('Cross-origin');
  });

  it('appends technical line when friendly message does not embed the full technical string', () => {
    const technical = 'ENOTFOUND dns.missing.example.org';
    const result = humanizeError(technical);
    expect(result).toContain('Server not found');
    expect(result).toContain('↳');
    expect(result).toContain(technical);
  });

  it('OAuth2 wraps inner humanized message when inner matches another branch', () => {
    const inner = 'econnrefused 127.0.0.1:9000';
    const msg = `OAuth2 token request failed: ${inner}`;
    const result = humanizeError(msg);
    expect(result).toContain('Authentication failed');
    expect(result).toContain('Connection refused');
  });

  it('returns OAuth2 fallback and appends technical when inner cannot be humanized', () => {
    const msg = 'OAuth2 token request failed: unknown failure code XYZ';
    const result = humanizeError(msg);
    expect(result).toContain(
      'Authentication failed — could not obtain an access token. unknown failure code XYZ',
    );
    expect(result).toContain('↳');
    expect(result).toContain(msg);
  });
});

describe('prettyJson', () => {
  it('pretty-prints valid JSON string', () => {
    const input = '{"name":"test","age":30}';
    const expected = '{\n  "name": "test",\n  "age": 30\n}';
    expect(prettyJson(input)).toBe(expected);
  });

  it('handles already pretty JSON', () => {
    const input = '{\n  "name": "test"\n}';
    expect(prettyJson(input)).toBe(input);
  });

  it('returns original string if not valid JSON', () => {
    const input = 'not valid json';
    expect(prettyJson(input)).toBe(input);
  });

  it('handles JSON arrays', () => {
    const input = '[1,2,3]';
    const expected = '[\n  1,\n  2,\n  3\n]';
    expect(prettyJson(input)).toBe(expected);
  });

  it('handles nested objects', () => {
    const input = '{"user":{"name":"Alice","profile":{"age":25}}}';
    const result = prettyJson(input);
    expect(result).toContain('"user"');
    expect(result).toContain('"profile"');
    expect(result).toContain('25');
  });

  it('returns empty string unchanged', () => {
    expect(prettyJson('')).toBe('');
  });

  it('returns partial JSON unchanged', () => {
    const input = '{"incomplete":';
    expect(prettyJson(input)).toBe(input);
  });
});

describe('formatJson', () => {
  it('returns empty string for undefined and empty', () => {
    expect(formatJson(undefined)).toBe('');
    expect(formatJson('')).toBe('');
  });

  it('matches prettyJson for non-empty input', () => {
    const input = '{"a":1}';
    expect(formatJson(input)).toBe(prettyJson(input));
  });
});

describe('truncate', () => {
  it('returns short strings when prefix limit not exceeded (suffix appended mode)', () => {
    expect(truncate('hi', 100, '...', false)).toBe('hi');
  });

  it('truncates with default append style like former truncateValue', () => {
    const s = 'a'.repeat(101);
    expect(truncate(s, 100, '...', false)).toBe('a'.repeat(100) + '...');
  });

  it('does not truncate when length equals maxLength in append mode', () => {
    const s = 'a'.repeat(100);
    expect(truncate(s, 100, '...', false)).toBe(s);
  });

  it('respects custom maxLength in append mode', () => {
    expect(truncate('hello world', 5, '...', false)).toBe('hello...');
  });

  it('caps total length including suffix when suffixInsideBudget is true', () => {
    expect(truncate('hello world', 5, '…')).toBe('hell…');
    const label = 'a'.repeat(15);
    expect(truncate(label, 15, '…')).toBe(label);
    expect(truncate('a'.repeat(16), 15, '…')).toBe('a'.repeat(14) + '…');
  });

  it('when suffix is longer than maxLen (suffixInsideBudget), returns only a prefix of the suffix', () => {
    expect(truncate('hello', 2, '...', true)).toBe('..');
  });

  it('appends suffix after maxLen chars when suffixInsideBudget is false (total may exceed maxLen)', () => {
    expect(truncate('abcd', 2, '___', false)).toBe('ab___');
  });
});

describe('mergeById', () => {
  it('appends items with new ids', () => {
    const existing = [{ id: '1', name: 'A' }];
    const incoming = [{ id: '2', name: 'B' }];
    expect(mergeById(existing, incoming)).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
  });

  it('skips items whose id already exists', () => {
    const existing = [{ id: '1', name: 'A' }];
    const incoming = [{ id: '1', name: 'A-updated' }, { id: '2', name: 'B' }];
    expect(mergeById(existing, incoming)).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
  });

  it('returns existing array unchanged when incoming is empty', () => {
    const existing = [{ id: '1', name: 'A' }];
    expect(mergeById(existing, [])).toEqual([{ id: '1', name: 'A' }]);
  });

  it('returns incoming items when existing is empty', () => {
    const incoming = [{ id: '1', name: 'A' }];
    expect(mergeById([], incoming)).toEqual([{ id: '1', name: 'A' }]);
  });

  it('handles both empty', () => {
    expect(mergeById([], [])).toEqual([]);
  });

  it('preserves order: existing first, then new incoming', () => {
    const existing = [{ id: '3' }, { id: '1' }];
    const incoming = [{ id: '2' }, { id: '1' }, { id: '4' }];
    expect(mergeById(existing, incoming).map(x => x.id)).toEqual(['3', '1', '2', '4']);
  });
});

describe('deepClone', () => {
  it('creates a deep copy of an object', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
  });

  it('handles arrays', () => {
    const original = [{ id: 1 }, { id: 2 }];
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    cloned[0].id = 99;
    expect(original[0].id).toBe(1);
  });

  it('handles primitives', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(null)).toBe(null);
  });

  it('snapshot delegates to deepClone', () => {
    const obj = { x: [1, 2, 3] };
    const result = snapshot(obj);
    expect(result).toEqual(obj);
    expect(result).not.toBe(obj);
  });

  it('falls back to JSON serialization when structuredClone throws', () => {
    const spy = vi.spyOn(globalThis, 'structuredClone').mockImplementation(() => {
      throw new Error('clone failed');
    });
    const original = { a: 1, nested: { b: 2 } };
    try {
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned.nested).not.toBe(original.nested);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    const pattern = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(pattern);
    expect(new RegExp(`^${escaped}$`).test(pattern)).toBe(true);
    expect(escaped).not.toBe(pattern);
  });

  it('leaves alphanumeric text unchanged', () => {
    expect(escapeRegExp('hello_9')).toBe('hello_9');
  });
});

describe('parseJsonOrRaw', () => {
  it('parses valid JSON', () => {
    expect(parseJsonOrRaw('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON arrays', () => {
    expect(parseJsonOrRaw('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns raw string for invalid JSON', () => {
    expect(parseJsonOrRaw('not json')).toBe('not json');
  });

  it('returns raw string for empty string', () => {
    expect(parseJsonOrRaw('')).toBe('');
  });

  it('parses primitives', () => {
    expect(parseJsonOrRaw('null')).toBe(null);
    expect(parseJsonOrRaw('42')).toBe(42);
    expect(parseJsonOrRaw('"text"')).toBe('text');
  });
});

describe('isValidJson', () => {
  it('returns true for valid JSON objects', () => {
    expect(isValidJson('{"a":1}')).toBe(true);
  });

  it('returns true for valid JSON arrays', () => {
    expect(isValidJson('[1,2]')).toBe(true);
  });

  it('returns false for invalid JSON', () => {
    expect(isValidJson('not json')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidJson('')).toBe(false);
  });

  it('returns true for primitives', () => {
    expect(isValidJson('null')).toBe(true);
    expect(isValidJson('42')).toBe(true);
  });
});

describe('minifyJson', () => {
  it('minifies valid JSON with whitespace', () => {
    const input = '{\n  "name": "test",\n  "age": 30\n}';
    expect(minifyJson(input)).toBe('{"name":"test","age":30}');
  });

  it('returns compact form for already minified JSON', () => {
    const input = '{"a":1}';
    expect(minifyJson(input)).toBe('{"a":1}');
  });

  it('returns null for invalid JSON', () => {
    expect(minifyJson('not json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(minifyJson('')).toBeNull();
  });

  it('handles JSON arrays', () => {
    const input = '[\n  1,\n  2,\n  3\n]';
    expect(minifyJson(input)).toBe('[1,2,3]');
  });

  it('handles nested objects', () => {
    const input = '{\n  "user": {\n    "name": "test"\n  }\n}';
    expect(minifyJson(input)).toBe('{"user":{"name":"test"}}');
  });
});

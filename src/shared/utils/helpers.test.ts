import { describe, it, expect } from 'vitest';
import { formatBytes, toErrorMessage, humanizeError, snapshot, prettyJson, mergeById } from './helpers';

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

  it('humanizes HTTP status codes like 404, 500', () => {
    const result = humanizeError('404 Not Found');
    expect(result).toBe('404 Not Found');
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

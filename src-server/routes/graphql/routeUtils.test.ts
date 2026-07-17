/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { log, HOP_BY_HOP_HEADERS, escapeQuotedString, parseGqlTlsFromBase64Header } from './routeUtils.js';

// ─── log() ────────────────────────────────────────────────────────────────────

describe('log', () => {
  it('calls onLog with a prefixed message when meta is provided', () => {
    const onLog = vi.fn();
    log(onLog, 'info', 'test message', { count: 3 });
    expect(onLog).toHaveBeenCalledOnce();
    const arg = onLog.mock.calls[0][0];
    expect(arg.level).toBe('info');
    expect(arg.message).toBe('[graphql] test message {"count":3}');
    expect(typeof arg.timestamp).toBe('number');
  });

  it('calls onLog without JSON suffix when meta is omitted', () => {
    const onLog = vi.fn();
    log(onLog, 'warn', 'something happened');
    const arg = onLog.mock.calls[0][0];
    expect(arg.message).toBe('[graphql] something happened');
    expect(arg.level).toBe('warn');
  });

  it('does nothing when onLog is undefined', () => {
    expect(() => log(undefined, 'error', 'ignored')).not.toThrow();
  });

  it('passes through all log levels', () => {
    const onLog = vi.fn();
    const levels = ['info', 'warn', 'error'] as const;
    for (const level of levels) {
      log(onLog, level, `${level} msg`);
    }
    expect(onLog).toHaveBeenCalledTimes(3);
    expect(onLog.mock.calls.map((c) => c[0].level)).toEqual(levels);
  });
});

// ─── HOP_BY_HOP_HEADERS ───────────────────────────────────────────────────────

describe('HOP_BY_HOP_HEADERS', () => {
  it('contains connection and keep-alive', () => {
    expect(HOP_BY_HOP_HEADERS.has('connection')).toBe(true);
    expect(HOP_BY_HOP_HEADERS.has('keep-alive')).toBe(true);
  });

  it('contains content-type and content-length', () => {
    expect(HOP_BY_HOP_HEADERS.has('content-type')).toBe(true);
    expect(HOP_BY_HOP_HEADERS.has('content-length')).toBe(true);
  });

  it('contains x-graphql-endpoint and host (must not be forwarded)', () => {
    expect(HOP_BY_HOP_HEADERS.has('x-graphql-endpoint')).toBe(true);
    expect(HOP_BY_HOP_HEADERS.has('host')).toBe(true);
  });

  it('does NOT contain authorization (must be forwarded for auth)', () => {
    expect(HOP_BY_HOP_HEADERS.has('authorization')).toBe(false);
  });

  it('does NOT contain x-custom-header', () => {
    expect(HOP_BY_HOP_HEADERS.has('x-custom-header')).toBe(false);
  });
});

// ─── escapeQuotedString() ─────────────────────────────────────────────────────

describe('escapeQuotedString', () => {
  it('returns the string unchanged when no special characters', () => {
    expect(escapeQuotedString('hello')).toBe('hello');
    expect(escapeQuotedString('file.jpg')).toBe('file.jpg');
  });

  it('escapes double quotes', () => {
    expect(escapeQuotedString('say "hello"')).toBe('say \\"hello\\"');
  });

  it('escapes backslashes before double quotes (RFC 7230 order)', () => {
    expect(escapeQuotedString('C:\\path\\file')).toBe('C:\\\\path\\\\file');
  });

  it('escapes both backslashes and double quotes in one string', () => {
    expect(escapeQuotedString('C:\\say "hello"')).toBe('C:\\\\say \\"hello\\"');
  });

  it('handles empty string', () => {
    expect(escapeQuotedString('')).toBe('');
  });

  it('handles string with only a backslash', () => {
    expect(escapeQuotedString('\\')).toBe('\\\\');
  });
});

// ─── parseGqlTlsFromBase64Header() ────────────────────────────────────────────

describe('parseGqlTlsFromBase64Header', () => {
  it('returns empty object when header is missing or blank', () => {
    expect(parseGqlTlsFromBase64Header(undefined)).toEqual({});
    expect(parseGqlTlsFromBase64Header('   ')).toEqual({});
  });

  it('decodes valid base64 JSON TLS settings', () => {
    const payload = Buffer.from(JSON.stringify({ skipTlsVerify: true }), 'utf8').toString('base64');
    expect(parseGqlTlsFromBase64Header(payload)).toEqual({ skipTlsVerify: true });
  });

  it('returns empty object when base64 payload is invalid JSON', () => {
    const bad = Buffer.from('not-json', 'utf8').toString('base64');
    expect(parseGqlTlsFromBase64Header(bad)).toEqual({});
  });
});

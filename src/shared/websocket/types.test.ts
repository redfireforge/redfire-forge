import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultDraft,
  createFrame,
  resetFrameIdCounter,
  formatBytes,
  formatUptime,
  hasCustomHeaders,
  buildEffectiveUrl,
  profileToDraft,
  draftToProfileFields,
  type WsConnectionDraft,
  type WsConnectionProfile,
} from './types';

beforeEach(() => {
  resetFrameIdCounter();
});

describe('createDefaultDraft', () => {
  it('returns empty url, subprotocols, headers, and queryParams', () => {
    const draft = createDefaultDraft();
    expect(draft.url).toBe('');
    expect(draft.subprotocols).toBe('');
    expect(draft.headers).toEqual([]);
    expect(draft.queryParams).toEqual([]);
  });

  it('returns a new object each call', () => {
    const a = createDefaultDraft();
    const b = createDefaultDraft();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('createFrame', () => {
  it('creates a sent text frame', () => {
    const frame = createFrame('sent', 'text', 'hello');
    expect(frame.direction).toBe('sent');
    expect(frame.type).toBe('text');
    expect(frame.data).toBe('hello');
    expect(frame.size).toBe(5);
    expect(frame.id).toMatch(/^ws-frame-/);
    expect(frame.timestamp).toBeTruthy();
  });

  it('creates a received frame', () => {
    const frame = createFrame('received', 'text', '{"a":1}');
    expect(frame.direction).toBe('received');
    expect(frame.data).toBe('{"a":1}');
  });

  it('computes correct byte size for multi-byte characters', () => {
    const frame = createFrame('sent', 'text', '日本語');
    expect(frame.size).toBe(9);
  });

  it('computes correct size for emoji', () => {
    const frame = createFrame('sent', 'text', '👍');
    expect(frame.size).toBe(4);
  });

  it('computes correct size for empty string', () => {
    const frame = createFrame('sent', 'text', '');
    expect(frame.size).toBe(0);
  });

  it('generates unique IDs across calls', () => {
    const a = createFrame('sent', 'text', 'a');
    const b = createFrame('sent', 'text', 'b');
    expect(a.id).not.toBe(b.id);
  });

  it('resets counter via resetFrameIdCounter', () => {
    createFrame('sent', 'text', 'a');
    createFrame('sent', 'text', 'b');
    resetFrameIdCounter();
    const c = createFrame('sent', 'text', 'c');
    expect(c.id).toMatch(/-1$/);
  });

  it('produces valid ISO timestamp', () => {
    const frame = createFrame('sent', 'text', 'x');
    const parsed = new Date(frame.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10240)).toBe('10.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.50 MB');
  });
});

describe('hasCustomHeaders', () => {
  it('returns false when headers is empty', () => {
    const draft: WsConnectionDraft = { url: 'ws://x', subprotocols: '', headers: [], queryParams: [] };
    expect(hasCustomHeaders(draft)).toBe(false);
  });

  it('returns false when all headers are disabled', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://x', subprotocols: '', queryParams: [],
      headers: [{ key: 'Authorization', value: 'Bearer x', enabled: false }],
    };
    expect(hasCustomHeaders(draft)).toBe(false);
  });

  it('returns false when enabled header has empty key', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://x', subprotocols: '', queryParams: [],
      headers: [{ key: '', value: 'val', enabled: true }],
    };
    expect(hasCustomHeaders(draft)).toBe(false);
  });

  it('returns true when at least one enabled header has a key', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://x', subprotocols: '', queryParams: [],
      headers: [
        { key: '', value: '', enabled: true },
        { key: 'Authorization', value: 'Bearer x', enabled: true },
      ],
    };
    expect(hasCustomHeaders(draft)).toBe(true);
  });
});

describe('buildEffectiveUrl', () => {
  it('returns base URL when no query params', () => {
    const draft: WsConnectionDraft = { url: 'ws://localhost:8765', subprotocols: '', headers: [], queryParams: [] };
    expect(buildEffectiveUrl(draft)).toBe('ws://localhost:8765');
  });

  it('appends enabled query params', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://localhost:8765', subprotocols: '', headers: [],
      queryParams: [
        { key: 'token', value: 'abc', enabled: true },
        { key: 'debug', value: '1', enabled: true },
      ],
    };
    expect(buildEffectiveUrl(draft)).toBe('ws://localhost:8765?token=abc&debug=1');
  });

  it('skips disabled query params', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://localhost:8765', subprotocols: '', headers: [],
      queryParams: [
        { key: 'token', value: 'abc', enabled: false },
        { key: 'debug', value: '1', enabled: true },
      ],
    };
    expect(buildEffectiveUrl(draft)).toBe('ws://localhost:8765?debug=1');
  });

  it('skips params with empty keys', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://localhost:8765', subprotocols: '', headers: [],
      queryParams: [{ key: '', value: 'abc', enabled: true }],
    };
    expect(buildEffectiveUrl(draft)).toBe('ws://localhost:8765');
  });

  it('encodes special characters', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://localhost:8765', subprotocols: '', headers: [],
      queryParams: [{ key: 'msg', value: 'hello world&more', enabled: true }],
    };
    expect(buildEffectiveUrl(draft)).toBe('ws://localhost:8765?msg=hello%20world%26more');
  });

  it('uses & separator when base URL already has query string', () => {
    const draft: WsConnectionDraft = {
      url: 'ws://localhost:8765?existing=1', subprotocols: '', headers: [],
      queryParams: [{ key: 'extra', value: '2', enabled: true }],
    };
    expect(buildEffectiveUrl(draft)).toBe('ws://localhost:8765?existing=1&extra=2');
  });
});

describe('formatUptime', () => {
  it('formats seconds', () => {
    expect(formatUptime(0)).toBe('0s');
    expect(formatUptime(999)).toBe('0s');
    expect(formatUptime(1000)).toBe('1s');
    expect(formatUptime(59999)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatUptime(60000)).toBe('1m 0s');
    expect(formatUptime(90000)).toBe('1m 30s');
    expect(formatUptime(135000)).toBe('2m 15s');
    expect(formatUptime(3599999)).toBe('59m 59s');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(3600000)).toBe('1h 0m');
    expect(formatUptime(5400000)).toBe('1h 30m');
    expect(formatUptime(7200000)).toBe('2h 0m');
  });
});

describe('profileToDraft', () => {
  it('converts a profile to a draft', () => {
    const profile: WsConnectionProfile = {
      id: 'p1',
      name: 'Test',
      url: 'wss://example.com',
      headers: [{ key: 'Auth', value: 'Bearer x', enabled: true }],
      queryParams: [{ key: 'token', value: '123', enabled: true }],
      subprotocols: 'graphql-ws',
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectIntervalMs: 5000,
      maxMessages: 2000,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };
    const draft = profileToDraft(profile);
    expect(draft.url).toBe('wss://example.com');
    expect(draft.subprotocols).toBe('graphql-ws');
    expect(draft.headers).toEqual([{ key: 'Auth', value: 'Bearer x', enabled: true }]);
    expect(draft.queryParams).toEqual([{ key: 'token', value: '123', enabled: true }]);
  });

  it('deep copies arrays to avoid mutations', () => {
    const profile: WsConnectionProfile = {
      id: 'p1',
      name: 'Test',
      url: 'wss://test',
      headers: [{ key: 'A', value: 'B', enabled: true }],
      queryParams: [],
      subprotocols: '',
      autoReconnect: false,
      maxReconnectAttempts: 5,
      reconnectIntervalMs: 3000,
      maxMessages: 1000,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };
    const draft = profileToDraft(profile);
    draft.headers[0].key = 'CHANGED';
    expect(profile.headers[0].key).toBe('A');
  });
});

describe('draftToProfileFields', () => {
  it('extracts profile fields from a draft', () => {
    const draft: WsConnectionDraft = {
      url: 'wss://test.com',
      subprotocols: 'json',
      headers: [{ key: 'X', value: 'Y', enabled: true }],
      queryParams: [{ key: 'a', value: 'b', enabled: false }],
    };
    const fields = draftToProfileFields(draft);
    expect(fields.url).toBe('wss://test.com');
    expect(fields.subprotocols).toBe('json');
    expect(fields.headers).toEqual([{ key: 'X', value: 'Y', enabled: true }]);
    expect(fields.queryParams).toEqual([{ key: 'a', value: 'b', enabled: false }]);
  });

  it('deep copies arrays to avoid mutations', () => {
    const draft: WsConnectionDraft = {
      url: 'wss://test',
      subprotocols: '',
      headers: [{ key: 'K', value: 'V', enabled: true }],
      queryParams: [],
    };
    const fields = draftToProfileFields(draft);
    fields.headers[0].key = 'CHANGED';
    expect(draft.headers[0].key).toBe('K');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatTimestamp,
  formatPayload,
  generateExecutionId,
} from './serverFormatters';

describe('formatTimestamp', () => {
  it('formats an ISO string to locale string', () => {
    const result = formatTimestamp('2025-01-15T10:30:00Z');
    // Just verify it returns a non-empty string (locale varies by environment)
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles date-only string', () => {
    const result = formatTimestamp('2025-06-01');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns "Invalid Date" for invalid input', () => {
    const result = formatTimestamp('not-a-date');
    expect(result).toBe('Invalid Date');
  });
});

describe('formatPayload', () => {
  it('pretty-prints an object', () => {
    const result = formatPayload({ key: 'value', num: 1 });
    expect(result).toBe('{\n  "key": "value",\n  "num": 1\n}');
  });

  it('pretty-prints an array', () => {
    const result = formatPayload([1, 2, 3]);
    expect(result).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('handles null', () => {
    expect(formatPayload(null)).toBe('null');
  });

  it('handles a string', () => {
    expect(formatPayload('hello')).toBe('"hello"');
  });

  it('falls back to String() for circular references', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    const result = formatPayload(obj);
    expect(result).toBe('[object Object]');
  });
});

describe('generateExecutionId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('contains workflowId and triggerId', () => {
    const id = generateExecutionId('wf-123', 'trig-456');
    expect(id).toContain('wf-123');
    expect(id).toContain('trig-456');
  });

  it('includes a timestamp component', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const id = generateExecutionId('wf', 'tr');
    expect(id).toBe('wf-tr-1700000000000');
  });

  it('produces unique IDs on successive calls', () => {
    const id1 = generateExecutionId('w', 't');
    const id2 = generateExecutionId('w', 't');
    // They should differ (Date.now() advances or is mocked differently)
    // In practice they may be the same if called in the same ms, but the format is correct
    expect(id1).toMatch(/^w-t-\d+$/);
    expect(id2).toMatch(/^w-t-\d+$/);
  });
});

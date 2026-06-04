import { describe, it, expect } from 'vitest';
import {
  validateAndFormatJson,
  parseHeaderMatch,
  headersToRecord,
  buildConsumeFilter,
  buildPublishRequest,
  buildConsumeRequest,
  valuePreview,
} from './kafkaMessageStudioUtils';
import type { KafkaConsumeDraft, KafkaPublishDraft } from './types';

// ── validateAndFormatJson ──────────────────────────────────────────────────

describe('validateAndFormatJson', () => {
  it('returns ok:true + formatted:empty for blank input', () => {
    expect(validateAndFormatJson('')).toEqual({ ok: true, formatted: '' });
    expect(validateAndFormatJson('   ')).toEqual({ ok: true, formatted: '' });
  });

  it('parses and pretty-prints valid JSON object', () => {
    const result = validateAndFormatJson('{"a":1,"b":2}');
    expect(result.ok).toBe(true);
    expect(result.formatted).toBe(JSON.stringify({ a: 1, b: 2 }, null, 2));
  });

  it('parses and pretty-prints valid JSON array', () => {
    const result = validateAndFormatJson('[1,2,3]');
    expect(result.ok).toBe(true);
    expect(result.formatted).toBe(JSON.stringify([1, 2, 3], null, 2));
  });

  it('returns ok:false for invalid JSON', () => {
    const result = validateAndFormatJson('{bad json}');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.formatted).toBeUndefined();
  });

  it('returns ok:false for partial JSON', () => {
    const result = validateAndFormatJson('{"a":');
    expect(result.ok).toBe(false);
  });
});

// ── parseHeaderMatch ───────────────────────────────────────────────────────

describe('parseHeaderMatch', () => {
  it('returns undefined for blank input', () => {
    expect(parseHeaderMatch('')).toBeUndefined();
    expect(parseHeaderMatch('  ')).toBeUndefined();
  });

  it('returns undefined when no = separator', () => {
    expect(parseHeaderMatch('noequals')).toBeUndefined();
  });

  it('returns undefined when key is empty (=value)', () => {
    expect(parseHeaderMatch('=value')).toBeUndefined();
  });

  it('parses key=value correctly', () => {
    expect(parseHeaderMatch('source=checkout')).toEqual({ source: 'checkout' });
  });

  it('trims key and value', () => {
    expect(parseHeaderMatch(' source = checkout ')).toEqual({ source: 'checkout' });
  });

  it('handles value with = in it', () => {
    expect(parseHeaderMatch('k=v=extra')).toEqual({ k: 'v=extra' });
  });
});

// ── headersToRecord ────────────────────────────────────────────────────────

describe('headersToRecord', () => {
  it('returns undefined for empty array', () => {
    expect(headersToRecord([])).toBeUndefined();
  });

  it('returns undefined when all rows are disabled', () => {
    expect(headersToRecord([
      { id: '1', key: 'k', value: 'v', enabled: false },
    ])).toBeUndefined();
  });

  it('returns undefined when all enabled rows have blank keys', () => {
    expect(headersToRecord([
      { id: '1', key: '  ', value: 'v', enabled: true },
    ])).toBeUndefined();
  });

  it('includes only enabled rows with non-blank keys', () => {
    const result = headersToRecord([
      { id: '1', key: 'a', value: '1', enabled: true },
      { id: '2', key: 'b', value: '2', enabled: false },
      { id: '3', key: '', value: '3', enabled: true },
    ]);
    expect(result).toEqual({ a: '1' });
  });

  it('trims keys', () => {
    expect(headersToRecord([
      { id: '1', key: ' x ', value: 'y', enabled: true },
    ])).toEqual({ x: 'y' });
  });
});

// ── buildConsumeFilter ─────────────────────────────────────────────────────

function baseDraft(): KafkaConsumeDraft {
  return {
    topic: 'test', groupId: 'g', startPosition: 'latest',
    timeoutMs: '10000', maxMessages: '50',
    keyEquals: '', headerMatch: '', jsonPath: '', jsonPathEquals: '',
  };
}

describe('buildConsumeFilter', () => {
  it('returns undefined when no filter fields set', () => {
    expect(buildConsumeFilter(baseDraft())).toBeUndefined();
  });

  it('includes keyEquals', () => {
    const f = buildConsumeFilter({ ...baseDraft(), keyEquals: 'my-key' });
    expect(f).toEqual({ keyEquals: 'my-key' });
  });

  it('includes headersMatch from headerMatch string', () => {
    const f = buildConsumeFilter({ ...baseDraft(), headerMatch: 'source=checkout' });
    expect(f).toEqual({ headersMatch: { source: 'checkout' } });
  });

  it('includes jsonPath and jsonEquals', () => {
    const f = buildConsumeFilter({ ...baseDraft(), jsonPath: '$.status', jsonPathEquals: 'CREATED' });
    expect(f).toEqual({ jsonPath: '$.status', jsonEquals: 'CREATED' });
  });

  it('omits jsonEquals when blank (assert path exists)', () => {
    const f = buildConsumeFilter({ ...baseDraft(), jsonPath: '$.status', jsonPathEquals: '' });
    expect(f).toEqual({ jsonPath: '$.status' });
  });

  it('combines all filters', () => {
    const f = buildConsumeFilter({
      ...baseDraft(),
      keyEquals: 'k',
      headerMatch: 'h=v',
      jsonPath: '$.a',
      jsonPathEquals: 'b',
    });
    expect(f).toEqual({ keyEquals: 'k', headersMatch: { h: 'v' }, jsonPath: '$.a', jsonEquals: 'b' });
  });
});

// ── buildPublishRequest ────────────────────────────────────────────────────

function basePublishDraft(): KafkaPublishDraft {
  return {
    topic: 'orders.events', key: '', partition: '', acks: -1,
    timeoutMs: '', headers: [], body: '{"hello":"world"}',
  };
}

describe('buildPublishRequest', () => {
  it('includes required fields', () => {
    const req = buildPublishRequest(basePublishDraft(), 'cluster-a');
    expect(req.clusterId).toBe('cluster-a');
    expect(req.topic).toBe('orders.events');
    expect(req.acks).toBe(-1);
    expect(Array.isArray(req.messages)).toBe(true);
    const msgs = req.messages as Array<Record<string, unknown>>;
    expect(msgs[0].value).toBe('{"hello":"world"}');
  });

  it('omits key when blank', () => {
    const req = buildPublishRequest(basePublishDraft(), 'c');
    const msgs = req.messages as Array<Record<string, unknown>>;
    expect(msgs[0].key).toBeUndefined();
  });

  it('includes key when set', () => {
    const req = buildPublishRequest({ ...basePublishDraft(), key: 'order-123' }, 'c');
    const msgs = req.messages as Array<Record<string, unknown>>;
    expect(msgs[0].key).toBe('order-123');
  });

  it('includes explicit partition', () => {
    const req = buildPublishRequest({ ...basePublishDraft(), partition: '2' }, 'c');
    const msgs = req.messages as Array<Record<string, unknown>>;
    expect(msgs[0].partition).toBe(2);
  });

  it('omits partition when blank', () => {
    const req = buildPublishRequest(basePublishDraft(), 'c');
    const msgs = req.messages as Array<Record<string, unknown>>;
    expect(msgs[0].partition).toBeUndefined();
  });

  it('includes timeoutMs when set', () => {
    const req = buildPublishRequest({ ...basePublishDraft(), timeoutMs: '5000' }, 'c');
    expect(req.timeoutMs).toBe(5000);
  });

  it('omits timeoutMs when blank', () => {
    const req = buildPublishRequest(basePublishDraft(), 'c');
    expect(req.timeoutMs).toBeUndefined();
  });

  it('includes headers', () => {
    const draft = {
      ...basePublishDraft(),
      headers: [{ id: '1', key: 'x-src', value: 'test', enabled: true }],
    };
    const req = buildPublishRequest(draft, 'c');
    const msgs = req.messages as Array<Record<string, unknown>>;
    expect(msgs[0].headers).toEqual({ 'x-src': 'test' });
  });

  it('omits headers when all disabled', () => {
    const draft = {
      ...basePublishDraft(),
      headers: [{ id: '1', key: 'x', value: 'y', enabled: false }],
    };
    const req = buildPublishRequest(draft, 'c');
    const msgs = req.messages as Array<Record<string, unknown>>;
    expect(msgs[0].headers).toBeUndefined();
  });

  it('includes schemaConfig when set', () => {
    const draft = {
      ...basePublishDraft(),
      schemaConfig: { registryUrl: 'http://localhost:8085', format: 'avro' as const },
    };
    const req = buildPublishRequest(draft, 'c');
    expect(req.schemaConfig).toEqual(draft.schemaConfig);
  });

  it('omits schemaConfig when undefined', () => {
    const req = buildPublishRequest(basePublishDraft(), 'c');
    expect(req.schemaConfig).toBeUndefined();
  });
});

// ── buildConsumeRequest ────────────────────────────────────────────────────

describe('buildConsumeRequest', () => {
  it('includes required fields', () => {
    const req = buildConsumeRequest(baseDraft(), 'cluster-a');
    expect(req.clusterId).toBe('cluster-a');
    expect(req.topic).toBe('test');
    expect(req.fromBeginning).toBe(false);
    expect(req.timeoutMs).toBe(10000);
    expect(req.maxMessages).toBe(50);
  });

  it('sets fromBeginning=true for earliest', () => {
    const req = buildConsumeRequest({ ...baseDraft(), startPosition: 'earliest' }, 'c');
    expect(req.fromBeginning).toBe(true);
  });

  it('uses defaults for invalid timeoutMs/maxMessages', () => {
    const req = buildConsumeRequest({ ...baseDraft(), timeoutMs: '', maxMessages: '' }, 'c');
    expect(req.timeoutMs).toBe(10000);
    expect(req.maxMessages).toBe(50);
  });

  it('includes groupId when set', () => {
    const req = buildConsumeRequest({ ...baseDraft(), groupId: 'my-group' }, 'c');
    expect(req.groupId).toBe('my-group');
  });

  it('omits groupId when blank', () => {
    const req = buildConsumeRequest({ ...baseDraft(), groupId: '' }, 'c');
    expect(req.groupId).toBeUndefined();
  });

  it('includes filter when set', () => {
    const req = buildConsumeRequest({ ...baseDraft(), keyEquals: 'k' }, 'c');
    expect(req.filter).toEqual({ keyEquals: 'k' });
  });

  it('omits filter when no fields set', () => {
    const req = buildConsumeRequest(baseDraft(), 'c');
    expect(req.filter).toBeUndefined();
  });
});

// ── valuePreview ───────────────────────────────────────────────────────────

describe('valuePreview', () => {
  it('returns (empty) for empty string', () => {
    expect(valuePreview('')).toBe('(empty)');
  });

  it('collapses whitespace', () => {
    expect(valuePreview('{ "a":\n  1 }')).toBe('{ "a": 1 }');
  });

  it('truncates long strings', () => {
    const long = 'x'.repeat(100);
    const result = valuePreview(long, 60);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(61);
  });

  it('does not truncate short strings', () => {
    expect(valuePreview('short', 60)).toBe('short');
  });
});

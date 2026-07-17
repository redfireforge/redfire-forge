import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssertionContext } from './validator';
import {
  compare,
  formatOp,
  handleStatus,
  handleResponseTime,
  handleHeader,
  handleRegex,
  handleArrayLength,
  handleNumeric,
  handleDate,
  handleDatePrecise,
  handleTypeCheck,
  handleExistence,
  handleArrayContains,
  handleEach,
  handleContainsSubset,
  handleJsonSchema,
  handleBodySize,
  handleKafkaField,
  handleWsField,
  handleWsNumericField,
  handleCustom,
} from './validatorAssertionHandlers';

vi.mock('../features/workflow/utils/expressionEvaluator', () => ({
  evaluateExpression: vi.fn(),
  formatExpressionResult: vi.fn((v: unknown) => String(v)),
}));

import { evaluateExpression } from '../features/workflow/utils/expressionEvaluator';

const baseCtx: AssertionContext = {
  httpStatus: 200,
  responseTimeMs: 50,
  responseHeaders: { 'content-type': 'application/json', 'x-id': 'abc' },
  responseBody: { name: 'Alice', items: [1, 2, 3], tags: ['a', 'b'] },
  rawBody: '{"name":"Alice"}',
};

describe('compare / formatOp', () => {
  it('compare returns false for unknown operator (default branch)', () => {
    expect(compare(1, '???' as never, 1)).toBe(false);
  });

  it('compare handles all standard operators', () => {
    expect(compare(5, '=', 5)).toBe(true);
    expect(compare(5, '!=', 4)).toBe(true);
    expect(compare(5, '>', 3)).toBe(true);
    expect(compare(5, '>=', 5)).toBe(true);
    expect(compare(3, '<', 5)).toBe(true);
    expect(compare(3, '<=', 3)).toBe(true);
  });

  it('formatOp returns unknown operator unchanged (default branch)', () => {
    expect(formatOp('???' as never)).toBe('???');
  });

  it('formatOp maps known operators', () => {
    expect(formatOp('!=')).toBe('≠');
    expect(formatOp('<=')).toBe('≤');
    expect(formatOp('=')).toBe('=');
    expect(formatOp('>')).toBe('>');
    expect(formatOp('<')).toBe('<');
  });
});

describe('handler success paths', () => {
  it('handleStatus passes on match', () => {
    expect(handleStatus({ type: 'status', expected: '200' }, baseCtx)).toEqual([]);
  });

  it('handleResponseTime passes when within limit', () => {
    expect(handleResponseTime({ type: 'responseTime', maxMs: 100 }, baseCtx)).toEqual([]);
  });

  it('handleHeader passes on match', () => {
    expect(handleHeader(
      { type: 'header', name: 'content-type', operator: 'contains', value: 'json' },
      baseCtx,
    )).toEqual([]);
  });

  it('handleRegex passes when pattern matches', () => {
    expect(handleRegex({ type: 'regex', jsonPath: '$.name', pattern: 'Alice' }, baseCtx)).toEqual([]);
  });

  it('handleRegex handles undefined path value', () => {
    const failures = handleRegex(
      { type: 'regex', jsonPath: '$.missing', pattern: 'x' },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('undefined');
  });

  it('handleArrayLength passes and fails compare branch', () => {
    expect(handleArrayLength(
      { type: 'arrayLength', jsonPath: '$.items', operator: '=', value: 3 },
      baseCtx,
    )).toEqual([]);
    const failures = handleArrayLength(
      { type: 'arrayLength', jsonPath: '$.items', operator: '>', value: 10 },
      baseCtx,
    );
    expect(failures).toHaveLength(1);
  });

  it('handleArrayLength fails on undefined path', () => {
    const failures = handleArrayLength(
      { type: 'arrayLength', jsonPath: '$.missing', operator: '=', value: 1 },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('undefined');
  });

  it('handleNumeric passes and fails NaN/compare branches', () => {
    expect(handleNumeric(
      { type: 'numeric', jsonPath: '$.items[0]', operator: '=', value: 1 },
      baseCtx,
    )).toEqual([]);
    const nanFailures = handleNumeric(
      { type: 'numeric', jsonPath: '$.name', operator: '=', value: 1 },
      baseCtx,
    );
    expect(nanFailures[0]?.actual).toContain('not a number');
    const cmpFailures = handleNumeric(
      { type: 'numeric', jsonPath: '$.items[0]', operator: '>', value: 99 },
      baseCtx,
    );
    expect(cmpFailures).toHaveLength(1);
  });

  it('handleDate fails undefined branch', () => {
    const failures = handleDate(
      { type: 'date', jsonPath: '$.missing', operator: '=', reference: '2024-01-01' },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('undefined');
  });

  it('handleDate fails on non-date values and comparison mismatch', () => {
    const notDate = handleDate(
      { type: 'date', jsonPath: '$.name', operator: '=', reference: '2024-01-01' },
      baseCtx,
    );
    expect(notDate[0]?.actual).toContain('not a date');
    const mismatch = handleDate(
      { type: 'date', jsonPath: '$.when', operator: '=', reference: '2024-01-01' },
      { ...baseCtx, responseBody: { when: '2024-06-15T12:00:00.000Z' } },
    );
    expect(mismatch).toHaveLength(1);
  });

  it('handleDatePrecise passes and fails undefined/compare branches', () => {
    expect(handleDatePrecise(
      { type: 'datePrecise', jsonPath: '$.ts', operator: '=', reference: '2024-06-01T12:00:00Z', precision: 'day' },
      { ...baseCtx, responseBody: { ts: '2024-06-01T15:00:00Z' } },
    )).toEqual([]);
    expect(handleDatePrecise(
      { type: 'datePrecise', jsonPath: '$.missing', operator: '=', reference: '2024-06-01T12:00:00Z', precision: 'day' },
      baseCtx,
    )[0]?.actual).toBe('undefined');
    expect(handleDatePrecise(
      { type: 'datePrecise', jsonPath: '$.ts', operator: '>', reference: '2024-06-01T12:00:00Z', precision: 'day' },
      { ...baseCtx, responseBody: { ts: '2024-01-01T00:00:00Z' } },
    )).toHaveLength(1);
  });

  it('handleTypeCheck passes and fails mismatch', () => {
    expect(handleTypeCheck(
      { type: 'typeCheck', jsonPath: '$.name', expectedType: 'string' },
      baseCtx,
    )).toEqual([]);
    const failures = handleTypeCheck(
      { type: 'typeCheck', jsonPath: '$.name', expectedType: 'number' },
      baseCtx,
    );
    expect(failures).toHaveLength(1);
  });

  it('handleExistence passes for both polarities', () => {
    expect(handleExistence(
      { type: 'existence', jsonPath: '$.name', expectExists: true },
      baseCtx,
    )).toEqual([]);
    expect(handleExistence(
      { type: 'existence', jsonPath: '$.missing', expectExists: false },
      baseCtx,
    )).toEqual([]);
  });
});

describe('handleStatus / handleResponseTime / handleHeader', () => {
  it('handleStatus fails on mismatch', () => {
    const failures = handleStatus({ type: 'status', expected: '200' }, { ...baseCtx, httpStatus: 404 });
    expect(failures).toHaveLength(1);
  });

  it('handleResponseTime fails when over max', () => {
    const failures = handleResponseTime({ type: 'responseTime', maxMs: 10 }, baseCtx);
    expect(failures[0]?.path).toBe('(responseTime)');
  });

  it('handleHeader fails on bad operator result', () => {
    const failures = handleHeader(
      { type: 'header', name: 'x-missing', operator: 'equals', value: 'x' },
      baseCtx,
    );
    expect(failures).toHaveLength(1);
  });
});

describe('handleRegex', () => {
  it('truncates long non-matching values in failure message', () => {
    const longVal = 'x'.repeat(300);
    const failures = handleRegex(
      { type: 'regex', jsonPath: '$.name', pattern: '^nomatch$' },
      { ...baseCtx, responseBody: { name: longVal } },
    );
    expect(failures[0]?.actual.endsWith('…')).toBe(true);
  });

  it('reports invalid regex pattern', () => {
    const failures = handleRegex({ type: 'regex', jsonPath: '$.name', pattern: '[bad' }, baseCtx);
    expect(failures[0]?.actual).toBe('invalid regex pattern');
  });

  it('stringifies non-string matched values', () => {
    const failures = handleRegex(
      { type: 'regex', jsonPath: '$.items', pattern: '^\\[1' },
      baseCtx,
    );
    expect(failures).toHaveLength(0);
  });
});

describe('handleArrayLength / handleNumeric / handleDate', () => {
  it('handleArrayLength fails on non-array', () => {
    const failures = handleArrayLength(
      { type: 'arrayLength', jsonPath: '$.name', operator: '=', value: 1 },
      baseCtx,
    );
    expect(failures[0]?.actual).toContain('not an array');
  });

  it('handleNumeric fails on undefined', () => {
    const failures = handleNumeric(
      { type: 'numeric', jsonPath: '$.missing', operator: '=', value: 1 },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('undefined');
  });

  it('handleDate fails on invalid date value', () => {
    const failures = handleDate(
      { type: 'date', jsonPath: '$.name', operator: '=', reference: '2024-01-01' },
      baseCtx,
    );
    expect(failures[0]?.actual).toContain('not a date');
  });
});

describe('handleDatePrecise', () => {
  it('fails on invalid reference date', () => {
    const failures = handleDatePrecise(
      { type: 'datePrecise', jsonPath: '$.ts', operator: '=', reference: 'not-a-date', precision: 'day' },
      { ...baseCtx, responseBody: { ts: '2024-06-01T12:00:00Z' } },
    );
    expect(failures[0]?.actual).toContain('invalid reference');
  });
});

describe('handleTypeCheck / handleExistence', () => {
  it('handleTypeCheck fails when path missing', () => {
    const failures = handleTypeCheck(
      { type: 'typeCheck', jsonPath: '$.missing', expectedType: 'string' },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('path not found');
  });

  it('handleExistence fails when field should not exist but does', () => {
    const failures = handleExistence(
      { type: 'existence', jsonPath: '$.name', expectExists: false },
      baseCtx,
    );
    expect(failures[0]?.expected).toBe('field does not exist');
  });

  it('handleExistence fails when field should exist but does not', () => {
    const failures = handleExistence(
      { type: 'existence', jsonPath: '$.missing', expectExists: true },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('field not found');
  });
});

describe('handleArrayContains', () => {
  it('any mode passes when a match exists', () => {
    expect(handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.items', value: '2', mode: 'any' },
      baseCtx,
    )).toEqual([]);
  });

  it('fails on undefined and non-array targets', () => {
    const undef = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.missing', value: '1', mode: 'any' },
      baseCtx,
    );
    expect(undef[0]?.actual).toBe('undefined');
    const nonArr = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.name', value: '1', mode: 'any' },
      baseCtx,
    );
    expect(nonArr[0]?.actual).toContain('not an array');
  });

  it('only mode wraps scalar parsed value in array', () => {
    const failures = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.tags', value: '"a"', mode: 'only' },
      { ...baseCtx, responseBody: { ...baseCtx.responseBody, tags: ['a'] } },
    );
    expect(failures).toHaveLength(0);
  });

  it('all mode passes when every item matches', () => {
    expect(handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.items', value: '1', mode: 'all' },
      { ...baseCtx, responseBody: { items: [1, 1, 1] } },
    )).toEqual([]);
  });

  it('none mode passes when no item matches', () => {
    expect(handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.items', value: '99', mode: 'none' },
      baseCtx,
    )).toEqual([]);
  });

  it('only mode reports unmatched-only failures', () => {
    const failures = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.pairs', value: '[1, 99, 100]', mode: 'only' },
      { ...baseCtx, responseBody: { pairs: [1, 99] } },
    );
    expect(failures[0]?.actual).toContain('missing');
    expect(failures[0]?.actual).not.toContain('extras');
  });

  it('only mode reports extras-only failures', () => {
    const failures = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.items', value: '[1]', mode: 'only' },
      baseCtx,
    );
    expect(failures[0]?.actual).toContain('extras');
  });

  it('only mode reports missing and extra items', () => {
    const failures = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.items', value: '[1, 99]', mode: 'only' },
      baseCtx,
    );
    expect(failures[0]?.actual).toContain('missing');
    expect(failures[0]?.actual).toContain('extras');
  });

  it('all mode reports partial failures', () => {
    const failures = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.items', value: '99', mode: 'all' },
      baseCtx,
    );
    expect(failures[0]?.actual).toContain('did not match');
  });

  it('none mode fails when a match is found', () => {
    const failures = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.items', value: '2', mode: 'none' },
      baseCtx,
    );
    expect(failures[0]?.actual).toContain('index');
  });

  it('object subset matching in any mode', () => {
    const failures = handleArrayContains(
      { type: 'arrayContains', jsonPath: '$.rows', value: '{"id":1}', mode: 'any' },
      { ...baseCtx, responseBody: { rows: [{ id: 1, extra: true }] } },
    );
    expect(failures).toHaveLength(0);
  });
});

describe('handleEach', () => {
  it('evaluates elements directly when fieldPath is omitted', () => {
    const failures = handleEach(
      { type: 'each', jsonPath: '$.items', operator: 'greater_than', value: '0' },
      baseCtx,
    );
    expect(failures).toHaveLength(0);
  });

  it('summarises up to three failures without truncation suffix', () => {
    const failures = handleEach(
      { type: 'each', jsonPath: '$.items', operator: 'equals', value: '99' },
      baseCtx,
    );
    expect(failures[0]?.actual).not.toContain('… and');
    expect(failures[0]?.actual).toContain('3 of 3 failed');
  });

  it('passes with fieldPath and reports >3 failure truncation', () => {
    const ctx: AssertionContext = {
      ...baseCtx,
      responseBody: { rows: Array.from({ length: 5 }, (_, i) => ({ n: i })) },
    };
    expect(handleEach(
      { type: 'each', jsonPath: '$.rows', fieldPath: 'n', operator: 'greater_than_or_equal', value: '0' },
      ctx,
    )).toEqual([]);
    const failures = handleEach(
      { type: 'each', jsonPath: '$.rows', fieldPath: 'n', operator: 'equals', value: '99' },
      ctx,
    );
    expect(failures[0]?.actual).toContain('… and 2 more');
  });

  it('supports operators without value in expected summary', () => {
    const failures = handleEach(
      { type: 'each', jsonPath: '$.flags', fieldPath: 'on', operator: 'is_true' },
      { ...baseCtx, responseBody: { flags: [{ on: true }, { on: false }] } },
    );
    expect(failures[0]?.expected).not.toContain('undefined');
    expect(failures[0]?.expected).toContain('is_true');
  });

  it('fails on undefined and non-array targets', () => {
    expect(handleEach(
      { type: 'each', jsonPath: '$.missing', operator: 'equals', value: '1' },
      baseCtx,
    )[0]?.actual).toBe('undefined');
    expect(handleEach(
      { type: 'each', jsonPath: '$.name', operator: 'equals', value: '1' },
      baseCtx,
    )[0]?.actual).toContain('not an array');
  });
});

describe('handleContainsSubset', () => {
  it('passes on matching subset', () => {
    expect(handleContainsSubset(
      { type: 'containsSubset', jsonPath: '$.name', expected: '"Alice"' },
      baseCtx,
    )).toEqual([]);
  });

  it('fails on undefined path', () => {
    const failures = handleContainsSubset(
      { type: 'containsSubset', jsonPath: '$.missing', expected: '{"a":1}' },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('undefined');
  });

  it('includes nested path in failure when subset mismatch has path', () => {
    const failures = handleContainsSubset(
      { type: 'containsSubset', jsonPath: '$.user', expected: '{"name":"Bob"}' },
      { ...baseCtx, responseBody: { user: { name: 'Alice' } } },
    );
    expect(failures[0]?.path).toContain('.name');
  });

  it('uses fallback actual when subset mismatch omits nested path suffix', () => {
    const failures = handleContainsSubset(
      { type: 'containsSubset', jsonPath: '$.name', expected: '42' },
      baseCtx,
    );
    expect(failures[0]?.path).toContain('(containsSubset:$.name');
  });

  it('reports invalid expected JSON', () => {
    const failures = handleContainsSubset(
      { type: 'containsSubset', jsonPath: '$.name', expected: '{bad' },
      baseCtx,
    );
    expect(failures[0]?.actual).toBe('invalid JSON in expected');
  });
});

describe('handleJsonSchema', () => {
  it('passes when body matches schema', () => {
    expect(handleJsonSchema(
      { type: 'jsonSchema', schema: '{"type":"object","properties":{"name":{"type":"string"}}}' },
      baseCtx,
      0,
    )).toEqual([]);
  });

  it('uses keyword fallback when error message is absent', () => {
    const failures = handleJsonSchema(
      { type: 'jsonSchema', schema: '{"type":"object","required":["missing"]}' },
      baseCtx,
      0,
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]?.expected).toBeTruthy();
  });

  it('reports non-Error schema failures', () => {
    const origParse = JSON.parse;
    JSON.parse = (() => {
      throw 'schema-boom';
    }) as typeof JSON.parse;
    try {
      const failures = handleJsonSchema(
        { type: 'jsonSchema', schema: '{"type":"object"}' },
        baseCtx,
        2,
      );
      expect(failures[0]?.actual).toBe('invalid schema');
    } finally {
      JSON.parse = origParse;
    }
  });
});

describe('handleBodySize', () => {
  it('fails when body exceeds bytes threshold', () => {
    const failures = handleBodySize(
      { type: 'bodySize', operator: '<', value: 1, unit: 'bytes' },
      { ...baseCtx, rawBody: 'hello' },
    );
    expect(failures[0]?.path).toBe('(bodySize)');
  });

  it('evaluates kb unit threshold', () => {
    const failures = handleBodySize(
      { type: 'bodySize', operator: '<', value: 1, unit: 'kb' },
      { ...baseCtx, rawBody: 'hello world' },
    );
    expect(failures).toHaveLength(0);
  });

  it('evaluates mb unit threshold and fails with MB label', () => {
    const failures = handleBodySize(
      { type: 'bodySize', operator: '>', value: 1, unit: 'mb' },
      { ...baseCtx, rawBody: 'x' },
    );
    expect(failures[0]?.actual).toContain('MB');
  });

  it('derives size from null responseBody as empty string', () => {
    const failures = handleBodySize(
      { type: 'bodySize', operator: '=', value: 0, unit: 'bytes' },
      { ...baseCtx, rawBody: undefined, responseBody: null },
    );
    expect(failures).toHaveLength(0);
  });
});

describe('handleKafkaField', () => {
  const kafkaCtx: AssertionContext = {
    ...baseCtx,
    rawBody: '{"status":"ok"}',
    kafkaContext: { key: 'k1', partition: 2, offset: 100, topic: 'orders' },
  };

  it('reads kafka.body from rawBody', () => {
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: 'ok' },
      kafkaCtx,
    )).toHaveLength(0);
  });

  it('reads kafka.body from string responseBody when rawBody missing', () => {
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: 'payload' },
      { ...kafkaCtx, rawBody: undefined, responseBody: 'payload-data' },
    )).toHaveLength(0);
  });

  it('reads kafka.key / partition / offset', () => {
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.key', operator: 'equals', value: 'k1' },
      kafkaCtx,
    )).toHaveLength(0);
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.partition', operator: 'equals', value: '2' },
      kafkaCtx,
    )).toHaveLength(0);
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.offset', operator: 'equals', value: '100' },
      kafkaCtx,
    )).toHaveLength(0);
  });

  it('reads kafka.header.* and fails when missing', () => {
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.header.x-id', operator: 'equals', value: 'abc' },
      kafkaCtx,
    )).toHaveLength(0);
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.header.missing', operator: 'exists' },
      kafkaCtx,
    )).toHaveLength(1);
  });

  it('reads kafka.body from object responseBody via JSON.stringify', () => {
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: 'Alice' },
      { ...kafkaCtx, rawBody: undefined, responseBody: { name: 'Alice' } },
    )).toHaveLength(0);
  });

  it('fails when kafka partition and offset are undefined', () => {
    const ctx = { ...kafkaCtx, kafkaContext: { key: 'k1', topic: 'orders' } };
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.partition', operator: 'exists' },
      ctx,
    )).toHaveLength(1);
    expect(handleKafkaField(
      { type: 'kafkaField', target: 'kafka.offset', operator: 'exists' },
      ctx,
    )).toHaveLength(1);
  });
});

describe('handleWsField / handleWsNumericField', () => {
  const wsCtx: AssertionContext = {
    ...baseCtx,
    responseBody: { data: { orderId: 'ORD-1', count: 2 } },
    wsContext: {
      connectionId: 'conn-1',
      frameType: 'text',
      protocol: 'graphql-ws',
      messageSize: 128,
      latencyMs: 45,
      url: 'wss://example/ws',
    },
  };

  it('reads ws.body from JSON-stringified responseBody', () => {
    expect(handleWsField(
      { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'ORD-1' },
      { ...wsCtx, rawBody: undefined },
    )).toHaveLength(0);
  });

  it('reads ws.body from string responseBody when rawBody missing', () => {
    expect(handleWsField(
      { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'payload' },
      { ...wsCtx, rawBody: undefined, responseBody: 'payload-data' },
    )).toHaveLength(0);
  });

  it('fails wsField when value does not match', () => {
    const failures = handleWsField(
      { type: 'wsField', target: 'ws.type', operator: 'equals', value: 'binary' },
      wsCtx,
    );
    expect(failures).toHaveLength(1);
  });

  it('reads ws metadata fields and headers', () => {
    expect(handleWsField(
      { type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text' },
      wsCtx,
    )).toHaveLength(0);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.protocol', operator: 'equals', value: 'graphql-ws' },
      wsCtx,
    )).toHaveLength(0);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.connectionId', operator: 'equals', value: 'conn-1' },
      wsCtx,
    )).toHaveLength(0);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.size', operator: 'equals', value: '128' },
      wsCtx,
    )).toHaveLength(0);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.latencyMs', operator: 'equals', value: '45' },
      wsCtx,
    )).toHaveLength(0);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.header.content-type', operator: 'contains', value: 'json' },
      wsCtx,
    )).toHaveLength(0);
  });

  it('reads ws.$.jsonPath with undefined and non-string values', () => {
    expect(handleWsField(
      { type: 'wsField', target: 'ws.$.missing', operator: 'equals', value: 'x' },
      wsCtx,
    )).toHaveLength(1);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.$.data.orderId', operator: 'equals', value: 'ORD-1' },
      wsCtx,
    )).toHaveLength(0);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.$.data.count', operator: 'equals', value: '2' },
      wsCtx,
    )).toHaveLength(0);
  });

  it('fails when ws size/latency and header targets are missing', () => {
    const sparse = { ...wsCtx, wsContext: { connectionId: 'c1', frameType: 'text' as const } };
    expect(handleWsField(
      { type: 'wsField', target: 'ws.size', operator: 'exists' },
      sparse,
    )).toHaveLength(1);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.latencyMs', operator: 'exists' },
      sparse,
    )).toHaveLength(1);
    expect(handleWsField(
      { type: 'wsField', target: 'ws.header.X-Missing', operator: 'exists' },
      sparse,
    )).toHaveLength(1);
  });

  it('handleWsNumericField covers latency and size success paths', () => {
    expect(handleWsNumericField(
      { type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 100 },
      wsCtx,
    )).toHaveLength(0);
    expect(handleWsNumericField(
      { type: 'wsNumericField', target: 'ws.size', operator: '<=', value: 256 },
      wsCtx,
    )).toHaveLength(0);
    const failures = handleWsNumericField(
      { type: 'wsNumericField', target: 'ws.size', operator: '>', value: 1000 },
      wsCtx,
    );
    expect(failures).toHaveLength(1);
  });

  it('handleWsNumericField reports undefined numeric target', () => {
    const failures = handleWsNumericField(
      { type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 1 },
      { ...wsCtx, wsContext: { ...wsCtx.wsContext, latencyMs: undefined } },
    );
    expect(failures[0]?.actual).toBe('undefined');
  });
});

describe('handleCustom', () => {
  beforeEach(() => {
    vi.mocked(evaluateExpression).mockReset();
  });

  it('fails on empty expression', () => {
    expect(handleCustom({ type: 'custom', expression: '  ' }, baseCtx, '')).toHaveLength(1);
  });

  it('fails when expression returns error', () => {
    vi.mocked(evaluateExpression).mockReturnValue({ value: null, error: 'bad expr' });
    const failures = handleCustom({ type: 'custom', expression: '$bad()' }, baseCtx, 'NOT ');
    expect(failures[0]?.actual).toContain('expression error');
  });

  it('fails when predicate is falsy and includes description', () => {
    vi.mocked(evaluateExpression).mockReturnValue({ value: false, error: undefined });
    const failures = handleCustom(
      { type: 'custom', expression: 'false', description: 'must be true' },
      baseCtx,
      '',
    );
    expect(failures[0]?.expected).toContain('must be true');
  });

  it('passes when predicate is truthy', () => {
    vi.mocked(evaluateExpression).mockReturnValue({ value: true, error: undefined });
    expect(handleCustom({ type: 'custom', expression: 'true' }, baseCtx, '')).toHaveLength(0);
  });

  it('reports runtime errors from evaluateExpression throw', () => {
    vi.mocked(evaluateExpression).mockImplementation(() => {
      throw new Error('boom');
    });
    const failures = handleCustom({ type: 'custom', expression: 'throw' }, baseCtx, '');
    expect(failures[0]?.actual).toContain('runtime error: boom');
  });

  it('fails when predicate is falsy without description', () => {
    vi.mocked(evaluateExpression).mockReturnValue({ value: false, error: undefined });
    const failures = handleCustom({ type: 'custom', expression: 'false' }, baseCtx, '');
    expect(failures[0]?.expected).not.toContain('(');
  });

  it('resolves $ shorthand alias for body', () => {
    vi.mocked(evaluateExpression).mockImplementation((_expr, ctx) => {
      const resolve = ctx?.resolveVariable as (name: string) => unknown;
      expect(resolve('$.body')).toEqual(baseCtx.responseBody);
      expect(resolve('$')).toEqual(baseCtx.responseBody);
      expect(resolve('$.status')).toBe(200);
      expect(resolve('$.responseTime')).toBe(50);
      expect(resolve('$.headers')).toEqual(baseCtx.responseHeaders);
      expect(resolve('$.rawBody')).toBe('{"name":"Alice"}');
      expect(resolve('$.body.name')).toBe('Alice');
      expect(resolve('$.headers.content-type')).toBe('application/json');
      expect(resolve('$.items')).toEqual([1, 2, 3]);
      expect(resolve('kafka.body')).toBe('{"name":"Alice"}');
      expect(resolve('kafka.key')).toBe('k1');
      expect(resolve('kafka.partition')).toBe(2);
      expect(resolve('kafka.offset')).toBe(100);
      expect(resolve('kafka.topic')).toBe('orders');
      expect(resolve('kafka.header.x-id')).toBe('abc');
      expect(resolve('ws.body')).toBe('{"name":"Alice"}');
      expect(resolve('ws.type')).toBe('text');
      expect(resolve('ws.protocol')).toBe('graphql-ws');
      expect(resolve('ws.connectionId')).toBe('conn-1');
      expect(resolve('ws.latencyMs')).toBe(45);
      expect(resolve('ws.size')).toBe(128);
      expect(resolve('ws.url')).toBe('wss://example/ws');
      expect(resolve('ws.header.content-type')).toBe('application/json');
      expect(resolve('unknown.var')).toBeUndefined();
      return { value: true, error: undefined };
    });

    const ctx: AssertionContext = {
      ...baseCtx,
      kafkaContext: { key: 'k1', partition: 2, offset: 100, topic: 'orders' },
      wsContext: {
        connectionId: 'conn-1',
        frameType: 'text',
        protocol: 'graphql-ws',
        messageSize: 128,
        latencyMs: 45,
        url: 'wss://example/ws',
      },
    };

    expect(handleCustom({ type: 'custom', expression: 'check all vars' }, ctx, '')).toHaveLength(0);
  });

  it('handles non-Error runtime throw values', () => {
    vi.mocked(evaluateExpression).mockImplementation(() => {
      throw 'string-failure';
    });
    const failures = handleCustom({ type: 'custom', expression: 'x' }, baseCtx, '');
    expect(failures[0]?.actual).toContain('string-failure');
  });
});

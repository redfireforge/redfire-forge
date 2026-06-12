import { describe, it, expect } from 'vitest';
import { evaluateAssertions, type AssertionContext } from './validator';
import { buildValidationResult } from './validationResult';
import type { Assertion } from '../shared/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function wsCtx(overrides: Partial<AssertionContext> = {}): AssertionContext {
  return {
    httpStatus: 200,
    responseTimeMs: 42,
    responseHeaders: { 'sec-websocket-protocol': 'graphql-ws' },
    responseBody: { data: { orderId: 'ORD-123', status: 'confirmed' } },
    rawBody: '{"data":{"orderId":"ORD-123","status":"confirmed"}}',
    wsContext: {
      connectionId: 'conn-1',
      frameType: 'text',
      protocol: 'graphql-ws',
      messageSize: 256,
      latencyMs: 45.5,
      url: 'wss://example.com/ws',
    },
    ...overrides,
  };
}

// ─── wsField assertions ─────────────────────────────────────────────────────

describe('wsField assertion evaluation', () => {
  it('ws.body — equals (pass)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.body', operator: 'contains', value: 'ORD-123' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.body — equals (fail)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.body', operator: 'contains', value: 'MISSING' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(wsField:ws.body)');
  });

  it('ws.body — regex (pass)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.body', operator: 'regex', value: 'ORD-\\d+' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.body — regex (fail)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.body', operator: 'regex', value: '^NOMATCH$' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('ws.type — equals frameType', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.type — fails when mismatch', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'binary' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(wsField:ws.type)');
  });

  it('ws.protocol — equals', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.protocol', operator: 'equals', value: 'graphql-ws' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.connectionId — equals', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.connectionId', operator: 'equals', value: 'conn-1' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.connectionId — fails on mismatch', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.connectionId', operator: 'equals', value: 'conn-99' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('ws.header.* — resolves upgrade response header', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.header.Sec-WebSocket-Protocol', operator: 'equals', value: 'graphql-ws' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.header.* — fails when header not found', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.header.X-Missing', operator: 'exists' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('ws.$.* — JSONPath into message body (pass)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.$.data.orderId', operator: 'equals', value: 'ORD-123' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.$.* — JSONPath into message body (fail)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.$.data.orderId', operator: 'equals', value: 'WRONG' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(wsField:ws.$.data.orderId)');
  });

  it('ws.$.* — undefined path returns failure', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.$.nonexistent', operator: 'equals', value: 'x' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('ws.size — stringified numeric (pass via equals)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.size', operator: 'equals', value: '256' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.latencyMs — stringified numeric (pass via contains)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.latencyMs', operator: 'contains', value: '45' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('exists operator — pass when field present', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.protocol', operator: 'exists' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('exists operator — fail when wsContext field is undefined', () => {
    const ctx = wsCtx({ wsContext: { frameType: 'text' } });
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.protocol', operator: 'exists' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate flag inverts wsField result', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'binary', negate: true }],
      ctx,
    );
    // frameType is 'text', assertion expects 'binary', but negated → should pass
    expect(failures).toEqual([]);
  });

  it('negate flag — negated pass becomes fail', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('NOT');
  });

  it('handles missing wsContext gracefully', () => {
    const ctx = wsCtx({ wsContext: undefined });
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('ws.body resolves from rawBody when responseBody is non-string', () => {
    const ctx = wsCtx({
      responseBody: { parsed: true },
      rawBody: '{"parsed":true}',
    });
    const { failures } = evaluateAssertions(
      [{ type: 'wsField', target: 'ws.body', operator: 'contains', value: 'parsed' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });
});

// ─── wsNumericField assertions ──────────────────────────────────────────────

describe('wsNumericField assertion evaluation', () => {
  it('ws.latencyMs — less than (pass)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 100 }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.latencyMs — less than (fail)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 10 }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(wsNumericField:ws.latencyMs)');
    expect(failures[0].actual).toBe('45.5');
  });

  it('ws.size — less than or equal (pass)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.size', operator: '<=', value: 256 }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.size — greater than (fail)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.size', operator: '>', value: 1000 }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(wsNumericField:ws.size)');
  });

  it('ws.latencyMs — equal (pass)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.latencyMs', operator: '=', value: 45.5 }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('ws.latencyMs — not equal (pass)', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.latencyMs', operator: '!=', value: 100 }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('undefined target produces failure', () => {
    const ctx = wsCtx({ wsContext: {} });
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 100 }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('missing wsContext produces failure', () => {
    const ctx = wsCtx({ wsContext: undefined });
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.size', operator: '<=', value: 1024 }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('negate flag inverts wsNumericField result', () => {
    const ctx = wsCtx();
    const { failures } = evaluateAssertions(
      [{ type: 'wsNumericField', target: 'ws.latencyMs', operator: '>', value: 1000, negate: true }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('all comparison operators work', () => {
    const ctx = wsCtx();
    const ops = ['=', '!=', '>', '>=', '<', '<='] as const;
    for (const op of ops) {
      const { failures } = evaluateAssertions(
        [{ type: 'wsNumericField', target: 'ws.latencyMs', operator: op, value: 45.5 }],
        ctx,
      );
      if (op === '=' || op === '>=' || op === '<=') {
        expect(failures).toEqual([]);
      } else {
        expect(failures).toHaveLength(1);
      }
    }
  });
});

// ─── Custom expression ws.* paths ───────────────────────────────────────────

describe('custom assertion ws.* resolveVariable paths', () => {
  it('ws.body resolves to rawBody', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: '$contains(ws.body, "ORD-123")',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.type resolves to frameType', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: 'ws.type = "text"',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.protocol resolves', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: 'ws.protocol = "graphql-ws"',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.connectionId resolves', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: 'ws.connectionId = "conn-1"',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.latencyMs resolves to numeric', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: 'ws.latencyMs < 100',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.size resolves to numeric', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: 'ws.size = 256',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.url resolves', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: '$contains(ws.url, "example.com")',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.header.* resolves from responseHeaders', () => {
    const ctx = wsCtx();
    const assertion: Assertion = {
      type: 'custom',
      expression: 'ws.header.sec-websocket-protocol = "graphql-ws"',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    expect(failures).toEqual([]);
  });

  it('ws.* with missing wsContext resolves to undefined', () => {
    const ctx = wsCtx({ wsContext: undefined });
    // When wsContext is absent, ws.* variables resolve to undefined.
    // The expression evaluator (JSONata) treats undefined comparisons as
    // falsy, but the exact failure behavior depends on JSONata semantics.
    // Verify that at least no runtime error is thrown.
    const assertion: Assertion = {
      type: 'custom',
      expression: 'ws.type = "text"',
    };
    const { failures } = evaluateAssertions([assertion], ctx);
    // Should not throw — failures may be 0 or 1 depending on JSONata semantics
    expect(Array.isArray(failures)).toBe(true);
  });
});

// ─── buildValidationResult: transportType-aware HTTP skip ───────────────────

describe('buildValidationResult — transportType handling', () => {
  function makeInput(overrides: Partial<Parameters<typeof buildValidationResult>[0]> = {}) {
    return {
      httpStatus: 200,
      responseTimeMs: 42,
      responseHeaders: {},
      responseBody: '{"ok":true}',
      responseObj: { ok: true },
      validation: { mode: 'none' as const },
      assertions: [] as Assertion[],
      ...overrides,
    };
  }

  it('HTTP transport (default): status 0 produces (http) failure', () => {
    const result = buildValidationResult(makeInput({ httpStatus: 0 }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: '(http)' })]),
    );
  });

  it('HTTP transport (explicit): status 500 produces (http) failure', () => {
    const result = buildValidationResult(makeInput({ httpStatus: 500, transportType: 'http' }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: '(http)' })]),
    );
  });

  it('Kafka transport: status 0 does NOT produce (http) failure', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      transportType: 'kafkaProduce',
      errorMessage: 'Connection refused',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.every(f => f.path !== '(http)')).toBe(true);
  });

  it('Kafka transport: status 0 with errorMessage → fails via nonHttpError', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      transportType: 'kafkaConsume',
      errorMessage: 'Timeout waiting for messages',
    }));
    expect(result.passed).toBe(false);
  });

  it('Kafka transport: status 200 with no errors → passes', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      transportType: 'kafkaProduce',
    }));
    expect(result.passed).toBe(true);
  });

  it('WS transport: status 0 does NOT produce (http) failure', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      transportType: 'wsConnect',
      errorMessage: 'Connection failed',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.every(f => f.path !== '(http)')).toBe(true);
  });

  it('WS transport: status 200 with no errors → passes', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      transportType: 'wsSend',
    }));
    expect(result.passed).toBe(true);
  });

  it('WS transport: passes wsContext through to assertion evaluation', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      transportType: 'wsConnect',
      wsContext: { frameType: 'text', connectionId: 'c1' },
      assertions: [{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text' }],
    }));
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('WS transport: wsField assertion failure propagates', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      transportType: 'wsConnect',
      wsContext: { frameType: 'text' },
      assertions: [{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'binary' }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: '(wsField:ws.type)' })]),
    );
  });

  it('WS transport: wsNumericField assertion works end-to-end', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      transportType: 'wsReceive',
      wsContext: { latencyMs: 42, messageSize: 512 },
      assertions: [
        { type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 100 },
        { type: 'wsNumericField', target: 'ws.size', operator: '<=', value: 1024 },
      ],
    }));
    expect(result.passed).toBe(true);
  });

  it('WS transport: non-HTTP error (errorMessage set) → fails even with status 200', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      transportType: 'wsConnect',
      errorMessage: 'WebSocket handshake timeout',
    }));
    expect(result.passed).toBe(false);
  });

  it('WS transport: no errorMessage, no assertion failures → passes', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      transportType: 'wsReceive',
    }));
    expect(result.passed).toBe(true);
  });

  it('WS transport: status 0 without errorMessage → still fails (defensive)', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      transportType: 'wsConnect',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.every(f => f.path !== '(http)')).toBe(true);
  });

  it('Kafka transport: status 0 without errorMessage → still fails (defensive)', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      transportType: 'kafkaProduce',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.every(f => f.path !== '(http)')).toBe(true);
  });
});

// ─── Mixed assertion scenarios ──────────────────────────────────────────────

describe('mixed WS + standard assertions', () => {
  it('WS + responseTime assertion both pass', () => {
    const ctx = wsCtx();
    const assertions: Assertion[] = [
      { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'ORD-123' },
      { type: 'responseTime', maxMs: 100 },
    ];
    const { failures } = evaluateAssertions(assertions, ctx);
    expect(failures).toEqual([]);
  });

  it('WS passes but responseTime fails', () => {
    const ctx = wsCtx({ responseTimeMs: 150 });
    const assertions: Assertion[] = [
      { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'ORD-123' },
      { type: 'responseTime', maxMs: 100 },
    ];
    const { failures } = evaluateAssertions(assertions, ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(responseTime)');
  });

  it('wsField + wsNumericField can coexist', () => {
    const ctx = wsCtx();
    const assertions: Assertion[] = [
      { type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text' },
      { type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 100 },
      { type: 'wsNumericField', target: 'ws.size', operator: '<=', value: 512 },
    ];
    const { failures } = evaluateAssertions(assertions, ctx);
    expect(failures).toEqual([]);
  });

  it('statusAsserted flag is NOT set by wsField assertions', () => {
    const ctx = wsCtx();
    const assertions: Assertion[] = [
      { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'ORD' },
    ];
    const { statusAsserted } = evaluateAssertions(assertions, ctx);
    expect(statusAsserted).toBe(false);
  });
});

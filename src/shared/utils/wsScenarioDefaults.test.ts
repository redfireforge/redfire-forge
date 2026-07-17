import { describe, it, expect } from 'vitest';
import {
  createDefaultWsConnectAction,
  createDefaultWsSendAction,
  createDefaultWsReceiveAction,
  isWsScenario,
  resolveWsActionType,
  getWsActionType,
  validateWsActionConfig,
  ensureScenarioDefaults,
} from './wsScenarioDefaults';
import type {
  Scenario,
  WsConnectActionConfig,
  WsSendActionConfig,
  WsReceiveActionConfig,
} from '../types';

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeTest(id: string, overrides: Partial<Scenario> = {}): Scenario {
  return {
    id,
    name: `Test ${id}`,
    url: '/api',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  } as Scenario;
}

// ─── createDefaultWsConnectAction ────────────────────────────────────────────

describe('createDefaultWsConnectAction', () => {
  it('sets url from argument', () => {
    const config = createDefaultWsConnectAction('ws://localhost:8080');
    expect(config.url).toBe('ws://localhost:8080');
  });

  it('defaults url to empty string when not provided', () => {
    const config = createDefaultWsConnectAction();
    expect(config.url).toBe('');
  });

  it('fills default timeoutMs to 10000', () => {
    const config = createDefaultWsConnectAction();
    expect(config.timeoutMs).toBe(10_000);
  });

  it('leaves optional headers/queryParams/subprotocols/protocolMode/tlsConfig/connectionId absent', () => {
    const config = createDefaultWsConnectAction();
    expect(config.headers).toBeUndefined();
    expect(config.queryParams).toBeUndefined();
    expect(config.subprotocols).toBeUndefined();
    expect(config.protocolMode).toBeUndefined();
    expect(config.tlsConfig).toBeUndefined();
    expect(config.connectionId).toBeUndefined();
  });

  it('satisfies WsConnectActionConfig shape (compile-time via assignment)', () => {
    const _check: WsConnectActionConfig = createDefaultWsConnectAction('ws://test');
    expect(_check).toBeTruthy();
  });
});

// ─── createDefaultWsSendAction ──────────────────────────────────────────────

describe('createDefaultWsSendAction', () => {
  it('sets message from argument', () => {
    const config = createDefaultWsSendAction('{"type":"ping"}');
    expect(config.message).toBe('{"type":"ping"}');
  });

  it('defaults message to empty string when not provided', () => {
    const config = createDefaultWsSendAction();
    expect(config.message).toBe('');
  });

  it('defaults messageType to "text"', () => {
    expect(createDefaultWsSendAction().messageType).toBe('text');
  });

  it('defaults waitForResponse to false', () => {
    expect(createDefaultWsSendAction().waitForResponse).toBe(false);
  });

  it('defaults responseTimeoutMs to 5000', () => {
    expect(createDefaultWsSendAction().responseTimeoutMs).toBe(5_000);
  });

  it('leaves optional connectionRef/url absent', () => {
    const config = createDefaultWsSendAction();
    expect(config.connectionRef).toBeUndefined();
    expect(config.url).toBeUndefined();
  });

  it('satisfies WsSendActionConfig shape (compile-time via assignment)', () => {
    const _check: WsSendActionConfig = createDefaultWsSendAction('msg');
    expect(_check).toBeTruthy();
  });
});

// ─── createDefaultWsReceiveAction ───────────────────────────────────────────

describe('createDefaultWsReceiveAction', () => {
  it('defaults timeoutMs to 10000', () => {
    expect(createDefaultWsReceiveAction().timeoutMs).toBe(10_000);
  });

  it('leaves optional connectionRef/url/matchCriteria absent', () => {
    const config = createDefaultWsReceiveAction();
    expect(config.connectionRef).toBeUndefined();
    expect(config.url).toBeUndefined();
    expect(config.matchCriteria).toBeUndefined();
  });

  it('satisfies WsReceiveActionConfig shape (compile-time via assignment)', () => {
    const _check: WsReceiveActionConfig = createDefaultWsReceiveAction();
    expect(_check).toBeTruthy();
  });
});

// ─── resolveWsActionType ────────────────────────────────────────────────────

describe('resolveWsActionType', () => {
  it('returns "http" when actionType is absent (backward compat)', () => {
    expect(resolveWsActionType(makeTest('t1'))).toBe('http');
  });

  it('returns "http" when actionType is explicitly "http"', () => {
    expect(resolveWsActionType(makeTest('t1', { actionType: 'http' }))).toBe('http');
  });

  it('returns "wsConnect" when actionType is "wsConnect"', () => {
    expect(resolveWsActionType(makeTest('t1', { actionType: 'wsConnect' }))).toBe('wsConnect');
  });

  it('returns "wsSend" when actionType is "wsSend"', () => {
    expect(resolveWsActionType(makeTest('t1', { actionType: 'wsSend' }))).toBe('wsSend');
  });

  it('returns "wsReceive" when actionType is "wsReceive"', () => {
    expect(resolveWsActionType(makeTest('t1', { actionType: 'wsReceive' }))).toBe('wsReceive');
  });

  it('returns Kafka action types unchanged', () => {
    expect(resolveWsActionType(makeTest('t1', { actionType: 'kafkaProduce' }))).toBe('kafkaProduce');
    expect(resolveWsActionType(makeTest('t1', { actionType: 'kafkaConsume' }))).toBe('kafkaConsume');
  });
});

// ─── isWsScenario ───────────────────────────────────────────────────────────

describe('isWsScenario', () => {
  it('returns false for standard HTTP scenario (no actionType)', () => {
    expect(isWsScenario(makeTest('t1'))).toBe(false);
  });

  it('returns false for explicit actionType "http"', () => {
    expect(isWsScenario(makeTest('t1', { actionType: 'http' }))).toBe(false);
  });

  it('returns false for Kafka scenarios', () => {
    expect(isWsScenario(makeTest('t1', { actionType: 'kafkaProduce' }))).toBe(false);
    expect(isWsScenario(makeTest('t1', { actionType: 'kafkaConsume' }))).toBe(false);
  });

  it('returns true for wsConnect', () => {
    expect(isWsScenario(makeTest('t1', { actionType: 'wsConnect' }))).toBe(true);
  });

  it('returns true for wsSend', () => {
    expect(isWsScenario(makeTest('t1', { actionType: 'wsSend' }))).toBe(true);
  });

  it('returns true for wsReceive', () => {
    expect(isWsScenario(makeTest('t1', { actionType: 'wsReceive' }))).toBe(true);
  });
});

// ─── getWsActionType ────────────────────────────────────────────────────────

describe('getWsActionType', () => {
  it('returns undefined for HTTP scenario', () => {
    expect(getWsActionType(makeTest('t1'))).toBeUndefined();
  });

  it('returns undefined for Kafka scenario', () => {
    expect(getWsActionType(makeTest('t1', { actionType: 'kafkaProduce' }))).toBeUndefined();
  });

  it('returns "wsConnect" for wsConnect scenario', () => {
    expect(getWsActionType(makeTest('t1', { actionType: 'wsConnect' }))).toBe('wsConnect');
  });

  it('returns "wsSend" for wsSend scenario', () => {
    expect(getWsActionType(makeTest('t1', { actionType: 'wsSend' }))).toBe('wsSend');
  });

  it('returns "wsReceive" for wsReceive scenario', () => {
    expect(getWsActionType(makeTest('t1', { actionType: 'wsReceive' }))).toBe('wsReceive');
  });
});

// ─── validateWsActionConfig ─────────────────────────────────────────────────

describe('validateWsActionConfig', () => {
  // --- Non-WS scenarios always pass ---

  it('returns [] for an HTTP scenario (no actionType)', () => {
    expect(validateWsActionConfig(makeTest('t1'))).toEqual([]);
  });

  it('returns [] for an explicit actionType "http"', () => {
    expect(validateWsActionConfig(makeTest('t1', { actionType: 'http' }))).toEqual([]);
  });

  it('returns [] for a Kafka scenario', () => {
    expect(validateWsActionConfig(makeTest('t1', { actionType: 'kafkaProduce' }))).toEqual([]);
    expect(validateWsActionConfig(makeTest('t1', { actionType: 'kafkaConsume' }))).toEqual([]);
  });

  // --- wsConnect validation ---

  it('returns error when wsConnect scenario has no config bag', () => {
    const errors = validateWsActionConfig(makeTest('t1', { actionType: 'wsConnect' }));
    expect(errors).toContain('wsConnectAction is required when actionType is "wsConnect"');
    expect(errors).toHaveLength(1);
  });

  it('returns error for wsConnect with empty url', () => {
    const errors = validateWsActionConfig(makeTest('t1', {
      actionType: 'wsConnect',
      wsConnectAction: { url: '' },
    }));
    expect(errors).toContain('wsConnectAction.url is required');
  });

  it('returns error for wsConnect with whitespace-only url', () => {
    const errors = validateWsActionConfig(makeTest('t1', {
      actionType: 'wsConnect',
      wsConnectAction: { url: '   ' },
    }));
    expect(errors).toContain('wsConnectAction.url is required');
  });

  it('returns [] for a valid wsConnect config', () => {
    expect(validateWsActionConfig(makeTest('t1', {
      actionType: 'wsConnect',
      wsConnectAction: createDefaultWsConnectAction('ws://localhost:8080'),
    }))).toEqual([]);
  });

  // --- wsSend validation ---

  it('returns error when wsSend scenario has no config bag', () => {
    const errors = validateWsActionConfig(makeTest('t1', { actionType: 'wsSend' }));
    expect(errors).toContain('wsSendAction is required when actionType is "wsSend"');
    expect(errors).toHaveLength(1);
  });

  it('returns error for wsSend without connectionRef', () => {
    const errors = validateWsActionConfig(makeTest('t1', {
      actionType: 'wsSend',
      wsSendAction: { message: 'hello' },
    }));
    expect(errors).toContain("wsSendAction requires connectionRef (reference a wsConnect test's Connection ID)");
  });

  it('returns [] for wsSend with connectionRef', () => {
    expect(validateWsActionConfig(makeTest('t1', {
      actionType: 'wsSend',
      wsSendAction: { message: 'hello', connectionRef: 'conn-1' },
    }))).toEqual([]);
  });

  it('returns error for wsSend with url-only (standalone not implemented)', () => {
    const errors = validateWsActionConfig(makeTest('t1', {
      actionType: 'wsSend',
      wsSendAction: { message: 'hello', url: 'ws://localhost:8080' },
    }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('connectionRef');
  });

  it('returns [] for wsSend with empty message (allowed for ping frames)', () => {
    expect(validateWsActionConfig(makeTest('t1', {
      actionType: 'wsSend',
      wsSendAction: { message: '', connectionRef: 'conn-1' },
    }))).toEqual([]);
  });

  // --- wsReceive validation ---

  it('returns error when wsReceive scenario has no config bag', () => {
    const errors = validateWsActionConfig(makeTest('t1', { actionType: 'wsReceive' }));
    expect(errors).toContain('wsReceiveAction is required when actionType is "wsReceive"');
    expect(errors).toHaveLength(1);
  });

  it('returns error for wsReceive without connectionRef', () => {
    const errors = validateWsActionConfig(makeTest('t1', {
      actionType: 'wsReceive',
      wsReceiveAction: { timeoutMs: 5000 },
    }));
    expect(errors).toContain("wsReceiveAction requires connectionRef (reference a wsConnect test's Connection ID)");
  });

  it('returns [] for wsReceive with connectionRef', () => {
    expect(validateWsActionConfig(makeTest('t1', {
      actionType: 'wsReceive',
      wsReceiveAction: { connectionRef: 'conn-1' },
    }))).toEqual([]);
  });

  it('returns error for wsReceive with url-only (standalone not implemented)', () => {
    const errors = validateWsActionConfig(makeTest('t1', {
      actionType: 'wsReceive',
      wsReceiveAction: { url: 'ws://localhost:8080' },
    }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('connectionRef');
  });

  it('returns error when matchCriteria.jsonPathValue is set without jsonPathMatch', () => {
    const errors = validateWsActionConfig(makeTest('t1', {
      actionType: 'wsReceive',
      wsReceiveAction: {
        connectionRef: 'conn-1',
        matchCriteria: { jsonPathValue: 'confirmed' },
      },
    }));
    expect(errors).toContain(
      'wsReceiveAction.matchCriteria.jsonPathValue requires matchCriteria.jsonPathMatch to be set',
    );
  });

  it('returns [] when matchCriteria.jsonPathValue and jsonPathMatch are both set', () => {
    expect(validateWsActionConfig(makeTest('t1', {
      actionType: 'wsReceive',
      wsReceiveAction: {
        connectionRef: 'conn-1',
        matchCriteria: { jsonPathMatch: '$.status', jsonPathValue: 'confirmed' },
      },
    }))).toEqual([]);
  });

  it('returns [] for wsReceive with all match criteria types', () => {
    expect(validateWsActionConfig(makeTest('t1', {
      actionType: 'wsReceive',
      wsReceiveAction: {
        connectionRef: 'conn-1',
        matchCriteria: {
          contentContains: 'order',
          contentRegex: 'order-\\d+',
          jsonPathMatch: '$.type',
          jsonPathValue: 'message',
          messageType: 'text',
        },
      },
    }))).toEqual([]);
  });
});

// ─── Scenario with WS action config (integration with Scenario type) ────────

describe('Scenario with WS config integration', () => {
  it('constructs a valid wsConnect scenario matching the Kafka pattern', () => {
    const scenario: Scenario = {
      ...makeTest('t1'),
      method: 'WEBSOCKET',
      actionType: 'wsConnect',
      wsConnectAction: createDefaultWsConnectAction('ws://localhost:8080'),
    };
    expect(isWsScenario(scenario)).toBe(true);
    expect(validateWsActionConfig(scenario)).toEqual([]);
  });

  it('constructs a valid wsSend scenario', () => {
    const scenario: Scenario = {
      ...makeTest('t2'),
      method: 'WEBSOCKET',
      actionType: 'wsSend',
      wsSendAction: {
        ...createDefaultWsSendAction('{"subscribe":"orders"}'),
        connectionRef: 'primary',
      },
    };
    expect(isWsScenario(scenario)).toBe(true);
    expect(validateWsActionConfig(scenario)).toEqual([]);
  });

  it('constructs a valid wsReceive scenario', () => {
    const scenario: Scenario = {
      ...makeTest('t3'),
      method: 'WEBSOCKET',
      actionType: 'wsReceive',
      wsReceiveAction: {
        ...createDefaultWsReceiveAction(),
        connectionRef: 'primary',
      },
    };
    expect(isWsScenario(scenario)).toBe(true);
    expect(validateWsActionConfig(scenario)).toEqual([]);
  });

  it('legacy HTTP scenario still works with WS guard functions', () => {
    const scenario = makeTest('t4');
    expect(isWsScenario(scenario)).toBe(false);
    expect(resolveWsActionType(scenario)).toBe('http');
    expect(getWsActionType(scenario)).toBeUndefined();
    expect(validateWsActionConfig(scenario)).toEqual([]);
  });
});

// ─── ensureScenarioDefaults ─────────────────────────────────────────────────────

describe('ensureScenarioDefaults', () => {
  it('adds missing auth, body, validation, headers to a bare WS scenario', () => {
    const bare = { id: 'x', name: 'bare', url: 'ws://localhost', method: 'WEBSOCKET' as const } as unknown as Scenario;
    const result = ensureScenarioDefaults(bare);
    expect(result).toBe(bare); // mutates in place
    expect(result.auth).toEqual({ type: 'none' });
    expect(result.body).toBe('');
    expect(result.validation).toEqual({ mode: 'none' });
    expect(result.headers).toEqual([]);
  });

  it('does not overwrite existing fields', () => {
    const scenario = makeTest('full', {
      auth: { type: 'bearer', token: 'abc' },
      body: '{"x":1}',
      validation: { mode: 'full' },
      headers: [{ key: 'X-Test', value: '1' }],
    });
    ensureScenarioDefaults(scenario);
    expect(scenario.auth).toEqual({ type: 'bearer', token: 'abc' });
    expect(scenario.body).toBe('{"x":1}');
    expect(scenario.validation).toEqual({ mode: 'full' });
    expect(scenario.headers).toEqual([{ key: 'X-Test', value: '1' }]);
  });

  it('handles null body specifically', () => {
    const scenario = makeTest('nb', { body: null as unknown as string });
    ensureScenarioDefaults(scenario);
    expect(scenario.body).toBe('');
  });
});

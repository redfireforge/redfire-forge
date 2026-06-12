import { describe, it, expect } from 'vitest';
import { isWsActionType, isWsNumericTarget } from './websocket';
import type {
  WsActionType,
  ScenarioActionType,
  WsConnectActionConfig,
  WsSendActionConfig,
  WsReceiveActionConfig,
  WsResultMeta,
  WsAssertionTarget,
  WsNumericAssertionTarget,
  WsHarnessMatchCriteria,
  Assertion,
  Scenario,
  RequestResult,
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

// ─── isWsActionType ──────────────────────────────────────────────────────────

describe('isWsActionType', () => {
  it('returns true for "wsConnect"', () => {
    expect(isWsActionType('wsConnect')).toBe(true);
  });

  it('returns true for "wsSend"', () => {
    expect(isWsActionType('wsSend')).toBe(true);
  });

  it('returns true for "wsReceive"', () => {
    expect(isWsActionType('wsReceive')).toBe(true);
  });

  it('returns false for "http"', () => {
    expect(isWsActionType('http')).toBe(false);
  });

  it('returns false for "kafkaProduce"', () => {
    expect(isWsActionType('kafkaProduce')).toBe(false);
  });

  it('returns false for "kafkaConsume"', () => {
    expect(isWsActionType('kafkaConsume')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isWsActionType(undefined)).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isWsActionType('grpc')).toBe(false);
  });
});

// ─── isWsNumericTarget ──────────────────────────────────────────────────────

describe('isWsNumericTarget', () => {
  it('returns true for "ws.latencyMs"', () => {
    expect(isWsNumericTarget('ws.latencyMs')).toBe(true);
  });

  it('returns true for "ws.size"', () => {
    expect(isWsNumericTarget('ws.size')).toBe(true);
  });

  it('returns false for "ws.body"', () => {
    expect(isWsNumericTarget('ws.body')).toBe(false);
  });

  it('returns false for "ws.type"', () => {
    expect(isWsNumericTarget('ws.type')).toBe(false);
  });

  it('returns false for "ws.protocol"', () => {
    expect(isWsNumericTarget('ws.protocol')).toBe(false);
  });
});

// ─── WsActionType type contract ──────────────────────────────────────────────

describe('WsActionType type contract', () => {
  it('compiles with all three WS action types', () => {
    const types: WsActionType[] = ['wsConnect', 'wsSend', 'wsReceive'];
    expect(types).toHaveLength(3);
  });
});

// ─── ScenarioActionType type contract ────────────────────────────────────────

describe('ScenarioActionType type contract', () => {
  it('includes HTTP, Kafka, and WS action types', () => {
    const all: ScenarioActionType[] = [
      'http',
      'kafkaProduce', 'kafkaConsume',
      'wsConnect', 'wsSend', 'wsReceive',
    ];
    expect(all).toHaveLength(6);
  });
});

// ─── WsConnectActionConfig ──────────────────────────────────────────────────

describe('WsConnectActionConfig type contract', () => {
  it('accepts a minimal config with only required url', () => {
    const config: WsConnectActionConfig = { url: 'ws://localhost:8080' };
    expect(config.url).toBe('ws://localhost:8080');
  });

  it('accepts a full config with all optional fields', () => {
    const config: WsConnectActionConfig = {
      url: 'wss://example.com/ws',
      headers: [{ key: 'Authorization', value: 'Bearer tok' }],
      queryParams: [{ key: 'room', value: 'lobby' }],
      subprotocols: 'graphql-ws,subscriptions-transport-ws',
      timeoutMs: 15_000,
      protocolMode: 'graphql-ws',
      tlsConfig: { rejectUnauthorized: false },
      connectionId: 'primary',
    };
    expect(config.protocolMode).toBe('graphql-ws');
    expect(config.connectionId).toBe('primary');
  });
});

// ─── WsSendActionConfig ─────────────────────────────────────────────────────

describe('WsSendActionConfig type contract', () => {
  it('accepts a minimal config with required message', () => {
    const config: WsSendActionConfig = { message: '{"type":"ping"}' };
    expect(config.message).toBe('{"type":"ping"}');
  });

  it('accepts a full config with all optional fields', () => {
    const config: WsSendActionConfig = {
      connectionRef: 'primary',
      url: 'ws://localhost:8080',
      message: '{"action":"subscribe","channel":"orders"}',
      messageType: 'text',
      waitForResponse: true,
      responseTimeoutMs: 3_000,
    };
    expect(config.waitForResponse).toBe(true);
    expect(config.responseTimeoutMs).toBe(3_000);
  });
});

// ─── WsReceiveActionConfig ──────────────────────────────────────────────────

describe('WsReceiveActionConfig type contract', () => {
  it('accepts a minimal config (all fields optional)', () => {
    const config: WsReceiveActionConfig = {};
    expect(config.timeoutMs).toBeUndefined();
  });

  it('accepts a full config with match criteria', () => {
    const config: WsReceiveActionConfig = {
      connectionRef: 'primary',
      url: 'ws://localhost:8080',
      timeoutMs: 5_000,
      matchCriteria: {
        contentContains: 'order-accepted',
        messageType: 'text',
      },
    };
    expect(config.matchCriteria?.contentContains).toBe('order-accepted');
  });
});

// ─── WsHarnessMatchCriteria ─────────────────────────────────────────────────

describe('WsHarnessMatchCriteria type contract', () => {
  it('accepts all filter fields', () => {
    const mc: WsHarnessMatchCriteria = {
      contentContains: 'hello',
      contentRegex: 'order-\\d+',
      jsonPathMatch: '$.status',
      jsonPathValue: 'confirmed',
      messageType: 'text',
    };
    expect(mc.jsonPathMatch).toBe('$.status');
  });

  it('accepts an empty criteria (all fields optional)', () => {
    const mc: WsHarnessMatchCriteria = {};
    expect(mc.contentContains).toBeUndefined();
  });
});

// ─── WsResultMeta ───────────────────────────────────────────────────────────

describe('WsResultMeta type contract', () => {
  it('accepts a minimal connect result meta', () => {
    const meta: WsResultMeta = {
      connectionId: 'conn-1',
      url: 'ws://localhost:8080',
    };
    expect(meta.connectionId).toBe('conn-1');
  });

  it('accepts a full result meta with all fields', () => {
    const meta: WsResultMeta = {
      connectionId: 'conn-1',
      frameType: 'text',
      protocol: 'graphql-ws',
      url: 'wss://example.com/ws',
      closeCode: 1000,
      messageSize: 256,
    };
    expect(meta.closeCode).toBe(1000);
    expect(meta.messageSize).toBe(256);
  });
});

// ─── WsAssertionTarget ──────────────────────────────────────────────────────

describe('WsAssertionTarget selector paths', () => {
  it('accepts all literal target paths', () => {
    const targets: WsAssertionTarget[] = [
      'ws.body', 'ws.type', 'ws.size', 'ws.latencyMs',
      'ws.protocol', 'ws.connectionId',
    ];
    expect(targets).toHaveLength(6);
  });

  it('accepts ws.header.<name> template literal target', () => {
    const target: WsAssertionTarget = 'ws.header.X-Custom';
    expect(target.startsWith('ws.header.')).toBe(true);
  });

  it('accepts ws.$.<path> JSONPath template literal target', () => {
    const target: WsAssertionTarget = 'ws.$.data.items[0].name';
    expect(target.startsWith('ws.$.')).toBe(true);
  });
});

// ─── WsNumericAssertionTarget ───────────────────────────────────────────────

describe('WsNumericAssertionTarget type contract', () => {
  it('only allows ws.latencyMs and ws.size', () => {
    const targets: WsNumericAssertionTarget[] = ['ws.latencyMs', 'ws.size'];
    expect(targets).toHaveLength(2);
  });
});

// ─── Assertion type: wsField discriminant ────────────────────────────────────

describe('Assertion type: wsField', () => {
  it('constructs a wsField assertion targeting ws.body with equals operator', () => {
    const assertion: Assertion = {
      type: 'wsField',
      target: 'ws.body',
      operator: 'contains',
      value: 'order-accepted',
    };
    if (assertion.type === 'wsField') {
      expect(assertion.target).toBe('ws.body');
      expect(assertion.operator).toBe('contains');
    }
  });

  it('constructs a wsField assertion for ws.type', () => {
    const assertion: Assertion = {
      type: 'wsField',
      target: 'ws.type',
      operator: 'equals',
      value: 'text',
    };
    if (assertion.type === 'wsField') {
      expect(assertion.target).toBe('ws.type');
    }
  });

  it('constructs a wsField assertion for an upgrade response header', () => {
    const assertion: Assertion = {
      type: 'wsField',
      target: 'ws.header.Sec-WebSocket-Protocol',
      operator: 'equals',
      value: 'graphql-ws',
    };
    if (assertion.type === 'wsField') {
      expect(assertion.target).toBe('ws.header.Sec-WebSocket-Protocol');
    }
  });

  it('constructs a wsField assertion with JSONPath into message body', () => {
    const assertion: Assertion = {
      type: 'wsField',
      target: 'ws.$.data.orderId',
      operator: 'equals',
      value: 'ORD-123',
    };
    if (assertion.type === 'wsField') {
      expect(assertion.target).toBe('ws.$.data.orderId');
    }
  });

  it('supports negate flag on wsField assertions', () => {
    const assertion: Assertion = {
      type: 'wsField',
      target: 'ws.body',
      operator: 'contains',
      value: 'error',
      negate: true,
    };
    if (assertion.type === 'wsField') {
      expect(assertion.negate).toBe(true);
    }
  });

  it('supports "exists" operator without value', () => {
    const assertion: Assertion = {
      type: 'wsField',
      target: 'ws.protocol',
      operator: 'exists',
    };
    if (assertion.type === 'wsField') {
      expect(assertion.value).toBeUndefined();
    }
  });
});

// ─── Assertion type: wsNumericField discriminant ─────────────────────────────

describe('Assertion type: wsNumericField', () => {
  it('constructs a wsNumericField assertion for ws.latencyMs', () => {
    const assertion: Assertion = {
      type: 'wsNumericField',
      target: 'ws.latencyMs',
      operator: '<',
      value: 1000,
    };
    if (assertion.type === 'wsNumericField') {
      expect(assertion.target).toBe('ws.latencyMs');
      expect(assertion.operator).toBe('<');
      expect(assertion.value).toBe(1000);
    }
  });

  it('constructs a wsNumericField assertion for ws.size', () => {
    const assertion: Assertion = {
      type: 'wsNumericField',
      target: 'ws.size',
      operator: '<=',
      value: 65536,
    };
    if (assertion.type === 'wsNumericField') {
      expect(assertion.target).toBe('ws.size');
    }
  });

  it('supports negate flag on wsNumericField assertions', () => {
    const assertion: Assertion = {
      type: 'wsNumericField',
      target: 'ws.latencyMs',
      operator: '>',
      value: 5000,
      negate: true,
    };
    if (assertion.type === 'wsNumericField') {
      expect(assertion.negate).toBe(true);
    }
  });

  it('supports all comparison operators', () => {
    const ops = ['=', '!=', '>', '>=', '<', '<='] as const;
    for (const op of ops) {
      const assertion: Assertion = {
        type: 'wsNumericField',
        target: 'ws.latencyMs',
        operator: op,
        value: 100,
      };
      expect(assertion.type).toBe('wsNumericField');
    }
  });
});

// ─── Scenario WS action config fields ────────────────────────────────────────

describe('Scenario WS action config fields', () => {
  it('accepts a scenario with wsConnectAction', () => {
    const scenario: Scenario = {
      ...makeTest('t1'),
      method: 'WEBSOCKET',
      actionType: 'wsConnect',
      wsConnectAction: { url: 'ws://localhost:8080' },
    };
    expect(scenario.actionType).toBe('wsConnect');
    expect(scenario.wsConnectAction?.url).toBe('ws://localhost:8080');
  });

  it('accepts a scenario with wsSendAction', () => {
    const scenario: Scenario = {
      ...makeTest('t2'),
      method: 'WEBSOCKET',
      actionType: 'wsSend',
      wsSendAction: {
        connectionRef: 'conn-1',
        message: '{"subscribe":"orders"}',
        waitForResponse: true,
      },
    };
    expect(scenario.wsSendAction?.connectionRef).toBe('conn-1');
    expect(scenario.wsSendAction?.waitForResponse).toBe(true);
  });

  it('accepts a scenario with wsReceiveAction including match criteria', () => {
    const scenario: Scenario = {
      ...makeTest('t3'),
      method: 'WEBSOCKET',
      actionType: 'wsReceive',
      wsReceiveAction: {
        connectionRef: 'conn-1',
        timeoutMs: 5_000,
        matchCriteria: {
          contentContains: 'order-confirmed',
          messageType: 'text',
        },
      },
    };
    expect(scenario.wsReceiveAction?.matchCriteria?.contentContains).toBe('order-confirmed');
  });

  it('accepts method "WEBSOCKET" alongside WS actionType', () => {
    const scenario = makeTest('t4', { method: 'WEBSOCKET', actionType: 'wsConnect' });
    expect(scenario.method).toBe('WEBSOCKET');
  });
});

// ─── RequestResult wsResultMeta ──────────────────────────────────────────────

describe('RequestResult wsResultMeta', () => {
  it('accepts a result with wsResultMeta and WS transportType', () => {
    const result: Partial<RequestResult> = {
      transportType: 'wsConnect',
      wsResultMeta: {
        connectionId: 'conn-1',
        protocol: 'graphql-ws',
        url: 'wss://example.com/ws',
      },
    };
    expect(result.wsResultMeta?.protocol).toBe('graphql-ws');
    expect(result.transportType).toBe('wsConnect');
  });

  it('wsResultMeta is optional (absent for HTTP results)', () => {
    const result: Partial<RequestResult> = {
      transportType: 'http',
    };
    expect(result.wsResultMeta).toBeUndefined();
  });
});

// ─── TestDefinitionSnapshot method ───────────────────────────────────────────

describe('TestDefinitionSnapshot method includes WEBSOCKET', () => {
  it('accepts WEBSOCKET as a valid snapshot method', () => {
    const snapshot = {
      name: 'WS Test',
      url: 'ws://localhost:8080',
      method: 'WEBSOCKET' as const,
      headers: [],
      body: '',
      auth: { type: 'none' as const },
    };
    expect(snapshot.method).toBe('WEBSOCKET');
  });
});

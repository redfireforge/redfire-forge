import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWsAction } from './wsExecution';
import type { Scenario, WsConnectActionConfig, WsSendActionConfig, WsReceiveActionConfig } from '../shared/types';
import type { WsNodeOperations } from '../features/workflow/engine/graphRunnerNodeHandlerContext';
import { resetResultIdCounter } from './requestExecution';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'sc-1',
    name: 'WS Test',
    url: 'ws://localhost:8080',
    method: 'WEBSOCKET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  } as Scenario;
}

function makeWsOps(overrides: Partial<WsNodeOperations> = {}): WsNodeOperations {
  return {
    connect: vi.fn<WsNodeOperations['connect']>().mockResolvedValue({
      connectionId: 'proxy-conn-1',
      protocol: 'graphql-ws',
      extensions: '',
      latencyMs: 42,
    }),
    send: vi.fn<WsNodeOperations['send']>().mockResolvedValue({ latencyMs: 5 }),
    snapshotCursor: vi.fn<WsNodeOperations['snapshotCursor']>().mockResolvedValue('cursor-0'),
    waitForMessage: vi.fn<WsNodeOperations['waitForMessage']>().mockResolvedValue({
      data: '{"hello":"world"}',
      type: 'text',
      timestamp: 1000,
    }),
    disconnect: vi.fn<WsNodeOperations['disconnect']>().mockResolvedValue(undefined),
    disconnectAll: vi.fn<WsNodeOperations['disconnectAll']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function connectCfg(overrides: Partial<WsConnectActionConfig> = {}): WsConnectActionConfig {
  return { url: 'ws://localhost:8080/ws', ...overrides };
}

function sendCfg(overrides: Partial<WsSendActionConfig> = {}): WsSendActionConfig {
  return { connectionRef: 'primary', message: '{"ping":true}', ...overrides };
}

function receiveCfg(overrides: Partial<WsReceiveActionConfig> = {}): WsReceiveActionConfig {
  return { connectionRef: 'primary', ...overrides };
}

beforeEach(() => {
  resetResultIdCounter();
});

// ---------------------------------------------------------------------------
// wsConnect
// ---------------------------------------------------------------------------

describe('executeWsAction — wsConnect', () => {
  it('returns success result with wsResultMeta on successful connect', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg({ connectionId: 'primary', subprotocols: 'graphql-ws, json' }),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.transportType).toBe('wsConnect');
    expect(result.wsResultMeta).toEqual({
      connectionId: 'primary',
      protocol: 'graphql-ws',
      url: 'ws://localhost:8080/ws',
    });

    expect(wsOps.connect).toHaveBeenCalledWith(expect.objectContaining({
      url: 'ws://localhost:8080/ws',
      connectionId: 'primary',
      subprotocols: ['graphql-ws', 'json'],
    }));
  });

  it('converts KeyValue headers and queryParams to Record', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg({
        headers: [{ key: 'X-Custom', value: 'test' }],
        queryParams: [{ key: 'token', value: 'abc' }],
      }),
    });

    await executeWsAction(scenario, wsOps);

    expect(wsOps.connect).toHaveBeenCalledWith(expect.objectContaining({
      headers: { 'X-Custom': 'test' },
      queryParams: { token: 'abc' },
    }));
  });

  it('handles connection failure with error classification', async () => {
    const wsOps = makeWsOps({
      connect: vi.fn().mockRejectedValue(new Error('Connection timed out')),
    });
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg(),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(0);
    expect(result.errorMessage).toContain('timeout');
    expect(result.transportType).toBe('wsConnect');
  });

  it('handles protocol failure classification', async () => {
    const wsOps = makeWsOps({
      connect: vi.fn().mockRejectedValue(new Error('WebSocket upgrade failed: wrong protocol')),
    });
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg(),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toMatch(/\[protocol\]/);
  });

  it('returns error if wsConnectAction is missing', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({ actionType: 'wsConnect' });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('wsConnectAction is required');
  });

  it('excludes empty headers/queryParams/subprotocols', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg({
        headers: [],
        queryParams: [],
        subprotocols: '',
      }),
    });

    await executeWsAction(scenario, wsOps);

    expect(wsOps.connect).toHaveBeenCalledWith(expect.objectContaining({
      headers: undefined,
      queryParams: undefined,
      subprotocols: undefined,
    }));
  });

  it('uses custom timeoutMs from config', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg({ timeoutMs: 30_000 }),
    });

    await executeWsAction(scenario, wsOps, 5_000);

    expect(wsOps.connect).toHaveBeenCalledWith(expect.objectContaining({
      timeoutMs: 30_000,
    }));
  });

  it('falls back to provided timeoutMs when config has no timeoutMs', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg({ timeoutMs: undefined }),
    });

    await executeWsAction(scenario, wsOps, 7_000);

    expect(wsOps.connect).toHaveBeenCalledWith(expect.objectContaining({
      timeoutMs: 7_000,
    }));
  });

  it('preserves data row context in result', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg(),
      dataRowId: 'row-42',
      dataRowLabel: 'Row 42: url=ws://test',
    } as Partial<Scenario>);

    const result = await executeWsAction(scenario, wsOps);

    expect(result.dataRowId).toBe('row-42');
    expect(result.dataRowLabel).toBe('Row 42: url=ws://test');
  });
});

// ---------------------------------------------------------------------------
// wsSend
// ---------------------------------------------------------------------------

describe('executeWsAction — wsSend', () => {
  it('sends a message and returns success (no waitForResponse)', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsSend',
      wsSendAction: sendCfg({ waitForResponse: false }),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.transportType).toBe('wsSend');
    expect(result.responseBody).toBe('');
    expect(wsOps.send).toHaveBeenCalledWith({
      connectionId: 'primary',
      data: '{"ping":true}',
      type: 'text',
    });
    expect(wsOps.snapshotCursor).not.toHaveBeenCalled();
    expect(wsOps.waitForMessage).not.toHaveBeenCalled();
  });

  it('sends and waits for response using snapshotCursor', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsSend',
      wsSendAction: sendCfg({ waitForResponse: true, responseTimeoutMs: 3_000 }),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.responseBody).toBe('{"hello":"world"}');
    expect(result.wsResultMeta?.frameType).toBe('text');
    expect(result.wsResultMeta?.connectionId).toBe('primary');

    expect(wsOps.snapshotCursor).toHaveBeenCalledWith({ connectionId: 'primary' });
    expect(wsOps.send).toHaveBeenCalled();
    expect(wsOps.waitForMessage).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'primary',
      timeoutMs: 3_000,
      sinceCursor: 'cursor-0',
    }));
  });

  it('uses binary message type when specified', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsSend',
      wsSendAction: sendCfg({ messageType: 'binary' }),
    });

    await executeWsAction(scenario, wsOps);

    expect(wsOps.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'binary',
    }));
  });

  it('handles send failure with error classification', async () => {
    const wsOps = makeWsOps({
      send: vi.fn().mockRejectedValue(new Error('Connection closed unexpectedly')),
    });
    const scenario = makeScenario({
      actionType: 'wsSend',
      wsSendAction: sendCfg(),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(0);
    expect(result.errorMessage).toContain('closed');
  });

  it('handles waitForMessage timeout', async () => {
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockRejectedValue(new Error('WebSocket waitForMessage timed out')),
    });
    const scenario = makeScenario({
      actionType: 'wsSend',
      wsSendAction: sendCfg({ waitForResponse: true }),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('timeout');
    expect(result.wsResultMeta).toBeDefined();
    expect(result.wsResultMeta!.connectionId).toBe('primary');
    expect(result.wsResultMeta!.messageSize).toBeUndefined();
    expect(result.wsResultMeta!.frameType).toBeUndefined();
  });

  it('returns error if connectionRef is missing', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsSend',
      wsSendAction: { message: 'hello', connectionRef: undefined } as unknown as WsSendActionConfig,
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('connectionRef is required');
  });

  it('returns error if wsSendAction is missing', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({ actionType: 'wsSend' });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('wsSendAction is required');
  });
});

// ---------------------------------------------------------------------------
// wsReceive
// ---------------------------------------------------------------------------

describe('executeWsAction — wsReceive', () => {
  it('receives a message and returns success', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.transportType).toBe('wsReceive');
    expect(result.responseBody).toBe('{"hello":"world"}');
    expect(result.wsResultMeta?.connectionId).toBe('primary');
    expect(result.wsResultMeta?.frameType).toBe('text');
    expect(result.wsResultMeta?.messageSize).toBeGreaterThan(0);
  });

  it('passes match criteria to waitForMessage', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg({
        matchCriteria: {
          contentContains: 'hello',
          jsonPathMatch: '$.status',
          jsonPathValue: 'ok',
          messageType: 'text',
        },
      }),
    });

    await executeWsAction(scenario, wsOps);

    expect(wsOps.waitForMessage).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'primary',
      matchCriteria: {
        contentContains: 'hello',
        contentRegex: undefined,
        jsonPathMatch: '$.status',
        jsonPathValue: 'ok',
        messageType: 'text',
      },
    }));
  });

  it('uses custom timeoutMs from config', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg({ timeoutMs: 20_000 }),
    });

    await executeWsAction(scenario, wsOps, 5_000);

    expect(wsOps.waitForMessage).toHaveBeenCalledWith(expect.objectContaining({
      timeoutMs: 20_000,
    }));
  });

  it('falls back to provided timeoutMs when config has no timeoutMs', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg({ timeoutMs: undefined }),
    });

    await executeWsAction(scenario, wsOps, 8_000);

    expect(wsOps.waitForMessage).toHaveBeenCalledWith(expect.objectContaining({
      timeoutMs: 8_000,
    }));
  });

  it('handles receive timeout failure', async () => {
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockRejectedValue(new Error('WebSocket waitForMessage timed out')),
    });
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.httpStatus).toBe(0);
    expect(result.errorMessage).toContain('timeout');
  });

  it('returns error if connectionRef is missing', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: { connectionRef: undefined } as unknown as WsReceiveActionConfig,
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('connectionRef is required');
  });

  it('returns error if wsReceiveAction is missing', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({ actionType: 'wsReceive' });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('wsReceiveAction is required');
  });

  it('parses JSON response body into responseObj for validation', async () => {
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: '{"status":"ok","count":42}',
        type: 'text',
        timestamp: 1000,
      }),
    });
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
      validation: {
        mode: 'selective',
        expectedFields: [{ jsonPath: '$.status', expectedValue: 'ok' }],
      },
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
  });

  it('handles non-JSON response body gracefully', async () => {
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: 'plain text message',
        type: 'text',
        timestamp: 1000,
      }),
    });
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
    expect(result.responseBody).toBe('plain text message');
  });
});

// ---------------------------------------------------------------------------
// Validation integration
// ---------------------------------------------------------------------------

describe('executeWsAction — validation', () => {
  it('runs wsField assertions on receive results', async () => {
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: '{"status":"ok"}',
        type: 'text',
        timestamp: 1000,
      }),
    });
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
      validation: {
        mode: 'assertions',
        assertions: [
          { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'status' },
        ],
      },
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
  });

  it('reports failure for failing wsField assertions', async () => {
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: '{"status":"error"}',
        type: 'text',
        timestamp: 1000,
      }),
    });
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
      validation: {
        mode: 'assertions',
        assertions: [
          { type: 'wsField', target: 'ws.body', operator: 'equals', value: 'expected-body' },
        ],
      },
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.failureDetails).toBeDefined();
    expect(result.failureDetails!.length).toBeGreaterThan(0);
  });

  it('runs wsNumericField assertions on latency', async () => {
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: 'msg',
        type: 'text',
        timestamp: 1000,
      }),
    });
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
      validation: {
        mode: 'assertions',
        assertions: [
          { type: 'wsNumericField', target: 'ws.size', operator: '>', value: 0 },
        ],
      },
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
  });

  it('runs validation mode=selective with expectedFields on connect', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg(),
      validation: {
        mode: 'selective',
        expectedFields: [{ jsonPath: '$.protocol', expectedValue: 'graphql-ws' }],
      },
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('executeWsAction — edge cases', () => {
  it('rejects non-WS action type', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({ actionType: 'kafkaProduce' });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('Not a WS actionType');
  });

  it('rejects http action type', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({ actionType: 'http' });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('Not a WS actionType');
  });

  it('truncates responseBody to 10000 chars', async () => {
    const longBody = 'x'.repeat(15_000);
    const wsOps = makeWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: longBody,
        type: 'text',
        timestamp: 1000,
      }),
    });
    const scenario = makeScenario({
      actionType: 'wsReceive',
      wsReceiveAction: receiveCfg(),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.responseBody.length).toBe(10_000);
  });

  it('sets correct wsResultMeta.messageSize for wsSend without waitForResponse', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsSend',
      wsSendAction: sendCfg({ message: 'hello', waitForResponse: false }),
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.wsResultMeta?.messageSize).toBe(5);
  });

  it('populates wsContext for validation with connect metadata', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg({ connectionId: 'conn-a' }),
      validation: {
        mode: 'assertions',
        assertions: [
          { type: 'wsField', target: 'ws.protocol', operator: 'equals', value: 'graphql-ws' },
          { type: 'wsField', target: 'ws.connectionId', operator: 'equals', value: 'conn-a' },
        ],
      },
    });

    const result = await executeWsAction(scenario, wsOps);

    expect(result.passed).toBe(true);
  });

  it('handles empty KeyValue arrays for headers/queryParams', async () => {
    const wsOps = makeWsOps();
    const scenario = makeScenario({
      actionType: 'wsConnect',
      wsConnectAction: connectCfg({
        headers: [{ key: '', value: '' }],
        queryParams: [{ key: '  ', value: 'x' }],
      }),
    });

    await executeWsAction(scenario, wsOps);

    expect(wsOps.connect).toHaveBeenCalledWith(expect.objectContaining({
      headers: undefined,
      queryParams: undefined,
    }));
  });
});
